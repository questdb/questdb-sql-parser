// =============================================================================
// AST Type Definitions for QuestDB SQL
// =============================================================================

// Base interface for all AST nodes
export interface AstNode {
  type: string
}

// =============================================================================
// Statements
// =============================================================================

// Note: QuestDB does not support DELETE - use DROP PARTITION or replace table pattern
export type Statement =
  | SelectStatement
  | InsertStatement
  | UpdateStatement
  | CreateTableStatement
  | CreateMaterializedViewStatement
  | CreateUserStatement
  | CreateGroupStatement
  | CreateServiceAccountStatement
  | AlterTableStatement
  | AlterMaterializedViewStatement
  | AlterUserStatement
  | AlterServiceAccountStatement
  | CreateViewStatement
  | AlterViewStatement
  | DropTableStatement
  | DropMaterializedViewStatement
  | DropViewStatement
  | DropUserStatement
  | DropGroupStatement
  | DropServiceAccountStatement
  | TruncateTableStatement
  | RenameTableStatement
  | AddUserStatement
  | RemoveUserStatement
  | AssumeServiceAccountStatement
  | ExitServiceAccountStatement
  | CancelQueryStatement
  | ShowStatement
  | ExplainStatement
  | CopyStatement
  | CheckpointStatement
  | SnapshotStatement
  | GrantStatement
  | RevokeStatement
  | GrantAssumeServiceAccountStatement
  | RevokeAssumeServiceAccountStatement
  | VacuumTableStatement
  | ResumeWalStatement
  | SetTypeStatement
  | ReindexTableStatement
  | RefreshMaterializedViewStatement
  | PivotStatement
  | BackupStatement
  | AlterGroupStatement
  | CompileViewStatement

export interface SelectStatement extends AstNode {
  type: "select"
  /** When true, the original query was an implicit SELECT (e.g., "trades" instead of "SELECT * FROM trades") */
  implicit?: boolean
  declare?: DeclareClause
  with?: CTE[]
  distinct?: boolean
  columns: SelectItem[]
  from?: TableRef[]
  where?: Expression
  sampleBy?: SampleByClause
  latestOn?: LatestOnClause
  groupBy?: Expression[]
  pivot?: PivotClause
  orderBy?: OrderByItem[]
  limit?: LimitClause
  setOperations?: SetOperation[]
}

export interface CTE extends AstNode {
  type: "cte"
  name: string
  query: SelectStatement
}

export interface SetOperation extends AstNode {
  type: "setOperation"
  operator: "UNION" | "EXCEPT" | "INTERSECT"
  all?: boolean
  select: SelectStatement
}

export interface InsertStatement extends AstNode {
  type: "insert"
  table: QualifiedName
  atomic?: boolean
  batch?: {
    size: number
    o3MaxLag?: string
  }
  with?: CTE[]
  columns?: string[]
  values?: Expression[][]
  select?: SelectStatement
}

export interface UpdateStatement extends AstNode {
  type: "update"
  with?: CTE[]
  table: QualifiedName
  alias?: string
  set: SetClause[]
  from?: TableRef
  joins?: JoinClause[]
  where?: Expression
}

export interface DeclareClause extends AstNode {
  type: "declareClause"
  assignments: DeclareAssignment[]
}

export interface DeclareAssignment extends AstNode {
  type: "declareAssignment"
  name: string
  value: Expression
  overridable?: boolean
}

export interface CreateTableStatement extends AstNode {
  type: "createTable"
  table: QualifiedName
  atomic?: boolean
  batch?: {
    size: number
    o3MaxLag?: string
  }
  ifNotExists?: boolean
  columns?: ColumnDefinition[]
  like?: QualifiedName
  asSelect?: SelectStatement
  casts?: CastDefinition[]
  indexes?: IndexDefinition[]
  timestamp?: string
  partitionBy?: "NONE" | "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR"
  wal?: boolean
  bypassWal?: boolean
  ttl?: {
    value: number
    unit: "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
  }
  withParams?: TableParam[]
  volume?: string
  ownedBy?: string
  dedupKeys?: string[]
}

export interface TableParam extends AstNode {
  type: "tableParam"
  name: string
  value?: Expression
}

