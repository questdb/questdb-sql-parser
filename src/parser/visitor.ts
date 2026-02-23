// =============================================================================
// CST to AST Visitor
// =============================================================================

import { CstNode, CstElement, IToken } from "chevrotain"

/** A record of CstElement arrays — matches both CstChildren types and CstNode.children */
type CstChildrenRecord = Record<string, CstElement[] | undefined>

import { parser } from "./parser"
import * as AST from "./ast"
import type {
  AddUserStatementCstChildren,
  AdditiveExpressionCstChildren,
  AlignToClauseCstChildren,
  AlterGroupStatementCstChildren,
  AlterMaterializedViewActionCstChildren,
  AlterMaterializedViewStatementCstChildren,
  AlterServiceAccountStatementCstChildren,
  AlterStatementCstChildren,
  AlterTableActionCstChildren,
  AlterTableStatementCstChildren,
  AlterUserActionCstChildren,
  AlterUserStatementCstChildren,
  AlterViewStatementCstChildren,
  AndExpressionCstChildren,
  ArrayBracketBodyCstChildren,
  ArrayElementCstChildren,
  ArrayLiteralCstChildren,
  ArraySubscriptCstChildren,
  AsofLtJoinCstChildren,
  AssumeServiceAccountStatementCstChildren,
  BackupStatementCstChildren,
  BatchClauseCstChildren,
  BitAndExpressionCstChildren,
  BitOrExpressionCstChildren,
  BitXorExpressionCstChildren,
  BooleanLiteralCstChildren,
  CancelQueryStatementCstChildren,
  CaseExpressionCstChildren,
  CastDefinitionCstChildren,
  CastExpressionCstChildren,
  CheckpointStatementCstChildren,
  ColumnDefinitionCstChildren,
  ColumnRefCstChildren,
  CompileViewStatementCstChildren,
  ConcatExpressionCstChildren,
  Ipv4ContainmentExpressionCstChildren,
  ConvertPartitionTargetCstChildren,
  CopyCancelCstChildren,
  CopyFromCstChildren,
  CopyOptionCstChildren,
  CopyOptionsCstChildren,
  CopyStatementCstChildren,
  CopyToCstChildren,
  CreateGroupStatementCstChildren,
  CreateMaterializedViewBodyCstChildren,
  CreateServiceAccountStatementCstChildren,
  CreateStatementCstChildren,
  CreateTableBodyCstChildren,
  CreateUserStatementCstChildren,
  CreateViewBodyCstChildren,
  CteDefinitionCstChildren,
  DataTypeCstChildren,
  DeclareAssignmentCstChildren,
  DeclareClauseCstChildren,
  DedupClauseCstChildren,
  DropGroupStatementCstChildren,
  DropMaterializedViewStatementCstChildren,
  DropServiceAccountStatementCstChildren,
  DropStatementCstChildren,
  DropTableStatementCstChildren,
  DropUserStatementCstChildren,
  DropViewStatementCstChildren,
  DurationExpressionCstChildren,
  EqualityExpressionCstChildren,
  ExitServiceAccountStatementCstChildren,
  ExplainStatementCstChildren,
  ExpressionCstChildren,
  FillClauseCstChildren,
  FillValueCstChildren,
  FromClauseCstChildren,
  FromToClauseCstChildren,
  FunctionCallCstChildren,
  FunctionNameCstChildren,
  GrantAssumeServiceAccountStatementCstChildren,
  GrantStatementCstChildren,
  GrantTableTargetCstChildren,
  GroupByClauseCstChildren,
  IdentifierCstChildren,
  IdentifierCstNode,
  IdentifierExpressionCstChildren,
  ImplicitSelectBodyCstChildren,
  ImplicitSelectStatementCstChildren,
  IndexDefinitionCstChildren,
  InsertStatementCstChildren,
  IntervalValueCstChildren,
  JoinClauseCstChildren,
  LatestOnClauseCstChildren,
  LimitClauseCstChildren,
  LiteralCstChildren,
  MaterializedViewPartitionCstChildren,
  MaterializedViewPeriodCstChildren,
  MaterializedViewRefreshCstChildren,
  MultiplicativeExpressionCstChildren,
  NotExpressionCstChildren,
  OrExpressionCstChildren,
  OrderByClauseCstChildren,
  OrderByItemCstChildren,
  OverClauseCstChildren,
  PartitionPeriodCstChildren,
  PermissionListCstChildren,
  PermissionTokenCstChildren,
  PivotAggregationCstChildren,
  PivotBodyCstChildren,
  PivotForClauseCstChildren,
  PivotInValueCstChildren,
  PivotStatementCstChildren,
  PrimaryExpressionCstChildren,
  QualifiedNameCstChildren,
  QualifiedStarCstChildren,
  ReindexTableStatementCstChildren,
  RefreshMaterializedViewStatementCstChildren,
  RelationalExpressionCstChildren,
  RemoveUserStatementCstChildren,
  RenameTableStatementCstChildren,
  ResumeWalStatementCstChildren,
  RevokeAssumeServiceAccountStatementCstChildren,
  RevokeStatementCstChildren,
  SampleByClauseCstChildren,
  SelectItemCstChildren,
  SelectListCstChildren,
  SelectStatementCstChildren,
  SetClauseCstChildren,
  SetExpressionCstChildren,
  SetOperationCstChildren,
  SetTypeStatementCstChildren,
  ShowStatementCstChildren,
  SimpleSelectCstChildren,
  SnapshotStatementCstChildren,
  SpliceJoinCstChildren,
  StandardJoinCstChildren,
  StatementCstChildren,
  StatementsCstChildren,
  StringOrIdentifierCstChildren,
  StringOrQualifiedNameCstChildren,
  TableFunctionCallCstChildren,
  TableFunctionNameCstChildren,
  TableNameCstChildren,
  TableNameOrStringCstChildren,
  TableParamCstChildren,
  TableParamNameCstChildren,
  TableRefCstChildren,
  TimeUnitCstChildren,
  TimeZoneValueCstChildren,
  TruncateTableStatementCstChildren,
  TypeCastExpressionCstChildren,
  UnaryExpressionCstChildren,
  UpdateStatementCstChildren,
  VacuumTableStatementCstChildren,
  ValuesClauseCstChildren,
  ValuesListCstChildren,
  WhereClauseCstChildren,
  WindowFrameBoundCstChildren,
  WindowFrameClauseCstChildren,
  WindowJoinBoundCstChildren,
  WindowJoinCstChildren,
  WindowPartitionByClauseCstChildren,
  WithClauseCstChildren,
  WithStatementCstChildren,
} from "./cst-types"

type FromToClauseResult = { from?: AST.Expression; to?: AST.Expression }
type BatchClauseResult = { size: number; o3MaxLag?: string }
type ConvertPartitionTargetResult = {
  partitions?: string[]
  target: string
  where?: AST.Expression
}
type PivotBodyResult = {
  aggregations: AST.PivotAggregation[]
  pivots: AST.PivotForClause[]
  groupBy?: AST.Expression[]
}

// Get the base visitor class from the parser
const BaseVisitor = parser.getBaseCstVisitorConstructor()

class QuestDBVisitor extends BaseVisitor {
  constructor() {
    super()
    this.validateVisitor()
  }

  // Helper to extract token image
  private tokenImage(token: IToken | undefined): string {
    return token?.image ?? ""
  }

  // ==========================================================================
  // Entry Points
  // ==========================================================================

  statements(ctx: StatementsCstChildren): AST.Statement[] {
    if (!ctx.statement) return []
    return ctx.statement.map((s: CstNode) => this.visit(s) as AST.Statement)
  }

  statement(ctx: StatementCstChildren): AST.Statement {
    if (ctx.withStatement) {
      return this.visit(ctx.withStatement) as AST.Statement
    }
    if (ctx.selectStatement) {
      return this.visit(ctx.selectStatement) as AST.SelectStatement
    }
    if (ctx.insertStatement) {
      return this.visit(ctx.insertStatement) as AST.InsertStatement
    }
    if (ctx.updateStatement) {
      return this.visit(ctx.updateStatement) as AST.UpdateStatement
    }
    if (ctx.createStatement) {
      return this.visit(ctx.createStatement) as AST.Statement
    }
    if (ctx.dropStatement) {
      return this.visit(ctx.dropStatement) as AST.Statement
    }
    if (ctx.truncateTableStatement) {
      return this.visit(
        ctx.truncateTableStatement,
      ) as AST.TruncateTableStatement
    }
    if (ctx.renameTableStatement) {
      return this.visit(ctx.renameTableStatement) as AST.RenameTableStatement
    }
    if (ctx.addUserStatement) {
      return this.visit(ctx.addUserStatement) as AST.AddUserStatement
    }
    if (ctx.removeUserStatement) {
      return this.visit(ctx.removeUserStatement) as AST.RemoveUserStatement
    }
    if (ctx.assumeServiceAccountStatement) {
      return this.visit(
        ctx.assumeServiceAccountStatement,
      ) as AST.AssumeServiceAccountStatement
    }
    if (ctx.exitServiceAccountStatement) {
      return this.visit(
        ctx.exitServiceAccountStatement,
      ) as AST.ExitServiceAccountStatement
    }
    if (ctx.cancelQueryStatement) {
      return this.visit(ctx.cancelQueryStatement) as AST.CancelQueryStatement
    }
    if (ctx.showStatement) {
      return this.visit(ctx.showStatement) as AST.ShowStatement
    }
    if (ctx.explainStatement) {
      return this.visit(ctx.explainStatement) as AST.ExplainStatement
    }
    if (ctx.alterStatement) {
      return this.visit(ctx.alterStatement) as AST.Statement
    }
    if (ctx.copyStatement) {
      return this.visit(ctx.copyStatement) as AST.CopyStatement
    }
    if (ctx.checkpointStatement) {
      return this.visit(ctx.checkpointStatement) as AST.CheckpointStatement
    }
    if (ctx.snapshotStatement) {
      return this.visit(ctx.snapshotStatement) as AST.SnapshotStatement
    }
    if (ctx.grantStatement) {
      return this.visit(ctx.grantStatement) as AST.GrantStatement
    }
    if (ctx.revokeStatement) {
      return this.visit(ctx.revokeStatement) as AST.RevokeStatement
    }
    if (ctx.grantAssumeServiceAccountStatement) {
      return this.visit(
        ctx.grantAssumeServiceAccountStatement,
      ) as AST.GrantAssumeServiceAccountStatement
    }
    if (ctx.revokeAssumeServiceAccountStatement) {
      return this.visit(
        ctx.revokeAssumeServiceAccountStatement,
      ) as AST.RevokeAssumeServiceAccountStatement
    }
    if (ctx.vacuumTableStatement) {
      return this.visit(ctx.vacuumTableStatement) as AST.VacuumTableStatement
    }
    if (ctx.resumeWalStatement) {
      return this.visit(ctx.resumeWalStatement) as AST.ResumeWalStatement
    }
    if (ctx.setTypeStatement) {
      return this.visit(ctx.setTypeStatement) as AST.SetTypeStatement
    }
    if (ctx.reindexTableStatement) {
      return this.visit(ctx.reindexTableStatement) as AST.ReindexTableStatement
    }
    if (ctx.refreshMaterializedViewStatement) {
      return this.visit(
        ctx.refreshMaterializedViewStatement,
      ) as AST.RefreshMaterializedViewStatement
    }
    if (ctx.pivotStatement) {
      return this.visit(ctx.pivotStatement) as AST.PivotStatement
    }
    if (ctx.backupStatement) {
      return this.visit(ctx.backupStatement) as AST.BackupStatement
    }
    if (ctx.compileViewStatement) {
      return this.visit(ctx.compileViewStatement) as AST.CompileViewStatement
    }
    if (ctx.implicitSelectStatement) {
      return this.visit(ctx.implicitSelectStatement) as AST.SelectStatement
    }
    throw new Error("Unknown statement type")
  }

  // ==========================================================================
  // WITH Statement (WITH ... SELECT/INSERT/UPDATE)
  // ==========================================================================

  withStatement(ctx: WithStatementCstChildren): AST.Statement {
    const ctes = this.visit(ctx.withClause) as AST.CTE[]

    let inner: AST.InsertStatement | AST.UpdateStatement | AST.SelectStatement
    if (ctx.insertStatement) {
      inner = this.visit(ctx.insertStatement) as AST.InsertStatement
    } else if (ctx.updateStatement) {
      inner = this.visit(ctx.updateStatement) as AST.UpdateStatement
    } else if (ctx.selectStatement) {
      inner = this.visit(ctx.selectStatement) as AST.SelectStatement
    } else {
      throw new Error("withStatement: expected insert, update, or select")
    }

    inner.with = ctes
    return inner
  }

  // ==========================================================================
  // SELECT Statement
  // ==========================================================================

  selectStatement(ctx: SelectStatementCstChildren): AST.SelectStatement {
    const result = this.visit(ctx.simpleSelect) as AST.SelectStatement

    if (ctx.declareClause) {
      result.declare = this.visit(ctx.declareClause) as AST.DeclareClause
    }

    if (ctx.withClause) {
      result.with = this.visit(ctx.withClause) as AST.CTE[]
    }

    if (ctx.setOperation && ctx.setOperation.length > 0) {
      result.setOperations = ctx.setOperation.map(
        (op: CstNode) => this.visit(op) as AST.SetOperation,
      )
    }

    return result
  }

  withClause(ctx: WithClauseCstChildren): AST.CTE[] {
    return ctx.cteDefinition.map((cte: CstNode) => this.visit(cte) as AST.CTE)
  }

  cteDefinition(ctx: CteDefinitionCstChildren): AST.CTE {
    const query = ctx.selectStatement
      ? (this.visit(ctx.selectStatement) as AST.SelectStatement)
      : (this.visit(ctx.implicitSelectStatement!) as AST.SelectStatement)
    return {
      type: "cte",
      name: this.extractIdentifierName(ctx.identifier[0].children),
      query,
    }
  }

  simpleSelect(ctx: SimpleSelectCstChildren): AST.SelectStatement {
    const result: AST.SelectStatement = {
      type: "select",
      columns: this.visit(ctx.selectList) as AST.SelectItem[],
    }

    if (ctx.Distinct) {
      result.distinct = true
    }

    if (ctx.fromClause) {
      result.from = this.visit(ctx.fromClause) as AST.TableRef[]
    }

    if (ctx.whereClause) {
      result.where = this.visit(ctx.whereClause) as AST.Expression
    }

    if (ctx.sampleByClause) {
      result.sampleBy = this.visit(ctx.sampleByClause) as AST.SampleByClause
    }

    if (ctx.latestOnClause) {
      result.latestOn = this.visit(ctx.latestOnClause) as AST.LatestOnClause
    }

    if (ctx.groupByClause) {
      result.groupBy = this.visit(ctx.groupByClause) as AST.Expression[]
    }

    if (ctx.pivotBody) {
      const body = this.visit(ctx.pivotBody) as PivotBodyResult
      result.pivot = {
        type: "pivotClause",
        aggregations: body.aggregations,
        pivots: body.pivots,
        groupBy: body.groupBy,
      }
    }

    if (ctx.orderByClause) {
      result.orderBy = this.visit(ctx.orderByClause) as AST.OrderByItem[]
    }

    if (ctx.limitClause) {
      result.limit = this.visit(ctx.limitClause) as AST.LimitClause
    }

    return result
  }

