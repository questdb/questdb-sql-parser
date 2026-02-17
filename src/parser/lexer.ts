import { createToken, Lexer, TokenType } from "chevrotain"

// Import all keyword tokens from tokens.ts (auto-generated from grammar arrays)
// Re-export all named tokens for parser usage
import {
  IdentifierKeyword,
  keywordTokenArray,
  Abort,
  Account,
  Accounts,
  Add,
  Alias,
  Align,
  All,
  Alter,
  And,
  Any,
  As,
  Asc,
  Asof,
  Assume,
  Attach,
  Atomic,
  Backup,
  Base,
  Batch,
  Between,
  Binary,
  Boolean,
  By,
  Bypass,
  Byte,
  Cache,
  Calendar,
  Cancel,
  Capacity,
  Cascade,
  Case,
  Cast,
  Char,
  Checkpoint,
  Column,
  Columns,
  Compile,
  Complete,
  CompressionCodec,
  CompressionLevel,
  CommitLag,
  Convert,
  Copy,
  Create,
  Cross,
  Cumulative,
  Current,
  Database,
  DataPageSize,
  Date,
  Day,
  Days,
  Decimal,
  Declare,
  Dedup,
  Default,
  Deferred,
  Delay,
  Delete,
  Delimiter,
  Desc,
  Detach,
  Details,
  Disable,
  Distinct,
  Double,
  Drop,
  Else,
  Enable,
  End,
  Error,
  Every,
  Except,
  Exclude,
  Exclusive,
  Exists,
  Exit,
  Explain,
  External,
  False,
  Fill,
  First,
  Float,
  Following,
  For,
  Foreign,
  Format,
  From,
  Full,
  Geohash,
  Grant,
  Group,
  Groups,
  Header,
  Hour,
  Hours,
  Http,
  If,
  Ignore,
  Ilike,
  Immediate,
  In,
  Include,
  Index,
  Inner,
  Insert,
  Incremental,
  Int,
  Integer,
  Intersect,
  Interval,
  Into,
  Ipv4,
  Is,
  Isolation,
  Jwk,
  Join,
  Key,
  Keys,
  Latest,
  Left,
  Length,
  Level,
  Like,
  Limit,
  Linear,
  List,
  Lock,
  Long,
  Long128,
  Long256,
  Lt,
  Manual,
  Materialized,
  MaxUncommittedRows,
  Microsecond,
  Microseconds,
  Millennium,
  Millisecond,
  Milliseconds,
  Minute,
  Minutes,
  Month,
  Months,
  NaN,
  Nanosecond,
  Nanoseconds,
  Natural,
  No,
  Nocache,
  None,
  Not,
  Null,
  Nulls,
  O3MaxLag,
  Observation,
  Offset,
  On,
  Only,
  Option,
  Or,
  Order,
  Others,
  Outer,
  Over,
  Overridable,
  Owned,
  Param,
  Parameters,
  Parquet,
  ParquetVersion,
  PartitionBy,
  Partition,
  Partitions,
  Password,
  Period,
  Permissions,
  Pivot,
  Prepare,
  Preceding,
  Prev,
  Prevailing,
  Primary,
  Public,
  Query,
  Range,
  References,
  Refresh,
  Release,
  Reindex,
  Remove,
  Rename,
  Repair,
  Replace,
  Rest,
  Respect,
  Resume,
  Revoke,
  Right,
  Row,
  RowGroupSize,
  Rows,
  Sample,
  Second,
  Seconds,
  Select,
  ServerVersion,
  Service,
  Set,
  Short,
  Show,
  Skip,
  SkipColumn,
  SkipRow,
  Snapshot,
  Splice,
  Squash,
  Start,
  StatisticsEnabled,
  String,
  Suspend,
  Symbol,
  System,
  Table,
  Tables,
  Then,
  Time,
  Timestamp,
  TimestampNs,
  To,
  Token,
  Tolerance,
  Transaction,
  Transient,
  True,
  Truncate,
  Ttl,
  Txn,
  Type,
  Unbounded,
  Union,
  Unlock,
  Unpivot,
  Update,
  Upsert,
  User,
  Users,
  Uuid,
  Vacuum,
  Values,
  Varchar,
  Verification,
  View,
  Volume,
  Wal,
  Week,
  Weeks,
  When,
  Where,
  Window,
  With,
  Within,
  Writer,
  Year,
  Years,
  Zone,
  RawArrayEncoding,
  Uncompressed,
  Snappy,
  Gzip,
  Lz4,
  Zstd,
  Lz4Raw,
  Brotli,
  Lzo,
} from "./tokens"

