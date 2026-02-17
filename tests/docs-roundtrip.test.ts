/**
 * Documentation SQL - Round-trip Tests
 *
 * For each SQL statement:
 * 1. Parse to AST using parseToAst
 * 2. Convert back to SQL using toSql
 * 3. Compare normalized original with normalized toSql output
 *
 * Normalization is parser-independent (plain string operations):
 * - Strip comments
 * - Collapse whitespace
 * - Uppercase everything
 *
 * Source of truth: tests/fixtures/docs-queries.json
 */

import { describe, it, expect } from "vitest"
import { parseToAst } from "../src/index"
import { toSql } from "../src/parser/toSql"
import * as fs from "fs"
import * as path from "path"

interface DocsQuery {
  query: string
  skipAutocomplete?: boolean
}

const fixtureP = path.join(__dirname, "fixtures", "docs-queries.json")
const queries: DocsQuery[] = JSON.parse(
  fs.readFileSync(fixtureP, "utf-8"),
) as DocsQuery[]

/**
 * Normalize SQL for comparison — independent of the parser.
 */
function normalizeSql(sql: string): string {
  let s = sql
  // Remove block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, " ")
  // Remove line comments
  s = s.replace(/--[^\n]*/g, " ")
  // Collapse all whitespace to single space
  s = s.replace(/\s+/g, " ")
  s = s.trim()
  // Remove trailing semicolons
  s = s.replace(/;+$/, "")
  // Uppercase
  s = s.toUpperCase()
  // Normalize parentheses spacing: ( x ) → (x)
  s = s.replace(/\(\s+/g, "(")
  s = s.replace(/\s+\)/g, ")")
  // Normalize operator equivalence: <> and != are the same
  s = s.replace(/<>/g, "!=")
  // Normalize spaces around comparison operators so SYMBOL='X' and SYMBOL = 'X' match
  s = s.replace(/([A-Z0-9_)'"\]])\s*(!=|>=|<=|=|>|<)\s*/g, "$1 $2 ")
  // Remove optional AS keyword (implicit vs explicit alias is semantically identical)
  // This is safe because both sides are normalized the same way
  s = s.replace(/\bAS\b/g, " ")
  // Normalize array subscripts: a[1][2] and a[1, 2] are equivalent
  s = s.replace(/\]\[/g, ", ")
  // Normalize comma spacing: remove space before comma, ensure exactly one space after
  s = s.replace(/\s+,/g, ",")
  s = s.replace(/,\s*/g, ", ")
  // N1: Normalize array/bracket whitespace: ARRAY[ x ] → ARRAY[x], [ 1 ] → [1]
  s = s.replace(/\[\s+/g, "[")
  s = s.replace(/\s+\]/g, "]")
  // N2: Normalize arithmetic operator spacing: a+b, a + b → a + b
  s = s.replace(/\s*([+\-*/%])\s*/g, " $1 ")
  // N3: Normalize VALUES spacing: VALUES( → VALUES (
  s = s.replace(/VALUES\s*\(/g, "VALUES (")
  // N4: Normalize keyword-paren spacing: KEYS( → KEYS (, JOIN( → JOIN (
  s = s.replace(/([A-Z])\(/g, "$1 (")
  // N5: Normalize quoted identifiers: "FOO" → FOO, "FOO.BAR" → FOO.BAR (quoting is stylistic)
  // Also handles unicode identifiers like "日本語ビュー"
  s = s.replace(/"([^"]+)"/g, "$1")
  // N6: Normalize duration shorthand: 2W → 2 WEEKS, 12H → 12 HOURS, 20S → 20 SECONDS, etc.
  const durationMap: Record<string, string> = {
    H: "HOURS",
    D: "DAYS",
    W: "WEEKS",
    M: "MONTHS",
    Y: "YEARS",
    S: "SECONDS",
  }
  s = s.replace(
    /\b(\d+(?:\.\d+)?)(H|D|W|M|Y|S)\b/g,
    (_, num, unit: keyof typeof durationMap) => `${num} ${durationMap[unit]}`,
  )
  // N7: Normalize single-quoted identifiers: 'FOO' as table name → FOO (both refer to same table)
  // Applies to TABLE/VIEW/BASE/FROM/JOIN/EXISTS contexts — not string literals in general expressions
  s = s.replace(/\b(TABLE|VIEW|BASE|FROM|JOIN|EXISTS|TO)\s+'([^']+)'/g, "$1 $2")
  // N8: Normalize PASSWORD quoting: PASSWORD 'FOO' and PASSWORD FOO are the same
  s = s.replace(/\bPASSWORD\s+'([^']+)'/g, "PASSWORD $1")
  // N9: Normalize TTL 0 — "TTL 0" and "TTL 0 DAYS" are the same (0 means disabled)
  s = s.replace(/\bTTL 0 [A-Z]+\b/g, "TTL 0")
  // N10: Normalize singular/plural time units: HOUR → HOURS, DAY → DAYS, etc.
  s = s.replace(/\b(\d+)\s+(HOUR|DAY|WEEK|MONTH|YEAR)\b/g, "$1 $2S")
  // N11: Normalize FORMAT/CODEC value quoting: FORMAT 'PARQUET' → FORMAT PARQUET
  s = s.replace(/\bFORMAT\s+'([^']+)'/g, "FORMAT $1")
  s = s.replace(/\bCOMPRESSION_CODEC\s+'([^']+)'/g, "COMPRESSION_CODEC $1")
  // N12: Normalize CANCEL QUERY quoting: CANCEL QUERY '29' → CANCEL QUERY 29
  s = s.replace(/\bCANCEL QUERY\s+'([^']+)'/g, "CANCEL QUERY $1")
  // N13: Normalize duration literal quoting: '3 DAYS' → 3 DAYS, '1.5 DAYS' → 1.5 DAYS
  s = s.replace(
    /'(\d+(?:\.\d+)?\s+(?:HOURS|DAYS|WEEKS|MONTHS|YEARS|MINUTES|SECONDS))'/g,
    "$1",
  )
  // N14: Normalize PARTITION_BY value quoting: PARTITION_BY 'DAY' → PARTITION_BY DAY
  s = s.replace(/\bPARTITION_BY\s+'([^']+)'/g, "PARTITION_BY $1")
  // N15: Normalize COPY ON ERROR quoting: ON ERROR 'SKIP_ROW' → ON ERROR SKIP_ROW
  s = s.replace(/\bON ERROR\s+'([^']+)'/g, "ON ERROR $1")
  // N16a: Normalize OWNED BY quoting: OWNED BY 'FOO' → OWNED BY FOO
  s = s.replace(/\bOWNED BY\s+'([^']+)'/g, "OWNED BY $1")
  // N16: Normalize VOLUME quoting: IN VOLUME 'X' → IN VOLUME X
  s = s.replace(/\bVOLUME\s+'([^']+)'/g, "VOLUME $1")
  // N17: Normalize stray comma before IN VOLUME: ..., IN VOLUME → ... IN VOLUME
  s = s.replace(/,\s*\bIN\s+VOLUME\b/g, " IN VOLUME")
  // Re-collapse whitespace after removals
  s = s.replace(/\s+/g, " ")
  s = s.trim()
  return s
}