  setOperation(ctx: SetOperationCstChildren): AST.SetOperation {
    let operator: "UNION" | "EXCEPT" | "INTERSECT" = "UNION"
    if (ctx.Union) operator = "UNION"
    else if (ctx.Except) operator = "EXCEPT"
    else if (ctx.Intersect) operator = "INTERSECT"

    const select = ctx.simpleSelect
      ? (this.visit(ctx.simpleSelect) as AST.SelectStatement)
      : (this.visit(ctx.implicitSelectBody!) as AST.SelectStatement)

    const result: AST.SetOperation = {
      type: "setOperation",
      operator,
      select,
    }

    if (ctx.All) {
      result.all = true
    }

    return result
  }

  selectList(ctx: SelectListCstChildren): AST.SelectItem[] {
    if (ctx.Star) {
      const items: AST.SelectItem[] = [{ type: "star" }]
      // Additional items after *: SELECT *, rank() OVER () ...
      if (ctx.selectItem) {
        for (const item of ctx.selectItem) {
          items.push(this.visit(item) as AST.SelectItem)
        }
      }
      return items
    }
    const items: AST.SelectItem[] = []
    if (ctx.selectItem) {
      for (const item of ctx.selectItem) {
        items.push(this.visit(item) as AST.SelectItem)
      }
    }
    return items
  }

  selectItem(ctx: SelectItemCstChildren): AST.SelectItem {
    if (ctx.qualifiedStar) {
      const result: AST.QualifiedStarSelectItem = {
        type: "qualifiedStar",
        qualifier: this.visit(ctx.qualifiedStar) as AST.QualifiedName,
      }
      if (ctx.identifier) {
        result.alias = (
          this.visit(ctx.identifier) as AST.QualifiedName
        ).parts[0]
      }
      return result
    }

    // Bare * appearing as a non-first select item (e.g., SELECT amount, *)
    if (ctx.Star) {
      return { type: "star" }
    }

    const result: AST.ExpressionSelectItem = {
      type: "selectItem",
      expression: this.visit(ctx.expression!) as AST.Expression,
    }

    if (ctx.identifier) {
      result.alias = (this.visit(ctx.identifier) as AST.QualifiedName).parts[0]
    }

    return result
  }

  qualifiedStar(ctx: QualifiedStarCstChildren): AST.QualifiedName {
    const parts: string[] = ctx.identifier.map((id: CstNode) =>
      this.extractIdentifierName(id.children),
    )
    return {
      type: "qualifiedName",
      parts,
    }
  }

  // ==========================================================================
  // FROM Clause
  // ==========================================================================

  fromClause(ctx: FromClauseCstChildren): AST.TableRef[] {
    const tables: AST.TableRef[] = []

    if (ctx.tableRef) {
      // Handle all table refs (first one and any comma-separated ones)
      for (let i = 0; i < ctx.tableRef.length; i++) {
        const table = this.visit(ctx.tableRef[i]) as AST.TableRef
        tables.push(table)
      }

      // Attach joins to the first table (legacy behavior)
      if (ctx.joinClause && tables.length > 0) {
        tables[0].joins = ctx.joinClause.map(
          (j: CstNode) => this.visit(j) as AST.JoinClause,
        )
      }
    }

    return tables
  }

  implicitSelectBody(ctx: ImplicitSelectBodyCstChildren): AST.SelectStatement {
    const result: AST.SelectStatement = {
      type: "select",
      implicit: true,
      columns: [{ type: "star" } as AST.SelectItem],
    }
    if (ctx.fromClause) {
      result.from = this.visitSafe(ctx.fromClause) as AST.TableRef[]
    }
    if (ctx.whereClause) {
      result.where = this.visitSafe(ctx.whereClause) as AST.Expression
    }
    if (ctx.sampleByClause) {
      result.sampleBy = this.visitSafe(ctx.sampleByClause) as AST.SampleByClause
    }
    if (ctx.latestOnClause) {
      result.latestOn = this.visitSafe(ctx.latestOnClause) as AST.LatestOnClause
    }
    if (ctx.groupByClause) {
      result.groupBy = this.visitSafe(ctx.groupByClause) as AST.Expression[]
    }
    if (ctx.orderByClause) {
      result.orderBy = this.visitSafe(ctx.orderByClause) as AST.OrderByItem[]
    }
    if (ctx.limitClause) {
      result.limit = this.visitSafe(ctx.limitClause) as AST.LimitClause
    }
    return result
  }

  implicitSelectStatement(
    ctx: ImplicitSelectStatementCstChildren,
  ): AST.SelectStatement {
    const result = this.visit(ctx.implicitSelectBody) as AST.SelectStatement
    if (ctx.setOperation && ctx.setOperation.length > 0) {
      result.setOperations = ctx.setOperation.map(
        (op: CstNode) => this.visit(op) as AST.SetOperation,
      )
    }
    return result
  }

  tableRef(ctx: TableRefCstChildren): AST.TableRef {
    let table: AST.TableRef["table"]
    if (ctx.selectStatement) {
      table = this.visit(ctx.selectStatement) as AST.SelectStatement
    } else if (ctx.showStatement) {
      table = this.visit(ctx.showStatement) as AST.ShowStatement
    } else if (ctx.implicitSelectStatement) {
      table = this.visit(ctx.implicitSelectStatement) as AST.SelectStatement
    } else if (ctx.tableFunctionCall) {
      table = this.visit(ctx.tableFunctionCall) as AST.TableFunctionCall
    } else if (ctx.VariableReference) {
      // @variable as table source (DECLARE variable reference)
      const varImage = ctx.VariableReference[0].image // e.g. "@subquery"
      table = { type: "qualifiedName", parts: [varImage] } as AST.QualifiedName
    } else if (ctx.StringLiteral) {
      // Single-quoted table name: FROM 'sys.copy_export_log'
      table = {
        type: "qualifiedName",
        parts: [ctx.StringLiteral[0].image.slice(1, -1)],
      } as AST.QualifiedName
    } else {
      table = this.visit(ctx.tableName!) as AST.QualifiedName
    }

    const result: AST.TableRef = {
      type: "tableRef",
      table,
    }

    if (ctx.identifier) {
      result.alias = (this.visit(ctx.identifier) as AST.QualifiedName).parts[0]
    }

    if (ctx.columnRef) {
      const colRef = this.visit(ctx.columnRef) as AST.ColumnRef
      result.timestampDesignation = colRef.name.parts.join(".")
    }

    return result
  }

  tableFunctionCall(ctx: TableFunctionCallCstChildren): AST.TableFunctionCall {
    let name: string
    if (ctx.tableFunctionName) {
      const fnName = ctx.tableFunctionName[0]
      if (fnName.children?.identifier) {
        const id = this.visit(fnName.children.identifier) as AST.QualifiedName
        name = id.parts.join(".")
      } else {
        name = "unknown"
      }
    } else {
      name = "unknown"
    }

    const args: AST.Expression[] = []
    if (ctx.expression) {
      for (const expr of ctx.expression) {
        args.push(this.visit(expr) as AST.Expression)
      }
    }

    return {
      type: "tableFunctionCall",
      name,
      args,
    }
  }

  tableFunctionName(_ctx: TableFunctionNameCstChildren): string | undefined {
    // Handled inline by tableFunctionCall
    return undefined
  }

  joinClause(ctx: JoinClauseCstChildren): AST.JoinClause {
    if (ctx.asofLtJoin) return this.visit(ctx.asofLtJoin) as AST.JoinClause
    if (ctx.spliceJoin) return this.visit(ctx.spliceJoin) as AST.JoinClause
    if (ctx.windowJoin) return this.visit(ctx.windowJoin) as AST.JoinClause
    return this.visit(ctx.standardJoin!) as AST.JoinClause
  }

  asofLtJoin(ctx: AsofLtJoinCstChildren): AST.JoinClause {
    const result: AST.JoinClause = {
      type: "join",
      table: this.visit(ctx.tableRef) as AST.TableRef,
    }
    if (ctx.Asof) result.joinType = "asof"
    else if (ctx.Lt) result.joinType = "lt"
    if (ctx.expression) {
      result.on = this.visit(ctx.expression) as AST.Expression
    }
    if (ctx.DurationLiteral) {
      result.tolerance = ctx.DurationLiteral[0].image
    }
    return result
  }

  spliceJoin(ctx: SpliceJoinCstChildren): AST.JoinClause {
    const result: AST.JoinClause = {
      type: "join",
      joinType: "splice",
      table: this.visit(ctx.tableRef) as AST.TableRef,
    }
    if (ctx.expression) {
      result.on = this.visit(ctx.expression) as AST.Expression
    }
    return result
  }

  windowJoin(ctx: WindowJoinCstChildren): AST.JoinClause {
    const result: AST.JoinClause = {
      type: "join",
      table: this.visit(ctx.tableRef) as AST.TableRef,
    }
    if (ctx.Window) result.joinType = "window"
    if (ctx.expression) {
      result.on = this.visit(ctx.expression) as AST.Expression
    }
    if (ctx.windowJoinBound && ctx.windowJoinBound.length >= 2) {
      result.range = {
        start: this.visit(ctx.windowJoinBound[0]) as AST.WindowJoinBound,
        end: this.visit(ctx.windowJoinBound[1]) as AST.WindowJoinBound,
      }
    }
    if (ctx.Include || ctx.Exclude) {
      result.prevailing = ctx.Include ? "include" : "exclude"
    }
    return result
  }

  standardJoin(ctx: StandardJoinCstChildren): AST.JoinClause {
    const result: AST.JoinClause = {
      type: "join",
      table: this.visit(ctx.tableRef) as AST.TableRef,
    }
    if (ctx.Inner) result.joinType = "inner"
    else if (ctx.Left) result.joinType = "left"
    else if (ctx.Right) result.joinType = "right"
    else if (ctx.Full) result.joinType = "full"
    else if (ctx.Cross) result.joinType = "cross"
    if (ctx.Outer) result.outer = true
    if (ctx.expression) {
      result.on = this.visit(ctx.expression) as AST.Expression
    }
    return result
  }

  windowJoinBound(ctx: WindowJoinBoundCstChildren): AST.WindowJoinBound {
    const result: AST.WindowJoinBound = {
      type: "windowJoinBound",
      boundType: ctx.Current ? "currentRow" : "duration",
    }
    if (ctx.Preceding) {
      result.direction = "preceding"
    } else if (ctx.Following) {
      result.direction = "following"
    }
    if (ctx.durationExpression) {
      result.duration = this.visit(ctx.durationExpression) as string
    }
    return result
  }

  durationExpression(ctx: DurationExpressionCstChildren): string {
    if (ctx.DurationLiteral) {
      return ctx.DurationLiteral[0].image
    }
    // NumberLiteral/StringLiteral + timeUnit
    const num =
      ctx.NumberLiteral?.[0]?.image ?? ctx.StringLiteral?.[0]?.image ?? "0"
    const unit = this.visit(ctx.timeUnit!) as string
    return `${num} ${unit}`
  }

  // ==========================================================================
  // WHERE Clause
  // ==========================================================================

  whereClause(ctx: WhereClauseCstChildren): AST.Expression {
    return this.visit(ctx.expression) as AST.Expression
  }

  // ==========================================================================
  // QuestDB-specific Clauses
  // ==========================================================================

  sampleByClause(ctx: SampleByClauseCstChildren): AST.SampleByClause {
    const result: AST.SampleByClause = {
      type: "sampleBy",
      duration: ctx.DurationLiteral
        ? this.tokenImage(ctx.DurationLiteral[0])
        : this.tokenImage(ctx.VariableReference![0]),
    }
    if (ctx.fillClause) {
      result.fill = this.visit(ctx.fillClause) as string[]
    }
    if (ctx.alignToClause) {
      result.alignTo = this.visit(ctx.alignToClause) as AST.AlignToClause
    }
    if (ctx.fromToClause) {
      const fromTo = this.visit(ctx.fromToClause) as FromToClauseResult
      result.from = fromTo.from
      result.to = fromTo.to
    }
    return result
  }

  fillClause(ctx: FillClauseCstChildren): string[] {
    return ctx.fillValue.map((v: CstNode) => this.visit(v) as string)
  }

  fillValue(ctx: FillValueCstChildren): string {
    if (ctx.Null) return "NULL"
    if (ctx.NumberLiteral) return this.tokenImage(ctx.NumberLiteral[0])
    if (ctx.identifier) {
      const name = this.extractIdentifierName(ctx.identifier[0].children)
      return name.toUpperCase()
    }
    return ""
  }

  alignToClause(ctx: AlignToClauseCstChildren): AST.AlignToClause {
    const result: AST.AlignToClause = {
      type: "alignTo",
      mode: ctx.Calendar ? "calendar" : "firstObservation",
    }
    if (ctx.Zone && ctx.timeZoneValue) {
      result.timeZone = this.extractMaybeString(ctx.timeZoneValue[0])
    }
    if (ctx.Offset && ctx.stringOrIdentifier) {
      result.offset = this.extractMaybeString(ctx.stringOrIdentifier[0])
    }
    return result
  }

  fromToClause(ctx: FromToClauseCstChildren): {
    from?: AST.Expression
    to?: AST.Expression
  } {
    const expressions =
      ctx.expression?.map((e: CstNode) => this.visit(e) as AST.Expression) ?? []
    if (ctx.From) {
      return { from: expressions[0], to: expressions[1] }
    }
    return { to: expressions[0] }
  }

  latestOnClause(ctx: LatestOnClauseCstChildren): AST.LatestOnClause {
    const columnRefs = ctx.columnRef!.map(
      (c: CstNode) => this.visit(c) as AST.ColumnRef,
    )

    if (ctx.On) {
      // LATEST ON timestamp PARTITION BY col1, col2, ...
      return {
        type: "latestOn",
        timestamp: columnRefs[0].name,
        partitionBy: columnRefs.slice(1).map((c: AST.ColumnRef) => c.name),
      }
    }
    // LATEST BY col1, col2, ...
    return {
      type: "latestOn",
      partitionBy: columnRefs.map((c: AST.ColumnRef) => c.name),
    }
  }

  // ==========================================================================
  // GROUP BY, HAVING, ORDER BY, LIMIT
  // ==========================================================================

  groupByClause(ctx: GroupByClauseCstChildren): AST.Expression[] {
    return ctx.expression.map((e: CstNode) => this.visit(e) as AST.Expression)
  }

  orderByClause(ctx: OrderByClauseCstChildren): AST.OrderByItem[] {
    return ctx.orderByItem.map(
      (item: CstNode) => this.visit(item) as AST.OrderByItem,
    )
  }

  orderByItem(ctx: OrderByItemCstChildren): AST.OrderByItem {
    const result: AST.OrderByItem = {
      type: "orderByItem",
      expression: this.visit(ctx.expression) as AST.Expression,
    }

    if (ctx.Asc) result.direction = "asc"
    else if (ctx.Desc) result.direction = "desc"

    return result
  }

  limitClause(ctx: LimitClauseCstChildren): AST.LimitClause {
    const expressions = ctx.expression.map(
      (e: CstNode) => this.visit(e) as AST.Expression,
    )

    const result: AST.LimitClause = {
      type: "limit",
      lowerBound: expressions[0],
    }

    if (expressions.length > 1) {
      result.upperBound = expressions[1]
    }

    return result
  }

  // ==========================================================================
  // INSERT Statement
  // ==========================================================================

  insertStatement(ctx: InsertStatementCstChildren): AST.InsertStatement {
    const result: AST.InsertStatement = {
      type: "insert",
      table: this.visit(ctx.tableNameOrString) as AST.QualifiedName,
    }

    if (ctx.Atomic) {
      result.atomic = true
    }
    if (ctx.batchClause) {
      result.batch = this.visit(ctx.batchClause[0]) as BatchClauseResult
    }

    if (ctx.identifier) {
      result.columns = ctx.identifier.map((id: CstNode) => {
        const name = this.visit(id) as AST.QualifiedName
        return name.parts[0]
      })
    }

    if (ctx.valuesClause) {
      result.values = this.visit(ctx.valuesClause) as AST.Expression[][]
    }

    if (ctx.selectStatement) {
      result.select = this.visit(ctx.selectStatement[0]) as AST.SelectStatement
    }

    return result
  }

