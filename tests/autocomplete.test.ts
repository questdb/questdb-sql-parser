import { describe, it, expect } from "vitest"
import {
  createAutocompleteProvider,
  SuggestionKind,
  SuggestionPriority,
} from "../src/index"
import type {
  AutocompleteProvider,
  Suggestion,
} from "../src/autocomplete/types"

// =============================================================================
// Test Utility: Autocomplete Walkthrough
// =============================================================================
// Tests that autocomplete provides relevant suggestions at each word boundary
// in a SQL statement. This ensures the parser is responsive and provides
// correct context-aware suggestions as the user types.

interface WalkthroughStep {
  /** The partial SQL up to this point (what user has typed so far) */
  typed: string
  /** Token names or keyword labels expected in suggestions */
  expects: string[]
  /** Token names or keyword labels that should NOT appear */
  rejects?: string[]
}

/**
 * Assert autocomplete suggestions at each step of typing a SQL statement.
 * Each step represents a word boundary where the user pauses and expects suggestions.
 */
function assertSuggestionsWalkthrough(
  provider: AutocompleteProvider,
  steps: WalkthroughStep[],
) {
  for (const step of steps) {
    const suggestions = provider.getSuggestions(step.typed, step.typed.length)
    const labels = suggestions.map((s) => s.label)

    for (const expected of step.expects) {
      expect(labels).toContain(expected)
    }

    if (step.rejects) {
      for (const rejected of step.rejects) {
        expect(labels).not.toContain(rejected)
      }
    }
  }
}

/**
 * Helper: get suggestion labels at a given position
 */
function getLabelsAt(
  provider: AutocompleteProvider,
  sql: string,
  offset?: number,
): string[] {
  return provider.getSuggestions(sql, offset ?? sql.length).map((s) => s.label)
}

/**
 * Helper: get suggestions of a specific kind at a given position
 */
function getSuggestionsOfKind(
  provider: AutocompleteProvider,
  sql: string,
  kind: SuggestionKind,
  offset?: number,
): Suggestion[] {
  return provider
    .getSuggestions(sql, offset ?? sql.length)
    .filter((s) => s.kind === kind)
}

// =============================================================================
// Test Schema
// =============================================================================

const schema = {
  tables: [
    { name: "trades", designatedTimestamp: "timestamp" },
    { name: "orders" },
    { name: "users" },
  ],
  columns: {
    trades: [
      { name: "symbol", type: "STRING" },
      { name: "price", type: "DOUBLE" },
      { name: "amount", type: "DOUBLE" },
      { name: "timestamp", type: "TIMESTAMP" },
    ],
    orders: [
      { name: "id", type: "LONG" },
      { name: "status", type: "STRING" },
    ],
    users: [
      { name: "name", type: "STRING" },
      { name: "email", type: "STRING" },
    ],
  },
}

const provider = createAutocompleteProvider(schema)

// =============================================================================
// Tests
// =============================================================================

describe("createAutocompleteProvider", () => {
  describe("keyword suggestions", () => {
    it("suggests TABLE after CREATE", () => {
      const labels = getLabelsAt(provider, "CREATE ")
      expect(labels).toContain("TABLE")
      expect(labels).not.toContain("SELECT")
    })

    it("suggests valid actions after ALTER TABLE tableName", () => {
      const labels = getLabelsAt(provider, "ALTER TABLE trades ")
      expect(labels).toContain("ADD")
      expect(labels).toContain("DROP")
      expect(labels).toContain("RENAME")
    })

    it("suggests FROM after SELECT * and does NOT suggest columns", () => {
      const suggestions = provider.getSuggestions("SELECT * ", 9)
      const labels = suggestions.map((s) => s.label)
      expect(labels).toContain("FROM")
      // After SELECT *, all columns are already selected — suggesting
      // column names makes no sense. Only keywords should appear.
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns).toHaveLength(0)
    })

    it("suggests FROM when typing 'FR' after SELECT * (mid-word)", () => {
      const suggestions = provider.getSuggestions("SELECT * FR", 11)
      const labels = suggestions.map((s) => s.label)
      expect(labels).toContain("FROM")
      // No columns, tables, or functions should appear — only keywords
      const nonKeywords = suggestions.filter(
        (s) => s.kind !== SuggestionKind.Keyword,
      )
      expect(nonKeywords).toHaveLength(0)
    })

    it("suggests BY after ORDER", () => {
      const labels = getLabelsAt(provider, "SELECT * FROM trades ORDER ")
      expect(labels).toContain("BY")
    })
  })

  describe("column suggestions", () => {
    it("suggests columns after SELECT (with FROM clause)", () => {
      const columns = getSuggestionsOfKind(
        provider,
        "SELECT  FROM trades",
        SuggestionKind.Column,
        7,
      )
      expect(columns.length).toBeGreaterThan(0)
      const columnLabels = columns.map((s) => s.label)
      expect(columnLabels).toContain("symbol")
      expect(columnLabels).toContain("price")
      expect(columnLabels).toContain("timestamp")
      expect(columns.every((s) => s.priority === SuggestionPriority.High)).toBe(
        true,
      )
    })

    it("suggests columns in WHERE clause", () => {
      const columns = getSuggestionsOfKind(
        provider,
        "SELECT * FROM trades WHERE ",
        SuggestionKind.Column,
      )
      expect(columns.length).toBeGreaterThan(0)
      expect(columns.map((s) => s.label)).toContain("symbol")
    })
  })

  describe("table suggestions", () => {
    it("suggests tables after FROM", () => {
      const tables = getSuggestionsOfKind(
        provider,
        "SELECT * FROM ",
        SuggestionKind.Table,
      )
      expect(tables.length).toBeGreaterThan(0)
      const tableLabels = tables.map((s) => s.label)
      expect(tableLabels).toContain("trades")
      expect(tableLabels).toContain("orders")
    })

    it("suggests tables after JOIN", () => {
      const tables = getSuggestionsOfKind(
        provider,
        "SELECT * FROM trades JOIN ",
        SuggestionKind.Table,
      )
      expect(tables.length).toBeGreaterThan(0)
    })

    it("suggests tables after FROM when select items are missing", () => {
      const tables = getSuggestionsOfKind(
        provider,
        "SELECT FROM ",
        SuggestionKind.Table,
      )
      expect(tables.length).toBe(3)
      const tableLabels = tables.map((s) => s.label).sort()
      expect(tableLabels).toContain("trades")
      expect(tableLabels).toContain("orders")
      expect(tableLabels).toContain("users")
    })

    it("suggests tables after FROM when typing partial table name without select items", () => {
      const tables = getSuggestionsOfKind(
        provider,
        "SELECT FROM t",
        SuggestionKind.Table,
      )
      expect(tables.length).toBe(3)
    })

    it("should NOT suggest the partial word itself as a table (phantom suggestion)", () => {
      // Typing "FROM te" — "te" is not a real table but gets captured by
      // extractTables because it follows FROM. It must not be suggested back.
      const tables = getSuggestionsOfKind(
        provider,
        "SELECT amount FROM te",
        SuggestionKind.Table,
      )
      const labels = tables.map((s) => s.label)
      expect(labels).not.toContain("te")
      // Real schema tables should still be present
      expect(labels).toContain("trades")
      expect(labels).toContain("orders")
      expect(labels).toContain("users")
    })

    it("should NOT suggest longer partial words as tables", () => {
      const tables = getSuggestionsOfKind(
        provider,
        "SELECT amount FROM tes",
        SuggestionKind.Table,
      )
      const labels = tables.map((s) => s.label)
      expect(labels).not.toContain("tes")
    })

    it("should NOT suggest partial word after JOIN", () => {
      const tables = getSuggestionsOfKind(
        provider,
        "SELECT * FROM trades JOIN or",
        SuggestionKind.Table,
      )
      const labels = tables.map((s) => s.label)
      expect(labels).not.toContain("or")
      expect(labels).toContain("orders")
    })

    it("should still suggest real table when partial matches schema table", () => {
      // Typing "trades" mid-word — it IS a real table, should be kept
      const tables = getSuggestionsOfKind(
        provider,
        "SELECT * FROM trades",
        SuggestionKind.Table,
      )
      const labels = tables.map((s) => s.label)
      expect(labels).toContain("trades")
    })

    it("should still suggest CTE name when partial matches CTE", () => {
      const sql =
        "WITH my_cte AS (SELECT symbol FROM trades) SELECT * FROM my_cte"
      const tables = getSuggestionsOfKind(provider, sql, SuggestionKind.Table)
      const labels = tables.map((s) => s.label)
      expect(labels).toContain("my_cte")
    })
  })

  describe("suggestion details", () => {
    it("includes column details with table and type", () => {
      const suggestions = provider.getSuggestions("SELECT  FROM trades", 7)
      const symbolSuggestion = suggestions.find((s) => s.label === "symbol")
      expect(symbolSuggestion).toBeDefined()
      expect(symbolSuggestion?.detail).toContain("trades")
      expect(symbolSuggestion?.description).toBe("STRING")
    })
  })

  describe("priority ordering", () => {
    it("columns have higher priority than tables", () => {
      const suggestions = provider.getSuggestions("SELECT  FROM trades", 7)
      const columnSuggestion = suggestions.find(
        (s) => s.kind === SuggestionKind.Column,
      )
      const tableSuggestion = suggestions.find(
        (s) => s.kind === SuggestionKind.Table,
      )
      expect(columnSuggestion).toBeDefined()
      expect(tableSuggestion).toBeDefined()
      expect(columnSuggestion!.priority).toBeLessThan(tableSuggestion!.priority)
    })
  })
})

// =============================================================================
// Autocomplete Walkthrough Tests
// =============================================================================

describe("Autocomplete walkthrough", () => {
  describe("SELECT * FROM trades WHERE price > 100", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "SELECT ",
          expects: ["DISTINCT", "CASE", "CAST"],
        },
        {
          typed: "SELECT * ",
          expects: ["FROM"],
        },
        {
          typed: "SELECT * FROM ",
          expects: ["trades", "orders", "users"],
        },
        {
          typed: "SELECT * FROM trades ",
          expects: ["WHERE", "ORDER", "GROUP", "LIMIT", "JOIN"],
        },
        {
          typed: "SELECT * FROM trades WHERE ",
          expects: ["symbol", "price", "amount", "timestamp"],
        },
      ])
    })
  })

  describe("SELECT symbol, price FROM trades ORDER BY price DESC", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "SELECT ",
          expects: ["CASE", "CAST"],
        },
        {
          typed: "SELECT symbol, ",
          expects: ["CASE", "CAST"],
        },
        {
          typed: "SELECT symbol, price ",
          expects: ["FROM", "AS"],
        },
        {
          typed: "SELECT symbol, price FROM ",
          expects: ["trades", "orders"],
        },
        {
          typed: "SELECT symbol, price FROM trades ",
          expects: ["WHERE", "ORDER", "GROUP", "JOIN"],
        },
        {
          typed: "SELECT symbol, price FROM trades ORDER ",
          expects: ["BY"],
        },
      ])
    })
  })

  describe("INSERT INTO trades (symbol, price) VALUES ('BTC', 100)", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "INSERT ",
          expects: ["INTO"],
        },
        {
          typed: "INSERT INTO ",
          expects: ["trades", "orders"],
        },
      ])
    })
  })

  describe("CREATE TABLE new_table (id INT, name STRING) TIMESTAMP(id) PARTITION BY DAY", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "CREATE ",
          expects: ["TABLE"],
        },
        {
          typed:
            "CREATE TABLE new_table (id INT, name STRING) TIMESTAMP(id) PARTITION ",
          expects: ["BY"],
        },
      ])
    })
  })

  // Expression-related walkthroughs
  describe("SELECT * FROM trades WHERE symbol ILIKE '%btc%'", () => {
    it("should suggest ILIKE and LIKE after column name in WHERE", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "SELECT * FROM trades WHERE symbol ",
          expects: ["LIKE", "ILIKE", "IN", "BETWEEN", "IS"],
        },
      ])
    })
  })

  describe("SELECT * FROM trades WHERE price BETWEEN 100 AND 200", () => {
    it("should suggest BETWEEN and IN after column in WHERE", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "SELECT * FROM trades WHERE price ",
          expects: ["BETWEEN", "IN", "LIKE", "ILIKE", "IS"],
        },
      ])
    })
  })
})

