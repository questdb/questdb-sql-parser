# @questdb/questdb-sql-parser

A production-ready SQL parser for [QuestDB](https://questdb.io/) syntax, built with [Chevrotain](https://chevrotain.io/). Parses SQL into a fully typed AST, converts AST back to SQL, and provides context-aware autocomplete — all in a single package.

## Features

- **Complete QuestDB SQL coverage** — 45 statement types including SELECT, INSERT, UPDATE, CREATE TABLE, ALTER TABLE, GRANT/REVOKE, COPY, PIVOT, and more
- **QuestDB-specific syntax** — `SAMPLE BY`, `LATEST ON`, `ASOF JOIN`, `LT JOIN`, `SPLICE JOIN`, `WINDOW JOIN`, implicit SELECT, duration literals, geohash types
- **Lossless round-trip** — parse SQL to AST and convert back with `toSql()`. Verified against 1,726 real-world queries from QuestDB documentation with full round-trip coverage
- **Context-aware autocomplete** — schema-driven suggestions for tables, columns, keywords, functions, and operators at any cursor position
- **Fully typed** — complete TypeScript type definitions for the entire AST
- **Single dependency** — only Chevrotain at runtime


## Quick Start

### Parse SQL to AST

```typescript
import { parseToAst } from "@questdb/questdb-sql-parser";

const result = parseToAst("SELECT * FROM trades WHERE symbol = 'BTC-USD'");

if (result.errors.length === 0) {
  console.log(result.ast[0]);
  // {
  //   type: "select",
  //   columns: [{ type: "star" }],
  //   from: [{ type: "tableRef", table: { type: "qualifiedName", parts: ["trades"] } }],
  //   where: {
  //     type: "binary", operator: "=",
  //     left: { type: "column", name: { type: "qualifiedName", parts: ["symbol"] } },
  //     right: { type: "literal", value: "BTC-USD", literalType: "string" }
  //   }
  // }
}
```

### Convert AST back to SQL

```typescript
import { parseToAst, toSql } from "@questdb/questdb-sql-parser";

const result = parseToAst("SELECT avg(price) FROM trades SAMPLE BY 1h FILL(PREV)");
const sql = toSql(result.ast);
// "SELECT avg(price) FROM trades SAMPLE BY 1h FILL(PREV)"
```

### Parse a single statement

```typescript
import { parseOne } from "@questdb/questdb-sql-parser";

const stmt = parseOne("INSERT INTO trades VALUES (now(), 'BTC', 42000.50)");
console.log(stmt.type); // "insert"
```

### Parse multiple statements

```typescript
import { parseStatements } from "@questdb/questdb-sql-parser";

const statements = parseStatements(`
  SELECT * FROM trades
  INSERT INTO logs VALUES (1)
  CREATE TABLE orders (id LONG, ts TIMESTAMP) TIMESTAMP(ts) PARTITION BY DAY WAL
`);

console.log(statements.length); // 3
```

### Autocomplete

```typescript
import { createAutocompleteProvider } from "@questdb/questdb-sql-parser";

const provider = createAutocompleteProvider({
  tables: [
    { name: "trades", designatedTimestamp: "ts" },
    { name: "orders" },
  ],
  columns: {
    trades: [
      { name: "ts", type: "TIMESTAMP" },
      { name: "symbol", type: "SYMBOL" },
      { name: "price", type: "DOUBLE" },
    ],
    orders: [
      { name: "id", type: "LONG" },
      { name: "created_at", type: "TIMESTAMP" },
    ],
  },
});

const suggestions = provider.getSuggestions("SELECT * FROM t", 16);
// [{ label: "trades", kind: "Table", insertText: "trades", ... }, ...]
```

## Supported Statements

| Category               | Statements                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Query**              | `SELECT`, implicit SELECT, `PIVOT`, `EXPLAIN`                                                                                              |
| **DML**                | `INSERT`, `INSERT ATOMIC`, `INSERT BATCH`, `UPDATE`                                                                                        |
| **DDL**                | `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `TRUNCATE TABLE`, `RENAME TABLE`                                                              |
| **Views**              | `CREATE VIEW`, `ALTER VIEW`, `DROP VIEW`, `COMPILE VIEW`                                                                                   |
| **Materialized Views** | `CREATE MATERIALIZED VIEW`, `ALTER MATERIALIZED VIEW`, `DROP MATERIALIZED VIEW`, `REFRESH MATERIALIZED VIEW`                               |
| **Access Control**     | `CREATE/ALTER/DROP USER`, `CREATE/ALTER/DROP GROUP`, `CREATE/ALTER/DROP SERVICE ACCOUNT`, `ADD/REMOVE USER`, `ASSUME/EXIT SERVICE ACCOUNT` |
| **Permissions**        | `GRANT`, `REVOKE`, `GRANT/REVOKE ASSUME SERVICE ACCOUNT`                                                                                   |
| **Operations**         | `COPY FROM/TO`, `BACKUP`, `VACUUM TABLE`, `REINDEX TABLE`, `CANCEL QUERY`, `CHECKPOINT`, `SNAPSHOT`                                        |
| **WAL**                | `RESUME WAL`, `SET TYPE WAL`                                                                                                               |
| **Introspection**      | `SHOW TABLES/COLUMNS/PARTITIONS/CREATE TABLE/PARAMETERS/...`                                                                               |

## QuestDB-Specific Syntax

The parser handles QuestDB extensions that standard SQL parsers don't support:

```sql
-- Time-series sampling
SELECT avg(price) FROM trades SAMPLE BY 1h FILL(PREV) ALIGN TO CALENDAR

-- Latest value per partition
SELECT * FROM trades LATEST ON ts PARTITION BY symbol

-- Time-ordered joins
SELECT * FROM trades ASOF JOIN quotes ON (symbol)
SELECT * FROM trades LT JOIN quotes ON (symbol) TOLERANCE 5s
SELECT * FROM a WINDOW JOIN b ON a.ts = b.ts
  RANGE BETWEEN 1h PRECEDING AND CURRENT ROW FOLLOWING

-- Implicit SELECT (table name without SELECT * FROM)
trades WHERE symbol = 'BTC-USD'

-- Duration literals
SELECT * FROM trades WHERE ts > now() - 2d

-- Geohash literals and types
CREATE TABLE geo (pos GEOHASH(8c), area GEOHASH(4b))

-- Array subscripts and slices
SELECT arr[2:], data[1:3] FROM t

-- WAL tables with deduplication and TTL
CREATE TABLE trades (ts TIMESTAMP, price DOUBLE)
  TIMESTAMP(ts) PARTITION BY DAY WAL
  DEDUP UPSERT KEYS(ts)
  TTL 30 DAYS
```

## Architecture

```
SQL String
    |
    v
 Lexer (tokenize)
    |
    v
 Tokens
    |
    v
 Parser (Chevrotain CstParser)
    |
    v
 Concrete Syntax Tree (CST)
    |
    v
 Visitor (CST -> AST)
    |
    v
 AST  -----> toSql() -----> SQL String
```

The parser uses Chevrotain's [CST pattern](https://chevrotain.io/docs/guide/concrete_syntax_tree.html): the parser produces a lossless CST, then a visitor transforms it into a clean, typed AST. The `toSql()` function serializes any AST back to valid SQL.

## API Reference

### High-Level API

| Function               | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `parseToAst(sql)`      | Parse SQL string into `{ ast: Statement[], errors: Error[] }`     |
| `parseOne(sql)`        | Parse a single statement, throws on errors or multiple statements |
| `parseStatements(sql)` | Parse multiple statements, throws on errors                       |
| `toSql(ast)`           | Convert `Statement[]` back to a SQL string                        |

### Low-Level API

| Function        | Description                                               |
| --------------- | --------------------------------------------------------- |
| `tokenize(sql)` | Tokenize SQL into Chevrotain tokens                       |
| `parse(sql)`    | Parse SQL to CST with lex/parse errors                    |
| `visitor`       | Chevrotain CST visitor instance for CST-to-AST conversion |

### Autocomplete API

| Function                             | Description                                                  |
| ------------------------------------ | ------------------------------------------------------------ |
| `createAutocompleteProvider(schema)` | Create a provider with `getSuggestions(query, cursorOffset)` |
| `getContentAssist(sql, offset)`      | Low-level: get valid tokens at cursor position               |

### Grammar Exports

Arrays of keywords, functions, data types, operators, and constants for syntax highlighting integration:

```typescript
import { keywords, functions, dataTypes, operators, constants } from "@questdb/questdb-sql-parser/grammar";
```

## Development

```bash
yarn              # Install dependencies
yarn build        # Compile TypeScript
yarn test         # Run all tests
yarn test:watch   # Run tests in watch mode
```

## License

Apache-2.0