export interface CastDefinition extends AstNode {
  type: "castDefinition"
  column: QualifiedName
  dataType: string
}

export interface IndexDefinition extends AstNode {
  type: "indexDefinition"
  column: QualifiedName
  capacity?: number
}

export interface CreateUserStatement extends AstNode {
  type: "createUser"
  user: QualifiedName
  ifNotExists?: boolean
  password?: string
  noPassword?: boolean
}

export interface CreateGroupStatement extends AstNode {
  type: "createGroup"
  group: QualifiedName
  ifNotExists?: boolean
  externalAlias?: string
}

export interface CreateServiceAccountStatement extends AstNode {
  type: "createServiceAccount"
  account: QualifiedName
  ifNotExists?: boolean
  password?: string
  noPassword?: boolean
  ownedBy?: string
}

export interface CreateMaterializedViewStatement extends AstNode {
  type: "createMaterializedView"
  view: QualifiedName
  ifNotExists?: boolean
  baseTable?: QualifiedName
  refresh?: MaterializedViewRefresh
  period?: MaterializedViewPeriod
  query: SelectStatement
  asParens?: boolean
  timestamp?: QualifiedName
  partitionBy?: "YEAR" | "MONTH" | "WEEK" | "DAY" | "HOUR"
  ttl?: {
    value: number
    unit: "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
  }
  volume?: string
  ownedBy?: string
}

export interface MaterializedViewRefresh extends AstNode {
  type: "materializedViewRefresh"
  mode?: "immediate" | "manual"
  every?: string
  deferred?: boolean
  start?: string
  timeZone?: string
}

export interface MaterializedViewPeriod extends AstNode {
  type: "materializedViewPeriod"
  length?: string
  delay?: string
  timeZone?: string
  sampleByInterval?: boolean
}

export interface ColumnDefinition extends AstNode {
  type: "columnDefinition"
  name: string
  dataType: string
  /** SYMBOL CAPACITY value */
  symbolCapacity?: number
  /** SYMBOL CACHE/NOCACHE */
  cache?: boolean
  /** Whether column is indexed */
  indexed?: boolean
  /** INDEX CAPACITY value */
  indexCapacity?: number
}

export interface AlterTableStatement extends AstNode {
  type: "alterTable"
  table: QualifiedName
  action: AlterTableAction
}

export interface AlterMaterializedViewStatement extends AstNode {
  type: "alterMaterializedView"
  view: QualifiedName
  action: AlterMaterializedViewAction
}

export type AlterMaterializedViewAction =
  | AlterMaterializedViewAddIndex
  | AlterMaterializedViewDropIndex
  | AlterMaterializedViewSymbolCapacity
  | AlterMaterializedViewSetTtl
  | AlterMaterializedViewSetRefreshLimit
  | AlterMaterializedViewSetRefresh
  | AlterMaterializedViewResumeWal
  | AlterMaterializedViewSuspendWal

export interface AlterMaterializedViewAddIndex {
  actionType: "addIndex"
  column: string
  capacity?: number
}

export interface AlterMaterializedViewSymbolCapacity {
  actionType: "symbolCapacity"
  column: string
  capacity: number
}

export interface AlterMaterializedViewSetTtl {
  actionType: "setTtl"
  ttl: {
    value: number
    unit: "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
  }
}

export interface AlterMaterializedViewSetRefreshLimit {
  actionType: "setRefreshLimit"
  limit: {
    value: number
    unit: "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
  }
}

export interface AlterMaterializedViewSetRefresh {
  actionType: "setRefresh"
  refresh?: MaterializedViewRefresh
  period?: MaterializedViewPeriod
}

export interface AlterMaterializedViewDropIndex {
  actionType: "dropIndex"
  column: string
}

export interface AlterMaterializedViewResumeWal {
  actionType: "resumeWal"
  fromTxn?: number
}

export interface AlterMaterializedViewSuspendWal {
  actionType: "suspendWal"
}

export interface AlterUserStatement extends AstNode {
  type: "alterUser"
  user: QualifiedName
  action: AlterUserAction
}

