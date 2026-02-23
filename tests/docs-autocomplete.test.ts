/**
 * Documentation SQL - Autocomplete Walkthrough Tests
 *
 * For each SQL statement from docs-queries.json, tokenizes it and walks
 * through token-by-token, verifying that at each position the autocomplete
 * provider's getSuggestions() includes the actual next word as a suggestion.
 *
 * This tests the REAL end-to-end autocomplete behavior that users see.
 *
 * Per-query schema extraction:
 * 1. Parse the query with parseToAst() to get the AST
 * 2. Walk the AST to extract table names and column definitions
 * 3. Create a provider with the extracted schema
 * 4. Walk token-by-token, checking that each keyword and known identifier
 *    appears in the suggestion list
 *
 * Queries with skipAutocomplete: true are known edge cases (implicit SELECT,
 * SQL hints, semicolons, array slice colon syntax).
 *
 * Source of truth: tests/fixtures/docs-queries.json
 */

import { describe, it } from "vitest"
import {
  tokenize,
  createAutocompleteProvider,
  parseToAst,
  getNextValidTokens,
} from "../src/index"
import type { SchemaInfo } from "../src/autocomplete/types"
import type * as AST from "../src/parser/ast"
import {
  tokenNameToKeyword,
  IDENTIFIER_KEYWORD_TOKENS,
} from "../src/autocomplete/token-classification"
import * as fs from "fs"
import * as path from "path"

interface DocsQuery {
  query: string
  skipAutocomplete?: boolean
}

const fixtureP = path.join(__dirname, "fixtures", "docs-queries.json")
const queries: DocsQuery[] = JSON.parse(
  fs.readFileSync(fixtureP, "utf-8"),
) as DocsQuery[]

// =============================================================================
// Schema extraction from AST
// =============================================================================

interface ExtractedSchema {
  tables: Set<string>
  columns: Map<string, Set<string>> // tableName → column names
}

/**
 * Extract table and column names from a parsed AST.
 * Walks all nodes recursively to find table references and column definitions.
 */
function extractSchemaFromAst(statements: AST.Statement[]): ExtractedSchema {
  const tables = new Set<string>()
  const columns = new Map<string, Set<string>>()

  function addColumn(table: string, col: string) {
    const lower = table.toLowerCase()
    if (!columns.has(lower)) columns.set(lower, new Set())
    columns.get(lower)!.add(col)
  }

  function getTableName(name: AST.QualifiedName): string {
    return name.parts[name.parts.length - 1]
  }

  function walkNode(node: unknown): void {
    if (!node || typeof node !== "object") return
    const n = node as Record<string, unknown>

    // Handle arrays
    if (Array.isArray(node)) {
      for (const item of node) walkNode(item)
      return
    }

    const type = n.type as string | undefined

    // TableRef: extract table name from FROM/JOIN
    if (type === "tableRef") {
      const ref = node as AST.TableRef
      if (
        ref.table &&
        (ref.table as AST.QualifiedName).type === "qualifiedName"
      ) {
        const name = getTableName(ref.table as AST.QualifiedName)
        tables.add(name)
      }
      // Recurse into joins
      if (ref.joins) walkNode(ref.joins)
      // Recurse into subqueries
      if (ref.table && (ref.table as AST.SelectStatement).type === "select") {
        walkNode(ref.table)
      }
      return
    }

    // JoinClause: extract table from joined table
    if (type === "join") {
      const join = node as AST.JoinClause
      walkNode(join.table)
      if (join.on) walkNode(join.on)
      return
    }

    // CreateTable: extract table name and column definitions
    if (type === "createTable") {
      const ct = node as AST.CreateTableStatement
      const tableName = getTableName(ct.table)
      tables.add(tableName)
      if (ct.columns) {
        for (const col of ct.columns) {
          addColumn(tableName, col.name)
        }
      }
      if (ct.asSelect) walkNode(ct.asSelect)
      if (ct.like) tables.add(getTableName(ct.like))
      return
    }

    // InsertStatement: extract table name and column names
    if (type === "insert") {
      const ins = node as AST.InsertStatement
      const tableName = getTableName(ins.table)
      tables.add(tableName)
      if (ins.columns) {
        for (const col of ins.columns) {
          addColumn(tableName, col)
        }
      }
      if (ins.select) walkNode(ins.select)
      return
    }

    // SelectStatement: recurse into all parts
    if (type === "select") {
      const sel = node as AST.SelectStatement
      if (sel.from) walkNode(sel.from)
      if (sel.columns) walkNode(sel.columns)
      if (sel.where) walkNode(sel.where)
      if (sel.with) {
        for (const cte of sel.with) {
          if (cte.name) tables.add(cte.name)
          if (cte.query) walkNode(cte.query)
        }
      }
      if (sel.groupBy) walkNode(sel.groupBy)
      if (sel.orderBy) walkNode(sel.orderBy)
      if (sel.sampleBy) walkNode(sel.sampleBy)
      if (sel.latestOn) walkNode(sel.latestOn)
      if (sel.declare) walkNode(sel.declare)
      return
    }

    // AlterTable: extract table name
    if (type === "alterTable") {
      const alt = node as AST.AlterTableStatement
      tables.add(getTableName(alt.table))
      return
    }

    // UpdateStatement: extract table name
    if (type === "update") {
      const upd = node as AST.UpdateStatement
      tables.add(getTableName(upd.table))
      if (upd.from) walkNode(upd.from)
      if (upd.where) walkNode(upd.where)
      return
    }

    // For all other node types, recurse into all object/array properties
    for (const value of Object.values(n)) {
      if (value && typeof value === "object") {
        walkNode(value)
      }
    }
  }

  for (const stmt of statements) {
    walkNode(stmt)
  }

  return { tables, columns }
}

