import { describe, it, expect } from "vitest"
import {
  getContentAssist,
  getNextValidTokens,
  isTokenExpected,
} from "../src/autocomplete/content-assist"

describe("Content Assist", () => {
  describe("getNextValidTokens", () => {
    it("should suggest SELECT, INSERT, etc. at start of query", () => {
      const tokens = getNextValidTokens("")
      expect(tokens).toContain("Select")
      expect(tokens).toContain("Insert")
      expect(tokens).toContain("Update")
      expect(tokens).toContain("Create")
      expect(tokens).toContain("Drop")
    })

    it("should suggest columns/expressions after SELECT", () => {
      const tokens = getNextValidTokens("SELECT ")
      expect(tokens).toContain("Identifier")
      expect(tokens).toContain("Star")
      expect(tokens).toContain("Distinct")
    })

    it("should suggest table names after FROM", () => {
      const tokens = getNextValidTokens("SELECT * FROM ")
      expect(tokens).toContain("Identifier")
      expect(tokens).toContain("LParen") // subquery
    })

    it("should suggest BY after ORDER", () => {
      const tokens = getNextValidTokens("SELECT * FROM t ORDER ")
      expect(tokens).toContain("By")
    })

    it("should suggest BY after GROUP", () => {
      const tokens = getNextValidTokens("SELECT * FROM t GROUP ")
      expect(tokens).toContain("By")
    })

    it("should suggest BY after PARTITION", () => {
      const tokens = getNextValidTokens(
        "CREATE TABLE t (id INT) TIMESTAMP(id) PARTITION ",
      )
      expect(tokens).toContain("By")
    })

    it("should suggest partition units after PARTITION BY", () => {
      const tokens = getNextValidTokens(
        "CREATE TABLE t (id INT) TIMESTAMP(id) PARTITION BY ",
      )
      expect(tokens).toContain("None")
      expect(tokens).toContain("Hour")
      expect(tokens).toContain("Day")
      expect(tokens).toContain("Week")
      expect(tokens).toContain("Month")
      expect(tokens).toContain("Year")
    })

    it("should suggest JOIN types", () => {
      const tokens = getNextValidTokens("SELECT * FROM t ")
      expect(tokens).toContain("Join")
      expect(tokens).toContain("Inner")
      expect(tokens).toContain("Left")
      expect(tokens).toContain("Right")
      expect(tokens).toContain("Cross")
    })

    it("should suggest WHERE, ORDER BY, etc. after FROM clause", () => {
      const tokens = getNextValidTokens("SELECT * FROM t ")
      expect(tokens).toContain("Where")
      expect(tokens).toContain("Order")
      expect(tokens).toContain("Group")
      expect(tokens).toContain("Limit")
    })

    it("should suggest ALTER TABLE actions", () => {
      const tokens = getNextValidTokens("ALTER TABLE t ")
      expect(tokens).toContain("Add")
      expect(tokens).toContain("Drop")
      expect(tokens).toContain("Rename")
      expect(tokens).toContain("Alter")
    })

    it("should suggest ASOF and LT join types", () => {
      const tokens = getNextValidTokens("SELECT * FROM t ")
      expect(tokens).toContain("Asof")
      expect(tokens).toContain("Lt")
      expect(tokens).toContain("Splice")
    })

    it("should suggest TOLERANCE after ASOF JOIN ON clause", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM t ASOF JOIN u ON t.ts = u.ts ",
      )
      expect(tokens).toContain("Tolerance")
    })

    it("should suggest TOLERANCE after LT JOIN ON clause", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM t LT JOIN u ON t.ts = u.ts ",
      )
      expect(tokens).toContain("Tolerance")
    })

    it("should suggest DurationLiteral after TOLERANCE", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM t ASOF JOIN u ON t.ts = u.ts TOLERANCE ",
      )
      expect(tokens).toContain("DurationLiteral")
    })
  })

  describe("getContentAssist", () => {
    it("should find tables in scope", () => {
      const result = getContentAssist(
        "SELECT  FROM trades WHERE symbol = 'BTC'",
        7, // cursor after "SELECT "
      )
      expect(result.tablesInScope).toHaveLength(1)
      expect(result.tablesInScope[0].table).toBe("trades")
    })

    it("should find tables with aliases", () => {
      const result = getContentAssist(
        "SELECT t.* FROM trades t WHERE t.symbol = 'BTC'",
        9, // cursor in select list
      )
      expect(result.tablesInScope).toHaveLength(1)
      expect(result.tablesInScope[0].table).toBe("trades")
      expect(result.tablesInScope[0].alias).toBe("t")
    })

    it("should find multiple tables from JOINs", () => {
      const result = getContentAssist(
        "SELECT  FROM trades t JOIN orders o ON t.id = o.trade_id",
        7,
      )
      expect(result.tablesInScope).toHaveLength(2)
      expect(result.tablesInScope.map((t) => t.table)).toContain("trades")
      expect(result.tablesInScope.map((t) => t.table)).toContain("orders")
    })

    it("should return next valid token types", () => {
      const result = getContentAssist("SELECT ", 7)
      const tokenNames = result.nextTokenTypes.map((t) => t.name)
      expect(tokenNames).toContain("Identifier")
      expect(tokenNames).toContain("Star")
    })

    it("fallback should extract quoted table names and aliases", () => {
      const sql = 'FROM "my-table" t'
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toContainEqual({
        table: "my-table",
        alias: "t",
      })
    })

    it("fallback should extract identifier-keyword table names", () => {
      const sql = "FROM default d"
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toContainEqual({
        table: "default",
        alias: "d",
      })
    })

    it("fallback should extract qualified table names with quoted parts", () => {
      const sql = 'FROM metrics."daily-trades" dt'
      const result = getContentAssist(sql, sql.length)
      // Schema-qualified names resolve to the bare table name for schema lookup
      expect(result.tablesInScope).toContainEqual({
        table: "daily-trades",
        alias: "dt",
      })
    })
  })

  describe("isTokenExpected", () => {
    it("should return true for valid next token", () => {
      expect(isTokenExpected("SELECT * ", "From")).toBe(true)
    })

    it("should return false for invalid next token", () => {
      // "Values" is not valid after SELECT - it's only valid after INSERT INTO table
      expect(isTokenExpected("SELECT * ", "Values")).toBe(false)
    })

    it("should return true for BY after ORDER", () => {
      expect(isTokenExpected("SELECT * FROM t ORDER ", "By")).toBe(true)
    })
  })

  describe("Autocomplete fixes", () => {
    // Fix 15: CTE autocomplete
    it("should suggest Select after CTE definition", () => {
      const tokens = getNextValidTokens("WITH cte AS (SELECT 1) ")
      expect(tokens).toContain("Select")
    })

    it("should suggest Update after CTE definition", () => {
      const tokens = getNextValidTokens("WITH cte AS (SELECT 1) ")
      expect(tokens).toContain("Update")
    })

    it("should suggest Identifier for next CTE name after comma", () => {
      const tokens = getNextValidTokens("WITH cte AS (SELECT 1), ")
      expect(tokens).toContain("Identifier")
    })

    it("should include CTE name in tablesInScope", () => {
      const sql = "WITH cte AS (SELECT 1) SELECT * FROM "
      const result = getContentAssist(sql, sql.length)
      const tableNames = result.tablesInScope.map((t) => t.table)
      expect(tableNames).toContain("cte")
    })

    it("should include multiple CTE names in tablesInScope", () => {
      const sql = "WITH a AS (SELECT 1), b AS (SELECT 2) SELECT * FROM "
      const result = getContentAssist(sql, sql.length)
      const tableNames = result.tablesInScope.map((t) => t.table)
      expect(tableNames).toContain("a")
      expect(tableNames).toContain("b")
    })

    it("should extract CTE columns from inner SELECT with aliases", () => {
      const sql =
        "WITH cte AS (SELECT symbol AS sym, price AS p FROM trades) SELECT  FROM cte"
      const result = getContentAssist(sql, sql.indexOf(" FROM cte"))
      expect(result.cteColumns["cte"]).toBeDefined()
      const colNames = result.cteColumns["cte"].map((c) => c.name)
      expect(colNames).toContain("sym")
      expect(colNames).toContain("p")
    })

    it("should extract CTE columns from bare column references", () => {
      const sql =
        "WITH cte AS (SELECT symbol, price FROM trades) SELECT  FROM cte"
      const result = getContentAssist(sql, sql.indexOf(" FROM cte"))
      expect(result.cteColumns["cte"]).toBeDefined()
      const colNames = result.cteColumns["cte"].map((c) => c.name)
      expect(colNames).toContain("symbol")
      expect(colNames).toContain("price")
    })

    it("should extract CTE columns from function calls", () => {
      const sql =
        "WITH cte AS (SELECT count(*), avg(price) FROM trades) SELECT  FROM cte"
      const result = getContentAssist(sql, sql.indexOf(" FROM cte"))
      expect(result.cteColumns["cte"]).toBeDefined()
      const colNames = result.cteColumns["cte"].map((c) => c.name)
      expect(colNames).toContain("count")
      expect(colNames).toContain("avg")
    })

    it("should extract columns from multiple CTEs", () => {
      const sql =
        "WITH a AS (SELECT symbol FROM trades), b AS (SELECT id FROM orders) SELECT  FROM a"
      const result = getContentAssist(sql, sql.indexOf(" FROM a"))
      expect(result.cteColumns["a"]).toBeDefined()
      expect(result.cteColumns["b"]).toBeDefined()
      expect(result.cteColumns["a"].map((c) => c.name)).toContain("symbol")
      expect(result.cteColumns["b"].map((c) => c.name)).toContain("id")
    })

    it("should extract CTE columns from complex window function aliases (Bollinger Bands)", () => {
      const sql =
        "WITH OHLC AS (SELECT timestamp, symbol, first(price) AS open, max(price) AS high, min(price) AS low, last(price) AS close, sum(amount) AS volume FROM trades SAMPLE BY 15m) SELECT  FROM OHLC"
      const result = getContentAssist(sql, sql.indexOf(" FROM OHLC"))
      expect(result.cteColumns["ohlc"]).toBeDefined()
      const colNames = result.cteColumns["ohlc"].map((c) => c.name)
      expect(colNames).toContain("timestamp")
      expect(colNames).toContain("symbol")
      expect(colNames).toContain("open")
      expect(colNames).toContain("high")
      expect(colNames).toContain("low")
      expect(colNames).toContain("close")
      expect(colNames).toContain("volume")
    })

    it("should extract CTE columns with rank() window function alias", () => {
      const sql =
        "WITH totals AS (SELECT symbol, count() AS total FROM trades), ranked AS (SELECT symbol, total, rank() OVER (ORDER BY total DESC) AS ranking FROM totals) SELECT  FROM ranked"
      const result = getContentAssist(sql, sql.indexOf(" FROM ranked"))
      expect(result.cteColumns["ranked"]).toBeDefined()
      const colNames = result.cteColumns["ranked"].map((c) => c.name)
      expect(colNames).toContain("symbol")
      expect(colNames).toContain("total")
      expect(colNames).toContain("ranking")
    })

    it("should extract CTE columns when CTE name shadows a schema table", () => {
      const sql =
        "WITH trades AS (SELECT 1 AS custom_col) SELECT  FROM trades"
      const result = getContentAssist(sql, sql.indexOf(" FROM trades"))
      expect(result.cteColumns["trades"]).toBeDefined()
      expect(result.cteColumns["trades"].map((c) => c.name)).toContain(
        "custom_col",
      )
    })

    it("should handle CTE with literal-only select without crashing", () => {
      const sql = "WITH cte AS (SELECT 1, 'hello') SELECT  FROM cte"
      const result = getContentAssist(sql, sql.indexOf(" FROM cte"))
      expect(result.tablesInScope.map((t) => t.table)).toContain("cte")
    })

    it("should not leak inner CTE source tables into outer tablesInScope", () => {
      const sql =
        "WITH cte AS (SELECT symbol AS sym FROM trades) SELECT  FROM cte"
      const result = getContentAssist(sql, sql.indexOf(" FROM cte"))
      const tableNames = result.tablesInScope.map((t) => t.table)
      expect(tableNames).toContain("cte")
      expect(tableNames).not.toContain("trades")
    })

    // Fix 16: qualifiedStar autocomplete
    it("should suggest Comma after qualified column in select list", () => {
      const tokens = getNextValidTokens("SELECT t.col ")
      expect(tokens).toContain("Comma")
    })

    it("should suggest From after qualified column in select list", () => {
      const tokens = getNextValidTokens("SELECT t.col ")
      expect(tokens).toContain("From")
    })

    it("should suggest As after qualified column in select list", () => {
      const tokens = getNextValidTokens("SELECT t.col ")
      expect(tokens).toContain("As")
    })

    it("should suggest Dot after qualified column for qualifiedStar continuation", () => {
      const tokens = getNextValidTokens("SELECT t.col ")
      expect(tokens).toContain("Dot")
    })
  })

  describe("clause transition autocomplete", () => {
    // WHERE clause
    it("should suggest WHERE after FROM table", () => {
      const tokens = getNextValidTokens("SELECT * FROM trades ")
      expect(tokens).toContain("Where")
    })

    it("should suggest expression tokens after WHERE", () => {
      const tokens = getNextValidTokens("SELECT * FROM trades WHERE ")
      expect(tokens).toContain("Identifier")
    })

    // LIMIT clause
    it("should suggest LIMIT after FROM table", () => {
      const tokens = getNextValidTokens("SELECT * FROM trades ")
      expect(tokens).toContain("Limit")
    })

    it("should suggest expression after LIMIT", () => {
      const tokens = getNextValidTokens("SELECT * FROM trades LIMIT ")
      expect(tokens).toContain("NumberLiteral")
      expect(tokens).toContain("Minus")
    })

    it("should suggest LIMIT after WHERE clause", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM trades WHERE price > 100 ",
      )
      expect(tokens).toContain("Limit")
    })

    // GROUP BY clause
    it("should suggest GROUP after FROM table", () => {
      const tokens = getNextValidTokens("SELECT count(*) FROM trades ")
      expect(tokens).toContain("Group")
    })

    it("should suggest column after GROUP BY", () => {
      const tokens = getNextValidTokens(
        "SELECT symbol, count(*) FROM trades GROUP BY ",
      )
      expect(tokens).toContain("Identifier")
    })

    it("should suggest ORDER, LIMIT after GROUP BY column", () => {
      const tokens = getNextValidTokens(
        "SELECT symbol, count(*) FROM trades GROUP BY symbol ",
      )
      expect(tokens).toContain("Order")
      expect(tokens).toContain("Limit")
    })

    // ORDER BY clause
    it("should suggest ORDER after WHERE clause", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM trades WHERE price > 100 ",
      )
      expect(tokens).toContain("Order")
    })

    it("should suggest column after ORDER BY", () => {
      const tokens = getNextValidTokens("SELECT * FROM trades ORDER BY ")
      expect(tokens).toContain("Identifier")
    })

    it("should suggest ASC/DESC after ORDER BY column", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM trades ORDER BY timestamp ",
      )
      expect(tokens).toContain("Asc")
      expect(tokens).toContain("Desc")
    })

    it("should suggest LIMIT after ORDER BY", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM trades ORDER BY timestamp DESC ",
      )
      expect(tokens).toContain("Limit")
    })

    // SAMPLE BY clause (QuestDB-specific)
    it("should suggest SAMPLE after FROM table", () => {
      const tokens = getNextValidTokens(
        "SELECT timestamp, avg(price) FROM trades ",
      )
      expect(tokens).toContain("Sample")
    })

    it("should suggest BY after SAMPLE", () => {
      const tokens = getNextValidTokens(
        "SELECT timestamp, avg(price) FROM trades SAMPLE ",
      )
      expect(tokens).toContain("By")
    })

    it("should suggest duration after SAMPLE BY", () => {
      const tokens = getNextValidTokens(
        "SELECT timestamp, avg(price) FROM trades SAMPLE BY ",
      )
      expect(tokens).toContain("DurationLiteral")
    })

    it("should suggest FILL after SAMPLE BY duration", () => {
      const tokens = getNextValidTokens(
        "SELECT timestamp, avg(price) FROM trades SAMPLE BY 1h ",
      )
      expect(tokens).toContain("Fill")
    })

    // LATEST ON clause (QuestDB-specific)
    it("should suggest LATEST after FROM table", () => {
      const tokens = getNextValidTokens("SELECT * FROM trades ")
      expect(tokens).toContain("Latest")
    })

    it("should suggest ON after LATEST", () => {
      const tokens = getNextValidTokens("SELECT * FROM trades LATEST ")
      expect(tokens).toContain("On")
    })

    it("should suggest PARTITION after LATEST ON column", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM trades LATEST ON timestamp ",
      )
      expect(tokens).toContain("Partition")
    })

    // DISTINCT clause
    it("should suggest DISTINCT after SELECT", () => {
      const tokens = getNextValidTokens("SELECT ")
      expect(tokens).toContain("Distinct")
    })

    it("should suggest columns after SELECT DISTINCT", () => {
      const tokens = getNextValidTokens("SELECT DISTINCT ")
      expect(tokens).toContain("Identifier")
    })

    // Window functions
    it("should suggest OVER after window-eligible function", () => {
      const tokens = getNextValidTokens("SELECT lag(price) ")
      expect(tokens).toContain("Over")
    })

    it("should suggest PARTITION and ORDER inside OVER", () => {
      const tokens = getNextValidTokens("SELECT lag(price) OVER (")
      expect(tokens).toContain("Partition")
      expect(tokens).toContain("Order")
    })

    // INSERT clause transitions
    it("should suggest INTO after INSERT", () => {
      const tokens = getNextValidTokens("INSERT ")
      expect(tokens).toContain("Into")
    })

    it("should suggest VALUES or SELECT after INSERT INTO table", () => {
      const tokens = getNextValidTokens("INSERT INTO trades ")
      expect(tokens).toContain("Values")
      expect(tokens).toContain("Select")
    })

    // UPDATE clause transitions
    it("should suggest SET after UPDATE table", () => {
      const tokens = getNextValidTokens("UPDATE trades ")
      expect(tokens).toContain("Set")
    })

    it("should suggest FROM or WHERE after SET assignment", () => {
      const tokens = getNextValidTokens("UPDATE trades SET price = 100 ")
      expect(tokens).toContain("From")
      expect(tokens).toContain("Where")
    })

    // BACKUP
    it("should suggest DATABASE, TABLE or ABORT after BACKUP", () => {
      const tokens = getNextValidTokens("BACKUP ")
      expect(tokens).toContain("Database")
      expect(tokens).toContain("Table")
      expect(tokens).toContain("Abort")
    })

    // COPY TO
    it("should suggest TO after COPY subquery", () => {
      const tokens = getNextValidTokens("COPY (SELECT * FROM trades) ")
      expect(tokens).toContain("To")
    })

    // CREATE TABLE AS SELECT
    it("should suggest AS after CREATE TABLE name", () => {
      const tokens = getNextValidTokens("CREATE TABLE t ")
      expect(tokens).toContain("As")
    })

    it("should suggest TIMESTAMP after CREATE TABLE AS SELECT", () => {
      const tokens = getNextValidTokens("CREATE TABLE t AS (SELECT * FROM s) ")
      expect(tokens).toContain("Timestamp")
    })
  })

  describe("railroad/syntax doc autocomplete", () => {
    // ALTER TABLE sub-operations
    it("should suggest PARTITION after ALTER TABLE ATTACH", () => {
      const tokens = getNextValidTokens("ALTER TABLE trades ATTACH ")
      expect(tokens).toContain("Partition")
    })

    it("should suggest PARTITION after ALTER TABLE DETACH", () => {
      const tokens = getNextValidTokens("ALTER TABLE trades DETACH ")
      expect(tokens).toContain("Partition")
    })

    it("should suggest Param, Ttl, Type after ALTER TABLE SET", () => {
      const tokens = getNextValidTokens("ALTER TABLE trades SET ")
      expect(tokens).toContain("Param")
      expect(tokens).toContain("Ttl")
      expect(tokens).toContain("Type")
    })

    it("should suggest Enable, Disable after ALTER TABLE DEDUP", () => {
      const tokens = getNextValidTokens("ALTER TABLE trades DEDUP ")
      expect(tokens).toContain("Enable")
      expect(tokens).toContain("Disable")
    })

    it("should suggest Wal after ALTER TABLE RESUME", () => {
      const tokens = getNextValidTokens("ALTER TABLE trades RESUME ")
      expect(tokens).toContain("Wal")
    })

    // SAMPLE BY extensions
    it("should suggest Calendar, First after ALIGN TO", () => {
      const tokens = getNextValidTokens(
        "SELECT a FROM t SAMPLE BY 1h ALIGN TO ",
      )
      expect(tokens).toContain("Calendar")
      expect(tokens).toContain("First")
    })

    it("should suggest To after SAMPLE BY FROM bound", () => {
      const tokens = getNextValidTokens(
        "SELECT a FROM t SAMPLE BY 1d FROM '2024-01-01' ",
      )
      expect(tokens).toContain("To")
    })

    // Set operations
    it("should suggest All after UNION", () => {
      const tokens = getNextValidTokens("SELECT 1 UNION ")
      expect(tokens).toContain("All")
      expect(tokens).toContain("Select")
    })

    it("should suggest All after EXCEPT", () => {
      const tokens = getNextValidTokens("SELECT 1 EXCEPT ")
      expect(tokens).toContain("All")
      expect(tokens).toContain("Select")
    })

    it("should suggest All after INTERSECT", () => {
      const tokens = getNextValidTokens("SELECT 1 INTERSECT ")
      expect(tokens).toContain("All")
      expect(tokens).toContain("Select")
    })

    // Window function frames
    it("should suggest Rows, Range, Cumulative after ORDER BY in OVER", () => {
      const tokens = getNextValidTokens("SELECT avg(price) OVER (ORDER BY ts ")
      expect(tokens).toContain("Rows")
      expect(tokens).toContain("Range")
      expect(tokens).toContain("Cumulative")
    })

    it("should suggest Between after ROWS in OVER", () => {
      const tokens = getNextValidTokens(
        "SELECT avg(price) OVER (ORDER BY ts ROWS ",
      )
      expect(tokens).toContain("Between")
    })

    // WINDOW JOIN
    it("should suggest Range after WINDOW JOIN ON condition", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM t1 WINDOW JOIN t2 ON ts ",
      )
      expect(tokens).toContain("Range")
    })

    it("should suggest Include, Exclude after WINDOW JOIN RANGE clause", () => {
      const tokens = getNextValidTokens(
        "SELECT * FROM t1 WINDOW JOIN t2 ON ts RANGE BETWEEN 1 minute PRECEDING AND 1 minute FOLLOWING ",
      )
      expect(tokens).toContain("Include")
      expect(tokens).toContain("Exclude")
    })

    // INSERT with columns
    it("should suggest Values, Select after INSERT INTO table (columns)", () => {
      const tokens = getNextValidTokens("INSERT INTO trades (ts, symbol) ")
      expect(tokens).toContain("Values")
      expect(tokens).toContain("Select")
    })

    // COPY FROM options
    it("should suggest With after COPY FROM file", () => {
      const tokens = getNextValidTokens("COPY trades FROM '/tmp/data.csv' ")
      expect(tokens).toContain("With")
    })

    // GRANT options
    it("should suggest With after GRANT TO entity", () => {
      const tokens = getNextValidTokens("GRANT SELECT ON trades TO analyst ")
      expect(tokens).toContain("With")
    })

    // EXPLAIN
    it("should suggest Select, Insert, Update after EXPLAIN", () => {
      const tokens = getNextValidTokens("EXPLAIN ")
      expect(tokens).toContain("Select")
      expect(tokens).toContain("Insert")
      expect(tokens).toContain("Update")
    })

    // Materialized View
    it("should suggest Timestamp after CREATE MATERIALIZED VIEW AS", () => {
      const tokens = getNextValidTokens(
        "CREATE MATERIALIZED VIEW mv AS (SELECT * FROM t SAMPLE BY 1h) ",
      )
      expect(tokens).toContain("Timestamp")
    })

    it("should suggest Refresh, Ttl after ALTER MATERIALIZED VIEW SET", () => {
      const tokens = getNextValidTokens("ALTER MATERIALIZED VIEW mv SET ")
      expect(tokens).toContain("Refresh")
      expect(tokens).toContain("Ttl")
    })

    it("should suggest Full, Incremental, Range after REFRESH MATERIALIZED VIEW", () => {
      const tokens = getNextValidTokens("REFRESH MATERIALIZED VIEW mv ")
      expect(tokens).toContain("Full")
      expect(tokens).toContain("Incremental")
      expect(tokens).toContain("Range")
    })
  })

  describe("fallback table extraction with keyword-named tables", () => {
    // When the query is incomplete (e.g. unfinished WHERE), the AST parse fails
    // and extractTables falls back to token scanning. These tests verify that
    // keyword-named tables (default, timestamp, type, etc.) are recognized
    // in that fallback path.

    it("should extract keyword table name in incomplete query", () => {
      const sql = "SELECT * FROM default WHERE "
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toContainEqual(
        expect.objectContaining({ table: "default" }),
      )
    })

    it("should extract keyword table name with alias in incomplete query", () => {
      const sql = "SELECT * FROM timestamp t WHERE "
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toContainEqual(
        expect.objectContaining({ table: "timestamp", alias: "t" }),
      )
    })

    it("should extract keyword table after JOIN in incomplete query", () => {
      const sql = "SELECT * FROM trades t JOIN index i ON "
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toContainEqual(
        expect.objectContaining({ table: "index", alias: "i" }),
      )
    })

    it("should extract keyword table in qualified name in incomplete query", () => {
      const sql = "SELECT , FROM schema.default WHERE "
      const result = getContentAssist(sql, sql.length)
      // Schema-qualified names resolve to the bare table name for schema lookup
      expect(result.tablesInScope).toContainEqual(
        expect.objectContaining({ table: "default" }),
      )
    })
  })

  describe("infer table from qualified reference (no FROM clause)", () => {
    it("should infer table from 'SELECT trades.' when no FROM clause", () => {
      const sql = "SELECT trades."
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toHaveLength(1)
      expect(result.tablesInScope[0].table).toBe("trades")
    })

    it("should infer table when typing column name after dot", () => {
      const sql = "SELECT trades.sy"
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toHaveLength(1)
      expect(result.tablesInScope[0].table).toBe("trades")
    })

    it("should NOT infer table when FROM clause provides tables", () => {
      const sql = "SELECT trades. FROM othertable"
      const result = getContentAssist(sql, 14)
      expect(result.tablesInScope).toHaveLength(1)
      expect(result.tablesInScope[0].table).toBe("othertable")
    })

    it("should NOT infer table when table already in scope with alias", () => {
      const sql = "SELECT trades. FROM trades t"
      const result = getContentAssist(sql, 14)
      expect(result.tablesInScope).toHaveLength(1)
      expect(result.tablesInScope[0].table).toBe("trades")
      expect(result.tablesInScope[0].alias).toBe("t")
    })

    it("should infer quoted table name", () => {
      const sql = 'SELECT "my-table".'
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toHaveLength(1)
      expect(result.tablesInScope[0].table).toBe("my-table")
    })

    it("should infer keyword-named table", () => {
      const sql = "SELECT default."
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toHaveLength(1)
      expect(result.tablesInScope[0].table).toBe("default")
    })

    it("should infer table from schema-qualified reference", () => {
      const sql = "SELECT schema.trades."
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toHaveLength(1)
      expect(result.tablesInScope[0].table).toBe("trades")
    })

    it("should not infer when there is no qualified reference", () => {
      const sql = "SELECT "
      const result = getContentAssist(sql, sql.length)
      expect(result.tablesInScope).toHaveLength(0)
    })
  })

  describe("PIVOT autocomplete", () => {
    it("should suggest aggregation start after PIVOT (", () => {
      const tokens = getNextValidTokens("trades PIVOT (")
      // Should suggest expression tokens for aggregation
      expect(tokens).toContain("Identifier")
    })

    it("should suggest FOR or comma after aggregation", () => {
      const tokens = getNextValidTokens("trades PIVOT (avg(price) ")
      expect(tokens).toContain("For")
      expect(tokens).toContain("Comma")
    })

    it("should suggest column after FOR", () => {
      const tokens = getNextValidTokens("trades PIVOT (avg(price) FOR ")
      expect(tokens).toContain("Identifier")
    })

    it("should suggest IN after FOR column", () => {
      const tokens = getNextValidTokens("trades PIVOT (avg(price) FOR symbol ")
      expect(tokens).toContain("In")
    })

    it("should suggest values or SELECT inside FOR ... IN (", () => {
      const tokens = getNextValidTokens(
        "trades PIVOT (avg(price) FOR symbol IN (",
      )
      expect(tokens).toContain("StringLiteral")
      expect(tokens).toContain("Select")
    })

    it("should suggest FOR, identifier, GROUP, RParen after FOR clause", () => {
      const tokens = getNextValidTokens(
        "trades PIVOT (avg(price) FOR symbol IN ('BTC-USD', 'ETH-USD') ",
      )
      // Another FOR clause (with or without FOR keyword)
      expect(tokens).toContain("For")
      expect(tokens).toContain("Identifier")
      // GROUP BY
      expect(tokens).toContain("Group")
      // Close PIVOT
      expect(tokens).toContain("RParen")
    })

    it("should suggest BY after GROUP inside PIVOT", () => {
      const tokens = getNextValidTokens(
        "trades PIVOT (avg(price) FOR symbol IN ('BTC-USD') GROUP ",
      )
      expect(tokens).toContain("By")
    })

    it("should suggest ORDER, LIMIT, AS after closing PIVOT )", () => {
      const tokens = getNextValidTokens(
        "trades PIVOT (avg(price) FOR symbol IN ('BTC-USD')) ",
      )
      expect(tokens).toContain("Order")
      expect(tokens).toContain("Limit")
      expect(tokens).toContain("As")
    })
  })
})