export type AlterUserAction =
  | AlterUserEnableAction
  | AlterUserDisableAction
  | AlterUserPasswordAction
  | AlterUserCreateTokenAction
  | AlterUserDropTokenAction

export interface AlterUserEnableAction {
  actionType: "enable"
}

export interface AlterUserDisableAction {
  actionType: "disable"
}

export interface AlterUserPasswordAction {
  actionType: "password"
  noPassword?: boolean
  password?: string
}

export interface AlterUserCreateTokenAction {
  actionType: "createToken"
  tokenType: "JWK" | "REST"
  ttl?: string
  refresh?: boolean
}

export interface AlterUserDropTokenAction {
  actionType: "dropToken"
  tokenType: "JWK" | "REST"
  token?: string
}

export interface AlterServiceAccountStatement extends AstNode {
  type: "alterServiceAccount"
  account: QualifiedName
  action: AlterUserAction
}

export type AlterTableAction =
  | AddColumnAction
  | DropColumnAction
  | RenameColumnAction
  | AlterColumnAction
  | DropPartitionAction
  | AttachPartitionAction
  | DetachPartitionAction
  | SquashPartitionsAction
  | SetParamAction
  | SetTtlAction
  | DedupDisableAction
  | DedupEnableAction
  | SetTypeWalAction
  | SuspendWalAction
  | ResumeWalAction
  | ConvertPartitionAction

export interface AddColumnAction {
  actionType: "addColumn"
  ifNotExists?: boolean
  columns: ColumnDefinition[]
}

export interface DropColumnAction {
  actionType: "dropColumn"
  columns: string[]
}

export interface RenameColumnAction {
  actionType: "renameColumn"
  oldName: string
  newName: string
}

export interface AlterColumnAction {
  actionType: "alterColumn"
  column: string
  alterType:
    | "type"
    | "addIndex"
    | "dropIndex"
    | "cache"
    | "nocache"
    | "symbolCapacity"
  newType?: string
  capacity?: number
  cache?: boolean
}

export interface DropPartitionAction {
  actionType: "dropPartition"
  partitions?: string[]
  where?: Expression
}

export interface AttachPartitionAction {
  actionType: "attachPartition"
  partitions: string[]
}

export interface DetachPartitionAction {
  actionType: "detachPartition"
  partitions?: string[]
  where?: Expression
}

export interface SquashPartitionsAction {
  actionType: "squashPartitions"
}

export interface SetParamAction {
  actionType: "setParam"
  params: TableParam[]
}

export interface SetTtlAction {
  actionType: "setTtl"
  ttl: {
    value: number
    unit: "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
  }
}

export interface DedupDisableAction {
  actionType: "dedupDisable"
}

export interface DedupEnableAction {
  actionType: "dedupEnable"
  keys: string[]
}

export interface SetTypeWalAction {
  actionType: "setTypeWal"
  bypass?: boolean
}

export interface SuspendWalAction {
  actionType: "suspendWal"
  code?: number | string
  message?: string
}

export interface ResumeWalAction {
  actionType: "resumeWal"
  fromTxn?: number
  fromTransaction?: number
}

export interface ConvertPartitionAction {
  actionType: "convertPartition"
  partitions?: string[]
  target: string
  where?: Expression
}

export interface DropTableStatement extends AstNode {
  type: "dropTable"
  table?: QualifiedName
  ifExists?: boolean
  allTables?: boolean
}

export interface DropMaterializedViewStatement extends AstNode {
  type: "dropMaterializedView"
  view: QualifiedName
  ifExists?: boolean
}

export interface CreateViewStatement extends AstNode {
  type: "createView"
  view: QualifiedName
  orReplace?: boolean
  ifNotExists?: boolean
  query: SelectStatement
  asParens?: boolean
  ownedBy?: string
}

export interface AlterViewStatement extends AstNode {
  type: "alterView"
  view: QualifiedName
  query: SelectStatement
}

export interface DropViewStatement extends AstNode {
  type: "dropView"
  view: QualifiedName
  ifExists?: boolean
}

export interface DropUserStatement extends AstNode {
  type: "dropUser"
  user: QualifiedName
  ifExists?: boolean
}