/**
 * Build a SchemaInfo from extracted table/column data
 */
function buildSchema(extracted: ExtractedSchema): SchemaInfo {
  const tableList = Array.from(extracted.tables).map((name) => ({ name }))
  const columnsMap: Record<string, { name: string; type: string }[]> = {}

  for (const [tableName, cols] of extracted.columns) {
    columnsMap[tableName] = Array.from(cols).map((name) => ({
      name,
      type: "STRING",
    }))
  }

  return { tables: tableList, columns: columnsMap }
}

// =============================================================================
// Token classification
// =============================================================================

/**
 * Token types that we cannot verify via suggestion labels:
 * - Literals: user-provided values, not suggested
 * - Punctuation and operators: not shown as keyword suggestions
 * - Variable references: user-defined
 */
const SKIP_TOKEN_TYPES = new Set([
  // Literals
  "StringLiteral",
  "NumberLiteral",
  "DurationLiteral",
  "BooleanLiteral",
  "NullLiteral",
  "GeohashLiteral",
  "GeohashBinaryLiteral",
  "DecimalLiteral",
  "LongLiteral",
  // Punctuation
  "LParen",
  "RParen",
  "Comma",
  "Dot",
  "Semicolon",
  "LBracket",
  "RBracket",
  "AtSign",
  "ColonEquals",
  // Operators
  "Equals",
  "NotEquals",
  "LessThan",
  "LessThanOrEqual",
  "GreaterThan",
  "GreaterThanOrEqual",
  "Plus",
  "Minus",
  "Star",
  "Divide",
  "Modulo",
  "Concat",
  "DoubleColon",
  "RegexMatch",
  "RegexNotMatch",
  "RegexNotEquals",
  "IPv4ContainedBy",
  "IPv4Contains",
  "BitXor",
  "BitOr",
  "BitAnd",
  // Variable references
  "VariableReference",
  // Interval literals
  "IntervalLiteral",
])

// =============================================================================
// Walkthrough logic
// =============================================================================

interface WalkthroughStep {
  position: number
  tokenImage: string
  tokenType: string
  expectedLabel: string
  suggestions: string[]
  found: boolean
}