  valuesClause(ctx: ValuesClauseCstChildren): AST.Expression[][] {
    return ctx.valuesList.map((v: CstNode) => this.visit(v) as AST.Expression[])
  }

  valuesList(ctx: ValuesListCstChildren): AST.Expression[] {
    return ctx.expression.map((e: CstNode) => this.visit(e) as AST.Expression)
  }

  batchClause(ctx: BatchClauseCstChildren): {
    size: number
    o3MaxLag?: string
  } {
    const o3MaxLag =
      ctx.DurationLiteral?.[0]?.image ??
      (ctx.StringLiteral?.[0]?.image
        ? ctx.StringLiteral[0].image.slice(1, -1)
        : undefined)
    return {
      size: parseInt(ctx.NumberLiteral[0].image, 10),
      o3MaxLag,
    }
  }

  // ==========================================================================
  // UPDATE Statement
  // ==========================================================================

  updateStatement(ctx: UpdateStatementCstChildren): AST.UpdateStatement {
    const result: AST.UpdateStatement = {
      type: "update",
      table: this.visit(ctx.tableName) as AST.QualifiedName,
      set: ctx.setClause.map((s: CstNode) => this.visit(s) as AST.SetClause),
    }

    if (ctx.identifier) {
      result.alias = this.extractIdentifierName(ctx.identifier[0].children)
    }

    if (ctx.tableRef) {
      result.from = this.visit(ctx.tableRef) as AST.TableRef
    }
    if (ctx.joinClause) {
      result.joins = ctx.joinClause.map(
        (j: CstNode) => this.visit(j) as AST.JoinClause,
      )
    }

    if (ctx.whereClause) {
      result.where = this.visit(ctx.whereClause) as AST.Expression
    }

    return result
  }

  setClause(ctx: SetClauseCstChildren): AST.SetClause {
    const colRef = this.visit(ctx.columnRef) as AST.ColumnRef
    const parts = colRef.name.parts
    return {
      type: "setClause",
      column: parts[parts.length - 1],
      value: this.visit(ctx.expression) as AST.Expression,
    }
  }

  // ==========================================================================
  // DECLARE Statement
  // ==========================================================================

  declareClause(ctx: DeclareClauseCstChildren): AST.DeclareClause {
    return {
      type: "declareClause",
      assignments: ctx.declareAssignment.map(
        (a: CstNode) => this.visit(a) as AST.DeclareAssignment,
      ),
    }
  }

  declareAssignment(ctx: DeclareAssignmentCstChildren): AST.DeclareAssignment {
    const image = ctx.VariableReference[0].image // e.g. "@limit"
    const result: AST.DeclareAssignment = {
      type: "declareAssignment",
      name: image.substring(1), // strip leading @
      value: this.visit(ctx.expression) as AST.Expression,
    }
    if (ctx.Overridable) result.overridable = true
    return result
  }

  // ==========================================================================
  // CREATE Statement
  // ==========================================================================

  createStatement(ctx: CreateStatementCstChildren): AST.Statement {
    if (ctx.createTableBody) {
      return this.visit(ctx.createTableBody) as AST.CreateTableStatement
    }
    if (ctx.createMaterializedViewBody) {
      return this.visit(
        ctx.createMaterializedViewBody,
      ) as AST.CreateMaterializedViewStatement
    }
    if (ctx.createViewBody) {
      return this.visit(ctx.createViewBody) as AST.CreateViewStatement
    }
    if (ctx.createUserStatement) {
      return this.visit(ctx.createUserStatement) as AST.CreateUserStatement
    }
    if (ctx.createGroupStatement) {
      return this.visit(ctx.createGroupStatement) as AST.CreateGroupStatement
    }
    if (ctx.createServiceAccountStatement) {
      return this.visit(
        ctx.createServiceAccountStatement,
      ) as AST.CreateServiceAccountStatement
    }
    throw new Error("Unknown create statement type")
  }

  // ==========================================================================
  // CREATE TABLE Statement
  // ==========================================================================

  createTableBody(ctx: CreateTableBodyCstChildren): AST.CreateTableStatement {
    const table = this.visit(ctx.stringOrQualifiedName) as AST.QualifiedName
    const result: AST.CreateTableStatement = {
      type: "createTable",
      table,
    }

    if (ctx.Atomic) {
      result.atomic = true
    }
    if (ctx.batchClause) {
      result.batch = this.visit(ctx.batchClause[0]) as BatchClauseResult
    }

    if (ctx.If) {
      result.ifNotExists = true
    }

    if (ctx.columnDefinition) {
      result.columns = ctx.columnDefinition.map(
        (c: CstNode) => this.visit(c) as AST.ColumnDefinition,
      )
    }

    if (ctx.Like && ctx.tableName) {
      result.like = this.visit(ctx.tableName[0]) as AST.QualifiedName
    }

    if (ctx.selectStatement) {
      result.asSelect = this.visit(
        ctx.selectStatement[0],
      ) as AST.SelectStatement
    }

    if (ctx.castDefinition) {
      result.casts = ctx.castDefinition.map(
        (c: CstNode) => this.visit(c) as AST.CastDefinition,
      )
    }
    if (ctx.indexDefinition) {
      result.indexes = ctx.indexDefinition.map(
        (i: CstNode) => this.visit(i) as AST.IndexDefinition,
      )
    }

    // Timestamp - the identifier after TIMESTAMP keyword
    if (ctx.Timestamp && ctx.columnRef && ctx.columnRef.length > 0) {
      result.timestamp = (
        this.visit(ctx.columnRef[0]) as AST.ColumnRef
      ).name.parts.join(".")
    }

    if (ctx.partitionPeriod) {
      result.partitionBy = this.visit(ctx.partitionPeriod) as
        | "NONE"
        | "HOUR"
        | "DAY"
        | "WEEK"
        | "MONTH"
        | "YEAR"
    }

    if (ctx.Bypass) {
      result.bypassWal = true
    } else if (ctx.Wal) {
      result.wal = true
    }

    if (ctx.Ttl && (ctx.NumberLiteral || ctx.DurationLiteral)) {
      result.ttl = this.extractTtl(ctx)
    }

    if (ctx.tableParam) {
      result.withParams = ctx.tableParam.map(
        (p: CstNode) => this.visit(p) as AST.TableParam,
      )
    }
    if (ctx.Volume) {
      const volumeOffset = ctx.Volume[0].startOffset
      const volumeStr = ctx.StringLiteral?.find(
        (t: IToken) => t.startOffset > volumeOffset,
      )
      result.volume = volumeStr
        ? volumeStr.image.slice(1, -1)
        : ctx.identifier?.length
          ? this.extractIdentifierName(
              ctx.identifier[ctx.identifier.length - 1].children,
            )
          : undefined
    }
    if (ctx.Owned && ctx.stringOrIdentifier) {
      result.ownedBy = this.visit(ctx.stringOrIdentifier) as string
    }

    if (ctx.dedupClause) {
      result.dedupKeys = this.visit(ctx.dedupClause) as string[]
    }

    return result
  }

  columnDefinition(ctx: ColumnDefinitionCstChildren): AST.ColumnDefinition {
    const result: AST.ColumnDefinition = {
      type: "columnDefinition",
      name: this.extractIdentifierName(ctx.identifier[0].children),
      dataType: this.visit(ctx.dataType) as string,
    }

    // Distinguish symbol CAPACITY (CONSUME) from index CAPACITY (CONSUME1) by position
    const capacityTokens = ctx.Capacity || []
    const numberTokens = ctx.NumberLiteral || []
    const indexToken = ctx.Index?.[0]

    if (capacityTokens.length > 0 && numberTokens.length > 0) {
      if (indexToken) {
        // Determine which capacity is for symbol vs index by position relative to INDEX
        const indexOffset = indexToken.startOffset
        for (let i = 0; i < capacityTokens.length; i++) {
          const capOffset = capacityTokens[i].startOffset
          if (capOffset < indexOffset) {
            // Symbol CAPACITY (before INDEX)
            result.symbolCapacity = parseInt(numberTokens[i].image, 10)
          } else {
            // INDEX CAPACITY (after INDEX)
            result.indexCapacity = parseInt(numberTokens[i].image, 10)
          }
        }
      } else {
        // No INDEX, so this is symbol CAPACITY
        result.symbolCapacity = parseInt(numberTokens[0].image, 10)
      }
    }

    // CACHE / NOCACHE
    if (ctx.Cache) {
      result.cache = true
    } else if (ctx.Nocache) {
      result.cache = false
    }

    // INDEX
    if (indexToken) {
      result.indexed = true
    }

    return result
  }

  castDefinition(ctx: CastDefinitionCstChildren): AST.CastDefinition {
    const colRef = this.visit(ctx.columnRef) as AST.ColumnRef
    return {
      type: "castDefinition",
      column: colRef.name ?? colRef,
      dataType: this.visit(ctx.dataType) as string,
    }
  }

  indexDefinition(ctx: IndexDefinitionCstChildren): AST.IndexDefinition {
    const colRef = this.visit(ctx.columnRef) as AST.ColumnRef
    const result: AST.IndexDefinition = {
      type: "indexDefinition",
      column: colRef.name ?? colRef,
    }
    if (ctx.Capacity && ctx.NumberLiteral) {
      result.capacity = parseInt(ctx.NumberLiteral[0].image, 10)
    }
    return result
  }

  tableParamName(ctx: TableParamNameCstChildren): string {
    if (ctx.identifier)
      return this.extractIdentifierName(ctx.identifier[0].children)
    return ""
  }

  tableParam(ctx: TableParamCstChildren): AST.TableParam {
    const name = ctx.tableParamName
      ? (this.visit(ctx.tableParamName[0]) as string)
      : ""
    const result: AST.TableParam = {
      type: "tableParam",
      name,
    }
    if (ctx.expression) {
      result.value = this.visit(ctx.expression) as AST.Expression
    }
    return result
  }

  createViewBody(ctx: CreateViewBodyCstChildren): AST.CreateViewStatement {
    const result: AST.CreateViewStatement = {
      type: "createView",
      view: this.visit(ctx.stringOrQualifiedName) as AST.QualifiedName,
      query: ctx.selectStatement
        ? (this.visit(ctx.selectStatement[0]) as AST.SelectStatement)
        : (this.visit(ctx.implicitSelectBody!) as AST.SelectStatement),
    }
    if (ctx.LParen) {
      result.asParens = true
    }
    if (ctx.Or) {
      result.orReplace = true
    }
    if (ctx.If) {
      result.ifNotExists = true
    }
    if (ctx.Owned && ctx.stringOrIdentifier) {
      result.ownedBy = this.visit(ctx.stringOrIdentifier) as string
    }
    return result
  }

  createUserStatement(
    ctx: CreateUserStatementCstChildren,
  ): AST.CreateUserStatement {
    const result: AST.CreateUserStatement = {
      type: "createUser",
      user: this.visit(ctx.qualifiedName[0]) as AST.QualifiedName,
    }
    if (ctx.If) {
      result.ifNotExists = true
    }
    if (ctx.No) {
      result.noPassword = true
    }
    if (ctx.Password) {
      if (ctx.StringLiteral) {
        result.password = ctx.StringLiteral[0].image.slice(1, -1)
      } else if (ctx.identifier) {
        result.password = this.extractIdentifierName(ctx.identifier[0].children)
      }
    }
    return result
  }

  createGroupStatement(
    ctx: CreateGroupStatementCstChildren,
  ): AST.CreateGroupStatement {
    const result: AST.CreateGroupStatement = {
      type: "createGroup",
      group: this.visit(ctx.qualifiedName) as AST.QualifiedName,
      ifNotExists: !!ctx.If,
    }
    if (ctx.StringLiteral) {
      result.externalAlias = ctx.StringLiteral[0].image.slice(1, -1)
    }
    return result
  }

  createServiceAccountStatement(
    ctx: CreateServiceAccountStatementCstChildren,
  ): AST.CreateServiceAccountStatement {
    const result: AST.CreateServiceAccountStatement = {
      type: "createServiceAccount",
      account: this.visit(ctx.qualifiedName[0]) as AST.QualifiedName,
    }
    if (ctx.If) {
      result.ifNotExists = true
    }
    if (ctx.No) {
      result.noPassword = true
    }
    if (ctx.Password && !ctx.No) {
      if (ctx.StringLiteral) {
        result.password = ctx.StringLiteral[0].image.slice(1, -1)
      } else if (ctx.identifier) {
        result.password = this.extractIdentifierName(ctx.identifier[0].children)
      }
    }
    if (ctx.Owned && ctx.stringOrIdentifier) {
      result.ownedBy = this.visit(ctx.stringOrIdentifier) as string
    }
    return result
  }

  createMaterializedViewBody(
    ctx: CreateMaterializedViewBodyCstChildren,
  ): AST.CreateMaterializedViewStatement {
    const result: AST.CreateMaterializedViewStatement = {
      type: "createMaterializedView",
      view: this.visit(ctx.stringOrQualifiedName) as AST.QualifiedName,
      query: this.visit(ctx.selectStatement[0]) as AST.SelectStatement,
    }
    if (ctx.LParen) {
      result.asParens = true
    }
    if (ctx.If) {
      result.ifNotExists = true
    }
    if (ctx.Base && ctx.stringOrQualifiedName?.length > 1) {
      result.baseTable = this.visit(
        ctx.stringOrQualifiedName[1],
      ) as AST.QualifiedName
    }
    if (ctx.materializedViewRefresh) {
      result.refresh = this.visit(
        ctx.materializedViewRefresh,
      ) as AST.MaterializedViewRefresh
    } else if (ctx.Refresh && !ctx.materializedViewRefresh) {
      // REFRESH keyword consumed but no materializedViewRefresh subrule — REFRESH PERIOD path
      result.refresh = { type: "materializedViewRefresh" }
    }
    if (ctx.materializedViewPeriod) {
      result.period = this.visit(
        ctx.materializedViewPeriod[0],
      ) as AST.MaterializedViewPeriod
    }
    if (ctx.Timestamp && ctx.columnRef) {
      result.timestamp = (this.visit(ctx.columnRef[0]) as AST.ColumnRef).name
    }
    if (ctx.materializedViewPartition) {
      const partition = this.visit(ctx.materializedViewPartition) as {
        partitionBy?: AST.CreateMaterializedViewStatement["partitionBy"]
        ttl?: AST.CreateMaterializedViewStatement["ttl"]
      }
      if (partition.partitionBy) result.partitionBy = partition.partitionBy
      if (partition.ttl) result.ttl = partition.ttl
    }
    if (ctx.Volume) {
      const volumeOffset = ctx.Volume[0].startOffset
      const volumeStr = ctx.StringLiteral?.find(
        (t: IToken) => t.startOffset > volumeOffset,
      )
      result.volume = volumeStr
        ? volumeStr.image.slice(1, -1)
        : ctx.identifier?.length
          ? this.extractIdentifierName(
              ctx.identifier[ctx.identifier.length - 1].children,
            )
          : undefined
    }
    if (ctx.Owned && ctx.stringOrIdentifier) {
      result.ownedBy = this.visit(ctx.stringOrIdentifier) as string
    }
    return result
  }

