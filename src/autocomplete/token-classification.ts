// =============================================================================
// Token Classification for Autocomplete
// =============================================================================
// These sets define how tokens are classified for autocomplete suggestions.
//
// This is the SINGLE SOURCE OF TRUTH for autocomplete - the UI should NOT
// duplicate these definitions.
// =============================================================================

import { IDENTIFIER_KEYWORD_NAMES } from "../parser/tokens"

/**
 * Token types that represent actual identifiers
 */
export const IDENTIFIER_TOKENS = new Set([
  "Identifier",
  "QuotedIdentifier",
  "IdentifierKeyword",
])

/**
 * Keywords that can be used as identifiers in the grammar.
 *
 * These are tokens that appear as alternatives in the parser's `identifier` rule.
 * When these appear in nextTokenTypes, it means an identifier/column is expected,
 * so we should suggest columns and tables, not these keywords.
 *
 * Derived from IDENTIFIER_KEYWORD_NAMES in tokens.ts — single source of truth.
 */
export const IDENTIFIER_KEYWORD_TOKENS = IDENTIFIER_KEYWORD_NAMES

/**
 * Keywords that should always be suggested even when identifiers are allowed.
 * These are context-sensitive keywords that appear in expression positions.
 */
export const ALWAYS_SUGGEST_KEYWORDS = new Set(["Current"])

/**
 * Expression-continuation operators that are valid after any expression but
 * should be deprioritized so clause-level keywords (ASC, DESC, LIMIT, etc.)
 * appear first in the suggestion list.
 */
export const EXPRESSION_OPERATORS = new Set([
  "And",
  "Or",
  "Not",
  "Between",
  "In",
  "Is",
  "Like",
  "Ilike",
  "Within",
  // Query connectors — valid after any complete query but should not
  // overshadow clause-level keywords the user is more likely typing.
  "Union",
  "Except",
  "Intersect",
])

/**
 * Punctuation tokens — worth suggesting in fallback (e.g., "(" after "VALUES (1), ")
 */
export const PUNCTUATION_TOKENS = new Set([
  "LParen",
  "RParen",
  "Comma",
  "Semicolon",
  "LBracket",
  "RBracket",
])

/**
 * Token types that should NOT be suggested (internal/structural tokens)
 */
export const SKIP_TOKENS = new Set([
  // Punctuation
  "LParen",
  "RParen",
  "Comma",
  "Dot",
  "Semicolon",
  "AtSign",
  "ColonEquals",
  "LBracket",
  "RBracket",
  // Comparison operators (suggest columns/values, not operators)
  "Equals",
  "NotEquals",
  "LessThan",
  "LessThanOrEqual",
  "GreaterThan",
  "GreaterThanOrEqual",
  // Arithmetic operators
  "Plus",
  "Minus",
  "Star", // Note: Star is also SELECT * - handled specially
  "Divide",
  "Modulo",
  "Concat",
  "DoubleColon",
  "RegexMatch",
  "RegexNotMatch",
  "RegexNotEquals",
  // Bitwise operators
  "BitAnd",
  "BitXor",
  "BitOr",
  // Variable references (user-defined, can't suggest)
  "VariableReference",
  // Literals (don't suggest literal tokens)
  "StringLiteral",
  "NumberLiteral",
  "LongLiteral",
  "DecimalLiteral",
  "DurationLiteral",
  "GeohashLiteral",
  "GeohashBinaryLiteral",
  "Nan",
  // Whitespace
  "WhiteSpace",
])

/**
 * Operator map for converting token names to display strings
 */
export const OPERATOR_MAP: Record<string, string> = {
  Star: "*",
  Plus: "+",
  Minus: "-",
  Divide: "/",
  Modulo: "%",
  Equals: "=",
  NotEquals: "!=",
  LessThan: "<",
  LessThanOrEqual: "<=",
  GreaterThan: ">",
  GreaterThanOrEqual: ">=",
  LParen: "(",
  RParen: ")",
  Comma: ",",
  Semicolon: ";",
}

/**
 * Convert a token type name to a keyword string for display
 * e.g., "Table" → "TABLE", "PartitionBy" → "PARTITION BY"
 */
export function tokenNameToKeyword(name: string): string {
  // Check if it's an operator
  if (OPERATOR_MAP[name]) {
    return OPERATOR_MAP[name]
  }

  // Convert PascalCase to UPPERCASE with spaces
  // e.g., "PartitionBy" → "PARTITION BY", "LatestOn" → "LATEST ON"
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase()
}

/**
 * Check if a token represents an identifier context
 */
export function isIdentifierToken(tokenName: string): boolean {
  return (
    IDENTIFIER_TOKENS.has(tokenName) || IDENTIFIER_KEYWORD_TOKENS.has(tokenName)
  )
}

/**
 * Check if a token should be skipped in suggestions
 */
export function shouldSkipToken(tokenName: string): boolean {
  return SKIP_TOKENS.has(tokenName)
}
