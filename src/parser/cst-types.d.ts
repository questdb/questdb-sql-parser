import type { CstNode, ICstVisitor, IToken } from "chevrotain";

export interface StatementsCstNode extends CstNode {
  name: "statements";
  children: StatementsCstChildren;
}

export type StatementsCstChildren = {
  statement?: StatementCstNode[];
  Semicolon?: IToken[];
};

export interface StatementCstNode extends CstNode {
  name: "statement";
  children: StatementCstChildren;
}

export type StatementCstChildren = {
  insertStatement?: InsertStatementCstNode[];
  updateStatement?: UpdateStatementCstNode[];
  selectStatement?: SelectStatementCstNode[];
  createStatement?: CreateStatementCstNode[];
  dropStatement?: DropStatementCstNode[];
  truncateTableStatement?: TruncateTableStatementCstNode[];
  renameTableStatement?: RenameTableStatementCstNode[];
  addUserStatement?: AddUserStatementCstNode[];
  removeUserStatement?: RemoveUserStatementCstNode[];
  assumeServiceAccountStatement?: AssumeServiceAccountStatementCstNode[];
  exitServiceAccountStatement?: ExitServiceAccountStatementCstNode[];
  cancelQueryStatement?: CancelQueryStatementCstNode[];
  showStatement?: ShowStatementCstNode[];
  explainStatement?: ExplainStatementCstNode[];
  alterStatement?: AlterStatementCstNode[];
  copyStatement?: CopyStatementCstNode[];
  checkpointStatement?: CheckpointStatementCstNode[];
  snapshotStatement?: SnapshotStatementCstNode[];
  grantAssumeServiceAccountStatement?: GrantAssumeServiceAccountStatementCstNode[];
  revokeAssumeServiceAccountStatement?: RevokeAssumeServiceAccountStatementCstNode[];
  grantStatement?: GrantStatementCstNode[];
  revokeStatement?: RevokeStatementCstNode[];
  vacuumTableStatement?: VacuumTableStatementCstNode[];
  resumeWalStatement?: ResumeWalStatementCstNode[];
  setTypeStatement?: SetTypeStatementCstNode[];
  reindexTableStatement?: ReindexTableStatementCstNode[];
  refreshMaterializedViewStatement?: RefreshMaterializedViewStatementCstNode[];
  pivotStatement?: PivotStatementCstNode[];
  backupStatement?: BackupStatementCstNode[];
  compileViewStatement?: CompileViewStatementCstNode[];
  implicitSelectStatement?: ImplicitSelectStatementCstNode[];
};

export interface SelectStatementCstNode extends CstNode {
  name: "selectStatement";
  children: SelectStatementCstChildren;
}

export type SelectStatementCstChildren = {
  declareClause?: DeclareClauseCstNode[];
  withClause?: WithClauseCstNode[];
  simpleSelect: SimpleSelectCstNode[];
  setOperation?: SetOperationCstNode[];
};

export interface WithClauseCstNode extends CstNode {
  name: "withClause";
  children: WithClauseCstChildren;
}

export type WithClauseCstChildren = {
  With: IToken[];
  cteDefinition: (CteDefinitionCstNode)[];
  Comma?: IToken[];
};

export interface CteDefinitionCstNode extends CstNode {
  name: "cteDefinition";
  children: CteDefinitionCstChildren;
}

export type CteDefinitionCstChildren = {
  identifier: IdentifierCstNode[];
  As: IToken[];
  LParen: IToken[];
  selectStatement?: SelectStatementCstNode[];
  implicitSelectStatement?: ImplicitSelectStatementCstNode[];
  RParen: IToken[];
};

export interface SimpleSelectCstNode extends CstNode {
  name: "simpleSelect";
  children: SimpleSelectCstChildren;
}

export type SimpleSelectCstChildren = {
  Select: IToken[];
  Distinct?: IToken[];
  selectList: SelectListCstNode[];
  From?: IToken[];
  fromClause?: FromClauseCstNode[];
  whereClause?: WhereClauseCstNode[];
  sampleByClause?: SampleByClauseCstNode[];
  latestOnClause?: LatestOnClauseCstNode[];
  groupByClause?: GroupByClauseCstNode[];
  Pivot?: IToken[];
  LParen?: IToken[];
  pivotBody?: PivotBodyCstNode[];
  RParen?: IToken[];
  orderByClause?: OrderByClauseCstNode[];
  windowDefinitionClause?: WindowDefinitionClauseCstNode[];
  limitClause?: LimitClauseCstNode[];
};

export interface SetOperationCstNode extends CstNode {
  name: "setOperation";
  children: SetOperationCstChildren;
}

export type SetOperationCstChildren = {
  Union?: IToken[];
  Except?: IToken[];
  Intersect?: IToken[];
  All?: IToken[];
  simpleSelect?: SimpleSelectCstNode[];
  implicitSelectBody?: ImplicitSelectBodyCstNode[];
};

export interface SelectListCstNode extends CstNode {
  name: "selectList";
  children: SelectListCstChildren;
}

export type SelectListCstChildren = {
  Star?: IToken[];
  Comma?: (IToken)[];
  selectItem?: (SelectItemCstNode)[];
};

export interface SelectItemCstNode extends CstNode {
  name: "selectItem";
  children: SelectItemCstChildren;
}

export type SelectItemCstChildren = {
  qualifiedStar?: QualifiedStarCstNode[];
  expression?: ExpressionCstNode[];
  As?: IToken[];
  identifier?: IdentifierCstNode[];
};

export interface QualifiedStarCstNode extends CstNode {
  name: "qualifiedStar";
  children: QualifiedStarCstChildren;
}

export type QualifiedStarCstChildren = {
  identifier: (IdentifierCstNode)[];
  Dot: (IToken)[];
  Star: IToken[];
};

export interface FromClauseCstNode extends CstNode {
  name: "fromClause";
  children: FromClauseCstChildren;
}

export type FromClauseCstChildren = {
  tableRef: (TableRefCstNode)[];
  joinClause?: JoinClauseCstNode[];
  Comma?: IToken[];
};

export interface ImplicitSelectBodyCstNode extends CstNode {
  name: "implicitSelectBody";
  children: ImplicitSelectBodyCstChildren;
}

export type ImplicitSelectBodyCstChildren = {
  fromClause: FromClauseCstNode[];
  whereClause?: WhereClauseCstNode[];
  sampleByClause?: SampleByClauseCstNode[];
  latestOnClause?: LatestOnClauseCstNode[];
  groupByClause?: GroupByClauseCstNode[];
  orderByClause?: OrderByClauseCstNode[];
  limitClause?: LimitClauseCstNode[];
};

export interface ImplicitSelectStatementCstNode extends CstNode {
  name: "implicitSelectStatement";
  children: ImplicitSelectStatementCstChildren;
}

export type ImplicitSelectStatementCstChildren = {
  implicitSelectBody: ImplicitSelectBodyCstNode[];
  setOperation?: SetOperationCstNode[];
};

export interface TableRefCstNode extends CstNode {
  name: "tableRef";
  children: TableRefCstChildren;
}

export type TableRefCstChildren = {
  LParen?: (IToken)[];
  selectStatement?: SelectStatementCstNode[];
  RParen?: (IToken)[];
  showStatement?: ShowStatementCstNode[];
  implicitSelectStatement?: ImplicitSelectStatementCstNode[];
  tableFunctionCall?: TableFunctionCallCstNode[];
  VariableReference?: IToken[];
  StringLiteral?: IToken[];
  qualifiedName?: QualifiedNameCstNode[];
  Timestamp?: IToken[];
  columnRef?: ColumnRefCstNode[];
  As?: IToken[];
  identifier?: (IdentifierCstNode)[];
};

export interface TableFunctionCallCstNode extends CstNode {
  name: "tableFunctionCall";
  children: TableFunctionCallCstChildren;
}

export type TableFunctionCallCstChildren = {
  tableFunctionName: TableFunctionNameCstNode[];
  LParen: IToken[];
  expression?: (ExpressionCstNode)[];
  Comma?: IToken[];
  RParen: IToken[];
};

export interface TableFunctionNameCstNode extends CstNode {
  name: "tableFunctionName";
  children: TableFunctionNameCstChildren;
}

export type TableFunctionNameCstChildren = {
  identifier: IdentifierCstNode[];
};

export interface JoinClauseCstNode extends CstNode {
  name: "joinClause";
  children: JoinClauseCstChildren;
}

export type JoinClauseCstChildren = {
  Inner?: IToken[];
  Left?: IToken[];
  Right?: IToken[];
  Full?: IToken[];
  Cross?: IToken[];
  Asof?: IToken[];
  Lt?: IToken[];
  Splice?: IToken[];
  Window?: IToken[];
  Natural?: IToken[];
  Prevailing?: (IToken)[];
  Outer?: IToken[];
  Join: IToken[];
  tableRef: TableRefCstNode[];
  On?: IToken[];
  expression?: ExpressionCstNode[];
  Tolerance?: IToken[];
  DurationLiteral?: IToken[];
  Range?: IToken[];
  Between?: IToken[];
  windowJoinBound?: (WindowJoinBoundCstNode)[];
  And?: IToken[];
  Include?: IToken[];
  Exclude?: IToken[];
};

export interface WindowJoinBoundCstNode extends CstNode {
  name: "windowJoinBound";
  children: WindowJoinBoundCstChildren;
}

export type WindowJoinBoundCstChildren = {
  Current?: IToken[];
  Row?: IToken[];
  Preceding?: (IToken)[];
  Following?: (IToken)[];
  durationExpression?: DurationExpressionCstNode[];
};

export interface DurationExpressionCstNode extends CstNode {
  name: "durationExpression";
  children: DurationExpressionCstChildren;
}

export type DurationExpressionCstChildren = {
  DurationLiteral?: IToken[];
  NumberLiteral?: IToken[];
  StringLiteral?: IToken[];
  timeUnit?: TimeUnitCstNode[];
};

export interface WhereClauseCstNode extends CstNode {
  name: "whereClause";
  children: WhereClauseCstChildren;
}

export type WhereClauseCstChildren = {
  Where: IToken[];
  expression: ExpressionCstNode[];
};

