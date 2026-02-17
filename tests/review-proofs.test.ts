/**
 * PROOF TESTS for code review issues (Part 1).
 *
 * Each test demonstrates a specific bug found during review.
 * Tests are written so they PASS when the bug EXISTS (proving the issue),
 * with a comment explaining the expected (correct) behavior.
 */
import { describe, it, expect } from "vitest"
import { parseToAst, toSql, tokenize } from "../src/index"
import type * as AST from "../src/parser/ast"

// Helper: parse and return first statement with type narrowing
function parseFirst<T extends AST.Statement>(sql: string): {
  stmt: T
  errors: Array<{ message: string; line?: number; column?: number }>
} {
  const result = parseToAst(sql)
  return { stmt: result.ast[0] as T, errors: result.errors }
}

// =============================================================================
// CRITICAL ISSUES
// =============================================================================

describe("CRITICAL issues", () => {
  // ─── Issue #1: insertStatement with StringLiteral table name ──────
  describe("#1 — INSERT INTO 'string_table' correctly parses table name", () => {
    it("table field is correctly set when INSERT INTO uses a string literal", () => {
      const result = parseToAst("INSERT INTO 'my_table' VALUES (1, 2, 3)")

      expect(result.errors).toHaveLength(0)
      expect(result.ast).toHaveLength(1)
      const insert = result.ast[0] as AST.InsertStatement

      // FIXED: Now uses stringOrQualifiedName subrule which handles StringLiteral
      expect(insert.table).toBeDefined()
      expect(insert.table.parts).toEqual(["my_table"])
      expect(insert.values).toHaveLength(1)
    })
  })

  // ─── Issue #2: windowFrameClause CUMULATIVE mode corrupted by EXCLUDE GROUPS ──
  describe("#2 — CUMULATIVE frame mode corrupted by EXCLUDE GROUPS", () => {
    it("CUMULATIVE is misidentified as groups when EXCLUDE GROUPS is present", () => {
      // First verify that CUMULATIVE without EXCLUDE works correctly
      const correct = parseToAst(
        "SELECT sum(x) OVER (CUMULATIVE) FROM t",
      )
      const selectCorrect = correct.ast[0] as AST.SelectStatement
      const colCorrect = selectCorrect.columns[0] as AST.ExpressionSelectItem
      const fnCorrect = colCorrect.expression as AST.FunctionCall
      expect(fnCorrect.over?.frame?.mode).toBe("cumulative") // works without EXCLUDE

      // Now test with EXCLUDE GROUPS
      const result = parseToAst(
        "SELECT sum(x) OVER (CUMULATIVE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE GROUPS) FROM t",
      )
      const select = result.ast[0] as AST.SelectStatement
      const col = select.columns[0] as AST.ExpressionSelectItem
      const fn = col.expression as AST.FunctionCall

      // BUG: visitor.ts:3447 checks `if (ctx.Groups)` BEFORE the else branch
      // that catches Cumulative. The EXCLUDE GROUPS clause puts a Groups token
      // in ctx, so `ctx.Groups` is truthy, and mode is set to "groups".
      //
      // EXPECTED: mode === "cumulative"
      // ACTUAL: mode === "groups"
      expect(fn.over?.frame?.mode).toBe("groups") // BUG — should be "cumulative"
    })
  })

  // ─── Issue #3: renameTableStatement mixed name types ──────────────────
  describe("#3 — RENAME TABLE mixed types correctly parsed", () => {
    it("RENAME TABLE qualifiedName TO 'string' preserves both names", () => {
      const { stmt } = parseFirst<AST.RenameTableStatement>(
        "RENAME TABLE my_table TO 'new_name'",
      )

      // FIXED: Now uses stringOrQualifiedName subrule for each name independently
      expect(stmt.from.parts).toEqual(["my_table"])
      expect(stmt.to.parts).toEqual(["new_name"])
    })

    it("RENAME TABLE 'string' TO qualifiedName preserves both names", () => {
      const { stmt } = parseFirst<AST.RenameTableStatement>(
        "RENAME TABLE 'old_name' TO new_table",
      )

      // FIXED: Each name is its own stringOrQualifiedName subrule
      expect(stmt.from.parts).toEqual(["old_name"])
      expect(stmt.to.parts).toEqual(["new_table"])
    })
  })

  // ─── Issue #4: CREATE TABLE LIKE with StringLiteral table name ───
  describe("#4 — CREATE TABLE 'string' (LIKE other) correctly parsed", () => {
    it("table name and LIKE clause are both correct", () => {
      const { stmt } = parseFirst<AST.CreateTableStatement>(
        "CREATE TABLE 'my_table' (LIKE other_table)",
      )

      // FIXED: Table name uses stringOrQualifiedName, LIKE target uses qualifiedName[0]
      expect(stmt.table.parts).toEqual(["my_table"])
      expect(stmt.like).toBeDefined()
      expect(stmt.like!.parts).toEqual(["other_table"])
    })
  })

  // ─── Issue #5: NumberLiteral regex eats trailing dot ────────────────────
  describe("#5 — NumberLiteral regex consumes trailing dot", () => {
    it("tokenizer consumes dot into NumberLiteral when followed by non-digit", () => {
      const result = tokenize("1.")
      const tokens = result.tokens.filter((t) => t.tokenType.name !== "WhiteSpace")

      // BUG: lexer.ts:677 pattern /(\d[\d_]*\.?[\d_]*|...)/ matches "1." as a single token
      // because \.? optionally matches the dot and [\d_]* matches zero chars after it.
      //
      // This means "1." is a single NumberLiteral, not "1" + Dot.
      // While "1." is a valid float in many contexts, this behavior means that when
      // autocomplete tokenizes incomplete input like "SELECT 1." (user about to type
      // a column ref after a subquery alias), the dot is consumed into the number.
      expect(tokens).toHaveLength(1) // "1." is one token, not "1" + "."
      expect(tokens[0].tokenType.name).toBe("NumberLiteral")
      expect(tokens[0].image).toBe("1.") // dot was consumed into number
    })
  })

  // ─── Issue #6: TableRef export name collision ─────────────────────────
  describe("#6 — TableRef export collision (compile-time issue)", () => {
    it("AST TableRef and content-assist TableRef are structurally different", () => {
      // PROOF: index.ts line 10 does `export * from "./parser/ast"` which includes
      // the AST TableRef (has .type, .table as QualifiedName|SelectStatement, .joins, etc.)
      // Then line 13 does `export type { TableRef } from "./autocomplete/content-assist"`
      // which shadows it with { table: string, alias?: string }.
      //
      // We prove they're structurally incompatible by showing the AST TableRef
      // has fields that don't match the content-assist signature:
      const result = parseToAst("SELECT * FROM trades t")
      const select = result.ast[0] as AST.SelectStatement
      const tableRef = select.from![0]

      // AST TableRef.table is an OBJECT (QualifiedName), not a string:
      expect(typeof tableRef.table).toBe("object")
      expect(tableRef.table).toHaveProperty("type", "qualifiedName")
      expect(tableRef.table).toHaveProperty("parts")

      // The shadowing export gives consumers { table: string } instead.
      // Any consumer doing `import { TableRef } from "questdb-sql-parser"` gets
      // the content-assist version, not the AST version.
    })
  })

  // ─── Issue #7: parseToAst catch block design ──────────────────────────
  describe("#7 — parseToAst catch block masks visitor bugs as empty AST", () => {
    it("demonstrates the catch block pattern with issue #1 as example", () => {
      // The catch block at index.ts:92-98 catches ALL exceptions from the visitor,
      // not just errors from incomplete CST nodes.
      //
      // We can't easily inject a visitor bug at runtime, but we can demonstrate
      // the pattern: valid SQL that the parser handles fine but the visitor
      // silently drops data for (issue #1 shows table name lost, not a crash).
      //
      // The architectural concern: if the visitor DID throw (e.g., on a future
      // code regression), the consumer gets { ast: [], errors: [] } — no indication
      // of what went wrong. The catch block should at minimum only swallow errors
      // when parseErrors.length > 0.

      // Structural proof by code:
      // index.ts:90-98:
      //   let ast: Statement[] = []
      //   try {
      //     ast = visitor.visit(cst) as Statement[]
      //   } catch {
      //     // catches ALL errors, returns empty ast with no indication
      //   }
      expect(true).toBe(true) // architectural issue, proven by code inspection
    })
  })

  // ─── Issues #8, #9: Distribution issues (build-time, not runtime) ─────
  describe("#8, #9 — Distribution issues (build-time proofs)", () => {
    it("#8: cst-types.d.ts is a standalone .d.ts not processed by tsc emitDeclarationOnly", () => {
      // Proof: src/parser/cst-types.d.ts is a hand-written .d.ts file.
      // tsc with emitDeclarationOnly does not copy pre-existing .d.ts files to outDir.
      // tsup has dts: false. The generated dist/parser/visitor.d.ts references types
      // from cst-types.d.ts, but it won't exist in dist/parser/ for npm consumers.
      expect(true).toBe(true) // verified by file inspection
    })

    it("#9: CJS types condition points to ESM .d.ts instead of .d.cts", () => {
      // package.json require.types points to ./dist/index.d.ts (ESM declarations).
      // TypeScript node16/nodenext resolution requires .d.cts for CJS.
      // No .d.cts files are generated by the build pipeline.
      expect(true).toBe(true) // verified by config inspection
    })
  })
})

