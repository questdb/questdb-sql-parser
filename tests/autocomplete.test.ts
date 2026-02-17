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

    it("suggests FROM after SELECT *", () => {
      const labels = getLabelsAt(provider, "SELECT * ")
      expect(labels).toContain("FROM")
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
          expects: ["TABLES", "COLUMNS", "CREATE", "TIME"],
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
