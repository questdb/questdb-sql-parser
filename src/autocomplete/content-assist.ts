import { type ILexingError, IToken, TokenType } from "chevrotain"
import { parser, parse as parseRaw } from "../parser/parser"
import { visitor } from "../parser/visitor"
import { QuestDBLexer } from "../parser/lexer"
import type { Statement } from "../parser/ast"
import { IDENTIFIER_KEYWORD_TOKENS } from "./token-classification"

// =============================================================================
// Constants
// =============================================================================

const WORD_BOUNDARY_CHARS = new Set([
  " ",
  "\n",
  "\t",
  "\r",
  "(",
  ")",
  ",",
  ";",
  ".",
  "=",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
  "'",
  '"',
  "|",
  "&",
  "^",
  "~",
  "!",
  "@",
  ":",
  "[",
  "]",
])

// =============================================================================
// Types
// =============================================================================

/**
 * A table reference found in the SQL query
 */
export interface TableRef {
  /** The table name */
  table: string
  /** Optional alias */
  alias?: string
}

/**
 * Result from content assist analysis
 */
export interface ContentAssistResult {
  /** Token types that are syntactically valid at the cursor position */
  nextTokenTypes: TokenType[]
  /** Tables/aliases found in the query (for column suggestions) */
  tablesInScope: TableRef[]
  /** Columns from CTEs, keyed by CTE name (lowercase) */
  cteColumns: Record<string, { name: string; type: string }[]>
  /** The tokens before the cursor */
  tokensBefore: IToken[]
  /** Whether the cursor is in the middle of a word (partial token being typed) */
  isMidWord: boolean
  /** Any lexer errors */
  lexErrors: ILexingError[]
  /**
   * When the cursor is after a qualified reference (e.g., "t1." or "trades."),
   * this contains the qualifier name (e.g., "t1" or "trades"). The provider
   * should resolve this against tablesInScope aliases/names to filter columns.
   */
  qualifiedTableRef?: string
  /** Whether the grammar context expects column names (expression/columnRef positions) */
  suggestColumns: boolean
  /** Whether the grammar context expects table names (tableName positions, or expression context) */
  suggestTables: boolean
  /**
   * Bare column names (lowercase) referenced before the cursor in expression
   * context. Used by the provider to boost tables containing all these columns.
   */
  referencedColumns: Set<string>
}

// =============================================================================
// Table Extraction from AST
// =============================================================================

/**
 * Extract table references from a parsed AST
 */
function normalizeTableName(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === "string") return value
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.parts)) {
      // Use only the last part (table name) for schema lookup.
      // Schema-qualified names like "public.trades" should resolve to "trades"
      // since the schema columns map is keyed by bare table name.
      const parts = obj.parts as string[]
      return parts[parts.length - 1]
    }
    if (typeof obj.name === "string") return obj.name
  }
  return undefined
}

interface ExtractResult {
  tables: TableRef[]
  cteColumns: Record<string, { name: string; type: string }[]>
}

/**
 * Infer column names from a CTE's inner SELECT columns.
 * Uses alias if present, otherwise derives name from expression.
 */
function extractCteColumnNames(
  columns: unknown[],
): { name: string; type: string }[] {
  const result: { name: string; type: string }[] = []
  for (const col of columns) {
    if (!col || typeof col !== "object") continue
    const c = col as Record<string, unknown>

    // StarSelectItem or QualifiedStarSelectItem — can't resolve without schema
    if (c.type === "star" || c.type === "qualifiedStar") continue

    // ExpressionSelectItem
    if (c.type === "selectItem") {
      // Prefer alias
      if (typeof c.alias === "string") {
        result.push({ name: c.alias, type: "" })
        continue
      }

      const expr = c.expression as Record<string, unknown> | undefined
      if (!expr) continue

      // Column reference → use last part of qualified name
      if (expr.type === "column" && expr.name) {
        const qn = expr.name as Record<string, unknown>
        if (Array.isArray(qn.parts) && qn.parts.length > 0) {
          result.push({
            name: qn.parts[qn.parts.length - 1] as string,
            type: "",
          })
          continue
        }
      }

      // Function call → use function name
      if (expr.type === "function" && typeof expr.name === "string") {
        result.push({ name: expr.name, type: "" })
        continue
      }
    }
  }
  return result
}