export interface SampleByClauseCstNode extends CstNode {
  name: "sampleByClause";
  children: SampleByClauseCstChildren;
}

export type SampleByClauseCstChildren = {
  Sample: IToken[];
  By: IToken[];
  DurationLiteral?: IToken[];
  VariableReference?: IToken[];
  fromToClause?: FromToClauseCstNode[];
  fillClause?: FillClauseCstNode[];
  alignToClause?: AlignToClauseCstNode[];
};

export interface LatestOnClauseCstNode extends CstNode {
  name: "latestOnClause";
  children: LatestOnClauseCstChildren;
}

export type LatestOnClauseCstChildren = {
  Latest: IToken[];
  On?: IToken[];
  columnRef?: (ColumnRefCstNode)[];
  Partition?: IToken[];
  By?: (IToken)[];
  Comma?: (IToken)[];
};

export interface FillClauseCstNode extends CstNode {
  name: "fillClause";
  children: FillClauseCstChildren;
}

export type FillClauseCstChildren = {
  Fill: IToken[];
  LParen: IToken[];
  fillValue: (FillValueCstNode)[];
  Comma?: IToken[];
  RParen: IToken[];
};

export interface FillValueCstNode extends CstNode {
  name: "fillValue";
  children: FillValueCstChildren;
}

export type FillValueCstChildren = {
  Null?: IToken[];
  NumberLiteral?: IToken[];
  identifier?: IdentifierCstNode[];
};

export interface AlignToClauseCstNode extends CstNode {
  name: "alignToClause";
  children: AlignToClauseCstChildren;
}

export type AlignToClauseCstChildren = {
  Align: IToken[];
  To: IToken[];
  First?: IToken[];
  Observation?: IToken[];
  Calendar?: IToken[];
  Time?: IToken[];
  Zone?: IToken[];
  timeZoneValue?: TimeZoneValueCstNode[];
  With?: IToken[];
  Offset?: IToken[];
  stringOrIdentifier?: StringOrIdentifierCstNode[];
};

export interface FromToClauseCstNode extends CstNode {
  name: "fromToClause";
  children: FromToClauseCstChildren;
}

export type FromToClauseCstChildren = {
  From?: IToken[];
  expression?: (ExpressionCstNode)[];
  To?: (IToken)[];
};

export interface GroupByClauseCstNode extends CstNode {
  name: "groupByClause";
  children: GroupByClauseCstChildren;
}

export type GroupByClauseCstChildren = {
  Group: IToken[];
  By: IToken[];
  expression: (ExpressionCstNode)[];
  Comma?: IToken[];
};

export interface OrderByClauseCstNode extends CstNode {
  name: "orderByClause";
  children: OrderByClauseCstChildren;
}

export type OrderByClauseCstChildren = {
  Order: IToken[];
  By: IToken[];
  orderByItem: (OrderByItemCstNode)[];
  Comma?: IToken[];
};

export interface OrderByItemCstNode extends CstNode {
  name: "orderByItem";
  children: OrderByItemCstChildren;
}

export type OrderByItemCstChildren = {
  expression: ExpressionCstNode[];
  Asc?: IToken[];
  Desc?: IToken[];
};

export interface LimitClauseCstNode extends CstNode {
  name: "limitClause";
  children: LimitClauseCstChildren;
}

export type LimitClauseCstChildren = {
  Limit: IToken[];
  expression: (ExpressionCstNode)[];
  Comma?: IToken[];
};

export interface InsertStatementCstNode extends CstNode {
  name: "insertStatement";
  children: InsertStatementCstChildren;
}

export type InsertStatementCstChildren = {
  withClause?: WithClauseCstNode[];
  Insert: IToken[];
  Atomic?: IToken[];
  batchClause?: (BatchClauseCstNode)[];
  Into: IToken[];
  stringOrQualifiedName: StringOrQualifiedNameCstNode[];
  LParen?: IToken[];
  identifier?: (IdentifierCstNode)[];
  Comma?: IToken[];
  RParen?: IToken[];
  valuesClause?: ValuesClauseCstNode[];
  selectStatement?: SelectStatementCstNode[];
};

export interface ValuesClauseCstNode extends CstNode {
  name: "valuesClause";
  children: ValuesClauseCstChildren;
}

export type ValuesClauseCstChildren = {
  Values: IToken[];
  valuesList: (ValuesListCstNode)[];
  Comma?: IToken[];
};

export interface ValuesListCstNode extends CstNode {
  name: "valuesList";
  children: ValuesListCstChildren;
}

export type ValuesListCstChildren = {
  LParen: IToken[];
  expression: (ExpressionCstNode)[];
  Comma?: IToken[];
  RParen: IToken[];
};

export interface UpdateStatementCstNode extends CstNode {
  name: "updateStatement";
  children: UpdateStatementCstChildren;
}

export type UpdateStatementCstChildren = {
  withClause?: WithClauseCstNode[];
  Update: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  identifier?: IdentifierCstNode[];
  Set: IToken[];
  setClause: (SetClauseCstNode)[];
  Comma?: IToken[];
  From?: IToken[];
  tableRef?: TableRefCstNode[];
  joinClause?: JoinClauseCstNode[];
  whereClause?: WhereClauseCstNode[];
};

export interface SetClauseCstNode extends CstNode {
  name: "setClause";
  children: SetClauseCstChildren;
}

export type SetClauseCstChildren = {
  columnRef: ColumnRefCstNode[];
  Equals: IToken[];
  expression: ExpressionCstNode[];
};

export interface DeclareClauseCstNode extends CstNode {
  name: "declareClause";
  children: DeclareClauseCstChildren;
}

export type DeclareClauseCstChildren = {
  Declare: IToken[];
  declareAssignment: (DeclareAssignmentCstNode)[];
  Comma?: IToken[];
};

export interface DeclareAssignmentCstNode extends CstNode {
  name: "declareAssignment";
  children: DeclareAssignmentCstChildren;
}

export type DeclareAssignmentCstChildren = {
  Overridable?: IToken[];
  VariableReference: IToken[];
  ColonEquals?: IToken[];
  Equals?: IToken[];
  expression: ExpressionCstNode[];
};

export interface CreateStatementCstNode extends CstNode {
  name: "createStatement";
  children: CreateStatementCstChildren;
}

export type CreateStatementCstChildren = {
  Create: IToken[];
  createTableBody?: CreateTableBodyCstNode[];
  createMaterializedViewBody?: CreateMaterializedViewBodyCstNode[];
  createViewBody?: CreateViewBodyCstNode[];
  createUserStatement?: CreateUserStatementCstNode[];
  createGroupStatement?: CreateGroupStatementCstNode[];
  createServiceAccountStatement?: CreateServiceAccountStatementCstNode[];
};

export interface CreateViewBodyCstNode extends CstNode {
  name: "createViewBody";
  children: CreateViewBodyCstChildren;
}

export type CreateViewBodyCstChildren = {
  Or?: IToken[];
  Replace?: IToken[];
  View: IToken[];
  If?: IToken[];
  Not?: IToken[];
  Exists?: IToken[];
  stringOrQualifiedName: StringOrQualifiedNameCstNode[];
  As: IToken[];
  LParen?: (IToken)[];
  selectStatement?: (SelectStatementCstNode)[];
  RParen?: (IToken)[];
  implicitSelectBody?: ImplicitSelectBodyCstNode[];
  Owned?: IToken[];
  By?: IToken[];
  stringOrIdentifier?: StringOrIdentifierCstNode[];
};

export interface CreateTableBodyCstNode extends CstNode {
  name: "createTableBody";
  children: CreateTableBodyCstChildren;
}

export type CreateTableBodyCstChildren = {
  Atomic?: IToken[];
  batchClause?: BatchClauseCstNode[];
  Table: IToken[];
  If?: IToken[];
  Not?: IToken[];
  Exists?: IToken[];
  stringOrQualifiedName?: StringOrQualifiedNameCstNode[];
  StringLiteral?: (IToken)[];
  qualifiedName?: (QualifiedNameCstNode)[];
  As?: IToken[];
  LParen?: (IToken)[];
  selectStatement?: SelectStatementCstNode[];
  RParen?: (IToken)[];
  Comma?: (IToken)[];
  castDefinition?: CastDefinitionCstNode[];
  indexDefinition?: (IndexDefinitionCstNode)[];
  columnDefinition?: (ColumnDefinitionCstNode)[];
  Like?: IToken[];
  Timestamp?: IToken[];
  columnRef?: ColumnRefCstNode[];
  Partition?: IToken[];
  By?: (IToken)[];
  partitionPeriod?: PartitionPeriodCstNode[];
  Ttl?: IToken[];
  DurationLiteral?: IToken[];
  NumberLiteral?: IToken[];
  Hours?: IToken[];
  Days?: IToken[];
  Weeks?: IToken[];
  Months?: IToken[];
  Years?: IToken[];
  Hour?: IToken[];
  Day?: IToken[];
  Week?: IToken[];
  Month?: IToken[];
  Year?: IToken[];
  Bypass?: IToken[];
  Wal?: (IToken)[];
  With?: IToken[];
  tableParam?: (TableParamCstNode)[];
  In?: (IToken)[];
  Volume?: IToken[];
  identifier?: IdentifierCstNode[];
  dedupClause?: DedupClauseCstNode[];
  Owned?: IToken[];
  stringOrIdentifier?: StringOrIdentifierCstNode[];
};

export interface BatchClauseCstNode extends CstNode {
  name: "batchClause";
  children: BatchClauseCstChildren;
}

export type BatchClauseCstChildren = {
  Batch: IToken[];
  NumberLiteral: IToken[];
  O3MaxLag?: IToken[];
  DurationLiteral?: IToken[];
  StringLiteral?: IToken[];
};

export interface DedupClauseCstNode extends CstNode {
  name: "dedupClause";
  children: DedupClauseCstChildren;
}

export type DedupClauseCstChildren = {
  Dedup: IToken[];
  Upsert: IToken[];
  Keys: IToken[];
  LParen: IToken[];
  identifier: (IdentifierCstNode)[];
  Comma?: IToken[];
  RParen: IToken[];
};

