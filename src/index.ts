import { parse as parseRaw } from "./parser/parser"
import { visitor } from "./parser/visitor"
import type { Statement } from "./parser/ast"

export interface ParseResult {
  ast: Statement[]
  errors: Array<{ message: string; line?: number; column?: number }>
}

export * from "./parser/ast"
export type {
  ContentAssistResult,
  TableRef,
} from "./autocomplete/content-assist"
export type {
  AutocompleteProvider,
  Suggestion,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
} from "./autocomplete/index"
export { QuestDBLexer, tokenize, allTokens } from "./parser/lexer"
export { parser, parse } from "./parser/parser"
export { visitor } from "./parser/visitor"
export { toSql } from "./parser/toSql"
export {
  Select,
  From,
  Where,
  Insert,
  Update,
  Delete,
  Create,
  Drop,
  Alter,
  Table,
  Sample,
  By,
  Latest,
  On,
  Partition,
} from "./parser/lexer"
export {
  getContentAssist,
  getNextValidTokens,
  isTokenExpected,
} from "./autocomplete/content-assist"
export { createAutocompleteProvider } from "./autocomplete/index"
export { SuggestionKind, SuggestionPriority } from "./autocomplete/index"
export {
  IDENTIFIER_TOKENS,
  IDENTIFIER_KEYWORD_TOKENS,
  SKIP_TOKENS,
  tokenNameToKeyword,
  buildSuggestions,
} from "./autocomplete/index"
export {
  keywords,
  dataTypes,
  constants,
  functions,
  operators,
} from "./grammar/index"

/**
 * Parse SQL string to AST
 */
export function parseToAst(sql: string): ParseResult {
  const { cst, lexErrors, parseErrors } = parseRaw(sql)

  const errors: ParseResult["errors"] = []

  for (const err of lexErrors) {
    errors.push({
      message: err.message,
      line: err.line,
      column: err.column,
    })
  }

  for (const err of parseErrors) {
    errors.push({
      message: err.message,
      line: err.token?.startLine,
      column: err.token?.startColumn,
    })
  }

  let ast: Statement[] = []
  try {
    ast = visitor.visit(cst) as Statement[]
  } catch {
    // The visitor throws on incomplete CST nodes produced by error recovery
    // (e.g. "Unknown primary expression", null dereferences on missing children).
    // Rather than making every visitor method resilient to partial CSTs, we catch
    // here and return whatever AST was successfully built, along with the parse
    // errors that already describe what went wrong.
  }

  return { ast, errors }
}

/**
 * Parse multiple SQL statements (no semicolons needed)
 */
export function parseStatements(sql: string): Statement[] {
  const result = parseToAst(sql)

  if (result.errors.length > 0) {
    const firstError = result.errors[0]
    throw new Error(
      `Parse error at line ${firstError.line}, column ${firstError.column}: ${firstError.message}`,
    )
  }

  return result.ast
}

/**
 * Parse single SQL statement and return AST
 */
export function parseOne(sql: string): Statement {
  const statements = parseStatements(sql)

  if (statements.length === 0) {
    throw new Error("No statement found")
  }

  if (statements.length > 1) {
    throw new Error(`Expected 1 statement, found ${statements.length}`)
  }

  return statements[0]
}
