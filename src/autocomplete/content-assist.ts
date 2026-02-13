import { IToken, TokenType } from "chevrotain";
import { parser } from "../parser/parser";
import { QuestDBLexer } from "../parser/lexer";
import { parseToAst } from "../index";

// =============================================================================
// Types
// =============================================================================

/**
 * A table reference found in the SQL query
 */
export interface TableRef {
  /** The table name */
  table: string;
  /** Optional alias */
  alias?: string;
}

/**
 * Result from content assist analysis
 */
export interface ContentAssistResult {
  /** Token types that are syntactically valid at the cursor position */
  nextTokenTypes: TokenType[];
  /** Tables/aliases found in the query (for column suggestions) */
  tablesInScope: TableRef[];
  /** The tokens before the cursor */
  tokensBefore: IToken[];
  /** Whether the cursor is in the middle of a word (partial token being typed) */
  isMidWord: boolean;
  /** Any lexer errors */
  lexErrors: any[];
}

// =============================================================================
// Table Extraction from AST
// =============================================================================

/**
 * Extract table references from a parsed AST
 */
function normalizeTableName(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && Array.isArray(value.parts)) {
    return value.parts.join(".");
  }
  if (typeof value.name === "string") return value.name;
  return undefined;
}

function extractTablesFromAst(ast: any): TableRef[] {
  const tables: TableRef[] = [];
  const visited = new WeakSet();

  function visit(node: any) {
    if (!node || typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);

    // Handle table references in FROM clause
    if (node.type === "table_ref" || node.type === "tableRef") {
      const tableName = normalizeTableName(node.table ?? node.name);
      if (tableName) {
        tables.push({
          table: tableName,
          alias: node.alias,
        });
      }
    }

    // Handle FROM clause with table
    if (node.from) {
      const tableName = normalizeTableName(node.from);
      if (tableName) {
        tables.push({ table: tableName, alias: node.from.alias });
      } else {
        visit(node.from);
      }
    }

    // Handle JOIN clauses
    if (node.joins && Array.isArray(node.joins)) {
      for (const join of node.joins) {
        const joinTableName = normalizeTableName(join.table);
        if (joinTableName) {
          tables.push({ table: joinTableName, alias: join.alias });
        }
        visit(join);
      }
    }

    // Handle UPDATE table
    if (node.type === "update" && node.table) {
      const tableName = normalizeTableName(node.table);
      if (tableName) {
        tables.push({ table: tableName });
      }
    }

    // Handle INSERT INTO table
    if (node.type === "insert" && node.table) {
      const tableName = normalizeTableName(node.table);
      if (tableName) {
        tables.push({ table: tableName });
      }
    }

    // Recurse into child nodes
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          visit(item);
        }
      } else if (typeof child === "object" && child !== null) {
        visit(child);
      }
    }
  }

  if (Array.isArray(ast)) {
    for (const stmt of ast) {
      visit(stmt);
    }
  } else {
    visit(ast);
  }

  return tables;
}

/**
 * Try to extract tables by parsing the query.
 * If parsing fails, try to extract from tokens.
 */
