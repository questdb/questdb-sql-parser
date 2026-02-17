import {
  CstParser,
  type TokenType,
  NoViableAltException,
  EarlyExitException,
  tokenMatcher,
  EOF,
} from "chevrotain"

// Chevrotain internal members not exposed in the public API types.
// Used for custom error recovery and token position tracking.
interface CstParserInternals {
  currIdx: number
  SAVE_ERROR(error: Error): Error
  findReSyncTokenType(): TokenType
}
import {
  allTokens,
  tokenize,
  Select,
  From,
  Where,
  As,
  Comma,
  Star,
  Identifier,
  QuotedIdentifier,
  StringLiteral,
  NumberLiteral,
  LParen,
  RParen,
  And,
  Or,
  Not,
  Equals,
  NotEquals,
  LessThan,
  LessThanOrEqual,
  GreaterThan,
  GreaterThanOrEqual,
  Dot,
  Semicolon,
  Sample,
  By,
  DurationLiteral,
  Latest,
  On,
  Partition,
  Limit,
  Order,
  Asc,
  Desc,
  Group,
  Join,
  Inner,
  Left,
  Right,
  Full,
  Outer,
  Cross,
  Asof,
  Lt,
  Splice,
  Insert,
  Into,
  Values,
  Update,
  Set,
  Create,
  Table,
  Tables,
  Drop,
  Alter,
  True,
  False,
  Null,
  In,
  Between,
  Like,
  Is,
  Case,
  When,
  Then,
  Else,
  End,
  Distinct,
  All,
  Union,
  Except,
  Intersect,
  Cast,
  With,
  If,
  Exists,
  Truncate,
  Rename,
  To,
  Show,
  Columns,
  Partitions,
  Explain,
  Bypass,
  Wal,
  None,
  Hour,
  Day,
  Week,
  Month,
  Year,
  Ttl,
  Hours,
  Days,
  Weeks,
  Months,
  Years,
  Minute,
  Minutes,
  Second,
  Seconds,
  Millisecond,
  Milliseconds,
  Microsecond,
  Microseconds,
  Nanosecond,
  Nanoseconds,
  Dedup,
  Upsert,
  Keys,
  Add,
  Attach,
  Detach,
  Squash,
  Cache,
  Nocache,
  List,
  Assume,
  Service,
  Account,
  Accounts,
  Cancel,
  Query,
  Token,
  Jwk,
  Rest,
  Password,
  No,
  Enable,
  Disable,
  Declare,
  Exit,
  Copy,
  Grant,
  Revoke,
  Permissions,
  Option,
  Verification,
  ServerVersion,
  Parameters,
  Users,
  Groups,
  Remove,
  Checkpoint,
  Snapshot,
  Prepare,
  Complete,
  Release,
  Vacuum,
  Resume,
  Transaction,
  Txn,
  Param,
  Atomic,
  Batch,
  O3MaxLag,
  Owned,
  PartitionBy,
  RawArrayEncoding,
  SkipRow,
  SkipColumn,
  Uncompressed,
  Snappy,
  Gzip,
  Lz4,
  Zstd,
  Lz4Raw,
  Brotli,
  Lzo,
  Header,
  Delimiter,
  Format,
  Error,
  Abort,
  StatisticsEnabled,
  CompressionCodec,
  CompressionLevel,
  Capacity,
  RowGroupSize,
  DataPageSize,
  ParquetVersion,
  Zone,
  Period,
  Length,
  Delay,
  Incremental,
  Pivot,
  For,
  Align,
  Calendar,
  Observation,
  Fill,
  Reindex,
  Replace,
  Lock,
  Exclusive,
  VariableReference,
  ColonEquals,
  RegexMatch,
  RegexNotMatch,
  RegexNotEquals,
  Concat,
  DoubleColon,
  Plus,
  Minus,
  Divide,
  Modulo,
  Ilike,
  // Data type keywords that can be used as identifiers
  Symbol,
  Timestamp,
  Date,
  Time,
  Int,
  Integer,
  Long,
  Long128,
  Long256,
  Short,
  Byte,
  Float,
  Double,
  Boolean,
  String,
  Char,
  Binary,
  Uuid,
  Ipv4,
  Geohash,
  Varchar,
  Decimal,
  Interval,
  TimestampNs,
  // Other keywords commonly used as identifiers
  Index,
  Isolation,
  Column,
  Type,
  Level,
  Offset,
  Only,
  First,
  Volume,
  Start,
  Current,
  Row,
  User,
  Default,
  View,
  Tolerance,
  Materialized,
  Refresh,
  Every,
  Immediate,
  Manual,
  Deferred,
  Base,
  Range,
  Over,
  Rows,
  Preceding,
  Following,
  Unbounded,
  BitAnd,
  BitXor,
  BitOr,
  Within,
  Overridable,
  LBracket,
  RBracket,
  Colon,
  Suspend,
  Convert,
  Include,
  GeohashBinaryLiteral,
  GeohashLiteral,
  LongLiteral,
  DecimalLiteral,
  Window,
  Ignore,
  Nulls,
  Exclude,
  Cumulative,
  Others,
  Natural,
  Database,
  Backup,
  Prevailing,
  NaN,
  External,
  Alias,
  Compile,
  IdentifierKeyword,
} from "./lexer"

class QuestDBParser extends CstParser {
  constructor(config?: { skipValidations?: boolean }) {
    super(allTokens, {
      recoveryEnabled: true,
      skipValidations: config?.skipValidations ?? true,
      maxLookahead: 2,
    })
    this.performSelfAnalysis()
  }

  // Semicolon-bounded recovery state.
  // _semicolonBoundedRecovery is set to true in the MANY body of `statements`
  // before entering `statement`, and cleared after it returns.
  // _statementStartIdx records the token index when statement's callback begins,
  // so findReSyncTokenType can check whether the error is from the statement's
  // own OR (no tokens consumed) vs. a cascade from inside a matched subrule.
  private _semicolonBoundedRecovery = false
  private _statementStartIdx = -1

  findReSyncTokenType(): TokenType {
    if (this._semicolonBoundedRecovery) {
      const currIdx = (this as unknown as CstParserInternals).currIdx
      // Only use semicolon-bounded recovery when no tokens have been consumed
      // since statement entered — meaning the statement's OR itself failed
      // (NoViableAltException, no alternative matched).
      // When tokens WERE consumed, the error cascaded from inside a matched
      // subrule (e.g. selectStatement→expression).  In that case, default
      // recovery is correct — it avoids skipping to a distant semicolon.
      if (currIdx === this._statementStartIdx) {
        let k = 1
        while (true) {
          const tok = this.LA(k)
          if (tokenMatcher(tok, EOF)) break
          if (tokenMatcher(tok, Semicolon)) return Semicolon
          k++
        }
      }
    }
    // Fall back to default behavior
    return (
      CstParser.prototype as unknown as CstParserInternals
    ).findReSyncTokenType.call(this)
  }

  // Override to avoid expensive getLookaheadPathsForOr computation.
  // With ~70 alternatives in the identifier rule, the default implementation
  // generates thousands of lookahead path combinations which blocks the UI.
  raiseNoAltException(occurrence: number, errMsgTypes: string) {
    const actual = this.LA(1)
    const previous = this.LA(0)
    const errMsg = errMsgTypes
      ? `Expecting: ${errMsgTypes}\nbut found: '${actual.image}'`
      : `Unexpected token: '${actual.image}'`
    throw (this as unknown as CstParserInternals).SAVE_ERROR(
      new NoViableAltException(errMsg, actual, previous),
    )
  }

  raiseEarlyExitException(
    occurrence: number,
    prodType: number,
    userDefinedErrMsg: string,
  ) {
    const actual = this.LA(1)
    const previous = this.LA(0)
    const errMsg = userDefinedErrMsg
      ? `Expecting: ${userDefinedErrMsg}\nbut found: '${actual.image}'`
      : `Unexpected token: '${actual.image}', expecting at least one iteration`
    throw (this as unknown as CstParserInternals).SAVE_ERROR(
      new EarlyExitException(errMsg, actual, previous),
    )
  }

  // Helper: check if a token type is a time unit
  private isTimeUnit(tokenType: TokenType): boolean {
    return (
      tokenType === Hour ||
      tokenType === Hours ||
      tokenType === Day ||
      tokenType === Days ||
      tokenType === Week ||
      tokenType === Weeks ||
      tokenType === Month ||
      tokenType === Months ||
      tokenType === Year ||
      tokenType === Years ||
      tokenType === Minute ||
      tokenType === Minutes ||
      tokenType === Second ||
      tokenType === Seconds ||
      tokenType === Millisecond ||
      tokenType === Milliseconds ||
      tokenType === Microsecond ||
      tokenType === Microseconds ||
      tokenType === Nanosecond ||
      tokenType === Nanoseconds
    )
  }

  // ==========================================================================
  // Entry point
  // ==========================================================================

  public statements = this.RULE("statements", () => {
    this.MANY(() => {
      this._semicolonBoundedRecovery = true
      this.SUBRULE(this.statement)
      this._semicolonBoundedRecovery = false
      this.OPTION(() => this.CONSUME(Semicolon))
    })
  })

  // Lazy-initialized BACKTRACK for WITH ... INSERT disambiguation
  private _insertBacktrack: (() => boolean) | null = null
  private getInsertBacktrack(): boolean {
    if (!this._insertBacktrack) {
      this._insertBacktrack = this.BACKTRACK(this.insertStatement)
    }
    return this._insertBacktrack()
  }

  public statement = this.RULE("statement", () => {
    // Record token position so findReSyncTokenType can distinguish
    // "statement's OR failed" (no tokens consumed) from "error cascaded
    // from inside a matched subrule" (tokens consumed).
    this._statementStartIdx = (this as unknown as CstParserInternals).currIdx
    this.OR([
      {
        // Use simple token check for INSERT (common case) so error recovery
        // works for incomplete statements. Only fall back to BACKTRACK for
        // WITH ... INSERT (ambiguous with selectStatement's WITH clause).
        GATE: () => {
          const la1 = this.LA(1).tokenType
          if (la1 === Insert) return true
          if (la1 === With) return this.getInsertBacktrack()
          return false
        },
        ALT: () => this.SUBRULE(this.insertStatement),
      },
      {
        GATE: this.BACKTRACK(this.updateStatement),
        ALT: () => this.SUBRULE(this.updateStatement),
      },
      { ALT: () => this.SUBRULE(this.selectStatement) },
      { ALT: () => this.SUBRULE(this.createStatement) },
      { ALT: () => this.SUBRULE(this.dropStatement) },
      { ALT: () => this.SUBRULE(this.truncateTableStatement) },
      { ALT: () => this.SUBRULE(this.renameTableStatement) },
      { ALT: () => this.SUBRULE(this.addUserStatement) },
      { ALT: () => this.SUBRULE(this.removeUserStatement) },
      { ALT: () => this.SUBRULE(this.assumeServiceAccountStatement) },
      { ALT: () => this.SUBRULE(this.exitServiceAccountStatement) },
      { ALT: () => this.SUBRULE(this.cancelQueryStatement) },
      { ALT: () => this.SUBRULE(this.showStatement) },
      { ALT: () => this.SUBRULE(this.explainStatement) },
      { ALT: () => this.SUBRULE(this.alterStatement) },
      { ALT: () => this.SUBRULE(this.copyStatement) },
      { ALT: () => this.SUBRULE(this.checkpointStatement) },
      { ALT: () => this.SUBRULE(this.snapshotStatement) },
      {
        GATE: this.BACKTRACK(this.grantAssumeServiceAccountStatement),
        ALT: () => this.SUBRULE(this.grantAssumeServiceAccountStatement),
      },
      {
        GATE: this.BACKTRACK(this.revokeAssumeServiceAccountStatement),
        ALT: () => this.SUBRULE(this.revokeAssumeServiceAccountStatement),
      },
      { ALT: () => this.SUBRULE(this.grantStatement) },
      { ALT: () => this.SUBRULE(this.revokeStatement) },
      { ALT: () => this.SUBRULE(this.vacuumTableStatement) },
      { ALT: () => this.SUBRULE(this.resumeWalStatement) },
      { ALT: () => this.SUBRULE(this.setTypeStatement) },
      { ALT: () => this.SUBRULE(this.reindexTableStatement) },
      { ALT: () => this.SUBRULE(this.refreshMaterializedViewStatement) },
      {
        GATE: this.BACKTRACK(this.pivotStatement),
        ALT: () => this.SUBRULE(this.pivotStatement),
      },
      { ALT: () => this.SUBRULE(this.backupStatement) },
      {
        GATE: () =>
          this.LA(1).tokenType === Compile && this.LA(2).tokenType === View,
        ALT: () => this.SUBRULE(this.compileViewStatement),
      },
      { ALT: () => this.SUBRULE(this.implicitSelectStatement) },
    ])
  })

  // ==========================================================================
  // SELECT Statement
  // ==========================================================================

  private selectStatement = this.RULE("selectStatement", () => {
    this.OPTION(() => this.SUBRULE(this.declareClause))
    this.OPTION2(() => this.SUBRULE(this.withClause))
    this.SUBRULE(this.simpleSelect)
    this.MANY(() => {
      this.SUBRULE(this.setOperation)
    })
  })