export interface CreateUserStatementCstNode extends CstNode {
  name: "createUserStatement";
  children: CreateUserStatementCstChildren;
}

export type CreateUserStatementCstChildren = {
  User: IToken[];
  If?: IToken[];
  Not?: IToken[];
  Exists?: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  With?: IToken[];
  No?: IToken[];
  Password?: (IToken)[];
  StringLiteral?: IToken[];
  identifier?: IdentifierCstNode[];
};

export interface CreateGroupStatementCstNode extends CstNode {
  name: "createGroupStatement";
  children: CreateGroupStatementCstChildren;
}

export type CreateGroupStatementCstChildren = {
  Group: IToken[];
  If?: IToken[];
  Not?: IToken[];
  Exists?: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  With?: IToken[];
  External?: IToken[];
  Alias?: IToken[];
  StringLiteral?: IToken[];
};

export interface CreateServiceAccountStatementCstNode extends CstNode {
  name: "createServiceAccountStatement";
  children: CreateServiceAccountStatementCstChildren;
}

export type CreateServiceAccountStatementCstChildren = {
  Service: IToken[];
  Account: IToken[];
  If?: IToken[];
  Not?: IToken[];
  Exists?: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  With?: IToken[];
  Password?: (IToken)[];
  StringLiteral?: IToken[];
  identifier?: IdentifierCstNode[];
  No?: IToken[];
  Owned?: IToken[];
  By?: IToken[];
  stringOrIdentifier?: StringOrIdentifierCstNode[];
};

export interface CreateMaterializedViewBodyCstNode extends CstNode {
  name: "createMaterializedViewBody";
  children: CreateMaterializedViewBodyCstChildren;
}

export type CreateMaterializedViewBodyCstChildren = {
  Materialized: IToken[];
  View: IToken[];
  If?: IToken[];
  Not?: IToken[];
  Exists?: IToken[];
  stringOrQualifiedName: (StringOrQualifiedNameCstNode)[];
  With?: IToken[];
  Base?: IToken[];
  Refresh?: IToken[];
  materializedViewPeriod?: (MaterializedViewPeriodCstNode)[];
  materializedViewRefresh?: MaterializedViewRefreshCstNode[];
  As: IToken[];
  LParen?: (IToken)[];
  selectStatement: SelectStatementCstNode[];
  RParen?: (IToken)[];
  Timestamp?: IToken[];
  columnRef?: ColumnRefCstNode[];
  materializedViewPartition?: MaterializedViewPartitionCstNode[];
  In?: IToken[];
  Volume?: IToken[];
  StringLiteral?: IToken[];
  identifier?: IdentifierCstNode[];
  Owned?: IToken[];
  By?: IToken[];
  stringOrIdentifier?: StringOrIdentifierCstNode[];
};

export interface MaterializedViewRefreshCstNode extends CstNode {
  name: "materializedViewRefresh";
  children: MaterializedViewRefreshCstChildren;
}

export type MaterializedViewRefreshCstChildren = {
  Immediate?: IToken[];
  Manual?: IToken[];
  Deferred?: (IToken)[];
  Every?: IToken[];
  intervalValue?: IntervalValueCstNode[];
  Start?: IToken[];
  stringOrIdentifier?: StringOrIdentifierCstNode[];
  Time?: IToken[];
  Zone?: IToken[];
  timeZoneValue?: TimeZoneValueCstNode[];
};

export interface MaterializedViewPeriodCstNode extends CstNode {
  name: "materializedViewPeriod";
  children: MaterializedViewPeriodCstChildren;
}

export type MaterializedViewPeriodCstChildren = {
  Period: IToken[];
  LParen: IToken[];
  Length?: IToken[];
  intervalValue?: (IntervalValueCstNode)[];
  Time?: IToken[];
  Zone?: IToken[];
  timeZoneValue?: TimeZoneValueCstNode[];
  Delay?: IToken[];
  Sample?: IToken[];
  By?: IToken[];
  Interval?: IToken[];
  RParen: IToken[];
};

export interface MaterializedViewPartitionCstNode extends CstNode {
  name: "materializedViewPartition";
  children: MaterializedViewPartitionCstChildren;
}

export type MaterializedViewPartitionCstChildren = {
  Partition: IToken[];
  By: IToken[];
  partitionPeriod: PartitionPeriodCstNode[];
  Ttl?: IToken[];
  NumberLiteral?: IToken[];
  Hours?: IToken[];
  Days?: IToken[];
  Weeks?: IToken[];
  Months?: IToken[];
  Years?: IToken[];
};

export interface ColumnDefinitionCstNode extends CstNode {
  name: "columnDefinition";
  children: ColumnDefinitionCstChildren;
}

export type ColumnDefinitionCstChildren = {
  identifier: IdentifierCstNode[];
  dataType: DataTypeCstNode[];
  Capacity?: (IToken)[];
  NumberLiteral?: (IToken)[];
  Cache?: IToken[];
  Nocache?: IToken[];
  Index?: IToken[];
};

export interface CastDefinitionCstNode extends CstNode {
  name: "castDefinition";
  children: CastDefinitionCstChildren;
}

export type CastDefinitionCstChildren = {
  Cast: IToken[];
  LParen: IToken[];
  columnRef: ColumnRefCstNode[];
  As: IToken[];
  dataType: DataTypeCstNode[];
  RParen: IToken[];
};

export interface IndexDefinitionCstNode extends CstNode {
  name: "indexDefinition";
  children: IndexDefinitionCstChildren;
}

export type IndexDefinitionCstChildren = {
  Index: IToken[];
  LParen: IToken[];
  columnRef: ColumnRefCstNode[];
  Capacity?: IToken[];
  NumberLiteral?: IToken[];
  RParen: IToken[];
};

export interface TableParamNameCstNode extends CstNode {
  name: "tableParamName";
  children: TableParamNameCstChildren;
}

export type TableParamNameCstChildren = {
  identifier: IdentifierCstNode[];
};

export interface TableParamCstNode extends CstNode {
  name: "tableParam";
  children: TableParamCstChildren;
}

export type TableParamCstChildren = {
  tableParamName: TableParamNameCstNode[];
  Equals?: IToken[];
  expression?: ExpressionCstNode[];
};

export interface PartitionPeriodCstNode extends CstNode {
  name: "partitionPeriod";
  children: PartitionPeriodCstChildren;
}

export type PartitionPeriodCstChildren = {
  None?: IToken[];
  Hour?: IToken[];
  Day?: IToken[];
  Week?: IToken[];
  Month?: IToken[];
  Year?: IToken[];
};

export interface TimeUnitCstNode extends CstNode {
  name: "timeUnit";
  children: TimeUnitCstChildren;
}

export type TimeUnitCstChildren = {
  Hours?: IToken[];
  Days?: IToken[];
  Weeks?: IToken[];
  Months?: IToken[];
  Years?: IToken[];
  Hour?: IToken[];
  Day?: IToken[];
  Week?: IToken[];
  Month?: IToken[];
  Year?: IToken[];
  Minute?: IToken[];
  Minutes?: IToken[];
  Second?: IToken[];
  Seconds?: IToken[];
  Millisecond?: IToken[];
  Milliseconds?: IToken[];
  Microsecond?: IToken[];
  Microseconds?: IToken[];
  Nanosecond?: IToken[];
  Nanoseconds?: IToken[];
};

export interface AlterStatementCstNode extends CstNode {
  name: "alterStatement";
  children: AlterStatementCstChildren;
}

export type AlterStatementCstChildren = {
  Alter: IToken[];
  alterTableStatement?: AlterTableStatementCstNode[];
  alterMaterializedViewStatement?: AlterMaterializedViewStatementCstNode[];
  alterViewStatement?: AlterViewStatementCstNode[];
  alterUserStatement?: AlterUserStatementCstNode[];
  alterServiceAccountStatement?: AlterServiceAccountStatementCstNode[];
  alterGroupStatement?: AlterGroupStatementCstNode[];
};

export interface AlterGroupStatementCstNode extends CstNode {
  name: "alterGroupStatement";
  children: AlterGroupStatementCstChildren;
}

export type AlterGroupStatementCstChildren = {
  Group: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  With?: IToken[];
  External?: (IToken)[];
  Alias?: (IToken)[];
  StringLiteral?: (IToken)[];
  Drop?: IToken[];
};

export interface AlterViewStatementCstNode extends CstNode {
  name: "alterViewStatement";
  children: AlterViewStatementCstChildren;
}

export type AlterViewStatementCstChildren = {
  View: IToken[];
  stringOrQualifiedName: StringOrQualifiedNameCstNode[];
  As: IToken[];
  LParen?: IToken[];
  selectStatement?: (SelectStatementCstNode)[];
  RParen?: IToken[];
};

export interface AlterUserStatementCstNode extends CstNode {
  name: "alterUserStatement";
  children: AlterUserStatementCstChildren;
}

export type AlterUserStatementCstChildren = {
  User: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  alterUserAction: AlterUserActionCstNode[];
};

export interface AlterServiceAccountStatementCstNode extends CstNode {
  name: "alterServiceAccountStatement";
  children: AlterServiceAccountStatementCstChildren;
}

export type AlterServiceAccountStatementCstChildren = {
  Service: IToken[];
  Account: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  alterUserAction: AlterUserActionCstNode[];
};

export interface AlterUserActionCstNode extends CstNode {
  name: "alterUserAction";
  children: AlterUserActionCstChildren;
}

export type AlterUserActionCstChildren = {
  Enable?: IToken[];
  Disable?: IToken[];
  With?: (IToken)[];
  No?: IToken[];
  Password?: (IToken)[];
  StringLiteral?: (IToken)[];
  Create?: IToken[];
  Token?: (IToken)[];
  Type?: (IToken)[];
  Jwk?: (IToken)[];
  Rest?: (IToken)[];
  Ttl?: IToken[];
  DurationLiteral?: IToken[];
  Refresh?: IToken[];
  Drop?: IToken[];
  Identifier?: IToken[];
};

export interface AlterTableStatementCstNode extends CstNode {
  name: "alterTableStatement";
  children: AlterTableStatementCstChildren;
}