function extractTablesFromAst(ast: unknown): ExtractResult {
  const tables: TableRef[] = []
  const cteColumns: Record<string, { name: string; type: string }[]> = {}
  const visited = new WeakSet()

  function visit(node: unknown) {
    if (!node || typeof node !== "object") return
    if (visited.has(node)) return
    visited.add(node)

    const n = node as Record<string, unknown>

    // Handle CTE definitions — surface CTE names as virtual tables
    // and extract column names from the inner SELECT
    if (n.type === "cte" && typeof n.name === "string") {
      tables.push({ table: n.name })
      const query = n.query as Record<string, unknown> | undefined
      if (query && Array.isArray(query.columns)) {
        const cols = extractCteColumnNames(query.columns)
        cteColumns[n.name.toLowerCase()] = cols
      } else {
        // Register CTE name even if no columns are extractable (e.g., SELECT *)
        cteColumns[n.name.toLowerCase()] = []
      }
      // Don't recurse into the CTE's inner query — its tables are not
      // in the outer scope. We already extracted the CTE name and columns.
      return
    }

    // Handle table references in FROM clause
    if (n.type === "tableRef") {
      const tableName = normalizeTableName(n.table ?? n.name)
      if (tableName) {
        tables.push({
          table: tableName,
          alias: n.alias as string | undefined,
        })
      }
    }

    // Handle FROM clause with table
    if (n.from) {
      const tableName = normalizeTableName(n.from)
      if (tableName) {
        const from = n.from as Record<string, unknown>
        tables.push({
          table: tableName,
          alias: from.alias as string | undefined,
        })
      } else {
        visit(n.from)
      }
    }

    // Handle JOIN clauses
    if (n.joins && Array.isArray(n.joins)) {
      for (const join of n.joins as Record<string, unknown>[]) {
        const joinTableName = normalizeTableName(join.table)
        if (joinTableName) {
          tables.push({
            table: joinTableName,
            alias: join.alias as string | undefined,
          })
        }
        visit(join)
      }
    }

    // Handle UPDATE table
    if (n.type === "update" && n.table) {
      const tableName = normalizeTableName(n.table)
      if (tableName) {
        tables.push({ table: tableName })
      }
    }

    // Handle INSERT INTO table
    if (n.type === "insert" && n.table) {
      const tableName = normalizeTableName(n.table)
      if (tableName) {
        tables.push({ table: tableName })
      }
    }

    // Handle ALTER TABLE / ALTER MATERIALIZED VIEW
    if (
      (n.type === "alterTable" || n.type === "alterMaterializedView") &&
      n.table
    ) {
      const tableName = normalizeTableName(n.table)
      if (tableName) {
        tables.push({ table: tableName })
      }
    }
    if (n.type === "alterMaterializedView" && n.view) {
      const viewName = normalizeTableName(n.view)
      if (viewName) {
        tables.push({ table: viewName })
      }
    }

    // Recurse into child nodes
    for (const key of Object.keys(n)) {
      const child = n[key]
      if (Array.isArray(child)) {
        for (const item of child) {
          visit(item)
        }
      } else if (typeof child === "object" && child !== null) {
        visit(child)
      }
    }
  }

  if (Array.isArray(ast)) {
    for (const stmt of ast) {
      visit(stmt)
    }
  } else {
    visit(ast)
  }

  return { tables, cteColumns }
}

/**
 * Extract CTE column information from the token stream by finding CTE
 * boundaries and parsing each inner SELECT independently.
 *
 * This is used when the full SQL fails to parse (incomplete outer query)
 * but the CTE definitions themselves are complete.
 */
interface CteTokenExtractResult {
  cteNames: string[]
  cteColumns: Record<string, { name: string; type: string }[]>
  /** Token index where the CTE block ends (first token of the outer query) */
  outerQueryStart: number
}

/**
 * Extract CTE names and column information from the token stream by finding
 * CTE boundaries and parsing each inner SELECT independently.
 *
 * This is used when the full SQL fails to parse (incomplete outer query)
 * but the CTE definitions themselves are complete.
 */