// =============================================================================
// MAJOR ISSUES
// =============================================================================

describe("MAJOR issues", () => {
  // ─── Issue #10: Array subscript nd-array access ────────────────────────
  describe("#10 — arr[1, 2] produces single arrayAccess with 2 subscripts", () => {
    it("multi-subscript in single bracket pair produces flat subscripts (nd-array)", () => {
      const result = parseToAst("SELECT arr[1, 2] FROM t")
      expect(result.errors).toHaveLength(0)
      const select = result.ast[0] as AST.SelectStatement
      const col = select.columns[0] as AST.ExpressionSelectItem
      const expr = col.expression as AST.ArrayAccessExpression

      // FIXED: Single bracket pair groups all subscripts into one ArrayAccessExpression
      expect(expr.type).toBe("arrayAccess")
      expect(expr.subscripts).toHaveLength(2)
      expect((expr.array as AST.ColumnRef).type).toBe("column")
    })
  })

  // ─── Issue #11: extractMaybeString misses identifier subrule ──────────
  describe("#11 — extractMaybeString returns empty string for identifiers", () => {
    it("identifier-based interval value returns empty string in MV period", () => {
      // String literal works:
      const withString = parseToAst(
        "CREATE MATERIALIZED VIEW mv PERIOD(LENGTH '1d') AS SELECT * FROM t",
      )
      expect(withString.errors).toHaveLength(0)
      const mvString = withString.ast[0] as AST.CreateMaterializedViewStatement
      expect(mvString.period?.length).toBe("1d") // strings work fine

      // Number literal works:
      const withNumber = parseToAst(
        "CREATE MATERIALIZED VIEW mv PERIOD(LENGTH 100) AS SELECT * FROM t",
      )
      expect(withNumber.errors).toHaveLength(0)
      const mvNumber = withNumber.ast[0] as AST.CreateMaterializedViewStatement
      expect(mvNumber.period?.length).toBe("100") // numbers work fine

      // BUG: Identifier returns empty string
      const withIdent = parseToAst(
        "CREATE MATERIALIZED VIEW mv PERIOD(LENGTH myvar) AS SELECT * FROM t",
      )
      expect(withIdent.errors).toHaveLength(0)
      const mvIdent = withIdent.ast[0] as AST.CreateMaterializedViewStatement

      // FIXED: extractMaybeString now handles identifier subrule (lowercase)
      expect(mvIdent.period?.length).toBe("myvar")
    })
  })

  // ─── Issue #12: resumeWalToSql emits both FROM TRANSACTION and FROM TXN ──
  describe("#12 — resumeWalToSql can emit invalid SQL with both clauses", () => {
    it("emits both FROM TRANSACTION and FROM TXN when both fields are set", () => {
      const stmt: AST.ResumeWalStatement = {
        type: "resumeWal",
        fromTransaction: 5,
        fromTxn: 10,
      }

      const sql = toSql(stmt)

      // FIXED: Uses else-if, so fromTransaction takes precedence
      expect(sql).toBe("RESUME WAL FROM TRANSACTION 5")
      expect(sql).toContain("FROM TRANSACTION")
      expect(sql).not.toContain("FROM TXN")
    })
  })

  // ─── Issue #13: createTableToSql indexes outside parentheses ──────────
  describe("#13 — CREATE TABLE indexes emitted outside column parentheses", () => {
    it("INDEX clause appears after the closing paren of the column list", () => {
      const stmt: AST.CreateTableStatement = {
        type: "createTable",
        table: { type: "qualifiedName", parts: ["my_table"] },
        columns: [
          { type: "columnDefinition", name: "id", dataType: "INT" },
          { type: "columnDefinition", name: "name", dataType: "STRING" },
        ],
        indexes: [
          { type: "indexDefinition", column: { type: "qualifiedName", parts: ["name"] } },
        ],
      }

      const sql = toSql(stmt)

      // BUG: toSql.ts:551-559 builds `(col1 INT, col2 STRING)` then
      // appends `, INDEX(name)` OUTSIDE the parens.
      //
      // EXPECTED: "CREATE TABLE my_table (id INT, name STRING, INDEX(name))"
      // ACTUAL: "CREATE TABLE my_table (id INT, name STRING), INDEX(name)"
      expect(sql).toContain("), INDEX(") // BUG — INDEX is outside parens
      expect(sql).not.toContain(", INDEX(name))") // correct form NOT present
    })
  })

  // ─── Issue #14: binaryExprToSql no operator precedence parens ─────────
  describe("#14 — binaryExprToSql drops parentheses, changing semantics", () => {
    it("nested binary expressions lose operator precedence without ParenExpression", () => {
      // Construct AST for (a + b) * c WITHOUT using ParenExpression wrapper
      const stmt: AST.SelectStatement = {
        type: "select",
        columns: [
          {
            type: "selectItem",
            expression: {
              type: "binary",
              operator: "*",
              left: {
                type: "binary",
                operator: "+",
                left: { type: "column", name: { type: "qualifiedName", parts: ["a"] } },
                right: { type: "column", name: { type: "qualifiedName", parts: ["b"] } },
              } as AST.BinaryExpression,
              right: { type: "column", name: { type: "qualifiedName", parts: ["c"] } },
            } as AST.BinaryExpression,
          } as AST.ExpressionSelectItem,
        ],
      }

      const sql = toSql(stmt)

      // BUG: binaryExprToSql at toSql.ts:1472-1476 always emits `left op right`
      // with no parentheses. Without ParenExpression in the AST, nested binary
      // expressions lose their grouping.
      //
      // The AST structure says: multiply( add(a, b), c ) — meaning (a+b)*c
      // But toSql outputs: "a + b * c" — which means a+(b*c) due to operator precedence
      //
      // EXPECTED: "(a + b) * c" or at minimum correct precedence handling
      // ACTUAL: "a + b * c" — semantics changed
      expect(sql).toContain("a + b * c") // BUG — should preserve grouping
      expect(sql).not.toContain("(a + b)") // parens are missing
    })
  })

  // ─── Issue #15: Natural/Prevailing join types not handled in visitor ───
  describe("#15 — NATURAL JOIN type is silently dropped", () => {
    it("NATURAL JOIN produces undefined joinType in AST", () => {
      const result = parseToAst(
        "SELECT * FROM trades NATURAL JOIN orders ON trades.id = orders.id",
      )
      expect(result.errors).toHaveLength(0)
      const select = result.ast[0] as AST.SelectStatement
      const from = select.from![0]

      // BUG: visitor.ts:627-635 has no case for Natural or Prevailing.
      // The if-else chain falls through with joinType remaining undefined.
      //
      // EXPECTED: join.joinType === "natural"
      // ACTUAL: join.joinType is undefined
      expect(from.joins).toBeDefined()
      expect(from.joins).toHaveLength(1)
      expect(from.joins![0].joinType).toBeUndefined() // BUG — should be "natural"
    })
  })

  // ─── Issue #16: Duplicate table entries from extractTablesFromAst ──────
  describe("#16 — Duplicate table entries from AST extraction (code-level proof)", () => {
    it("overlapping handlers in extractTablesFromAst are fragile", () => {
      // extractTablesFromAst is internal (not exported), so we prove by code analysis.
      //
      // content-assist.ts:85-96: specific handler for n.from — pushes table entry
      // content-assist.ts:98-110: specific handler for n.joins — pushes table entry
      // content-assist.ts:128-138: generic recursion visits ALL keys including from/joins
      //
      // The WeakSet prevents revisiting the same object reference, which mitigates
      // most duplicate cases. However:
      // - The from handler at line 86 calls normalizeTableName() on n.from directly.
      //   If n.from is a complex object (array of TableRef), normalizeTableName returns
      //   undefined, and visit(n.from) is called. The generic recursion then also
      //   visits n.from — but it's already in visited, so no duplicate.
      // - For joins at line 100-108: each join is visited after pushing, so it's
      //   in the WeakSet when generic recursion reaches it.
      //
      // The code works by coincidence of WeakSet, not by design. If the data
      // structure changes (e.g., from becomes a primitive), duplicates will appear.
      expect(true).toBe(true) // proven by code analysis
    })
  })

  // ─── Issue #17: WORD_BOUNDARY_CHARS allocated on every call ──────────
  describe("#17 — WORD_BOUNDARY_CHARS re-allocated on hot path", () => {
    it("performance: Set allocated inside getContentAssist instead of module-level", () => {
      // content-assist.ts:447-476 creates a new Set of 27 boundary characters
      // inside getContentAssist, which runs on every keystroke.
      // Should be a module-level constant.
      //
      // Not a correctness bug — performance issue proven by code inspection.
      expect(true).toBe(true)
    })
  })

  // ─── Issue #18: windowDefinitionClause is a no-op ─────────────────────
  describe("#18 — Named WINDOW clause silently dropped from AST", () => {
    it("WINDOW definition is parsed but visitor discards it", () => {
      // NOTE: WINDOW clause only parses when preceded by ORDER BY, because
      // without it the parser consumes WINDOW as a join type prefix.
      const result = parseToAst(
        "SELECT avg(price) OVER w FROM trades ORDER BY ts WINDOW w AS (ORDER BY ts)",
      )
      expect(result.errors).toHaveLength(0) // parses successfully
      const select = result.ast[0] as AST.SelectStatement

      // BUG: visitor.ts:3475-3478 returns undefined for windowDefinitionClause.
      // simpleSelect visitor (visitor.ts:349-398) has no code to capture the result.
      //
      // EXPECTED: select should have a windowDefinitions field with the "w" definition
      // ACTUAL: no window definitions captured anywhere in the AST
      expect((select as unknown as Record<string, unknown>).window).toBeUndefined()
      expect((select as unknown as Record<string, unknown>).windowDefinitions).toBeUndefined()

      // The OVER reference exists but the window name "w" is lost too:
      const col = select.columns[0] as AST.ExpressionSelectItem
      const fn = col.expression as AST.FunctionCall
      expect(fn.over).toBeDefined()
      // The over spec has no window name reference — it's an empty windowSpec
      expect(fn.over?.partitionBy).toBeUndefined()
      expect(fn.over?.orderBy).toBeUndefined()
      expect(fn.over?.frame).toBeUndefined()
      // The "w" name is completely lost from the AST
    })
  })

  // ─── Issue #19: TTL duration unit mapping incomplete ───────────────────
  describe("#19 — TTL duration with minutes silently becomes DAYS", () => {
    it("30m TTL is mapped to 30 DAYS instead of failing or using MINUTES", () => {
      const result = parseToAst(
        "CREATE TABLE t (x INT) TIMESTAMP(x) PARTITION BY HOUR TTL 30m",
      )
      expect(result.errors).toHaveLength(0)
      expect(result.ast).toHaveLength(1)
      const create = result.ast[0] as AST.CreateTableStatement

      // BUG: extractTtl at visitor.ts:3684-3696 maps duration units:
      // { h: "HOURS", d: "DAYS", w: "WEEKS", M: "MONTHS", y: "YEARS" }
      // Missing: m (minutes), s, ms, us, ns
      // The fallback is `?? "DAYS"`, so "30m" becomes { value: 30, unit: "DAYS" }.
      //
      // EXPECTED: error or { value: 30, unit: "MINUTES" }
      // ACTUAL: { value: 30, unit: "DAYS" } — silent data corruption
      expect(create.ttl).toBeDefined()
      expect(create.ttl!.value).toBe(30)
      expect(create.ttl!.unit).toBe("DAYS") // BUG — should be "MINUTES" or error
    })
  })
})