  materializedViewRefresh(
    ctx: MaterializedViewRefreshCstChildren,
  ): AST.MaterializedViewRefresh {
    const result: AST.MaterializedViewRefresh = {
      type: "materializedViewRefresh",
    }
    if (ctx.Immediate) result.mode = "immediate"
    if (ctx.Manual) result.mode = "manual"
    if (ctx.intervalValue) {
      result.every = this.extractMaybeString(ctx.intervalValue[0])
    }
    if (ctx.Deferred) result.deferred = true
    if (ctx.Start && ctx.stringOrIdentifier) {
      result.start = this.extractMaybeString(ctx.stringOrIdentifier[0])
    }
    if (ctx.Zone && ctx.timeZoneValue) {
      result.timeZone = this.extractMaybeString(ctx.timeZoneValue[0])
    }
    return result
  }

  materializedViewPeriod(
    ctx: MaterializedViewPeriodCstChildren,
  ): AST.MaterializedViewPeriod {
    const result: AST.MaterializedViewPeriod = {
      type: "materializedViewPeriod",
    }
    if (ctx.Length && ctx.intervalValue) {
      result.length = this.extractMaybeString(ctx.intervalValue[0])
    }
    if (ctx.Delay && ctx.intervalValue?.[1]) {
      result.delay = this.extractMaybeString(ctx.intervalValue[1])
    }
    if (ctx.Zone && ctx.timeZoneValue) {
      result.timeZone = this.extractMaybeString(ctx.timeZoneValue[0])
    }
    if (ctx.Interval) {
      result.sampleByInterval = true
    }
    return result
  }

  materializedViewPartition(ctx: MaterializedViewPartitionCstChildren): {
    partitionBy?: AST.CreateMaterializedViewStatement["partitionBy"]
    ttl?: AST.CreateMaterializedViewStatement["ttl"]
  } {
    const result: {
      partitionBy?: AST.CreateMaterializedViewStatement["partitionBy"]
      ttl?: AST.CreateMaterializedViewStatement["ttl"]
    } = {}
    if (ctx.partitionPeriod) {
      result.partitionBy = this.visit(ctx.partitionPeriod) as
        | "YEAR"
        | "MONTH"
        | "WEEK"
        | "DAY"
        | "HOUR"
    }
    if (ctx.Ttl && ctx.NumberLiteral) {
      result.ttl = this.extractTtl(ctx)
    }
    return result
  }

  partitionPeriod(
    ctx: PartitionPeriodCstChildren,
  ): "NONE" | "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" {
    if (ctx.None) return "NONE"
    if (ctx.Hour) return "HOUR"
    if (ctx.Day) return "DAY"
    if (ctx.Week) return "WEEK"
    if (ctx.Month) return "MONTH"
    if (ctx.Year) return "YEAR"
    return "NONE"
  }

  timeUnit(ctx: TimeUnitCstChildren): string {
    if (ctx.Hours) return "HOURS"
    if (ctx.Days) return "DAYS"
    if (ctx.Weeks) return "WEEKS"
    if (ctx.Months) return "MONTHS"
    if (ctx.Years) return "YEARS"
    if (ctx.Hour) return "HOUR"
    if (ctx.Day) return "DAY"
    if (ctx.Week) return "WEEK"
    if (ctx.Month) return "MONTH"
    if (ctx.Year) return "YEAR"
    if (ctx.Minute) return "MINUTE"
    if (ctx.Minutes) return "MINUTES"
    if (ctx.Second) return "SECOND"
    if (ctx.Seconds) return "SECONDS"
    if (ctx.Millisecond) return "MILLISECOND"
    if (ctx.Milliseconds) return "MILLISECONDS"
    if (ctx.Microsecond) return "MICROSECOND"
    if (ctx.Microseconds) return "MICROSECONDS"
    if (ctx.Nanosecond) return "NANOSECOND"
    if (ctx.Nanoseconds) return "NANOSECONDS"
    return "DAYS"
  }

  dedupClause(ctx: DedupClauseCstChildren): string[] {
    return ctx.identifier.map((id: IdentifierCstNode) =>
      this.extractIdentifierName(id.children),
    )
  }

  // ==========================================================================
  // ALTER TABLE Statement
  // ==========================================================================

  alterStatement(ctx: AlterStatementCstChildren): AST.Statement {
    if (ctx.alterTableStatement) {
      return this.visit(ctx.alterTableStatement) as AST.AlterTableStatement
    }
    if (ctx.alterMaterializedViewStatement) {
      return this.visit(
        ctx.alterMaterializedViewStatement,
      ) as AST.AlterMaterializedViewStatement
    }
    if (ctx.alterViewStatement) {
      return this.visit(ctx.alterViewStatement) as AST.AlterViewStatement
    }
    if (ctx.alterUserStatement) {
      return this.visit(ctx.alterUserStatement) as AST.AlterUserStatement
    }
    if (ctx.alterServiceAccountStatement) {
      return this.visit(
        ctx.alterServiceAccountStatement,
      ) as AST.AlterServiceAccountStatement
    }
    if (ctx.alterGroupStatement) {
      return this.visit(ctx.alterGroupStatement) as AST.AlterGroupStatement
    }
    throw new Error("Unknown alter statement type")
  }

  alterViewStatement(
    ctx: AlterViewStatementCstChildren,
  ): AST.AlterViewStatement {
    return {
      type: "alterView",
      view: this.visit(ctx.stringOrQualifiedName) as AST.QualifiedName,
      query: this.visit(ctx.selectStatement![0]) as AST.SelectStatement,
    }
  }

  alterGroupStatement(
    ctx: AlterGroupStatementCstChildren,
  ): AST.AlterGroupStatement {
    const alias = ctx.StringLiteral![0].image.slice(1, -1)
    if (ctx.With) {
      return {
        type: "alterGroup",
        group: this.visit(ctx.qualifiedName) as AST.QualifiedName,
        action: "setAlias",
        externalAlias: alias,
      }
    }
    return {
      type: "alterGroup",
      group: this.visit(ctx.qualifiedName) as AST.QualifiedName,
      action: "dropAlias",
      externalAlias: alias,
    }
  }

  alterTableStatement(
    ctx: AlterTableStatementCstChildren,
  ): AST.AlterTableStatement {
    const table = this.visit(ctx.tableNameOrString) as AST.QualifiedName
    return {
      type: "alterTable",
      table,
      action: this.visit(ctx.alterTableAction) as AST.AlterTableAction,
    }
  }

  alterMaterializedViewStatement(
    ctx: AlterMaterializedViewStatementCstChildren,
  ): AST.AlterMaterializedViewStatement {
    return {
      type: "alterMaterializedView",
      view: this.visit(ctx.tableName) as AST.QualifiedName,
      action: this.visit(
        ctx.alterMaterializedViewAction,
      ) as AST.AlterMaterializedViewAction,
    }
  }

  alterMaterializedViewAction(
    ctx: AlterMaterializedViewActionCstChildren,
  ): AST.AlterMaterializedViewAction {
    if (ctx.Add && ctx.Index) {
      const colRef = this.visit(ctx.columnRef![0]) as AST.ColumnRef
      const result: AST.AlterMaterializedViewAddIndex = {
        actionType: "addIndex",
        column: colRef.name.parts[colRef.name.parts.length - 1],
      }
      if (ctx.Capacity && ctx.NumberLiteral) {
        result.capacity = parseInt(ctx.NumberLiteral[0].image, 10)
      }
      return result
    }

    if (ctx.Symbol && ctx.Capacity) {
      const colRef = this.visit(ctx.columnRef![0]) as AST.ColumnRef
      return {
        actionType: "symbolCapacity",
        column: colRef.name.parts[colRef.name.parts.length - 1],
        capacity: parseInt(ctx.NumberLiteral![0].image, 10),
      }
    }

    if (ctx.Ttl) {
      return {
        actionType: "setTtl",
        ttl: this.extractTtl(ctx),
      }
    }

    if (ctx.Limit) {
      return {
        actionType: "setRefreshLimit",
        limit: this.extractTtl(ctx),
      }
    }

    // ALTER COLUMN x DROP INDEX
    if (ctx.Alter && ctx.Drop && ctx.Index) {
      const colRef = this.visit(ctx.columnRef![0]) as AST.ColumnRef
      return {
        actionType: "dropIndex",
        column: colRef.name.parts[colRef.name.parts.length - 1],
      }
    }

    // RESUME WAL [FROM TRANSACTION n]
    if (ctx.Resume) {
      const result: AST.ResumeWalAction = { actionType: "resumeWal" }
      if (ctx.NumberLiteral) {
        result.fromTxn = parseInt(ctx.NumberLiteral[0].image, 10)
      }
      return result
    }

    // SUSPEND WAL
    if (ctx.Suspend) {
      return { actionType: "suspendWal" }
    }

    return {
      actionType: "setRefresh",
      refresh: ctx.materializedViewRefresh
        ? (this.visit(
            ctx.materializedViewRefresh,
          ) as AST.MaterializedViewRefresh)
        : undefined,
      period: ctx.materializedViewPeriod
        ? (this.visit(ctx.materializedViewPeriod) as AST.MaterializedViewPeriod)
        : undefined,
    }
  }

  alterUserStatement(
    ctx: AlterUserStatementCstChildren,
  ): AST.AlterUserStatement {
    return {
      type: "alterUser",
      user: this.visit(ctx.qualifiedName) as AST.QualifiedName,
      action: this.visit(ctx.alterUserAction) as AST.AlterUserAction,
    }
  }

  alterServiceAccountStatement(
    ctx: AlterServiceAccountStatementCstChildren,
  ): AST.AlterServiceAccountStatement {
    return {
      type: "alterServiceAccount",
      account: this.visit(ctx.qualifiedName) as AST.QualifiedName,
      action: this.visit(ctx.alterUserAction) as AST.AlterUserAction,
    }
  }

  alterUserAction(ctx: AlterUserActionCstChildren): AST.AlterUserAction {
    if (ctx.Enable) {
      return { actionType: "enable" }
    }
    if (ctx.Disable) {
      return { actionType: "disable" }
    }
    if (ctx.Password || ctx.No) {
      return {
        actionType: "password",
        noPassword: !!ctx.No,
        password: ctx.StringLiteral?.[0]?.image?.slice(1, -1),
      }
    }
    if (ctx.Create && ctx.Token) {
      let ttl: string | undefined
      if (ctx.DurationLiteral) {
        ttl = ctx.DurationLiteral[0].image
      } else if (ctx.Ttl && ctx.StringLiteral) {
        ttl = ctx.StringLiteral[0].image.slice(1, -1)
      }
      const result: AST.AlterUserCreateTokenAction = {
        actionType: "createToken",
        tokenType: ctx.Jwk ? "JWK" : "REST",
        ttl,
        refresh: !!ctx.Refresh,
      }
      if (ctx.Transient) {
        result.transient = true
      }
      // JWK public key: WITH PUBLIC KEY X '...' Y '...'
      if (ctx.Public && ctx.Key && ctx.Identifier) {
        // In JWK path, StringLiteral[0] and [1] are the public key values
        result.publicKeyX = ctx.StringLiteral![0].image.slice(1, -1)
        result.publicKeyY = ctx.StringLiteral![1].image.slice(1, -1)
      }
      return result
    }
    return {
      actionType: "dropToken",
      tokenType: ctx.Jwk ? "JWK" : "REST",
      token:
        ctx.Identifier?.[0]?.image ??
        ctx.StringLiteral?.[0]?.image?.slice(1, -1),
    }
  }

  alterTableAction(ctx: AlterTableActionCstChildren): AST.AlterTableAction {
    // ADD COLUMN
    if (ctx.Add && ctx.columnDefinition) {
      const result: AST.AddColumnAction = {
        actionType: "addColumn",
        columns: ctx.columnDefinition.map(
          (c: CstNode) => this.visit(c) as AST.ColumnDefinition,
        ),
      }
      if (ctx.If) {
        result.ifNotExists = true
      }
      return result
    }

    // DROP COLUMN (when Drop token exists but no Partition and no Alter — Alter + Drop = ALTER COLUMN DROP INDEX)
    if (ctx.Drop && ctx.columnRef && !ctx.Partition && !ctx.Alter) {
      return {
        actionType: "dropColumn",
        columns: ctx.columnRef.map((c: CstNode) => {
          const ref = this.visit(c) as AST.ColumnRef
          return ref.name.parts[ref.name.parts.length - 1]
        }),
      }
    }

    // RENAME COLUMN
    if (ctx.Rename) {
      const oldRef = this.visit(ctx.columnRef![0]) as AST.ColumnRef
      const oldName = oldRef.name.parts[oldRef.name.parts.length - 1]
      const newName = this.extractIdentifierName(ctx.identifier![0].children)
      return {
        actionType: "renameColumn",
        oldName,
        newName,
      }
    }

    // ALTER COLUMN
    if (ctx.Alter && ctx.columnRef) {
      const colRef = this.visit(ctx.columnRef[0]) as AST.ColumnRef
      const column = colRef.name.parts[colRef.name.parts.length - 1]
      let alterType:
        | "type"
        | "addIndex"
        | "dropIndex"
        | "cache"
        | "nocache"
        | "symbolCapacity" = "type"
      let newType: string | undefined
      let capacity: number | undefined

      if (ctx.Type) {
        alterType = "type"
        newType = this.visit(ctx.dataType!) as string
        if (ctx.Capacity && ctx.NumberLiteral) {
          capacity = parseInt(ctx.NumberLiteral[0].image, 10)
        }
      } else if (ctx.Add && ctx.Index) {
        alterType = "addIndex"
      } else if (ctx.Drop && ctx.Index) {
        alterType = "dropIndex"
      } else if (ctx.Symbol && ctx.Capacity) {
        alterType = "symbolCapacity"
        capacity = parseInt(ctx.NumberLiteral![0].image, 10)
      } else if (ctx.Cache) {
        alterType = "cache"
      } else if (ctx.Nocache) {
        alterType = "nocache"
      }

      const result: AST.AlterColumnAction = {
        actionType: "alterColumn",
        column,
        alterType,
      }
      if (newType) {
        result.newType = newType
      }
      if (capacity !== undefined) {
        result.capacity = capacity
      }
      if (alterType === "type") {
        if (ctx.Cache) result.cache = true
        else if (ctx.Nocache) result.cache = false
      }
      return result
    }

    // DROP PARTITION
    if (ctx.Drop && ctx.Partition) {
      const result: AST.DropPartitionAction = {
        actionType: "dropPartition",
      }
      if (ctx.StringLiteral) {
        result.partitions = ctx.StringLiteral.map((s: IToken) =>
          s.image.slice(1, -1),
        )
      }
      if (ctx.Where && ctx.expression) {
        result.where = this.visit(ctx.expression) as AST.Expression
      }
      return result
    }

    // ATTACH PARTITION
    if (ctx.Attach) {
      return {
        actionType: "attachPartition",
        partitions: ctx.StringLiteral!.map((s: IToken) => s.image.slice(1, -1)),
      }
    }

    // DETACH PARTITION
    if (ctx.Detach) {
      const result: AST.DetachPartitionAction = {
        actionType: "detachPartition",
      }
      if (ctx.StringLiteral) {
        result.partitions = ctx.StringLiteral.map((s: IToken) =>
          s.image.slice(1, -1),
        )
      }
      if (ctx.Where && ctx.expression) {
        result.where = this.visit(ctx.expression) as AST.Expression
      }
      return result
    }

    // SQUASH PARTITIONS
    if (ctx.Squash) {
      return {
        actionType: "squashPartitions",
      }
    }

    if (ctx.Set && ctx.Param) {
      return {
        actionType: "setParam",
        params: ctx.tableParam!.map(
          (p: CstNode) => this.visit(p) as AST.TableParam,
        ),
      }
    }

    if (ctx.Set && ctx.Ttl) {
      return {
        actionType: "setTtl",
        ttl: this.extractTtl(ctx),
      }
    }

    if (ctx.Dedup && ctx.Disable) {
      return {
        actionType: "dedupDisable",
      }
    }

    if (ctx.Dedup && ctx.Enable) {
      return {
        actionType: "dedupEnable",
        keys: ctx.identifier!.map((id: IdentifierCstNode) =>
          this.extractIdentifierName(id.children),
        ),
      }
    }

    // SUSPEND WAL [WITH code, 'message']
    if (ctx.Suspend) {
      const result: AST.SuspendWalAction = { actionType: "suspendWal" }
      if (ctx.With) {
        // Code can be a NumberLiteral or StringLiteral
        if (ctx.NumberLiteral) {
          result.code = parseInt(ctx.NumberLiteral[0].image, 10)
        } else if (ctx.StringLiteral && ctx.StringLiteral.length > 0) {
          result.code = ctx.StringLiteral[0].image.slice(1, -1)
        }
        // Message is the last StringLiteral
        const strings = ctx.StringLiteral || []
        if (strings.length > 0) {
          result.message = strings[strings.length - 1].image.slice(1, -1)
        }
      }
      return result
    }

    // RESUME WAL [FROM TXN/TRANSACTION number]
    if (ctx.Resume) {
      const result: AST.ResumeWalAction = { actionType: "resumeWal" }
      if (ctx.NumberLiteral) {
        const num = parseInt(ctx.NumberLiteral[0].image, 10)
        if (ctx.Txn) {
          result.fromTxn = num
        } else if (ctx.Transaction) {
          result.fromTransaction = num
        }
      }
      return result
    }

    // CONVERT PARTITION
    if (ctx.Convert) {
      const target = this.visit(
        ctx.convertPartitionTarget!,
      ) as ConvertPartitionTargetResult
      return {
        actionType: "convertPartition",
        ...target,
      } as AST.ConvertPartitionAction
    }

    // SET TYPE [BYPASS] WAL
    if (ctx.Set && ctx.Type) {
      return {
        actionType: "setTypeWal",
        bypass: !!ctx.Bypass,
      } as AST.SetTypeWalAction
    }

    throw new Error("Unknown alter table action")
  }

