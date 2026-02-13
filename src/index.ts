// Core exports
export { QuestDBLexer, tokenize, allTokens } from "./parser/lexer";
export { parser, parse } from "./parser/parser";
export { visitor } from "./parser/visitor";
export { toSql } from "./parser/toSql";

// AST types
export * from "./parser/ast";

// High-level API
import { parse as parseRaw } from "./parser/parser";
import { visitor } from "./parser/visitor";
import type { Statement } from "./parser/ast";

export interface ParseResult {
  ast: Statement[];
  errors: Array<{ message: string; line?: number; column?: number }>;
}

/**
 * Parse SQL string to AST
 */
export function parseToAst(sql: string): ParseResult {
  const { cst, lexErrors, parseErrors } = parseRaw(sql);

  const errors: ParseResult["errors"] = [];

  for (const err of lexErrors) {
    errors.push({
      message: err.message,
      line: err.line,
      column: err.column,
    });
  }

  for (const err of parseErrors) {
    errors.push({
      message: err.message,
      line: err.token?.startLine,
      column: err.token?.startColumn,
    });
  }

  if (errors.length > 0) {
    return { ast: [], errors };
  }

  const ast = visitor.visit(cst) as Statement[];

  return { ast, errors: [] };
}

/**
 * Parse multiple SQL statements (no semicolons needed)
 */
export function parseStatements(sql: string): Statement[] {
  const result = parseToAst(sql);

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new Error(
      `Parse error at line ${firstError.line}, column ${firstError.column}: ${firstError.message}`
    );
  }

  return result.ast;
}

/**
 * Parse single SQL statement and return AST
 */
export function parseOne(sql: string): Statement {
  const statements = parseStatements(sql);

  if (statements.length === 0) {
    throw new Error("No statement found");
  }

  if (statements.length > 1) {
    throw new Error(`Expected 1 statement, found ${statements.length}`);
  }

  return statements[0];
}

// Content Assist API for Monaco Editor autocomplete
export {
  getContentAssist,
  getNextValidTokens,
  isTokenExpected,
} from "./autocomplete/content-assist";
export type {
  ContentAssistResult,
  TableRef,
} from "./autocomplete/content-assist";

// Autocomplete Provider API (zero-duplication architecture)
// This is the recommended way to integrate autocomplete in the UI
export { createAutocompleteProvider } from "./autocomplete/index";
export type {
  AutocompleteProvider,
  Suggestion,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
} from "./autocomplete/index";
export { SuggestionKind, SuggestionPriority } from "./autocomplete/index";

// Advanced autocomplete utilities (for custom implementations)
export {
  IDENTIFIER_TOKENS,
  IDENTIFIER_KEYWORD_TOKENS,
  SKIP_TOKENS,
  tokenNameToKeyword,
  buildSuggestions,
  buildFallbackSuggestions,
} from "./autocomplete/index";

// Grammar arrays for Monaco Editor integration (syntax highlighting & completion)
// These replace @questdb/sql-grammar exports
export { keywords, dataTypes, constants, functions, operators } from "./grammar/index";

// Re-export commonly used tokens for convenience
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
} from "./parser/lexer";