function extractCtesFromTokens(
  fullSql: string,
  tokens: IToken[],
): CteTokenExtractResult {
  const cteNames: string[] = []
  const cteColumns: Record<string, { name: string; type: string }[]> = {}
  if (tokens.length === 0 || tokens[0].tokenType.name !== "With")
    return { cteNames, cteColumns, outerQueryStart: 0 }

  const isIdent = (t: IToken | undefined): boolean =>
    !!t &&
    (t.tokenType.name === "Identifier" ||
      t.tokenType.name === "QuotedIdentifier" ||
      IDENTIFIER_KEYWORD_TOKENS.has(t.tokenType.name))

  let i = 1 // skip WITH
  while (i < tokens.length) {
    // Expect: cteName AS (
    if (!isIdent(tokens[i])) break
    const cteName = tokens[i].image
    i++
    if (tokens[i]?.tokenType.name !== "As") break
    i++
    if (tokens[i]?.tokenType.name !== "LParen") break
    const innerStart = i + 1
    i++

    // Find matching RParen
    let depth = 1
    while (i < tokens.length && depth > 0) {
      if (tokens[i].tokenType.name === "LParen") depth++
      if (tokens[i].tokenType.name === "RParen") depth--
      i++
    }

    // Always register the CTE name, even if we can't extract columns
    cteNames.push(cteName)
    // Initialize with empty array; will be populated below if columns are found
    cteColumns[cteName.toLowerCase()] = []

    if (depth === 0) {
      // tokens[innerStart..i-2] is the inner SELECT body
      const innerEnd = i - 1 // RParen index
      if (innerStart < innerEnd) {
        const innerSql = fullSql.substring(
          tokens[innerStart].startOffset,
          tokens[innerEnd - 1].startOffset + tokens[innerEnd - 1].image.length,
        )
        try {
          const { cst } = parseRaw(innerSql)
          const ast = visitor.visit(cst) as Statement[]
          if (ast && ast.length > 0) {
            const stmt = ast[0] as unknown as Record<string, unknown>
            if (Array.isArray(stmt.columns)) {
              const cols = extractCteColumnNames(stmt.columns)
              if (cols.length > 0) {
                cteColumns[cteName.toLowerCase()] = cols
              }
            }
          }
        } catch {
          // Inner SELECT parse failed, skip this CTE's columns
        }
      }
    } else {
      // Unclosed paren — CTE body is incomplete, can't extract columns
      break
    }

    // After RParen, expect Comma (another CTE) or SELECT/INSERT/UPDATE
    if (tokens[i]?.tokenType.name === "Comma") {
      i++ // next CTE
      continue
    }
    break
  }

  return { cteNames, cteColumns, outerQueryStart: i }
}

// =============================================================================
// CTE cursor detection
// =============================================================================

interface CteBodyContext {
  /** Name of the CTE containing the cursor (unquoted) */
  name: string
  /** Token index of the first token inside the CTE body (after LParen) */
  bodyTokenStart: number
  /** Token index of the RParen (or tokens.length if unclosed) */
  bodyTokenEnd: number
}

/**
 * Detect whether the cursor is inside a CTE body. Returns the CTE name and
 * body token range so callers can exclude self-references and extract inner
 * table references.
 */
function findCteContainingCursor(
  tokens: IToken[],
  cursorOffset: number,
): CteBodyContext | null {
  if (tokens.length === 0 || tokens[0].tokenType.name !== "With") return null

  const isIdent = (t: IToken | undefined): boolean =>
    !!t &&
    (t.tokenType.name === "Identifier" ||
      t.tokenType.name === "QuotedIdentifier" ||
      IDENTIFIER_KEYWORD_TOKENS.has(t.tokenType.name))

  let i = 1 // skip WITH
  while (i < tokens.length) {
    if (!isIdent(tokens[i])) break
    const rawName = tokens[i].image
    const cteName =
      tokens[i].tokenType.name === "QuotedIdentifier"
        ? rawName.slice(1, -1)
        : rawName
    i++
    if (tokens[i]?.tokenType.name !== "As") break
    i++
    if (tokens[i]?.tokenType.name !== "LParen") break
    const lparenOffset = tokens[i].startOffset
    i++
    const bodyTokenStart = i

    // Find matching RParen
    let depth = 1
    while (i < tokens.length && depth > 0) {
      if (tokens[i].tokenType.name === "LParen") depth++
      if (tokens[i].tokenType.name === "RParen") depth--
      i++
    }

    if (depth === 0) {
      // i is past RParen; tokens[i-1] is RParen
      const rparenIdx = i - 1
      const rparenEndOffset =
        tokens[rparenIdx].startOffset + tokens[rparenIdx].image.length
      if (cursorOffset > lparenOffset && cursorOffset < rparenEndOffset) {
        return { name: cteName, bodyTokenStart, bodyTokenEnd: rparenIdx }
      }
    } else {
      // Unclosed paren — if cursor is after LParen, it's inside this CTE
      if (cursorOffset > lparenOffset) {
        return { name: cteName, bodyTokenStart, bodyTokenEnd: tokens.length }
      }
      break
    }

    // After RParen, expect Comma or end of CTEs
    if (tokens[i]?.tokenType.name === "Comma") {
      i++
      continue
    }
    break
  }

  return null
}