export type AlterTableStatementCstChildren = {
  Table: IToken[];
  qualifiedName?: QualifiedNameCstNode[];
  StringLiteral?: IToken[];
  alterTableAction: AlterTableActionCstNode[];
};

export interface AlterTableActionCstNode extends CstNode {
  name: "alterTableAction";
  children: AlterTableActionCstChildren;
}

export type AlterTableActionCstChildren = {
  Add?: (IToken)[];
  Column?: (IToken)[];
  If?: IToken[];
  Not?: IToken[];
  Exists?: IToken[];
  columnDefinition?: (ColumnDefinitionCstNode)[];
  Comma?: (IToken)[];
  Drop?: (IToken)[];
  identifier?: (IdentifierCstNode)[];
  Partition?: (IToken)[];
  List?: (IToken)[];
  StringLiteral?: (IToken)[];
  Where?: (IToken)[];
  expression?: (ExpressionCstNode)[];
  Rename?: IToken[];
  To?: IToken[];
  Alter?: IToken[];
  Type?: (IToken)[];
  dataType?: DataTypeCstNode[];
  Capacity?: (IToken)[];
  NumberLiteral?: (IToken)[];
  Cache?: (IToken)[];
  Nocache?: (IToken)[];
  Index?: (IToken)[];
  Symbol?: IToken[];
  Attach?: IToken[];
  Detach?: IToken[];
  Squash?: IToken[];
  Partitions?: IToken[];
  Set?: IToken[];
  Param?: IToken[];
  tableParam?: (TableParamCstNode)[];
  Ttl?: IToken[];
  DurationLiteral?: IToken[];
  timeUnit?: TimeUnitCstNode[];
  Bypass?: IToken[];
  Wal?: (IToken)[];
  Dedup?: IToken[];
  Disable?: IToken[];
  Enable?: IToken[];
  Upsert?: IToken[];
  Keys?: IToken[];
  LParen?: IToken[];
  RParen?: IToken[];
  Suspend?: IToken[];
  With?: IToken[];
  Resume?: IToken[];
  From?: IToken[];
  Txn?: IToken[];
  Transaction?: IToken[];
  Convert?: IToken[];
  convertPartitionTarget?: ConvertPartitionTargetCstNode[];
};

export interface ConvertPartitionTargetCstNode extends CstNode {
  name: "convertPartitionTarget";
  children: ConvertPartitionTargetCstChildren;
}

export type ConvertPartitionTargetCstChildren = {
  List?: IToken[];
  StringLiteral?: (IToken)[];
  Comma?: IToken[];
  To: IToken[];
  Table?: IToken[];
  identifier?: IdentifierCstNode[];
  Where?: IToken[];
  expression?: ExpressionCstNode[];
};

export interface AlterMaterializedViewStatementCstNode extends CstNode {
  name: "alterMaterializedViewStatement";
  children: AlterMaterializedViewStatementCstChildren;
}

export type AlterMaterializedViewStatementCstChildren = {
  Materialized: IToken[];
  View: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  alterMaterializedViewAction: AlterMaterializedViewActionCstNode[];
};

export interface AlterMaterializedViewActionCstNode extends CstNode {
  name: "alterMaterializedViewAction";
  children: AlterMaterializedViewActionCstChildren;
}

export type AlterMaterializedViewActionCstChildren = {
  Alter?: IToken[];
  Column?: IToken[];
  identifier?: IdentifierCstNode[];
  Add?: IToken[];
  Index?: (IToken)[];
  Capacity?: (IToken)[];
  NumberLiteral?: (IToken)[];
  Drop?: IToken[];
  Symbol?: IToken[];
  Set?: IToken[];
  Ttl?: IToken[];
  DurationLiteral?: (IToken)[];
  timeUnit?: (TimeUnitCstNode)[];
  Refresh?: IToken[];
  Limit?: IToken[];
  materializedViewRefresh?: MaterializedViewRefreshCstNode[];
  materializedViewPeriod?: MaterializedViewPeriodCstNode[];
  Resume?: IToken[];
  Wal?: (IToken)[];
  From?: IToken[];
  Transaction?: IToken[];
  Txn?: IToken[];
  Suspend?: IToken[];
};

export interface DropStatementCstNode extends CstNode {
  name: "dropStatement";
  children: DropStatementCstChildren;
}

export type DropStatementCstChildren = {
  Drop: IToken[];
  dropTableStatement?: DropTableStatementCstNode[];
  dropMaterializedViewStatement?: DropMaterializedViewStatementCstNode[];
  dropViewStatement?: DropViewStatementCstNode[];
  dropUserStatement?: DropUserStatementCstNode[];
  dropGroupStatement?: DropGroupStatementCstNode[];
  dropServiceAccountStatement?: DropServiceAccountStatementCstNode[];
};

export interface DropViewStatementCstNode extends CstNode {
  name: "dropViewStatement";
  children: DropViewStatementCstChildren;
}

export type DropViewStatementCstChildren = {
  View: IToken[];
  If?: IToken[];
  Exists?: IToken[];
  stringOrQualifiedName: StringOrQualifiedNameCstNode[];
};

export interface DropTableStatementCstNode extends CstNode {
  name: "dropTableStatement";
  children: DropTableStatementCstChildren;
}

export type DropTableStatementCstChildren = {
  All?: IToken[];
  Tables?: IToken[];
  Table?: IToken[];
  If?: IToken[];
  Exists?: IToken[];
  qualifiedName?: QualifiedNameCstNode[];
};

export interface DropMaterializedViewStatementCstNode extends CstNode {
  name: "dropMaterializedViewStatement";
  children: DropMaterializedViewStatementCstChildren;
}

export type DropMaterializedViewStatementCstChildren = {
  Materialized: IToken[];
  View: IToken[];
  If?: IToken[];
  Exists?: IToken[];
  stringOrQualifiedName: StringOrQualifiedNameCstNode[];
};

export interface DropUserStatementCstNode extends CstNode {
  name: "dropUserStatement";
  children: DropUserStatementCstChildren;
}

export type DropUserStatementCstChildren = {
  User: IToken[];
  If?: IToken[];
  Exists?: IToken[];
  qualifiedName: QualifiedNameCstNode[];
};

export interface DropGroupStatementCstNode extends CstNode {
  name: "dropGroupStatement";
  children: DropGroupStatementCstChildren;
}

export type DropGroupStatementCstChildren = {
  Group: IToken[];
  If?: IToken[];
  Exists?: IToken[];
  qualifiedName: QualifiedNameCstNode[];
};

export interface DropServiceAccountStatementCstNode extends CstNode {
  name: "dropServiceAccountStatement";
  children: DropServiceAccountStatementCstChildren;
}

export type DropServiceAccountStatementCstChildren = {
  Service: IToken[];
  Account: IToken[];
  If?: IToken[];
  Exists?: IToken[];
  qualifiedName: QualifiedNameCstNode[];
};

export interface TruncateTableStatementCstNode extends CstNode {
  name: "truncateTableStatement";
  children: TruncateTableStatementCstChildren;
}

export type TruncateTableStatementCstChildren = {
  Truncate: IToken[];
  Table: IToken[];
  If?: IToken[];
  Exists?: IToken[];
  qualifiedName: QualifiedNameCstNode[];
};

export interface RenameTableStatementCstNode extends CstNode {
  name: "renameTableStatement";
  children: RenameTableStatementCstChildren;
}

export type RenameTableStatementCstChildren = {
  Rename: IToken[];
  Table: IToken[];
  stringOrQualifiedName: (StringOrQualifiedNameCstNode)[];
  To: IToken[];
};

export interface AddUserStatementCstNode extends CstNode {
  name: "addUserStatement";
  children: AddUserStatementCstChildren;
}

export type AddUserStatementCstChildren = {
  Add: IToken[];
  User: IToken[];
  qualifiedName: (QualifiedNameCstNode)[];
  To: IToken[];
  Comma?: IToken[];
};

export interface RemoveUserStatementCstNode extends CstNode {
  name: "removeUserStatement";
  children: RemoveUserStatementCstChildren;
}

export type RemoveUserStatementCstChildren = {
  Remove: IToken[];
  User: IToken[];
  qualifiedName: (QualifiedNameCstNode)[];
  From: IToken[];
  Comma?: IToken[];
};

export interface AssumeServiceAccountStatementCstNode extends CstNode {
  name: "assumeServiceAccountStatement";
  children: AssumeServiceAccountStatementCstChildren;
}

export type AssumeServiceAccountStatementCstChildren = {
  Assume: IToken[];
  Service: IToken[];
  Account: IToken[];
  qualifiedName: QualifiedNameCstNode[];
};

export interface ExitServiceAccountStatementCstNode extends CstNode {
  name: "exitServiceAccountStatement";
  children: ExitServiceAccountStatementCstChildren;
}

export type ExitServiceAccountStatementCstChildren = {
  Exit: IToken[];
  Service: IToken[];
  Account: IToken[];
  qualifiedName?: QualifiedNameCstNode[];
};

export interface CancelQueryStatementCstNode extends CstNode {
  name: "cancelQueryStatement";
  children: CancelQueryStatementCstChildren;
}

export type CancelQueryStatementCstChildren = {
  Cancel: IToken[];
  Query: IToken[];
  NumberLiteral?: IToken[];
  Identifier?: IToken[];
  StringLiteral?: IToken[];
};

export interface ShowStatementCstNode extends CstNode {
  name: "showStatement";
  children: ShowStatementCstChildren;
}

export type ShowStatementCstChildren = {
  Show: IToken[];
  Tables?: IToken[];
  Columns?: IToken[];
  From?: (IToken)[];
  qualifiedName?: (QualifiedNameCstNode)[];
  Partitions?: IToken[];
  Create?: IToken[];
  Table?: IToken[];
  View?: (IToken)[];
  Materialized?: IToken[];
  Time?: IToken[];
  Zone?: IToken[];
  Transaction?: (IToken)[];
  Isolation?: IToken[];
  Level?: IToken[];
  Default?: IToken[];
  Identifier?: IToken[];
  Only?: IToken[];
  User?: IToken[];
  Users?: IToken[];
  Groups?: IToken[];
  Service?: IToken[];
  Account?: IToken[];
  Accounts?: IToken[];
  Permissions?: IToken[];
  ServerVersion?: IToken[];
  Parameters?: IToken[];
};