// =============================================================================
// Documentation Example Tests
// =============================================================================

describe("Documentation examples - autocomplete", () => {
  // From /query/operators/text.md
  describe("text operators", () => {
    it("should suggest operators after string literal", () => {
      // SELECT 'a' || 'b' - after 'a' we should get valid next tokens
      const labels = getLabelsAt(provider, "SELECT 'a' ")
      expect(labels).toContain("FROM")
      expect(labels).toContain("AS")
    })

    it("should suggest LIKE and ILIKE in WHERE context", () => {
      const labels = getLabelsAt(provider, "SELECT * FROM trades WHERE symbol ")
      expect(labels).toContain("LIKE")
      expect(labels).toContain("ILIKE")
    })
  })

  // From /query/sql/where.md
  describe("WHERE clause operators", () => {
    it("should suggest IS after column name", () => {
      const labels = getLabelsAt(provider, "SELECT * FROM trades WHERE price ")
      expect(labels).toContain("IS")
    })

    it("should suggest NOT after IS", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT * FROM trades WHERE price IS ",
      )
      expect(labels).toContain("NOT")
    })

    it("should suggest IN after column name", () => {
      const labels = getLabelsAt(provider, "SELECT * FROM trades WHERE symbol ")
      expect(labels).toContain("IN")
    })

    it("should suggest BETWEEN after column name", () => {
      const labels = getLabelsAt(provider, "SELECT * FROM trades WHERE price ")
      expect(labels).toContain("BETWEEN")
    })
  })

  // From /query/sql/sample-by.md
  describe("SAMPLE BY autocomplete", () => {
    it("should suggest SAMPLE after FROM table clause", () => {
      const labels = getLabelsAt(provider, "SELECT avg(price) FROM trades ")
      expect(labels).toContain("SAMPLE")
    })

    it("should suggest BY after SAMPLE", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE ",
      )
      expect(labels).toContain("BY")
    })

    it("should suggest FILL after SAMPLE BY duration", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE BY 1h ",
      )
      expect(labels).toContain("FILL")
    })

    it("should suggest ALIGN after SAMPLE BY duration", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE BY 1h ",
      )
      expect(labels).toContain("ALIGN")
    })

    it("should suggest FROM after SAMPLE BY duration (for FROM/TO range)", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE BY 1h ",
      )
      expect(labels).toContain("FROM")
    })

    it("should suggest ALIGN after FILL clause", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE BY 1h FILL(PREV) ",
      )
      expect(labels).toContain("ALIGN")
    })

    it("should suggest TO after ALIGN", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE BY 1h ALIGN ",
      )
      expect(labels).toContain("TO")
    })

    it("should suggest CALENDAR and FIRST after ALIGN TO", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE BY 1h ALIGN TO ",
      )
      expect(labels).toContain("CALENDAR")
      expect(labels).toContain("FIRST")
    })

    it("should suggest OBSERVATION after FIRST", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE BY 1h ALIGN TO FIRST ",
      )
      expect(labels).toContain("OBSERVATION")
    })

    it("should suggest TIME and WITH after CALENDAR", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE BY 1h ALIGN TO CALENDAR ",
      )
      expect(labels).toContain("TIME")
      expect(labels).toContain("WITH")
    })

    it("should suggest ZONE after TIME", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT avg(price) FROM trades SAMPLE BY 1h ALIGN TO CALENDAR TIME ",
      )
      expect(labels).toContain("ZONE")
    })
  })
})

// =============================================================================
// SAMPLE BY Autocomplete Walkthrough
// =============================================================================

describe("SAMPLE BY walkthrough", () => {
  describe("SELECT ts, count() FROM trades SAMPLE BY 1d FILL(NULL) ALIGN TO CALENDAR", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "SELECT ts, count() FROM trades ",
          expects: ["SAMPLE", "WHERE", "ORDER", "GROUP", "JOIN"],
        },
        {
          typed: "SELECT ts, count() FROM trades SAMPLE ",
          expects: ["BY"],
        },
        {
          typed: "SELECT ts, count() FROM trades SAMPLE BY 1d ",
          expects: ["FILL", "ALIGN", "FROM"],
        },
        {
          typed: "SELECT ts, count() FROM trades SAMPLE BY 1d FILL(NULL) ",
          expects: ["ALIGN"],
        },
        {
          typed:
            "SELECT ts, count() FROM trades SAMPLE BY 1d FILL(NULL) ALIGN ",
          expects: ["TO"],
        },
        {
          typed:
            "SELECT ts, count() FROM trades SAMPLE BY 1d FILL(NULL) ALIGN TO ",
          expects: ["CALENDAR", "FIRST"],
        },
      ])
    })
  })

  describe("SELECT ts, count() FROM trades SAMPLE BY 1h ALIGN TO CALENDAR TIME ZONE 'UTC' WITH OFFSET '00:15'", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed:
            "SELECT ts, count() FROM trades SAMPLE BY 1h ALIGN TO CALENDAR ",
          expects: ["TIME", "WITH"],
        },
        {
          typed:
            "SELECT ts, count() FROM trades SAMPLE BY 1h ALIGN TO CALENDAR TIME ",
          expects: ["ZONE"],
        },
      ])
    })
  })
})

// =============================================================================
// JOIN Autocomplete Tests (Chunk 3)
// =============================================================================

describe("JOIN autocomplete", () => {
  it("should suggest JOIN types after FROM table", () => {
    const labels = getLabelsAt(provider, "SELECT * FROM trades ")
    expect(labels).toContain("JOIN")
    expect(labels).toContain("INNER")
    expect(labels).toContain("LEFT")
    expect(labels).toContain("CROSS")
    expect(labels).toContain("ASOF")
  })

  it("should suggest JOIN after LEFT/RIGHT/FULL", () => {
    const labels = getLabelsAt(provider, "SELECT * FROM trades LEFT ")
    expect(labels).toContain("JOIN")
    expect(labels).toContain("OUTER")
  })

  it("should suggest ON after JOIN table", () => {
    const labels = getLabelsAt(
      provider,
      "SELECT * FROM trades t JOIN orders o ",
    )
    expect(labels).toContain("ON")
  })

  it("should suggest TOLERANCE after ON condition in ASOF JOIN", () => {
    const labels = getLabelsAt(
      provider,
      "SELECT * FROM trades t ASOF JOIN quotes q ON t.ts = q.ts ",
    )
    expect(labels).toContain("TOLERANCE")
  })

  describe("ASOF JOIN walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "SELECT * FROM trades ",
          expects: ["JOIN", "ASOF", "LEFT", "CROSS"],
        },
        {
          typed: "SELECT * FROM trades ASOF ",
          expects: ["JOIN"],
        },
        {
          typed: "SELECT * FROM trades ASOF JOIN quotes ",
          expects: ["ON"],
        },
      ])
    })

    it("should NOT suggest OUTER after ASOF", () => {
      const labels = getLabelsAt(provider, "SELECT * FROM trades ASOF ")
      expect(labels).not.toContain("OUTER")
    })

    it("should suggest OUTER after LEFT", () => {
      const labels = getLabelsAt(provider, "SELECT * FROM trades LEFT ")
      expect(labels).toContain("OUTER")
      expect(labels).toContain("JOIN")
    })

    it("should suggest join types after ON condition (chained joins)", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT * FROM trades t ASOF JOIN quotes q ON (symbol) ",
      )
      expect(labels).toContain("ASOF")
      expect(labels).toContain("JOIN")
      expect(labels).toContain("CROSS")
      expect(labels).toContain("LEFT")
    })
  })

  describe("join-type-specific postamble suggestions", () => {
    it("ASOF JOIN: should suggest ON and TOLERANCE, not INCLUDE/EXCLUDE/RANGE", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT * FROM trades t ASOF JOIN quotes q ",
      )
      expect(labels).toContain("ON")
      expect(labels).toContain("TOLERANCE")
      expect(labels).not.toContain("INCLUDE")
      expect(labels).not.toContain("EXCLUDE")
      expect(labels).not.toContain("RANGE")
    })

    it("LT JOIN: should suggest ON and TOLERANCE, not INCLUDE/EXCLUDE/RANGE", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT * FROM trades t LT JOIN quotes q ",
      )
      expect(labels).toContain("ON")
      expect(labels).toContain("TOLERANCE")
      expect(labels).not.toContain("INCLUDE")
      expect(labels).not.toContain("EXCLUDE")
      expect(labels).not.toContain("RANGE")
    })

    it("SPLICE JOIN: should suggest ON, not TOLERANCE/INCLUDE/EXCLUDE/RANGE", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT * FROM trades t SPLICE JOIN quotes q ",
      )
      expect(labels).toContain("ON")
      expect(labels).not.toContain("TOLERANCE")
      expect(labels).not.toContain("INCLUDE")
      expect(labels).not.toContain("EXCLUDE")
      expect(labels).not.toContain("RANGE")
    })

    it("WINDOW JOIN: should suggest ON, RANGE, INCLUDE, EXCLUDE, not TOLERANCE", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT * FROM trades t WINDOW JOIN quotes q ",
      )
      expect(labels).toContain("ON")
      expect(labels).toContain("RANGE")
      expect(labels).toContain("INCLUDE")
      expect(labels).toContain("EXCLUDE")
      expect(labels).not.toContain("TOLERANCE")
    })

    it("INNER JOIN: should suggest ON, not TOLERANCE/INCLUDE/EXCLUDE/RANGE", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT * FROM trades t INNER JOIN quotes q ",
      )
      expect(labels).toContain("ON")
      expect(labels).not.toContain("TOLERANCE")
      expect(labels).not.toContain("INCLUDE")
      expect(labels).not.toContain("EXCLUDE")
      expect(labels).not.toContain("RANGE")
    })

    it("LEFT JOIN: should suggest ON, not TOLERANCE/INCLUDE/EXCLUDE/RANGE", () => {
      const labels = getLabelsAt(
        provider,
        "SELECT * FROM trades t LEFT JOIN quotes q ",
      )
      expect(labels).toContain("ON")
      expect(labels).not.toContain("TOLERANCE")
      expect(labels).not.toContain("INCLUDE")
      expect(labels).not.toContain("EXCLUDE")
      expect(labels).not.toContain("RANGE")
    })
  })
})

// =============================================================================
// CREATE TABLE Autocomplete Tests (Chunk 4)
// =============================================================================

