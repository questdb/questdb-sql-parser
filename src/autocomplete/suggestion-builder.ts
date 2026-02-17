// =============================================================================
// Suggestion Builder
// =============================================================================
// Converts parser token types to autocomplete suggestions.
// This is the SINGLE SOURCE OF TRUTH for suggestion building - the UI should
// NOT duplicate this logic.
// =============================================================================

import { TokenType } from "chevrotain"
import {
  Suggestion,
  SuggestionKind,
  SuggestionPriority,
  SchemaInfo,
  ColumnInfo,
} from "./types"
import {
  SKIP_TOKENS,
  PUNCTUATION_TOKENS,
  EXPRESSION_OPERATORS,
  tokenNameToKeyword,
} from "./token-classification"
import { functions } from "../grammar/index"
import type { TableRef } from "./content-assist"

/**
 * Column with table context for detailed suggestions
 */
interface ColumnWithTable extends ColumnInfo {
  tableName: string
}

/**
 * Get columns from tables in scope
 */
function getColumnsInScope(
  tablesInScope: TableRef[],
  schema: SchemaInfo,
): ColumnWithTable[] {
  const columns: ColumnWithTable[] = []

  for (const tableRef of tablesInScope) {
    // Look up columns by table name (case-insensitive)
    const tableNameLower = tableRef.table.toLowerCase()
    const tableColumns = schema.columns[tableNameLower] ?? []

    for (const col of tableColumns) {
      columns.push({
        ...col,
        tableName: tableRef.table,
      })
    }
  }

  return columns
}

/**
 * Get all columns from schema (when no tables in scope)
 */
function getAllColumns(schema: SchemaInfo): ColumnWithTable[] {
  const columns: ColumnWithTable[] = []

  for (const [tableName, tableColumns] of Object.entries(schema.columns)) {
    for (const col of tableColumns) {
      columns.push({
        ...col,
        tableName,
      })
    }
  }

  return columns
}

/**
 * Build suggestions from parser's nextTokenTypes
 *
 * @param tokenTypes - Valid next tokens from parser.computeContentAssist()
 * @param schema - Schema information (tables, columns)
 * @param tablesInScope - Tables found in the query
 * @returns Array of suggestions
 */
export function buildSuggestions(
  tokenTypes: TokenType[],
  schema: SchemaInfo,
  tablesInScope: TableRef[],
  options?: {
    includeColumns?: boolean
    includeTables?: boolean
    isMidWord?: boolean
  },
): Suggestion[] {
  const suggestions: Suggestion[] = []
  const seenKeywords = new Set<string>()
  let expectsIdentifier = false
  const includeColumns = options?.includeColumns ?? true
  const includeTables = options?.includeTables ?? true
  const isMidWord = options?.isMidWord ?? false

  // Process each token type from the parser
  for (const tokenType of tokenTypes) {
    const name = tokenType.name

    // Skip internal tokens (operators, literals, punctuation)
    if (SKIP_TOKENS.has(name)) {
      continue
    }

    // IdentifierKeyword means the parser's `identifier` rule is active,
    // so column/table names are expected. Bare Identifier/QuotedIdentifier
    // alone (e.g., for custom type names) should not trigger schema suggestions.
    if (name === "IdentifierKeyword") {
      expectsIdentifier = true
      continue
    }
    if (name === "Identifier" || name === "QuotedIdentifier") {
      continue
    }

    // Convert token name to keyword display string
    const keyword = tokenNameToKeyword(name)

    // Skip duplicates
    if (seenKeywords.has(keyword)) {
      continue
    }
    seenKeywords.add(keyword)

    // All parser keyword tokens are keywords (not functions).
    // Functions are suggested separately in the functions loop below.
    const kind = SuggestionKind.Keyword
    const priority = EXPRESSION_OPERATORS.has(name)
      ? SuggestionPriority.MediumLow
      : SuggestionPriority.Medium

    suggestions.push({
      label: keyword,
      kind,
      insertText: keyword,
      filterText: keyword.toLowerCase(),
      priority,
    })
  }

  // If identifier is expected, add columns and tables
  if (expectsIdentifier) {
    // Get columns: prefer tables in scope (FROM, JOIN), fall back to all columns.
    // Also fall back when tables are in scope but none have known columns
    // (e.g., FROM read_parquet(...) — function call, not a schema table).
    const scopedColumns =
      tablesInScope.length > 0 ? getColumnsInScope(tablesInScope, schema) : []
    const columnsInScope = includeColumns
      ? scopedColumns.length > 0
        ? scopedColumns
        : getAllColumns(schema)
      : []

    // Add columns with HIGH priority (they should appear first).
    // Deduplicate by column name, collecting all table names per column.
    if (includeColumns) {
      const columnMap = new Map<string, { type: string; tables: string[] }>()
      for (const col of columnsInScope) {
        const existing = columnMap.get(col.name)
        if (existing) {
          if (!existing.tables.includes(col.tableName)) {
            existing.tables.push(col.tableName)
          }
        } else {
          columnMap.set(col.name, { type: col.type, tables: [col.tableName] })
        }
      }
      for (const [colName, info] of columnMap) {
        suggestions.unshift({
          label: colName,
          kind: SuggestionKind.Column,
          insertText: colName,
          detail: ` (${info.tables.sort().join(", ")})`,
          description: info.tables.length > 1 ? "" : info.type,
          priority: SuggestionPriority.High,
        })
      }
    }

    // Add functions when the user is mid-word (typing a prefix).
    // This avoids flooding the list with ~300 functions when the user
    // just typed "SELECT " with no prefix. Functions are valid in both
    // expression context (SELECT md5(...)) and table context (FROM long_sequence(...)).
    if (isMidWord) {
      for (const fn of functions) {
        if (seenKeywords.has(fn.toUpperCase())) continue
        suggestions.push({
          label: fn,
          kind: SuggestionKind.Function,
          insertText: fn,
          priority: SuggestionPriority.Low,
        })
      }
    }

    // Add tables with MEDIUM-LOW priority (lower than columns).
    if (includeTables) {
      for (const table of schema.tables) {
        suggestions.push({
          label: table.name,
          kind: SuggestionKind.Table,
          insertText: table.name,
          priority: SuggestionPriority.MediumLow,
        })
      }
    }
  }

  // Fallback: when no keyword/identifier suggestions were produced, check if the
  // parser expected punctuation tokens (e.g., "(" after "VALUES (1), ").
  // Suggest those so Monaco doesn't fall back to junk word-based completions.
  if (suggestions.length === 0 && !expectsIdentifier) {
    for (const tokenType of tokenTypes) {
      const name = tokenType.name
      if (!PUNCTUATION_TOKENS.has(name)) continue
      const display = tokenNameToKeyword(name)
      suggestions.push({
        label: display,
        kind: SuggestionKind.Keyword,
        insertText: display,
        filterText: display.toLowerCase(),
        priority: SuggestionPriority.Low,
      })
    }
  }

  return suggestions
}