export interface ExplainStatementCstNode extends CstNode {
  name: "explainStatement";
  children: ExplainStatementCstChildren;
}

export type ExplainStatementCstChildren = {
  Explain: IToken[];
  LParen?: IToken[];
  Format?: IToken[];
  Identifier?: IToken[];
  RParen?: IToken[];
  statement: StatementCstNode[];
};

export interface CopyStatementCstNode extends CstNode {
  name: "copyStatement";
  children: CopyStatementCstChildren;
}

export type CopyStatementCstChildren = {
  Copy: IToken[];
  copyCancel?: CopyCancelCstNode[];
  copyFrom?: CopyFromCstNode[];
  copyTo?: CopyToCstNode[];
};

export interface CopyCancelCstNode extends CstNode {
  name: "copyCancel";
  children: CopyCancelCstChildren;
}

export type CopyCancelCstChildren = {
  NumberLiteral?: IToken[];
  Identifier?: IToken[];
  StringLiteral?: IToken[];
  Cancel: IToken[];
};

export interface CopyFromCstNode extends CstNode {
  name: "copyFrom";
  children: CopyFromCstChildren;
}

export type CopyFromCstChildren = {
  qualifiedName: QualifiedNameCstNode[];
  From: IToken[];
  stringOrIdentifier: StringOrIdentifierCstNode[];
  copyOptions?: CopyOptionsCstNode[];
};

export interface CopyToCstNode extends CstNode {
  name: "copyTo";
  children: CopyToCstChildren;
}

export type CopyToCstChildren = {
  LParen?: IToken[];
  selectStatement?: SelectStatementCstNode[];
  RParen?: IToken[];
  qualifiedName?: QualifiedNameCstNode[];
  To: IToken[];
  stringOrIdentifier: StringOrIdentifierCstNode[];
  copyOptions?: CopyOptionsCstNode[];
};

export interface CopyOptionsCstNode extends CstNode {
  name: "copyOptions";
  children: CopyOptionsCstChildren;
}

export type CopyOptionsCstChildren = {
  With: IToken[];
  copyOption: CopyOptionCstNode[];
};

export interface CopyOptionCstNode extends CstNode {
  name: "copyOption";
  children: CopyOptionCstChildren;
}

export type CopyOptionCstChildren = {
  Header?: IToken[];
  booleanLiteral?: (BooleanLiteralCstNode)[];
  Timestamp?: IToken[];
  stringOrIdentifier?: (StringOrIdentifierCstNode)[];
  Delimiter?: IToken[];
  Format?: IToken[];
  StringLiteral?: IToken[];
  identifier?: IdentifierCstNode[];
  Partition?: IToken[];
  By?: IToken[];
  PartitionBy?: IToken[];
  partitionPeriod?: PartitionPeriodCstNode[];
  On?: IToken[];
  Error?: IToken[];
  SkipRow?: IToken[];
  SkipColumn?: IToken[];
  Abort?: IToken[];
  CompressionCodec?: IToken[];
  Uncompressed?: IToken[];
  Snappy?: IToken[];
  Gzip?: IToken[];
  Lz4?: IToken[];
  Zstd?: IToken[];
  Lz4Raw?: IToken[];
  Brotli?: IToken[];
  Lzo?: IToken[];
  CompressionLevel?: IToken[];
  expression?: (ExpressionCstNode)[];
  RowGroupSize?: IToken[];
  DataPageSize?: IToken[];
  StatisticsEnabled?: IToken[];
  ParquetVersion?: IToken[];
  RawArrayEncoding?: IToken[];
};

export interface CheckpointStatementCstNode extends CstNode {
  name: "checkpointStatement";
  children: CheckpointStatementCstChildren;
}

export type CheckpointStatementCstChildren = {
  Checkpoint: IToken[];
  Create?: IToken[];
  Release?: IToken[];
};

export interface SnapshotStatementCstNode extends CstNode {
  name: "snapshotStatement";
  children: SnapshotStatementCstChildren;
}

export type SnapshotStatementCstChildren = {
  Snapshot: IToken[];
  Prepare?: IToken[];
  Complete?: IToken[];
};

export interface BackupStatementCstNode extends CstNode {
  name: "backupStatement";
  children: BackupStatementCstChildren;
}

export type BackupStatementCstChildren = {
  Backup: IToken[];
  Database?: IToken[];
  Table?: IToken[];
  qualifiedName?: QualifiedNameCstNode[];
  Abort?: IToken[];
};

export interface CompileViewStatementCstNode extends CstNode {
  name: "compileViewStatement";
  children: CompileViewStatementCstChildren;
}

export type CompileViewStatementCstChildren = {
  Compile: IToken[];
  View: IToken[];
  qualifiedName: QualifiedNameCstNode[];
};

export interface GrantStatementCstNode extends CstNode {
  name: "grantStatement";
  children: GrantStatementCstChildren;
}

export type GrantStatementCstChildren = {
  Grant: (IToken)[];
  permissionList: PermissionListCstNode[];
  On?: IToken[];
  All?: IToken[];
  Tables?: IToken[];
  grantTableTarget?: (GrantTableTargetCstNode)[];
  Comma?: IToken[];
  To: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  With?: (IToken)[];
  Option?: IToken[];
  Verification?: IToken[];
};

export interface RevokeStatementCstNode extends CstNode {
  name: "revokeStatement";
  children: RevokeStatementCstChildren;
}

export type RevokeStatementCstChildren = {
  Revoke: IToken[];
  permissionList: PermissionListCstNode[];
  On?: IToken[];
  All?: IToken[];
  Tables?: IToken[];
  grantTableTarget?: (GrantTableTargetCstNode)[];
  Comma?: IToken[];
  From: IToken[];
  qualifiedName: QualifiedNameCstNode[];
};

export interface PermissionListCstNode extends CstNode {
  name: "permissionList";
  children: PermissionListCstChildren;
}

export type PermissionListCstChildren = {
  permissionToken: (PermissionTokenCstNode)[];
  Comma?: IToken[];
};

export interface PermissionTokenCstNode extends CstNode {
  name: "permissionToken";
  children: PermissionTokenCstChildren;
}

export type PermissionTokenCstChildren = {
  identifier?: (IdentifierCstNode)[];
  Select?: IToken[];
  Insert?: IToken[];
  Update?: IToken[];
  Create?: IToken[];
  Drop?: IToken[];
  Alter?: IToken[];
  All?: IToken[];
  Grant?: IToken[];
  Revoke?: IToken[];
  Truncate?: IToken[];
  Copy?: IToken[];
  Show?: IToken[];
  Vacuum?: IToken[];
  Lock?: IToken[];
  Materialized?: IToken[];
  View?: IToken[];
  Service?: IToken[];
  Account?: IToken[];
  Table?: IToken[];
  Group?: IToken[];
};

export interface GrantTableTargetCstNode extends CstNode {
  name: "grantTableTarget";
  children: GrantTableTargetCstChildren;
}

export type GrantTableTargetCstChildren = {
  qualifiedName: QualifiedNameCstNode[];
  LParen?: IToken[];
  identifier?: (IdentifierCstNode)[];
  Comma?: IToken[];
  RParen?: IToken[];
};

export interface GrantAssumeServiceAccountStatementCstNode extends CstNode {
  name: "grantAssumeServiceAccountStatement";
  children: GrantAssumeServiceAccountStatementCstChildren;
}

export type GrantAssumeServiceAccountStatementCstChildren = {
  Grant: (IToken)[];
  Assume: IToken[];
  Service: IToken[];
  Account: IToken[];
  qualifiedName: (QualifiedNameCstNode)[];
  To: IToken[];
  With?: IToken[];
  Option?: IToken[];
};

export interface RevokeAssumeServiceAccountStatementCstNode extends CstNode {
  name: "revokeAssumeServiceAccountStatement";
  children: RevokeAssumeServiceAccountStatementCstChildren;
}

export type RevokeAssumeServiceAccountStatementCstChildren = {
  Revoke: IToken[];
  Assume: IToken[];
  Service: IToken[];
  Account: IToken[];
  qualifiedName: (QualifiedNameCstNode)[];
  From: IToken[];
};

export interface VacuumTableStatementCstNode extends CstNode {
  name: "vacuumTableStatement";
  children: VacuumTableStatementCstChildren;
}

export type VacuumTableStatementCstChildren = {
  Vacuum: IToken[];
  Table: IToken[];
  qualifiedName: QualifiedNameCstNode[];
};

export interface ResumeWalStatementCstNode extends CstNode {
  name: "resumeWalStatement";
  children: ResumeWalStatementCstChildren;
}

export type ResumeWalStatementCstChildren = {
  Resume: IToken[];
  Wal: IToken[];
  From?: IToken[];
  Transaction?: IToken[];
  Txn?: IToken[];
  NumberLiteral?: IToken[];
  Identifier?: IToken[];
};

export interface SetTypeStatementCstNode extends CstNode {
  name: "setTypeStatement";
  children: SetTypeStatementCstChildren;
}

export type SetTypeStatementCstChildren = {
  Set: IToken[];
  Type: IToken[];
  Bypass?: IToken[];
  Wal: IToken[];
};

export interface ReindexTableStatementCstNode extends CstNode {
  name: "reindexTableStatement";
  children: ReindexTableStatementCstChildren;
}

export type ReindexTableStatementCstChildren = {
  Reindex: IToken[];
  Table: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  Column?: IToken[];
  identifier?: (IdentifierCstNode)[];
  Comma?: (IToken)[];
  Partition?: IToken[];
  stringOrIdentifier?: (StringOrIdentifierCstNode)[];
  Lock?: IToken[];
  Exclusive?: IToken[];
};

export interface RefreshMaterializedViewStatementCstNode extends CstNode {
  name: "refreshMaterializedViewStatement";
  children: RefreshMaterializedViewStatementCstChildren;
}