// Re-export all keyword tokens for parser and external use
export { IdentifierKeyword }
export {
  Abort,
  Account,
  Accounts,
  Add,
  Alias,
  Align,
  All,
  Alter,
  And,
  Any,
  As,
  Asc,
  Asof,
  Assume,
  Attach,
  Atomic,
  Backup,
  Base,
  Batch,
  Between,
  Binary,
  Boolean,
  By,
  Bypass,
  Byte,
  Cache,
  Calendar,
  Cancel,
  Capacity,
  Cascade,
  Case,
  Cast,
  Char,
  Checkpoint,
  Column,
  Columns,
  Compile,
  Complete,
  CompressionCodec,
  CompressionLevel,
  CommitLag,
  Convert,
  Copy,
  Create,
  Cross,
  Cumulative,
  Current,
  Database,
  DataPageSize,
  Date,
  Day,
  Days,
  Decimal,
  Declare,
  Dedup,
  Default,
  Deferred,
  Delay,
  Delete,
  Delimiter,
  Desc,
  Detach,
  Details,
  Disable,
  Distinct,
  Double,
  Drop,
  Else,
  Enable,
  End,
  Error,
  Every,
  Except,
  Exclude,
  Exclusive,
  Exists,
  Exit,
  Explain,
  External,
  False,
  Fill,
  First,
  Float,
  Following,
  For,
  Foreign,
  Format,
  From,
  Full,
  Geohash,
  Grant,
  Group,
  Groups,
  Header,
  Hour,
  Hours,
  Http,
  If,
  Ignore,
  Ilike,
  Immediate,
  In,
  Include,
  Index,
  Inner,
  Insert,
  Incremental,
  Int,
  Integer,
  Intersect,
  Interval,
  Into,
  Ipv4,
  Is,
  Isolation,
  Jwk,
  Join,
  Key,
  Keys,
  Latest,
  Left,
  Length,
  Level,
  Like,
  Limit,
  Linear,
  List,
  Lock,
  Long,
  Long128,
  Long256,
  Lt,
  Manual,
  Materialized,
  MaxUncommittedRows,
  Microsecond,
  Microseconds,
  Millennium,
  Millisecond,
  Milliseconds,
  Minute,
  Minutes,
  Month,
  Months,
  NaN,
  Nanosecond,
  Nanoseconds,
  Natural,
  No,
  Nocache,
  None,
  Not,
  Null,
  Nulls,
  O3MaxLag,
  Observation,
  Offset,
  On,
  Only,
  Option,
  Or,
  Order,
  Others,
  Outer,
  Over,
  Overridable,
  Owned,
  Param,
  Parameters,
  Parquet,
  ParquetVersion,
  PartitionBy,
  Partition,
  Partitions,
  Password,
  Period,
  Permissions,
  Pivot,
  Prepare,
  Preceding,
  Prev,
  Prevailing,
  Primary,
  Public,
  Query,
  Range,
  References,
  Refresh,
  Release,
  Reindex,
  Remove,
  Rename,
  Repair,
  Replace,
  Rest,
  Respect,
  Resume,
  Revoke,
  Right,
  Row,
  RowGroupSize,
  Rows,
  Sample,
  Second,
  Seconds,
  Select,
  ServerVersion,
  Service,
  Set,
  Short,
  Show,
  Skip,
  SkipColumn,
  SkipRow,
  Snapshot,
  Splice,
  Squash,
  Start,
  StatisticsEnabled,
  String,
  Suspend,
  Symbol,
  System,
  Table,
  Tables,
  Then,
  Time,
  Timestamp,
  TimestampNs,
  To,
  Token,
  Tolerance,
  Transaction,
  Transient,
  True,
  Truncate,
  Ttl,
  Txn,
  Type,
  Unbounded,
  Union,
  Unlock,
  Unpivot,
  Update,
  Upsert,
  User,
  Users,
  Uuid,
  Vacuum,
  Values,
  Varchar,
  Verification,
  View,
  Volume,
  Wal,
  Week,
  Weeks,
  When,
  Where,
  Window,
  With,
  Within,
  Writer,
  Year,
  Years,
  Zone,
  RawArrayEncoding,
  Uncompressed,
  Snappy,
  Gzip,
  Lz4,
  Zstd,
  Lz4Raw,
  Brotli,
  Lzo,
}