export interface DropGroupStatement extends AstNode {
  type: "dropGroup"
  group: QualifiedName
  ifExists?: boolean
}

export interface DropServiceAccountStatement extends AstNode {
  type: "dropServiceAccount"
  account: QualifiedName
  ifExists?: boolean
}

export interface TruncateTableStatement extends AstNode {
  type: "truncateTable"
  table: QualifiedName
  ifExists?: boolean
}

export interface RenameTableStatement extends AstNode {
  type: "renameTable"
  from: QualifiedName
  to: QualifiedName
}

export interface AddUserStatement extends AstNode {
  type: "addUser"
  user: QualifiedName
  groups: QualifiedName[]
}

export interface RemoveUserStatement extends AstNode {
  type: "removeUser"
  user: QualifiedName
  groups: QualifiedName[]
}

export interface AssumeServiceAccountStatement extends AstNode {
  type: "assumeServiceAccount"
  account: QualifiedName
}

export interface ExitServiceAccountStatement extends AstNode {
  type: "exitServiceAccount"
  account?: QualifiedName
}

export interface CancelQueryStatement extends AstNode {
  type: "cancelQuery"
  queryId: string
}

export interface ShowStatement extends AstNode {
  type: "show"
  showType:
    | "tables"
    | "columns"
    | "partitions"
    | "createTable"
    | "createView"
    | "createMaterializedView"
    | "user"
    | "users"
    | "groups"
    | "serviceAccount"
    | "serviceAccounts"
    | "permissions"
    | "serverVersion"
    | "serverVersionNum"
    | "parameters"
    | "timeZone"
    | "transaction"
    | "transactionIsolationLevel"
    | "defaultTransactionReadOnly"
  table?: QualifiedName
  name?: QualifiedName
}

export interface ExplainStatement extends AstNode {
  type: "explain"
  statement: Statement
  format?: string
}

export type CopyStatement =
  | CopyCancelStatement
  | CopyFromStatement
  | CopyToStatement

export interface CopyCancelStatement extends AstNode {
  type: "copyCancel"
  id: string
}

export interface CopyFromStatement extends AstNode {
  type: "copyFrom"
  table: QualifiedName
  file: string
  options?: CopyOption[]
}

export interface CopyToStatement extends AstNode {
  type: "copyTo"
  source: QualifiedName | SelectStatement
  destination: string
  options?: CopyOption[]
}

export interface CopyOption extends AstNode {
  type: "copyOption"
  key: string
  value?: string | number | boolean | string[]
}

export interface CheckpointStatement extends AstNode {
  type: "checkpoint"
  action: "create" | "release"
}

export interface SnapshotStatement extends AstNode {
  type: "snapshot"
  action: "prepare" | "complete"
}

export interface GrantStatement extends AstNode {
  type: "grant"
  permissions: string[]
  on?: GrantOnTarget
  to: QualifiedName
  grantOption?: boolean
  verification?: boolean
}

export interface RevokeStatement extends AstNode {
  type: "revoke"
  permissions: string[]
  on?: GrantOnTarget
  from: QualifiedName
}

export interface GrantOnTarget extends AstNode {
  type: "grantOn"
  allTables?: boolean
  tables?: GrantTableTarget[]
}

export interface GrantTableTarget extends AstNode {
  type: "grantTableTarget"
  table: QualifiedName
  columns?: string[]
}

export interface GrantAssumeServiceAccountStatement extends AstNode {
  type: "grantAssumeServiceAccount"
  account: QualifiedName
  to: QualifiedName
  grantOption?: boolean
}

export interface RevokeAssumeServiceAccountStatement extends AstNode {
  type: "revokeAssumeServiceAccount"
  account: QualifiedName
  from: QualifiedName
}

export interface VacuumTableStatement extends AstNode {
  type: "vacuumTable"
  table: QualifiedName
}

export interface ResumeWalStatement extends AstNode {
  type: "resumeWal"
  fromTransaction?: number
  fromTxn?: number
}

export interface SetTypeStatement extends AstNode {
  type: "setType"
  bypass?: boolean
  wal: boolean
}

export interface ReindexTableStatement extends AstNode {
  type: "reindexTable"
  table: QualifiedName
  columns?: string[]
  partitions?: string[]
  lockExclusive?: boolean
}