export type RefreshMaterializedViewStatementCstChildren = {
  Refresh: IToken[];
  Materialized: IToken[];
  View: IToken[];
  qualifiedName: QualifiedNameCstNode[];
  Full?: IToken[];
  Incremental?: IToken[];
  Range?: IToken[];
  From?: IToken[];
  stringOrIdentifier?: (StringOrIdentifierCstNode)[];
  To?: IToken[];
};

export interface PivotStatementCstNode extends CstNode {
  name: "pivotStatement";
  children: PivotStatementCstChildren;
}

export type PivotStatementCstChildren = {
  LParen: (IToken)[];
  selectStatement?: SelectStatementCstNode[];
  RParen: (IToken)[];
  qualifiedName?: QualifiedNameCstNode[];
  whereClause?: WhereClauseCstNode[];
  Pivot: IToken[];
  pivotBody: PivotBodyCstNode[];
  As?: IToken[];
  identifier?: IdentifierCstNode[];
  orderByClause?: OrderByClauseCstNode[];
  limitClause?: LimitClauseCstNode[];
};

export interface PivotBodyCstNode extends CstNode {
  name: "pivotBody";
  children: PivotBodyCstChildren;
}

export type PivotBodyCstChildren = {
  pivotAggregation: (PivotAggregationCstNode)[];
  Comma?: (IToken)[];
  For: (IToken)[];
  pivotForClause: (PivotForClauseCstNode)[];
  Group?: IToken[];
  By?: IToken[];
  expression?: (ExpressionCstNode)[];
};

export interface PivotAggregationCstNode extends CstNode {
  name: "pivotAggregation";
  children: PivotAggregationCstChildren;
}

export type PivotAggregationCstChildren = {
  expression: ExpressionCstNode[];
  As?: IToken[];
  identifier?: IdentifierCstNode[];
};

export interface PivotForClauseCstNode extends CstNode {
  name: "pivotForClause";
  children: PivotForClauseCstChildren;
}

export type PivotForClauseCstChildren = {
  columnRef: ColumnRefCstNode[];
  In: IToken[];
  LParen: IToken[];
  expression?: (ExpressionCstNode)[];
  Comma?: IToken[];
  selectStatement?: SelectStatementCstNode[];
  RParen: IToken[];
};

export interface ExpressionCstNode extends CstNode {
  name: "expression";
  children: ExpressionCstChildren;
}

export type ExpressionCstChildren = {
  orExpression: OrExpressionCstNode[];
};

export interface OrExpressionCstNode extends CstNode {
  name: "orExpression";
  children: OrExpressionCstChildren;
}

export type OrExpressionCstChildren = {
  andExpression: (AndExpressionCstNode)[];
  Or?: IToken[];
};

export interface AndExpressionCstNode extends CstNode {
  name: "andExpression";
  children: AndExpressionCstChildren;
}

export type AndExpressionCstChildren = {
  notExpression: (NotExpressionCstNode)[];
  And?: IToken[];
};

export interface NotExpressionCstNode extends CstNode {
  name: "notExpression";
  children: NotExpressionCstChildren;
}

export type NotExpressionCstChildren = {
  Not?: IToken[];
  equalityExpression: EqualityExpressionCstNode[];
};

export interface EqualityExpressionCstNode extends CstNode {
  name: "equalityExpression";
  children: EqualityExpressionCstChildren;
}

export type EqualityExpressionCstChildren = {
  relationalExpression: (RelationalExpressionCstNode)[];
  Equals?: IToken[];
  NotEquals?: IToken[];
  Like?: IToken[];
  Ilike?: IToken[];
  RegexMatch?: IToken[];
  RegexNotMatch?: IToken[];
  RegexNotEquals?: IToken[];
};

export interface RelationalExpressionCstNode extends CstNode {
  name: "relationalExpression";
  children: RelationalExpressionCstChildren;
}

export type RelationalExpressionCstChildren = {
  setExpression: (SetExpressionCstNode)[];
  LessThan?: IToken[];
  LessThanOrEqual?: IToken[];
  GreaterThan?: IToken[];
  GreaterThanOrEqual?: IToken[];
  Is?: IToken[];
  Not?: IToken[];
  Null?: IToken[];
};

export interface SetExpressionCstNode extends CstNode {
  name: "setExpression";
  children: SetExpressionCstChildren;
}

export type SetExpressionCstChildren = {
  bitOrExpression: BitOrExpressionCstNode[];
  Not?: (IToken)[];
  In?: IToken[];
  LParen?: (IToken)[];
  expression?: (ExpressionCstNode)[];
  Comma?: (IToken)[];
  RParen?: (IToken)[];
  Between?: IToken[];
  betweenLow?: BitOrExpressionCstNode[];
  And?: IToken[];
  betweenHigh?: BitOrExpressionCstNode[];
  Within?: IToken[];
};

export interface BitOrExpressionCstNode extends CstNode {
  name: "bitOrExpression";
  children: BitOrExpressionCstChildren;
}

export type BitOrExpressionCstChildren = {
  bitXorExpression: (BitXorExpressionCstNode)[];
  BitOr?: IToken[];
};

export interface BitXorExpressionCstNode extends CstNode {
  name: "bitXorExpression";
  children: BitXorExpressionCstChildren;
}

export type BitXorExpressionCstChildren = {
  bitAndExpression: (BitAndExpressionCstNode)[];
  BitXor?: IToken[];
};

export interface BitAndExpressionCstNode extends CstNode {
  name: "bitAndExpression";
  children: BitAndExpressionCstChildren;
}

export type BitAndExpressionCstChildren = {
  concatExpression: (ConcatExpressionCstNode)[];
  BitAnd?: IToken[];
};

export interface ConcatExpressionCstNode extends CstNode {
  name: "concatExpression";
  children: ConcatExpressionCstChildren;
}

export type ConcatExpressionCstChildren = {
  additiveExpression: (AdditiveExpressionCstNode)[];
  Concat?: IToken[];
};

export interface AdditiveExpressionCstNode extends CstNode {
  name: "additiveExpression";
  children: AdditiveExpressionCstChildren;
}

export type AdditiveExpressionCstChildren = {
  multiplicativeExpression: (MultiplicativeExpressionCstNode)[];
  Plus?: IToken[];
  Minus?: IToken[];
};

export interface MultiplicativeExpressionCstNode extends CstNode {
  name: "multiplicativeExpression";
  children: MultiplicativeExpressionCstChildren;
}

export type MultiplicativeExpressionCstChildren = {
  unaryExpression: (UnaryExpressionCstNode)[];
  Star?: IToken[];
  Divide?: IToken[];
  Modulo?: IToken[];
};

export interface UnaryExpressionCstNode extends CstNode {
  name: "unaryExpression";
  children: UnaryExpressionCstChildren;
}

export type UnaryExpressionCstChildren = {
  Minus?: IToken[];
  RegexMatch?: IToken[];
  typeCastExpression: TypeCastExpressionCstNode[];
};

export interface TypeCastExpressionCstNode extends CstNode {
  name: "typeCastExpression";
  children: TypeCastExpressionCstChildren;
}

export type TypeCastExpressionCstChildren = {
  primaryExpression: PrimaryExpressionCstNode[];
  LBracket?: IToken[];
  arraySubscript?: (ArraySubscriptCstNode)[];
  Comma?: IToken[];
  RBracket?: IToken[];
  DoubleColon?: IToken[];
  dataType?: DataTypeCstNode[];
};

export interface ArraySubscriptCstNode extends CstNode {
  name: "arraySubscript";
  children: ArraySubscriptCstChildren;
}

export type ArraySubscriptCstChildren = {
  Colon?: (IToken)[];
  expression?: (ExpressionCstNode)[];
};

export interface PrimaryExpressionCstNode extends CstNode {
  name: "primaryExpression";
  children: PrimaryExpressionCstChildren;
}

export type PrimaryExpressionCstChildren = {
  castExpression?: CastExpressionCstNode[];
  caseExpression?: CaseExpressionCstNode[];
  arrayLiteral?: ArrayLiteralCstNode[];
  functionCall?: FunctionCallCstNode[];
  literal?: LiteralCstNode[];
  VariableReference?: IToken[];
  identifierExpression?: IdentifierExpressionCstNode[];
  LParen?: IToken[];
  selectStatement?: SelectStatementCstNode[];
  expression?: (ExpressionCstNode)[];
  Comma?: IToken[];
  RParen?: IToken[];
};

export interface ArrayLiteralCstNode extends CstNode {
  name: "arrayLiteral";
  children: ArrayLiteralCstChildren;
}

export type ArrayLiteralCstChildren = {
  Identifier: IToken[];
  arrayBracketBody: ArrayBracketBodyCstNode[];
};

export interface ArrayBracketBodyCstNode extends CstNode {
  name: "arrayBracketBody";
  children: ArrayBracketBodyCstChildren;
}

export type ArrayBracketBodyCstChildren = {
  LBracket: IToken[];
  arrayElement?: (ArrayElementCstNode)[];
  Comma?: IToken[];
  RBracket: IToken[];
};

export interface ArrayElementCstNode extends CstNode {
  name: "arrayElement";
  children: ArrayElementCstChildren;
}

export type ArrayElementCstChildren = {
  arrayBracketBody?: ArrayBracketBodyCstNode[];
  expression?: ExpressionCstNode[];
};

export interface CastExpressionCstNode extends CstNode {
  name: "castExpression";
  children: CastExpressionCstChildren;
}

export type CastExpressionCstChildren = {
  Cast: IToken[];
  LParen: IToken[];
  expression: ExpressionCstNode[];
  As: IToken[];
  dataType: DataTypeCstNode[];
  RParen: IToken[];
};

export interface DataTypeCstNode extends CstNode {
  name: "dataType";
  children: DataTypeCstChildren;
}

export type DataTypeCstChildren = {
  Symbol?: IToken[];
  Timestamp?: IToken[];
  Date?: IToken[];
  Int?: IToken[];
  Integer?: IToken[];
  Long?: IToken[];
  Long128?: IToken[];
  Long256?: IToken[];
  Short?: IToken[];
  Byte?: IToken[];
  Float?: IToken[];
  Double?: IToken[];
  Boolean?: IToken[];
  String?: IToken[];
  Char?: IToken[];
  Binary?: IToken[];
  Uuid?: IToken[];
  Ipv4?: IToken[];
  Geohash?: IToken[];
  LParen?: (IToken)[];
  NumberLiteral?: (IToken)[];
  identifier?: IdentifierCstNode[];
  RParen?: (IToken)[];
  Varchar?: IToken[];
  Decimal?: IToken[];
  Comma?: IToken[];
  Interval?: IToken[];
  TimestampNs?: IToken[];
  Identifier?: IToken[];
  LBracket?: IToken[];
  RBracket?: IToken[];
};

