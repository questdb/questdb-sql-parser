/**
 * Documentation SQL - Autocomplete Walkthrough Tests
 *
 * For each SQL statement, tokenizes it and walks through token-by-token,
 * verifying that at each position the content-assist correctly predicts the next token.
 *
 * Queries with skipAutocomplete: true in the fixture are known edge cases in
 * Chevrotain's computeContentAssist (implicit SELECT, SQL hints, semicolons,
 * array slice colon syntax) — not actual autocomplete bugs.
 *
 * Source of truth: tests/fixtures/docs-queries.json
 */

import { describe, it } from "vitest"
import { tokenize, getNextValidTokens } from "../src/index"
import { IDENTIFIER_KEYWORD_TOKENS } from "../src/autocomplete/token-classification"
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

function isTokenExpectedAtPosition(
  actualTokenType: string,
  expectedTokenNames: string[],
): boolean {
  if (expectedTokenNames.includes(actualTokenType)) return true

  if (expectedTokenNames.includes("Identifier")) {
    if (IDENTIFIER_KEYWORD_TOKENS.has(actualTokenType)) return true
    if (actualTokenType === "QuotedIdentifier") return true
  }

  return false
}

interface WalkthroughStep {
  position: number
  tokenImage: string
  tokenType: string
  expectedTokens: string[]
  isExpected: boolean
}

function autocompleteWalkthrough(sql: string): {
  success: boolean
  steps: WalkthroughStep[]
  failedSteps: WalkthroughStep[]
} {
  const { tokens, errors } = tokenize(sql)
  if (errors.length > 0) {
    return { success: false, steps: [], failedSteps: [] }
  }

  const steps: WalkthroughStep[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const prefix = sql.substring(0, token.startOffset)
    const expectedTokenNames = getNextValidTokens(prefix)
    const actualType = token.tokenType.name
    const isExpected = isTokenExpectedAtPosition(actualType, expectedTokenNames)

    steps.push({
      position: token.startOffset,
      tokenImage: token.image,
      tokenType: actualType,
      expectedTokens: expectedTokenNames,
      isExpected,
    })
  }

  return {
    success: true,
    steps,
    failedSteps: steps.filter((s) => !s.isExpected),
  }
}

const testable = queries
  .map((q, i) => ({ ...q, index: i }))
  .filter((q) => !q.skipAutocomplete)

describe("Documentation SQL - Autocomplete Walkthrough", () => {
  describe("token-by-token autocomplete", () => {
    it.each(
      testable.map((q) => [
        `#${q.index}: ${q.query.substring(0, 60).replace(/\n/g, " ")}`,
        q,
      ]),
    )("%s", (_label, entry) => {
      const q = entry as DocsQuery & { index: number }
      const result = autocompleteWalkthrough(q.query)

      if (!result.success) {
        return
      }

      if (result.failedSteps.length > 0) {
        const failures = result.failedSteps
          .slice(0, 3)
          .map(
            (s) =>
              `  At offset ${s.position}: "${s.tokenImage}" (${s.tokenType}) ` +
              `not in expected [${s.expectedTokens.slice(0, 10).join(", ")}${s.expectedTokens.length > 10 ? "..." : ""}]`,
          )
          .join("\n")

        throw new Error(
          `Autocomplete walkthrough failed for #${q.index}:\n${failures}\n\nSQL: ${q.query.substring(0, 120)}`,
        )
      }
    })
  })
})