export interface RefreshMaterializedViewStatement extends AstNode {
  type: "refreshMaterializedView"
  view: QualifiedName
  mode?: "full" | "incremental" | "range"
  from?: string
  to?: string
}

export interface BackupStatement extends AstNode {
  type: "backup"
  action: "database" | "table" | "abort"
  table?: QualifiedName
}

export interface AlterGroupStatement extends AstNode {
  type: "alterGroup"
  group: QualifiedName
  action: "setAlias" | "dropAlias"
  externalAlias: string
}

export interface CompileViewStatement extends AstNode {
  type: "compileView"
  view: QualifiedName
}

export interface PivotStatement extends AstNode {
  type: "pivot"
  source: QualifiedName | SelectStatement
  where?: Expression
  aggregations: PivotAggregation[]
  pivots: PivotForClause[]
  groupBy?: Expression[]
  orderBy?: OrderByItem[]
  limit?: LimitClause
  alias?: string
}

export interface PivotClause extends AstNode {
  type: "pivotClause"
  aggregations: PivotAggregation[]
  pivots: PivotForClause[]
  groupBy?: Expression[]
}

export interface PivotAggregation extends AstNode {
  type: "pivotAggregation"
  expression: Expression
  alias?: string
}

export interface PivotForClause extends AstNode {
  type: "pivotFor"
  expression: Expression
  in: PivotInSource
}

export interface PivotInSource extends AstNode {
  type: "pivotIn"
  values?: Expression[]
  select?: SelectStatement
}

// =============================================================================
// Clauses
// =============================================================================

export type SelectItem =
  | StarSelectItem
  | QualifiedStarSelectItem
  | ExpressionSelectItem

export interface ExpressionSelectItem extends AstNode {
  type: "selectItem"
  expression: Expression
  alias?: string
}

export interface StarSelectItem extends AstNode {
  type: "star"
}

export interface QualifiedStarSelectItem extends AstNode {
  type: "qualifiedStar"
  qualifier: QualifiedName
  alias?: string
}

export interface TableFunctionCall extends AstNode {
  type: "tableFunctionCall"
  name: string
  args: Expression[]
}

export interface TableRef extends AstNode {
  type: "tableRef"
  table: QualifiedName | SelectStatement | TableFunctionCall | ShowStatement
  alias?: string
  joins?: JoinClause[]
  timestampDesignation?: string
}

export interface JoinClause extends AstNode {
  type: "join"
  joinType?:
    | "inner"
    | "left"
    | "right"
    | "full"
    | "cross"
    | "asof"
    | "lt"
    | "splice"
    | "window"
  outer?: boolean
  table: TableRef
  on?: Expression
  /** Tolerance interval for ASOF and LT joins (e.g., "1h", "30s") */
  tolerance?: string
  /** RANGE BETWEEN bounds for WINDOW JOIN */
  range?: { start: WindowJoinBound; end: WindowJoinBound }
  /** INCLUDE/EXCLUDE PREVAILING clause for WINDOW JOIN */
  prevailing?: "include" | "exclude"
}

export interface WindowJoinBound extends AstNode {
  type: "windowJoinBound"
  boundType: "currentRow" | "duration"
  direction?: "preceding" | "following"
  duration?: string
}

export interface SampleByClause extends AstNode {
  type: "sampleBy"
  duration: string
  fill?: string[]
  alignTo?: AlignToClause
  from?: Expression
  to?: Expression
}

export interface AlignToClause extends AstNode {
  type: "alignTo"
  mode: "firstObservation" | "calendar"
  timeZone?: string
  offset?: string
}

export interface LatestOnClause extends AstNode {
  type: "latestOn"
  timestamp?: QualifiedName
  partitionBy: QualifiedName[]
}

export interface OrderByItem extends AstNode {
  type: "orderByItem"
  expression: Expression
  direction?: "asc" | "desc"
}

export interface LimitClause extends AstNode {
  type: "limit"
  lowerBound: Expression
  upperBound?: Expression
}

export interface SetClause extends AstNode {
  type: "setClause"
  column: string
  value: Expression
}

