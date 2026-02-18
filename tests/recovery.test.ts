import { describe, it, expect } from "vitest"
import { parse } from "../src/parser/parser"
import { parseToAst } from "../src/index"

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract statement CST nodes from the parsed result.
 */
function getStatements(input: string) {
  const result = parse(input)
  const stmts = result.cst.children.statement ?? []
  return { stmts, result }
}

/**
 * Get the first token of a CST node (recursive search).
 */
function firstToken(
  node: unknown,
): { image: string; startOffset: number } | null {
  if (!node || typeof node !== "object") return null
  const n = node as Record<string, unknown>
  if (typeof n.image === "string" && typeof n.startOffset === "number")
    return { image: n.image, startOffset: n.startOffset }
  if (n.children && typeof n.children === "object") {
    let earliest: { image: string; startOffset: number } | null = null
    for (const key of Object.keys(n.children)) {
      const arr = (n.children as Record<string, unknown[]>)[key]
      if (Array.isArray(arr)) {
        for (const child of arr) {
          const tok = firstToken(child)
          if (
            tok &&
            (earliest === null || tok.startOffset < earliest.startOffset)
          ) {
            earliest = tok
          }
        }
      }
    }
    return earliest
  }
  return null
}

/**
 * Get the leading keyword of each statement CST node.
 */
function statementKeywords(input: string): string[] {
  const { stmts } = getStatements(input)
  return stmts
    .map((s) => firstToken(s)?.image.toUpperCase())
    .filter(Boolean) as string[]
}

/**
 * Parse to AST and return statement types.
 */
function astTypes(input: string): string[] {
  const { ast } = parseToAst(input)
  return ast.map((s) => s.type)
}

// =============================================================================
// Tests
// =============================================================================

describe("Semicolon-bounded recovery", () => {
  it("recovers INSERT after nonsense SQL separated by semicolons", () => {
    const input = [
      "CREATE TABLE t1 (ts TIMESTAMP, price DOUBLE) timestamp(ts) PARTITION BY DAY WAL;",
      "SELECT something",
      "else",
      "UPDATE",
      "select 5;",
      "",
      "INSERT INTO t1 VALUES (now(), 1.0);",
    ].join("\n")

    const { stmts } = getStatements(input)
    expect(stmts.length).toBe(5)

    const kw = statementKeywords(input)
    expect(kw).toEqual(["CREATE", "SELECT", "UPDATE", "SELECT", "INSERT"])

    const lastStmt = stmts[stmts.length - 1]
    const lastFirstTok = firstToken(lastStmt)
    expect(lastFirstTok).not.toBeNull()
    expect(lastFirstTok!.image.toUpperCase()).toBe("INSERT")
  })

  it("valid statements separated by semicolons all parse correctly", () => {
    const { stmts } = getStatements("SELECT 1; SELECT 2; SELECT 3")
    expect(stmts.length).toBe(3)
    for (const stmt of stmts) {
      expect(firstToken(stmt)).not.toBeNull()
    }
  })

  it("nonsense at the end does not affect preceding statements", () => {
    const { stmts } = getStatements("SELECT 1; this is nonsense")
    expect(stmts.length).toBe(3)
    const kw = statementKeywords("SELECT 1; this is nonsense")
    expect(kw).toEqual(["SELECT", "THIS", "NONSENSE"])
  })

  it("nonsense between two valid statements preserves both", () => {
    const { stmts } = getStatements("SELECT 1; gibberish stuff here; SELECT 2")
    expect(stmts.length).toBe(4)
    const kw = statementKeywords("SELECT 1; gibberish stuff here; SELECT 2")
    expect(kw).toEqual(["SELECT", "GIBBERISH", "HERE", "SELECT"])
  })

  it("multiple nonsense blocks between valid statements", () => {
    const input =
      "CREATE TABLE t1 (x INT); blah blah; INSERT INTO t1 VALUES (1); more garbage; SELECT 1"
    const { stmts } = getStatements(input)
    expect(stmts.length).toBe(5)
    const kw = statementKeywords(input)
    expect(kw).toEqual(["CREATE", "BLAH", "INSERT", "MORE", "SELECT"])
  })

  it("trailing semicolon on incomplete query does not collapse statements", () => {
    const input = [
      "select * from a WHERE",
      "SELECT 1",
      "INSERT INTO t1 VALUES (now(), 1.0)",
      "SELECT 2",
    ].join("\n")

    const without = getStatements(input)
    const withSemicolon = getStatements(input + ";")
    expect(withSemicolon.stmts.length).toBe(without.stmts.length)
  })

  it("error inside matched subrule uses default recovery, not semicolon skip", () => {
    const { stmts } = getStatements(
      "select * from a WHERE\nSELECT 1;\nSELECT 2",
    )
    expect(stmts.length).toBe(3)
    const kw = stmts
      .map((s) => firstToken(s)?.image.toUpperCase())
      .filter(Boolean)
    expect(kw).toEqual(["SELECT", "SELECT", "SELECT"])
  })

  it("empty semicolons produce no extra statements", () => {
    const { stmts } = getStatements(";;;SELECT 1;;;SELECT 2;;;")
    expect(stmts.length).toBe(2)
    const kw = stmts
      .map((s) => firstToken(s)?.image.toUpperCase())
      .filter(Boolean)
    expect(kw).toEqual(["SELECT", "SELECT"])
  })

  it("recovers across different statement types", () => {
    const input =
      "DROP TABLE t1; bad stuff; CREATE TABLE t2 (x INT); nope; INSERT INTO t2 VALUES (1); garbage; SELECT * FROM t2"
    const { stmts } = getStatements(input)
    expect(stmts.length).toBe(7)
    const kw = statementKeywords(input)
    expect(kw).toEqual([
      "DROP",
      "BAD",
      "CREATE",
      "NOPE",
      "INSERT",
      "GARBAGE",
      "SELECT",
    ])
  })
})