describe("CREATE TABLE autocomplete", () => {
  it("should suggest TABLE after CREATE", () => {
    const labels = getLabelsAt(provider, "CREATE ")
    expect(labels).toContain("TABLE")
  })

  it("should suggest IF and AS after table name and columns", () => {
    const labels = getLabelsAt(provider, "CREATE TABLE trades (ts TIMESTAMP) ")
    expect(labels).toContain("TIMESTAMP")
    expect(labels).toContain("PARTITION")
  })

  it("should suggest BY after PARTITION", () => {
    const labels = getLabelsAt(
      provider,
      "CREATE TABLE trades (ts TIMESTAMP) TIMESTAMP(ts) PARTITION ",
    )
    expect(labels).toContain("BY")
  })

  it("should suggest partition units after PARTITION BY", () => {
    const labels = getLabelsAt(
      provider,
      "CREATE TABLE trades (ts TIMESTAMP) TIMESTAMP(ts) PARTITION BY ",
    )
    expect(labels).toContain("DAY")
    expect(labels).toContain("HOUR")
    expect(labels).toContain("MONTH")
    expect(labels).toContain("YEAR")
  })

  it("should suggest WAL and TTL after PARTITION BY UNIT", () => {
    const labels = getLabelsAt(
      provider,
      "CREATE TABLE trades (ts TIMESTAMP) TIMESTAMP(ts) PARTITION BY DAY ",
    )
    expect(labels).toContain("WAL")
    expect(labels).toContain("TTL")
  })

  describe("PIVOT walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "trades ",
          expects: ["PIVOT"],
        },
        {
          typed: "trades PIVOT (sum(amount) ",
          expects: ["FOR"],
        },
        {
          typed: "trades PIVOT (sum(amount) FOR category ",
          expects: ["IN"],
        },
      ])
    })
  })

  describe("CREATE VIEW walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "CREATE ",
          expects: ["TABLE", "VIEW"],
        },
        {
          typed: "CREATE VIEW my_view ",
          expects: ["AS"],
        },
        {
          typed: "CREATE OR ",
          expects: ["REPLACE"],
        },
        {
          typed: "CREATE OR REPLACE ",
          expects: ["VIEW"],
        },
      ])
    })
  })

  describe("DROP VIEW walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "DROP ",
          expects: ["TABLE", "VIEW"],
        },
        {
          typed: "DROP VIEW ",
          expects: ["IF"],
        },
      ])
    })
  })

  describe("SHOW walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "SHOW ",
          expects: ["TABLES", "COLUMNS", "CREATE", "PARAMETERS"],
        },
        {
          typed: "SHOW CREATE ",
          expects: ["TABLE", "VIEW", "MATERIALIZED"],
        },
      ])
    })
  })

  describe("CREATE TABLE walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "CREATE ",
          expects: ["TABLE"],
          rejects: ["SELECT"],
        },
        {
          typed:
            "CREATE TABLE trades (ts TIMESTAMP, symbol SYMBOL, price DOUBLE) ",
          expects: ["TIMESTAMP", "PARTITION"],
        },
        {
          typed: "CREATE TABLE trades (ts TIMESTAMP) TIMESTAMP(ts) ",
          expects: ["PARTITION"],
        },
        {
          typed: "CREATE TABLE trades (ts TIMESTAMP) TIMESTAMP(ts) PARTITION ",
          expects: ["BY"],
        },
        {
          typed:
            "CREATE TABLE trades (ts TIMESTAMP) TIMESTAMP(ts) PARTITION BY ",
          expects: ["DAY", "HOUR", "MONTH", "YEAR", "WEEK", "NONE"],
        },
      ])
    })
  })
})

// =============================================================================
// Materialized View Autocomplete Tests (Chunk 9)
// =============================================================================

describe("Materialized View autocomplete", () => {
  describe("CREATE MATERIALIZED VIEW walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "CREATE ",
          expects: ["TABLE", "VIEW", "MATERIALIZED"],
        },
        {
          typed: "CREATE MATERIALIZED ",
          expects: ["VIEW"],
        },
      ])
    })
  })

  describe("DROP MATERIALIZED VIEW walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "DROP ",
          expects: ["TABLE", "VIEW", "MATERIALIZED"],
        },
        {
          typed: "DROP MATERIALIZED ",
          expects: ["VIEW"],
        },
      ])
    })
  })

  describe("REFRESH MATERIALIZED VIEW walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "REFRESH ",
          expects: ["MATERIALIZED"],
        },
        {
          typed: "REFRESH MATERIALIZED ",
          expects: ["VIEW"],
        },
      ])
    })
  })
})

// =============================================================================
// User/Auth Autocomplete Tests (Chunk 10)
// =============================================================================

describe("User/Auth autocomplete", () => {
  describe("CREATE USER walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "CREATE ",
          expects: ["USER", "GROUP", "SERVICE"],
        },
        {
          typed: "CREATE SERVICE ",
          expects: ["ACCOUNT"],
        },
      ])
    })
  })

  describe("GRANT walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "GRANT ",
          expects: ["SELECT", "INSERT", "UPDATE", "ALL"],
        },
      ])
    })
  })

  describe("REVOKE walkthrough", () => {
    it("should provide correct suggestions at each word boundary", () => {
      assertSuggestionsWalkthrough(provider, [
        {
          typed: "REVOKE ",
          expects: ["SELECT", "INSERT", "UPDATE", "ALL"],
        },
      ])
    })
  })
})

// =============================================================================
// Administrative Operations Autocomplete Tests (Chunk 11)
// =============================================================================

describe("Admin operations autocomplete", () => {
  it("should suggest QUERY after CANCEL", () => {
    const labels = getLabelsAt(provider, "CANCEL ")
    expect(labels).toContain("QUERY")
  })

  it("should suggest TABLE after VACUUM", () => {
    const labels = getLabelsAt(provider, "VACUUM ")
    expect(labels).toContain("TABLE")
  })

  it("should suggest PREPARE and COMPLETE after SNAPSHOT", () => {
    const labels = getLabelsAt(provider, "SNAPSHOT ")
    expect(labels).toContain("PREPARE")
    expect(labels).toContain("COMPLETE")
  })

  it("should suggest WAL after RESUME", () => {
    const labels = getLabelsAt(provider, "RESUME ")
    expect(labels).toContain("WAL")
  })

  it("should suggest TABLE after REINDEX", () => {
    const labels = getLabelsAt(provider, "REINDEX ")
    expect(labels).toContain("TABLE")
  })

  it("should suggest CREATE and RELEASE after CHECKPOINT", () => {
    const labels = getLabelsAt(provider, "CHECKPOINT ")
    expect(labels).toContain("CREATE")
    expect(labels).toContain("RELEASE")
  })
})

// =============================================================================
// DECLARE & EXPLAIN Autocomplete Tests (Chunk 13)
// =============================================================================

describe("DECLARE autocomplete", () => {
  it("should suggest DECLARE as a valid statement start", () => {
    const labels = getLabelsAt(provider, "")
    expect(labels).toContain("DECLARE")
  })
})

describe("EXPLAIN autocomplete", () => {
  it("should suggest EXPLAIN as a valid statement start", () => {
    const labels = getLabelsAt(provider, "")
    expect(labels).toContain("EXPLAIN")
  })

  it("should suggest SELECT after EXPLAIN", () => {
    const labels = getLabelsAt(provider, "EXPLAIN ")
    expect(labels).toContain("SELECT")
  })
})

// =============================================================================
// Bitwise operators should NOT appear as keyword suggestions
// =============================================================================

describe("Bitwise operator token classification", () => {
  it("should not suggest bitwise operators as keywords in WHERE", () => {
    const labels = getLabelsAt(provider, "SELECT * FROM trades WHERE price ")
    expect(labels).not.toContain("&")
    expect(labels).not.toContain("^")
    expect(labels).not.toContain("|")
    expect(labels).not.toContain("BIT AND")
    expect(labels).not.toContain("BIT XOR")
    expect(labels).not.toContain("BIT OR")
  })

  it("should suggest WITHIN as a keyword in WHERE", () => {
    const labels = getLabelsAt(provider, "SELECT * FROM trades WHERE price ")
    expect(labels).toContain("WITHIN")
  })
})

// =============================================================================
// Expression Autocomplete Tests
// =============================================================================

describe("Expression autocomplete", () => {
  it("should suggest expression keywords after WHERE", () => {
    const labels = getLabelsAt(provider, "SELECT * FROM trades WHERE ")
    expect(labels).toContain("NOT")
    expect(labels).toContain("CAST")
    expect(labels).toContain("CASE")
    // Columns should be suggested for expression context
    expect(labels).toContain("symbol")
    expect(labels).toContain("price")
  })

  it("should suggest clauses after GROUP BY expression", () => {
    // After GROUP BY column, the parser sees expression continuation tokens
    const labels = getLabelsAt(
      provider,
      "SELECT symbol, count() FROM trades GROUP BY symbol ",
    )
    expect(labels).toContain("ORDER")
  })

  it("should suggest AND/OR in WHERE clause after comparison", () => {
    const labels = getLabelsAt(
      provider,
      "SELECT * FROM trades WHERE price > 100 ",
    )
    expect(labels).toContain("AND")
    expect(labels).toContain("OR")
  })

  it("should suggest NOT after WHERE", () => {
    const labels = getLabelsAt(provider, "SELECT * FROM trades WHERE ")
    expect(labels).toContain("NOT")
  })
})

describe("Implicit SELECT autocomplete", () => {
  it("should suggest columns after implicit select WHERE", () => {
    const labels = getLabelsAt(provider, "trades WHERE ")
    expect(labels).toContain("symbol")
    expect(labels).toContain("price")
    expect(labels).toContain("NOT")
    expect(labels).toContain("CASE")
  })

  it("should suggest keywords after bare table name", () => {
    const labels = getLabelsAt(provider, "trades ")
    expect(labels).toContain("WHERE")
  })

  it("should suggest columns for incomplete implicit select in multi-statement context", () => {
    const labels = getLabelsAt(provider, "SELECT 1; trades WHERE ")
    // Should get suggestions even after semicolon with implicit select
    expect(labels.length).toBeGreaterThan(0)
  })
})

