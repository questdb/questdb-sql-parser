import { tokenize } from "../src/parser/lexer"

describe("QuestDB Lexer", () => {
  it("should tokenize a simple SELECT statement", () => {
    const result = tokenize("SELECT * FROM trades")

    expect(result.errors).toHaveLength(0)
    expect(result.tokens).toHaveLength(4)
    expect(result.tokens[0].tokenType.name).toBe("Select")
    expect(result.tokens[1].tokenType.name).toBe("Star")
    expect(result.tokens[2].tokenType.name).toBe("From")
    expect(result.tokens[3].tokenType.name).toBe("Identifier")
  })

  it("should tokenize QuestDB SAMPLE BY clause", () => {
    const result = tokenize("SELECT avg(price) FROM trades SAMPLE BY 1h")

    expect(result.errors).toHaveLength(0)
    const tokenNames = result.tokens.map((t) => t.tokenType.name)
    expect(tokenNames).toContain("Sample")
    expect(tokenNames).toContain("By")
    expect(tokenNames).toContain("DurationLiteral")
  })

  it("should tokenize QuestDB LATEST ON clause", () => {
    const result = tokenize(
      "SELECT * FROM trades LATEST ON timestamp PARTITION BY symbol",
    )

    expect(result.errors).toHaveLength(0)
    const tokenNames = result.tokens.map((t) => t.tokenType.name)
    expect(tokenNames).toContain("Latest")
    expect(tokenNames).toContain("On")
    expect(tokenNames).toContain("Partition")
    expect(tokenNames).toContain("By")
  })

  it("should tokenize QuestDB ASOF JOIN", () => {
    const result = tokenize("SELECT * FROM trades ASOF JOIN quotes ON symbol")

    expect(result.errors).toHaveLength(0)
    const tokenNames = result.tokens.map((t) => t.tokenType.name)
    expect(tokenNames).toContain("Asof")
    expect(tokenNames).toContain("Join")
  })

  it("should tokenize string literals", () => {
    const result = tokenize("SELECT * FROM trades WHERE symbol = 'BTC-USD'")

    expect(result.errors).toHaveLength(0)
    const stringToken = result.tokens.find(
      (t) => t.tokenType.name === "StringLiteral",
    )
    expect(stringToken).toBeDefined()
    expect(stringToken?.image).toBe("'BTC-USD'")
  })

  it("should tokenize number literals", () => {
    const result = tokenize("SELECT * FROM trades WHERE price > 100.50")

    expect(result.errors).toHaveLength(0)
    const numberToken = result.tokens.find(
      (t) => t.tokenType.name === "NumberLiteral",
    )
    expect(numberToken).toBeDefined()
    expect(numberToken?.image).toBe("100.50")
  })

  it("should handle case-insensitive keywords", () => {
    const result1 = tokenize("SELECT * FROM trades")
    const result2 = tokenize("select * from trades")
    const result3 = tokenize("SeLeCt * FrOm trades")

    expect(result1.tokens[0].tokenType.name).toBe("Select")
    expect(result2.tokens[0].tokenType.name).toBe("Select")
    expect(result3.tokens[0].tokenType.name).toBe("Select")
  })

  it("should skip whitespace and comments", () => {
    const result = tokenize(`
      -- This is a comment
      SELECT * FROM trades /* block comment */ WHERE symbol = 'BTC'
    `)

    expect(result.errors).toHaveLength(0)
    // Comments and whitespace should be skipped
    expect(result.tokens[0].tokenType.name).toBe("Select")
  })

  it("should tokenize quoted identifiers", () => {
    const result = tokenize('SELECT "column-name" FROM "my-table"')

    expect(result.errors).toHaveLength(0)
    const quotedTokens = result.tokens.filter(
      (t) => t.tokenType.name === "QuotedIdentifier",
    )
    expect(quotedTokens).toHaveLength(2)
  })

  it("should tokenize quoted identifier with escaped double quotes as single token", () => {
    const result = tokenize('SELECT "my""col" FROM t')
    expect(result.errors).toHaveLength(0)
    const identTokens = result.tokens.filter(
      (t) => t.tokenType.name === "QuotedIdentifier",
    )
    expect(identTokens).toHaveLength(1)
    expect(identTokens[0].image).toBe('"my""col"')
  })

  it("should tokenize multiple escaped quotes in identifier", () => {
    const result = tokenize('SELECT """triple""" FROM t')
    expect(result.errors).toHaveLength(0)
    const identTokens = result.tokens.filter(
      (t) => t.tokenType.name === "QuotedIdentifier",
    )
    expect(identTokens).toHaveLength(1)
  })

  it("should tokenize duration literals for SAMPLE BY", () => {
    const durations = ["1s", "5m", "1h", "1d", "1M", "1y"]

    for (const duration of durations) {
      const result = tokenize(`SAMPLE BY ${duration}`)
      expect(result.errors).toHaveLength(0)
      const durationToken = result.tokens.find(
        (t) => t.tokenType.name === "DurationLiteral",
      )
      expect(durationToken).toBeDefined()
      expect(durationToken?.image).toBe(duration)
    }
  })

  // BUG: NumberLiteral regex /(\d[\d_]*\.?[\d_]*|...)/ consumes trailing dot.
  // "1." is tokenized as a single NumberLiteral, not "1" + Dot.
  // This means incomplete input like "SELECT 1." (user about to type a column ref)
  // has the dot consumed into the number.
  it("should consume trailing dot into NumberLiteral", () => {
    const result = tokenize("1.")
    const tokens = result.tokens.filter(
      (t) => t.tokenType.name !== "WhiteSpace",
    )
    expect(tokens).toHaveLength(1)
    expect(tokens[0].tokenType.name).toBe("NumberLiteral")
    expect(tokens[0].image).toBe("1.")
  })
})