  // ==========================================================================
  // DROP TABLE Statement
  // ==========================================================================

  dropStatement(ctx: DropStatementCstChildren): AST.Statement {
    if (ctx.dropTableStatement) {
      return this.visit(ctx.dropTableStatement) as AST.DropTableStatement
    }
    if (ctx.dropMaterializedViewStatement) {
      return this.visit(
        ctx.dropMaterializedViewStatement,
      ) as AST.DropMaterializedViewStatement
    }
    if (ctx.dropViewStatement) {
      return this.visit(ctx.dropViewStatement) as AST.DropViewStatement
    }
    if (ctx.dropUserStatement) {
      return this.visit(ctx.dropUserStatement) as AST.DropUserStatement
    }
    if (ctx.dropGroupStatement) {
      return this.visit(ctx.dropGroupStatement) as AST.DropGroupStatement
    }
    if (ctx.dropServiceAccountStatement) {
      return this.visit(
        ctx.dropServiceAccountStatement,
      ) as AST.DropServiceAccountStatement
    }
    throw new Error("Unknown drop statement type")
  }

  dropTableStatement(
    ctx: DropTableStatementCstChildren,
  ): AST.DropTableStatement {
    const result: AST.DropTableStatement = {
      type: "dropTable",
    }

    if (ctx.All) {
      result.allTables = true
    } else {
      result.table = this.visit(ctx.tableName!) as AST.QualifiedName
      if (ctx.If) {
        result.ifExists = true
      }
    }

    return result
  }

  dropMaterializedViewStatement(
    ctx: DropMaterializedViewStatementCstChildren,
  ): AST.DropMaterializedViewStatement {
    return {
      type: "dropMaterializedView",
      view: this.visit(ctx.stringOrQualifiedName) as AST.QualifiedName,
      ifExists: !!ctx.If,
    }
  }

  dropViewStatement(ctx: DropViewStatementCstChildren): AST.DropViewStatement {
    return {
      type: "dropView",
      view: this.visit(ctx.stringOrQualifiedName) as AST.QualifiedName,
      ifExists: !!ctx.If,
    }
  }

  dropUserStatement(ctx: DropUserStatementCstChildren): AST.DropUserStatement {
    return {
      type: "dropUser",
      user: this.visit(ctx.qualifiedName) as AST.QualifiedName,
      ifExists: !!ctx.If,
    }
  }

  dropGroupStatement(
    ctx: DropGroupStatementCstChildren,
  ): AST.DropGroupStatement {
    return {
      type: "dropGroup",
      group: this.visit(ctx.qualifiedName) as AST.QualifiedName,
      ifExists: !!ctx.If,
    }
  }

  dropServiceAccountStatement(
    ctx: DropServiceAccountStatementCstChildren,
  ): AST.DropServiceAccountStatement {
    return {
      type: "dropServiceAccount",
      account: this.visit(ctx.qualifiedName) as AST.QualifiedName,
      ifExists: !!ctx.If,
    }
  }

  // ==========================================================================
  // TRUNCATE TABLE Statement
  // ==========================================================================

  truncateTableStatement(
    ctx: TruncateTableStatementCstChildren,
  ): AST.TruncateTableStatement {
    const tables = ctx.tableName.map(
      (qn) => this.visit(qn) as AST.QualifiedName,
    )

    const result: AST.TruncateTableStatement = {
      type: "truncateTable",
      tables,
    }

    if (ctx.If) {
      result.ifExists = true
    }

    if (ctx.Only) {
      result.only = true
    }

    if (ctx.Keep) {
      result.keepSymbolMaps = true
    }

    return result
  }

  // ==========================================================================
  // RENAME TABLE Statement
  // ==========================================================================

  renameTableStatement(
    ctx: RenameTableStatementCstChildren,
  ): AST.RenameTableStatement {
    return {
      type: "renameTable",
      from: this.visit(ctx.tableNameOrString[0]) as AST.QualifiedName,
      to: this.visit(ctx.tableNameOrString[1]) as AST.QualifiedName,
    }
  }

  addUserStatement(ctx: AddUserStatementCstChildren): AST.AddUserStatement {
    return {
      type: "addUser",
      user: this.visit(ctx.qualifiedName[0]) as AST.QualifiedName,
      groups: ctx.qualifiedName
        .slice(1)
        .map((q: CstNode) => this.visit(q) as AST.QualifiedName),
    }
  }

  removeUserStatement(
    ctx: RemoveUserStatementCstChildren,
  ): AST.RemoveUserStatement {
    return {
      type: "removeUser",
      user: this.visit(ctx.qualifiedName[0]) as AST.QualifiedName,
      groups: ctx.qualifiedName
        .slice(1)
        .map((q: CstNode) => this.visit(q) as AST.QualifiedName),
    }
  }

  assumeServiceAccountStatement(
    ctx: AssumeServiceAccountStatementCstChildren,
  ): AST.AssumeServiceAccountStatement {
    return {
      type: "assumeServiceAccount",
      account: this.visit(ctx.qualifiedName) as AST.QualifiedName,
    }
  }

  exitServiceAccountStatement(
    ctx: ExitServiceAccountStatementCstChildren,
  ): AST.ExitServiceAccountStatement {
    const result: AST.ExitServiceAccountStatement = {
      type: "exitServiceAccount",
    }
    if (ctx.qualifiedName) {
      result.account = this.visit(ctx.qualifiedName) as AST.QualifiedName
    }
    return result
  }

  cancelQueryStatement(
    ctx: CancelQueryStatementCstChildren,
  ): AST.CancelQueryStatement {
    const token =
      ctx.NumberLiteral?.[0] ?? ctx.Identifier?.[0] ?? ctx.StringLiteral?.[0]
    return {
      type: "cancelQuery",
      queryId: token?.image?.replace(/^'|'$/g, "") ?? "",
    }
  }

  // ==========================================================================
  // SHOW Statement
  // ==========================================================================

  showStatement(ctx: ShowStatementCstChildren): AST.ShowStatement {
    if (ctx.Tables) {
      return {
        type: "show",
        showType: "tables",
      }
    }

    if (ctx.Columns) {
      return {
        type: "show",
        showType: "columns",
        table: this.visit(ctx.qualifiedName!) as AST.QualifiedName,
      }
    }

    if (ctx.Partitions) {
      return {
        type: "show",
        showType: "partitions",
        table: this.visit(ctx.qualifiedName!) as AST.QualifiedName,
      }
    }

    if (ctx.Create) {
      if (ctx.Materialized) {
        return {
          type: "show",
          showType: "createMaterializedView",
          table: this.visit(ctx.qualifiedName!) as AST.QualifiedName,
        }
      }
      if (ctx.View) {
        return {
          type: "show",
          showType: "createView",
          table: this.visit(ctx.qualifiedName!) as AST.QualifiedName,
        }
      }
      return {
        type: "show",
        showType: "createTable",
        table: this.visit(ctx.qualifiedName!) as AST.QualifiedName,
      }
    }

    if (ctx.User) {
      return {
        type: "show",
        showType: "user",
        name: ctx.qualifiedName
          ? (this.visit(ctx.qualifiedName) as AST.QualifiedName)
          : undefined,
      }
    }

    if (ctx.Users) {
      return {
        type: "show",
        showType: "users",
      }
    }

    if (ctx.Groups) {
      return {
        type: "show",
        showType: "groups",
        name: ctx.qualifiedName
          ? (this.visit(ctx.qualifiedName) as AST.QualifiedName)
          : undefined,
      }
    }

    if (ctx.Service && ctx.Account) {
      return {
        type: "show",
        showType: "serviceAccount",
        name: ctx.qualifiedName
          ? (this.visit(ctx.qualifiedName) as AST.QualifiedName)
          : undefined,
      }
    }

    if (ctx.Service && ctx.Accounts) {
      return {
        type: "show",
        showType: "serviceAccounts",
        name: ctx.qualifiedName
          ? (this.visit(ctx.qualifiedName) as AST.QualifiedName)
          : undefined,
      }
    }

    if (ctx.Permissions) {
      return {
        type: "show",
        showType: "permissions",
        name: ctx.qualifiedName
          ? (this.visit(ctx.qualifiedName) as AST.QualifiedName)
          : undefined,
      }
    }

    if (ctx.ServerVersion) {
      return {
        type: "show",
        showType: "serverVersion",
      }
    }

    if (ctx.Parameters) {
      return {
        type: "show",
        showType: "parameters",
      }
    }

    if (ctx.Transaction && ctx.Isolation) {
      return { type: "show", showType: "transactionIsolationLevel" }
    }
    if (ctx.TransactionIsolation) {
      return { type: "show", showType: "transactionIsolationLevel" }
    }
    if (ctx.MaxIdentifierLength) {
      return { type: "show", showType: "maxIdentifierLength" }
    }
    if (ctx.StandardConformingStrings) {
      return { type: "show", showType: "standardConformingStrings" }
    }
    if (ctx.SearchPath) {
      return { type: "show", showType: "searchPath" }
    }
    if (ctx.Datestyle) {
      return { type: "show", showType: "dateStyle" }
    }
    if (ctx.Time && ctx.Zone) {
      return { type: "show", showType: "timeZone" }
    }
    if (ctx.ServerVersionNum) {
      return { type: "show", showType: "serverVersionNum" }
    }
    if (ctx.DefaultTransactionReadOnly) {
      return { type: "show", showType: "defaultTransactionReadOnly" }
    }

    throw new Error("Unknown show type")
  }

  // ==========================================================================
  // EXPLAIN Statement
  // ==========================================================================

  explainStatement(ctx: ExplainStatementCstChildren): AST.ExplainStatement {
    const result: AST.ExplainStatement = {
      type: "explain",
      statement: this.visit(ctx.statement) as AST.Statement,
    }
    if (ctx.Format && ctx.Identifier) {
      result.format = ctx.Identifier[0].image.toUpperCase()
    }
    return result
  }

  // ==========================================================================
  // COPY, CHECKPOINT, SNAPSHOT Statements
  // ==========================================================================

  copyStatement(ctx: CopyStatementCstChildren): AST.CopyStatement {
    if (ctx.copyCancel) {
      return this.visit(ctx.copyCancel) as AST.CopyCancelStatement
    }
    if (ctx.copyFrom) {
      return this.visit(ctx.copyFrom) as AST.CopyFromStatement
    }
    return this.visit(ctx.copyTo!) as AST.CopyToStatement
  }

  copyCancel(ctx: CopyCancelCstChildren): AST.CopyCancelStatement {
    let id = ""
    if (ctx.StringLiteral) {
      id = ctx.StringLiteral[0].image.slice(1, -1)
    } else if (ctx.NumberLiteral) {
      id = ctx.NumberLiteral[0].image
    } else if (ctx.Identifier) {
      id = ctx.Identifier[0].image
    }
    return {
      type: "copyCancel",
      id,
    }
  }

  copyFrom(ctx: CopyFromCstChildren): AST.CopyFromStatement {
    const result: AST.CopyFromStatement = {
      type: "copyFrom",
      table: this.visit(ctx.tableName) as AST.QualifiedName,
      file: this.extractMaybeString(ctx.stringOrIdentifier[0]),
    }
    if (ctx.copyOptions) {
      result.options = this.visit(ctx.copyOptions) as AST.CopyOption[]
    }
    return result
  }

  copyTo(ctx: CopyToCstChildren): AST.CopyToStatement {
    const source = ctx.selectStatement
      ? (this.visit(ctx.selectStatement[0]) as AST.SelectStatement)
      : (this.visit(ctx.tableName!) as AST.QualifiedName)
    const result: AST.CopyToStatement = {
      type: "copyTo",
      source,
      destination: this.extractMaybeString(ctx.stringOrIdentifier[0]),
    }
    if (ctx.copyOptions) {
      result.options = this.visit(ctx.copyOptions) as AST.CopyOption[]
    }
    return result
  }

  copyOptions(ctx: CopyOptionsCstChildren): AST.CopyOption[] {
    return ctx.copyOption.map((o: CstNode) => this.visit(o) as AST.CopyOption)
  }