export interface CaseExpressionCstNode extends CstNode {
  name: "caseExpression";
  children: CaseExpressionCstChildren;
}

export type CaseExpressionCstChildren = {
  Case: IToken[];
  expression: (ExpressionCstNode)[];
  When: IToken[];
  Then: IToken[];
  Else?: IToken[];
  End: IToken[];
};

export interface FunctionNameCstNode extends CstNode {
  name: "functionName";
  children: FunctionNameCstChildren;
}

export type FunctionNameCstChildren = {
  identifier?: IdentifierCstNode[];
  Left?: IToken[];
  Right?: IToken[];
};

export interface FunctionCallCstNode extends CstNode {
  name: "functionCall";
  children: FunctionCallCstChildren;
}

export type FunctionCallCstChildren = {
  functionName: FunctionNameCstNode[];
  LParen: IToken[];
  Star?: IToken[];
  Distinct?: IToken[];
  expression?: (ExpressionCstNode)[];
  Comma?: IToken[];
  From?: IToken[];
  RParen: IToken[];
  Ignore?: IToken[];
  Nulls?: IToken[];
  overClause?: OverClauseCstNode[];
};

export interface IdentifierExpressionCstNode extends CstNode {
  name: "identifierExpression";
  children: IdentifierExpressionCstChildren;
}

export type IdentifierExpressionCstChildren = {
  qualifiedName: QualifiedNameCstNode[];
  LParen?: IToken[];
  selectStatement?: SelectStatementCstNode[];
  Star?: IToken[];
  Distinct?: IToken[];
  expression?: (ExpressionCstNode)[];
  Comma?: IToken[];
  From?: IToken[];
  RParen?: IToken[];
  Ignore?: IToken[];
  Nulls?: IToken[];
  overClause?: OverClauseCstNode[];
};

export interface OverClauseCstNode extends CstNode {
  name: "overClause";
  children: OverClauseCstChildren;
}

export type OverClauseCstChildren = {
  Over: IToken[];
  LParen?: IToken[];
  windowPartitionByClause?: WindowPartitionByClauseCstNode[];
  orderByClause?: OrderByClauseCstNode[];
  windowFrameClause?: WindowFrameClauseCstNode[];
  RParen?: IToken[];
  identifier?: IdentifierCstNode[];
};

export interface WindowPartitionByClauseCstNode extends CstNode {
  name: "windowPartitionByClause";
  children: WindowPartitionByClauseCstChildren;
}

export type WindowPartitionByClauseCstChildren = {
  Partition: IToken[];
  By: IToken[];
  expression: (ExpressionCstNode)[];
  Comma?: IToken[];
};

export interface WindowFrameClauseCstNode extends CstNode {
  name: "windowFrameClause";
  children: WindowFrameClauseCstChildren;
}

export type WindowFrameClauseCstChildren = {
  Rows?: IToken[];
  Range?: IToken[];
  Groups?: (IToken)[];
  Cumulative?: IToken[];
  Between?: IToken[];
  windowFrameBound?: (WindowFrameBoundCstNode)[];
  And?: IToken[];
  Exclude?: IToken[];
  Current?: IToken[];
  Row?: IToken[];
  No?: IToken[];
  Others?: IToken[];
};

export interface WindowFrameBoundCstNode extends CstNode {
  name: "windowFrameBound";
  children: WindowFrameBoundCstChildren;
}

export type WindowFrameBoundCstChildren = {
  Unbounded?: IToken[];
  Preceding?: (IToken)[];
  Following?: (IToken)[];
  Current?: IToken[];
  Row?: IToken[];
  durationExpression?: DurationExpressionCstNode[];
  expression?: ExpressionCstNode[];
};

export interface WindowDefinitionClauseCstNode extends CstNode {
  name: "windowDefinitionClause";
  children: WindowDefinitionClauseCstChildren;
}

export type WindowDefinitionClauseCstChildren = {
  Window: IToken[];
  identifier: IdentifierCstNode[];
  As: IToken[];
  LParen: IToken[];
  windowPartitionByClause?: WindowPartitionByClauseCstNode[];
  orderByClause?: OrderByClauseCstNode[];
  windowFrameClause?: WindowFrameClauseCstNode[];
  RParen: IToken[];
};

export interface LiteralCstNode extends CstNode {
  name: "literal";
  children: LiteralCstChildren;
}

export type LiteralCstChildren = {
  NumberLiteral?: IToken[];
  StringLiteral?: IToken[];
  True?: IToken[];
  False?: IToken[];
  Null?: IToken[];
  LongLiteral?: IToken[];
  DecimalLiteral?: IToken[];
  DurationLiteral?: IToken[];
  GeohashLiteral?: IToken[];
  GeohashBinaryLiteral?: IToken[];
  Nan?: IToken[];
};

export interface BooleanLiteralCstNode extends CstNode {
  name: "booleanLiteral";
  children: BooleanLiteralCstChildren;
}

export type BooleanLiteralCstChildren = {
  True?: IToken[];
  False?: IToken[];
};

export interface StringOrIdentifierCstNode extends CstNode {
  name: "stringOrIdentifier";
  children: StringOrIdentifierCstChildren;
}

export type StringOrIdentifierCstChildren = {
  StringLiteral?: IToken[];
  identifier?: IdentifierCstNode[];
};

export interface StringOrQualifiedNameCstNode extends CstNode {
  name: "stringOrQualifiedName";
  children: StringOrQualifiedNameCstChildren;
}

export type StringOrQualifiedNameCstChildren = {
  StringLiteral?: IToken[];
  qualifiedName?: QualifiedNameCstNode[];
};

export interface IntervalValueCstNode extends CstNode {
  name: "intervalValue";
  children: IntervalValueCstChildren;
}

export type IntervalValueCstChildren = {
  DurationLiteral?: IToken[];
  LongLiteral?: IToken[];
  NumberLiteral?: IToken[];
  StringLiteral?: IToken[];
  identifier?: IdentifierCstNode[];
};

export interface TimeZoneValueCstNode extends CstNode {
  name: "timeZoneValue";
  children: TimeZoneValueCstChildren;
}

export type TimeZoneValueCstChildren = {
  StringLiteral?: IToken[];
  identifier?: IdentifierCstNode[];
};

export interface ColumnRefCstNode extends CstNode {
  name: "columnRef";
  children: ColumnRefCstChildren;
}

export type ColumnRefCstChildren = {
  qualifiedName: QualifiedNameCstNode[];
};

export interface QualifiedNameCstNode extends CstNode {
  name: "qualifiedName";
  children: QualifiedNameCstChildren;
}

export type QualifiedNameCstChildren = {
  identifier: (IdentifierCstNode)[];
  Dot?: IToken[];
};

export interface IdentifierCstNode extends CstNode {
  name: "identifier";
  children: IdentifierCstChildren;
}