/**
 * Try to extract tables by parsing the query.
 * If parsing fails, try to extract from tokens.
 */
function extractTables(fullSql: string, tokens: IToken[]): ExtractResult {
  // First, try to parse and extract from AST
  try {
    const { cst } = parseRaw(fullSql)
    const ast = visitor.visit(cst) as Statement[]
    if (ast && ast.length > 0) {
      return extractTablesFromAst(ast)
    }
  } catch {
    // Parsing or visitor failed, fall through to token-based extraction
  }

  // Fallback: extract from tokens by looking for table name patterns
  // Handles malformed input where full AST extraction is not available.
  const tables: TableRef[] = []
  const TABLE_PREFIX_TOKENS = new Set(["From", "Join", "Update", "Into"])
  const isIdentifierLike = (token: IToken | undefined): token is IToken =>
    !!token &&
    (token.tokenType.name === "Identifier" ||
      token.tokenType.name === "QuotedIdentifier" ||
      IDENTIFIER_KEYWORD_TOKENS.has(token.tokenType.name))

  const tokenToNamePart = (token: IToken): string => {
    if (token.tokenType.name === "QuotedIdentifier") {
      return token.image.slice(1, -1)
    }
    return token.image
  }

  const readQualifiedName = (
    startIndex: number,
  ): { name: string; nextIndex: number } | null => {
    const first = tokens[startIndex]
    if (!isIdentifierLike(first)) return null

    const parts = [tokenToNamePart(first)]
    let i = startIndex + 1

    while (
      i + 1 < tokens.length &&
      tokens[i].tokenType.name === "Dot" &&
      isIdentifierLike(tokens[i + 1])
    ) {
      parts.push(tokenToNamePart(tokens[i + 1]))
      i += 2
    }

    // Use only the last part (table name) for schema lookup.
    // Schema-qualified names like "metrics.trades" resolve to "trades".
    return { name: parts[parts.length - 1], nextIndex: i }
  }

  // Extract CTE names and columns from the token stream. CTE definitions are
  // usually complete even when the outer query is incomplete, so parse each
  // inner SELECT independently.
  const { cteNames, cteColumns, outerQueryStart } = extractCtesFromTokens(
    fullSql,
    tokens,
  )

  // Scan for FROM/JOIN table references only in the outer query (after CTEs).
  // This avoids leaking tables referenced inside CTE bodies into the outer scope.
  // Also detect ALTER TABLE / TRUNCATE TABLE patterns for column scoping.
  const DDL_TABLE_PREFIXES = new Set(["Alter", "Truncate", "Drop"])
  for (let i = outerQueryStart; i < tokens.length; i++) {
    const tokenName = tokens[i].tokenType.name

    // Standard DML: FROM/JOIN/UPDATE/INTO <table>
    if (TABLE_PREFIX_TOKENS.has(tokenName)) {
      const tableNameResult = readQualifiedName(i + 1)
      if (!tableNameResult) continue

      let alias: string | undefined
      let aliasStart = tableNameResult.nextIndex
      if (tokens[aliasStart]?.tokenType.name === "As") {
        aliasStart++
      }
      if (isIdentifierLike(tokens[aliasStart])) {
        alias = tokenToNamePart(tokens[aliasStart])
      }

      tables.push({
        table: tableNameResult.name,
        alias,
      })

      // Continue from where we consumed table/alias to avoid duplicate captures.
      i = alias ? aliasStart : tableNameResult.nextIndex - 1
      continue
    }

    // DDL: ALTER TABLE / TRUNCATE TABLE / DROP TABLE <name>
    if (
      DDL_TABLE_PREFIXES.has(tokenName) &&
      tokens[i + 1]?.tokenType.name === "Table"
    ) {
      const tableNameResult = readQualifiedName(i + 2)
      if (tableNameResult) {
        tables.push({ table: tableNameResult.name })
        i = tableNameResult.nextIndex - 1
      }
    }
  }
  for (const name of cteNames) {
    tables.push({ table: name })
  }

  return { tables, cteColumns }
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Check if a ruleStack path represents the catch-all implicit SELECT or pivot
 * at the top-level statement dispatch. These are BACKTRACK alternatives that
 * computeContentAssist explores unconditionally, producing noise when a
 * specific statement rule already matched.
 *
 * Detects: statement → implicitSelectBody / implicitSelectStatement / pivotStatement (top-level catch-all)
 * Does NOT match nested uses (e.g., cteDefinition → implicitSelectBody).
 */
function isImplicitStatementPath(
  ruleStack: string[],
  implicitRules: Set<string>,
): boolean {
  for (let i = 0; i < ruleStack.length - 1; i++) {
    if (ruleStack[i] === "statement" && implicitRules.has(ruleStack[i + 1])) {
      return true
    }
  }
  return false
}

/**
 * Collapse a trailing qualified reference (ident.ident...ident) in the token
 * stream into a single identifier token. This allows re-computing suggestions
 * as if the user typed a simple column name, working around Chevrotain's
 * qualifiedStar path dominating the selectItem alternatives.
 *
 * Example: [SELECT, t, ., col] → [SELECT, col]
 */
/**
 * Check if a token type name represents an identifier-like token.
 * This includes plain Identifier, QuotedIdentifier, and any keyword
 * that has the IdentifierKeyword category (e.g., Timestamp, Index, Type).
 */
function isIdentifierLikeTokenName(name: string): boolean {
  return (
    name === "Identifier" ||
    name === "QuotedIdentifier" ||
    name === "IdentifierKeyword" ||
    IDENTIFIER_KEYWORD_TOKENS.has(name)
  )
}

function collapseTrailingQualifiedRef(tokens: IToken[]): IToken[] | null {
  if (tokens.length < 3) return null

  // Walk backwards from end: expect Identifier (. Identifier)+ pattern
  const i = tokens.length - 1
  const lastToken = tokens[i]
  if (!isIdentifierLikeTokenName(lastToken.tokenType.name)) {
    return null
  }

  // Walk backwards: Dot Identifier pairs
  let start = i
  while (start >= 2) {
    const maybeDot = tokens[start - 1]
    const maybeIdent = tokens[start - 2]
    if (maybeDot.tokenType.name !== "Dot") break
    if (!isIdentifierLikeTokenName(maybeIdent.tokenType.name)) break
    start -= 2
  }

  // Must have at least one Dot (i.e., start < i - 1) to be a qualified ref
  if (start >= i) return null

  // Replace tokens[start..i] with just the last identifier
  return [...tokens.slice(0, start), lastToken]
}

/**
 * Classify an identifier suggestion path based on its ruleStack.
 * - "column": identifierExpression or columnRef → suggest columns + tables
 * - "table": tableName rule → suggest tables only
 * - "newName": everything else (CREATE TABLE name, user names, etc.) → no suggestions
 */
function classifyIdentifierPath(
  ruleStack: string[],
): "column" | "table" | "newName" {
  if (ruleStack.includes("valuesClause")) return "newName"
  if (
    ruleStack.includes("identifierExpression") ||
    ruleStack.includes("columnRef") ||
    ruleStack.includes("qualifiedStar")
  )
    return "column"
  if (ruleStack.includes("tableName")) return "table"
  return "newName"
}

interface ComputeResult {
  nextTokenTypes: TokenType[]
  suggestColumns: boolean
  suggestTables: boolean
}

/**
 * Compute content assist suggestions, handling CTE context specially.
 *
 * Chevrotain's computeContentAssist at the "statement" level may only find
 * the insertStatement path when WITH is present, missing selectStatement and
 * updateStatement paths. This function detects that case and merges suggestions
 * from all WITH-capable statement types.
 */
function computeSuggestions(tokens: IToken[]): ComputeResult {
  const ruleName = tokens.some((t) => t.tokenType.name === "Semicolon")
    ? "statements"
    : "statement"
  const suggestions = parser.computeContentAssist(ruleName, tokens)

  // Filter out noise from implicit SELECT / pivot catch-all paths.
  const IMPLICIT_RULES = new Set([
    "implicitSelectBody",
    "implicitSelectStatement",
    "pivotStatement",
  ])
  const specific = suggestions.filter(
    (s) => !isImplicitStatementPath(s.ruleStack, IMPLICIT_RULES),
  )
  const effectiveSuggestions = specific.length > 0 ? specific : suggestions
  const result = effectiveSuggestions.map((s) => s.nextTokenType)

  // Classify each IdentifierKeyword path to determine whether columns/tables
  // should be suggested, based on the grammar rule that expects the identifier.
  let suggestColumns = false
  let suggestTables = false
  for (const s of effectiveSuggestions) {
    if (s.nextTokenType.name === "IdentifierKeyword") {
      const cls = classifyIdentifierPath(s.ruleStack)
      if (cls === "column") {
        suggestColumns = true
        suggestTables = true
      } else if (cls === "table") {
        suggestTables = true
      }
    }
  }

  // qualifiedStar fix: When computeContentAssist finds the qualifiedStar
  // path in selectItem (suggesting just Dot), the expression path is missed.
  // Detect this by checking if the *specific* (non-catch-all) suggestions are
  // all from qualifiedStar, then re-compute with the qualified reference
  // collapsed to a single identifier to get expression-path suggestions.
  if (
    effectiveSuggestions.length > 0 &&
    effectiveSuggestions.every((s) => s.ruleStack.includes("qualifiedStar"))
  ) {
    const collapsed = collapseTrailingQualifiedRef(tokens)
    if (collapsed) {
      try {
        const extra = parser.computeContentAssist(ruleName, collapsed)
        const filteredExtra = extra.filter(
          (s) => !isImplicitStatementPath(s.ruleStack, IMPLICIT_RULES),
        )
        const extraEffective = filteredExtra.length > 0 ? filteredExtra : extra
        const seen = new Set(result.map((t) => t.name))
        for (const s of extraEffective) {
          if (!seen.has(s.nextTokenType.name)) {
            seen.add(s.nextTokenType.name)
            result.push(s.nextTokenType)
          }
          // Classify extra paths too
          if (s.nextTokenType.name === "IdentifierKeyword") {
            const cls = classifyIdentifierPath(s.ruleStack)
            if (cls === "column") {
              suggestColumns = true
              suggestTables = true
            } else if (cls === "table") {
              suggestTables = true
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }

  return { nextTokenTypes: result, suggestColumns, suggestTables }
}

/**
 * When tablesInScope is empty (no FROM/JOIN yet), try to infer a table name
 * from a trailing qualified reference before the cursor.
 * e.g. "SELECT trades." → infer "trades" as table in scope.
 */
function inferTableFromQualifiedRef(
  tokensBefore: IToken[],
  isMidWord: boolean,
): TableRef | null {
  // If mid-word, the last token is a partial column name — look before it.
  const effective = isMidWord ? tokensBefore.slice(0, -1) : tokensBefore
  const lastIdx = effective.length - 1
  if (lastIdx < 1) return null
  if (effective[lastIdx].tokenType.name !== "Dot") return null

  const tableToken = effective[lastIdx - 1]
  if (!isIdentifierLikeTokenName(tableToken.tokenType.name)) return null

  const table =
    tableToken.tokenType.name === "QuotedIdentifier"
      ? tableToken.image.slice(1, -1)
      : tableToken.image

  return { table }
}

/**
 * Extract bare column names referenced in expression context from a token list.
 *
 * Scans the tokens and collects identifier names that are likely column
 * references, excluding:
 * - Qualified identifiers (followed by a Dot token — table/alias qualifiers)
 * - Middle segments of multi-part names (preceded AND followed by a Dot)
 * - Known table names and aliases (matched against tableAndAliasSet)
 * - Function calls (followed by a left-parenthesis token)
 *
 * @param tokens - Tokens to scan
 * @param tableAndAliasSet - Lowercase table names and aliases already in scope
 *   (built from tablesInScope by the caller). Identifiers matching any of these
 *   are excluded because they are table/alias references, not column names.
 *
 * Returns a Set of lowercase column names for efficient lookup.
 */
export function extractReferencedColumns(
  tokens: IToken[],
  tableAndAliasSet: Set<string>,
): Set<string> {
  const result = new Set<string>()

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const name = token.tokenType.name

    // Only consider identifier-like tokens
    if (
      name !== "Identifier" &&
      name !== "QuotedIdentifier" &&
      !IDENTIFIER_KEYWORD_TOKENS.has(name)
    ) {
      continue
    }

    // Exclude: followed by Dot → this is a table/alias qualifier (e.g. "t1" in "t1.col")
    if (i + 1 < tokens.length && tokens[i + 1].tokenType.name === "Dot") {
      continue
    }

    // Exclude: preceded by Dot AND followed by Dot → middle segment of a multi-part name.
    // But a trailing segment (preceded by Dot, NOT followed by Dot) IS a column name
    // (e.g. "ecn" in "c.ecn") and should be included for table ranking.
    if (
      i > 0 &&
      tokens[i - 1].tokenType.name === "Dot" &&
      i + 1 < tokens.length &&
      tokens[i + 1].tokenType.name === "Dot"
    ) {
      continue
    }

    // Exclude: followed by "(" → function call
    if (i + 1 < tokens.length && tokens[i + 1].tokenType.name === "LParen") {
      continue
    }

    const image =
      name === "QuotedIdentifier" ? token.image.slice(1, -1) : token.image
    const lower = image.toLowerCase()

    // Exclude: matches a known table name or alias → this is a table reference,
    // not a column name. This replaces the keyword-whitelist approach and is
    // grammar-aware: tablesInScope is already built from the parsed AST.
    if (tableAndAliasSet.has(lower)) {
      continue
    }

    result.add(lower)
  }

  return result
}

/**
 * Get content assist suggestions for a SQL string at a given cursor position
 *
 * @param fullSql - The complete SQL string
 * @param cursorOffset - The cursor position (0-indexed character offset)
 * @returns Content assist result with next valid tokens and tables in scope
 */
export function getContentAssist(
  fullSql: string,
  cursorOffset: number,
): ContentAssistResult {
  // Suppress suggestions when the cursor is inside any quoted string (single or double).
  // This covers both string literal values and single-quoted identifiers — while QuestDB
  // accepts single-quoted identifiers, providing completions inside quotes causes more
  // problems than it solves (prefix filtering breaks, ambiguity with string values).
  const fullTokens = QuestDBLexer.tokenize(fullSql).tokens
  for (const token of fullTokens) {
    if (
      token.tokenType.name !== "StringLiteral" &&
      token.tokenType.name !== "QuotedIdentifier"
    )
      continue
    const start = token.startOffset
    const end = token.startOffset + token.image.length
    if (cursorOffset > start && cursorOffset < end) {
      return {
        nextTokenTypes: [],
        tablesInScope: [],
        cteColumns: {},
        tokensBefore: [],
        isMidWord: true,
        lexErrors: [],
        suggestColumns: false,
        suggestTables: false,
        referencedColumns: new Set(),
      }
    }
  }

  // Split the text at cursor position
  const beforeCursor = fullSql.substring(0, cursorOffset)

  // Tokenize text before cursor
  const lexResult = QuestDBLexer.tokenize(beforeCursor)
  const tokens = lexResult.tokens

  // Check if cursor is mid-word (last char before cursor is not whitespace/punctuation).
  // If so, the last token is a partial word the user is still typing.
  // Drop it before calling computeContentAssist so the parser tells us what's
  // valid at the position BEFORE that word. The caller filters by the prefix.
  // Structural characters like ( ) , ; are NOT mid-word — they are complete tokens.
  const lastChar =
    cursorOffset > 0 && cursorOffset <= fullSql.length
      ? fullSql[cursorOffset - 1]
      : " "
  const isMidWord = !WORD_BOUNDARY_CHARS.has(lastChar)
  const tokensForAssist =
    isMidWord && tokens.length > 0 ? tokens.slice(0, -1) : tokens

  // Get syntactically valid next tokens using Chevrotain's content assist
  let nextTokenTypes: TokenType[] = []
  let suggestColumns = false
  let suggestTables = false
  try {
    const computed = computeSuggestions(tokensForAssist)
    nextTokenTypes = computed.nextTokenTypes
    suggestColumns = computed.suggestColumns
    suggestTables = computed.suggestTables
  } catch (e) {
    // If content assist fails, return empty suggestions
    // This can happen with malformed input
  }

  // Extract tables and CTE columns from the full query (reuses fullTokens from above)
  const { tables: tablesInScope, cteColumns } = extractTables(
    fullSql,
    fullTokens,
  )

  // If cursor is inside a CTE body, exclude the CTE itself from scope
  // to prevent self-reference (e.g., "WITH x AS (SELECT |)" shouldn't
  // suggest x's own columns). Also extract tables from the CTE body so
  // columns from the inner FROM/JOIN are available.
  const cursorCte = findCteContainingCursor(fullTokens, cursorOffset)
  if (cursorCte) {
    const cteNameLower = cursorCte.name.toLowerCase()
    // Remove self-reference from tablesInScope
    for (let j = tablesInScope.length - 1; j >= 0; j--) {
      if (tablesInScope[j].table.toLowerCase() === cteNameLower) {
        tablesInScope.splice(j, 1)
      }
    }
    // Remove self-reference from cteColumns
    delete cteColumns[cteNameLower]

    // Extract tables from the CTE body tokens so inner FROM/JOIN tables
    // are available for column scoping.
    const BODY_TABLE_PREFIXES = new Set(["From", "Join", "Update", "Into"])
    const seen = new Set(tablesInScope.map((t) => t.table.toLowerCase()))
    for (let j = cursorCte.bodyTokenStart; j < cursorCte.bodyTokenEnd; j++) {
      if (!BODY_TABLE_PREFIXES.has(fullTokens[j].tokenType.name)) continue
      const next = fullTokens[j + 1]
      if (
        next &&
        (next.tokenType.name === "Identifier" ||
          next.tokenType.name === "QuotedIdentifier" ||
          IDENTIFIER_KEYWORD_TOKENS.has(next.tokenType.name))
      ) {
        const tableName =
          next.tokenType.name === "QuotedIdentifier"
            ? next.image.slice(1, -1)
            : next.image
        const lower = tableName.toLowerCase()
        if (!seen.has(lower)) {
          seen.add(lower)
          tablesInScope.push({ table: tableName })
        }
      }
    }
  }

  // Detect qualified reference context (e.g., "t1." or "trades.sym")
  // and extract the qualifier name so the provider can filter columns.
  const qualifiedRef = inferTableFromQualifiedRef(tokens, isMidWord)
  if (tablesInScope.length === 0 && qualifiedRef) {
    tablesInScope.push(qualifiedRef)
  }

  // Build a set of known table names and aliases so extractReferencedColumns
  // can exclude them without a keyword whitelist.
  const tableAndAliasSet = new Set<string>()
  for (const t of tablesInScope) {
    tableAndAliasSet.add(t.table.toLowerCase())
    if (t.alias) tableAndAliasSet.add(t.alias.toLowerCase())
  }

  // Extract bare column references for table ranking (use tokensForAssist so
  // a partial mid-word token isn't mistaken for a complete column name).
  const referencedColumns = extractReferencedColumns(
    tokensForAssist,
    tableAndAliasSet,
  )

  return {
    nextTokenTypes,
    tablesInScope,
    cteColumns,
    tokensBefore: tokens,
    isMidWord,
    lexErrors: lexResult.errors,
    qualifiedTableRef: qualifiedRef?.table,
    suggestColumns,
    suggestTables,
    referencedColumns,
  }
}

/**
 * Simplified version that just returns next valid token names
 */
export function getNextValidTokens(sql: string): string[] {
  const lexResult = QuestDBLexer.tokenize(sql)
  try {
    return computeSuggestions(lexResult.tokens).nextTokenTypes.map(
      (t) => t.name,
    )
  } catch (e) {
    return []
  }
}

/**
 * Check if a token type is expected at the current position
 */
export function isTokenExpected(sql: string, tokenName: string): boolean {
  const validTokens = getNextValidTokens(sql)
  return validTokens.includes(tokenName)
}
