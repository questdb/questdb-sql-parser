import { createToken, Lexer, TokenType } from "chevrotain"
import { keywords } from "../grammar/keywords"
import { dataTypes } from "../grammar/dataTypes"
import { constants } from "../grammar/constants"

// =============================================================================
// Token Category for Non-Reserved Keywords Used as Identifiers
// =============================================================================
// Chevrotain token categories let us match many keyword tokens with a single
// CONSUME(IdentifierKeyword) in the parser, avoiding a 160+ alternative OR
// that makes performSelfAnalysis() take ~35 seconds.

export const IdentifierKeyword = createToken({
  name: "IdentifierKeyword",
  pattern: Lexer.NA,
})

// =============================================================================
// Token Generation Utilities
// =============================================================================

/**
 * Convert a keyword to PascalCase token name
 * Examples:
 *   "select" → "Select"
 *   "o3MaxLag" → "O3MaxLag"
 *   "long256" → "Long256"
 *   "data_page_size" → "DataPageSize"
 *   "timestamp_ns" → "TimestampNs"
 */
function toPascalCase(str: string): string {
  // Handle underscores: split, capitalize each part, join
  if (str.includes("_")) {
    return str
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("")
  }
  // Simple case: just capitalize first letter
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Create a keyword token with case-insensitive word boundary matching
 */
function createKeywordToken(name: string, pattern: string): TokenType {
  return createToken({
    name,
    pattern: new RegExp(`${pattern}\\b`, "i"),
  })
}

/**
 * Generate tokens from a list of keywords
 * Returns a Map of tokenName → TokenType
 */
function generateTokensFromList(
  list: readonly string[],
): Map<string, TokenType> {
  const tokenMap = new Map<string, TokenType>()

  for (const item of list) {
    const name = toPascalCase(item)
    // Skip if already exists (handles duplicates across lists)
    if (!tokenMap.has(name)) {
      tokenMap.set(name, createKeywordToken(name, item))
    }
  }

  return tokenMap
}

// =============================================================================
// Auto-generated Tokens from Grammar Arrays
// =============================================================================

// Generate tokens from each grammar category
const keywordTokenMap = generateTokensFromList(keywords)
const dataTypeTokenMap = generateTokensFromList(dataTypes)
const constantTokenMap = generateTokensFromList(constants)

// Merge all into a single map (keywords first, then dataTypes, then constants)
// Later entries don't override earlier ones (duplicates handled by generateTokensFromList)
const allGeneratedTokens = new Map<string, TokenType>([
  ...keywordTokenMap,
  ...dataTypeTokenMap,
  ...constantTokenMap,
])

// =============================================================================
// Assign IdentifierKeyword category to non-reserved keyword tokens
// =============================================================================
// These tokens can be used as unquoted identifiers (table names, column names,
// aliases, CTE names, etc.). This matches QuestDB's Java parser behavior where
// only ~61 keywords are reserved and everything else is non-reserved.
//
// Reserved keywords NOT included (would cause parsing ambiguity):
//   Structural:  Select, From, Where, As, By, With, If, Exists, Into,
//                Values, Set, For, Table, To, Declare, Rename
//   Joins:       Join, Inner, Left, Right, Full, Outer, Cross, Natural,
//                Asof, Lt, Splice, On
//   Operators:   And, Or, Not, In, Between, Like, Ilike, Is
//   Expressions: Case, When, Then, Else, End, Cast, True, False, Null, NaN,
//                All, Any, Distinct, Over
//   Clauses:     Group, Order, Asc, Desc, Limit, Sample, Latest, Window,
//                Union, Intersect, Except, Pivot, Unpivot, Lock, Truncate

export const IDENTIFIER_KEYWORD_NAMES = new globalThis.Set([
  // Data type keywords
  "Symbol",
  "Timestamp",
  "Date",
  "Time",
  "Int",
  "Integer",
  "Long",
  "Long128",
  "Long256",
  "Short",
  "Byte",
  "Float",
  "Double",
  "Boolean",
  "String",
  "Char",
  "Binary",
  "Uuid",
  "Ipv4",
  "Geohash",
  "Varchar",
  "Decimal",
  "Interval",
  "TimestampNs",
  // Common identifier-like keywords
  "Index",
  "Key",
  "Column",
  "Type",
  "Level",
  "Offset",
  "First",
  "Volume",
  "Start",
  "Current",
  "User",
  "Users",
  "Public",
  "Default",
  "View",
  // Time units (from grammar/constants.ts)
  "Hour",
  "Day",
  "Week",
  "Month",
  "Year",
  "Days",
  "Hours",
  "Months",
  "Weeks",
  "Years",
  "Minute",
  "Minutes",
  "Second",
  "Seconds",
  "Millisecond",
  "Milliseconds",
  "Microsecond",
  "Microseconds",
  "Nanosecond",
  "Nanoseconds",
  "Century",
  "Decade",
  "Millennium",
  "Quarter",
  "Dow",
  "Doy",
  "Epoch",
  "Isodow",
  "Isoyear",
  // Function name keywords
  "Replace",
  "Tables",
  "Format",
  "Header",
  "Query",
  "Enable",
  "Disable",
  "None",
  "Error",
  "System",
  "Http",
  // Entity/config keywords
  "Account",
  "Accounts",
  "Service",
  "Token",
  "Rest",
  "Password",
  "Partition",
  "Partitions",
  "PartitionBy",
  "Dedup",
  "Wal",
  "Bypass",
  "Batch",
  "No",
  "Groups",
  "Assume",
  "Database",
  "Backup",
  "Foreign",
  "Primary",
  "References",
  "Cascade",
  "Capacity",
  "Cancel",
  "Prevailing",
  "Writer",
  "Materialized",
  "Range",
  "Snapshot",
  "Unlock",
  "Refresh",
  // ALTER TABLE sub-operations
  "Add",
  "Attach",
  "Detach",
  "Convert",
  "Remove",
  "Squash",
  "Suspend",
  "Resume",
  "Release",
  // COPY/export parameters
  "Parquet",
  "ParquetVersion",
  "Abort",
  "Alias",
  "Base",
  "Complete",
  "CompressionCodec",
  "CompressionLevel",
  "DataPageSize",
  "Delimiter",
  "Exit",
  "Ignore",
  "Option",
  "Param",
  "Prepare",
  "RowGroupSize",
  "SkipRow",
  "SkipColumn",
  "Verification",
  // CREATE TABLE / DDL config
  "Atomic",
  "CommitLag",
  "Delay",
  "External",
  "Incremental",
  "MaxUncommittedRows",
  "O3MaxLag",
  "Ttl",
  "Deferred",
  // SHOW sub-keywords
  "Columns",
  "Keys",
  "List",
  "Parameters",
  "Permissions",
  "ServerVersion",
  "StatisticsEnabled",
  "Txn",
  "Within",
  // Config/metadata
  "Calendar",
  "Checkpoint",
  "Cumulative",
  "Isolation",
  "Jwk",
  "Length",
  "Manual",
  "Nocache",
  "Observation",
  "Overridable",
  "Owned",
  "Period",
  "Reindex",
  "Tolerance",
  "Transaction",
  "Zone",
  // Compression codecs
  "RawArrayEncoding",
  "Uncompressed",
  "Snappy",
  "Gzip",
  "Lz4",
  "Zstd",
  "Lz4Raw",
  "Brotli",
  "Lzo",
  // Other non-reserved keywords
  "Compile",
  "Delete",
  "Upsert",
  "Cache",
  "Exclusive",
  "Immediate",
  "Only",
  "Align",
  "Latest",
  // New constants that can be used as identifiers
  "Ilp",
  "Native",
  "Pgwire",
  // Window frame keywords
  "Row",
  "Rows",
  "Preceding",
  "Following",
  "Unbounded",
  "Exclude",
  "Others",
  "Nulls",
  // SAMPLE BY keywords
  "Fill",
  "Every",
  "Prev",
  "Linear",
])

for (const name of IDENTIFIER_KEYWORD_NAMES) {
  const token = allGeneratedTokens.get(name)
  if (token) {
    // Add IdentifierKeyword to this token's categories
    if (!token.CATEGORIES) {
      token.CATEGORIES = [IdentifierKeyword]
    } else {
      token.CATEGORIES.push(IdentifierKeyword)
    }
  }
}

// =============================================================================
// Token Exports
// =============================================================================

/**
 * All keyword tokens as a Map (name → token)
 * Use this for dynamic access or iteration
 */
export const keywordTokens = allGeneratedTokens

/**
 * All keyword tokens as an array (for Lexer construction)
 * Order doesn't matter for keywords since they use word boundaries
 */
export const keywordTokenArray: TokenType[] = Array.from(
  allGeneratedTokens.values(),
)

// =============================================================================
// Named Exports for Parser Usage
// The parser needs direct references to tokens like `Select`, `From`, etc.
// =============================================================================

// Extract tokens from the map with proper typing
function getToken(name: string): TokenType {
  const token = allGeneratedTokens.get(name)
  if (!token) {
    throw new globalThis.Error(`Token ${name} not found in generated tokens`)
  }
  return token
}

// Keywords (from grammar/keywords.ts)
export const Abort = getToken("Abort")
export const Account = getToken("Account")
export const Accounts = getToken("Accounts")
export const Add = getToken("Add")
export const Alias = getToken("Alias")
export const Align = getToken("Align")
export const All = getToken("All")
export const Alter = getToken("Alter")
export const And = getToken("And")
export const Any = getToken("Any")
export const As = getToken("As")
export const Asof = getToken("Asof")
export const Assume = getToken("Assume")
export const Attach = getToken("Attach")
export const Atomic = getToken("Atomic")
export const Backup = getToken("Backup")
export const Base = getToken("Base")
export const Batch = getToken("Batch")
export const Between = getToken("Between")
export const By = getToken("By")
export const Bypass = getToken("Bypass")
export const Cache = getToken("Cache")
export const Calendar = getToken("Calendar")
export const Cancel = getToken("Cancel")
export const Capacity = getToken("Capacity")
export const Cascade = getToken("Cascade")
export const Case = getToken("Case")
export const Cast = getToken("Cast")
export const Checkpoint = getToken("Checkpoint")
export const Column = getToken("Column")
export const Columns = getToken("Columns")
export const Compile = getToken("Compile")
export const Complete = getToken("Complete")
export const CompressionCodec = getToken("CompressionCodec")
export const CompressionLevel = getToken("CompressionLevel")
export const CommitLag = getToken("CommitLag")
export const Convert = getToken("Convert")
export const Copy = getToken("Copy")
export const Create = getToken("Create")
export const Cross = getToken("Cross")
export const Cumulative = getToken("Cumulative")
export const Current = getToken("Current")
export const DataPageSize = getToken("DataPageSize")
export const Database = getToken("Database")
export const Declare = getToken("Declare")
export const Dedup = getToken("Dedup")
export const Default = getToken("Default")
export const Deferred = getToken("Deferred")
export const Delay = getToken("Delay")
export const Delete = getToken("Delete")
export const Delimiter = getToken("Delimiter")
export const Detach = getToken("Detach")
export const Details = getToken("Details")
export const Disable = getToken("Disable")
export const Distinct = getToken("Distinct")
export const Drop = getToken("Drop")
export const Else = getToken("Else")
export const Enable = getToken("Enable")
export const End = getToken("End")
export const Error = getToken("Error")
export const Every = getToken("Every")
export const Except = getToken("Except")
export const Exclude = getToken("Exclude")
export const Exclusive = getToken("Exclusive")
export const Exists = getToken("Exists")
export const Exit = getToken("Exit")
export const Explain = getToken("Explain")
export const External = getToken("External")
export const Fill = getToken("Fill")
export const First = getToken("First")
export const Following = getToken("Following")
export const For = getToken("For")
export const Foreign = getToken("Foreign")
export const Format = getToken("Format")
export const From = getToken("From")
export const Full = getToken("Full")
export const Grant = getToken("Grant")
export const Group = getToken("Group")
export const Groups = getToken("Groups")
export const Header = getToken("Header")
export const Http = getToken("Http")
export const If = getToken("If")
export const Ignore = getToken("Ignore")
export const Ilike = getToken("Ilike")
export const Immediate = getToken("Immediate")
export const In = getToken("In")
export const Include = getToken("Include")
export const Index = getToken("Index")
export const Inner = getToken("Inner")
export const Insert = getToken("Insert")
export const Incremental = getToken("Incremental")
export const Intersect = getToken("Intersect")
export const Into = getToken("Into")
export const Is = getToken("Is")
export const Isolation = getToken("Isolation")
export const Jwk = getToken("Jwk")
export const Join = getToken("Join")
export const Key = getToken("Key")
export const Keys = getToken("Keys")
export const Latest = getToken("Latest")
export const Left = getToken("Left")
export const Length = getToken("Length")
export const Level = getToken("Level")
export const Like = getToken("Like")
export const Limit = getToken("Limit")
export const List = getToken("List")
export const Lock = getToken("Lock")
export const Lt = getToken("Lt")
export const Materialized = getToken("Materialized")
export const Manual = getToken("Manual")
export const MaxUncommittedRows = getToken("MaxUncommittedRows")
export const Natural = getToken("Natural")
export const No = getToken("No")
export const Nocache = getToken("Nocache")
export const Not = getToken("Not")
export const Nulls = getToken("Nulls")
export const O3MaxLag = getToken("O3MaxLag")
export const Observation = getToken("Observation")
export const Offset = getToken("Offset")
export const On = getToken("On")
export const Only = getToken("Only")
export const Option = getToken("Option")
export const Or = getToken("Or")
export const Order = getToken("Order")
export const Others = getToken("Others")
export const Outer = getToken("Outer")
export const Over = getToken("Over")
export const Overridable = getToken("Overridable")
export const Owned = getToken("Owned")
export const Param = getToken("Param")
export const Parameters = getToken("Parameters")
export const Parquet = getToken("Parquet")
export const ParquetVersion = getToken("ParquetVersion")
export const PartitionBy = getToken("PartitionBy")
export const Partition = getToken("Partition")
export const Partitions = getToken("Partitions")
export const Password = getToken("Password")
export const Period = getToken("Period")
export const Permissions = getToken("Permissions")
export const Pivot = getToken("Pivot")
export const Prepare = getToken("Prepare")
export const Preceding = getToken("Preceding")
export const Prevailing = getToken("Prevailing")
export const Primary = getToken("Primary")
export const Public = getToken("Public")
export const Query = getToken("Query")
export const Range = getToken("Range")
export const References = getToken("References")
export const Refresh = getToken("Refresh")
export const Release = getToken("Release")
export const Reindex = getToken("Reindex")
export const Remove = getToken("Remove")
export const Rename = getToken("Rename")
export const Repair = getToken("Repair")
export const Replace = getToken("Replace")
export const Rest = getToken("Rest")
export const Respect = getToken("Respect")
export const Resume = getToken("Resume")
export const Revoke = getToken("Revoke")
export const Right = getToken("Right")
export const Row = getToken("Row")
export const RowGroupSize = getToken("RowGroupSize")
export const Rows = getToken("Rows")
export const Sample = getToken("Sample")
export const ServerVersion = getToken("ServerVersion")
export const Select = getToken("Select")
export const Service = getToken("Service")
export const Set = getToken("Set")
export const Show = getToken("Show")
export const Skip = getToken("Skip")
export const SkipColumn = getToken("SkipColumn")
export const SkipRow = getToken("SkipRow")
export const Snapshot = getToken("Snapshot")
export const Splice = getToken("Splice")
export const Squash = getToken("Squash")
export const Start = getToken("Start")
export const StatisticsEnabled = getToken("StatisticsEnabled")
export const Suspend = getToken("Suspend")
export const System = getToken("System")
export const Table = getToken("Table")
export const Tables = getToken("Tables")
export const Then = getToken("Then")
export const Time = getToken("Time")
export const To = getToken("To")
export const Token = getToken("Token")
export const Tolerance = getToken("Tolerance")
export const Transaction = getToken("Transaction")
export const Transient = getToken("Transient")
export const Truncate = getToken("Truncate")
export const Ttl = getToken("Ttl")
export const Txn = getToken("Txn")
export const Type = getToken("Type")
export const Unbounded = getToken("Unbounded")
export const Union = getToken("Union")
export const Unlock = getToken("Unlock")
export const Unpivot = getToken("Unpivot")
export const Update = getToken("Update")
export const Upsert = getToken("Upsert")
export const User = getToken("User")
export const Users = getToken("Users")
export const Vacuum = getToken("Vacuum")
export const Values = getToken("Values")
export const Verification = getToken("Verification")
export const View = getToken("View")
export const Volume = getToken("Volume")
export const Wal = getToken("Wal")
export const When = getToken("When")
export const Where = getToken("Where")
export const Window = getToken("Window")
export const With = getToken("With")
export const Within = getToken("Within")
export const Writer = getToken("Writer")
export const Zone = getToken("Zone")
export const RawArrayEncoding = getToken("RawArrayEncoding")
export const Uncompressed = getToken("Uncompressed")
export const Snappy = getToken("Snappy")
export const Gzip = getToken("Gzip")
export const Lz4 = getToken("Lz4")
export const Zstd = getToken("Zstd")
export const Lz4Raw = getToken("Lz4Raw")
export const Brotli = getToken("Brotli")
export const Lzo = getToken("Lzo")

// Data types (from grammar/dataTypes.ts)
export const Binary = getToken("Binary")
export const Boolean = getToken("Boolean")
export const Byte = getToken("Byte")
export const Char = getToken("Char")
export const Date = getToken("Date")
export const Decimal = getToken("Decimal")
export const Double = getToken("Double")
export const Float = getToken("Float")
export const Geohash = getToken("Geohash")
export const Int = getToken("Int")
export const Integer = getToken("Integer")
export const Interval = getToken("Interval")
export const Ipv4 = getToken("Ipv4")
export const Long = getToken("Long")
export const Long128 = getToken("Long128")
export const Long256 = getToken("Long256")
export const Short = getToken("Short")
export const String = getToken("String")
export const Symbol = getToken("Symbol")
export const Timestamp = getToken("Timestamp")
export const TimestampNs = getToken("TimestampNs")
export const Uuid = getToken("Uuid")
export const Varchar = getToken("Varchar")

// Constants (from grammar/constants.ts)
export const True = getToken("True")
export const False = getToken("False")
export const Null = getToken("Null")
export const NaN = getToken("Nan")
export const None = getToken("None")
export const Prev = getToken("Prev")
export const Linear = getToken("Linear")

// Sort direction (from grammar/constants.ts)
export const Asc = getToken("Asc")
export const Desc = getToken("Desc")

// Time units (from grammar/constants.ts)
export const Hour = getToken("Hour")
export const Hours = getToken("Hours")
export const Day = getToken("Day")
export const Days = getToken("Days")
export const Week = getToken("Week")
export const Weeks = getToken("Weeks")
export const Month = getToken("Month")
export const Months = getToken("Months")
export const Year = getToken("Year")
export const Years = getToken("Years")
export const Minute = getToken("Minute")
export const Minutes = getToken("Minutes")
export const Second = getToken("Second")
export const Seconds = getToken("Seconds")
export const Millisecond = getToken("Millisecond")
export const Milliseconds = getToken("Milliseconds")
export const Microsecond = getToken("Microsecond")
export const Microseconds = getToken("Microseconds")
export const Nanosecond = getToken("Nanosecond")
export const Nanoseconds = getToken("Nanoseconds")
export const Century = getToken("Century")
export const Decade = getToken("Decade")
export const Millennium = getToken("Millennium")
export const Quarter = getToken("Quarter")
export const Dow = getToken("Dow")
export const Doy = getToken("Doy")
export const Epoch = getToken("Epoch")
export const Isodow = getToken("Isodow")
export const Isoyear = getToken("Isoyear")