describe("Incomplete statement recovery", () => {
  it("SELECT without FROM still produces a select AST", () => {
    const result = parseToAst("SELECT")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("SELECT ... FROM without table name", () => {
    const result = parseToAst("SELECT * FROM")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("SELECT ... WHERE without condition", () => {
    const result = parseToAst("SELECT * FROM t WHERE")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("INSERT INTO without table name", () => {
    const result = parseToAst("INSERT INTO")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("insert")
  })

  it("INSERT INTO table without VALUES", () => {
    const result = parseToAst("INSERT INTO t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("insert")
  })

  it("CREATE TABLE without column definitions or AS", () => {
    const result = parseToAst("CREATE TABLE t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("createTable")
  })

  it("CREATE TABLE with open paren but no columns", () => {
    const result = parseToAst("CREATE TABLE t (")
    expect(result.errors.length).toBe(3)
    expect(result.ast.length).toBe(0)
  })

  it("ALTER TABLE without action", () => {
    const result = parseToAst("ALTER TABLE t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("UPDATE without SET", () => {
    const result = parseToAst("UPDATE t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("DROP without object type", () => {
    const result = parseToAst("DROP")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete statement followed by valid statement in multi-statement mode", () => {
    const kw = statementKeywords("SELECT * FROM; SELECT 1")
    expect(kw).toEqual(["SELECT", "SELECT"])
    const result = parseToAst("SELECT * FROM; SELECT 1")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(2)
  })

  it("incomplete CREATE TABLE followed by valid INSERT", () => {
    const kw = statementKeywords(
      "CREATE TABLE t (; INSERT INTO other VALUES (1)",
    )
    expect(kw).toEqual(["CREATE", "INSERT"])
    const result = parseToAst("CREATE TABLE t (; INSERT INTO other VALUES (1)")
    expect(result.errors.length).toBe(2)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete WHERE clause followed by valid statement", () => {
    const kw = statementKeywords("SELECT * FROM t WHERE; SELECT 2")
    expect(kw).toEqual(["SELECT", "SELECT"])
    const result = parseToAst("SELECT * FROM t WHERE; SELECT 2")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete ORDER BY followed by valid statement", () => {
    const kw = statementKeywords("SELECT * FROM t ORDER BY; SELECT 1")
    expect(kw).toEqual(["SELECT", "SELECT"])
    const result = parseToAst("SELECT * FROM t ORDER BY; SELECT 1")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete GROUP BY followed by valid statement", () => {
    const kw = statementKeywords("SELECT * FROM t GROUP BY; SELECT 1")
    expect(kw).toEqual(["SELECT", "SELECT"])
    const result = parseToAst("SELECT * FROM t GROUP BY; SELECT 1")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete JOIN clause followed by valid statement", () => {
    const kw = statementKeywords("SELECT * FROM t1 JOIN; SELECT * FROM t2")
    expect(kw).toEqual(["SELECT", "SELECT"])
    const result = parseToAst("SELECT * FROM t1 JOIN; SELECT * FROM t2")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(2)
  })

  it("unclosed parenthesis in expression", () => {
    const result = parseToAst("SELECT (1 + 2 FROM t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("unclosed string literal", () => {
    const result = parseToAst("SELECT 'hello FROM t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("missing comma between select items parses as implicit alias", () => {
    const result = parseToAst("SELECT a b FROM t")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })
})

describe("Unexpected token recovery", () => {
  it("random word at start of statement parses as implicit select", () => {
    const result = parseToAst("FOOBAR")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("bare number produces error", () => {
    const result = parseToAst("42")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("unexpected keyword in SELECT column list", () => {
    const result = parseToAst("SELECT TABLE FROM t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("double FROM keyword", () => {
    const result = parseToAst("SELECT * FROM FROM t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(2)
  })

  it("extra comma in column list", () => {
    const result = parseToAst("SELECT a,, b FROM t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("extra comma in VALUES list", () => {
    const result = parseToAst("INSERT INTO t VALUES (1,, 2)")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("unexpected semicolon in expression", () => {
    const result = parseToAst("SELECT 1 + ; 2 FROM t")
    expect(result.errors.length).toBe(2)
    expect(result.ast.length).toBe(0)
  })

  it("misplaced WHERE (before FROM)", () => {
    const result = parseToAst("SELECT * WHERE x = 1 FROM t")
    expect(result.errors.length).toBe(2)
    expect(result.ast.length).toBe(3)
  })

  it("repeated keyword does not crash", () => {
    const result = parseToAst("SELECT SELECT SELECT")
    expect(result.errors.length).toBe(3)
    expect(result.ast.length).toBe(3)
  })

  it("unexpected closing paren", () => {
    const result = parseToAst("SELECT 1) FROM t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(2)
  })

  it("unknown word after valid SELECT is treated as alias", () => {
    const result = parseToAst("SELECT * FROM t FOOBAR")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("unknown word after WHERE condition parsed as separate statement", () => {
    const result = parseToAst("SELECT * FROM t WHERE x = 1 YOLO")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(2)
    expect(result.ast[0].type).toBe("select")
  })
})

describe("Multi-statement recovery preserves valid AST nodes", () => {
  it("valid SELECT before and after garbage", () => {
    const types = astTypes("SELECT 1; xxxxx; SELECT 2")
    expect(types).toEqual(["select", "select", "select"])
  })

  it("mixed statement types with interleaved garbage", () => {
    const types = astTypes(
      "SELECT 1; bad; CREATE TABLE t (x INT); oops; INSERT INTO t VALUES (1)",
    )
    expect(types).toEqual([
      "select",
      "select",
      "createTable",
      "select",
      "insert",
    ])
  })

  it("only garbage produces AST via implicit select", () => {
    const result = parseToAst("aaa bbb ccc; ddd eee fff; ggg hhh iii")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(6)
  })

  it("valid statement after many garbage statements", () => {
    const types = astTypes("bad1; bad2; bad3; bad4; bad5; SELECT 1")
    expect(types.length).toBe(6)
    expect(types).toContain("select")
  })

  it("valid statement before many garbage statements", () => {
    const types = astTypes("SELECT 1; bad1; bad2; bad3; bad4; bad5")
    expect(types.length).toBe(6)
    expect(types[0]).toBe("select")
  })

  it("alternating valid and invalid", () => {
    const types = astTypes("SELECT 1; bad; SELECT 2; bad; SELECT 3")
    expect(types.length).toBe(5)
    expect(types.filter((t) => t === "select").length).toBe(5)
  })
})

describe("Edge cases", () => {
  it("empty input produces no statements", () => {
    const result = parseToAst("")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(0)
  })

  it("whitespace-only input produces no statements", () => {
    const result = parseToAst("   \n\t\n   ")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(0)
  })

  it("semicolons-only input produces error but no AST", () => {
    const result = parseToAst(";;;")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("very long identifier does not crash", () => {
    const longName = "a".repeat(1000)
    const result = parseToAst(`SELECT * FROM ${longName}`)
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("deeply nested parentheses", () => {
    const result = parseToAst("SELECT ((((((1)))))) FROM t")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(1)
  })

  it("many columns in SELECT", () => {
    const cols = Array.from({ length: 100 }, (_, i) => `col${i}`).join(", ")
    const result = parseToAst(`SELECT ${cols} FROM t`)
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(1)
  })

  it("many semicolons between statements still parses all valid statements", () => {
    const result = parseToAst("SELECT 1;;;;;SELECT 2;;;;;SELECT 3")
    expect(result.errors.length).toBe(2)
    expect(result.ast.length).toBe(3)
    expect(result.ast.map((s) => s.type)).toEqual([
      "select",
      "select",
      "select",
    ])
  })

  it("newlines as statement separators (no semicolons)", () => {
    const result = parseToAst("SELECT 1\nSELECT 2")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(2)
  })

  it("comment-only input", () => {
    const result = parseToAst("-- just a comment")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(0)
  })

  it("block comment only", () => {
    const result = parseToAst("/* nothing here */")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(0)
  })

  it("statement with inline comment", () => {
    const result = parseToAst("SELECT /* middle */ 1 FROM t")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(1)
  })

  it("statement with trailing comment", () => {
    const result = parseToAst("SELECT 1 FROM t -- end of line")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(1)
  })
})

describe("Clause-level recovery", () => {
  it("invalid expression in WHERE produces lexer and parse errors", () => {
    const result = parseToAst("SELECT * FROM t WHERE ??? = 1")
    expect(result.errors.length).toBe(2)
    expect(result.ast.length).toBe(0)
  })

  it("missing ON clause in JOIN parses successfully", () => {
    const result = parseToAst("SELECT * FROM t1 INNER JOIN t2")
    expect(result.errors.length).toBe(0)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("incomplete CASE expression", () => {
    const result = parseToAst("SELECT CASE WHEN x THEN FROM t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete CAST expression", () => {
    const result = parseToAst("SELECT CAST(x AS FROM t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("incomplete subquery in FROM", () => {
    const result = parseToAst("SELECT * FROM (SELECT")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("incomplete CTE definition", () => {
    const result = parseToAst("WITH cte AS ( SELECT * FROM t")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("missing PARTITION BY in LATEST ON", () => {
    const result = parseToAst("SELECT * FROM t LATEST ON ts")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("incomplete SAMPLE BY", () => {
    const result = parseToAst("SELECT * FROM t SAMPLE BY")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete ORDER BY", () => {
    const result = parseToAst("SELECT * FROM t ORDER BY")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete LIMIT clause", () => {
    const result = parseToAst("SELECT * FROM t LIMIT")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete UNION", () => {
    const result = parseToAst("SELECT 1 UNION")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("select")
  })

  it("incomplete INSERT VALUES", () => {
    const result = parseToAst("INSERT INTO t VALUES (")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete UPDATE SET", () => {
    const result = parseToAst("UPDATE t SET x =")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(0)
  })

  it("incomplete ALTER TABLE ADD COLUMN", () => {
    const result = parseToAst("ALTER TABLE t ADD COLUMN")
    expect(result.errors.length).toBe(1)
    expect(result.ast.length).toBe(1)
    expect(result.ast[0].type).toBe("alterTable")
  })
})