describe("CTE autocomplete", () => {
  // ---------------------------------------------------------------------------
  // Basic CTE suggestions
  // ---------------------------------------------------------------------------
  it("should suggest CTE name as table in FROM position", () => {
    const sql = "WITH cte AS (SELECT symbol FROM trades) SELECT * FROM "
    const labels = getLabelsAt(provider, sql)
    expect(labels).toContain("cte")
  })

  it("should suggest CTE columns in SELECT position", () => {
    const sql =
      "WITH cte AS (SELECT symbol, price FROM trades) SELECT  FROM cte"
    const cursorOffset = sql.indexOf(" FROM cte")
    const labels = getLabelsAt(provider, sql, cursorOffset)
    expect(labels).toContain("symbol")
    expect(labels).toContain("price")
  })

  it("should suggest aliased CTE columns", () => {
    const sql =
      "WITH cte AS (SELECT symbol AS sym, price AS p FROM trades) SELECT  FROM cte"
    const cursorOffset = sql.indexOf(" FROM cte")
    const labels = getLabelsAt(provider, sql, cursorOffset)
    expect(labels).toContain("sym")
    expect(labels).toContain("p")
  })

  it("should suggest columns from multiple CTEs", () => {
    const sql =
      "WITH a AS (SELECT symbol FROM trades), b AS (SELECT id FROM orders) SELECT  FROM a, b"
    const cursorOffset = sql.indexOf(" FROM a, b")
    const labels = getLabelsAt(provider, sql, cursorOffset)
    expect(labels).toContain("symbol")
    expect(labels).toContain("id")
  })

  it("should suggest both CTE names as tables", () => {
    const sql = "WITH a AS (SELECT 1), b AS (SELECT 2) SELECT * FROM "
    const labels = getLabelsAt(provider, sql)
    expect(labels).toContain("a")
    expect(labels).toContain("b")
  })

  // ---------------------------------------------------------------------------
  // Doc: with.md — Multiple CTEs referencing each other
  // ---------------------------------------------------------------------------
  it("should suggest both CTE names when second references first", () => {
    const sql =
      "WITH first_10 AS (SELECT * FROM users LIMIT 10), first_5 AS (SELECT * FROM first_10 LIMIT 5) SELECT  FROM "
    const labels = getLabelsAt(provider, sql)
    expect(labels).toContain("first_10")
    expect(labels).toContain("first_5")
  })

  // ---------------------------------------------------------------------------
  // Doc: with.md — CTE with CROSS JOIN
  // ---------------------------------------------------------------------------
  it("should suggest CTE aliased column in SELECT with CROSS JOIN", () => {
    const sql =
      "WITH avg_price AS (SELECT avg(price) AS average FROM trades) SELECT  FROM trades CROSS JOIN avg_price"
    // Use "SELECT  FROM" (double space) to target the outer query gap, not the CTE body
    const offset = sql.indexOf("SELECT  FROM") + "SELECT ".length
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("average")
    expect(cols).toContain("symbol")
    expect(cols).toContain("price")
  })

  it("should suggest CTE name in CROSS JOIN position", () => {
    const sql =
      "WITH avg_price AS (SELECT avg(price) AS average FROM trades) SELECT timestamp FROM trades CROSS JOIN "
    const labels = getLabelsAt(provider, sql)
    expect(labels).toContain("avg_price")
  })

  // ---------------------------------------------------------------------------
  // Doc: with.md — CTE with UPDATE and INSERT
  // ---------------------------------------------------------------------------
  it("should suggest UPDATE, SELECT, INSERT after CTE definition", () => {
    const sql = "WITH up AS (SELECT symbol FROM trades) "
    const labels = getLabelsAt(provider, sql)
    expect(labels).toContain("UPDATE")
    expect(labels).toContain("SELECT")
    expect(labels).toContain("INSERT")
  })

  // ---------------------------------------------------------------------------
  // Doc: bollinger-bands.md — Multi-CTE with window function aliases
  // ---------------------------------------------------------------------------
  it("should suggest first CTE columns inside second CTE SELECT", () => {
    const ohlcCte =
      "WITH OHLC AS (SELECT timestamp, symbol, first(price) AS open, max(price) AS high, min(price) AS low, last(price) AS close, sum(amount) AS volume FROM trades SAMPLE BY 15m)"
    const sql = `${ohlcCte}, stats AS (SELECT  FROM OHLC)`
    const offset = ohlcCte.length + ", stats AS (SELECT ".length
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("close")
    expect(cols).toContain("timestamp")
  })

  it("should suggest second CTE columns in final SELECT", () => {
    const sql =
      "WITH OHLC AS (SELECT timestamp, last(price) AS close FROM trades SAMPLE BY 15m), stats AS (SELECT timestamp, close, AVG(close) OVER (ORDER BY timestamp ROWS 19 PRECEDING) AS sma20 FROM OHLC) SELECT  FROM stats"
    const offset = sql.indexOf(" FROM stats")
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("timestamp")
    expect(cols).toContain("close")
    expect(cols).toContain("sma20")
  })

  it("should suggest first CTE as table in second CTE FROM", () => {
    const sql =
      "WITH OHLC AS (SELECT timestamp, last(price) AS close FROM trades SAMPLE BY 15m), stats AS (SELECT close FROM "
    const labels = getLabelsAt(provider, sql)
    expect(labels).toContain("OHLC")
  })

  // ---------------------------------------------------------------------------
  // Doc: top-n-plus-others.md — Three-CTE chain
  // ---------------------------------------------------------------------------
  it("should suggest columns from three-CTE chain", () => {
    const sql =
      "WITH totals AS (SELECT symbol, count() AS total FROM trades), ranked AS (SELECT symbol, total, rank() OVER (ORDER BY total DESC) AS ranking FROM totals) SELECT  FROM ranked"
    const offset = sql.indexOf(" FROM ranked")
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("symbol")
    expect(cols).toContain("total")
    expect(cols).toContain("ranking")
  })

  // ---------------------------------------------------------------------------
  // Doc: aggressor-volume-imbalance.md — CTE with CASE+SUM aliases
  // ---------------------------------------------------------------------------
  it("should suggest CASE/SUM aliased CTE columns", () => {
    const sql =
      "WITH volumes AS (SELECT symbol, SUM(CASE WHEN side = 'buy' THEN amount ELSE 0 END) AS buy_volume, SUM(CASE WHEN side = 'sell' THEN amount ELSE 0 END) AS sell_volume FROM trades) SELECT  FROM volumes"
    const offset = sql.indexOf(" FROM volumes")
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("symbol")
    expect(cols).toContain("buy_volume")
    expect(cols).toContain("sell_volume")
  })

  // ---------------------------------------------------------------------------
  // Doc: latest-n-per-partition.md — CTE columns in WHERE clause
  // ---------------------------------------------------------------------------
  it("should suggest CTE columns in WHERE position", () => {
    const sql =
      "WITH ranked AS (SELECT timestamp, symbol, price, row_number() OVER (PARTITION BY symbol ORDER BY timestamp DESC) AS rn FROM trades) SELECT symbol, price FROM ranked WHERE "
    const suggestions = provider.getSuggestions(sql, sql.length)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("rn")
    expect(cols).toContain("symbol")
    expect(cols).toContain("price")
  })

  // ---------------------------------------------------------------------------
  // Doc: volume-spike.md — Chained CTEs
  // ---------------------------------------------------------------------------
  it("should suggest columns from chained CTEs", () => {
    const sql =
      "WITH candles AS (SELECT timestamp, symbol, sum(amount) AS volume FROM trades SAMPLE BY 30s), prev_volumes AS (SELECT timestamp, symbol, volume, LAG(volume) OVER (PARTITION BY symbol ORDER BY timestamp) AS prev_volume FROM candles) SELECT  FROM prev_volumes"
    const offset = sql.indexOf(" FROM prev_volumes")
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("timestamp")
    expect(cols).toContain("symbol")
    expect(cols).toContain("volume")
    expect(cols).toContain("prev_volume")
  })

  // ---------------------------------------------------------------------------
  // Doc: rolling-stddev.md — CTE with window function aliases
  // ---------------------------------------------------------------------------
  it("should suggest window function aliased columns from CTE", () => {
    const sql =
      "WITH stats AS (SELECT timestamp, symbol, price, AVG(price) OVER (PARTITION BY symbol ORDER BY timestamp) AS rolling_avg, AVG(price * price) OVER (PARTITION BY symbol ORDER BY timestamp) AS rolling_avg_sq FROM trades) SELECT  FROM stats"
    const offset = sql.indexOf(" FROM stats")
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("timestamp")
    expect(cols).toContain("symbol")
    expect(cols).toContain("price")
    expect(cols).toContain("rolling_avg")
    expect(cols).toContain("rolling_avg_sq")
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  it("CTE columns in GROUP BY position", () => {
    const sql =
      "WITH totals AS (SELECT symbol, count() AS total FROM trades) SELECT symbol, total FROM totals GROUP BY "
    const suggestions = provider.getSuggestions(sql, sql.length)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("symbol")
    expect(cols).toContain("total")
  })

  it("CTE columns in ORDER BY position", () => {
    const sql =
      "WITH totals AS (SELECT symbol, count() AS total FROM trades) SELECT symbol, total FROM totals ORDER BY "
    const suggestions = provider.getSuggestions(sql, sql.length)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("symbol")
    expect(cols).toContain("total")
  })

  it("CTE columns with mid-word prefix filtering", () => {
    const sql =
      "WITH cte AS (SELECT symbol, price FROM trades) SELECT sy FROM cte"
    const offset = sql.indexOf("sy") + 2
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("symbol")
  })

  it("CTE with mixed bare columns and function aliases", () => {
    const sql =
      "WITH cte AS (SELECT symbol, avg(price) AS avg_price FROM trades) SELECT  FROM cte"
    const offset = sql.indexOf(" FROM cte")
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("symbol")
    expect(cols).toContain("avg_price")
  })

  it("CTE with literal-only select should not crash", () => {
    const sql = "WITH cte AS (SELECT 1, 'hello') SELECT  FROM cte"
    const offset = sql.indexOf(" FROM cte")
    // Should not crash, just might not have column suggestions
    const labels = getLabelsAt(provider, sql, offset)
    expect(labels.length).toBeGreaterThan(0)
  })

  it("CTE with SELECT * should fallback to schema columns", () => {
    const sql = "WITH cte AS (SELECT * FROM users LIMIT 10) SELECT  FROM cte"
    const offset = sql.indexOf(" FROM cte")
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    // Can't extract columns from SELECT *, should fallback to all schema columns
    expect(cols.length).toBeGreaterThan(0)
  })

  it("should suggest identifier after comma between CTEs", () => {
    const sql = "WITH cte AS (SELECT * FROM users LIMIT 10), "
    const labels = getLabelsAt(provider, sql)
    // This position expects a new CTE name — the grammar correctly identifies
    // it as a newName position (not a column or table reference).
    // No column/table suggestions expected; the user types a free-form name.
    expect(labels.every((l) => l !== "symbol" && l !== "price")).toBe(true)
  })

  it("should not leak inner CTE source table columns into outer scope", () => {
    // CTE selects only "id" from orders. "status" is an orders column
    // but should NOT appear in outer suggestions since orders is not
    // in the outer FROM — only "cte" is.
    const sql =
      "WITH cte AS (SELECT id AS order_id FROM orders) SELECT  FROM cte"
    const offset = sql.indexOf(" FROM cte")
    const cols = provider
      .getSuggestions(sql, offset)
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("order_id")
    expect(cols).not.toContain("status")
  })

  it("should not produce duplicate CTE table suggestions", () => {
    const sql = "WITH cte AS (SELECT symbol FROM trades) SELECT * FROM "
    const tables = provider
      .getSuggestions(sql, sql.length)
      .filter((s) => s.kind === SuggestionKind.Table)
      .map((s) => s.label)
    const cteCount = tables.filter((l) => l === "cte").length
    expect(cteCount).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // Regression: alias position / CTE scope fixes
  // ---------------------------------------------------------------------------

  it("should NOT suggest columns after WITH name AS ( — subquery start", () => {
    const sql = "WITH something AS ( ) SELECT * FROM something"
    const offset = sql.indexOf("(") + 2 // cursor inside the paren
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toEqual([])
    // Should still suggest keywords like SELECT
    const kws = suggestions.map((s) => s.label)
    expect(kws).toContain("SELECT")
  })

  it("should NOT self-reference CTE columns inside its own body", () => {
    const sql =
      "WITH something AS (SELECT symbol FROM trades) SELECT symbol FROM something"
    // Cursor inside CTE body after "SELECT symbol "
    const offset = sql.indexOf("SELECT symbol") + "SELECT symbol ".length
    const suggestions = provider.getSuggestions(sql, offset)
    const colDetails = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => ({ label: s.label, detail: s.detail }))
    // CTE "something" should not self-reference
    for (const col of colDetails) {
      expect(col.detail ?? "").not.toContain("something")
    }
    const tables = suggestions
      .filter((s) => s.kind === SuggestionKind.Table)
      .map((s) => s.label)
    expect(tables).not.toContain("something")
  })

  it("should NOT suggest columns after identifier without comma (alias position)", () => {
    const sql = "SELECT symbol FROM trades"
    const offset = "SELECT symbol ".length
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toEqual([])
    // Should suggest FROM and other keywords
    const kws = suggestions.map((s) => s.label)
    expect(kws).toContain("FROM")
  })

  it("should suggest columns after comma in select list", () => {
    const sql = "SELECT symbol, FROM trades"
    const offset = "SELECT symbol, ".length
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toContain("symbol")
    expect(cols).toContain("price")
  })

  it("should suggest columns inside CTE body from inner FROM table", () => {
    const sql = "WITH cte AS (SELECT  FROM trades) SELECT * FROM cte"
    const offset = sql.indexOf("SELECT  FROM") + "SELECT ".length
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    // Should see trades columns, not CTE self-reference
    expect(cols).toContain("symbol")
    expect(cols).toContain("price")
  })

  it("should NOT suggest columns after RParen (alias/keyword position)", () => {
    const sql = "SELECT count(*) FROM trades"
    const offset = "SELECT count(*) ".length
    const suggestions = provider.getSuggestions(sql, offset)
    const cols = suggestions
      .filter((s) => s.kind === SuggestionKind.Column)
      .map((s) => s.label)
    expect(cols).toEqual([])
    const kws = suggestions.map((s) => s.label)
    expect(kws).toContain("FROM")
  })

  // ---------------------------------------------------------------------------
  // Qualified column references: alias/table filtering in JOINs
  // ---------------------------------------------------------------------------

  describe("qualified column references with aliases", () => {
    it("t1. in JOIN WHERE should only suggest aliased table columns", () => {
      const sql =
        "SELECT * FROM trades t1 JOIN orders t2 ON t1.symbol = t2.id WHERE t1."
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      // t1 = trades
      expect(labels).toContain("symbol")
      expect(labels).toContain("price")
      expect(labels).toContain("amount")
      expect(labels).toContain("timestamp")
      // Should NOT include orders columns
      expect(labels).not.toContain("id")
      expect(labels).not.toContain("status")
    })

    it("t2. in JOIN WHERE should only suggest aliased table columns", () => {
      const sql =
        "SELECT * FROM trades t1 JOIN orders t2 ON t1.symbol = t2.id WHERE t2."
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      // t2 = orders
      expect(labels).toContain("id")
      expect(labels).toContain("status")
      // Should NOT include trades columns
      expect(labels).not.toContain("symbol")
      expect(labels).not.toContain("price")
    })

    it("table name (not alias) before dot should filter in JOIN", () => {
      const sql =
        "SELECT * FROM trades JOIN orders ON trades.symbol = orders.id WHERE trades."
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      expect(labels).toContain("symbol")
      expect(labels).toContain("price")
      expect(labels).not.toContain("id")
      expect(labels).not.toContain("status")
    })

    it("mid-word after alias dot should filter by alias table", () => {
      const sql =
        "SELECT * FROM trades t1 JOIN orders t2 ON t1.symbol = t2.id WHERE t1.s"
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      // t1 = trades, so only trades columns should appear
      expect(labels).toContain("symbol")
      // "status" is from orders (t2)
      expect(labels).not.toContain("status")
    })

    it("qualified ref in SELECT list should filter in JOIN", () => {
      const sql =
        "SELECT t1. FROM trades t1 JOIN orders t2 ON t1.symbol = t2.id"
      const offset = sql.indexOf("t1.") + 3
      const cols = getSuggestionsOfKind(
        provider,
        sql,
        SuggestionKind.Column,
        offset,
      )
      const labels = cols.map((s) => s.label)
      expect(labels).toContain("symbol")
      expect(labels).toContain("price")
      expect(labels).not.toContain("id")
      expect(labels).not.toContain("status")
    })

    it("CTE qualified ref should only suggest that CTE's columns", () => {
      const sql =
        "WITH a AS (SELECT symbol FROM trades), b AS (SELECT id FROM orders) SELECT a. FROM a, b"
      const offset = sql.indexOf("a.") + 2
      const cols = getSuggestionsOfKind(
        provider,
        sql,
        SuggestionKind.Column,
        offset,
      )
      const labels = cols.map((s) => s.label)
      // CTE "a" only has "symbol"
      expect(labels).toContain("symbol")
      // CTE "b" has "id" — should NOT appear for a.
      expect(labels).not.toContain("id")
    })

    it("single table with alias should still show its columns (no regression)", () => {
      const sql = "SELECT * FROM trades t WHERE t."
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      expect(labels).toContain("symbol")
      expect(labels).toContain("price")
      expect(labels).toContain("amount")
      expect(labels).toContain("timestamp")
    })

    it("unqualified position should still show all columns from all tables", () => {
      const sql =
        "SELECT * FROM trades t1 JOIN orders t2 ON t1.symbol = t2.id WHERE "
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      // Unqualified — should include columns from both tables
      expect(labels).toContain("symbol")
      expect(labels).toContain("price")
      expect(labels).toContain("id")
      expect(labels).toContain("status")
    })

    it("ASOF JOIN alias should filter correctly", () => {
      const sql =
        "SELECT t. FROM trades t ASOF JOIN orders o ON t.symbol = o.id"
      const offset = sql.indexOf("t.") + 2
      const cols = getSuggestionsOfKind(
        provider,
        sql,
        SuggestionKind.Column,
        offset,
      )
      const labels = cols.map((s) => s.label)
      expect(labels).toContain("symbol")
      expect(labels).not.toContain("id")
    })

    it("three-table JOIN: each alias resolves to the correct table", () => {
      const sql =
        "SELECT * FROM trades t JOIN orders o ON t.symbol = o.id JOIN users u ON o.status = u.name WHERE u."
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      // u = users
      expect(labels).toContain("name")
      expect(labels).toContain("email")
      // Should NOT include trades or orders columns
      expect(labels).not.toContain("symbol")
      expect(labels).not.toContain("price")
      expect(labels).not.toContain("id")
      expect(labels).not.toContain("status")
    })
  })

  // ---------------------------------------------------------------------------
  // Ambiguous columns: same table joined with different aliases
  // ---------------------------------------------------------------------------

  describe("ambiguous column qualification in self-joins", () => {
    it("self-join should suggest alias-qualified columns", () => {
      const sql =
        "SELECT * FROM trades t1 INNER JOIN trades t2 ON symbol WHERE "
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      // Both t1 and t2 point to "trades", so columns are ambiguous.
      // Should emit qualified names like t1.symbol, t2.symbol.
      expect(labels).toContain("t1.symbol")
      expect(labels).toContain("t2.symbol")
      expect(labels).toContain("t1.price")
      expect(labels).toContain("t2.price")
      // Should NOT emit bare unqualified names
      expect(labels).not.toContain("symbol")
      expect(labels).not.toContain("price")
      expect(labels).not.toContain("amount")
    })

    it("self-join insertText should include alias qualifier", () => {
      const sql =
        "SELECT * FROM trades t1 INNER JOIN trades t2 ON symbol WHERE "
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const insertTexts = cols.map((s) => s.insertText)
      expect(insertTexts).toContain("t1.symbol")
      expect(insertTexts).toContain("t2.symbol")
    })

    it("self-join with qualified ref should still filter to one alias", () => {
      const sql =
        "SELECT * FROM trades t1 INNER JOIN trades t2 ON t1.symbol = t2.symbol WHERE t1."
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      // t1. qualifier → only trades columns for t1
      expect(labels).toContain("symbol")
      expect(labels).toContain("price")
      expect(labels).toContain("amount")
      expect(labels).toContain("timestamp")
      // Should be bare names (only one source after filtering)
      expect(labels).not.toContain("t1.symbol")
      expect(labels).not.toContain("t2.symbol")
    })

    it("different tables with no shared columns should remain unqualified", () => {
      const sql =
        "SELECT * FROM trades t1 JOIN orders t2 ON t1.symbol = t2.id WHERE "
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const labels = cols.map((s) => s.label)
      // trades and orders have NO shared column names → all unambiguous
      expect(labels).toContain("symbol")
      expect(labels).toContain("price")
      expect(labels).toContain("id")
      expect(labels).toContain("status")
      expect(labels).not.toContain("t1.symbol")
      expect(labels).not.toContain("t2.id")
    })

    it("self-join column detail should show alias, not table name", () => {
      const sql =
        "SELECT * FROM trades t1 INNER JOIN trades t2 ON symbol WHERE "
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const t1Symbol = cols.find((s) => s.label === "t1.symbol")
      const t2Symbol = cols.find((s) => s.label === "t2.symbol")
      expect(t1Symbol?.detail).toContain("t1")
      expect(t2Symbol?.detail).toContain("t2")
    })

    it("self-join filterText should use bare column name for typing", () => {
      const sql =
        "SELECT * FROM trades t1 INNER JOIN trades t2 ON symbol WHERE "
      const cols = getSuggestionsOfKind(provider, sql, SuggestionKind.Column)
      const t1Symbol = cols.find((s) => s.label === "t1.symbol")
      // filterText should be bare "symbol" so typing "sym" matches it
      expect(t1Symbol?.filterText).toBe("symbol")
    })
  })

  // ---------------------------------------------------------------------------
  // Doc-validated table alias tests
  // Queries sourced from ~/Desktop/questdb/documentation/documentation/query/sql/
  // ---------------------------------------------------------------------------

  describe("table alias scenarios from QuestDB documentation", () => {
    // Extended schema with overlapping columns between tables, matching
    // the documentation examples (market_data, core_price, prices, etc.)
    const docSchema = {
      tables: [
        { name: "trades", designatedTimestamp: "timestamp" },
        { name: "orders", designatedTimestamp: "timestamp" },
        { name: "market_data", designatedTimestamp: "timestamp" },
        { name: "core_price", designatedTimestamp: "timestamp" },
        { name: "prices", designatedTimestamp: "timestamp" },
        { name: "spreads", designatedTimestamp: "timestamp" },
      ],
      columns: {
        trades: [
          { name: "timestamp", type: "TIMESTAMP" },
          { name: "symbol", type: "SYMBOL" },
          { name: "price", type: "DOUBLE" },
          { name: "amount", type: "DOUBLE" },
          { name: "side", type: "SYMBOL" },
        ],
        orders: [
          { name: "timestamp", type: "TIMESTAMP" },
          { name: "symbol", type: "SYMBOL" },
          { name: "id", type: "LONG" },
          { name: "status", type: "STRING" },
        ],
        market_data: [
          { name: "timestamp", type: "TIMESTAMP" },
          { name: "symbol", type: "SYMBOL" },
          { name: "bid_price", type: "DOUBLE" },
          { name: "ask_price", type: "DOUBLE" },
        ],
        core_price: [
          { name: "timestamp", type: "TIMESTAMP" },
          { name: "symbol", type: "SYMBOL" },
          { name: "bid_price", type: "DOUBLE" },
          { name: "ask_price", type: "DOUBLE" },
        ],
        prices: [
          { name: "timestamp", type: "TIMESTAMP" },
          { name: "symbol", type: "SYMBOL" },
          { name: "price", type: "DOUBLE" },
          { name: "bid", type: "DOUBLE" },
          { name: "ask", type: "DOUBLE" },
        ],
        spreads: [
          { name: "timestamp", type: "TIMESTAMP" },
          { name: "symbol", type: "SYMBOL" },
          { name: "spread", type: "DOUBLE" },
        ],
      },
    }
    const docProvider = createAutocompleteProvider(docSchema)

    // =======================================================================
    // Doc: join.md — LT JOIN self-join with aliases (tradesA, tradesB)
    // Pattern: FROM miniTrades tradesA LT JOIN miniTrades tradesB
    // =======================================================================

    describe("LT JOIN self-join (join.md)", () => {
      // Doc: "LT join is often useful to join a table to itself in order to
      // get preceding values for every row."
      it("should qualify columns in LT JOIN self-join", () => {
        const sql = "SELECT tradesA. FROM trades tradesA LT JOIN trades tradesB"
        const offset = sql.indexOf("tradesA.") + 8
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // Qualified ref "tradesA." → filter to tradesA only, bare names
        expect(labels).toContain("timestamp")
        expect(labels).toContain("price")
        expect(labels).toContain("symbol")
        expect(labels).not.toContain("tradesB.timestamp")
        expect(labels).not.toContain("tradesB.price")
      })

      it("should qualify columns at unqualified position in LT JOIN self-join", () => {
        const sql = "SELECT  FROM trades tradesA LT JOIN trades tradesB"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // Self-join: all columns ambiguous → must be alias-qualified
        expect(labels).toContain("tradesA.timestamp")
        expect(labels).toContain("tradesB.timestamp")
        expect(labels).toContain("tradesA.price")
        expect(labels).toContain("tradesB.price")
        expect(labels).not.toContain("timestamp")
        expect(labels).not.toContain("price")
      })

      it("tradesB. should filter to tradesB columns only", () => {
        const sql =
          "SELECT tradesA.timestamp, tradesB. FROM trades tradesA LT JOIN trades tradesB"
        const offset = sql.indexOf("tradesB.") + 8
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("timestamp")
        expect(labels).toContain("price")
        // Bare names only — filtered to single source
        expect(labels).not.toContain("tradesA.timestamp")
      })
    })

    // =======================================================================
    // Doc: join.md — CROSS JOIN self-join with AS alias
    // Pattern: FROM t CROSS JOIN t AS t2
    // =======================================================================

    describe("CROSS JOIN self-join with AS alias (join.md)", () => {
      // Doc: "detect potential duplicates, with same values and within a
      // 10 seconds range" — FROM t CROSS JOIN t AS t2 WHERE t.timestamp < t2.timestamp ...
      it("should qualify columns in CROSS JOIN self-join WHERE clause", () => {
        // Use explicit columns in CTE (SELECT * can't resolve columns)
        const sql =
          "WITH t AS (SELECT timestamp, symbol, price, amount, side FROM trades) SELECT * FROM t CROSS JOIN t AS t2 WHERE "
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
        )
        const labels = cols.map((s) => s.label)
        // "t" CTE joined with "t2" alias — same underlying columns,
        // so they should be qualified
        expect(labels).toContain("t.timestamp")
        expect(labels).toContain("t2.timestamp")
        expect(labels).toContain("t.symbol")
        expect(labels).toContain("t2.symbol")
        expect(labels).not.toContain("timestamp")
        expect(labels).not.toContain("symbol")
      })

      it("qualified ref in CROSS JOIN self-join filters to one alias", () => {
        const sql =
          "WITH t AS (SELECT timestamp, symbol, price, amount, side FROM trades) SELECT t2. FROM t CROSS JOIN t AS t2 WHERE t.timestamp < t2.timestamp"
        const offset = sql.indexOf("t2.") + 3
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("timestamp")
        expect(labels).toContain("symbol")
        expect(labels).toContain("price")
        // Should not include t. qualified
        expect(labels).not.toContain("t.timestamp")
      })
    })

    // =======================================================================
    // Doc: asof-join.md — ASOF JOIN with single-letter aliases (m, p)
    // Pattern: FROM market_data m ASOF JOIN core_price p
    // =======================================================================

    describe("ASOF JOIN with aliases (asof-join.md)", () => {
      // Doc: SELECT m.timestamp, m.symbol, p.timestamp, p.symbol, p.bid_price
      // FROM market_data m ASOF JOIN core_price p
      it("m. should suggest only market_data columns", () => {
        const sql = "SELECT m. FROM market_data m ASOF JOIN core_price p"
        const offset = sql.indexOf("m.") + 2
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("timestamp")
        expect(labels).toContain("symbol")
        expect(labels).toContain("bid_price")
        expect(labels).toContain("ask_price")
        // Should NOT include p's columns
        expect(labels).not.toContain("p.timestamp")
        expect(labels).not.toContain("p.symbol")
      })

      it("p. should suggest only core_price columns", () => {
        const sql = "SELECT p. FROM market_data m ASOF JOIN core_price p"
        const offset = sql.indexOf("p.") + 2
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("timestamp")
        expect(labels).toContain("symbol")
        expect(labels).toContain("bid_price")
        expect(labels).not.toContain("m.timestamp")
      })

      it("unqualified position should qualify shared columns between market_data and core_price", () => {
        const sql = "SELECT  FROM market_data m ASOF JOIN core_price p"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // market_data and core_price share: timestamp, symbol, bid_price, ask_price
        // All columns overlap → all must be qualified
        expect(labels).toContain("m.timestamp")
        expect(labels).toContain("p.timestamp")
        expect(labels).toContain("m.symbol")
        expect(labels).toContain("p.symbol")
        expect(labels).toContain("m.bid_price")
        expect(labels).toContain("p.bid_price")
        expect(labels).not.toContain("timestamp")
        expect(labels).not.toContain("symbol")
        expect(labels).not.toContain("bid_price")
      })

      it("ASOF JOIN with ON clause: alias filtering still works", () => {
        const sql =
          "SELECT m. FROM market_data m ASOF JOIN core_price p ON (symbol)"
        const offset = sql.indexOf("m.") + 2
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("timestamp")
        expect(labels).toContain("bid_price")
        expect(labels).not.toContain("p.bid_price")
      })
    })

    // =======================================================================
    // Doc: join.md — INNER JOIN with CTE aliases (Lookup, ManyTrades)
    // Pattern: FROM ManyTrades INNER JOIN Lookup ON Lookup.symbol = Manytrades.symbol
    // =======================================================================

    describe("INNER JOIN with CTE table references (join.md)", () => {
      // Doc: CTE names used directly as table names, referenced with
      // CTE_name.column in ON clause
      it("CTE name as qualifier should filter correctly", () => {
        const sql =
          "WITH Lookup AS (SELECT symbol FROM trades) SELECT Lookup. FROM trades INNER JOIN Lookup ON Lookup.symbol = trades.symbol"
        const offset = sql.indexOf("Lookup.") + 7
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // Lookup CTE only has "symbol"
        expect(labels).toContain("symbol")
        // trades columns should NOT appear
        expect(labels).not.toContain("price")
        expect(labels).not.toContain("amount")
      })
    })

    // =======================================================================
    // Doc: join.md — SPLICE JOIN with CTE names (buy, sell)
    // Pattern: FROM buy SPLICE JOIN sell
    // =======================================================================

    describe("SPLICE JOIN with CTE aliases (join.md)", () => {
      // Doc: SELECT buy.timestamp, sell.timestamp, buy.price, sell.price
      // FROM buy SPLICE JOIN sell
      it("should suggest CTE columns via qualified ref after SPLICE JOIN", () => {
        const sql =
          "WITH buy AS (SELECT timestamp, price FROM trades), sell AS (SELECT timestamp, price FROM trades) SELECT buy. FROM buy SPLICE JOIN sell"
        const offset = sql.indexOf("buy.") + 4
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("timestamp")
        expect(labels).toContain("price")
        expect(labels).not.toContain("sell.timestamp")
      })

      it("unqualified position: CTE names without aliases remain bare (no hasAlias)", () => {
        // CTEs referenced by name (no explicit alias via AS) do not trigger
        // alias qualification. This is correct — the user must add aliases
        // explicitly if they want qualified column references.
        const sql =
          "WITH buy AS (SELECT timestamp, price FROM trades), sell AS (SELECT timestamp, price FROM trades) SELECT  FROM buy SPLICE JOIN sell"
        const offset = sql.indexOf("SELECT  FROM") + "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // CTE names without aliases → no qualification
        expect(labels).toContain("timestamp")
        expect(labels).toContain("price")
        expect(labels).not.toContain("buy.timestamp")
        expect(labels).not.toContain("sell.timestamp")
      })

      it("SPLICE JOIN with explicit aliases should qualify shared CTE columns", () => {
        const sql =
          "WITH buy AS (SELECT timestamp, price FROM trades), sell AS (SELECT timestamp, price FROM trades) SELECT  FROM buy b SPLICE JOIN sell s"
        const offset = sql.indexOf("SELECT  FROM") + "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // With explicit aliases b and s → qualification triggers
        expect(labels).toContain("b.timestamp")
        expect(labels).toContain("s.timestamp")
        expect(labels).toContain("b.price")
        expect(labels).toContain("s.price")
        expect(labels).not.toContain("timestamp")
        expect(labels).not.toContain("price")
      })
    })

    // =======================================================================
    // Doc: join.md — JOIN with ON (column) shorthand
    // Pattern: FROM mayTrades JOIN JuneTrades ON (symbol, side)
    // =======================================================================

    describe("JOIN ON (column) shorthand with CTE aliases (join.md)", () => {
      it("CTE qualifier should filter to that CTE's columns", () => {
        const sql =
          "WITH mayTrades AS (SELECT symbol, side, count() AS total FROM trades), juneTrades AS (SELECT symbol, side, count() AS total FROM trades) SELECT mayTrades. FROM mayTrades JOIN juneTrades ON (symbol, side)"
        const offset = sql.indexOf("mayTrades. FROM") + "mayTrades.".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("symbol")
        expect(labels).toContain("side")
        expect(labels).toContain("total")
      })
    })

    // =======================================================================
    // Doc: update.md — UPDATE FROM with aliases (s, p)
    // Pattern: UPDATE spreads s SET spread = p.ask - p.bid FROM prices p WHERE s.symbol = p.symbol
    // =======================================================================

    describe("UPDATE FROM with aliases (update.md)", () => {
      it("p. should suggest prices columns in UPDATE FROM context", () => {
        const sql =
          "UPDATE spreads s SET spread = p.ask - p.bid FROM prices p WHERE p."
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("symbol")
        expect(labels).toContain("price")
        expect(labels).toContain("bid")
        expect(labels).toContain("ask")
      })
    })

    // =======================================================================
    // Mixed-ambiguity: some columns overlap, some don't
    // Pattern: trades (has "price") JOIN prices (has "price") → "price"
    //          is ambiguous, but "amount" (trades-only) and "bid" (prices-only)
    //          are not.
    // =======================================================================

    describe("partial column overlap between different tables", () => {
      it("shared columns should be qualified, unique columns should be bare", () => {
        const sql = "SELECT  FROM trades t JOIN prices p ON t.symbol = p.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)

        // Shared columns: timestamp, symbol, price → qualified
        expect(labels).toContain("t.timestamp")
        expect(labels).toContain("p.timestamp")
        expect(labels).toContain("t.symbol")
        expect(labels).toContain("p.symbol")
        expect(labels).toContain("t.price")
        expect(labels).toContain("p.price")
        expect(labels).not.toContain("timestamp")
        expect(labels).not.toContain("symbol")
        expect(labels).not.toContain("price")

        // Unique columns: amount (trades), side (trades), bid (prices), ask (prices) → bare
        expect(labels).toContain("amount")
        expect(labels).toContain("side")
        expect(labels).toContain("bid")
        expect(labels).toContain("ask")
        expect(labels).not.toContain("t.amount")
        expect(labels).not.toContain("p.bid")
      })

      it("qualified ref resolves past ambiguity to single table", () => {
        const sql =
          "SELECT t. FROM trades t JOIN prices p ON t.symbol = p.symbol"
        const offset = sql.indexOf("t.") + 2
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // t. → only trades columns, bare names
        expect(labels).toContain("timestamp")
        expect(labels).toContain("symbol")
        expect(labels).toContain("price")
        expect(labels).toContain("amount")
        expect(labels).toContain("side")
        expect(labels).not.toContain("bid")
        expect(labels).not.toContain("ask")
        expect(labels).not.toContain("t.price")
      })

      it("description should show type for qualified ambiguous columns", () => {
        const sql = "SELECT  FROM trades t JOIN prices p ON t.symbol = p.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const tPrice = cols.find((s) => s.label === "t.price")
        const pPrice = cols.find((s) => s.label === "p.price")
        expect(tPrice).toBeDefined()
        expect(pPrice).toBeDefined()
        expect(tPrice!.description).toBe("DOUBLE")
        expect(pPrice!.description).toBe("DOUBLE")
      })
    })

    // =======================================================================
    // Three-way JOIN with mixed overlap
    // trades (timestamp, symbol, price, amount, side) +
    // orders (timestamp, symbol, id, status) +
    // prices (timestamp, symbol, price, bid, ask)
    // → timestamp and symbol shared by all three → qualified
    // → price shared by trades + prices → qualified
    // → amount, side unique to trades → bare
    // → id, status unique to orders → bare
    // → bid, ask unique to prices → bare
    // =======================================================================

    describe("three-way JOIN with mixed column overlap", () => {
      it("fully shared columns use all three aliases", () => {
        const sql =
          "SELECT  FROM trades t JOIN orders o ON t.symbol = o.symbol JOIN prices p ON t.symbol = p.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // timestamp: trades, orders, prices → 3 aliases
        expect(labels).toContain("t.timestamp")
        expect(labels).toContain("o.timestamp")
        expect(labels).toContain("p.timestamp")
        expect(labels).not.toContain("timestamp")

        // symbol: trades, orders, prices → 3 aliases
        expect(labels).toContain("t.symbol")
        expect(labels).toContain("o.symbol")
        expect(labels).toContain("p.symbol")
        expect(labels).not.toContain("symbol")
      })

      it("partially shared columns use only overlapping aliases", () => {
        const sql =
          "SELECT  FROM trades t JOIN orders o ON t.symbol = o.symbol JOIN prices p ON t.symbol = p.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // price: trades + prices only → 2 aliases
        expect(labels).toContain("t.price")
        expect(labels).toContain("p.price")
        expect(labels).not.toContain("o.price") // orders has no price column
        expect(labels).not.toContain("price")
      })

      it("unique columns remain bare", () => {
        const sql =
          "SELECT  FROM trades t JOIN orders o ON t.symbol = o.symbol JOIN prices p ON t.symbol = p.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // Unique to trades
        expect(labels).toContain("amount")
        expect(labels).toContain("side")
        expect(labels).not.toContain("t.amount")

        // Unique to orders
        expect(labels).toContain("id")
        expect(labels).toContain("status")
        expect(labels).not.toContain("o.id")

        // Unique to prices
        expect(labels).toContain("bid")
        expect(labels).toContain("ask")
        expect(labels).not.toContain("p.bid")
      })

      it("qualified ref in three-way JOIN isolates single table", () => {
        const sql =
          "SELECT o. FROM trades t JOIN orders o ON t.symbol = o.symbol JOIN prices p ON t.symbol = p.symbol"
        const offset = sql.indexOf("o.") + 2
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // o. → only orders columns
        expect(labels).toContain("timestamp")
        expect(labels).toContain("symbol")
        expect(labels).toContain("id")
        expect(labels).toContain("status")
        expect(labels).not.toContain("price")
        expect(labels).not.toContain("bid")
        expect(labels).not.toContain("amount")
      })
    })

    // =======================================================================
    // LEFT JOIN with aliases — doc: join.md
    // Pattern: FROM ManyTrades LEFT OUTER JOIN Lookup ON Lookup.symbol = Manytrades.symbol
    // =======================================================================

    describe("LEFT JOIN with aliases (join.md)", () => {
      it("LEFT JOIN alias filtering with qualified ref", () => {
        const sql =
          "SELECT t. FROM trades t LEFT JOIN orders o ON t.symbol = o.symbol"
        const offset = sql.indexOf("t.") + 2
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("symbol")
        expect(labels).toContain("price")
        expect(labels).toContain("timestamp")
        expect(labels).not.toContain("id")
        expect(labels).not.toContain("status")
      })

      it("LEFT OUTER JOIN alias filtering with qualified ref", () => {
        const sql =
          "SELECT o. FROM trades t LEFT OUTER JOIN orders o ON t.symbol = o.symbol"
        const offset = sql.indexOf("o.") + 2
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("id")
        expect(labels).toContain("status")
        expect(labels).toContain("symbol")
        expect(labels).not.toContain("price")
        expect(labels).not.toContain("amount")
      })
    })

    // =======================================================================
    // Implicit JOIN (FROM a, b) with aliases
    // Doc: join.md — FROM a, b WHERE a.id = b.id
    // =======================================================================

    describe("implicit join (comma-separated tables) with aliases", () => {
      it("unqualified position with different tables shows qualified shared columns", () => {
        const sql = "SELECT  FROM trades t, orders o WHERE t.symbol = o.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // timestamp and symbol are shared → qualified
        expect(labels).toContain("t.timestamp")
        expect(labels).toContain("o.timestamp")
        expect(labels).toContain("t.symbol")
        expect(labels).toContain("o.symbol")
        // price, amount, side unique to trades → bare
        expect(labels).toContain("price")
        expect(labels).toContain("amount")
        // id, status unique to orders → bare
        expect(labels).toContain("id")
        expect(labels).toContain("status")
      })

      it("qualified ref in implicit join isolates table", () => {
        const sql =
          "SELECT t. FROM trades t, orders o WHERE t.symbol = o.symbol"
        const offset = sql.indexOf("t.") + 2
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("symbol")
        expect(labels).toContain("price")
        expect(labels).not.toContain("id")
      })
    })

    // =======================================================================
    // Suggestion priority invariants
    // =======================================================================

    describe("alias-qualified suggestion properties", () => {
      it("qualified columns have High priority", () => {
        const sql =
          "SELECT  FROM trades t1 INNER JOIN trades t2 ON t1.symbol = t2.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        for (const col of cols) {
          expect(col.priority).toBe(SuggestionPriority.High)
        }
      })

      it("qualified column kind is Column", () => {
        const sql =
          "SELECT  FROM trades t1 INNER JOIN trades t2 ON t1.symbol = t2.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        expect(cols.length).toBeGreaterThan(0)
        for (const col of cols) {
          expect(col.kind).toBe(SuggestionKind.Column)
        }
      })

      it("all qualified columns have matching label and insertText", () => {
        const sql =
          "SELECT  FROM trades t1 INNER JOIN trades t2 ON t1.symbol = t2.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        for (const col of cols) {
          expect(col.insertText).toBe(col.label)
        }
      })

      it("bare columns have no filterText set", () => {
        const sql = "SELECT  FROM trades t WHERE "
        const offset = sql.length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        for (const col of cols) {
          // Bare columns should not have filterText
          expect(col.filterText).toBeUndefined()
        }
      })

      it("qualified columns always have filterText set to bare column name", () => {
        const sql =
          "SELECT  FROM trades t1 INNER JOIN trades t2 ON t1.symbol = t2.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        for (const col of cols) {
          // filterText should be the bare column name (after the dot)
          const bareName = col.label.split(".")[1]
          expect(col.filterText).toBe(bareName)
        }
      })

      it("qualified column detail contains the qualifier", () => {
        const sql = "SELECT  FROM trades t JOIN prices p ON t.symbol = p.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        for (const col of cols) {
          if (col.label.includes(".")) {
            const qualifier = col.label.split(".")[0]
            expect(col.detail).toContain(qualifier)
          }
        }
      })
    })

    // =======================================================================
    // Edge case: no aliases at all
    // =======================================================================

    describe("joins without aliases", () => {
      it("tables without aliases use table name but do not qualify shared columns", () => {
        const sql =
          "SELECT  FROM trades JOIN orders ON trades.symbol = orders.symbol"
        const offset = "SELECT ".length
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        // Without aliases, shared columns (timestamp, symbol) remain bare
        // because the hasAlias check prevents qualification for entries
        // without explicit aliases
        expect(labels).toContain("timestamp")
        expect(labels).toContain("symbol")
        // Unique columns remain bare
        expect(labels).toContain("price")
        expect(labels).toContain("amount")
        expect(labels).toContain("id")
        expect(labels).toContain("status")
      })
    })

    // =======================================================================
    // Edge case: AS keyword with alias
    // =======================================================================

    describe("AS keyword alias syntax", () => {
      it("FROM table AS alias: qualified ref works", () => {
        const sql =
          "SELECT t. FROM trades AS t JOIN orders AS o ON t.symbol = o.symbol"
        const offset = sql.indexOf("t.") + 2
        const cols = getSuggestionsOfKind(
          docProvider,
          sql,
          SuggestionKind.Column,
          offset,
        )
        const labels = cols.map((s) => s.label)
        expect(labels).toContain("symbol")
        expect(labels).toContain("price")
        expect(labels).not.toContain("id")
      })
    })
  })

  // ===========================================================================
  // String literal & quoted identifier suppression
  // ===========================================================================
  // The parser suppresses suggestions when the cursor is inside a string
  // literal ('...') or quoted identifier ("..."). This prevents autocomplete
  // from interfering when the user is typing a value or an escaped name.

  describe("string literal suppression", () => {
    it("should return no suggestions when cursor is inside a string literal", () => {
      // Cursor inside 'BTC-USD' → no suggestions
      const sql = "SELECT * FROM trades WHERE symbol = 'BTC-USD'"
      const offset = sql.indexOf("BTC") + 1 // inside the string
      const suggestions = provider.getSuggestions(sql, offset)
      expect(suggestions).toHaveLength(0)
    })

    it("should return no suggestions at various positions inside a string", () => {
      const sql = "SELECT * FROM trades WHERE symbol = 'hello world'"
      // Right after opening quote
      const afterOpen = sql.indexOf("'") + 1
      expect(provider.getSuggestions(sql, afterOpen)).toHaveLength(0)
      // Middle of string
      const middle = sql.indexOf("world")
      expect(provider.getSuggestions(sql, middle)).toHaveLength(0)
      // Right before closing quote
      const beforeClose = sql.lastIndexOf("'")
      expect(provider.getSuggestions(sql, beforeClose)).toHaveLength(0)
    })

    it("should suggest after a completed string literal (cursor outside)", () => {
      // Cursor AFTER the closing quote → should suggest operators/keywords
      const sql = "SELECT * FROM trades WHERE symbol = 'BTC-USD' "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const labels = suggestions.map((s) => s.label)
      expect(labels.length).toBeGreaterThan(0)
      expect(labels).toContain("AND")
    })

    it("should return no suggestions inside a string in SELECT list", () => {
      const sql = "SELECT 'hello world' FROM trades"
      const offset = sql.indexOf("world")
      const suggestions = provider.getSuggestions(sql, offset)
      expect(suggestions).toHaveLength(0)
    })

    it("should return no suggestions inside a string in INSERT VALUES", () => {
      const sql = "INSERT INTO trades VALUES ('BTC-USD', 100)"
      const offset = sql.indexOf("BTC") + 2
      const suggestions = provider.getSuggestions(sql, offset)
      expect(suggestions).toHaveLength(0)
    })
  })

  describe("quoted identifier suppression", () => {
    it("should return no suggestions when cursor is inside a quoted identifier", () => {
      const sql = 'SELECT * FROM "my table"'
      const offset = sql.indexOf("my") + 1
      const suggestions = provider.getSuggestions(sql, offset)
      expect(suggestions).toHaveLength(0)
    })

    it("should return no suggestions inside a quoted column name", () => {
      const sql = 'SELECT "column name" FROM trades'
      const offset = sql.indexOf("column") + 3
      const suggestions = provider.getSuggestions(sql, offset)
      expect(suggestions).toHaveLength(0)
    })

    it("should suggest after a completed quoted identifier", () => {
      const sql = 'SELECT "symbol" '
      const suggestions = provider.getSuggestions(sql, sql.length)
      const labels = suggestions.map((s) => s.label)
      expect(labels.length).toBeGreaterThan(0)
      expect(labels).toContain("FROM")
    })
  })

  // ===========================================================================
  // SELECT * edge cases
  // ===========================================================================

  describe("SELECT * edge cases", () => {
    it("suggests FROM after SELECT * with no other suggestions leaking", () => {
      const suggestions = provider.getSuggestions("SELECT * ", 9)
      const labels = suggestions.map((s) => s.label)
      expect(labels).toContain("FROM")
      // No columns should appear
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns).toHaveLength(0)
      // No functions should appear
      const funcs = suggestions.filter(
        (s) => s.kind === SuggestionKind.Function,
      )
      expect(funcs).toHaveLength(0)
      // No tables should appear
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      expect(tables).toHaveLength(0)
    })

    it("suggests only keywords when typing mid-word after SELECT *", () => {
      // FR, WH, etc. should only yield keyword matches
      for (const partial of ["FR", "WH", "LI", "OR"]) {
        const sql = `SELECT * ${partial}`
        const suggestions = provider.getSuggestions(sql, sql.length)
        const nonKeywords = suggestions.filter(
          (s) => s.kind !== SuggestionKind.Keyword,
        )
        expect(nonKeywords).toHaveLength(0)
      }
    })

    it("still suggests columns after SELECT (no star)", () => {
      // Sanity check: without *, columns should still appear
      const suggestions = provider.getSuggestions("SELECT  FROM trades", 7)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns.length).toBeGreaterThan(0)
    })

    it("suggests columns after multiplication operator (price * |)", () => {
      // * after an identifier is multiplication, not wildcard.
      // The user needs columns/functions for the RHS.
      const suggestions = provider.getSuggestions(
        "SELECT price *  FROM trades",
        15,
      )
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns.length).toBeGreaterThan(0)
    })

    it("suggests columns after number * (arithmetic)", () => {
      const suggestions = provider.getSuggestions("SELECT 2 *  FROM trades", 11)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns.length).toBeGreaterThan(0)
    })

    it("suggests columns after (expr) * (parenthesized multiplication)", () => {
      const suggestions = provider.getSuggestions(
        "SELECT (price + 1) *  FROM trades",
        21,
      )
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns.length).toBeGreaterThan(0)
    })

    it("does NOT suggest columns after SELECT * (wildcard)", () => {
      const suggestions = provider.getSuggestions("SELECT * ", 9)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns).toHaveLength(0)
    })

    it("does NOT suggest columns after comma-star (SELECT a, *)", () => {
      // Comma resets expression context, so * after comma is a wildcard
      const suggestions = provider.getSuggestions("SELECT symbol, * ", 17)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns).toHaveLength(0)
    })
  })

  // ===========================================================================
  // Grammar-level tableName classification tests
  // ===========================================================================
  // These tests verify that the grammar-based `tableName` rule correctly
  // classifies positions as table name vs column vs new name contexts.

  describe("grammar-level tableName classification", () => {
    it("CREATE TABLE (LIKE |) suggests tables, not columns", () => {
      const suggestions = provider.getSuggestions(
        "CREATE TABLE mytable (LIKE ",
        27,
      )
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(tables.length).toBeGreaterThan(0)
      expect(tables.map((s) => s.label)).toContain("trades")
      expect(columns).toHaveLength(0)
    })

    it("DROP TABLE suggests tables, not columns", () => {
      const suggestions = provider.getSuggestions("DROP TABLE ", 11)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(tables.map((s) => s.label)).toContain("trades")
      expect(columns).toHaveLength(0)
    })

    it("TRUNCATE TABLE suggests tables, not columns", () => {
      const suggestions = provider.getSuggestions("TRUNCATE TABLE ", 15)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(tables.map((s) => s.label)).toContain("trades")
      expect(columns).toHaveLength(0)
    })

    it("ALTER TABLE suggests tables, not columns", () => {
      const suggestions = provider.getSuggestions("ALTER TABLE ", 12)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(tables.map((s) => s.label)).toContain("trades")
      expect(columns).toHaveLength(0)
    })

    it("INSERT INTO suggests tables, not columns", () => {
      const suggestions = provider.getSuggestions("INSERT INTO ", 12)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(tables.map((s) => s.label)).toContain("trades")
      expect(columns).toHaveLength(0)
    })

    it("SELECT clause suggests columns, not just tables", () => {
      const suggestions = provider.getSuggestions("SELECT  FROM trades", 7)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns.map((s) => s.label)).toContain("symbol")
    })

    it("WHERE clause suggests columns", () => {
      const suggestions = provider.getSuggestions(
        "SELECT * FROM trades WHERE ",
        27,
      )
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns.map((s) => s.label)).toContain("price")
    })

    it("CREATE TABLE column definition: no columns, no tables", () => {
      const suggestions = provider.getSuggestions("CREATE TABLE mytable (", 22)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      expect(columns).toHaveLength(0)
      expect(tables).toHaveLength(0)
    })

    it("INSERT VALUES: no columns", () => {
      const suggestions = provider.getSuggestions(
        "INSERT INTO trades VALUES (",
        27,
      )
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns).toHaveLength(0)
    })

    it("VACUUM TABLE suggests tables, not columns", () => {
      const suggestions = provider.getSuggestions("VACUUM TABLE ", 13)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(tables.map((s) => s.label)).toContain("trades")
      expect(columns).toHaveLength(0)
    })

    it("COPY TO table position suggests tables, not columns", () => {
      const suggestions = provider.getSuggestions("COPY ", 5)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      expect(tables.map((s) => s.label)).toContain("trades")
    })

    it("ALTER TABLE trades ALTER COLUMN suggests columns", () => {
      const sql = "ALTER TABLE trades ALTER COLUMN "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns.map((s) => s.label)).toContain("symbol")
      expect(columns.map((s) => s.label)).toContain("price")
    })

    it("ALTER TABLE trades DROP COLUMN suggests columns", () => {
      const sql = "ALTER TABLE trades DROP COLUMN "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns.map((s) => s.label)).toContain("symbol")
    })

    it("ALTER TABLE trades RENAME COLUMN suggests columns for old name", () => {
      const sql = "ALTER TABLE trades RENAME COLUMN "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const columns = suggestions.filter(
        (s) => s.kind === SuggestionKind.Column,
      )
      expect(columns.map((s) => s.label)).toContain("symbol")
    })
  })

  // ===========================================================================
  // Column-based table ranking
  // ===========================================================================
  describe("column-based table ranking", () => {
    it("boosts tables that contain all referenced columns", () => {
      // "symbol" and "price" both exist in trades but not in orders or users
      const sql = "SELECT symbol, price FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const trades = tables.find((s) => s.label === "trades")
      const orders = tables.find((s) => s.label === "orders")
      const users = tables.find((s) => s.label === "users")
      expect(trades?.priority).toBe(SuggestionPriority.High)
      expect(orders?.priority).toBe(SuggestionPriority.MediumLow)
      expect(users?.priority).toBe(SuggestionPriority.MediumLow)
    })

    it("partially matching tables get Medium priority; no-match tables stay MediumLow", () => {
      // "symbol" is in trades; "id" is in orders — each table has one of the two
      const sql = "SELECT symbol, id FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const trades = tables.find((s) => s.label === "trades")
      const orders = tables.find((s) => s.label === "orders")
      const users = tables.find((s) => s.label === "users")
      // partial match → Medium (boosted but not full match)
      expect(trades?.priority).toBe(SuggestionPriority.Medium)
      expect(orders?.priority).toBe(SuggestionPriority.Medium)
      // no match → default
      expect(users?.priority).toBe(SuggestionPriority.MediumLow)
    })

    it("columns from two tables: both partially-matching tables get Medium", () => {
      // "symbol" and "price" only in trades; "status" only in orders; "name" only in users
      // → trades and orders both partially match (2 and 1 out of 3); users has none
      const sql = "SELECT symbol, price, status FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const trades = tables.find((s) => s.label === "trades")
      const orders = tables.find((s) => s.label === "orders")
      const users = tables.find((s) => s.label === "users")
      expect(trades?.priority).toBe(SuggestionPriority.Medium)
      expect(orders?.priority).toBe(SuggestionPriority.Medium)
      expect(users?.priority).toBe(SuggestionPriority.MediumLow)
    })

    it("graceful fallback: no boost when no table has any referenced column", () => {
      // "nonexistent_col" doesn't exist in any table
      const sql = "SELECT nonexistent_col FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      for (const t of tables) {
        expect(t.priority).toBe(SuggestionPriority.MediumLow)
      }
    })

    it("qualified references: the alias/qualifier is excluded but the column name is used", () => {
      // "t1.symbol" → "symbol" is extracted; "t1" (alias qualifier) is not
      const sql = "SELECT t1.symbol FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const trades = tables.find((s) => s.label === "trades")
      const orders = tables.find((s) => s.label === "orders")
      // trades has "symbol" → boosted; orders does not
      expect(trades?.priority).toBe(SuggestionPriority.High)
      expect(orders?.priority).toBe(SuggestionPriority.MediumLow)
    })

    it("qualified references from multiple aliases boost the correct tables", () => {
      // c.symbol → symbol in trades; o.id → id in orders
      const sql = "SELECT c.symbol, o.id FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const trades = tables.find((s) => s.label === "trades")
      const orders = tables.find((s) => s.label === "orders")
      const users = tables.find((s) => s.label === "users")
      expect(trades?.priority).toBe(SuggestionPriority.Medium) // partial: symbol but not id
      expect(orders?.priority).toBe(SuggestionPriority.Medium) // partial: id but not symbol
      expect(users?.priority).toBe(SuggestionPriority.MediumLow)
    })

    it("function calls are excluded from column inference", () => {
      // "count()" is a function call — should not influence ranking
      const sql = "SELECT count() FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      for (const t of tables) {
        expect(t.priority).toBe(SuggestionPriority.MediumLow)
      }
    })

    it("all tables remain in the suggestion list even when some are boosted", () => {
      const sql = "SELECT symbol, price FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tableLabels = suggestions
        .filter((s) => s.kind === SuggestionKind.Table)
        .map((s) => s.label)
      expect(tableLabels).toContain("trades")
      expect(tableLabels).toContain("orders")
      expect(tableLabels).toContain("users")
    })

    it("boosts a single-column match correctly", () => {
      // "status" only exists in orders
      const sql = "SELECT status FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      const orders = tables.find((s) => s.label === "orders")
      const trades = tables.find((s) => s.label === "trades")
      expect(orders?.priority).toBe(SuggestionPriority.High)
      expect(trades?.priority).toBe(SuggestionPriority.MediumLow)
    })

    it("SELECT * FROM does not boost any table (no referenced columns)", () => {
      const sql = "SELECT * FROM "
      const suggestions = provider.getSuggestions(sql, sql.length)
      const tables = suggestions.filter((s) => s.kind === SuggestionKind.Table)
      for (const t of tables) {
        expect(t.priority).toBe(SuggestionPriority.MediumLow)
      }
    })
  })
})
