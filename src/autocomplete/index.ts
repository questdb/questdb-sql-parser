// =============================================================================
// Autocomplete Module Exports
// =============================================================================
// This module provides a complete autocomplete solution for SQL editors.
// The UI should import from this module and NOT duplicate any logic.
// =============================================================================

// Main factory function
export { createAutocompleteProvider } from "./provider"

// Types for UI integration
export type {
  AutocompleteProvider,
  Suggestion,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
} from "./types"

export { SuggestionKind, SuggestionPriority } from "./types"

// Token classification (for advanced use cases)
export {
  IDENTIFIER_TOKENS,
  IDENTIFIER_KEYWORD_TOKENS,
  SKIP_TOKENS,
  tokenNameToKeyword,
  isIdentifierToken,
  shouldSkipToken,
} from "./token-classification"

// Suggestion building (for advanced use cases)
export { buildSuggestions } from "./suggestion-builder"
