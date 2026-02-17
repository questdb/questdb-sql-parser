/**
 * Documentation SQL - Parse Tests
 *
 * Tests that all SQL examples from QuestDB documentation can be parsed
 * successfully by the parser.
 *
 * Source of truth: tests/fixtures/docs-queries.json
 */

import { describe, it, expect } from "vitest"
import { parseToAst } from "../src/index"
import * as fs from "fs"
import * as path from "path"

interface DocsQuery {
  query: string
}

const fixtureP = path.join(__dirname, "fixtures", "docs-queries.json")
const queries: DocsQuery[] = JSON.parse(
  fs.readFileSync(fixtureP, "utf-8"),
) as DocsQuery[]

describe("Documentation SQL - Parse", () => {
  it("should have queries to test", () => {
    expect(queries.length).toBeGreaterThan(0)
    /* eslint-disable no-console */
    console.log(`Total queries: ${queries.length}`)
    /* eslint-enable no-console */
  })

  describe("should parse without errors", () => {
    it.each(
      queries.map((q, i) => [
        `#${i}: ${q.query.substring(0, 60).replace(/\n/g, " ")}`,
        q,
      ]),
    )("%s", (_label, entry) => {
      const q = entry
      const result = parseToAst(q.query)
      expect(result.errors).toHaveLength(0)
      expect(result.ast.length).toBeGreaterThan(0)
    })
  })
})