function extractTables(fullSql: string, tokens: IToken[]): TableRef[] {
  // First, try to parse and extract from AST
  try {
    const result = parseToAst(fullSql);
    if (result.ast && result.ast.length > 0) {
      return extractTablesFromAst(result.ast);
    }
  } catch (e) {
    // Parsing failed, fall through to token-based extraction
  }

  // Fallback: extract from tokens by looking for table name patterns
  // Look for Identifier tokens that follow FROM or JOIN tokens
  const tables: TableRef[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const tokenName = tokens[i].tokenType.name;
    const nextToken = tokens[i + 1];

    if (
      (tokenName === "From" || tokenName === "Join" ||
        tokenName === "AsofJoin" || tokenName === "SpliceJoin" ||
        tokenName === "LtJoin" || tokenName === "CrossJoin" ||
        tokenName === "Update" || tokenName === "Into") &&
      nextToken.tokenType.name === "Identifier"
    ) {
      const tableName = nextToken.image;
      // Check for alias (Identifier following the table name)
      if (i + 2 < tokens.length) {
        const maybeAlias = tokens[i + 2];
        if (maybeAlias.tokenType.name === "Identifier") {
          tables.push({ table: tableName, alias: maybeAlias.image });
        } else {
          tables.push({ table: tableName });
        }
      } else {
        tables.push({ table: tableName });
      }
    }
  }

  return tables;
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
function isImplicitStatementPath(ruleStack: string[], implicitRules: Set<string>): boolean {
  for (let i = 0; i < ruleStack.length - 1; i++) {
    if (ruleStack[i] === "statement" && implicitRules.has(ruleStack[i + 1])) {
      return true;
    }
  }
  return false;
}

/**
 * Collapse a trailing qualified reference (ident.ident...ident) in the token
 * stream into a single identifier token. This allows re-computing suggestions
 * as if the user typed a simple column name, working around Chevrotain's
 * qualifiedStar path dominating the selectItem alternatives.
 *
 * Example: [SELECT, t, ., col] → [SELECT, col]
 */
function collapseTrailingQualifiedRef(tokens: IToken[]): IToken[] | null {
  if (tokens.length < 3) return null;

  // Walk backwards from end: expect Identifier (. Identifier)+ pattern
  let i = tokens.length - 1;
  const lastToken = tokens[i];
  const lastType = lastToken.tokenType.name;
  if (lastType !== "Identifier" && lastType !== "QuotedIdentifier" && lastType !== "IdentifierKeyword") {
    return null;
  }

  // Walk backwards: Dot Identifier pairs
  let start = i;
  while (start >= 2) {
    const maybeDot = tokens[start - 1];
    const maybeIdent = tokens[start - 2];
    if (maybeDot.tokenType.name !== "Dot") break;
    const identType = maybeIdent.tokenType.name;
    if (identType !== "Identifier" && identType !== "QuotedIdentifier" && identType !== "IdentifierKeyword") break;
    start -= 2;
  }

  // Must have at least one Dot (i.e., start < i - 1) to be a qualified ref
  if (start >= i) return null;

  // Replace tokens[start..i] with just the last identifier
  return [...tokens.slice(0, start), lastToken];
}

/**
 * Compute content assist suggestions, handling CTE context specially.
 *
 * Chevrotain's computeContentAssist at the "statement" level may only find
 * the insertStatement path when WITH is present, missing selectStatement and
 * updateStatement paths. This function detects that case and merges suggestions
 * from all WITH-capable statement types.
 */
function computeSuggestions(tokens: IToken[]): TokenType[] {
  const ruleName = tokens.some((t) => t.tokenType.name === "Semicolon")
    ? "statements"
    : "statement";
  const suggestions = parser.computeContentAssist(ruleName, tokens);

  // Filter out noise from implicit SELECT / pivot catch-all paths.
  const IMPLICIT_RULES = new Set(["implicitSelectBody", "implicitSelectStatement", "pivotStatement"]);
  const specific = suggestions.filter((s) => !isImplicitStatementPath(s.ruleStack, IMPLICIT_RULES));
  let result = (specific.length > 0 ? specific : suggestions)
    .map((s) => s.nextTokenType);

  // CTE fix: When tokens start with WITH, computeContentAssist at the
  // "statement" level only explores insertStatement (which comes first in
  // the OR). We also need suggestions from selectStatement and updateStatement.
  if (tokens.length > 0 && tokens[0].tokenType.name === "With") {
    const seen = new Set(result.map((t) => t.name));
    for (const rule of ["selectStatement", "updateStatement"]) {
      try {
        const extra = parser.computeContentAssist(rule, tokens);
        for (const s of extra) {
          if (!seen.has(s.nextTokenType.name)) {
            seen.add(s.nextTokenType.name);
            result.push(s.nextTokenType);
          }
        }
      } catch (e) {
        // Rule may not match — ignore
      }
    }
  }

  // qualifiedStar fix: When computeContentAssist finds the qualifiedStar
  // path in selectItem (suggesting just Dot), the expression path is missed.
  // Detect this by checking if the *specific* (non-catch-all) suggestions are
  // all from qualifiedStar, then re-compute with the qualified reference
  // collapsed to a single identifier to get expression-path suggestions.
  const effectiveSuggestions = specific.length > 0 ? specific : suggestions;
  if (effectiveSuggestions.length > 0 &&
      effectiveSuggestions.every((s) => s.ruleStack.includes("qualifiedStar"))) {
    // Find and collapse the trailing qualified reference (ident.ident...ident)
    // into a single identifier token, then re-compute to get expression-path suggestions.
    const collapsed = collapseTrailingQualifiedRef(tokens);
    if (collapsed) {
      try {
        const extra = parser.computeContentAssist(ruleName, collapsed);
        const filteredExtra = extra.filter((s) => !isImplicitStatementPath(s.ruleStack, IMPLICIT_RULES));
        const extraResult = (filteredExtra.length > 0 ? filteredExtra : extra)
          .map((s) => s.nextTokenType);
        const seen = new Set(result.map((t) => t.name));
        for (const t of extraResult) {
          if (!seen.has(t.name)) {
            seen.add(t.name);
            result.push(t);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }

  return result;
}

/**
 * Get content assist suggestions for a SQL string at a given cursor position
 *
 * @param fullSql - The complete SQL string
 * @param cursorOffset - The cursor position (0-indexed character offset)
 * @returns Content assist result with next valid tokens and tables in scope
 */
export function getContentAssist(fullSql: string, cursorOffset: number): ContentAssistResult {
  // Split the text at cursor position
  const beforeCursor = fullSql.substring(0, cursorOffset);

  // Tokenize text before cursor
  const lexResult = QuestDBLexer.tokenize(beforeCursor);
  const tokens = lexResult.tokens;

  // Check if cursor is mid-word (last char before cursor is not whitespace/punctuation).
  // If so, the last token is a partial word the user is still typing.
  // Drop it before calling computeContentAssist so the parser tells us what's
  // valid at the position BEFORE that word. The caller filters by the prefix.
  // Structural characters like ( ) , ; are NOT mid-word — they are complete tokens.
  const lastChar = cursorOffset > 0 && cursorOffset <= fullSql.length ? fullSql[cursorOffset - 1] : " ";
  const WORD_BOUNDARY_CHARS = new Set([" ", "\n", "\t", "\r", "(", ")", ",", ";", ".", "=", "<", ">", "+", "-", "*", "/", "%", "'", "\"", "|", "&", "^", "~", "!", "@", ":", "[", "]"]);
  const isMidWord = !WORD_BOUNDARY_CHARS.has(lastChar);
  const tokensForAssist = isMidWord && tokens.length > 0
    ? tokens.slice(0, -1)
    : tokens;

  // Get syntactically valid next tokens using Chevrotain's content assist
  let nextTokenTypes: TokenType[] = [];
  try {
    nextTokenTypes = computeSuggestions(tokensForAssist);
  } catch (e) {
    // If content assist fails, return empty suggestions
    // This can happen with malformed input
  }

  // Extract tables from the full query
  const fullTokens = QuestDBLexer.tokenize(fullSql).tokens;
  const tablesInScope = extractTables(fullSql, fullTokens);

  return {
    nextTokenTypes,
    tablesInScope,
    tokensBefore: tokens,
    isMidWord,
    lexErrors: lexResult.errors,
  };
}

/**
 * Simplified version that just returns next valid token names
 */
export function getNextValidTokens(sql: string): string[] {
  const lexResult = QuestDBLexer.tokenize(sql);
  try {
    return computeSuggestions(lexResult.tokens).map((t) => t.name);
  } catch (e) {
    return [];
  }
}

/**
 * Check if a token type is expected at the current position
 */
export function isTokenExpected(sql: string, tokenName: string): boolean {
  const validTokens = getNextValidTokens(sql);
  return validTokens.includes(tokenName);
}