  copyOption(ctx: CopyOptionCstChildren): AST.CopyOption {
    const keyToken =
      ctx.Header?.[0] ??
      ctx.Timestamp?.[0] ??
      ctx.Delimiter?.[0] ??
      ctx.Format?.[0] ??
      ctx.Partition?.[0] ??
      ctx.PartitionBy?.[0] ??
      ctx.CompressionCodec?.[0] ??
      ctx.CompressionLevel?.[0] ??
      ctx.RowGroupSize?.[0] ??
      ctx.DataPageSize?.[0] ??
      ctx.StatisticsEnabled?.[0] ??
      ctx.ParquetVersion?.[0] ??
      ctx.RawArrayEncoding?.[0] ??
      (ctx.On ? ctx.On[0] : undefined)

    let key = keyToken?.image ?? "OPTION"
    if (ctx.On && ctx.Error) key = "ON ERROR"
    else if (ctx.Partition && ctx.By) key = "PARTITION BY"
    const result: AST.CopyOption = {
      type: "copyOption",
      key,
    }

    if (ctx.booleanLiteral) {
      result.value = this.visit(ctx.booleanLiteral) as boolean
    } else if (ctx.NumberLiteral) {
      // PARQUET_VERSION with bare number literal (e.g., PARQUET_VERSION 2)
      result.value = parseInt(ctx.NumberLiteral[0].image, 10)
    } else if (ctx.stringOrIdentifier) {
      result.value = this.extractMaybeString(ctx.stringOrIdentifier[0])
      // Mark as quoted when the stringOrIdentifier resolved to a string literal
      const soiChildren = (ctx.stringOrIdentifier[0] as CstNode).children
      if (soiChildren.StringLiteral) {
        result.quoted = true
      }
    } else if (ctx.StringLiteral) {
      result.value = ctx.StringLiteral[0].image.slice(1, -1)
      result.quoted = true
    } else if (ctx.expression) {
      const expr = this.visit(ctx.expression) as AST.Expression
      if (expr?.type === "literal" && expr.literalType === "number") {
        result.value = expr.value as number
      } else if (expr?.type === "literal" && expr.literalType === "string") {
        result.value = expr.value as string
        result.quoted = true
      } else if (expr?.type === "literal") {
        result.value = expr.raw ?? String(expr.value ?? "")
      } else {
        result.value = ""
      }
    } else if (ctx.identifier) {
      result.value = this.extractIdentifierName(ctx.identifier[0].children)
    } else if (
      ctx.Uncompressed ||
      ctx.Snappy ||
      ctx.Gzip ||
      ctx.Lz4 ||
      ctx.Zstd ||
      ctx.Lz4Raw ||
      ctx.Brotli ||
      ctx.Lzo
    ) {
      const codecToken =
        ctx.Uncompressed?.[0] ??
        ctx.Snappy?.[0] ??
        ctx.Gzip?.[0] ??
        ctx.Lz4?.[0] ??
        ctx.Zstd?.[0] ??
        ctx.Lz4Raw?.[0] ??
        ctx.Brotli?.[0] ??
        ctx.Lzo?.[0]
      result.value = codecToken?.image
    } else if (ctx.partitionPeriod && (ctx.Partition || ctx.PartitionBy)) {
      result.value = this.visit(ctx.partitionPeriod) as
        | "NONE"
        | "HOUR"
        | "DAY"
        | "WEEK"
        | "MONTH"
        | "YEAR"
    } else if (ctx.SkipRow || ctx.SkipColumn || ctx.Abort) {
      result.value = ctx.SkipRow
        ? "SKIP_ROW"
        : ctx.SkipColumn
          ? "SKIP_COLUMN"
          : "ABORT"
    }

    return result
  }

  checkpointStatement(
    ctx: CheckpointStatementCstChildren,
  ): AST.CheckpointStatement {
    return {
      type: "checkpoint",
      action: ctx.Create ? "create" : "release",
    }
  }

  snapshotStatement(ctx: SnapshotStatementCstChildren): AST.SnapshotStatement {
    return {
      type: "snapshot",
      action: ctx.Prepare ? "prepare" : "complete",
    }
  }

  backupStatement(ctx: BackupStatementCstChildren): AST.BackupStatement {
    if (ctx.Database) {
      return { type: "backup", action: "database" }
    }
    if (ctx.Abort) {
      return { type: "backup", action: "abort" }
    }
    return {
      type: "backup",
      action: "table",
      table: this.visit(ctx.tableName!) as AST.QualifiedName,
    }
  }

  compileViewStatement(
    ctx: CompileViewStatementCstChildren,
  ): AST.CompileViewStatement {
    return {
      type: "compileView",
      view: this.visit(ctx.tableName) as AST.QualifiedName,
    }
  }

  convertPartitionTarget(ctx: ConvertPartitionTargetCstChildren): {
    partitions?: string[]
    target: string
    where?: AST.Expression
  } {
    const result: {
      partitions?: string[]
      target: string
      where?: AST.Expression
    } = {
      target: "TABLE",
    }

    // Optional LIST of partition names
    if (ctx.StringLiteral) {
      result.partitions = ctx.StringLiteral.map((s: IToken) =>
        s.image.slice(1, -1),
      )
    }

    // Target: TABLE or identifier (e.g., Parquet, NATIVE)
    if (ctx.Table) {
      result.target = "TABLE"
    } else if (ctx.identifier) {
      result.target = this.extractIdentifierName(
        ctx.identifier[0].children,
      ).toUpperCase()
    }

    // Optional WHERE clause
    if (ctx.expression) {
      result.where = this.visit(ctx.expression[0]) as AST.Expression
    }

    return result
  }

  // ==========================================================================
  // GRANT / REVOKE Statements
  // ==========================================================================

  grantStatement(ctx: GrantStatementCstChildren): AST.GrantStatement {
    const result: AST.GrantStatement = {
      type: "grant",
      permissions: this.visit(ctx.permissionList) as string[],
      to: this.visit(ctx.qualifiedName) as AST.QualifiedName,
    }
    if (ctx.All) {
      result.on = { type: "grantOn", allTables: true }
    } else if (ctx.grantTableTarget) {
      result.on = {
        type: "grantOn",
        tables: ctx.grantTableTarget.map(
          (t: CstNode) => this.visit(t) as AST.GrantTableTarget,
        ),
      }
    }
    if (ctx.Option) {
      result.grantOption = true
    }
    if (ctx.Verification) {
      result.verification = true
    }
    return result
  }

  revokeStatement(ctx: RevokeStatementCstChildren): AST.RevokeStatement {
    const result: AST.RevokeStatement = {
      type: "revoke",
      permissions: this.visit(ctx.permissionList) as string[],
      from: this.visit(ctx.qualifiedName) as AST.QualifiedName,
    }
    if (ctx.On) {
      if (ctx.All && ctx.Tables) {
        result.on = { type: "grantOn", allTables: true }
      } else if (ctx.grantTableTarget) {
        result.on = {
          type: "grantOn",
          tables: ctx.grantTableTarget.map(
            (t: CstNode) => this.visit(t) as AST.GrantTableTarget,
          ),
        }
      }
    }
    return result
  }

  permissionList(ctx: PermissionListCstChildren): string[] {
    return ctx.permissionToken.map(
      (token: CstNode) => this.visit(token) as string,
    )
  }

  permissionToken(ctx: PermissionTokenCstChildren): string {
    // Collect all tokens and identifiers, sort by position, join with space.
    // The parser rule has a required first word + optional second word(s).
    const parts: { image: string; offset: number }[] = []

    for (const key of Object.keys(ctx)) {
      const items = (ctx as Record<string, unknown[]>)[key]
      if (!Array.isArray(items)) continue
      for (const item of items) {
        const tok = item as IToken
        const node = item as CstNode
        if (tok.image) {
          // Direct token
          parts.push({ image: tok.image, offset: tok.startOffset })
        } else if (node.children) {
          // Identifier subrule — extract the name
          const name = this.extractIdentifierName(node.children)
          const firstChild = Object.values(node.children)
            .flat()
            .find((c): c is IToken => (c as IToken)?.startOffset != null)
          parts.push({ image: name, offset: firstChild?.startOffset ?? 0 })
        }
      }
    }

    parts.sort((a, b) => a.offset - b.offset)
    return parts.map((p) => p.image).join(" ")
  }

  grantTableTarget(ctx: GrantTableTargetCstChildren): AST.GrantTableTarget {
    const result: AST.GrantTableTarget = {
      type: "grantTableTarget",
      table: this.visit(ctx.tableName) as AST.QualifiedName,
    }
    if (ctx.identifier && ctx.identifier.length > 0) {
      result.columns = ctx.identifier.map((id: IdentifierCstNode) =>
        this.extractIdentifierName(id.children),
      )
    }
    return result
  }

  grantAssumeServiceAccountStatement(
    ctx: GrantAssumeServiceAccountStatementCstChildren,
  ): AST.GrantAssumeServiceAccountStatement {
    return {
      type: "grantAssumeServiceAccount",
      account: this.visit(ctx.qualifiedName[0]) as AST.QualifiedName,
      to: this.visit(ctx.qualifiedName[1]) as AST.QualifiedName,
      grantOption: !!ctx.Option,
    }
  }

  revokeAssumeServiceAccountStatement(
    ctx: RevokeAssumeServiceAccountStatementCstChildren,
  ): AST.RevokeAssumeServiceAccountStatement {
    return {
      type: "revokeAssumeServiceAccount",
      account: this.visit(ctx.qualifiedName[0]) as AST.QualifiedName,
      from: this.visit(ctx.qualifiedName[1]) as AST.QualifiedName,
    }
  }

  // ==========================================================================
  // VACUUM / RESUME WAL / SET TYPE / REINDEX
  // ==========================================================================

  vacuumTableStatement(
    ctx: VacuumTableStatementCstChildren,
  ): AST.VacuumTableStatement {
    return {
      type: "vacuumTable",
      table: this.visit(ctx.tableName) as AST.QualifiedName,
    }
  }

  resumeWalStatement(
    ctx: ResumeWalStatementCstChildren,
  ): AST.ResumeWalStatement {
    const result: AST.ResumeWalStatement = {
      type: "resumeWal",
    }
    if (ctx.Transaction && ctx.NumberLiteral) {
      result.fromTransaction = parseInt(ctx.NumberLiteral[0].image, 10)
    }
    if (ctx.Txn && ctx.NumberLiteral) {
      result.fromTxn = parseInt(ctx.NumberLiteral[0].image, 10)
    }
    return result
  }

  setTypeStatement(ctx: SetTypeStatementCstChildren): AST.SetTypeStatement {
    return {
      type: "setType",
      bypass: !!ctx.Bypass,
      wal: !!ctx.Wal,
    }
  }

  reindexTableStatement(
    ctx: ReindexTableStatementCstChildren,
  ): AST.ReindexTableStatement {
    const result: AST.ReindexTableStatement = {
      type: "reindexTable",
      table: this.visit(ctx.tableName) as AST.QualifiedName,
    }
    if (ctx.Column && ctx.identifier) {
      result.columns = ctx.identifier.map((id: IdentifierCstNode) =>
        this.extractIdentifierName(id.children),
      )
    }
    if (ctx.Partition && ctx.stringOrIdentifier) {
      result.partitions = ctx.stringOrIdentifier.map(
        (s: CstNode) => this.visit(s) as string,
      )
    }
    if (ctx.Exclusive) {
      result.lockExclusive = true
    }
    return result
  }

  refreshMaterializedViewStatement(
    ctx: RefreshMaterializedViewStatementCstChildren,
  ): AST.RefreshMaterializedViewStatement {
    const result: AST.RefreshMaterializedViewStatement = {
      type: "refreshMaterializedView",
      view: this.visit(ctx.tableName) as AST.QualifiedName,
    }
    if (ctx.Full) result.mode = "full"
    if (ctx.Incremental) result.mode = "incremental"
    if (ctx.Range) {
      result.mode = "range"
      if (ctx.stringOrIdentifier) {
        result.from = this.extractMaybeString(ctx.stringOrIdentifier[0])
        result.to = this.extractMaybeString(ctx.stringOrIdentifier[1])
      }
    }
    return result
  }

  // ==========================================================================
  // PIVOT Statement
  // ==========================================================================

  pivotStatement(ctx: PivotStatementCstChildren): AST.PivotStatement {
    const source = ctx.selectStatement
      ? (this.visit(ctx.selectStatement[0]) as AST.SelectStatement)
      : (this.visit(ctx.tableName!) as AST.QualifiedName)
    const body: Partial<PivotBodyResult> = ctx.pivotBody
      ? (this.visit(ctx.pivotBody) as PivotBodyResult)
      : {}
    const result: AST.PivotStatement = {
      type: "pivot",
      source,
      aggregations: body.aggregations || [],
      pivots: body.pivots || [],
    }
    if (ctx.whereClause) {
      result.where = this.visit(ctx.whereClause) as AST.Expression
    }
    if (body.groupBy) {
      result.groupBy = body.groupBy
    }
    if (ctx.orderByClause) {
      result.orderBy = this.visit(ctx.orderByClause) as AST.OrderByItem[]
    }
    if (ctx.limitClause) {
      result.limit = this.visit(ctx.limitClause) as AST.LimitClause
    }
    if (ctx.identifier) {
      result.alias = this.extractIdentifierName(ctx.identifier[0].children)
    }
    return result
  }

  pivotBody(ctx: PivotBodyCstChildren): {
    aggregations: AST.PivotAggregation[]
    pivots: AST.PivotForClause[]
    groupBy?: AST.Expression[]
  } {
    const aggregations = ctx.pivotAggregation
      ? ctx.pivotAggregation.map(
          (p: CstNode) => this.visit(p) as AST.PivotAggregation,
        )
      : []
    const pivots = ctx.pivotForClause
      ? ctx.pivotForClause.map(
          (p: CstNode) => this.visit(p) as AST.PivotForClause,
        )
      : []
    const result: {
      aggregations: AST.PivotAggregation[]
      pivots: AST.PivotForClause[]
      groupBy?: AST.Expression[]
    } = {
      aggregations,
      pivots,
    }
    if (ctx.Group && ctx.expression) {
      result.groupBy = ctx.expression.map(
        (e: CstNode) => this.visit(e) as AST.Expression,
      )
    }
    return result
  }

  pivotAggregation(ctx: PivotAggregationCstChildren): AST.PivotAggregation {
    return {
      type: "pivotAggregation",
      expression: this.visit(ctx.expression) as AST.Expression,
      alias: ctx.identifier
        ? (this.visit(ctx.identifier) as AST.QualifiedName).parts[0]
        : undefined,
    }
  }

  pivotForClause(ctx: PivotForClauseCstChildren): AST.PivotForClause {
    const result: AST.PivotForClause = {
      type: "pivotFor",
      expression: this.visit(ctx.columnRef) as AST.ColumnRef,
      in: {
        type: "pivotIn",
      },
    }
    if (ctx.selectStatement) {
      result.in.select = this.visit(ctx.selectStatement) as AST.SelectStatement
    } else if (ctx.pivotInValue && ctx.pivotInValue.length > 0) {
      result.in.values = ctx.pivotInValue.map(
        (e: CstNode) => this.visit(e) as AST.PivotInValue,
      )
    }
    return result
  }

  pivotInValue(ctx: PivotInValueCstChildren): AST.PivotInValue {
    const result: AST.PivotInValue = {
      type: "pivotInValue",
      expression: this.visit(ctx.expression) as AST.Expression,
    }
    if (ctx.As && ctx.identifier) {
      result.alias = this.extractIdentifierName(ctx.identifier[0].children)
    }
    return result
  }

  // ==========================================================================
  // Expressions
  // ==========================================================================

  expression(ctx: ExpressionCstChildren): AST.Expression {
    return this.visit(ctx.orExpression) as AST.Expression
  }

  orExpression(ctx: OrExpressionCstChildren): AST.Expression {
    let result = this.visit(ctx.andExpression[0]) as AST.Expression

    if (ctx.andExpression.length > 1) {
      for (let i = 1; i < ctx.andExpression.length; i++) {
        result = {
          type: "binary",
          operator: "OR",
          left: result,
          right: this.visit(ctx.andExpression[i]) as AST.Expression,
        }
      }
    }

    return result
  }

  andExpression(ctx: AndExpressionCstChildren): AST.Expression {
    let result = this.visit(ctx.notExpression[0]) as AST.Expression

    if (ctx.notExpression.length > 1) {
      for (let i = 1; i < ctx.notExpression.length; i++) {
        result = {
          type: "binary",
          operator: "AND",
          left: result,
          right: this.visit(ctx.notExpression[i]) as AST.Expression,
        }
      }
    }

    return result
  }

  notExpression(ctx: NotExpressionCstChildren): AST.Expression {
    const inner = this.visit(ctx.equalityExpression) as AST.Expression

    if (ctx.Not) {
      return {
        type: "unary",
        operator: "NOT",
        operand: inner,
      }
    }

    return inner
  }