export type IdentifierCstChildren = {
  Identifier?: IToken[];
  QuotedIdentifier?: IToken[];
  IdentifierKeyword?: IToken[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
  statements(children: StatementsCstChildren, param?: IN): OUT;
  statement(children: StatementCstChildren, param?: IN): OUT;
  selectStatement(children: SelectStatementCstChildren, param?: IN): OUT;
  withClause(children: WithClauseCstChildren, param?: IN): OUT;
  cteDefinition(children: CteDefinitionCstChildren, param?: IN): OUT;
  simpleSelect(children: SimpleSelectCstChildren, param?: IN): OUT;
  setOperation(children: SetOperationCstChildren, param?: IN): OUT;
  selectList(children: SelectListCstChildren, param?: IN): OUT;
  selectItem(children: SelectItemCstChildren, param?: IN): OUT;
  qualifiedStar(children: QualifiedStarCstChildren, param?: IN): OUT;
  fromClause(children: FromClauseCstChildren, param?: IN): OUT;
  implicitSelectBody(children: ImplicitSelectBodyCstChildren, param?: IN): OUT;
  implicitSelectStatement(children: ImplicitSelectStatementCstChildren, param?: IN): OUT;
  tableRef(children: TableRefCstChildren, param?: IN): OUT;
  tableFunctionCall(children: TableFunctionCallCstChildren, param?: IN): OUT;
  tableFunctionName(children: TableFunctionNameCstChildren, param?: IN): OUT;
  joinClause(children: JoinClauseCstChildren, param?: IN): OUT;
  windowJoinBound(children: WindowJoinBoundCstChildren, param?: IN): OUT;
  durationExpression(children: DurationExpressionCstChildren, param?: IN): OUT;
  whereClause(children: WhereClauseCstChildren, param?: IN): OUT;
  sampleByClause(children: SampleByClauseCstChildren, param?: IN): OUT;
  latestOnClause(children: LatestOnClauseCstChildren, param?: IN): OUT;
  fillClause(children: FillClauseCstChildren, param?: IN): OUT;
  fillValue(children: FillValueCstChildren, param?: IN): OUT;
  alignToClause(children: AlignToClauseCstChildren, param?: IN): OUT;
  fromToClause(children: FromToClauseCstChildren, param?: IN): OUT;
  groupByClause(children: GroupByClauseCstChildren, param?: IN): OUT;
  orderByClause(children: OrderByClauseCstChildren, param?: IN): OUT;
  orderByItem(children: OrderByItemCstChildren, param?: IN): OUT;
  limitClause(children: LimitClauseCstChildren, param?: IN): OUT;
  insertStatement(children: InsertStatementCstChildren, param?: IN): OUT;
  valuesClause(children: ValuesClauseCstChildren, param?: IN): OUT;
  valuesList(children: ValuesListCstChildren, param?: IN): OUT;
  updateStatement(children: UpdateStatementCstChildren, param?: IN): OUT;
  setClause(children: SetClauseCstChildren, param?: IN): OUT;
  declareClause(children: DeclareClauseCstChildren, param?: IN): OUT;
  declareAssignment(children: DeclareAssignmentCstChildren, param?: IN): OUT;
  createStatement(children: CreateStatementCstChildren, param?: IN): OUT;
  createViewBody(children: CreateViewBodyCstChildren, param?: IN): OUT;
  createTableBody(children: CreateTableBodyCstChildren, param?: IN): OUT;
  batchClause(children: BatchClauseCstChildren, param?: IN): OUT;
  dedupClause(children: DedupClauseCstChildren, param?: IN): OUT;
  createUserStatement(children: CreateUserStatementCstChildren, param?: IN): OUT;
  createGroupStatement(children: CreateGroupStatementCstChildren, param?: IN): OUT;
  createServiceAccountStatement(children: CreateServiceAccountStatementCstChildren, param?: IN): OUT;
  createMaterializedViewBody(children: CreateMaterializedViewBodyCstChildren, param?: IN): OUT;
  materializedViewRefresh(children: MaterializedViewRefreshCstChildren, param?: IN): OUT;
  materializedViewPeriod(children: MaterializedViewPeriodCstChildren, param?: IN): OUT;
  materializedViewPartition(children: MaterializedViewPartitionCstChildren, param?: IN): OUT;
  columnDefinition(children: ColumnDefinitionCstChildren, param?: IN): OUT;
  castDefinition(children: CastDefinitionCstChildren, param?: IN): OUT;
  indexDefinition(children: IndexDefinitionCstChildren, param?: IN): OUT;
  tableParamName(children: TableParamNameCstChildren, param?: IN): OUT;
  tableParam(children: TableParamCstChildren, param?: IN): OUT;
  partitionPeriod(children: PartitionPeriodCstChildren, param?: IN): OUT;
  timeUnit(children: TimeUnitCstChildren, param?: IN): OUT;
  alterStatement(children: AlterStatementCstChildren, param?: IN): OUT;
  alterGroupStatement(children: AlterGroupStatementCstChildren, param?: IN): OUT;
  alterViewStatement(children: AlterViewStatementCstChildren, param?: IN): OUT;
  alterUserStatement(children: AlterUserStatementCstChildren, param?: IN): OUT;
  alterServiceAccountStatement(children: AlterServiceAccountStatementCstChildren, param?: IN): OUT;
  alterUserAction(children: AlterUserActionCstChildren, param?: IN): OUT;
  alterTableStatement(children: AlterTableStatementCstChildren, param?: IN): OUT;
  alterTableAction(children: AlterTableActionCstChildren, param?: IN): OUT;
  convertPartitionTarget(children: ConvertPartitionTargetCstChildren, param?: IN): OUT;
  alterMaterializedViewStatement(children: AlterMaterializedViewStatementCstChildren, param?: IN): OUT;
  alterMaterializedViewAction(children: AlterMaterializedViewActionCstChildren, param?: IN): OUT;
  dropStatement(children: DropStatementCstChildren, param?: IN): OUT;
  dropViewStatement(children: DropViewStatementCstChildren, param?: IN): OUT;
  dropTableStatement(children: DropTableStatementCstChildren, param?: IN): OUT;
  dropMaterializedViewStatement(children: DropMaterializedViewStatementCstChildren, param?: IN): OUT;
  dropUserStatement(children: DropUserStatementCstChildren, param?: IN): OUT;
  dropGroupStatement(children: DropGroupStatementCstChildren, param?: IN): OUT;
  dropServiceAccountStatement(children: DropServiceAccountStatementCstChildren, param?: IN): OUT;
  truncateTableStatement(children: TruncateTableStatementCstChildren, param?: IN): OUT;
  renameTableStatement(children: RenameTableStatementCstChildren, param?: IN): OUT;
  addUserStatement(children: AddUserStatementCstChildren, param?: IN): OUT;
  removeUserStatement(children: RemoveUserStatementCstChildren, param?: IN): OUT;
  assumeServiceAccountStatement(children: AssumeServiceAccountStatementCstChildren, param?: IN): OUT;
  exitServiceAccountStatement(children: ExitServiceAccountStatementCstChildren, param?: IN): OUT;
  cancelQueryStatement(children: CancelQueryStatementCstChildren, param?: IN): OUT;
  showStatement(children: ShowStatementCstChildren, param?: IN): OUT;
  explainStatement(children: ExplainStatementCstChildren, param?: IN): OUT;
  copyStatement(children: CopyStatementCstChildren, param?: IN): OUT;
  copyCancel(children: CopyCancelCstChildren, param?: IN): OUT;
  copyFrom(children: CopyFromCstChildren, param?: IN): OUT;
  copyTo(children: CopyToCstChildren, param?: IN): OUT;
  copyOptions(children: CopyOptionsCstChildren, param?: IN): OUT;
  copyOption(children: CopyOptionCstChildren, param?: IN): OUT;
  checkpointStatement(children: CheckpointStatementCstChildren, param?: IN): OUT;
  snapshotStatement(children: SnapshotStatementCstChildren, param?: IN): OUT;
  backupStatement(children: BackupStatementCstChildren, param?: IN): OUT;
  compileViewStatement(children: CompileViewStatementCstChildren, param?: IN): OUT;
  grantStatement(children: GrantStatementCstChildren, param?: IN): OUT;
  revokeStatement(children: RevokeStatementCstChildren, param?: IN): OUT;
  permissionList(children: PermissionListCstChildren, param?: IN): OUT;
  permissionToken(children: PermissionTokenCstChildren, param?: IN): OUT;
  grantTableTarget(children: GrantTableTargetCstChildren, param?: IN): OUT;
  grantAssumeServiceAccountStatement(children: GrantAssumeServiceAccountStatementCstChildren, param?: IN): OUT;
  revokeAssumeServiceAccountStatement(children: RevokeAssumeServiceAccountStatementCstChildren, param?: IN): OUT;
  vacuumTableStatement(children: VacuumTableStatementCstChildren, param?: IN): OUT;
  resumeWalStatement(children: ResumeWalStatementCstChildren, param?: IN): OUT;
  setTypeStatement(children: SetTypeStatementCstChildren, param?: IN): OUT;
  reindexTableStatement(children: ReindexTableStatementCstChildren, param?: IN): OUT;
  refreshMaterializedViewStatement(children: RefreshMaterializedViewStatementCstChildren, param?: IN): OUT;
  pivotStatement(children: PivotStatementCstChildren, param?: IN): OUT;
  pivotBody(children: PivotBodyCstChildren, param?: IN): OUT;
  pivotAggregation(children: PivotAggregationCstChildren, param?: IN): OUT;
  pivotForClause(children: PivotForClauseCstChildren, param?: IN): OUT;
  expression(children: ExpressionCstChildren, param?: IN): OUT;
  orExpression(children: OrExpressionCstChildren, param?: IN): OUT;
  andExpression(children: AndExpressionCstChildren, param?: IN): OUT;
  notExpression(children: NotExpressionCstChildren, param?: IN): OUT;
  equalityExpression(children: EqualityExpressionCstChildren, param?: IN): OUT;
  relationalExpression(children: RelationalExpressionCstChildren, param?: IN): OUT;
  setExpression(children: SetExpressionCstChildren, param?: IN): OUT;
  bitOrExpression(children: BitOrExpressionCstChildren, param?: IN): OUT;
  bitXorExpression(children: BitXorExpressionCstChildren, param?: IN): OUT;
  bitAndExpression(children: BitAndExpressionCstChildren, param?: IN): OUT;
  concatExpression(children: ConcatExpressionCstChildren, param?: IN): OUT;
  additiveExpression(children: AdditiveExpressionCstChildren, param?: IN): OUT;
  multiplicativeExpression(children: MultiplicativeExpressionCstChildren, param?: IN): OUT;
  unaryExpression(children: UnaryExpressionCstChildren, param?: IN): OUT;
  typeCastExpression(children: TypeCastExpressionCstChildren, param?: IN): OUT;
  arraySubscript(children: ArraySubscriptCstChildren, param?: IN): OUT;
  primaryExpression(children: PrimaryExpressionCstChildren, param?: IN): OUT;
  arrayLiteral(children: ArrayLiteralCstChildren, param?: IN): OUT;
  arrayBracketBody(children: ArrayBracketBodyCstChildren, param?: IN): OUT;
  arrayElement(children: ArrayElementCstChildren, param?: IN): OUT;
  castExpression(children: CastExpressionCstChildren, param?: IN): OUT;
  dataType(children: DataTypeCstChildren, param?: IN): OUT;
  caseExpression(children: CaseExpressionCstChildren, param?: IN): OUT;
  functionName(children: FunctionNameCstChildren, param?: IN): OUT;
  functionCall(children: FunctionCallCstChildren, param?: IN): OUT;
  identifierExpression(children: IdentifierExpressionCstChildren, param?: IN): OUT;
  overClause(children: OverClauseCstChildren, param?: IN): OUT;
  windowPartitionByClause(children: WindowPartitionByClauseCstChildren, param?: IN): OUT;
  windowFrameClause(children: WindowFrameClauseCstChildren, param?: IN): OUT;
  windowFrameBound(children: WindowFrameBoundCstChildren, param?: IN): OUT;
  windowDefinitionClause(children: WindowDefinitionClauseCstChildren, param?: IN): OUT;
  literal(children: LiteralCstChildren, param?: IN): OUT;
  booleanLiteral(children: BooleanLiteralCstChildren, param?: IN): OUT;
  stringOrIdentifier(children: StringOrIdentifierCstChildren, param?: IN): OUT;
  stringOrQualifiedName(children: StringOrQualifiedNameCstChildren, param?: IN): OUT;
  intervalValue(children: IntervalValueCstChildren, param?: IN): OUT;
  timeZoneValue(children: TimeZoneValueCstChildren, param?: IN): OUT;
  columnRef(children: ColumnRefCstChildren, param?: IN): OUT;
  qualifiedName(children: QualifiedNameCstChildren, param?: IN): OUT;
  identifier(children: IdentifierCstChildren, param?: IN): OUT;
}