function autocompleteWalkthrough(
  sql: string,
  schema: SchemaInfo,
): {
  success: boolean
  steps: WalkthroughStep[]
  failedSteps: WalkthroughStep[]
} {
  const { tokens, errors } = tokenize(sql)
  if (errors.length > 0) {
    return { success: false, steps: [], failedSteps: [] }
  }

  const provider = createAutocompleteProvider(schema)

  // Build a set of known table and column names for identifier matching
  const knownNames = new Set<string>()
  for (const t of schema.tables) knownNames.add(t.name.toLowerCase())
  for (const cols of Object.values(schema.columns)) {
    for (const c of cols) knownNames.add(c.name.toLowerCase())
  }

  const steps: WalkthroughStep[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const tokenType = token.tokenType.name

    // Skip literals, punctuation, operators
    if (SKIP_TOKEN_TYPES.has(tokenType)) continue

    const prefix = sql.substring(0, token.startOffset)
    const labels = provider
      .getSuggestions(prefix, prefix.length)
      .map((s) => s.label)

    let found: boolean
    let expectedLabel: string

    if (tokenType === "Identifier" || tokenType === "QuotedIdentifier") {
      // Identifier token: check if it's a known table/column name (reference)
      // or an unknown name (new table, alias, new column definition) → skip
      const word =
        tokenType === "QuotedIdentifier"
          ? token.image.slice(1, -1).toLowerCase()
          : token.image.toLowerCase()
      if (!knownNames.has(word)) continue

      // If the provider suggests ANY known name at this position, it's a
      // reference position (FROM, JOIN, WHERE, etc.) → verify our name is there.
      // If it suggests none, it's a definition position (CREATE TABLE name,
      // column definition, alias) → skip.
      const suggestsAnyKnownName = labels.some((l) =>
        knownNames.has(l.toLowerCase()),
      )
      if (!suggestsAnyKnownName) continue

      expectedLabel = word
      found = labels.some((l) => l.toLowerCase() === word)
    } else {
      // Keyword token: check if keyword label appears in suggestions
      expectedLabel = tokenNameToKeyword(tokenType)
      const expectedUpper = expectedLabel.toUpperCase()
      found = labels.some((l) => l.toUpperCase() === expectedUpper)

      // Fallback: keyword tokens used as identifiers (e.g., `timestamp`
      // as a column name). Accept if the word is a known column/table in
      // the schema OR IdentifierKeyword is expected at this position.
      if (!found && IDENTIFIER_KEYWORD_TOKENS.has(tokenType)) {
        const word = token.image.toLowerCase()
        if (knownNames.has(word)) {
          found = labels.some((l) => l.toLowerCase() === word)
        }
        if (!found) {
          const rawTokens = getNextValidTokens(prefix)
          if (
            rawTokens.includes("IdentifierKeyword") ||
            rawTokens.includes(tokenType)
          ) {
            found = true
          }
        }
      }
    }

    steps.push({
      position: token.startOffset,
      tokenImage: token.image,
      tokenType,
      expectedLabel,
      suggestions: labels.slice(0, 15),
      found,
    })
  }

  return {
    success: true,
    steps,
    failedSteps: steps.filter((s) => !s.found),
  }
}

// =============================================================================
// Test setup
// =============================================================================

const testable = queries
  .map((q, i) => ({ ...q, index: i }))
  .filter((q) => !q.skipAutocomplete)

describe("Documentation SQL - Autocomplete Walkthrough", () => {
  describe("token-by-token autocomplete", () => {
    it.each(
      testable.map((q) => [
        `#${q.index}: ${q.query.substring(0, 60).replace(/\n/g, " ")}`,
        q,
      ]),
    )("%s", (_label, entry) => {
      const q = entry as DocsQuery & { index: number }

      // Extract schema from AST
      const parseResult = parseToAst(q.query)
      const extracted = extractSchemaFromAst(parseResult.ast)
      const schema = buildSchema(extracted)

      const result = autocompleteWalkthrough(q.query, schema)

      if (!result.success) {
        return
      }

      if (result.failedSteps.length > 0) {
        const failures = result.failedSteps
          .slice(0, 3)
          .map(
            (s) =>
              `  At offset ${s.position}: expected "${s.expectedLabel}" (from token "${s.tokenImage}" [${s.tokenType}]) ` +
              `not found in suggestions [${s.suggestions.join(", ")}${s.suggestions.length >= 15 ? "..." : ""}]`,
          )
          .join("\n")

        throw new Error(
          `Autocomplete walkthrough failed for #${q.index} (${result.failedSteps.length} failures):\n${failures}\n\nSQL: ${q.query.substring(0, 120)}`,
        )
      }
    })
  })
})