  equalityExpression(ctx: EqualityExpressionCstChildren): AST.Expression {
    const left = this.visit(ctx.relationalExpression[0]) as AST.Expression

    if (ctx.relationalExpression && ctx.relationalExpression.length > 1) {
      let operator = ""
      if (ctx.Equals) operator = "="
      else if (ctx.NotEquals) operator = "!="
      else if (ctx.Like) operator = "LIKE"
      else if (ctx.Ilike) operator = "ILIKE"
      else if (ctx.RegexMatch) operator = "~"
      else if (ctx.RegexNotMatch) operator = "!~"
      else if (ctx.RegexNotEquals) operator = "~="

      return {
        type: "binary",
        operator,
        left,
        right: this.visit(ctx.relationalExpression[1]) as AST.Expression,
      }
    }

    return left
  }

  relationalExpression(ctx: RelationalExpressionCstChildren): AST.Expression {
    const left = this.visit(ctx.setExpression[0]) as AST.Expression

    // Check for IS [NOT] NULL
    if (ctx.Is) {
      return {
        type: "isNull",
        expression: left,
        not: !!ctx.Not,
      }
    }

    // Check for relational operators (<, <=, >, >=)
    if (ctx.setExpression && ctx.setExpression.length > 1) {
      let operator = ""
      if (ctx.LessThan) operator = "<"
      else if (ctx.LessThanOrEqual) operator = "<="
      else if (ctx.GreaterThan) operator = ">"
      else if (ctx.GreaterThanOrEqual) operator = ">="

      return {
        type: "binary",
        operator,
        left,
        right: this.visit(ctx.setExpression[1]) as AST.Expression,
      }
    }

    return left
  }

  setExpression(ctx: SetExpressionCstChildren): AST.Expression {
    const left = this.visit(ctx.bitOrExpression[0]) as AST.Expression

    // Check for [NOT] IN
    if (ctx.In) {
      const result: AST.InExpression = {
        type: "in",
        expression: left,
        values: [],
        not: !!ctx.Not,
      }
      if (ctx.LParen) {
        result.parenthesized = true
        result.values = ctx.expression!.map(
          (e: CstNode) => this.visit(e) as AST.Expression,
        )
      } else if (ctx.inValue) {
        result.values = ctx.inValue.map(
          (e: CstNode) => this.visit(e) as AST.Expression,
        )
      }
      return result
    }

    // Check for [NOT] BETWEEN
    if (ctx.Between) {
      return {
        type: "between",
        expression: left,
        low: this.visit(ctx.betweenLow![0]) as AST.Expression,
        high: this.visit(ctx.betweenHigh![0]) as AST.Expression,
        not: !!ctx.Not,
      }
    }

    // Check for WITHIN
    if (ctx.Within) {
      return {
        type: "within",
        expression: left,
        values: ctx.expression!.map(
          (e: CstNode) => this.visit(e) as AST.Expression,
        ),
      }
    }

    // Check for NOT LIKE / NOT ILIKE
    if (ctx.Like || ctx.Ilike) {
      const operator = ctx.Like ? "NOT LIKE" : "NOT ILIKE"
      return {
        type: "binary",
        operator,
        left,
        right: this.visit(ctx.notLikeRight![0]) as AST.Expression,
      }
    }

    return left
  }

  bitOrExpression(ctx: BitOrExpressionCstChildren): AST.Expression {
    let result = this.visit(ctx.bitXorExpression[0]) as AST.Expression

    if (ctx.bitXorExpression.length > 1) {
      for (let i = 1; i < ctx.bitXorExpression.length; i++) {
        result = {
          type: "binary",
          operator: "|",
          left: result,
          right: this.visit(ctx.bitXorExpression[i]) as AST.Expression,
        }
      }
    }

    return result
  }

  bitXorExpression(ctx: BitXorExpressionCstChildren): AST.Expression {
    let result = this.visit(ctx.bitAndExpression[0]) as AST.Expression

    if (ctx.bitAndExpression.length > 1) {
      for (let i = 1; i < ctx.bitAndExpression.length; i++) {
        result = {
          type: "binary",
          operator: "^",
          left: result,
          right: this.visit(ctx.bitAndExpression[i]) as AST.Expression,
        }
      }
    }

    return result
  }

  bitAndExpression(ctx: BitAndExpressionCstChildren): AST.Expression {
    let result = this.visit(ctx.concatExpression[0]) as AST.Expression

    if (ctx.concatExpression.length > 1) {
      for (let i = 1; i < ctx.concatExpression.length; i++) {
        result = {
          type: "binary",
          operator: "&",
          left: result,
          right: this.visit(ctx.concatExpression[i]) as AST.Expression,
        }
      }
    }

    return result
  }

  concatExpression(ctx: ConcatExpressionCstChildren): AST.Expression {
    let result = this.visit(ctx.ipv4ContainmentExpression[0]) as AST.Expression

    if (ctx.ipv4ContainmentExpression.length > 1) {
      for (let i = 1; i < ctx.ipv4ContainmentExpression.length; i++) {
        result = {
          type: "binary",
          operator: "||",
          left: result,
          right: this.visit(ctx.ipv4ContainmentExpression[i]) as AST.Expression,
        }
      }
    }

    return result
  }

  ipv4ContainmentExpression(
    ctx: Ipv4ContainmentExpressionCstChildren,
  ): AST.Expression {
    const left = this.visit(ctx.additiveExpression[0]) as AST.Expression

    if (ctx.additiveExpression.length > 1) {
      let operator: string
      if (ctx.IPv4ContainedByOrEqual) operator = "<<="
      else if (ctx.IPv4ContainedBy) operator = "<<"
      else if (ctx.IPv4ContainsOrEqual) operator = ">>="
      else operator = ">>"

      return {
        type: "binary",
        operator,
        left,
        right: this.visit(ctx.additiveExpression[1]) as AST.Expression,
      }
    }

    return left
  }

  additiveExpression(ctx: AdditiveExpressionCstChildren): AST.Expression {
    let result = this.visit(ctx.multiplicativeExpression[0]) as AST.Expression

    if (ctx.multiplicativeExpression.length > 1) {
      // Collect all operator tokens and sort by position for correct association
      const ops = [
        ...(ctx.Plus || []).map((t: IToken) => ({
          op: "+",
          offset: t.startOffset,
        })),
        ...(ctx.Minus || []).map((t: IToken) => ({
          op: "-",
          offset: t.startOffset,
        })),
      ].sort((a, b) => a.offset - b.offset)

      for (let i = 0; i < ops.length; i++) {
        result = {
          type: "binary",
          operator: ops[i].op,
          left: result,
          right: this.visit(
            ctx.multiplicativeExpression[i + 1],
          ) as AST.Expression,
        }
      }
    }

    return result
  }

  multiplicativeExpression(
    ctx: MultiplicativeExpressionCstChildren,
  ): AST.Expression {
    let result = this.visit(ctx.unaryExpression[0]) as AST.Expression

    if (ctx.unaryExpression.length > 1) {
      // Collect all operator tokens and sort by position for correct association
      const ops = [
        ...(ctx.Star || []).map((t: IToken) => ({
          op: "*",
          offset: t.startOffset,
        })),
        ...(ctx.Divide || []).map((t: IToken) => ({
          op: "/",
          offset: t.startOffset,
        })),
        ...(ctx.Modulo || []).map((t: IToken) => ({
          op: "%",
          offset: t.startOffset,
        })),
      ].sort((a, b) => a.offset - b.offset)

      for (let i = 0; i < ops.length; i++) {
        result = {
          type: "binary",
          operator: ops[i].op,
          left: result,
          right: this.visit(ctx.unaryExpression[i + 1]) as AST.Expression,
        }
      }
    }

    return result
  }

  unaryExpression(ctx: UnaryExpressionCstChildren): AST.Expression {
    const inner = this.visit(ctx.typeCastExpression) as AST.Expression

    if (ctx.Minus) {
      return {
        type: "unary",
        operator: "-",
        operand: inner,
      }
    }

    if (ctx.RegexMatch) {
      return {
        type: "unary",
        operator: "~",
        operand: inner,
      }
    }

    return inner
  }

  typeCastExpression(ctx: TypeCastExpressionCstChildren): AST.Expression {
    let inner = this.visit(ctx.primaryExpression) as AST.Expression

    // Handle array subscripts: expr[i], expr[i:j], expr[i, j]
    // Group subscripts by their enclosing bracket pair so that
    // arr[1, 2] produces a single ArrayAccessExpression with 2 subscripts (nd-array access),
    // while arr[1][2] produces two nested ArrayAccessExpressions (chained access).
    if (ctx.arraySubscript && ctx.LBracket) {
      let subIdx = 0
      for (let i = 0; i < ctx.LBracket.length; i++) {
        const rbOffset = ctx.RBracket![i].startOffset
        const subscripts: (AST.Expression | AST.ArraySlice)[] = []
        while (subIdx < ctx.arraySubscript.length) {
          if (this.getFirstTokenOffset(ctx.arraySubscript[subIdx]) > rbOffset)
            break
          subscripts.push(
            this.visit(ctx.arraySubscript[subIdx]) as
              | AST.Expression
              | AST.ArraySlice,
          )
          subIdx++
        }
        inner = {
          type: "arrayAccess",
          array: inner,
          subscripts,
        } as AST.ArrayAccessExpression
      }
    }

    if (ctx.DoubleColon && ctx.dataType) {
      for (let i = 0; i < ctx.DoubleColon.length; i++) {
        inner = {
          type: "typeCast",
          expression: inner,
          dataType: this.visit(ctx.dataType[i]) as string,
        }
      }
    }

    return inner
  }

  arraySubscript(
    ctx: ArraySubscriptCstChildren,
  ): AST.Expression | AST.ArraySlice {
    const exprs = ctx.expression
      ? ctx.expression.map((e: CstNode) => this.visit(e) as AST.Expression)
      : []

    if (!ctx.Colon) {
      // Simple subscript: expr
      return exprs[0]
    }

    // It's a slice — determine start/end based on token positions
    if (exprs.length === 0) {
      return { type: "arraySlice" } as AST.ArraySlice
    }

    if (exprs.length === 2) {
      // start:end
      return {
        type: "arraySlice",
        start: exprs[0],
        end: exprs[1],
      } as AST.ArraySlice
    }

    // 1 expression + colon — disambiguate start: vs :end using offsets
    const colonOffset = ctx.Colon[0].startOffset
    const exprOffset = this.getFirstTokenOffset(ctx.expression![0])
    if (exprOffset < colonOffset) {
      // Expression before colon: start:
      return { type: "arraySlice", start: exprs[0] } as AST.ArraySlice
    } else {
      // Colon before expression: :end
      return { type: "arraySlice", end: exprs[0] } as AST.ArraySlice
    }
  }

  /**
   * Used in implicitSelectBody so that an incomplete clause (e.g. `trades WHERE price >`)
   * doesn't destroy the entire AST. The fromClause visit succeeds and is kept; the
   * whereClause visit throws on the empty expression shell and is discarded.
   * Without this, parseToAst would return ast:[] for any incomplete implicit select.
   *
   * See tests in parser.test.ts
   */
  private visitSafe(node: CstNode | CstNode[]): unknown {
    try {
      return this.visit(node) as unknown
    } catch {
      // Don't throw further
    }
  }

  /** Get the startOffset of the first token in a CstNode */
  private getFirstTokenOffset(node: CstNode | IToken): number {
    if ("startOffset" in node) return node.startOffset
    let min = Infinity
    for (const children of Object.values(node.children)) {
      if (Array.isArray(children)) {
        for (const child of children) {
          const offset = this.getFirstTokenOffset(child)
          if (offset < min) min = offset
        }
      }
    }
    return min
  }

  primaryExpression(ctx: PrimaryExpressionCstChildren): AST.Expression {
    if (ctx.arrayLiteral) {
      return this.visit(ctx.arrayLiteral) as AST.ArrayLiteral
    }
    if (ctx.castExpression) {
      return this.visit(ctx.castExpression) as AST.CastExpression
    }
    if (ctx.caseExpression) {
      return this.visit(ctx.caseExpression) as AST.CaseExpression
    }
    if (ctx.functionCall) {
      return this.visit(ctx.functionCall) as AST.FunctionCall
    }
    if (ctx.literal) {
      return this.visit(ctx.literal) as AST.Literal
    }
    if (ctx.VariableReference) {
      const image = ctx.VariableReference[0].image // e.g. "@limit"
      return {
        type: "variable",
        name: image.substring(1), // strip leading @
      }
    }
    if (ctx.identifierExpression) {
      return this.visit(ctx.identifierExpression) as AST.Expression
    }
    if (ctx.selectStatement) {
      return {
        type: "subquery",
        query: this.visit(ctx.selectStatement) as AST.SelectStatement,
      } as AST.SubqueryExpression
    }
    if (ctx.expression) {
      const result: AST.ParenExpression = {
        type: "paren",
        expression: this.visit(ctx.expression[0]) as AST.Expression,
      }
      if (ctx.expression.length > 1) {
        result.additionalExpressions = ctx.expression
          .slice(1)
          .map((e: CstNode) => this.visit(e) as AST.Expression)
      }
      return result
    }
    throw new Error("Unknown primary expression")
  }

  arrayLiteral(ctx: ArrayLiteralCstChildren): AST.ArrayLiteral {
    const result = this.visit(ctx.arrayBracketBody) as AST.ArrayLiteral
    result.hasArrayKeyword = true
    return result
  }

  arrayBracketBody(ctx: ArrayBracketBodyCstChildren): AST.ArrayLiteral {
    const elements: (AST.Expression | AST.ArrayLiteral)[] = []
    if (ctx.arrayElement) {
      for (const elem of ctx.arrayElement) {
        elements.push(this.visit(elem) as AST.Expression | AST.ArrayLiteral)
      }
    }
    return {
      type: "arrayLiteral",
      elements,
    }
  }

  arrayElement(
    ctx: ArrayElementCstChildren,
  ): AST.Expression | AST.ArrayLiteral {
    if (ctx.arrayBracketBody) {
      return this.visit(ctx.arrayBracketBody) as AST.ArrayLiteral
    }
    return this.visit(ctx.expression!) as AST.Expression
  }

  castExpression(ctx: CastExpressionCstChildren): AST.CastExpression {
    return {
      type: "cast",
      expression: this.visit(ctx.expression) as AST.Expression,
      dataType: this.visit(ctx.dataType) as string,
    }
  }

  dataType(ctx: DataTypeCstChildren): string {
    // GEOHASH with precision: GEOHASH(8c)
    if (ctx.Geohash) {
      let result = "GEOHASH"
      if (ctx.NumberLiteral && ctx.identifier) {
        const precision = ctx.NumberLiteral[0].image
        const unit = this.extractIdentifierName(ctx.identifier[0].children)
        result += `(${precision}${unit})`
      }
      // Append array dimensions
      if (ctx.LBracket) {
        for (let i = 0; i < ctx.LBracket.length; i++) result += "[]"
      }
      return result
    }

    // DECIMAL with optional precision: DECIMAL(18, 2) or DECIMAL(18)
    if (ctx.Decimal) {
      let result = "DECIMAL"
      if (ctx.NumberLiteral && ctx.NumberLiteral.length > 0) {
        const nums = ctx.NumberLiteral.map((n: IToken) => n.image)
        result += `(${nums.join(", ")})`
      }
      if (ctx.LBracket) {
        for (let i = 0; i < ctx.LBracket.length; i++) result += "[]"
      }
      return result
    }

    // All other types: find the first token image, then append array dims
    let baseType = "UNKNOWN"
    for (const key of Object.keys(ctx)) {
      if (
        key === "LBracket" ||
        key === "RBracket" ||
        key === "LParen" ||
        key === "RParen" ||
        key === "Comma" ||
        key === "NumberLiteral" ||
        key === "identifier"
      )
        continue
      const tokens = (ctx as Record<string, IToken[]>)[key]
      if (Array.isArray(tokens) && tokens.length > 0 && tokens[0].image) {
        baseType = tokens[0].image.toUpperCase()
        break
      }
    }

    // Append array dimensions: DOUBLE[], DOUBLE[][]
    if (ctx.LBracket) {
      for (let i = 0; i < ctx.LBracket.length; i++) baseType += "[]"
    }

    return baseType
  }