// =============================================================================
// Operators & Symbols
// =============================================================================

export const Star = createToken({ name: "Star", pattern: /\*/ })
export const Comma = createToken({ name: "Comma", pattern: /,/ })
export const Semicolon = createToken({ name: "Semicolon", pattern: /;/ })
export const Dot = createToken({ name: "Dot", pattern: /\./ })
export const LParen = createToken({ name: "LParen", pattern: /\(/ })
export const RParen = createToken({ name: "RParen", pattern: /\)/ })
export const LBracket = createToken({ name: "LBracket", pattern: /\[/ })
export const RBracket = createToken({ name: "RBracket", pattern: /\]/ })
export const Colon = createToken({ name: "Colon", pattern: /:/ })
export const ColonEquals = createToken({ name: "ColonEquals", pattern: /:=/ })

// Comparison Operators (order matters - longer first)
export const NotEquals = createToken({ name: "NotEquals", pattern: /!=|<>/ })
export const LessThanOrEqual = createToken({
  name: "LessThanOrEqual",
  pattern: /<=/,
})
export const GreaterThanOrEqual = createToken({
  name: "GreaterThanOrEqual",
  pattern: />=/,
})
export const LessThan = createToken({ name: "LessThan", pattern: /</ })
export const GreaterThan = createToken({ name: "GreaterThan", pattern: />/ })
export const Equals = createToken({ name: "Equals", pattern: /=/ })

// Arithmetic Operators
export const Plus = createToken({ name: "Plus", pattern: /\+/ })
export const Minus = createToken({ name: "Minus", pattern: /-/ })
export const Divide = createToken({ name: "Divide", pattern: /\// })
export const Modulo = createToken({ name: "Modulo", pattern: /%/ })

// String Operators
export const Concat = createToken({ name: "Concat", pattern: /\|\|/ })

// Bitwise Operators
export const BitAnd = createToken({ name: "BitAnd", pattern: /&/ })
export const BitXor = createToken({ name: "BitXor", pattern: /\^/ })
export const BitOr = createToken({
  name: "BitOr",
  pattern: /\|/,
  longer_alt: Concat,
})

// Regex Operators
export const RegexMatch = createToken({ name: "RegexMatch", pattern: /~/ })
export const RegexNotMatch = createToken({
  name: "RegexNotMatch",
  pattern: /!~/,
})
export const RegexNotEquals = createToken({
  name: "RegexNotEquals",
  pattern: /~=/,
})

// Cast Operator
export const DoubleColon = createToken({ name: "DoubleColon", pattern: /::/ })

// Variable reference: @variableName — captured as a single token so that
// keywords after @ (e.g., @select, @window, @limit) are never tokenized
// as keyword tokens. DECLARE lets you use ANY word as a variable name.
export const VariableReference = createToken({
  name: "VariableReference",
  pattern: /@[a-zA-Z_\u0080-\uFFFF][a-zA-Z0-9_\u0080-\uFFFF]*/,
})

// Bare @ sign (only matches when not followed by a word character)
export const AtSign = createToken({ name: "AtSign", pattern: /@/ })

// =============================================================================
// Literals
// =============================================================================

// Geohash literals: ##binary or #alphanumeric
export const GeohashBinaryLiteral = createToken({
  name: "GeohashBinaryLiteral",
  pattern: /##[01]+/,
})
export const GeohashLiteral = createToken({
  name: "GeohashLiteral",
  pattern: /#[a-z0-9/]+/i,
})

// Long literal suffix: 100000L (must be before DurationLiteral and NumberLiteral)
export const LongLiteral = createToken({
  name: "LongLiteral",
  pattern: /\d[\d_]*[Ll]\b/,
})

// QuestDB DECIMAL literal with m suffix: 10.5m, 99.99m (fractional only)
// Integer + m (like 5m) is DurationLiteral (minutes), so we only match when there's a decimal point
export const DecimalLiteral = createToken({
  name: "DecimalLiteral",
  pattern: /\d[\d_]*\.\d[\d_]*m\b/,
})

// QuestDB time units for SAMPLE BY (e.g., 1h, 5m, 30s, 1d, 1M, 1y, 100T, 1U, 1.5d)
// Units: n=nanos, u/U=micros, T=millis, ms=millis, s=seconds, m=minutes, h/H=hours, d=days, w=weeks, M=months, y=years
// Supports decimal values like 1.5d, 0.5h
// Multi-char units (ms, us) must appear before single-char alternatives to avoid prefix match
export const DurationLiteral = createToken({
  name: "DurationLiteral",
  pattern: /\d[\d_]*(\.\d[\d_]*)?(ms|us|[smhdMyNnTUuHw])/,
})

// Numbers (negation is handled as unary minus in the parser, not in the lexer)
// Must start with a digit or dot-digit to avoid matching identifiers starting with _
export const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /(\d[\d_]*\.?[\d_]*|\.\d[\d_]*)([eE][+-]?\d[\d_]*)?/,
})