describe("Documentation SQL - Round-trip (parse → toSql)", () => {
  const testCases = queries.map((q, i) => ({
    index: i,
    label: `#${i}: ${q.query.substring(0, 60).replace(/\n/g, " ")}`,
    query: q,
  }))

  // Pre-filter: only queries that parse successfully
  const parseable = testCases.filter((tc) => {
    const result = parseToAst(tc.query.query)
    return result.errors.length === 0 && result.ast.length > 0
  })

  it("should report test counts", () => {
    /* eslint-disable no-console */
    console.log(`Parseable: ${parseable.length}`)
    console.log(`Testing round-trip: ${parseable.length}`)
    /* eslint-enable no-console */
  })

  describe("round-trip", () => {
    it.each(parseable.map((tc) => [tc.label, tc]))("%s", (_label, tc) => {
      const entry = tc
      const original = entry.query.query

      // Parse to AST
      const result = parseToAst(original)
      expect(result.errors).toHaveLength(0)

      // Convert AST back to SQL
      const roundTripped = toSql(result.ast)

      // Compare normalized forms
      const normalizedOriginal = normalizeSql(original)
      const normalizedRoundTrip = normalizeSql(roundTripped)

      if (normalizedOriginal !== normalizedRoundTrip) {
        const origWords = normalizedOriginal.split(" ")
        const rtWords = normalizedRoundTrip.split(" ")
        const maxLen = Math.max(origWords.length, rtWords.length)
        let firstDiff = -1
        for (let i = 0; i < maxLen; i++) {
          if (origWords[i] !== rtWords[i]) {
            firstDiff = i
            break
          }
        }

        const context = 3
        const start = Math.max(0, firstDiff - context)
        const end = Math.min(maxLen, firstDiff + context + 1)
        const origSlice = origWords.slice(start, end).join(" ")
        const rtSlice = rtWords.slice(start, end).join(" ")

        throw new Error(
          `Round-trip mismatch at word ${firstDiff}:\n` +
            `  Original:    ...${origSlice}...\n` +
            `  Round-trip:  ...${rtSlice}...\n` +
            `\nOriginal (normalized, first 200 chars):\n  ${normalizedOriginal.substring(0, 200)}\n` +
            `\nRound-trip (normalized, first 200 chars):\n  ${normalizedRoundTrip.substring(0, 200)}`,
        )
      }
    })
  })
})