  caseExpression(ctx: CaseExpressionCstChildren): AST.CaseExpression {
    const whenClauses: { when: AST.Expression; then: AST.Expression }[] = []
    const expressions = ctx.expression || []
    const whenCount = ctx.When ? ctx.When.length : 0
    const hasElse = !!ctx.Else

    // Simple CASE has: operand + whenCount*2 pairs + optional else = operand + whenCount*2 [+ 1]
    // Searched CASE has: whenCount*2 pairs + optional else = whenCount*2 [+ 1]
    const expectedWithoutOperand = whenCount * 2 + (hasElse ? 1 : 0)
    const hasOperand = expressions.length > expectedWithoutOperand

    let offset = 0
    const result: AST.CaseExpression = { type: "case", whenClauses }

    if (hasOperand) {
      result.operand = this.visit(expressions[0]) as AST.Expression
      offset = 1
    }

    for (let i = 0; i < whenCount; i++) {
      const whenIdx = offset + i * 2
      const thenIdx = offset + i * 2 + 1
      if (expressions[whenIdx] && expressions[thenIdx]) {
        whenClauses.push({
          when: this.visit(expressions[whenIdx]) as AST.Expression,
          then: this.visit(expressions[thenIdx]) as AST.Expression,
        })
      }
    }

    if (hasElse) {
      result.elseClause = this.visit(
        expressions[expressions.length - 1],
      ) as AST.Expression
    }

    return result
  }

  functionName(ctx: FunctionNameCstChildren): string {
    if (ctx.identifier) {
      return (this.visit(ctx.identifier) as AST.QualifiedName).parts[0]
    }
    if (ctx.Left) return ctx.Left[0].image
    if (ctx.Right) return ctx.Right[0].image
    return ""
  }

  functionCall(ctx: FunctionCallCstChildren): AST.FunctionCall {
    const result: AST.FunctionCall = {
      type: "function",
      name: this.visit(ctx.functionName) as string,
      args: [],
    }

    if (ctx.Star) {
      result.star = true
    } else if (ctx.expression) {
      result.args = ctx.expression.map(
        (e: CstNode) => this.visit(e) as AST.Expression,
      )
    }

    if (ctx.Distinct) {
      result.distinct = true
    }

    if (ctx.From) {
      result.fromSeparator = true
    }

    if (ctx.Ignore) {
      result.ignoreNulls = true
    }
    if (ctx.Respect) {
      result.respectNulls = true
    }

    if (ctx.overClause) {
      result.over = this.visit(ctx.overClause) as AST.WindowSpecification
    }

    return result
  }

  identifierExpression(ctx: IdentifierExpressionCstChildren): AST.Expression {
    const qualName: AST.QualifiedName = this.visit(
      ctx.qualifiedName,
    ) as AST.QualifiedName

    if (ctx.LParen) {
      // Function call (possibly schema-qualified)
      const result: AST.FunctionCall = {
        type: "function",
        name: qualName.parts.join("."),
        args: [],
      }
      if (ctx.Star) {
        result.star = true
      } else if (ctx.expression) {
        result.args = ctx.expression.map(
          (e: CstNode) => this.visit(e) as AST.Expression,
        )
      }
      if (ctx.Distinct) {
        result.distinct = true
      }
      if (ctx.From) {
        result.fromSeparator = true
      }
      if (ctx.Ignore) {
        result.ignoreNulls = true
      }
      if (ctx.Respect) {
        result.respectNulls = true
      }
      if (ctx.selectStatement) {
        result.subquery = this.visit(
          ctx.selectStatement[0],
        ) as AST.SelectStatement
      }
      if (ctx.overClause) {
        result.over = this.visit(ctx.overClause) as AST.WindowSpecification
      }
      return result
    }

    // Column reference
    return { type: "column", name: qualName }
  }

  overClause(ctx: OverClauseCstChildren): AST.WindowSpecification {
    const result: AST.WindowSpecification = {
      type: "windowSpec",
    }

    if (ctx.windowPartitionByClause) {
      result.partitionBy = this.visit(
        ctx.windowPartitionByClause,
      ) as AST.Expression[]
    }

    if (ctx.orderByClause) {
      result.orderBy = this.visit(ctx.orderByClause) as AST.OrderByItem[]
    }

    if (ctx.windowFrameClause) {
      result.frame = this.visit(ctx.windowFrameClause) as AST.WindowFrame
    }

    return result
  }

  windowPartitionByClause(
    ctx: WindowPartitionByClauseCstChildren,
  ): AST.Expression[] {
    return ctx.expression.map((e: CstNode) => this.visit(e) as AST.Expression)
  }

  windowFrameClause(ctx: WindowFrameClauseCstChildren): AST.WindowFrame {
    let mode: string
    if (ctx.Rows) mode = "rows"
    else if (ctx.Range) mode = "range"
    else mode = "cumulative"

    const result: AST.WindowFrame = {
      type: "windowFrame",
      mode,
    } as AST.WindowFrame

    if (ctx.windowFrameBound && ctx.windowFrameBound.length > 0) {
      result.start = this.visit(ctx.windowFrameBound[0]) as AST.WindowFrameBound
      if (ctx.windowFrameBound.length > 1) {
        result.end = this.visit(ctx.windowFrameBound[1]) as AST.WindowFrameBound
      }
    }

    if (ctx.Exclude) {
      if (ctx.Current && ctx.Row) {
        result.exclude = "currentRow"
      } else if (ctx.No && ctx.Others) {
        result.exclude = "noOthers"
      }
    }

    return result
  }

  windowFrameBound(ctx: WindowFrameBoundCstChildren): AST.WindowFrameBound {
    if (ctx.Unbounded) {
      return {
        type: "windowFrameBound",
        kind: ctx.Preceding ? "unboundedPreceding" : "unboundedFollowing",
      }
    }

    if (ctx.Current) {
      return {
        type: "windowFrameBound",
        kind: "currentRow",
      }
    }

    if (ctx.durationExpression) {
      return {
        type: "windowFrameBound",
        kind: ctx.Preceding ? "preceding" : "following",
        duration: this.visit(ctx.durationExpression) as string,
      }
    }

    return {
      type: "windowFrameBound",
      kind: ctx.Preceding ? "preceding" : "following",
      value: this.visit(ctx.expression!) as AST.Expression,
    }
  }

  // ==========================================================================
  // Basic Elements
  // ==========================================================================

  literal(ctx: LiteralCstChildren): AST.Literal {
    if (ctx.NumberLiteral) {
      const image = this.tokenImage(ctx.NumberLiteral[0])
      const cleaned = image.replace(/_/g, "")
      return {
        type: "literal",
        value: cleaned.includes(".")
          ? parseFloat(cleaned)
          : parseInt(cleaned, 10),
        literalType: "number",
        raw: image,
      }
    }
    if (ctx.StringLiteral) {
      const raw = this.tokenImage(ctx.StringLiteral[0])
      // Remove outer quotes and unescape '' to '
      const value = raw.slice(1, -1).replace(/''/g, "'")
      return {
        type: "literal",
        value,
        literalType: "string",
      }
    }
    if (ctx.True) {
      return { type: "literal", value: true, literalType: "boolean" }
    }
    if (ctx.False) {
      return { type: "literal", value: false, literalType: "boolean" }
    }
    if (ctx.Null) {
      return { type: "literal", value: null, literalType: "null" }
    }
    if (ctx.LongLiteral) {
      const image = this.tokenImage(ctx.LongLiteral[0])
      const numStr = image.replace(/[Ll_]/g, "")
      const parsed = parseInt(numStr, 10)
      return {
        type: "literal",
        value: Number.isSafeInteger(parsed) ? parsed : numStr,
        literalType: "number",
        raw: image,
      }
    }
    if (ctx.DecimalLiteral) {
      const image = this.tokenImage(ctx.DecimalLiteral[0])
      return {
        type: "literal",
        value: parseFloat(image.replace(/[m_]/g, "")),
        literalType: "number",
        raw: image,
      }
    }
    if (ctx.GeohashLiteral) {
      return {
        type: "literal",
        value: this.tokenImage(ctx.GeohashLiteral[0]),
        literalType: "geohash",
      }
    }
    if (ctx.GeohashBinaryLiteral) {
      return {
        type: "literal",
        value: this.tokenImage(ctx.GeohashBinaryLiteral[0]),
        literalType: "geohash",
      }
    }
    if (ctx.DurationLiteral) {
      return {
        type: "literal",
        value: this.tokenImage(ctx.DurationLiteral[0]),
        literalType: "duration",
      }
    }
    if (ctx.Nan) {
      return {
        type: "literal",
        value: NaN,
        literalType: "number",
      }
    }
    throw new Error("Unknown literal type")
  }

  booleanLiteral(ctx: BooleanLiteralCstChildren): boolean {
    return !!ctx.True
  }

  stringOrIdentifier(ctx: StringOrIdentifierCstChildren): string {
    if (ctx.StringLiteral) {
      return ctx.StringLiteral[0].image.slice(1, -1)
    }
    if (ctx.identifier) {
      return this.extractIdentifierName(ctx.identifier[0].children)
    }
    return this.extractMaybeString(ctx)
  }

  stringOrQualifiedName(
    ctx: StringOrQualifiedNameCstChildren,
  ): AST.QualifiedName {
    if (ctx.StringLiteral) {
      return {
        type: "qualifiedName",
        parts: [ctx.StringLiteral[0].image.slice(1, -1)],
      }
    }
    if (ctx.qualifiedName)
      return this.visit(ctx.qualifiedName) as AST.QualifiedName
    return { type: "qualifiedName", parts: [] }
  }

  intervalValue(ctx: IntervalValueCstChildren): string {
    return this.extractMaybeString(ctx)
  }

  timeZoneValue(ctx: TimeZoneValueCstChildren): string {
    return this.extractMaybeString(ctx)
  }

  columnRef(ctx: ColumnRefCstChildren): AST.ColumnRef {
    return {
      type: "column",
      name: this.visit(ctx.qualifiedName) as AST.QualifiedName,
    }
  }

  tableName(ctx: TableNameCstChildren): AST.QualifiedName {
    return this.visit(ctx.qualifiedName) as AST.QualifiedName
  }

  tableNameOrString(ctx: TableNameOrStringCstChildren): AST.QualifiedName {
    if (ctx.StringLiteral) {
      return {
        type: "qualifiedName",
        parts: [ctx.StringLiteral[0].image.slice(1, -1)],
      }
    }
    if (ctx.tableName) return this.visit(ctx.tableName) as AST.QualifiedName
    return { type: "qualifiedName", parts: [] }
  }

  qualifiedName(ctx: QualifiedNameCstChildren): AST.QualifiedName {
    const parts: string[] = ctx.identifier.map((id: CstNode) => {
      return this.extractIdentifierName(id.children)
    })

    return {
      type: "qualifiedName",
      parts,
    }
  }

  private extractMaybeString(node: CstNode | CstChildrenRecord): string {
    if (!node) return ""
    const ctx: CstChildrenRecord =
      "name" in node && "children" in node ? (node as CstNode).children : node
    if (ctx.StringLiteral) {
      const raw = this.tokenImage(ctx.StringLiteral[0] as IToken)
      return raw.slice(1, -1)
    }
    if (ctx.NumberLiteral) {
      return this.tokenImage(ctx.NumberLiteral[0] as IToken)
    }
    if (ctx.DurationLiteral) {
      return this.tokenImage(ctx.DurationLiteral[0] as IToken)
    }
    if (ctx.Identifier) {
      return this.tokenImage(ctx.Identifier[0] as IToken)
    }
    if (ctx.QuotedIdentifier) {
      const raw = this.tokenImage(ctx.QuotedIdentifier[0] as IToken)
      return raw.slice(1, -1).replace(/""/g, '"')
    }
    if (ctx.IdentifierKeyword) {
      return this.tokenImage(ctx.IdentifierKeyword[0] as IToken)
    }
    // Handle identifier subrule (lowercase) — wraps Identifier/QuotedIdentifier/IdentifierKeyword
    if (ctx.identifier) {
      return this.extractMaybeString((ctx.identifier as CstNode[])[0])
    }
    return ""
  }

  private extractTtl(ctx: CstChildrenRecord): {
    value: number
    unit: "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
  } {
    // Handle DurationLiteral (e.g., "2w", "12h", "30d")
    if (ctx.DurationLiteral) {
      const img = (ctx.DurationLiteral[0] as IToken).image
      const match = img.match(/^(\d+)(.+)$/)
      if (match) {
        const DURATION_UNIT_MAP: Record<
          string,
          "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
        > = {
          h: "HOURS",
          d: "DAYS",
          w: "WEEKS",
          M: "MONTHS",
          y: "YEARS",
        }
        const unit = DURATION_UNIT_MAP[match[2]]
        if (!unit) {
          throw new Error(
            `Invalid TTL duration unit '${match[2]}' in '${img}'. Valid units: h (HOURS), d (DAYS), w (WEEKS), M (MONTHS), y (YEARS)`,
          )
        }
        return {
          value: parseInt(match[1], 10),
          unit,
        }
      }
    }
    // Handle NumberLiteral + optional timeUnit (e.g., "2 WEEKS")
    const value = parseInt(
      (ctx.NumberLiteral?.[0] as IToken | undefined)?.image ?? "0",
      10,
    )
    let unit: "HOURS" | "DAYS" | "WEEKS" | "MONTHS" | "YEARS" = "DAYS"
    if (ctx.timeUnit) {
      unit = this.visit(ctx.timeUnit as CstNode[]) as typeof unit
      // Check plural forms first (TTL units) before singular (which may be PARTITION BY units)
    } else if (ctx.Hours) unit = "HOURS"
    else if (ctx.Days) unit = "DAYS"
    else if (ctx.Weeks) unit = "WEEKS"
    else if (ctx.Months) unit = "MONTHS"
    else if (ctx.Years) unit = "YEARS"
    else if (ctx.Hour) unit = "HOURS"
    else if (ctx.Day) unit = "DAYS"
    else if (ctx.Week) unit = "WEEKS"
    else if (ctx.Month) unit = "MONTHS"
    else if (ctx.Year) unit = "YEARS"
    return { value, unit }
  }

  // Helper to extract identifier name from token (regular, quoted, or keyword)
  private extractIdentifierName(ctx: CstChildrenRecord): string {
    if (ctx.Identifier) {
      return this.tokenImage(ctx.Identifier[0] as IToken)
    }
    if (ctx.QuotedIdentifier) {
      const raw = this.tokenImage(ctx.QuotedIdentifier[0] as IToken)
      return raw.slice(1, -1).replace(/""/g, '"')
    }
    // QuestDB accepts single-quoted strings in identifier positions
    if (ctx.StringLiteral) {
      const raw = this.tokenImage(ctx.StringLiteral[0] as IToken)
      return raw.slice(1, -1).replace(/''/g, "'")
    }
    // Handle keyword tokens used as identifiers
    // Find the first token in the context
    for (const key of Object.keys(ctx)) {
      const tokens = ctx[key]
      if (Array.isArray(tokens) && tokens.length > 0) {
        const token = tokens[0]
        if (token && "image" in token && typeof token.image === "string") {
          return token.image
        }
      }
    }
    return ""
  }

  identifier(ctx: IdentifierCstChildren): AST.QualifiedName {
    const name = this.extractIdentifierName(ctx)
    return {
      type: "qualifiedName",
      parts: [name],
    }
  }
}

export const visitor = new QuestDBVisitor()