  private withClause = this.RULE("withClause", () => {
    this.CONSUME(With)
    this.SUBRULE(this.cteDefinition)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.cteDefinition)
    })
  })

  private cteDefinition = this.RULE("cteDefinition", () => {
    this.SUBRULE(this.identifier)
    this.CONSUME(As)
    this.CONSUME(LParen)
    this.OR([
      {
        GATE: () => {
          const la1 = this.LA(1).tokenType
          return la1 === Select || la1 === With || la1 === Declare
        },
        ALT: () => this.SUBRULE(this.selectStatement),
      },
      { ALT: () => this.SUBRULE(this.implicitSelectStatement) },
    ])
    this.CONSUME(RParen)
  })

  private simpleSelect = this.RULE("simpleSelect", () => {
    this.CONSUME(Select)
    this.OPTION(() => this.CONSUME(Distinct))
    this.SUBRULE(this.selectList)
    this.OPTION1(() => {
      this.CONSUME(From)
      this.SUBRULE(this.fromClause)
      this.OPTION2(() => this.SUBRULE(this.whereClause))
      this.OPTION3(() => this.SUBRULE(this.sampleByClause))
      this.OPTION4(() => this.SUBRULE(this.latestOnClause))
      this.OPTION5(() => this.SUBRULE(this.groupByClause))
      // PIVOT clause: SELECT * FROM t PIVOT (agg FOR col IN (...))
      this.OPTION9(() => {
        this.CONSUME(Pivot)
        this.CONSUME(LParen)
        this.SUBRULE(this.pivotBody)
        this.CONSUME(RParen)
      })
      this.OPTION6(() => this.SUBRULE(this.orderByClause))
      this.OPTION8(() => this.SUBRULE(this.windowDefinitionClause))
      this.OPTION7(() => this.SUBRULE(this.limitClause))
    })
  })

  private setOperation = this.RULE("setOperation", () => {
    this.OR([
      { ALT: () => this.CONSUME(Union) },
      { ALT: () => this.CONSUME(Except) },
      { ALT: () => this.CONSUME(Intersect) },
    ])
    this.OPTION(() => this.CONSUME(All))
    // Right operand: full SELECT or bare table/implicit form
    this.OR1([
      { ALT: () => this.SUBRULE(this.simpleSelect) },
      { ALT: () => this.SUBRULE(this.implicitSelectBody) },
    ])
  })

  private selectList = this.RULE("selectList", () => {
    this.OR([
      {
        GATE: () => this.LA(1).tokenType === Star,
        ALT: () => {
          this.CONSUME(Star)
          // Allow additional items after *: SELECT *, rank() OVER ...
          this.MANY(() => {
            this.CONSUME(Comma)
            this.SUBRULE1(this.selectItem)
          })
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.selectItem)
          this.MANY1(() => {
            this.CONSUME1(Comma)
            this.SUBRULE2(this.selectItem)
          })
        },
      },
    ])
  })

  private selectItem = this.RULE("selectItem", () => {
    this.OR([
      {
        GATE: this.BACKTRACK(this.qualifiedStar),
        ALT: () => this.SUBRULE(this.qualifiedStar),
      },
      { ALT: () => this.SUBRULE(this.expression) },
    ])
    this.OPTION({
      GATE: () => {
        // If next token is AS, always allow (explicit alias)
        if (this.LA(1).tokenType === As) return true
        // Don't consume identifier as alias if followed by LParen —
        // it's a function call starting a new statement, not an alias
        return this.LA(2).tokenType !== LParen
      },
      DEF: () => {
        this.OPTION1(() => this.CONSUME(As))
        this.SUBRULE(this.identifier)
      },
    })
  })

  private qualifiedStar = this.RULE("qualifiedStar", () => {
    this.SUBRULE(this.identifier)
    this.MANY(() => {
      this.CONSUME(Dot)
      this.SUBRULE1(this.identifier)
    })
    this.CONSUME1(Dot)
    this.CONSUME(Star)
  })

  // ==========================================================================
  // FROM Clause
  // ==========================================================================

  private fromClause = this.RULE("fromClause", () => {
    this.SUBRULE(this.tableRef)
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.joinClause) },
        {
          ALT: () => {
            this.CONSUME(Comma)
            this.SUBRULE1(this.tableRef)
          },
        },
      ])
    })
  })

  // Implicit SELECT body: allows bare table references with optional clauses
  // inside parentheses, e.g. (tableName), (tableName WHERE ...), (tableName LATEST ON ...)
  // QuestDB treats these as implicit SELECT * FROM ...
  private implicitSelectBody = this.RULE("implicitSelectBody", () => {
    this.SUBRULE(this.fromClause)
    this.OPTION(() => this.SUBRULE(this.whereClause))
    this.OPTION1(() => this.SUBRULE(this.sampleByClause))
    this.OPTION2(() => this.SUBRULE(this.latestOnClause))
    this.OPTION3(() => this.SUBRULE(this.groupByClause))
    this.OPTION4(() => this.SUBRULE(this.orderByClause))
    this.OPTION5(() => this.SUBRULE(this.limitClause))
  })

  // Implicit SELECT statement: bare table reference with optional clauses and set operations.
  // Used at the top-level statement dispatch for queries like: sensor_1 UNION sensor_2
  private implicitSelectStatement = this.RULE("implicitSelectStatement", () => {
    this.SUBRULE(this.implicitSelectBody)
    this.MANY(() => {
      this.SUBRULE(this.setOperation)
    })
  })

  private tableRef = this.RULE("tableRef", () => {
    this.OR([
      {
        // Standard subquery: (SELECT ...), (WITH ...), (DECLARE ...)
        GATE: () => {
          const la2 = this.LA(2).tokenType
          return la2 === Select || la2 === With || la2 === Declare
        },
        ALT: () => {
          this.CONSUME(LParen)
          this.SUBRULE(this.selectStatement)
          this.CONSUME(RParen)
        },
      },
      {
        // Parenthesized SHOW statement as table source: (SHOW PARAMETERS), (SHOW TABLES), etc.
        GATE: () => this.LA(2).tokenType === Show,
        ALT: () => {
          this.CONSUME3(LParen)
          this.SUBRULE(this.showStatement)
          this.CONSUME3(RParen)
        },
      },
      {
        // Implicit SELECT with optional set operations: (tableName ...), (t1 UNION t2), etc.
        ALT: () => {
          this.CONSUME2(LParen)
          this.SUBRULE(this.implicitSelectStatement)
          this.CONSUME2(RParen)
        },
      },
      {
        GATE: this.BACKTRACK(this.tableFunctionCall),
        ALT: () => this.SUBRULE(this.tableFunctionCall),
      },
      {
        // @variable reference as table source (DECLARE @subquery := (...); SELECT * FROM @subquery)
        ALT: () => this.CONSUME(VariableReference),
      },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.SUBRULE(this.qualifiedName) },
    ])
    // Optional TIMESTAMP designation on subquery/table results
    this.OPTION2(() => {
      this.CONSUME(Timestamp)
      this.CONSUME1(LParen)
      this.SUBRULE1(this.columnRef)
      this.CONSUME1(RParen)
    })
    // Optional alias — but NOT if the next token starts a clause
    // (e.g., LATEST ON/BY should not be consumed as alias)
    this.OPTION({
      GATE: () => {
        const la1 = this.LA(1).tokenType
        // Don't consume LATEST as alias when followed by ON or BY (latestOnClause)
        if (la1 === Latest) {
          const la2 = this.LA(2).tokenType
          return la2 !== On && la2 !== By
        }
        // If next token is AS, always allow (explicit alias)
        if (la1 === As) return true
        // Don't consume identifier as alias if followed by LParen —
        // it's a function call starting a new statement, not an alias
        return this.LA(2).tokenType !== LParen
      },
      DEF: () => {
        this.OR1([
          {
            ALT: () => {
              this.CONSUME(As)
              this.SUBRULE(this.identifier)
            },
          },
          {
            ALT: () => this.SUBRULE1(this.identifier),
          },
        ])
      },
    })
  })

  private tableFunctionCall = this.RULE("tableFunctionCall", () => {
    this.SUBRULE(this.tableFunctionName)
    this.CONSUME(LParen)
    this.OPTION(() => {
      this.SUBRULE(this.expression)
      this.MANY(() => {
        this.CONSUME(Comma)
        this.SUBRULE1(this.expression)
      })
    })
    this.CONSUME(RParen)
  })

  private tableFunctionName = this.RULE("tableFunctionName", () => {
    this.SUBRULE(this.identifier)
  })

  private joinClause = this.RULE("joinClause", () => {
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(Inner) },
        { ALT: () => this.CONSUME(Left) },
        { ALT: () => this.CONSUME(Right) },
        { ALT: () => this.CONSUME(Full) },
        { ALT: () => this.CONSUME(Cross) },
        { ALT: () => this.CONSUME(Asof) },
        { ALT: () => this.CONSUME(Lt) },
        { ALT: () => this.CONSUME(Splice) },
        { ALT: () => this.CONSUME(Window) },
        { ALT: () => this.CONSUME(Natural) },
        { ALT: () => this.CONSUME(Prevailing) },
      ])
      this.OPTION1(() => this.CONSUME(Outer))
    })
    this.CONSUME(Join)
    this.SUBRULE(this.tableRef)
    this.OPTION2(() => {
      this.CONSUME(On)
      this.SUBRULE(this.expression)
    })
    // TOLERANCE clause for ASOF and LT joins (QuestDB-specific)
    this.OPTION3(() => {
      this.CONSUME(Tolerance)
      this.CONSUME(DurationLiteral)
    })
    // RANGE BETWEEN clause for WINDOW JOIN
    this.OPTION4(() => {
      this.CONSUME(Range)
      this.CONSUME(Between)
      this.SUBRULE(this.windowJoinBound)
      this.CONSUME(And)
      this.SUBRULE1(this.windowJoinBound)
    })
    // INCLUDE/EXCLUDE PREVAILING clause for WINDOW JOIN
    this.OPTION5(() => {
      this.OR3([
        { ALT: () => this.CONSUME(Include) },
        { ALT: () => this.CONSUME(Exclude) },
      ])
      this.CONSUME1(Prevailing)
    })
  })

  // Window join bound: <number> <timeUnit> PRECEDING/FOLLOWING | CURRENT ROW [PRECEDING/FOLLOWING] | DurationLiteral PRECEDING/FOLLOWING
  private windowJoinBound = this.RULE("windowJoinBound", () => {
    this.OR([
      {
        GATE: () => this.LA(1).tokenType === Current,
        ALT: () => {
          this.CONSUME(Current)
          this.CONSUME(Row)
          this.OPTION(() => {
            this.OR1([
              { ALT: () => this.CONSUME(Preceding) },
              { ALT: () => this.CONSUME(Following) },
            ])
          })
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.durationExpression)
          this.OR2([
            { ALT: () => this.CONSUME1(Preceding) },
            { ALT: () => this.CONSUME1(Following) },
          ])
        },
      },
    ])
  })

  // Duration expression: DurationLiteral | NumberLiteral timeUnit
  private durationExpression = this.RULE("durationExpression", () => {
    this.OR([
      { ALT: () => this.CONSUME(DurationLiteral) },
      {
        ALT: () => {
          this.OR1([
            { ALT: () => this.CONSUME(NumberLiteral) },
            { ALT: () => this.CONSUME(StringLiteral) },
          ])
          this.SUBRULE(this.timeUnit)
        },
      },
    ])
  })

  // ==========================================================================
  // WHERE Clause
  // ==========================================================================

  private whereClause = this.RULE("whereClause", () => {
    this.CONSUME(Where)
    this.SUBRULE(this.expression)
  })

  // ==========================================================================
  // QuestDB-specific: SAMPLE BY
  // ==========================================================================

  private sampleByClause = this.RULE("sampleByClause", () => {
    this.CONSUME(Sample)
    this.CONSUME(By)
    this.OR([
      { ALT: () => this.CONSUME(DurationLiteral) },
      { ALT: () => this.CONSUME(VariableReference) },
    ])
    // Java order: FROM/TO → FILL → ALIGN TO
    this.OPTION(() => this.SUBRULE(this.fromToClause))
    this.OPTION1(() => this.SUBRULE(this.fillClause))
    this.OPTION2(() => this.SUBRULE(this.alignToClause))
  })

  // ==========================================================================
  // QuestDB-specific: LATEST ON / LATEST BY
  // ==========================================================================

  private latestOnClause = this.RULE("latestOnClause", () => {
    this.CONSUME(Latest)
    this.OR([
      {
        // LATEST ON ts PARTITION BY col [, col...]
        GATE: () => this.LA(1).tokenType === On,
        ALT: () => {
          this.CONSUME(On)
          this.SUBRULE(this.columnRef)
          this.CONSUME(Partition)
          this.CONSUME(By)
          this.SUBRULE1(this.columnRef)
          this.MANY(() => {
            this.CONSUME(Comma)
            this.SUBRULE2(this.columnRef)
          })
        },
      },
      {
        // LATEST BY col [, col...]
        ALT: () => {
          this.CONSUME1(By)
          this.SUBRULE3(this.columnRef)
          this.MANY1(() => {
            this.CONSUME1(Comma)
            this.SUBRULE4(this.columnRef)
          })
        },
      },
    ])
  })

  private fillClause = this.RULE("fillClause", () => {
    this.CONSUME(Fill)
    this.CONSUME(LParen)
    this.SUBRULE(this.fillValue)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.fillValue)
    })
    this.CONSUME(RParen)
  })

  private fillValue = this.RULE("fillValue", () => {
    this.OR([
      { ALT: () => this.CONSUME(Null) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.SUBRULE(this.identifier) },
    ])
  })

  private alignToClause = this.RULE("alignToClause", () => {
    this.CONSUME(Align)
    this.CONSUME(To)
    this.OR([
      {
        ALT: () => {
          this.CONSUME(First)
          this.CONSUME(Observation)
        },
      },
      {
        ALT: () => {
          this.CONSUME(Calendar)
          // Optional TIME ZONE clause
          this.OPTION(() => {
            this.CONSUME(Time)
            this.CONSUME(Zone)
            this.SUBRULE(this.timeZoneValue)
          })
          // Optional WITH OFFSET clause (can appear with or without TIME ZONE)
          this.OPTION1(() => {
            this.CONSUME(With)
            this.CONSUME(Offset)
            this.SUBRULE(this.stringOrIdentifier)
          })
        },
      },
    ])
  })

  private fromToClause = this.RULE("fromToClause", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(From)
          this.SUBRULE(this.expression)
          this.OPTION(() => {
            this.CONSUME(To)
            this.SUBRULE1(this.expression)
          })
        },
      },
      {
        ALT: () => {
          this.CONSUME1(To)
          this.SUBRULE2(this.expression)
        },
      },
    ])
  })

  // ==========================================================================
  // GROUP BY, HAVING, ORDER BY, LIMIT
  // ==========================================================================

  private groupByClause = this.RULE("groupByClause", () => {
    this.CONSUME(Group)
    this.CONSUME(By)
    this.SUBRULE(this.expression)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.expression)
    })
  })

  private orderByClause = this.RULE("orderByClause", () => {
    this.CONSUME(Order)
    this.CONSUME(By)
    this.SUBRULE(this.orderByItem)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.orderByItem)
    })
  })

  private orderByItem = this.RULE("orderByItem", () => {
    this.SUBRULE(this.expression)
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(Asc) },
        { ALT: () => this.CONSUME(Desc) },
      ])
    })
  })

  private limitClause = this.RULE("limitClause", () => {
    this.CONSUME(Limit)
    this.SUBRULE(this.expression)
    this.OPTION(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.expression)
    })
  })

  // ==========================================================================
  // INSERT Statement
  // ==========================================================================

  private insertStatement = this.RULE("insertStatement", () => {
    this.OPTION(() => this.SUBRULE(this.withClause))
    this.CONSUME(Insert)
    this.OPTION1(() => {
      this.OR([
        { ALT: () => this.CONSUME(Atomic) },
        {
          ALT: () => this.SUBRULE(this.batchClause),
        },
      ])
    })
    this.CONSUME(Into)
    this.SUBRULE(this.stringOrQualifiedName)
    // Batch clause can also appear after table name
    this.OPTION2(() => this.SUBRULE1(this.batchClause))
    this.OPTION3(() => {
      this.CONSUME(LParen)
      this.SUBRULE(this.identifier)
      this.MANY(() => {
        this.CONSUME(Comma)
        this.SUBRULE1(this.identifier)
      })
      this.CONSUME(RParen)
    })
    this.OR1([
      { ALT: () => this.SUBRULE(this.valuesClause) },
      { ALT: () => this.SUBRULE(this.selectStatement) },
    ])
  })

  private valuesClause = this.RULE("valuesClause", () => {
    this.CONSUME(Values)
    this.SUBRULE(this.valuesList)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.valuesList)
    })
  })

  private valuesList = this.RULE("valuesList", () => {
    this.CONSUME(LParen)
    this.SUBRULE(this.expression)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.expression)
    })
    this.CONSUME(RParen)
  })

  // ==========================================================================
  // UPDATE Statement
  // ==========================================================================

  private updateStatement = this.RULE("updateStatement", () => {
    this.OPTION4(() => this.SUBRULE(this.withClause))
    this.CONSUME(Update)
    this.SUBRULE(this.qualifiedName)
    // Optional alias
    this.OPTION2(() => this.SUBRULE(this.identifier))
    this.CONSUME(Set)
    this.SUBRULE(this.setClause)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.setClause)
    })
    this.OPTION(() => {
      this.CONSUME(From)
      this.SUBRULE(this.tableRef)
      this.MANY1(() => {
        this.SUBRULE(this.joinClause)
      })
    })
    this.OPTION1(() => this.SUBRULE(this.whereClause))
  })

  private setClause = this.RULE("setClause", () => {
    this.SUBRULE(this.columnRef)
    this.CONSUME(Equals)
    this.SUBRULE(this.expression)
  })

  // ==========================================================================
  // DECLARE Statement
  // ==========================================================================

  private declareClause = this.RULE("declareClause", () => {
    this.CONSUME(Declare)
    this.SUBRULE(this.declareAssignment)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.declareAssignment)
    })
  })

  private declareAssignment = this.RULE("declareAssignment", () => {
    this.OPTION(() => this.CONSUME(Overridable))
    this.CONSUME(VariableReference)
    this.OR([
      { ALT: () => this.CONSUME(ColonEquals) },
      { ALT: () => this.CONSUME(Equals) },
    ])
    this.SUBRULE(this.expression)
  })

  // ==========================================================================
  // CREATE Statement (dispatches to TABLE or MATERIALIZED VIEW)
  // ==========================================================================

  private createStatement = this.RULE("createStatement", () => {
    this.CONSUME(Create)
    this.OR([
      { ALT: () => this.SUBRULE(this.createTableBody) },
      { ALT: () => this.SUBRULE(this.createMaterializedViewBody) },
      { ALT: () => this.SUBRULE(this.createViewBody) },
      { ALT: () => this.SUBRULE(this.createUserStatement) },
      { ALT: () => this.SUBRULE(this.createGroupStatement) },
      { ALT: () => this.SUBRULE(this.createServiceAccountStatement) },
    ])
  })

  private createViewBody = this.RULE("createViewBody", () => {
    this.OPTION(() => {
      this.CONSUME(Or)
      this.CONSUME(Replace)
    })
    this.CONSUME(View)
    this.OPTION1(() => {
      this.CONSUME(If)
      this.CONSUME(Not)
      this.CONSUME(Exists)
    })
    this.SUBRULE(this.stringOrQualifiedName)
    this.CONSUME(As)
    this.OR([
      {
        GATE: () => {
          const la2 = this.LA(2).tokenType
          return la2 === Select || la2 === With || la2 === Declare
        },
        ALT: () => {
          this.CONSUME(LParen)
          this.SUBRULE(this.selectStatement)
          this.CONSUME(RParen)
        },
      },
      {
        ALT: () => {
          this.CONSUME1(LParen)
          this.SUBRULE(this.implicitSelectBody)
          this.CONSUME1(RParen)
        },
      },
      { ALT: () => this.SUBRULE1(this.selectStatement) },
    ])
    // Optional OWNED BY
    this.OPTION2(() => {
      this.CONSUME(Owned)
      this.CONSUME(By)
      this.SUBRULE(this.stringOrIdentifier)
    })
  })

  private createTableBody = this.RULE("createTableBody", () => {
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(Atomic) },
        {
          ALT: () => this.SUBRULE(this.batchClause),
        },
      ])
    })
    this.CONSUME(Table)
    this.OPTION1(() => {
      this.CONSUME(If)
      this.CONSUME(Not)
      this.CONSUME(Exists)
    })
    this.SUBRULE(this.stringOrQualifiedName)

    this.OR1([
      // CREATE TABLE AS (SELECT ...)
      {
        ALT: () => {
          this.CONSUME(As)
          this.CONSUME(LParen)
          this.SUBRULE(this.selectStatement)
          this.CONSUME(RParen)
          this.MANY2(() => {
            this.CONSUME(Comma)
            this.SUBRULE(this.castDefinition)
          })
          this.MANY3(() => {
            this.CONSUME1(Comma)
            this.SUBRULE(this.indexDefinition)
          })
        },
      },
      // CREATE TABLE (col1 type1, col2 type2, ...) [, INDEX (col)]
      {
        ALT: () => {
          this.CONSUME1(LParen)
          this.SUBRULE(this.columnDefinition)
          this.MANY(() => {
            this.CONSUME2(Comma)
            this.SUBRULE1(this.columnDefinition)
          })
          this.CONSUME1(RParen)
          // Optional INDEX clause(s) after column list
          this.MANY1(() => {
            this.CONSUME3(Comma)
            this.SUBRULE1(this.indexDefinition)
          })
        },
      },
      // CREATE TABLE (LIKE other_table)
      {
        ALT: () => {
          this.CONSUME2(LParen)
          this.CONSUME(Like)
          this.SUBRULE2(this.qualifiedName)
          this.CONSUME2(RParen)
        },
      },
    ])

    // Optional TIMESTAMP designation
    this.OPTION2(() => {
      this.CONSUME(Timestamp)
      this.CONSUME4(LParen)
      this.SUBRULE1(this.columnRef)
      this.CONSUME4(RParen)
    })

    // Optional PARTITION BY
    this.OPTION3(() => {
      this.CONSUME(Partition)
      this.CONSUME(By)
      this.SUBRULE(this.partitionPeriod)
    })

    // Optional TTL (must come before WAL per Java order)
    this.OPTION4(() => {
      this.CONSUME(Ttl)
      this.OR2([
        { ALT: () => this.CONSUME1(DurationLiteral) },
        {
          ALT: () => {
            this.CONSUME1(NumberLiteral)
            this.OR5([
              { ALT: () => this.CONSUME(Hours) },
              { ALT: () => this.CONSUME(Days) },
              { ALT: () => this.CONSUME(Weeks) },
              { ALT: () => this.CONSUME(Months) },
              { ALT: () => this.CONSUME(Years) },
              { ALT: () => this.CONSUME1(Hour) },
              { ALT: () => this.CONSUME1(Day) },
              { ALT: () => this.CONSUME1(Week) },
              { ALT: () => this.CONSUME1(Month) },
              { ALT: () => this.CONSUME1(Year) },
            ])
          },
        },
      ])
    })

    // Optional WAL / BYPASS WAL
    this.OPTION5(() => {
      this.OR3([
        {
          ALT: () => {
            this.CONSUME(Bypass)
            this.CONSUME(Wal)
          },
        },
        { ALT: () => this.CONSUME1(Wal) },
      ])
    })

    // Optional WITH table parameters (comma-separated)
    // GATE: distinguish from WITH...AS (CTE) which starts the next statement.
    // Table params: WITH maxUncommittedRows=10
    // CTE:          WITH cte_name AS (SELECT ...)
    this.OPTION6({
      GATE: () => this.LA(1).tokenType === With && this.LA(3).tokenType !== As,
      DEF: () => {
        this.CONSUME(With)
        this.SUBRULE(this.tableParam)
        this.MANY4({
          // Stop before ", IN VOLUME" — the comma is consumed by OPTION7 instead
          GATE: () =>
            !(this.LA(1).tokenType === Comma && this.LA(2).tokenType === In),
          DEF: () => {
            this.CONSUME5(Comma)
            this.SUBRULE1(this.tableParam)
          },
        })
      },
    })

    // Optional IN VOLUME (preceded by comma when WITH clause is present)
    this.OPTION7(() => {
      this.OR4([
        {
          // ", IN VOLUME ..." after WITH clause
          GATE: () =>
            this.LA(1).tokenType === Comma && this.LA(2).tokenType === In,
          ALT: () => {
            this.CONSUME6(Comma)
            this.CONSUME(In)
          },
        },
        {
          // Standalone "IN VOLUME ..."
          ALT: () => this.CONSUME1(In),
        },
      ])
      this.CONSUME(Volume)
      this.OR6([
        { ALT: () => this.CONSUME(StringLiteral) },
        { ALT: () => this.SUBRULE5(this.identifier) },
      ])
    })

    // Optional DEDUP UPSERT KEYS
    this.OPTION8(() => {
      this.SUBRULE(this.dedupClause)
    })

    // Optional OWNED BY
    this.OPTION9(() => {
      this.CONSUME(Owned)
      this.CONSUME1(By)
      this.SUBRULE(this.stringOrIdentifier)
    })
  })

  private batchClause = this.RULE("batchClause", () => {
    this.CONSUME(Batch)
    this.CONSUME(NumberLiteral)
    this.OPTION(() => {
      this.CONSUME(O3MaxLag)
      this.OR([
        { ALT: () => this.CONSUME(DurationLiteral) },
        { ALT: () => this.CONSUME(StringLiteral) },
      ])
    })
  })

  private dedupClause = this.RULE("dedupClause", () => {
    this.CONSUME(Dedup)
    this.CONSUME(Upsert)
    this.CONSUME(Keys)
    this.CONSUME(LParen)
    this.SUBRULE(this.identifier)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.identifier)
    })
    this.CONSUME(RParen)
  })

  private createUserStatement = this.RULE("createUserStatement", () => {
    this.CONSUME(User)
    this.OPTION(() => {
      this.CONSUME(If)
      this.CONSUME(Not)
      this.CONSUME(Exists)
    })
    this.SUBRULE(this.qualifiedName)
    this.OPTION1(() => {
      this.CONSUME(With)
      this.OR([
        {
          ALT: () => {
            this.CONSUME(No)
            this.CONSUME(Password)
          },
        },
        {
          ALT: () => {
            this.CONSUME1(Password)
            this.OR1([
              { ALT: () => this.CONSUME(StringLiteral) },
              { ALT: () => this.SUBRULE1(this.identifier) },
            ])
          },
        },
      ])
    })
  })

  private createGroupStatement = this.RULE("createGroupStatement", () => {
    this.CONSUME(Group)
    this.OPTION(() => {
      this.CONSUME(If)
      this.CONSUME(Not)
      this.CONSUME(Exists)
    })
    this.SUBRULE(this.qualifiedName)
    // Optional WITH EXTERNAL ALIAS 'ext_alias'
    this.OPTION1(() => {
      this.CONSUME(With)
      this.CONSUME(External)
      this.CONSUME(Alias)
      this.CONSUME(StringLiteral)
    })
  })

  private createServiceAccountStatement = this.RULE(
    "createServiceAccountStatement",
    () => {
      this.CONSUME(Service)
      this.CONSUME(Account)
      this.OPTION(() => {
        this.CONSUME(If)
        this.CONSUME(Not)
        this.CONSUME(Exists)
      })
      this.SUBRULE(this.qualifiedName)
      this.OPTION1(() => {
        this.CONSUME(With)
        this.OR([
          {
            ALT: () => {
              this.CONSUME(Password)
              this.OR1([
                { ALT: () => this.CONSUME(StringLiteral) },
                { ALT: () => this.SUBRULE1(this.identifier) },
              ])
            },
          },
          {
            ALT: () => {
              this.CONSUME(No)
              this.CONSUME1(Password)
            },
          },
        ])
      })
      this.OPTION2(() => {
        this.CONSUME(Owned)
        this.CONSUME(By)
        this.SUBRULE(this.stringOrIdentifier)
      })
    },
  )

  private createMaterializedViewBody = this.RULE(
    "createMaterializedViewBody",
    () => {
      this.CONSUME(Materialized)
      this.CONSUME(View)
      this.OPTION(() => {
        this.CONSUME(If)
        this.CONSUME(Not)
        this.CONSUME(Exists)
      })
      this.SUBRULE(this.stringOrQualifiedName)
      this.OPTION1(() => {
        this.CONSUME(With)
        this.CONSUME(Base)
        this.SUBRULE1(this.stringOrQualifiedName)
      })
      this.OPTION2(() => {
        this.CONSUME(Refresh)
        this.OR1([
          {
            GATE: () => this.LA(1).tokenType === Period,
            ALT: () => this.SUBRULE(this.materializedViewPeriod),
          },
          { ALT: () => this.SUBRULE(this.materializedViewRefresh) },
        ])
      })
      this.OPTION3(() => {
        this.SUBRULE1(this.materializedViewPeriod)
      })
      this.CONSUME(As)
      this.OPTION4(() => this.CONSUME(LParen))
      this.SUBRULE(this.selectStatement)
      this.OPTION5(() => this.CONSUME(RParen))
      this.OPTION6(() => {
        this.CONSUME(Timestamp)
        this.CONSUME1(LParen)
        this.SUBRULE2(this.columnRef)
        this.CONSUME1(RParen)
      })
      this.OPTION7(() => {
        this.SUBRULE(this.materializedViewPartition)
      })
      this.OPTION8(() => {
        this.CONSUME(In)
        this.CONSUME(Volume)
        this.OR2([
          { ALT: () => this.CONSUME(StringLiteral) },
          { ALT: () => this.SUBRULE3(this.identifier) },
        ])
      })
      this.OPTION9(() => {
        this.CONSUME(Owned)
        this.CONSUME1(By)
        this.SUBRULE(this.stringOrIdentifier)
      })
    },
  )

  private materializedViewRefresh = this.RULE("materializedViewRefresh", () => {
    this.OR([
      {
        ALT: () => {
          this.OR1([
            { ALT: () => this.CONSUME(Immediate) },
            { ALT: () => this.CONSUME(Manual) },
          ])
          this.OPTION(() => this.CONSUME(Deferred))
        },
      },
      {
        ALT: () => {
          this.CONSUME(Every)
          this.SUBRULE(this.intervalValue)
          this.OPTION1(() => this.CONSUME1(Deferred))
          this.OPTION2(() => {
            this.CONSUME(Start)
            this.SUBRULE1(this.stringOrIdentifier)
          })
          this.OPTION3(() => {
            this.CONSUME(Time)
            this.CONSUME(Zone)
            this.SUBRULE(this.timeZoneValue)
          })
        },
      },
    ])
  })

  private materializedViewPeriod = this.RULE("materializedViewPeriod", () => {
    this.CONSUME(Period)
    this.CONSUME(LParen)
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Length)
          this.SUBRULE(this.intervalValue)
          this.OPTION(() => {
            this.CONSUME(Time)
            this.CONSUME(Zone)
            this.SUBRULE1(this.timeZoneValue)
          })
          this.OPTION1(() => {
            this.CONSUME(Delay)
            this.SUBRULE1(this.intervalValue)
          })
        },
      },
      {
        ALT: () => {
          this.CONSUME(Sample)
          this.CONSUME(By)
          this.CONSUME(Interval)
        },
      },
    ])
    this.CONSUME(RParen)
  })

  private materializedViewPartition = this.RULE(
    "materializedViewPartition",
    () => {
      this.CONSUME(Partition)
      this.CONSUME(By)
      this.SUBRULE(this.partitionPeriod)
      this.OPTION(() => {
        this.CONSUME(Ttl)
        this.CONSUME(NumberLiteral)
        this.OR1([
          { ALT: () => this.CONSUME(Hours) },
          { ALT: () => this.CONSUME(Days) },
          { ALT: () => this.CONSUME(Weeks) },
          { ALT: () => this.CONSUME(Months) },
          { ALT: () => this.CONSUME(Years) },
        ])
      })
    },
  )

  private columnDefinition = this.RULE("columnDefinition", () => {
    this.SUBRULE(this.identifier)
    this.SUBRULE(this.dataType)
    // SYMBOL column options: CAPACITY n, CACHE|NOCACHE, INDEX [CAPACITY n]
    this.OPTION(() => {
      this.CONSUME(Capacity)
      this.CONSUME(NumberLiteral)
    })
    this.OPTION1(() => {
      this.OR([
        { ALT: () => this.CONSUME(Cache) },
        { ALT: () => this.CONSUME(Nocache) },
      ])
    })
    this.OPTION2(() => {
      this.CONSUME(Index)
      this.OPTION3(() => {
        this.CONSUME1(Capacity)
        this.CONSUME1(NumberLiteral)
      })
    })
  })

  private castDefinition = this.RULE("castDefinition", () => {
    this.CONSUME(Cast)
    this.CONSUME(LParen)
    this.SUBRULE(this.columnRef)
    this.CONSUME(As)
    this.SUBRULE(this.dataType)
    this.CONSUME(RParen)
  })

  private indexDefinition = this.RULE("indexDefinition", () => {
    this.CONSUME(Index)
    this.CONSUME(LParen)
    this.SUBRULE(this.columnRef)
    this.OPTION(() => {
      this.CONSUME(Capacity)
      this.CONSUME(NumberLiteral)
    })
    this.CONSUME(RParen)
  })

  private tableParamName = this.RULE("tableParamName", () => {
    this.SUBRULE(this.identifier)
  })

  private tableParam = this.RULE("tableParam", () => {
    this.SUBRULE(this.tableParamName)
    this.OPTION(() => {
      this.CONSUME(Equals)
      this.SUBRULE(this.expression)
    })
  })

  private partitionPeriod = this.RULE("partitionPeriod", () => {
    this.OR([
      { ALT: () => this.CONSUME(None) },
      { ALT: () => this.CONSUME(Hour) },
      { ALT: () => this.CONSUME(Day) },
      { ALT: () => this.CONSUME(Week) },
      { ALT: () => this.CONSUME(Month) },
      { ALT: () => this.CONSUME(Year) },
    ])
  })

  private timeUnit = this.RULE("timeUnit", () => {
    this.OR([
      { ALT: () => this.CONSUME(Hours) },
      { ALT: () => this.CONSUME(Days) },
      { ALT: () => this.CONSUME(Weeks) },
      { ALT: () => this.CONSUME(Months) },
      { ALT: () => this.CONSUME(Years) },
      { ALT: () => this.CONSUME(Hour) },
      { ALT: () => this.CONSUME(Day) },
      { ALT: () => this.CONSUME(Week) },
      { ALT: () => this.CONSUME(Month) },
      { ALT: () => this.CONSUME(Year) },
      { ALT: () => this.CONSUME(Minute) },
      { ALT: () => this.CONSUME(Minutes) },
      { ALT: () => this.CONSUME(Second) },
      { ALT: () => this.CONSUME(Seconds) },
      { ALT: () => this.CONSUME(Millisecond) },
      { ALT: () => this.CONSUME(Milliseconds) },
      { ALT: () => this.CONSUME(Microsecond) },
      { ALT: () => this.CONSUME(Microseconds) },
      { ALT: () => this.CONSUME(Nanosecond) },
      { ALT: () => this.CONSUME(Nanoseconds) },
    ])
  })

  // ==========================================================================
  // ALTER TABLE Statement
  // ==========================================================================

  private alterStatement = this.RULE("alterStatement", () => {
    this.CONSUME(Alter)
    this.OR([
      { ALT: () => this.SUBRULE(this.alterTableStatement) },
      { ALT: () => this.SUBRULE(this.alterMaterializedViewStatement) },
      { ALT: () => this.SUBRULE(this.alterViewStatement) },
      { ALT: () => this.SUBRULE(this.alterUserStatement) },
      { ALT: () => this.SUBRULE(this.alterServiceAccountStatement) },
      { ALT: () => this.SUBRULE(this.alterGroupStatement) },
    ])
  })

  private alterGroupStatement = this.RULE("alterGroupStatement", () => {
    this.CONSUME(Group)
    this.SUBRULE(this.qualifiedName)
    this.OR([
      {
        ALT: () => {
          this.CONSUME(With)
          this.CONSUME(External)
          this.CONSUME(Alias)
          this.CONSUME(StringLiteral)
        },
      },
      {
        ALT: () => {
          this.CONSUME(Drop)
          this.CONSUME1(External)
          this.CONSUME1(Alias)
          this.CONSUME1(StringLiteral)
        },
      },
    ])
  })

  private alterViewStatement = this.RULE("alterViewStatement", () => {
    this.CONSUME(View)
    this.SUBRULE(this.stringOrQualifiedName)
    this.CONSUME(As)
    this.OR([
      {
        ALT: () => {
          this.CONSUME(LParen)
          this.SUBRULE(this.selectStatement)
          this.CONSUME(RParen)
        },
      },
      { ALT: () => this.SUBRULE1(this.selectStatement) },
    ])
  })

  private alterUserStatement = this.RULE("alterUserStatement", () => {
    this.CONSUME(User)
    this.SUBRULE(this.qualifiedName)
    this.SUBRULE(this.alterUserAction)
  })

  private alterServiceAccountStatement = this.RULE(
    "alterServiceAccountStatement",
    () => {
      this.CONSUME(Service)
      this.CONSUME(Account)
      this.SUBRULE(this.qualifiedName)
      this.SUBRULE(this.alterUserAction)
    },
  )

  private alterUserAction = this.RULE("alterUserAction", () => {
    this.OR([
      { ALT: () => this.CONSUME(Enable) },
      { ALT: () => this.CONSUME(Disable) },
      {
        ALT: () => {
          this.CONSUME(With)
          this.OR1([
            {
              ALT: () => {
                this.CONSUME(No)
                this.CONSUME(Password)
              },
            },
            {
              ALT: () => {
                this.CONSUME1(Password)
                this.CONSUME(StringLiteral)
              },
            },
          ])
        },
      },
      {
        ALT: () => {
          this.CONSUME(Create)
          this.CONSUME(Token)
          this.CONSUME(Type)
          this.OR2([
            { ALT: () => this.CONSUME(Jwk) },
            {
              ALT: () => {
                this.CONSUME(Rest)
                this.OPTION(() => {
                  this.CONSUME1(With)
                  this.CONSUME(Ttl)
                  this.OR5([
                    { ALT: () => this.CONSUME(DurationLiteral) },
                    { ALT: () => this.CONSUME2(StringLiteral) },
                  ])
                  this.OPTION1(() => this.CONSUME(Refresh))
                })
              },
            },
          ])
        },
      },
      {
        ALT: () => {
          this.CONSUME(Drop)
          this.CONSUME1(Token)
          this.CONSUME1(Type)
          this.OR3([
            { ALT: () => this.CONSUME1(Jwk) },
            {
              ALT: () => {
                this.CONSUME1(Rest)
                this.OPTION2(() => {
                  this.OR4([
                    { ALT: () => this.CONSUME(Identifier) },
                    { ALT: () => this.CONSUME1(StringLiteral) },
                  ])
                })
              },
            },
          ])
        },
      },
    ])
  })

  private alterTableStatement = this.RULE("alterTableStatement", () => {
    this.CONSUME(Table)
    this.OR([
      { ALT: () => this.SUBRULE(this.qualifiedName) },
      { ALT: () => this.CONSUME(StringLiteral) },
    ])
    this.SUBRULE(this.alterTableAction)
  })

  private alterTableAction = this.RULE("alterTableAction", () => {
    this.OR([
      // ADD COLUMN
      {
        ALT: () => {
          this.CONSUME(Add)
          this.CONSUME(Column)
          this.OPTION(() => {
            this.CONSUME(If)
            this.CONSUME(Not)
            this.CONSUME(Exists)
          })
          this.SUBRULE(this.columnDefinition)
          this.MANY(() => {
            this.CONSUME(Comma)
            this.SUBRULE1(this.columnDefinition)
          })
        },
      },
      // DROP (COLUMN ... | PARTITION ...)
      {
        ALT: () => {
          this.CONSUME(Drop)
          this.OR1([
            // DROP COLUMN
            {
              ALT: () => {
                this.CONSUME1(Column)
                this.SUBRULE(this.identifier)
                this.MANY1(() => {
                  this.CONSUME1(Comma)
                  this.SUBRULE1(this.identifier)
                })
              },
            },
            // DROP PARTITION LIST or WHERE
            {
              ALT: () => {
                this.CONSUME(Partition)
                this.OR8([
                  {
                    ALT: () => {
                      this.CONSUME(List)
                      this.CONSUME(StringLiteral)
                      this.MANY2(() => {
                        this.CONSUME2(Comma)
                        this.CONSUME1(StringLiteral)
                      })
                    },
                  },
                  {
                    ALT: () => {
                      this.CONSUME(Where)
                      this.SUBRULE(this.expression)
                    },
                  },
                ])
              },
            },
          ])
        },
      },
      // RENAME COLUMN
      {
        ALT: () => {
          this.CONSUME(Rename)
          this.CONSUME2(Column)
          this.SUBRULE2(this.identifier)
          this.CONSUME(To)
          this.SUBRULE3(this.identifier)
        },
      },
      // ALTER COLUMN (for TYPE, ADD INDEX, CACHE/NOCACHE)
      {
        ALT: () => {
          this.CONSUME1(Alter)
          this.CONSUME3(Column)
          this.SUBRULE4(this.identifier)
          this.OR9([
            {
              ALT: () => {
                this.CONSUME(Type)
                this.SUBRULE(this.dataType)
                // Optional CAPACITY for SYMBOL type
                this.OPTION4(() => {
                  this.CONSUME1(Capacity)
                  this.CONSUME4(NumberLiteral)
                })
                // Optional CACHE/NOCACHE
                this.OPTION5(() => this.CONSUME1(Cache))
                this.OPTION6(() => this.CONSUME1(Nocache))
              },
            },
            {
              ALT: () => {
                this.CONSUME1(Add)
                this.CONSUME(Index)
              },
            },
            {
              ALT: () => {
                this.CONSUME1(Drop)
                this.CONSUME1(Index)
              },
            },
            {
              ALT: () => {
                this.CONSUME(Symbol)
                this.CONSUME(Capacity)
                this.CONSUME(NumberLiteral)
              },
            },
            { ALT: () => this.CONSUME(Cache) },
            { ALT: () => this.CONSUME(Nocache) },
          ])
        },
      },
      // ATTACH PARTITION LIST
      {
        ALT: () => {
          this.CONSUME(Attach)
          this.CONSUME1(Partition)
          this.CONSUME1(List)
          this.CONSUME2(StringLiteral)
          this.MANY3(() => {
            this.CONSUME3(Comma)
            this.CONSUME3(StringLiteral)
          })
        },
      },
      // DETACH PARTITION LIST
      {
        ALT: () => {
          this.CONSUME(Detach)
          this.CONSUME2(Partition)
          this.OR2([
            {
              ALT: () => {
                this.CONSUME2(List)
                this.CONSUME4(StringLiteral)
                this.MANY4(() => {
                  this.CONSUME4(Comma)
                  this.CONSUME5(StringLiteral)
                })
              },
            },
            {
              ALT: () => {
                this.CONSUME2(Where)
                this.SUBRULE2(this.expression)
              },
            },
          ])
        },
      },
      // SQUASH PARTITIONS
      {
        ALT: () => {
          this.CONSUME(Squash)
          this.CONSUME(Partitions)
        },
      },
      // SET (PARAM ... | TTL ... | TYPE WAL ...)
      {
        ALT: () => {
          this.CONSUME(Set)
          this.OR3([
            // SET PARAM
            {
              ALT: () => {
                this.CONSUME(Param)
                this.SUBRULE(this.tableParam)
                this.MANY5(() => {
                  this.CONSUME5(Comma)
                  this.SUBRULE1(this.tableParam)
                })
              },
            },
            // SET TTL
            {
              ALT: () => {
                this.CONSUME(Ttl)
                this.OR7([
                  { ALT: () => this.CONSUME(DurationLiteral) },
                  {
                    ALT: () => {
                      this.CONSUME1(NumberLiteral)
                      this.OPTION9(() => {
                        this.SUBRULE(this.timeUnit)
                      })
                    },
                  },
                ])
              },
            },
            // SET TYPE [BYPASS] WAL
            {
              ALT: () => {
                this.CONSUME1(Type)
                this.OPTION3(() => this.CONSUME2(Bypass))
                this.CONSUME3(Wal)
              },
            },
          ])
        },
      },
      // DEDUP (DISABLE | ENABLE UPSERT KEYS (...))
      {
        ALT: () => {
          this.CONSUME(Dedup)
          this.OR6([
            { ALT: () => this.CONSUME(Disable) },
            {
              ALT: () => {
                this.CONSUME(Enable)
                this.CONSUME(Upsert)
                this.CONSUME(Keys)
                this.CONSUME(LParen)
                this.SUBRULE5(this.identifier)
                this.MANY6(() => {
                  this.CONSUME6(Comma)
                  this.SUBRULE6(this.identifier)
                })
                this.CONSUME(RParen)
              },
            },
          ])
        },
      },
      // SUSPEND WAL [WITH code/tag, 'message']
      {
        ALT: () => {
          this.CONSUME(Suspend)
          this.CONSUME1(Wal)
          this.OPTION7(() => {
            this.CONSUME(With)
            this.OR4([
              { ALT: () => this.CONSUME2(NumberLiteral) },
              { ALT: () => this.CONSUME6(StringLiteral) },
            ])
            this.CONSUME7(Comma)
            this.CONSUME7(StringLiteral)
          })
        },
      },
      // RESUME WAL [FROM TXN/TRANSACTION number]
      {
        ALT: () => {
          this.CONSUME1(Resume)
          this.CONSUME2(Wal)
          this.OPTION8(() => {
            this.CONSUME(From)
            this.OR5([
              { ALT: () => this.CONSUME(Txn) },
              { ALT: () => this.CONSUME(Transaction) },
            ])
            this.CONSUME3(NumberLiteral)
          })
        },
      },
      // CONVERT PARTITION
      {
        ALT: () => {
          this.CONSUME(Convert)
          this.CONSUME3(Partition)
          this.SUBRULE7(this.convertPartitionTarget)
        },
      },
    ])
  })

  private convertPartitionTarget = this.RULE("convertPartitionTarget", () => {
    // Optional LIST before TO
    this.OPTION(() => {
      this.CONSUME(List)
      this.CONSUME(StringLiteral)
      this.MANY(() => {
        this.CONSUME(Comma)
        this.CONSUME1(StringLiteral)
      })
    })
    this.CONSUME(To)
    this.OR([
      { ALT: () => this.CONSUME(Table) },
      { ALT: () => this.SUBRULE(this.identifier) }, // Parquet, NATIVE, etc.
    ])
    // Optional WHERE clause after target
    this.OPTION1(() => {
      this.CONSUME(Where)
      this.SUBRULE(this.expression)
    })
  })

  // ==========================================================================
  // ALTER MATERIALIZED VIEW Statement
  // ==========================================================================

  private alterMaterializedViewStatement = this.RULE(
    "alterMaterializedViewStatement",
    () => {
      this.CONSUME(Materialized)
      this.CONSUME(View)
      this.SUBRULE(this.qualifiedName)
      this.SUBRULE(this.alterMaterializedViewAction)
    },
  )

  private alterMaterializedViewAction = this.RULE(
    "alterMaterializedViewAction",
    () => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(Alter)
            this.CONSUME(Column)
            this.SUBRULE(this.identifier)
            this.OR1([
              {
                ALT: () => {
                  this.CONSUME(Add)
                  this.CONSUME(Index)
                  this.OPTION(() => {
                    this.CONSUME(Capacity)
                    this.CONSUME(NumberLiteral)
                  })
                },
              },
              {
                ALT: () => {
                  this.CONSUME(Drop)
                  this.CONSUME1(Index)
                },
              },
              {
                ALT: () => {
                  this.CONSUME(Symbol)
                  this.CONSUME1(Capacity)
                  this.CONSUME1(NumberLiteral)
                },
              },
            ])
          },
        },
        // SET (TTL ... | REFRESH LIMIT ... | REFRESH ...)
        {
          ALT: () => {
            this.CONSUME(Set)
            this.OR2([
              // SET TTL
              {
                ALT: () => {
                  this.CONSUME(Ttl)
                  this.OR3([
                    { ALT: () => this.CONSUME(DurationLiteral) },
                    {
                      ALT: () => {
                        this.CONSUME2(NumberLiteral)
                        this.SUBRULE1(this.timeUnit)
                      },
                    },
                  ])
                },
              },
              // SET REFRESH (LIMIT ... | [refresh] [period])
              {
                ALT: () => {
                  this.CONSUME(Refresh)
                  this.OR4([
                    // SET REFRESH LIMIT
                    {
                      ALT: () => {
                        this.CONSUME(Limit)
                        this.OR5([
                          { ALT: () => this.CONSUME1(DurationLiteral) },
                          {
                            ALT: () => {
                              this.CONSUME3(NumberLiteral)
                              this.SUBRULE2(this.timeUnit)
                            },
                          },
                        ])
                      },
                    },
                    // SET REFRESH [materializedViewRefresh] [materializedViewPeriod]
                    {
                      ALT: () => {
                        this.OPTION1(() =>
                          this.SUBRULE(this.materializedViewRefresh),
                        )
                        this.OPTION2(() =>
                          this.SUBRULE(this.materializedViewPeriod),
                        )
                      },
                    },
                  ])
                },
              },
            ])
          },
        },
        // RESUME WAL [FROM TRANSACTION n]
        {
          ALT: () => {
            this.CONSUME(Resume)
            this.CONSUME(Wal)
            this.OPTION3(() => {
              this.CONSUME(From)
              this.OR7([
                { ALT: () => this.CONSUME(Transaction) },
                { ALT: () => this.CONSUME(Txn) },
              ])
              this.CONSUME4(NumberLiteral)
            })
          },
        },
        // SUSPEND WAL
        {
          ALT: () => {
            this.CONSUME(Suspend)
            this.CONSUME1(Wal)
          },
        },
      ])
    },
  )

  // ==========================================================================
  // DROP TABLE Statement
  // ==========================================================================

  private dropStatement = this.RULE("dropStatement", () => {
    this.CONSUME(Drop)
    this.OR([
      { ALT: () => this.SUBRULE(this.dropTableStatement) },
      { ALT: () => this.SUBRULE(this.dropMaterializedViewStatement) },
      { ALT: () => this.SUBRULE(this.dropViewStatement) },
      { ALT: () => this.SUBRULE(this.dropUserStatement) },
      { ALT: () => this.SUBRULE(this.dropGroupStatement) },
      { ALT: () => this.SUBRULE(this.dropServiceAccountStatement) },
    ])
  })

  private dropViewStatement = this.RULE("dropViewStatement", () => {
    this.CONSUME(View)
    this.OPTION(() => {
      this.CONSUME(If)
      this.CONSUME(Exists)
    })
    this.SUBRULE(this.stringOrQualifiedName)
  })

  private dropTableStatement = this.RULE("dropTableStatement", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(All)
          this.CONSUME(Tables)
        },
      },
      {
        ALT: () => {
          this.CONSUME(Table)
          this.OPTION(() => {
            this.CONSUME(If)
            this.CONSUME(Exists)
          })
          this.SUBRULE(this.qualifiedName)
        },
      },
    ])
  })

  private dropMaterializedViewStatement = this.RULE(
    "dropMaterializedViewStatement",
    () => {
      this.CONSUME(Materialized)
      this.CONSUME(View)
      this.OPTION(() => {
        this.CONSUME(If)
        this.CONSUME(Exists)
      })
      this.SUBRULE(this.stringOrQualifiedName)
    },
  )

  private dropUserStatement = this.RULE("dropUserStatement", () => {
    this.CONSUME(User)
    this.OPTION(() => {
      this.CONSUME(If)
      this.CONSUME(Exists)
    })
    this.SUBRULE(this.qualifiedName)
  })

  private dropGroupStatement = this.RULE("dropGroupStatement", () => {
    this.CONSUME(Group)
    this.OPTION(() => {
      this.CONSUME(If)
      this.CONSUME(Exists)
    })
    this.SUBRULE(this.qualifiedName)
  })

  private dropServiceAccountStatement = this.RULE(
    "dropServiceAccountStatement",
    () => {
      this.CONSUME(Service)
      this.CONSUME(Account)
      this.OPTION(() => {
        this.CONSUME(If)
        this.CONSUME(Exists)
      })
      this.SUBRULE(this.qualifiedName)
    },
  )

  // ==========================================================================
  // TRUNCATE TABLE Statement
  // ==========================================================================

  private truncateTableStatement = this.RULE("truncateTableStatement", () => {
    this.CONSUME(Truncate)
    this.CONSUME(Table)
    this.OPTION(() => {
      this.CONSUME(If)
      this.CONSUME(Exists)
    })
    this.SUBRULE(this.qualifiedName)
  })

  // ==========================================================================
  // RENAME TABLE Statement
  // ==========================================================================

  private renameTableStatement = this.RULE("renameTableStatement", () => {
    this.CONSUME(Rename)
    this.CONSUME(Table)
    this.SUBRULE(this.stringOrQualifiedName)
    this.CONSUME(To)
    this.SUBRULE1(this.stringOrQualifiedName)
  })

  private addUserStatement = this.RULE("addUserStatement", () => {
    this.CONSUME(Add)
    this.CONSUME(User)
    this.SUBRULE(this.qualifiedName)
    this.CONSUME(To)
    this.SUBRULE1(this.qualifiedName)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE2(this.qualifiedName)
    })
  })

  private removeUserStatement = this.RULE("removeUserStatement", () => {
    this.CONSUME(Remove)
    this.CONSUME(User)
    this.SUBRULE(this.qualifiedName)
    this.CONSUME(From)
    this.SUBRULE1(this.qualifiedName)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE2(this.qualifiedName)
    })
  })

  private assumeServiceAccountStatement = this.RULE(
    "assumeServiceAccountStatement",
    () => {
      this.CONSUME(Assume)
      this.CONSUME(Service)
      this.CONSUME(Account)
      this.SUBRULE(this.qualifiedName)
    },
  )

  private exitServiceAccountStatement = this.RULE(
    "exitServiceAccountStatement",
    () => {
      this.CONSUME(Exit)
      this.CONSUME(Service)
      this.CONSUME(Account)
      this.OPTION(() => this.SUBRULE(this.qualifiedName))
    },
  )

  private cancelQueryStatement = this.RULE("cancelQueryStatement", () => {
    this.CONSUME(Cancel)
    this.CONSUME(Query)
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(Identifier) },
      { ALT: () => this.CONSUME(StringLiteral) },
    ])
  })

  // ==========================================================================
  // SHOW Statement
  // ==========================================================================

  private showStatement = this.RULE("showStatement", () => {
    this.CONSUME(Show)
    this.OR([
      { ALT: () => this.CONSUME(Tables) },
      {
        ALT: () => {
          this.CONSUME(Columns)
          this.CONSUME(From)
          this.SUBRULE(this.qualifiedName)
        },
      },
      {
        ALT: () => {
          this.CONSUME(Partitions)
          this.CONSUME1(From)
          this.SUBRULE1(this.qualifiedName)
        },
      },
      {
        ALT: () => {
          this.CONSUME(Create)
          this.OR2([
            {
              ALT: () => {
                this.CONSUME(Table)
                this.SUBRULE2(this.qualifiedName)
              },
            },
            {
              ALT: () => {
                this.CONSUME(View)
                this.SUBRULE8(this.qualifiedName)
              },
            },
            {
              ALT: () => {
                this.CONSUME(Materialized)
                this.CONSUME1(View)
                this.SUBRULE9(this.qualifiedName)
              },
            },
          ])
        },
      },
      {
        ALT: () => {
          this.CONSUME(Time)
          this.CONSUME(Zone)
        },
      },
      {
        ALT: () => {
          this.CONSUME(Transaction)
          this.OPTION5(() => {
            this.CONSUME(Isolation)
            this.CONSUME(Level)
          })
        },
      },
      {
        ALT: () => {
          this.CONSUME(Default)
          this.CONSUME1(Transaction)
          this.CONSUME(Identifier) // READ
          this.CONSUME(Only)
        },
      },
      {
        ALT: () => {
          this.CONSUME(User)
          this.OPTION(() => this.SUBRULE3(this.qualifiedName))
        },
      },
      { ALT: () => this.CONSUME(Users) },
      {
        ALT: () => {
          this.CONSUME(Groups)
          this.OPTION1(() => this.SUBRULE4(this.qualifiedName))
        },
      },
      {
        ALT: () => {
          this.CONSUME(Service)
          this.OR1([
            {
              ALT: () => {
                this.CONSUME(Account)
                this.OPTION2(() => this.SUBRULE5(this.qualifiedName))
              },
            },
            {
              ALT: () => {
                this.CONSUME(Accounts)
                this.OPTION3(() => this.SUBRULE6(this.qualifiedName))
              },
            },
          ])
        },
      },
      {
        ALT: () => {
          this.CONSUME(Permissions)
          this.OPTION4(() => this.SUBRULE7(this.qualifiedName))
        },
      },
      { ALT: () => this.CONSUME(ServerVersion) },
      { ALT: () => this.CONSUME(Parameters) },
    ])
  })

  // ==========================================================================
  // EXPLAIN Statement
  // ==========================================================================

  private explainStatement = this.RULE("explainStatement", () => {
    this.CONSUME(Explain)
    this.OPTION(() => {
      this.CONSUME(LParen)
      this.CONSUME(Format)
      this.OR1([
        { ALT: () => this.CONSUME(Identifier) }, // TEXT or JSON
      ])
      this.CONSUME(RParen)
    })
    this.SUBRULE(this.statement)
  })

  // ==========================================================================
  // COPY Statement
  // ==========================================================================

  private copyStatement = this.RULE("copyStatement", () => {
    this.CONSUME(Copy)
    this.OR([
      { ALT: () => this.SUBRULE(this.copyCancel) },
      {
        GATE: this.BACKTRACK(this.copyFrom),
        ALT: () => this.SUBRULE(this.copyFrom),
      },
      {
        GATE: this.BACKTRACK(this.copyTo),
        ALT: () => this.SUBRULE(this.copyTo),
      },
    ])
  })

  private copyCancel = this.RULE("copyCancel", () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(Identifier) },
      { ALT: () => this.CONSUME(StringLiteral) },
    ])
    this.CONSUME(Cancel)
  })

  private copyFrom = this.RULE("copyFrom", () => {
    this.SUBRULE(this.qualifiedName)
    this.CONSUME(From)
    this.SUBRULE(this.stringOrIdentifier)
    this.OPTION(() => this.SUBRULE(this.copyOptions))
  })

  private copyTo = this.RULE("copyTo", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(LParen)
          this.SUBRULE(this.selectStatement)
          this.CONSUME(RParen)
        },
      },
      { ALT: () => this.SUBRULE(this.qualifiedName) },
    ])
    this.CONSUME(To)
    this.SUBRULE1(this.stringOrIdentifier)
    this.OPTION(() => this.SUBRULE1(this.copyOptions))
  })

  private copyOptions = this.RULE("copyOptions", () => {
    this.CONSUME(With)
    this.AT_LEAST_ONE(() => {
      this.SUBRULE(this.copyOption)
    })
  })

  private copyOption = this.RULE("copyOption", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Header)
          this.SUBRULE(this.booleanLiteral)
        },
      },
      {
        ALT: () => {
          this.CONSUME(Timestamp)
          this.SUBRULE(this.stringOrIdentifier)
        },
      },
      {
        ALT: () => {
          this.CONSUME(Delimiter)
          this.SUBRULE1(this.stringOrIdentifier)
        },
      },
      {
        ALT: () => {
          this.CONSUME(Format)
          this.OR1([
            { ALT: () => this.CONSUME1(StringLiteral) }, // timestamp format string
            { ALT: () => this.SUBRULE2(this.identifier) }, // Parquet, etc.
          ])
        },
      },
      {
        ALT: () => {
          this.OR2([
            {
              ALT: () => {
                this.CONSUME(Partition)
                this.CONSUME(By)
              },
            },
            { ALT: () => this.CONSUME(PartitionBy) },
          ])
          this.SUBRULE(this.partitionPeriod)
        },
      },
      {
        ALT: () => {
          this.CONSUME(On)
          this.CONSUME(Error)
          this.OR3([
            { ALT: () => this.CONSUME(SkipRow) },
            { ALT: () => this.CONSUME(SkipColumn) },
            { ALT: () => this.CONSUME(Abort) },
          ])
        },
      },
      {
        ALT: () => {
          this.CONSUME(CompressionCodec)
          this.OR4([
            { ALT: () => this.CONSUME(Uncompressed) },
            { ALT: () => this.CONSUME(Snappy) },
            { ALT: () => this.CONSUME(Gzip) },
            { ALT: () => this.CONSUME(Lz4) },
            { ALT: () => this.CONSUME(Zstd) },
            { ALT: () => this.CONSUME(Lz4Raw) },
            { ALT: () => this.CONSUME(Brotli) },
            { ALT: () => this.CONSUME(Lzo) },
          ])
        },
      },
      {
        ALT: () => {
          this.CONSUME(CompressionLevel)
          this.SUBRULE(this.expression)
        },
      },
      {
        ALT: () => {
          this.CONSUME(RowGroupSize)
          this.SUBRULE1(this.expression)
        },
      },
      {
        ALT: () => {
          this.CONSUME(DataPageSize)
          this.SUBRULE2(this.expression)
        },
      },
      {
        ALT: () => {
          this.CONSUME(StatisticsEnabled)
          this.SUBRULE1(this.booleanLiteral)
        },
      },
      {
        ALT: () => {
          this.CONSUME(ParquetVersion)
          this.SUBRULE2(this.stringOrIdentifier)
        },
      },
      {
        ALT: () => {
          this.CONSUME(RawArrayEncoding)
          this.SUBRULE2(this.booleanLiteral)
        },
      },
    ])
  })

  // ==========================================================================
  // CHECKPOINT & SNAPSHOT Statements
  // ==========================================================================

  private checkpointStatement = this.RULE("checkpointStatement", () => {
    this.CONSUME(Checkpoint)
    this.OR([
      { ALT: () => this.CONSUME(Create) },
      { ALT: () => this.CONSUME(Release) },
    ])
  })

  private snapshotStatement = this.RULE("snapshotStatement", () => {
    this.CONSUME(Snapshot)
    this.OR([
      { ALT: () => this.CONSUME(Prepare) },
      { ALT: () => this.CONSUME(Complete) },
    ])
  })

  // ==========================================================================
  // BACKUP Statement
  // ==========================================================================

  private backupStatement = this.RULE("backupStatement", () => {
    this.CONSUME(Backup)
    this.OR([
      { ALT: () => this.CONSUME(Database) },
      {
        ALT: () => {
          this.CONSUME(Table)
          this.SUBRULE(this.qualifiedName)
        },
      },
      { ALT: () => this.CONSUME(Abort) },
    ])
  })

  // ==========================================================================
  // COMPILE VIEW Statement
  // ==========================================================================

  private compileViewStatement = this.RULE("compileViewStatement", () => {
    this.CONSUME(Compile)
    this.CONSUME(View)
    this.SUBRULE(this.qualifiedName)
  })

  // ==========================================================================
  // GRANT / REVOKE Statements
  // ==========================================================================

  private grantStatement = this.RULE("grantStatement", () => {
    this.CONSUME(Grant)
    this.SUBRULE(this.permissionList)
    this.OPTION(() => {
      this.CONSUME(On)
      this.OR([
        {
          ALT: () => {
            this.CONSUME(All)
            this.CONSUME(Tables)
          },
        },
        {
          ALT: () => {
            this.SUBRULE(this.grantTableTarget)
            this.MANY(() => {
              this.CONSUME(Comma)
              this.SUBRULE1(this.grantTableTarget)
            })
          },
        },
      ])
    })
    this.CONSUME(To)
    this.SUBRULE(this.qualifiedName)
    this.OPTION1(() => {
      this.CONSUME(With)
      this.CONSUME1(Grant)
      this.CONSUME(Option)
    })
    this.OPTION2(() => {
      this.CONSUME1(With)
      this.CONSUME(Verification)
    })
  })

  private revokeStatement = this.RULE("revokeStatement", () => {
    this.CONSUME(Revoke)
    this.SUBRULE(this.permissionList)
    this.OPTION(() => {
      this.CONSUME(On)
      this.OR([
        {
          ALT: () => {
            this.CONSUME(All)
            this.CONSUME(Tables)
          },
        },
        {
          ALT: () => {
            this.SUBRULE(this.grantTableTarget)
            this.MANY(() => {
              this.CONSUME(Comma)
              this.SUBRULE1(this.grantTableTarget)
            })
          },
        },
      ])
    })
    this.CONSUME(From)
    this.SUBRULE(this.qualifiedName)
  })

  private permissionList = this.RULE("permissionList", () => {
    this.SUBRULE(this.permissionToken)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.permissionToken)
    })
  })

  private permissionToken = this.RULE("permissionToken", () => {
    // First word (required) — includes both reserved and non-reserved keywords
    this.OR([
      { ALT: () => this.SUBRULE(this.identifier) },
      // Reserved keywords that are valid permission names but NOT in identifier rule
      { ALT: () => this.CONSUME(Select) },
      { ALT: () => this.CONSUME(Insert) },
      { ALT: () => this.CONSUME(Update) },
      { ALT: () => this.CONSUME(Create) },
      { ALT: () => this.CONSUME(Drop) },
      { ALT: () => this.CONSUME(Alter) },
      { ALT: () => this.CONSUME(All) },
      { ALT: () => this.CONSUME(Grant) },
      { ALT: () => this.CONSUME(Revoke) },
      { ALT: () => this.CONSUME(Truncate) },
      { ALT: () => this.CONSUME(Copy) },
      { ALT: () => this.CONSUME(Show) },
      { ALT: () => this.CONSUME(Vacuum) },
      { ALT: () => this.CONSUME(Lock) },
    ])
    // Optional second word (for compound permissions like CREATE TABLE, ALTER MATERIALIZED VIEW)
    this.OPTION(() => {
      this.OR1([
        {
          ALT: () => {
            this.CONSUME(Materialized)
            this.CONSUME1(View)
          },
        },
        {
          ALT: () => {
            this.CONSUME(Service)
            this.CONSUME(Account)
          },
        },
        // Reserved keywords that are NOT in the identifier rule
        { ALT: () => this.CONSUME(Table) },
        { ALT: () => this.CONSUME(Group) },
        // Any other keyword/identifier as second word (VIEW, USER, INDEX, COLUMN,
        // DATABASE ADMIN, etc.)
        { ALT: () => this.SUBRULE1(this.identifier) },
      ])
    })
  })

  private grantTableTarget = this.RULE("grantTableTarget", () => {
    this.SUBRULE(this.qualifiedName)
    this.OPTION(() => {
      this.CONSUME(LParen)
      this.SUBRULE(this.identifier)
      this.MANY(() => {
        this.CONSUME(Comma)
        this.SUBRULE1(this.identifier)
      })
      this.CONSUME(RParen)
    })
  })

  private grantAssumeServiceAccountStatement = this.RULE(
    "grantAssumeServiceAccountStatement",
    () => {
      this.CONSUME(Grant)
      this.CONSUME(Assume)
      this.CONSUME(Service)
      this.CONSUME(Account)
      this.SUBRULE(this.qualifiedName)
      this.CONSUME(To)
      this.SUBRULE1(this.qualifiedName)
      this.OPTION(() => {
        this.CONSUME(With)
        this.CONSUME1(Grant)
        this.CONSUME(Option)
      })
    },
  )

  private revokeAssumeServiceAccountStatement = this.RULE(
    "revokeAssumeServiceAccountStatement",
    () => {
      this.CONSUME(Revoke)
      this.CONSUME(Assume)
      this.CONSUME(Service)
      this.CONSUME(Account)
      this.SUBRULE(this.qualifiedName)
      this.CONSUME(From)
      this.SUBRULE1(this.qualifiedName)
    },
  )

  // ==========================================================================
  // VACUUM / RESUME WAL / SET TYPE / REINDEX
  // ==========================================================================

  private vacuumTableStatement = this.RULE("vacuumTableStatement", () => {
    this.CONSUME(Vacuum)
    this.CONSUME(Table)
    this.SUBRULE(this.qualifiedName)
  })

  private resumeWalStatement = this.RULE("resumeWalStatement", () => {
    this.CONSUME(Resume)
    this.CONSUME(Wal)
    this.OPTION(() => {
      this.CONSUME(From)
      this.OR([
        { ALT: () => this.CONSUME(Transaction) },
        { ALT: () => this.CONSUME(Txn) },
      ])
      this.OR1([
        { ALT: () => this.CONSUME(NumberLiteral) },
        { ALT: () => this.CONSUME(Identifier) },
      ])
    })
  })

  private setTypeStatement = this.RULE("setTypeStatement", () => {
    this.CONSUME(Set)
    this.CONSUME(Type)
    this.OPTION(() => this.CONSUME(Bypass))
    this.CONSUME(Wal)
  })

  private reindexTableStatement = this.RULE("reindexTableStatement", () => {
    this.CONSUME(Reindex)
    this.CONSUME(Table)
    this.SUBRULE(this.qualifiedName)
    this.OPTION(() => {
      this.CONSUME(Column)
      this.SUBRULE(this.identifier)
      this.MANY(() => {
        this.CONSUME(Comma)
        this.SUBRULE1(this.identifier)
      })
    })
    this.OPTION1(() => {
      this.CONSUME(Partition)
      this.SUBRULE(this.stringOrIdentifier)
      this.MANY1(() => {
        this.CONSUME1(Comma)
        this.SUBRULE1(this.stringOrIdentifier)
      })
    })
    this.OPTION2(() => {
      this.CONSUME(Lock)
      this.CONSUME(Exclusive)
    })
  })

  // ==========================================================================
  // REFRESH MATERIALIZED VIEW Statement
  // ==========================================================================

  private refreshMaterializedViewStatement = this.RULE(
    "refreshMaterializedViewStatement",
    () => {
      this.CONSUME(Refresh)
      this.CONSUME(Materialized)
      this.CONSUME(View)
      this.SUBRULE(this.qualifiedName)
      this.OPTION(() => {
        this.OR([
          { ALT: () => this.CONSUME(Full) },
          { ALT: () => this.CONSUME(Incremental) },
          {
            ALT: () => {
              this.CONSUME(Range)
              this.CONSUME(From)
              this.SUBRULE(this.stringOrIdentifier)
              this.CONSUME(To)
              this.SUBRULE1(this.stringOrIdentifier)
            },
          },
        ])
      })
    },
  )

  // ==========================================================================
  // PIVOT Statement
  // ==========================================================================

  private pivotStatement = this.RULE("pivotStatement", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME1(LParen)
          this.SUBRULE(this.selectStatement)
          this.CONSUME1(RParen)
        },
      },
      { ALT: () => this.SUBRULE(this.qualifiedName) },
    ])
    this.OPTION(() => this.SUBRULE(this.whereClause))
    this.CONSUME(Pivot)
    this.CONSUME(LParen)
    this.SUBRULE(this.pivotBody)
    this.CONSUME2(RParen)
    this.OPTION2(() => {
      this.CONSUME(As)
      this.SUBRULE6(this.identifier)
    })
    this.OPTION4(() => this.SUBRULE(this.orderByClause))
    this.OPTION5(() => this.SUBRULE(this.limitClause))
  })

  // Shared pivot body: aggregations, FOR clauses, optional GROUP BY
  // Used by both pivotStatement and the PIVOT clause in simpleSelect
  private pivotBody = this.RULE("pivotBody", () => {
    this.SUBRULE(this.pivotAggregation)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.pivotAggregation)
    })
    // First FOR clause (FOR keyword required to disambiguate from aggregation alias)
    this.CONSUME(For)
    this.SUBRULE(this.pivotForClause)
    // Additional FOR clauses (FOR keyword optional per QuestDB syntax)
    this.MANY1(() => {
      this.OPTION1(() => this.CONSUME1(For))
      this.SUBRULE1(this.pivotForClause)
    })
    this.OPTION(() => {
      this.CONSUME(Group)
      this.CONSUME(By)
      this.SUBRULE4(this.expression)
      this.MANY2(() => {
        this.CONSUME2(Comma)
        this.SUBRULE5(this.expression)
      })
    })
  })

  private pivotAggregation = this.RULE("pivotAggregation", () => {
    this.SUBRULE(this.expression)
    this.OPTION(() => {
      this.OPTION1(() => this.CONSUME(As))
      this.SUBRULE(this.identifier)
    })
  })

  private pivotForClause = this.RULE("pivotForClause", () => {
    // FOR keyword is consumed by pivotBody (required on first, optional on subsequent)
    this.SUBRULE(this.columnRef)
    this.CONSUME(In)
    this.CONSUME(LParen)
    this.OR([
      {
        ALT: () => {
          this.SUBRULE1(this.expression)
          this.MANY(() => {
            this.CONSUME(Comma)
            this.SUBRULE2(this.expression)
          })
        },
      },
      { ALT: () => this.SUBRULE(this.selectStatement) },
    ])
    this.CONSUME(RParen)
  })

  // ==========================================================================
  // Expressions
  // ==========================================================================

  private expression = this.RULE("expression", () => {
    this.SUBRULE(this.orExpression)
  })

  // Precedence 16: OR
  private orExpression = this.RULE("orExpression", () => {
    this.SUBRULE(this.andExpression)
    this.MANY(() => {
      this.CONSUME(Or)
      this.SUBRULE1(this.andExpression)
    })
  })

  // Precedence 15: AND
  private andExpression = this.RULE("andExpression", () => {
    this.SUBRULE(this.notExpression)
    this.MANY(() => {
      this.CONSUME(And)
      this.SUBRULE1(this.notExpression)
    })
  })

  // Precedence 14: NOT (prefix)
  private notExpression = this.RULE("notExpression", () => {
    this.OPTION(() => this.CONSUME(Not))
    this.SUBRULE(this.equalityExpression)
  })

  // Precedence 13: =, !=, <>, ~, !~, LIKE, ILIKE
  private equalityExpression = this.RULE("equalityExpression", () => {
    this.SUBRULE(this.relationalExpression)
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(Equals) },
        { ALT: () => this.CONSUME(NotEquals) },
        { ALT: () => this.CONSUME(Like) },
        { ALT: () => this.CONSUME(Ilike) },
        { ALT: () => this.CONSUME(RegexMatch) },
        { ALT: () => this.CONSUME(RegexNotMatch) },
        { ALT: () => this.CONSUME(RegexNotEquals) },
      ])
      this.SUBRULE1(this.relationalExpression)
    })
  })

  // Precedence 12: <, <=, >, >=, IS [NOT] NULL
  private relationalExpression = this.RULE("relationalExpression", () => {
    this.SUBRULE(this.setExpression)
    this.OPTION(() => {
      this.OR([
        {
          ALT: () => {
            this.OR1([
              { ALT: () => this.CONSUME(LessThan) },
              { ALT: () => this.CONSUME(LessThanOrEqual) },
              { ALT: () => this.CONSUME(GreaterThan) },
              { ALT: () => this.CONSUME(GreaterThanOrEqual) },
            ])
            this.SUBRULE1(this.setExpression)
          },
        },
        {
          ALT: () => {
            this.CONSUME(Is)
            this.OPTION1(() => this.CONSUME(Not))
            this.CONSUME(Null)
          },
        },
      ])
    })
  })

  // Precedence 11: [NOT] IN, [NOT] BETWEEN, WITHIN
  private setExpression = this.RULE("setExpression", () => {
    this.SUBRULE(this.bitOrExpression)
    this.OPTION(() => {
      this.OR([
        {
          ALT: () => {
            this.OPTION1(() => this.CONSUME(Not))
            this.CONSUME(In)
            this.OR1([
              {
                GATE: () => this.LA(1).tokenType === LParen,
                ALT: () => {
                  this.CONSUME(LParen)
                  this.SUBRULE2(this.expression)
                  this.MANY(() => {
                    this.CONSUME(Comma)
                    this.SUBRULE3(this.expression)
                  })
                  this.CONSUME(RParen)
                },
              },
              {
                ALT: () => {
                  this.SUBRULE4(this.expression)
                },
              },
            ])
          },
        },
        {
          ALT: () => {
            this.OPTION2(() => this.CONSUME1(Not))
            this.CONSUME(Between)
            this.SUBRULE1(this.bitOrExpression, { LABEL: "betweenLow" })
            this.CONSUME(And)
            this.SUBRULE2(this.bitOrExpression, { LABEL: "betweenHigh" })
          },
        },
        {
          ALT: () => {
            this.CONSUME(Within)
            this.CONSUME1(LParen)
            this.SUBRULE5(this.expression)
            this.MANY1(() => {
              this.CONSUME1(Comma)
              this.SUBRULE6(this.expression)
            })
            this.CONSUME1(RParen)
          },
        },
      ])
    })
  })

  // Precedence 10: | (bitwise OR)
  private bitOrExpression = this.RULE("bitOrExpression", () => {
    this.SUBRULE(this.bitXorExpression)
    this.MANY(() => {
      this.CONSUME(BitOr)
      this.SUBRULE1(this.bitXorExpression)
    })
  })

  // Precedence 9: ^ (bitwise XOR)
  private bitXorExpression = this.RULE("bitXorExpression", () => {
    this.SUBRULE(this.bitAndExpression)
    this.MANY(() => {
      this.CONSUME(BitXor)
      this.SUBRULE1(this.bitAndExpression)
    })
  })

  // Precedence 8: & (bitwise AND)
  private bitAndExpression = this.RULE("bitAndExpression", () => {
    this.SUBRULE(this.concatExpression)
    this.MANY(() => {
      this.CONSUME(BitAnd)
      this.SUBRULE1(this.concatExpression)
    })
  })

  // Precedence 7: || (string concatenation)
  private concatExpression = this.RULE("concatExpression", () => {
    this.SUBRULE(this.additiveExpression)
    this.MANY(() => {
      this.CONSUME(Concat)
      this.SUBRULE1(this.additiveExpression)
    })
  })

  // Precedence 5: +, -
  private additiveExpression = this.RULE("additiveExpression", () => {
    this.SUBRULE(this.multiplicativeExpression)
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(Plus) },
        { ALT: () => this.CONSUME(Minus) },
      ])
      this.SUBRULE1(this.multiplicativeExpression)
    })
  })

  // Precedence 4: *, /, %
  private multiplicativeExpression = this.RULE(
    "multiplicativeExpression",
    () => {
      this.SUBRULE(this.unaryExpression)
      this.MANY(() => {
        this.OR([
          { ALT: () => this.CONSUME(Star) },
          { ALT: () => this.CONSUME(Divide) },
          { ALT: () => this.CONSUME(Modulo) },
        ])
        this.SUBRULE1(this.unaryExpression)
      })
    },
  )

  // Precedence 3: unary -, unary ~ (bitwise complement)
  private unaryExpression = this.RULE("unaryExpression", () => {
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(Minus) },
        { ALT: () => this.CONSUME(RegexMatch) }, // ~ used as unary bitwise complement
      ])
    })
    this.SUBRULE(this.typeCastExpression)
  })

  // Precedence 2: :: (inline type cast), [] (array subscript)
  private typeCastExpression = this.RULE("typeCastExpression", () => {
    this.SUBRULE(this.primaryExpression)
    // Postfix array subscript: expr[i], expr[i:j], expr[i, j]
    this.MANY(() => {
      this.CONSUME(LBracket)
      this.SUBRULE(this.arraySubscript)
      this.MANY1(() => {
        this.CONSUME(Comma)
        this.SUBRULE1(this.arraySubscript)
      })
      this.CONSUME(RBracket)
    })
    this.OPTION(() => {
      this.CONSUME(DoubleColon)
      this.SUBRULE(this.dataType)
    })
  })

  // Array subscript element: expr, expr:expr (slice), expr: (open-ended), :expr (open-ended)
  private arraySubscript = this.RULE("arraySubscript", () => {
    this.OR([
      {
        // :expr — open-ended start (no expression before colon)
        GATE: () => this.LA(1).tokenType === Colon,
        ALT: () => {
          this.CONSUME(Colon)
          this.OPTION(() => this.SUBRULE(this.expression))
        },
      },
      {
        ALT: () => {
          this.SUBRULE1(this.expression)
          this.OPTION1(() => {
            this.CONSUME1(Colon)
            // Optional end expression: expr: (open-ended end) or expr:expr (full slice)
            this.OPTION2(() => this.SUBRULE2(this.expression))
          })
        },
      },
    ])
  })

  private primaryExpression = this.RULE("primaryExpression", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.castExpression) },
      { ALT: () => this.SUBRULE(this.caseExpression) },
      {
        // ARRAY[...] literal — must come before functionCall/columnRef
        // since ARRAY is tokenized as Identifier
        GATE: () => {
          const la1 = this.LA(1)
          return (
            la1.tokenType === Identifier &&
            la1.image.toUpperCase() === "ARRAY" &&
            this.LA(2).tokenType === LBracket
          )
        },
        ALT: () => this.SUBRULE(this.arrayLiteral),
      },
      {
        // Left() and Right() — keywords that are valid function names
        // but not general identifiers (they conflict with LEFT/RIGHT JOIN).
        GATE: () => {
          const t = this.LA(1).tokenType
          return (t === Left || t === Right) && this.LA(2).tokenType === LParen
        },
        ALT: () => this.SUBRULE(this.functionCall),
      },
      { ALT: () => this.SUBRULE(this.literal) },
      {
        ALT: () => this.CONSUME(VariableReference),
      },
      { ALT: () => this.SUBRULE(this.identifierExpression) },
      {
        ALT: () => {
          this.CONSUME(LParen)
          this.OR1([
            {
              GATE: () => {
                // Look ahead: if next token starts a subquery (DECLARE, WITH, or SELECT)
                const la = this.LA(1)
                return (
                  la.tokenType === Select ||
                  la.tokenType === With ||
                  la.tokenType === Declare
                )
              },
              ALT: () => this.SUBRULE(this.selectStatement),
            },
            {
              // Single expression or row constructor: (expr) or (expr, expr, ...)
              ALT: () => {
                this.SUBRULE(this.expression)
                this.MANY2(() => {
                  this.CONSUME1(Comma)
                  this.SUBRULE1(this.expression)
                })
              },
            },
          ])
          this.CONSUME(RParen)
        },
      },
    ])
  })

  // ARRAY[...] literal: ARRAY[expr, expr, ...] or ARRAY[[...], [...], ...]
  private arrayLiteral = this.RULE("arrayLiteral", () => {
    this.CONSUME(Identifier) // 'ARRAY'
    this.SUBRULE(this.arrayBracketBody)
  })

  // Bracket body: [element, element, ...]
  // Elements can be nested bracket bodies [...] or expressions
  private arrayBracketBody = this.RULE("arrayBracketBody", () => {
    this.CONSUME(LBracket)
    this.OPTION(() => {
      this.SUBRULE(this.arrayElement)
      this.MANY(() => {
        this.CONSUME(Comma)
        this.SUBRULE1(this.arrayElement)
      })
    })
    this.CONSUME(RBracket)
  })

  // An array element is either a nested bracket body or an expression
  private arrayElement = this.RULE("arrayElement", () => {
    this.OR([
      {
        GATE: () => this.LA(1).tokenType === LBracket,
        ALT: () => this.SUBRULE(this.arrayBracketBody),
      },
      { ALT: () => this.SUBRULE(this.expression) },
    ])
  })

  private castExpression = this.RULE("castExpression", () => {
    this.CONSUME(Cast)
    this.CONSUME(LParen)
    this.SUBRULE(this.expression)
    this.CONSUME(As)
    this.SUBRULE(this.dataType)
    this.CONSUME(RParen)
  })

  private dataType = this.RULE("dataType", () => {
    this.OR([
      { ALT: () => this.CONSUME(Symbol) },
      { ALT: () => this.CONSUME(Timestamp) },
      { ALT: () => this.CONSUME(Date) },
      { ALT: () => this.CONSUME(Int) },
      { ALT: () => this.CONSUME(Integer) },
      { ALT: () => this.CONSUME(Long) },
      { ALT: () => this.CONSUME(Long128) },
      { ALT: () => this.CONSUME(Long256) },
      { ALT: () => this.CONSUME(Short) },
      { ALT: () => this.CONSUME(Byte) },
      { ALT: () => this.CONSUME(Float) },
      { ALT: () => this.CONSUME(Double) },
      { ALT: () => this.CONSUME(Boolean) },
      { ALT: () => this.CONSUME(String) },
      { ALT: () => this.CONSUME(Char) },
      { ALT: () => this.CONSUME(Binary) },
      { ALT: () => this.CONSUME(Uuid) },
      { ALT: () => this.CONSUME(Ipv4) },
      {
        ALT: () => {
          this.CONSUME(Geohash)
          // Optional precision: GEOHASH(4b), GEOHASH(8c)
          this.OPTION2(() => {
            this.CONSUME1(LParen)
            this.CONSUME2(NumberLiteral) // precision
            this.SUBRULE(this.identifier) // unit: b (bits) or c (chars)
            this.CONSUME1(RParen)
          })
        },
      },
      { ALT: () => this.CONSUME(Varchar) },
      {
        ALT: () => {
          this.CONSUME(Decimal)
          this.OPTION(() => {
            this.CONSUME(LParen)
            this.CONSUME(NumberLiteral)
            this.OPTION1(() => {
              this.CONSUME(Comma)
              this.CONSUME1(NumberLiteral)
            })
            this.CONSUME(RParen)
          })
        },
      },
      { ALT: () => this.CONSUME(Interval) },
      { ALT: () => this.CONSUME(TimestampNs) },
      { ALT: () => this.CONSUME(Identifier) }, // For custom types
    ])
    // Optional array dimensions: DOUBLE[], DOUBLE[][]
    this.MANY(() => {
      this.CONSUME(LBracket)
      this.CONSUME(RBracket)
    })
  })

  private caseExpression = this.RULE("caseExpression", () => {
    this.CONSUME(Case)
    // Simple CASE: CASE expr WHEN val THEN res ... END
    // Searched CASE: CASE WHEN cond THEN res ... END
    // If next token is not WHEN, parse the operand expression first
    this.OPTION2(() => {
      // GATE: only parse operand if next token is NOT When
      if (this.LA(1).tokenType !== When) {
        this.SUBRULE3(this.expression) // operand
      } else {
        return // skip — it's a searched CASE
      }
    })
    this.AT_LEAST_ONE(() => {
      this.CONSUME(When)
      this.SUBRULE(this.expression)
      this.CONSUME(Then)
      this.SUBRULE1(this.expression)
    })
    this.OPTION(() => {
      this.CONSUME(Else)
      this.SUBRULE2(this.expression)
    })
    this.CONSUME(End)
  })

  // Function name: identifier + keywords that are valid function names but not general identifiers
  // Left and Right are excluded from the general identifier rule because they conflict
  // with LEFT JOIN / RIGHT JOIN in tableRef alias parsing. They are only valid as function names.
  private functionName = this.RULE("functionName", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.identifier) },
      { ALT: () => this.CONSUME(Left) },
      { ALT: () => this.CONSUME(Right) },
    ])
  })

  private functionCall = this.RULE("functionCall", () => {
    this.SUBRULE(this.functionName)
    this.CONSUME(LParen)
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(Star) },
        {
          ALT: () => {
            this.OPTION2(() => this.CONSUME(Distinct))
            this.SUBRULE(this.expression)
            this.MANY(() => {
              // Comma separates args; FROM separates extract(field FROM expr)
              this.OR2([
                { ALT: () => this.CONSUME(Comma) },
                { ALT: () => this.CONSUME(From) },
              ])
              this.SUBRULE1(this.expression)
            })
          },
        },
      ])
    })
    this.CONSUME(RParen)
    // Optional IGNORE NULLS (e.g., first_value(price IGNORE NULLS))
    this.OPTION3(() => {
      this.CONSUME(Ignore)
      this.CONSUME(Nulls)
    })
    this.OPTION1(() => this.SUBRULE(this.overClause))
  })

  // Identifier-based expression: column ref or function call (possibly schema-qualified)
  // Parses: qualifiedName [( [args] ) [IGNORE NULLS] [OVER (...)]]
  // This handles both `schema.func(args)` and `schema.column` in one rule,
  // deciding based on whether `(` follows the name.
  private identifierExpression = this.RULE("identifierExpression", () => {
    this.SUBRULE(this.qualifiedName)
    this.OPTION(() => {
      this.CONSUME(LParen)
      this.OR({
        MAX_LOOKAHEAD: 3,
        DEF: [
          // Subquery as function argument: touch(SELECT * FROM t)
          {
            GATE: () =>
              this.LA(1).tokenType === Select || this.LA(1).tokenType === With,
            ALT: () => this.SUBRULE(this.selectStatement),
          },
          {
            ALT: () => {
              this.OPTION1(() => {
                this.OR1([
                  { ALT: () => this.CONSUME(Star) },
                  {
                    ALT: () => {
                      this.OPTION2(() => this.CONSUME(Distinct))
                      this.SUBRULE(this.expression)
                      this.MANY(() => {
                        this.OR2([
                          { ALT: () => this.CONSUME(Comma) },
                          { ALT: () => this.CONSUME(From) },
                        ])
                        this.SUBRULE1(this.expression)
                      })
                    },
                  },
                ])
              })
            },
          },
        ],
      })
      this.CONSUME(RParen)
      this.OPTION3(() => {
        this.CONSUME(Ignore)
        this.CONSUME(Nulls)
      })
      this.OPTION4(() => this.SUBRULE(this.overClause))
    })
  })

  private overClause = this.RULE("overClause", () => {
    this.CONSUME(Over)
    this.OR([
      {
        ALT: () => {
          this.CONSUME(LParen)
          this.OPTION(() => this.SUBRULE(this.windowPartitionByClause))
          this.OPTION1(() => this.SUBRULE(this.orderByClause))
          this.OPTION2(() => this.SUBRULE(this.windowFrameClause))
          this.CONSUME(RParen)
        },
      },
      // Named window reference: OVER w
      { ALT: () => this.SUBRULE(this.identifier) },
    ])
  })

  private windowPartitionByClause = this.RULE("windowPartitionByClause", () => {
    this.CONSUME(Partition)
    this.CONSUME(By)
    this.SUBRULE(this.expression)
    this.MANY(() => {
      this.CONSUME(Comma)
      this.SUBRULE1(this.expression)
    })
  })

  private windowFrameClause = this.RULE("windowFrameClause", () => {
    this.OR([
      { ALT: () => this.CONSUME(Rows) },
      { ALT: () => this.CONSUME(Range) },
      { ALT: () => this.CONSUME(Groups) },
      { ALT: () => this.CONSUME(Cumulative) },
    ])
    this.OPTION(() => {
      this.OR1([
        {
          ALT: () => {
            this.CONSUME(Between)
            this.SUBRULE(this.windowFrameBound)
            this.CONSUME(And)
            this.SUBRULE1(this.windowFrameBound)
          },
        },
        {
          ALT: () => this.SUBRULE2(this.windowFrameBound),
        },
      ])
    })
    // Optional EXCLUDE clause
    this.OPTION1(() => {
      this.CONSUME(Exclude)
      this.OR2([
        {
          ALT: () => {
            this.CONSUME(Current)
            this.CONSUME(Row)
          },
        },
        {
          ALT: () => {
            this.CONSUME(No)
            this.CONSUME(Others)
          },
        },
        { ALT: () => this.CONSUME1(Groups) },
      ])
    })
  })

  private windowFrameBound = this.RULE("windowFrameBound", () => {
    this.OR([
      {
        GATE: () => this.LA(1).tokenType === Unbounded,
        ALT: () => {
          this.CONSUME(Unbounded)
          this.OR1([
            { ALT: () => this.CONSUME(Preceding) },
            { ALT: () => this.CONSUME(Following) },
          ])
        },
      },
      {
        GATE: () => this.LA(1).tokenType === Current,
        ALT: () => {
          this.CONSUME(Current)
          this.CONSUME(Row)
        },
      },
      {
        // NumberLiteral/StringLiteral timeUnit PRECEDING/FOLLOWING — must come before generic expression
        GATE: () => {
          const la1 = this.LA(1).tokenType
          if (la1 === DurationLiteral) return true
          return (
            (la1 === NumberLiteral || la1 === StringLiteral) &&
            this.isTimeUnit(this.LA(2).tokenType)
          )
        },
        ALT: () => {
          this.SUBRULE(this.durationExpression)
          this.OR3([
            { ALT: () => this.CONSUME2(Preceding) },
            { ALT: () => this.CONSUME2(Following) },
          ])
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.expression)
          this.OR2([
            { ALT: () => this.CONSUME1(Preceding) },
            { ALT: () => this.CONSUME1(Following) },
          ])
        },
      },
    ])
  })

  // Named WINDOW clause: WINDOW w AS (PARTITION BY ...)
  private windowDefinitionClause = this.RULE("windowDefinitionClause", () => {
    this.CONSUME(Window)
    this.SUBRULE(this.identifier)
    this.CONSUME(As)
    this.CONSUME(LParen)
    this.OPTION(() => this.SUBRULE(this.windowPartitionByClause))
    this.OPTION1(() => this.SUBRULE(this.orderByClause))
    this.OPTION2(() => this.SUBRULE(this.windowFrameClause))
    this.CONSUME(RParen)
  })

  // ==========================================================================
  // Basic Elements
  // ==========================================================================

  private literal = this.RULE("literal", () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
      { ALT: () => this.CONSUME(Null) },
      { ALT: () => this.CONSUME(LongLiteral) },
      { ALT: () => this.CONSUME(DecimalLiteral) },
      { ALT: () => this.CONSUME(DurationLiteral) },
      { ALT: () => this.CONSUME(GeohashLiteral) },
      { ALT: () => this.CONSUME(GeohashBinaryLiteral) },
      { ALT: () => this.CONSUME(NaN) },
    ])
  })

  private booleanLiteral = this.RULE("booleanLiteral", () => {
    this.OR([
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
    ])
  })

  private stringOrIdentifier = this.RULE("stringOrIdentifier", () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.SUBRULE(this.identifier) },
    ])
  })

  // Accepts StringLiteral or qualifiedName (dot-separated identifiers).
  // Used for entity names (views, materialized views) that can be quoted.
  private stringOrQualifiedName = this.RULE("stringOrQualifiedName", () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.SUBRULE(this.qualifiedName) },
    ])
  })

  private intervalValue = this.RULE("intervalValue", () => {
    this.OR([
      { ALT: () => this.CONSUME(DurationLiteral) },
      { ALT: () => this.CONSUME(LongLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.SUBRULE(this.identifier) },
    ])
  })

  private timeZoneValue = this.RULE("timeZoneValue", () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.SUBRULE(this.identifier) },
    ])
  })

  private columnRef = this.RULE("columnRef", () => {
    this.SUBRULE(this.qualifiedName)
  })

  private qualifiedName = this.RULE("qualifiedName", () => {
    this.SUBRULE(this.identifier)
    this.MANY(() => {
      this.CONSUME(Dot)
      this.SUBRULE1(this.identifier)
    })
  })

  private identifier = this.RULE("identifier", () => {
    // Uses the IdentifierKeyword token category to match any non-reserved
    // keyword token as an identifier, avoiding a 160+ alternative OR that
    // would make performSelfAnalysis() extremely slow.
    // See tokens.ts IDENTIFIER_KEYWORD_NAMES for the full list.
    this.OR([
      { ALT: () => this.CONSUME(Identifier) },
      { ALT: () => this.CONSUME(QuotedIdentifier) },
      { ALT: () => this.CONSUME(IdentifierKeyword) },
    ])
  })
}

// =============================================================================
// Parser Instance
// =============================================================================

export const parser = new QuestDBParser()

export function parse(input: string) {
  const lexResult = tokenize(input)

  parser.input = lexResult.tokens
  const cst = parser.statements()

  return {
    cst,
    lexErrors: lexResult.errors,
    parseErrors: parser.errors,
  }
}