// Strings
export const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /'([^'\\]|\\.|'')*'/,
})

// Quoted Identifiers
export const QuotedIdentifier = createToken({
  name: "QuotedIdentifier",
  pattern: /"([^"\\]|\\.|"")*"/,
})

// Identifiers (must come after keywords)
// Uses Unicode ranges to support non-ASCII identifiers (e.g., café, 日本語)
// \u0080-\uFFFF covers all non-ASCII characters; Chevrotain's regex analyzer
// cannot handle \p{L} Unicode property escapes, so we use explicit ranges.
export const Identifier = createToken({
  name: "Identifier",
  pattern: /[a-zA-Z_\u0080-\uFFFF][a-zA-Z0-9_\u0080-\uFFFF]*/,
})

// =============================================================================
// Whitespace & Comments
// =============================================================================

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
})

export const LineComment = createToken({
  name: "LineComment",
  pattern: /--[^\n\r]*/,
  group: Lexer.SKIPPED,
})

export const BlockComment = createToken({
  name: "BlockComment",
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED,
})

// =============================================================================
// Token List (ORDER MATTERS - longer patterns first)
// =============================================================================

export const allTokens: TokenType[] = [
  // Whitespace & Comments (skipped)
  WhiteSpace,
  LineComment,
  BlockComment,

  // Multi-char operators (before single-char)
  DoubleColon,
  ColonEquals,
  NotEquals,
  LessThanOrEqual,
  GreaterThanOrEqual,
  Concat,
  RegexNotMatch,
  RegexNotEquals,

  // Token category for non-reserved keywords (used as identifiers)
  IdentifierKeyword,

  // All keyword tokens (auto-generated from grammar arrays)
  // Keywords use word boundaries so order doesn't matter among them
  ...keywordTokenArray,

  // Single-char operators
  LessThan,
  GreaterThan,
  Equals,
  Plus,
  Minus,
  Star,
  Divide,
  Modulo,
  BitAnd,
  BitXor,
  BitOr,
  RegexMatch,
  Colon,
  VariableReference,
  AtSign,

  // Symbols
  Comma,
  Semicolon,
  Dot,
  LParen,
  RParen,
  LBracket,
  RBracket,

  // Literals (order matters - longer/more specific patterns first)
  GeohashBinaryLiteral,
  GeohashLiteral,
  LongLiteral,
  DecimalLiteral,
  DurationLiteral,
  NumberLiteral,
  StringLiteral,
  QuotedIdentifier,
  Identifier,
]

// =============================================================================
// Lexer Instance
// =============================================================================

export const QuestDBLexer = new Lexer(allTokens)

export function tokenize(input: string) {
  const result = QuestDBLexer.tokenize(input)
  return result
}