// =============================================================================
// Expressions
// =============================================================================

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | ColumnRef
  | VariableRef
  | Literal
  | FunctionCall
  | CaseExpression
  | CastExpression
  | TypeCastExpression
  | InExpression
  | BetweenExpression
  | WithinExpression
  | IsNullExpression
  | ParenExpression
  | ArrayLiteral
  | ArrayAccessExpression
  | SubqueryExpression

export interface BinaryExpression extends AstNode {
  type: "binary"
  operator: string
  left: Expression
  right: Expression
}

export interface UnaryExpression extends AstNode {
  type: "unary"
  operator: string
  operand: Expression
}

export interface ColumnRef extends AstNode {
  type: "column"
  name: QualifiedName
}

export interface QualifiedName extends AstNode {
  type: "qualifiedName"
  parts: string[]
}

export interface Literal extends AstNode {
  type: "literal"
  value: string | number | boolean | null
  literalType: "string" | "number" | "boolean" | "null" | "geohash" | "duration"
  raw?: string
}

export interface FunctionCall extends AstNode {
  type: "function"
  name: string
  args: Expression[]
  distinct?: boolean
  star?: boolean
  /** When true, args are separated by FROM instead of comma (e.g., EXTRACT(YEAR FROM ts)) */
  fromSeparator?: boolean
  /** IGNORE NULLS modifier (e.g., first_value(x) IGNORE NULLS) */
  ignoreNulls?: boolean
  /** Subquery as function argument (e.g., touch(SELECT * FROM t)) */
  subquery?: SelectStatement
  over?: WindowSpecification
}

export interface WindowSpecification extends AstNode {
  type: "windowSpec"
  partitionBy?: Expression[]
  orderBy?: OrderByItem[]
  frame?: WindowFrame
}

export interface WindowFrame extends AstNode {
  type: "windowFrame"
  mode: "rows" | "range" | "groups" | "cumulative"
  start?: WindowFrameBound
  end?: WindowFrameBound
  exclude?: "currentRow" | "noOthers" | "groups"
}

export interface WindowFrameBound extends AstNode {
  type: "windowFrameBound"
  kind:
    | "unboundedPreceding"
    | "unboundedFollowing"
    | "currentRow"
    | "preceding"
    | "following"
  value?: Expression
  /** Duration string for time-unit based bounds (e.g., "5 seconds") */
  duration?: string
}

export interface CaseExpression extends AstNode {
  type: "case"
  /** Operand expression for simple CASE: CASE expr WHEN ... */
  operand?: Expression
  whenClauses: { when: Expression; then: Expression }[]
  elseClause?: Expression
}

export interface CastExpression extends AstNode {
  type: "cast"
  expression: Expression
  dataType: string
}

export interface TypeCastExpression extends AstNode {
  type: "typeCast"
  expression: Expression
  dataType: string
}

export interface InExpression extends AstNode {
  type: "in"
  expression: Expression
  values: Expression[]
  not?: boolean
  parenthesized?: boolean
}

export interface BetweenExpression extends AstNode {
  type: "between"
  expression: Expression
  low: Expression
  high: Expression
  not?: boolean
}

export interface WithinExpression extends AstNode {
  type: "within"
  expression: Expression
  values: Expression[]
}

export interface IsNullExpression extends AstNode {
  type: "isNull"
  expression: Expression
  not?: boolean
}

export interface VariableRef extends AstNode {
  type: "variable"
  name: string
}

export interface ParenExpression extends AstNode {
  type: "paren"
  expression: Expression
  /** Additional expressions for row/tuple constructors like (col1, col2) */
  additionalExpressions?: Expression[]
}

export interface ArrayLiteral extends AstNode {
  type: "arrayLiteral"
  elements: (Expression | ArrayLiteral)[]
  hasArrayKeyword?: boolean
}

export interface ArrayAccessExpression extends AstNode {
  type: "arrayAccess"
  array: Expression
  subscripts: (Expression | ArraySlice)[]
}

export interface ArraySlice extends AstNode {
  type: "arraySlice"
  start?: Expression
  end?: Expression
}

export interface SubqueryExpression extends AstNode {
  type: "subquery"
  query: SelectStatement
}
