// =============================================================================
// AST to SQL Serializer
// =============================================================================

import * as AST from "./ast"

export function toSql(node: AST.Statement | AST.Statement[]): string {
  if (Array.isArray(node)) {
    return node.map((s) => statementToSql(s)).join(";\n")
  }
  return statementToSql(node)
}

function statementToSql(stmt: AST.Statement): string {
  switch (stmt.type) {
    case "select":
      return selectToSql(stmt)
    case "insert":
      return insertToSql(stmt)
    case "update":
      return updateToSql(stmt)
    case "createTable":
      return createTableToSql(stmt)
    case "createView":
      return createViewToSql(stmt)
    case "alterTable":
      return alterTableToSql(stmt)
    case "alterView":
      return alterViewToSql(stmt)
    case "dropTable":
      return dropTableToSql(stmt)
    case "dropView":
      return dropViewToSql(stmt)
    case "truncateTable":
      return truncateTableToSql(stmt)
    case "renameTable":
      return renameTableToSql(stmt)
    case "show":
      return showToSql(stmt)
    case "explain":
      return explainToSql(stmt)
    case "pivot":
      return pivotToSql(stmt)
    case "createMaterializedView":
      return createMaterializedViewToSql(stmt)
    case "alterMaterializedView":
      return alterMaterializedViewToSql(stmt)
    case "dropMaterializedView":
      return dropMaterializedViewToSql(stmt)
    case "refreshMaterializedView":
      return refreshMaterializedViewToSql(stmt)
    // DeclareStatement removed - DECLARE is now a clause within SelectStatement
    case "createUser":
      return createUserToSql(stmt)
    case "createGroup":
      return createGroupToSql(stmt)
    case "createServiceAccount":
      return createServiceAccountToSql(stmt)
    case "alterUser":
      return alterUserToSql(stmt)
    case "alterServiceAccount":
      return alterServiceAccountToSql(stmt)
    case "dropUser":
      return dropUserToSql(stmt)
    case "dropGroup":
      return dropGroupToSql(stmt)
    case "dropServiceAccount":
      return dropServiceAccountToSql(stmt)
    case "addUser":
      return addUserToSql(stmt)
    case "removeUser":
      return removeUserToSql(stmt)
    case "assumeServiceAccount":
      return `ASSUME SERVICE ACCOUNT ${qualifiedNameToSql(stmt.account)}`
    case "exitServiceAccount":
      return `EXIT SERVICE ACCOUNT ${qualifiedNameToSql(stmt.account)}`
    case "grant":
      return grantToSql(stmt)
    case "revoke":
      return revokeToSql(stmt)
    case "grantAssumeServiceAccount":
      return grantAssumeToSql(stmt)
    case "revokeAssumeServiceAccount":
      return revokeAssumeToSql(stmt)
    case "cancelQuery":
      return `CANCEL QUERY ${escapeString(stmt.queryId)}`
    case "checkpoint":
      return `CHECKPOINT ${stmt.action === "create" ? "CREATE" : "RELEASE"}`
    case "snapshot":
      return `SNAPSHOT ${stmt.action === "prepare" ? "PREPARE" : "COMPLETE"}`
    case "vacuumTable":
      return vacuumTableToSql(stmt)
    case "resumeWal":
      return resumeWalToSql(stmt)
    case "setType":
      return setTypeToSql(stmt)
    case "reindexTable":
      return reindexTableToSql(stmt)
    case "copyCancel":
      return `COPY ${escapeString(stmt.id)} CANCEL`
    case "copyFrom":
      return copyFromToSql(stmt)
    case "copyTo":
      return copyToToSql(stmt)
    case "backup":
      return backupToSql(stmt)
    case "alterGroup":
      return alterGroupToSql(stmt)
    case "compileView":
      return `COMPILE VIEW ${qualifiedNameToSql(stmt.view)}`
    default:
      throw new Error(
        `Unknown statement type: ${(stmt as { type: string }).type}`,
      )
  }
}

// =============================================================================
// SELECT
// =============================================================================

function selectToSql(stmt: AST.SelectStatement): string {
  const parts: string[] = []

  // DECLARE clause
  if (stmt.declare) {
    parts.push(declareClauseToSql(stmt.declare))
  }

  // WITH clause (CTEs)
  if (stmt.with && stmt.with.length > 0) {
    parts.push("WITH")
    const ctes = stmt.with.map(
      (cte) => `${escapeIdentifier(cte.name)} AS (${selectToSql(cte.query)})`,
    )
    parts.push(ctes.join(", "))
  }

  // Implicit SELECT: emit only the FROM table and clauses, no SELECT * FROM
  if (stmt.implicit && stmt.from && stmt.from.length > 0) {
    parts.push(stmt.from.map(tableRefToSql).join(", "))
  } else {
    parts.push("SELECT")

    if (stmt.distinct) {
      parts.push("DISTINCT")
    }

    // Columns
    parts.push(selectListToSql(stmt.columns))

    // FROM
    if (stmt.from && stmt.from.length > 0) {
      parts.push("FROM")
      parts.push(stmt.from.map(tableRefToSql).join(", "))
    }
  }

  // WHERE
  if (stmt.where) {
    parts.push("WHERE")
    parts.push(expressionToSql(stmt.where))
  }

  // SAMPLE BY (QuestDB)
  if (stmt.sampleBy) {
    parts.push("SAMPLE BY")
    parts.push(stmt.sampleBy.duration)
    // FROM/TO (must come before FILL and ALIGN TO per Java order)
    if (stmt.sampleBy.from) {
      parts.push("FROM")
      parts.push(expressionToSql(stmt.sampleBy.from))
    }
    if (stmt.sampleBy.to) {
      parts.push("TO")
      parts.push(expressionToSql(stmt.sampleBy.to))
    }
    // FILL
    if (stmt.sampleBy.fill && stmt.sampleBy.fill.length > 0) {
      parts.push(`FILL(${stmt.sampleBy.fill.join(", ")})`)
    }
    // ALIGN TO
    if (stmt.sampleBy.alignTo) {
      parts.push("ALIGN TO")
      if (stmt.sampleBy.alignTo.mode === "firstObservation") {
        parts.push("FIRST OBSERVATION")
      } else {
        parts.push("CALENDAR")
        if (stmt.sampleBy.alignTo.timeZone) {
          parts.push("TIME ZONE")
          parts.push(escapeString(stmt.sampleBy.alignTo.timeZone))
        }
        if (stmt.sampleBy.alignTo.offset) {
          parts.push("WITH OFFSET")
          parts.push(escapeString(stmt.sampleBy.alignTo.offset))
        }
      }
    }
  }

  // LATEST ON / LATEST BY (QuestDB)
  if (stmt.latestOn) {
    if (stmt.latestOn.timestamp) {
      parts.push("LATEST ON")
      parts.push(qualifiedNameToSql(stmt.latestOn.timestamp))
      parts.push("PARTITION BY")
      parts.push(stmt.latestOn.partitionBy.map(qualifiedNameToSql).join(", "))
    } else {
      parts.push("LATEST BY")
      parts.push(stmt.latestOn.partitionBy.map(qualifiedNameToSql).join(", "))
    }
  }

  // GROUP BY
  if (stmt.groupBy && stmt.groupBy.length > 0) {
    parts.push("GROUP BY")
    parts.push(stmt.groupBy.map(expressionToSql).join(", "))
  }

  // PIVOT (inline pivot clause in SELECT)
  if (stmt.pivot) {
    parts.push(pivotClauseToSql(stmt.pivot))
  }

  // ORDER BY
  if (stmt.orderBy && stmt.orderBy.length > 0) {
    parts.push("ORDER BY")
    parts.push(stmt.orderBy.map(orderByItemToSql).join(", "))
  }

  // LIMIT
  if (stmt.limit) {
    parts.push("LIMIT")
    if (stmt.limit.offset) {
      parts.push(`${expressionToSql(stmt.limit.count)},`)
      parts.push(expressionToSql(stmt.limit.offset))
    } else {
      parts.push(expressionToSql(stmt.limit.count))
    }
  }

  // Set operations (UNION, EXCEPT, INTERSECT)
  if (stmt.setOperations && stmt.setOperations.length > 0) {
    for (const op of stmt.setOperations) {
      parts.push(op.operator)
      if (op.all) {
        parts.push("ALL")
      }
      parts.push(selectToSql(op.select))
    }
  }

  return parts.join(" ")
}

function selectListToSql(items: AST.SelectItem[]): string {
  return items
    .map((item) => {
      if (item.type === "star") {
        return "*"
      }
      if (item.type === "qualifiedStar") {
        let sql = `${qualifiedNameToSql(item.qualifier)}.*`
        if (item.alias) {
          sql += ` AS ${escapeIdentifier(item.alias)}`
        }
        return sql
      }
      const selectItem = item
      let sql = expressionToSql(selectItem.expression)
      if (selectItem.alias) {
        sql += ` AS ${escapeIdentifier(selectItem.alias)}`
      }
      return sql
    })
    .join(", ")
}

function tableFunctionCallToSql(fn: AST.TableFunctionCall): string {
  const args = fn.args.map((a) => expressionToSql(a)).join(", ")
  return `${fn.name}(${args})`
}

function tableRefToSql(ref: AST.TableRef): string {
  let sql: string

  if (!ref.table) {
    sql = ""
  } else if ("type" in ref.table && ref.table.type === "select") {
    sql = `(${selectToSql(ref.table)})`
  } else if ("type" in ref.table && ref.table.type === "tableFunctionCall") {
    sql = tableFunctionCallToSql(ref.table)
  } else if ("type" in ref.table && ref.table.type === "show") {
    sql = `(${showToSql(ref.table)})`
  } else {
    sql = qualifiedNameToSql(ref.table)
  }

  if (ref.timestampDesignation) {
    sql += ` TIMESTAMP(${escapeIdentifier(ref.timestampDesignation)})`
  }

  if (ref.alias) {
    sql += ` AS ${escapeIdentifier(ref.alias)}`
  }

  if (ref.joins) {
    for (const join of ref.joins) {
      sql += " " + joinToSql(join)
    }
  }

  return sql
}

function joinToSql(join: AST.JoinClause): string {
  const parts: string[] = []

  if (join.joinType) {
    parts.push(join.joinType.toUpperCase())
  }

  if (join.outer) {
    parts.push("OUTER")
  }

  parts.push("JOIN")
  parts.push(tableRefToSql(join.table))

  if (join.on) {
    parts.push("ON")
    parts.push(expressionToSql(join.on))
  }

  if (join.tolerance) {
    parts.push("TOLERANCE")
    parts.push(join.tolerance)
  }

  if (join.range) {
    parts.push("RANGE BETWEEN")
    parts.push(windowJoinBoundToSql(join.range.start))
    parts.push("AND")
    parts.push(windowJoinBoundToSql(join.range.end))
  }

  if (join.prevailing) {
    parts.push(
      join.prevailing === "include"
        ? "INCLUDE PREVAILING"
        : "EXCLUDE PREVAILING",
    )
  }

  return parts.join(" ")
}

function windowJoinBoundToSql(bound: AST.WindowJoinBound): string {
  if (bound.boundType === "currentRow") {
    if (bound.direction) {
      return `CURRENT ROW ${bound.direction.toUpperCase()}`
    }
    return "CURRENT ROW"
  }
  return `${bound.duration} ${bound.direction!.toUpperCase()}`
}

function orderByItemToSql(item: AST.OrderByItem): string {
  let sql = expressionToSql(item.expression)
  if (item.direction) {
    sql += ` ${item.direction.toUpperCase()}`
  }
  return sql
}

// =============================================================================
// INSERT
// =============================================================================

function insertToSql(stmt: AST.InsertStatement): string {
  const parts: string[] = []

  // WITH clause (CTEs)
  if (stmt.with && stmt.with.length > 0) {
    parts.push("WITH")
    const ctes = stmt.with.map(
      (cte) => `${escapeIdentifier(cte.name)} AS (${selectToSql(cte.query)})`,
    )
    parts.push(ctes.join(", "))
  }

  if (stmt.atomic) {
    parts.push("INSERT ATOMIC INTO")
  } else if (stmt.batch) {
    let batchClause = `INSERT BATCH ${stmt.batch.size}`
    if (stmt.batch.o3MaxLag) {
      batchClause += ` o3MaxLag ${stmt.batch.o3MaxLag}`
    }
    parts.push(batchClause)
    parts.push("INTO")
  } else {
    parts.push("INSERT INTO")
  }

  parts.push(qualifiedNameToSql(stmt.table))

  if (stmt.columns && stmt.columns.length > 0) {
    parts.push(`(${stmt.columns.map(escapeIdentifier).join(", ")})`)
  }

  if (stmt.values) {
    parts.push("VALUES")
    const valueRows = stmt.values.map(
      (row) => `(${row.map(expressionToSql).join(", ")})`,
    )
    parts.push(valueRows.join(", "))
  }

  if (stmt.select) {
    parts.push(selectToSql(stmt.select))
  }

  return parts.join(" ")
}

// =============================================================================
// UPDATE
// =============================================================================

function updateToSql(stmt: AST.UpdateStatement): string {
  const parts: string[] = []
  if (stmt.with && stmt.with.length > 0) {
    parts.push("WITH")
    const ctes = stmt.with.map(
      (cte) => `${escapeIdentifier(cte.name)} AS (${selectToSql(cte.query)})`,
    )
    parts.push(ctes.join(", "))
  }
  parts.push("UPDATE")
  parts.push(qualifiedNameToSql(stmt.table))
  if (stmt.alias) parts.push(escapeIdentifier(stmt.alias))
  parts.push("SET")

  const setClauses = stmt.set.map(
    (s) => `${escapeIdentifier(s.column)} = ${expressionToSql(s.value)}`,
  )
  parts.push(setClauses.join(", "))

  if (stmt.from) {
    parts.push("FROM")
    parts.push(tableRefToSql(stmt.from))
  }
  if (stmt.joins) {
    for (const join of stmt.joins) {
      parts.push(joinToSql(join))
    }
  }

  if (stmt.where) {
    parts.push("WHERE")
    parts.push(expressionToSql(stmt.where))
  }

  return parts.join(" ")
}

// =============================================================================
// CREATE TABLE
// =============================================================================

function columnDefToSql(c: AST.ColumnDefinition): string {
  let sql = `${escapeIdentifier(c.name)} ${c.dataType}`
  if (c.symbolCapacity != null) {
    sql += ` CAPACITY ${c.symbolCapacity}`
  }
  if (c.cache === true) {
    sql += " CACHE"
  } else if (c.cache === false) {
    sql += " NOCACHE"
  }
  if (c.indexed) {
    sql += " INDEX"
    if (c.indexCapacity != null) {
      sql += ` CAPACITY ${c.indexCapacity}`
    }
  }
  return sql
}

function createTableToSql(stmt: AST.CreateTableStatement): string {
  const parts: string[] = ["CREATE"]

  if (stmt.atomic) {
    parts.push("ATOMIC")
  } else if (stmt.batch) {
    parts.push(`BATCH ${stmt.batch.size}`)
    if (stmt.batch.o3MaxLag) {
      parts.push(`o3MaxLag ${stmt.batch.o3MaxLag}`)
    }
  }

  parts.push("TABLE")

  if (stmt.ifNotExists) {
    parts.push("IF NOT EXISTS")
  }

  parts.push(qualifiedNameToSql(stmt.table))

  if (stmt.like) {
    parts.push(`(LIKE ${qualifiedNameToSql(stmt.like)})`)
  } else if (stmt.asSelect) {
    let asSql = `AS (${selectToSql(stmt.asSelect)})`
    if (stmt.casts && stmt.casts.length > 0) {
      for (const cast of stmt.casts) {
        asSql += `, CAST(${qualifiedNameToSql(cast.column)} AS ${cast.dataType})`
      }
    }
    if (stmt.indexes && stmt.indexes.length > 0) {
      for (const idx of stmt.indexes) {
        asSql += `, INDEX(${qualifiedNameToSql(idx.column)}`
        if (idx.capacity != null) {
          asSql += ` CAPACITY ${idx.capacity}`
        }
        asSql += ")"
      }
    }
    parts.push(asSql)
  } else if (stmt.columns) {
    let colSql = `(${stmt.columns.map(columnDefToSql).join(", ")})`
    if (stmt.indexes && stmt.indexes.length > 0) {
      for (const idx of stmt.indexes) {
        colSql += `, INDEX(${qualifiedNameToSql(idx.column)}`
        if (idx.capacity != null) {
          colSql += ` CAPACITY ${idx.capacity}`
        }
        colSql += ")"
      }
    }
    parts.push(colSql)
  }

  if (stmt.timestamp) {
    parts.push(`TIMESTAMP(${escapeIdentifier(stmt.timestamp)})`)
  }

  if (stmt.partitionBy) {
    parts.push(`PARTITION BY ${stmt.partitionBy}`)
  }

  if (stmt.ttl) {
    parts.push(`TTL ${stmt.ttl.value} ${stmt.ttl.unit}`)
  }

  if (stmt.bypassWal) {
    parts.push("BYPASS WAL")
  } else if (stmt.wal) {
    parts.push("WAL")
  }

  if (stmt.withParams && stmt.withParams.length > 0) {
    const paramParts = stmt.withParams.map((p) => {
      if (p.value) {
        return `${p.name} = ${expressionToSql(p.value)}`
      }
      return p.name
    })
    parts.push(`WITH ${paramParts.join(", ")}`)
  }

  if (stmt.volume) {
    parts.push(`IN VOLUME ${escapeString(stmt.volume)}`)
  }

  if (stmt.dedupKeys && stmt.dedupKeys.length > 0) {
    parts.push(
      `DEDUP UPSERT KEYS(${stmt.dedupKeys.map(escapeIdentifier).join(", ")})`,
    )
  }

  if (stmt.ownedBy) {
    parts.push(`OWNED BY ${escapeIdentifier(stmt.ownedBy)}`)
  }

  return parts.join(" ")
}

// =============================================================================
// CREATE/ALTER/DROP VIEW
// =============================================================================

function createViewToSql(stmt: AST.CreateViewStatement): string {
  const parts: string[] = ["CREATE"]
  if (stmt.orReplace) {
    parts.push("OR REPLACE")
  }
  parts.push("VIEW")
  if (stmt.ifNotExists) {
    parts.push("IF NOT EXISTS")
  }
  parts.push(qualifiedNameToSql(stmt.view))
  if (stmt.asParens) {
    parts.push(`AS (${selectToSql(stmt.query)})`)
  } else {
    parts.push(`AS ${selectToSql(stmt.query)}`)
  }
  if (stmt.ownedBy) parts.push(`OWNED BY ${escapeIdentifier(stmt.ownedBy)}`)
  return parts.join(" ")
}

function alterViewToSql(stmt: AST.AlterViewStatement): string {
  return `ALTER VIEW ${qualifiedNameToSql(stmt.view)} AS (${selectToSql(stmt.query)})`
}

function dropViewToSql(stmt: AST.DropViewStatement): string {
  const parts: string[] = ["DROP VIEW"]
  if (stmt.ifExists) {
    parts.push("IF EXISTS")
  }
  parts.push(qualifiedNameToSql(stmt.view))
  return parts.join(" ")
}

// =============================================================================
// ALTER TABLE
// =============================================================================

function alterTableToSql(stmt: AST.AlterTableStatement): string {
  const parts: string[] = ["ALTER TABLE", qualifiedNameToSql(stmt.table)]

  const action = stmt.action
  switch (action.actionType) {
    case "addColumn": {
      parts.push("ADD COLUMN")
      if (action.ifNotExists) {
        parts.push("IF NOT EXISTS")
      }
      parts.push(action.columns.map(columnDefToSql).join(", "))
      break
    }
    case "dropColumn":
      parts.push("DROP COLUMN")
      parts.push(action.columns.map(escapeIdentifier).join(", "))
      break
    case "renameColumn":
      parts.push("RENAME COLUMN")
      parts.push(escapeIdentifier(action.oldName))
      parts.push("TO")
      parts.push(escapeIdentifier(action.newName))
      break
    case "alterColumn":
      parts.push("ALTER COLUMN")
      parts.push(escapeIdentifier(action.column))
      if (action.alterType === "type" && action.newType) {
        parts.push("TYPE")
        parts.push(action.newType)
        if (action.capacity !== undefined) {
          parts.push("CAPACITY")
          parts.push(String(action.capacity))
        }
        if (action.cache === true) {
          parts.push("CACHE")
        } else if (action.cache === false) {
          parts.push("NOCACHE")
        }
      } else if (action.alterType === "addIndex") {
        parts.push("ADD INDEX")
      } else if (action.alterType === "dropIndex") {
        parts.push("DROP INDEX")
      } else if (
        action.alterType === "symbolCapacity" &&
        action.capacity !== undefined
      ) {
        parts.push("SYMBOL CAPACITY")
        parts.push(String(action.capacity))
      } else if (action.alterType === "cache") {
        parts.push("CACHE")
      } else if (action.alterType === "nocache") {
        parts.push("NOCACHE")
      }
      break
    case "dropPartition":
      parts.push("DROP PARTITION")
      if (action.partitions && action.partitions.length > 0) {
        parts.push("LIST")
        parts.push(action.partitions.map((p: string) => escapeString(p)).join(", "))
      } else if (action.where) {
        parts.push("WHERE")
        parts.push(expressionToSql(action.where))
      }
      break
    case "attachPartition":
      parts.push("ATTACH PARTITION")
      if (action.partitions && action.partitions.length > 0) {
        parts.push("LIST")
        parts.push(action.partitions.map((p: string) => escapeString(p)).join(", "))
      }
      break
    case "detachPartition":
      parts.push("DETACH PARTITION")
      if (action.partitions && action.partitions.length > 0) {
        parts.push("LIST")
        parts.push(action.partitions.map((p) => escapeString(p)).join(", "))
      } else if (action.where) {
        parts.push("WHERE")
        parts.push(expressionToSql(action.where))
      }
      break
    case "squashPartitions":
      parts.push("SQUASH PARTITIONS")
      break
    case "setParam":
      parts.push("SET PARAM")
      parts.push(
        action.params
          .map((param) =>
            param.value
              ? `${param.name} = ${expressionToSql(param.value)}`
              : param.name,
          )
          .join(", "),
      )
      break
    case "setTtl":
      parts.push("SET TTL")
      parts.push(`${action.ttl.value} ${action.ttl.unit}`)
      break
    case "dedupDisable":
      parts.push("DEDUP DISABLE")
      break
    case "dedupEnable":
      parts.push("DEDUP ENABLE UPSERT KEYS")
      parts.push(`(${action.keys.map(escapeIdentifier).join(", ")})`)
      break
    case "setTypeWal":
      parts.push("SET TYPE")
      if (action.bypass) parts.push("BYPASS")
      parts.push("WAL")
      break
    case "suspendWal": {
      parts.push("SUSPEND WAL")
      if (action.code || action.message) {
        const withParts: string[] = []
        if (action.code) withParts.push(action.code)
        if (action.message) withParts.push(escapeString(action.message))
        parts.push(`WITH ${withParts.join(", ")}`)
      }
      break
    }
    case "resumeWal": {
      parts.push("RESUME WAL")
      if (action.fromTxn !== undefined) {
        parts.push(`FROM TXN ${action.fromTxn}`)
      } else if (action.fromTransaction !== undefined) {
        parts.push(`FROM TRANSACTION ${action.fromTransaction}`)
      }
      break
    }
    case "convertPartition": {
      parts.push("CONVERT PARTITION")
      if (action.partitions && action.partitions.length > 0) {
        parts.push("LIST")
        parts.push(action.partitions.map((p: string) => escapeString(p)).join(", "))
      }
      parts.push("TO")
      parts.push(action.target)
      if (action.where) {
        parts.push("WHERE")
        parts.push(expressionToSql(action.where))
      }
      break
    }
  }

  return parts.join(" ")
}

// =============================================================================
// DROP TABLE
// =============================================================================

function dropTableToSql(stmt: AST.DropTableStatement): string {
  if (stmt.allTables) {
    return "DROP ALL TABLES"
  }

  const parts: string[] = ["DROP TABLE"]

  if (stmt.ifExists) {
    parts.push("IF EXISTS")
  }

  if (stmt.table) {
    parts.push(qualifiedNameToSql(stmt.table))
  }

  return parts.join(" ")
}

// =============================================================================
// TRUNCATE TABLE
// =============================================================================

function truncateTableToSql(stmt: AST.TruncateTableStatement): string {
  const parts: string[] = ["TRUNCATE TABLE"]

  if (stmt.ifExists) {
    parts.push("IF EXISTS")
  }

  parts.push(qualifiedNameToSql(stmt.table))

  return parts.join(" ")
}

// =============================================================================
// RENAME TABLE
// =============================================================================

function renameTableToSql(stmt: AST.RenameTableStatement): string {
  return `RENAME TABLE ${qualifiedNameToSql(stmt.from)} TO ${qualifiedNameToSql(stmt.to)}`
}

// =============================================================================
// SHOW
// =============================================================================

function showToSql(stmt: AST.ShowStatement): string {
  switch (stmt.showType) {
    case "tables":
      return "SHOW TABLES"
    case "columns":
      return `SHOW COLUMNS FROM ${qualifiedNameToSql(stmt.table!)}`
    case "partitions":
      return `SHOW PARTITIONS FROM ${qualifiedNameToSql(stmt.table!)}`
    case "createTable":
      return `SHOW CREATE TABLE ${qualifiedNameToSql(stmt.table!)}`
    case "createView":
      return `SHOW CREATE VIEW ${qualifiedNameToSql(stmt.table!)}`
    case "createMaterializedView":
      return `SHOW CREATE MATERIALIZED VIEW ${qualifiedNameToSql(stmt.table!)}`
    case "serverVersion":
      return "SHOW SERVER_VERSION"
    case "serverVersionNum":
      return "SHOW SERVER_VERSION_NUM"
    case "parameters":
      return "SHOW PARAMETERS"
    case "timeZone":
      return "SHOW TIME ZONE"
    case "transaction":
      return "SHOW TRANSACTION"
    case "transactionIsolationLevel":
      return "SHOW TRANSACTION ISOLATION LEVEL"
    case "defaultTransactionReadOnly":
      return "SHOW DEFAULT TRANSACTION READ ONLY"
    case "user":
      return stmt.name
        ? `SHOW USER ${qualifiedNameToSql(stmt.name)}`
        : "SHOW USER"
    case "users":
      return "SHOW USERS"
    case "groups":
      return stmt.name
        ? `SHOW GROUPS ${qualifiedNameToSql(stmt.name)}`
        : "SHOW GROUPS"
    case "serviceAccount":
      return stmt.name
        ? `SHOW SERVICE ACCOUNT ${qualifiedNameToSql(stmt.name)}`
        : "SHOW SERVICE ACCOUNT"
    case "serviceAccounts":
      return stmt.name
        ? `SHOW SERVICE ACCOUNTS ${qualifiedNameToSql(stmt.name)}`
        : "SHOW SERVICE ACCOUNTS"
    case "permissions":
      return stmt.name
        ? `SHOW PERMISSIONS ${qualifiedNameToSql(stmt.name)}`
        : "SHOW PERMISSIONS"
    default:
      throw new Error(
        `Unknown show type: ${(stmt as { showType: string }).showType}`,
      )
  }
}

// =============================================================================
// EXPLAIN
// =============================================================================

function explainToSql(stmt: AST.ExplainStatement): string {
  if (stmt.format) {
    return `EXPLAIN (FORMAT ${stmt.format}) ${statementToSql(stmt.statement)}`
  }
  return `EXPLAIN ${statementToSql(stmt.statement)}`
}

// =============================================================================
// MATERIALIZED VIEW
// =============================================================================

function materializedViewRefreshToSql(
  refresh: AST.MaterializedViewRefresh,
): string {
  const parts: string[] = ["REFRESH"]
  if (refresh.mode === "immediate") parts.push("IMMEDIATE")
  else if (refresh.mode === "manual") parts.push("MANUAL")
  if (refresh.every) parts.push(`EVERY ${refresh.every}`)
  if (refresh.deferred) parts.push("DEFERRED")
  if (refresh.start) parts.push(`START ${escapeString(refresh.start)}`)
  if (refresh.timeZone) parts.push(`TIME ZONE ${escapeString(refresh.timeZone)}`)
  return parts.join(" ")
}

function materializedViewPeriodToSql(
  period: AST.MaterializedViewPeriod,
): string {
  const inner: string[] = []
  if (period.sampleByInterval) {
    inner.push("SAMPLE BY INTERVAL")
  } else {
    if (period.length) inner.push(`LENGTH ${period.length}`)
    if (period.timeZone) inner.push(`TIME ZONE ${escapeString(period.timeZone)}`)
    if (period.delay) inner.push(`DELAY ${period.delay}`)
  }
  return `PERIOD (${inner.join(" ")})`
}

function createMaterializedViewToSql(
  stmt: AST.CreateMaterializedViewStatement,
): string {
  const parts: string[] = ["CREATE MATERIALIZED VIEW"]
  if (stmt.ifNotExists) parts.push("IF NOT EXISTS")
  parts.push(qualifiedNameToSql(stmt.view))
  if (stmt.baseTable)
    parts.push(`WITH BASE ${qualifiedNameToSql(stmt.baseTable)}`)
  if (stmt.refresh) parts.push(materializedViewRefreshToSql(stmt.refresh))
  if (stmt.period) parts.push(materializedViewPeriodToSql(stmt.period))
  if (stmt.asParens) {
    parts.push(`AS (${selectToSql(stmt.query)})`)
  } else {
    parts.push(`AS ${selectToSql(stmt.query)}`)
  }
  if (stmt.timestamp)
    parts.push(`TIMESTAMP(${qualifiedNameToSql(stmt.timestamp)})`)
  if (stmt.partitionBy) parts.push(`PARTITION BY ${stmt.partitionBy}`)
  if (stmt.ttl) parts.push(`TTL ${stmt.ttl.value} ${stmt.ttl.unit}`)
  if (stmt.volume) parts.push(`IN VOLUME ${escapeIdentifier(stmt.volume)}`)
  if (stmt.ownedBy) parts.push(`OWNED BY ${escapeIdentifier(stmt.ownedBy)}`)
  return parts.join(" ")
}

function alterMaterializedViewToSql(
  stmt: AST.AlterMaterializedViewStatement,
): string {
  const parts: string[] = [
    `ALTER MATERIALIZED VIEW ${qualifiedNameToSql(stmt.view)}`,
  ]
  const action = stmt.action
  switch (action.actionType) {
    case "addIndex": {
      let s = `ALTER COLUMN ${escapeIdentifier(action.column)} ADD INDEX`
      if (action.capacity) s += ` CAPACITY ${action.capacity}`
      parts.push(s)
      break
    }
    case "symbolCapacity":
      parts.push(
        `ALTER COLUMN ${escapeIdentifier(action.column)} SYMBOL CAPACITY ${action.capacity}`,
      )
      break
    case "setTtl":
      parts.push(`SET TTL ${action.ttl.value} ${action.ttl.unit}`)
      break
    case "setRefreshLimit":
      parts.push(`SET REFRESH LIMIT ${action.limit.value} ${action.limit.unit}`)
      break
    case "setRefresh": {
      const refreshParts: string[] = ["SET"]
      if (action.refresh)
        refreshParts.push(materializedViewRefreshToSql(action.refresh))
      else refreshParts.push("REFRESH")
      if (action.period)
        refreshParts.push(materializedViewPeriodToSql(action.period))
      parts.push(refreshParts.join(" "))
      break
    }
    case "dropIndex":
      parts.push(`ALTER COLUMN ${escapeIdentifier(action.column)} DROP INDEX`)
      break
    case "resumeWal": {
      let s = "RESUME WAL"
      if (action.fromTxn !== undefined)
        s += ` FROM TRANSACTION ${action.fromTxn}`
      parts.push(s)
      break
    }
    case "suspendWal":
      parts.push("SUSPEND WAL")
      break
  }
  return parts.join(" ")
}

function dropMaterializedViewToSql(
  stmt: AST.DropMaterializedViewStatement,
): string {
  const parts: string[] = ["DROP MATERIALIZED VIEW"]
  if (stmt.ifExists) parts.push("IF EXISTS")
  parts.push(qualifiedNameToSql(stmt.view))
  return parts.join(" ")
}

function refreshMaterializedViewToSql(
  stmt: AST.RefreshMaterializedViewStatement,
): string {
  const parts: string[] = [
    "REFRESH MATERIALIZED VIEW",
    qualifiedNameToSql(stmt.view),
  ]
  if (stmt.mode === "full") parts.push("FULL")
  else if (stmt.mode === "incremental") parts.push("INCREMENTAL")
  else if (stmt.mode === "range") {
    parts.push(`RANGE FROM ${escapeString(stmt.from!)} TO ${escapeString(stmt.to!)}`)
  }
  return parts.join(" ")
}

// =============================================================================
// DECLARE
// =============================================================================

function declareClauseToSql(clause: AST.DeclareClause): string {
  const assignments = clause.assignments.map((a) => {
    const prefix = a.overridable ? "OVERRIDABLE " : ""
    return `${prefix}@${escapeIdentifier(a.name)} := ${expressionToSql(a.value)}`
  })
  return `DECLARE ${assignments.join(", ")}`
}

// =============================================================================
// USER / AUTH
// =============================================================================

function createUserToSql(stmt: AST.CreateUserStatement): string {
  const parts: string[] = ["CREATE USER"]
  if (stmt.ifNotExists) parts.push("IF NOT EXISTS")
  parts.push(qualifiedNameToSql(stmt.user))
  if (stmt.noPassword) parts.push("WITH NO PASSWORD")
  else if (stmt.password) parts.push(`WITH PASSWORD ${escapeString(stmt.password)}`)
  return parts.join(" ")
}

function createGroupToSql(stmt: AST.CreateGroupStatement): string {
  const parts: string[] = ["CREATE GROUP"]
  if (stmt.ifNotExists) parts.push("IF NOT EXISTS")
  parts.push(qualifiedNameToSql(stmt.group))
  if (stmt.externalAlias)
    parts.push(`WITH EXTERNAL ALIAS ${escapeString(stmt.externalAlias)}`)
  return parts.join(" ")
}

function alterGroupToSql(stmt: AST.AlterGroupStatement): string {
  const parts: string[] = ["ALTER GROUP", qualifiedNameToSql(stmt.group)]
  if (stmt.action === "setAlias") {
    parts.push(`WITH EXTERNAL ALIAS ${escapeString(stmt.externalAlias)}`)
  } else {
    parts.push(`DROP EXTERNAL ALIAS ${escapeString(stmt.externalAlias)}`)
  }
  return parts.join(" ")
}

function backupToSql(stmt: AST.BackupStatement): string {
  if (stmt.action === "database") return "BACKUP DATABASE"
  if (stmt.action === "abort") return "BACKUP ABORT"
  return `BACKUP TABLE ${qualifiedNameToSql(stmt.table!)}`
}

function createServiceAccountToSql(
  stmt: AST.CreateServiceAccountStatement,
): string {
  const parts: string[] = ["CREATE SERVICE ACCOUNT"]
  if (stmt.ifNotExists) parts.push("IF NOT EXISTS")
  parts.push(qualifiedNameToSql(stmt.account))
  if (stmt.noPassword) parts.push("WITH NO PASSWORD")
  else if (stmt.password) parts.push(`WITH PASSWORD ${escapeString(stmt.password)}`)
  if (stmt.ownedBy) parts.push(`OWNED BY ${escapeIdentifier(stmt.ownedBy)}`)
  return parts.join(" ")
}

function alterUserActionToSql(action: AST.AlterUserAction): string {
  switch (action.actionType) {
    case "enable":
      return "ENABLE"
    case "disable":
      return "DISABLE"
    case "password":
      if (action.noPassword) return "WITH NO PASSWORD"
      return `WITH PASSWORD ${escapeString(action.password!)}`
    case "createToken": {
      const parts = [`CREATE TOKEN TYPE ${action.tokenType}`]
      if (action.ttl) parts.push(`WITH TTL ${escapeString(action.ttl)}`)
      if (action.refresh) parts.push("REFRESH")
      return parts.join(" ")
    }
    case "dropToken": {
      const parts = [`DROP TOKEN TYPE ${action.tokenType}`]
      if (action.token) parts.push(escapeString(action.token))
      return parts.join(" ")
    }
  }
}

function alterUserToSql(stmt: AST.AlterUserStatement): string {
  return `ALTER USER ${qualifiedNameToSql(stmt.user)} ${alterUserActionToSql(stmt.action)}`
}

function alterServiceAccountToSql(
  stmt: AST.AlterServiceAccountStatement,
): string {
  return `ALTER SERVICE ACCOUNT ${qualifiedNameToSql(stmt.account)} ${alterUserActionToSql(stmt.action)}`
}

function dropUserToSql(stmt: AST.DropUserStatement): string {
  const parts: string[] = ["DROP USER"]
  if (stmt.ifExists) parts.push("IF EXISTS")
  parts.push(qualifiedNameToSql(stmt.user))
  return parts.join(" ")
}

function dropGroupToSql(stmt: AST.DropGroupStatement): string {
  const parts: string[] = ["DROP GROUP"]
  if (stmt.ifExists) parts.push("IF EXISTS")
  parts.push(qualifiedNameToSql(stmt.group))
  return parts.join(" ")
}

function dropServiceAccountToSql(
  stmt: AST.DropServiceAccountStatement,
): string {
  const parts: string[] = ["DROP SERVICE ACCOUNT"]
  if (stmt.ifExists) parts.push("IF EXISTS")
  parts.push(qualifiedNameToSql(stmt.account))
  return parts.join(" ")
}

function addUserToSql(stmt: AST.AddUserStatement): string {
  return `ADD USER ${qualifiedNameToSql(stmt.user)} TO ${stmt.groups.map(qualifiedNameToSql).join(", ")}`
}

function removeUserToSql(stmt: AST.RemoveUserStatement): string {
  return `REMOVE USER ${qualifiedNameToSql(stmt.user)} FROM ${stmt.groups.map(qualifiedNameToSql).join(", ")}`
}

function grantOnTargetToSql(on: AST.GrantOnTarget): string {
  if (on.allTables) return "ON ALL TABLES"
  if (on.tables) {
    const tableParts = on.tables.map((t) => {
      let sql = qualifiedNameToSql(t.table)
      if (t.columns && t.columns.length > 0) {
        sql += ` (${t.columns.map(escapeIdentifier).join(", ")})`
      }
      return sql
    })
    return `ON ${tableParts.join(", ")}`
  }
  return ""
}

function grantToSql(stmt: AST.GrantStatement): string {
  const parts: string[] = [`GRANT ${stmt.permissions.join(", ")}`]
  if (stmt.on) parts.push(grantOnTargetToSql(stmt.on))
  parts.push(`TO ${qualifiedNameToSql(stmt.to)}`)
  if (stmt.grantOption) parts.push("WITH GRANT OPTION")
  if (stmt.verification) parts.push("WITH VERIFICATION")
  return parts.join(" ")
}

function revokeToSql(stmt: AST.RevokeStatement): string {
  const parts: string[] = [`REVOKE ${stmt.permissions.join(", ")}`]
  if (stmt.on) parts.push(grantOnTargetToSql(stmt.on))
  parts.push(`FROM ${qualifiedNameToSql(stmt.from)}`)
  return parts.join(" ")
}

function grantAssumeToSql(
  stmt: AST.GrantAssumeServiceAccountStatement,
): string {
  const parts: string[] = [
    `GRANT ASSUME SERVICE ACCOUNT ${qualifiedNameToSql(stmt.account)} TO ${qualifiedNameToSql(stmt.to)}`,
  ]
  if (stmt.grantOption) parts.push("WITH GRANT OPTION")
  return parts.join(" ")
}

function revokeAssumeToSql(
  stmt: AST.RevokeAssumeServiceAccountStatement,
): string {
  return `REVOKE ASSUME SERVICE ACCOUNT ${qualifiedNameToSql(stmt.account)} FROM ${qualifiedNameToSql(stmt.from)}`
}

// =============================================================================
// ADMIN OPERATIONS
// =============================================================================

function vacuumTableToSql(stmt: AST.VacuumTableStatement): string {
  return `VACUUM TABLE ${qualifiedNameToSql(stmt.table)}`
}

function resumeWalToSql(stmt: AST.ResumeWalStatement): string {
  const parts: string[] = ["RESUME WAL"]
  if (stmt.fromTransaction)
    parts.push(`FROM TRANSACTION ${stmt.fromTransaction}`)
  if (stmt.fromTxn) parts.push(`FROM TXN ${stmt.fromTxn}`)
  return parts.join(" ")
}

function setTypeToSql(stmt: AST.SetTypeStatement): string {
  const parts: string[] = ["SET TYPE"]
  if (stmt.bypass) parts.push("BYPASS")
  parts.push(stmt.wal ? "WAL" : "BYPASS WAL")
  return parts.join(" ")
}

function reindexTableToSql(stmt: AST.ReindexTableStatement): string {
  const parts: string[] = ["REINDEX TABLE", qualifiedNameToSql(stmt.table)]
  if (stmt.columns && stmt.columns.length > 0) {
    parts.push(`COLUMN ${stmt.columns.map(escapeIdentifier).join(", ")}`)
  }
  if (stmt.partitions && stmt.partitions.length > 0) {
    parts.push(`PARTITION ${stmt.partitions.map((p) => escapeString(p)).join(", ")}`)
  }
  if (stmt.lockExclusive) parts.push("LOCK EXCLUSIVE")
  return parts.join(" ")
}

function copyOptionToSql(opt: AST.CopyOption): string {
  if (opt.value === undefined) return opt.key
  if (opt.value === true) return `${opt.key} TRUE`
  if (opt.value === false) return `${opt.key} FALSE`
  if (typeof opt.value === "string") return `${opt.key} ${escapeString(opt.value)}`
  if (Array.isArray(opt.value)) return `${opt.key} ${opt.value.join(" ")}`
  return `${opt.key} ${opt.value}`
}

function copyFromToSql(stmt: AST.CopyFromStatement): string {
  const parts: string[] = [
    `COPY ${qualifiedNameToSql(stmt.table)} FROM ${escapeString(stmt.file)}`,
  ]
  if (stmt.options && stmt.options.length > 0) {
    parts.push(`WITH ${stmt.options.map(copyOptionToSql).join(" ")}`)
  }
  return parts.join(" ")
}

function copyToToSql(stmt: AST.CopyToStatement): string {
  let source: string
  if ("type" in stmt.source && stmt.source.type === "select") {
    source = `(${selectToSql(stmt.source)})`
  } else {
    source = qualifiedNameToSql(stmt.source)
  }
  const parts: string[] = [`COPY ${source} TO ${escapeString(stmt.destination)}`]
  if (stmt.options && stmt.options.length > 0) {
    parts.push(`WITH ${stmt.options.map(copyOptionToSql).join(" ")}`)
  }
  return parts.join(" ")
}

function pivotClauseToSql(pivot: AST.PivotClause): string {
  const pivotParts: string[] = []
  const aggs = pivot.aggregations.map((agg) => {
    let sql = expressionToSql(agg.expression)
    if (agg.alias) {
      sql += ` AS ${escapeIdentifier(agg.alias)}`
    }
    return sql
  })
  pivotParts.push(aggs.join(", "))
  for (let i = 0; i < pivot.pivots.length; i++) {
    const p = pivot.pivots[i]
    const prefix = i === 0 ? "FOR " : ""
    let forSql = `${prefix}${expressionToSql(p.expression)} IN (`
    if (p.in.select) {
      forSql += selectToSql(p.in.select)
    } else if (p.in.values) {
      forSql += p.in.values.map(expressionToSql).join(", ")
    }
    forSql += ")"
    pivotParts.push(forSql)
  }
  if (pivot.groupBy && pivot.groupBy.length > 0) {
    pivotParts.push(`GROUP BY ${pivot.groupBy.map(expressionToSql).join(", ")}`)
  }
  return `PIVOT (${pivotParts.join(" ")})`
}

// =============================================================================
// PIVOT
// =============================================================================

function pivotToSql(stmt: AST.PivotStatement): string {
  const parts: string[] = []

  // Source: (SELECT ...) or tableName
  if ("type" in stmt.source && stmt.source.type === "select") {
    parts.push(`(${selectToSql(stmt.source)})`)
  } else {
    parts.push(qualifiedNameToSql(stmt.source))
  }

  // WHERE (before PIVOT keyword)
  if (stmt.where) {
    parts.push("WHERE")
    parts.push(expressionToSql(stmt.where))
  }

  // PIVOT (aggregations, FOR...IN clauses, GROUP BY)
  const pivotParts: string[] = []

  // Aggregations
  const aggs = stmt.aggregations.map((agg) => {
    let sql = expressionToSql(agg.expression)
    if (agg.alias) {
      sql += ` AS ${escapeIdentifier(agg.alias)}`
    }
    return sql
  })
  pivotParts.push(aggs.join(", "))

  // FOR...IN clauses
  for (let i = 0; i < stmt.pivots.length; i++) {
    const pivot = stmt.pivots[i]
    const prefix = i === 0 ? "FOR " : ""
    let forSql = `${prefix}${expressionToSql(pivot.expression)} IN (`
    if (pivot.in.select) {
      forSql += selectToSql(pivot.in.select)
    } else if (pivot.in.values) {
      forSql += pivot.in.values.map(expressionToSql).join(", ")
    }
    forSql += ")"
    pivotParts.push(forSql)
  }

  // GROUP BY inside PIVOT
  if (stmt.groupBy && stmt.groupBy.length > 0) {
    pivotParts.push(`GROUP BY ${stmt.groupBy.map(expressionToSql).join(", ")}`)
  }

  parts.push(`PIVOT (${pivotParts.join(" ")})`)

  // Alias
  if (stmt.alias) {
    parts.push(`AS ${escapeIdentifier(stmt.alias)}`)
  }

  // ORDER BY
  if (stmt.orderBy && stmt.orderBy.length > 0) {
    parts.push("ORDER BY")
    parts.push(stmt.orderBy.map(orderByItemToSql).join(", "))
  }

  // LIMIT
  if (stmt.limit) {
    parts.push("LIMIT")
    if (stmt.limit.offset) {
      parts.push(`${expressionToSql(stmt.limit.count)},`)
      parts.push(expressionToSql(stmt.limit.offset))
    } else {
      parts.push(expressionToSql(stmt.limit.count))
    }
  }

  return parts.join(" ")
}

// =============================================================================
// Expressions
// =============================================================================

function expressionToSql(expr: AST.Expression): string {
  if (!expr) return ""
  switch (expr.type) {
    case "binary":
      return binaryExprToSql(expr)
    case "unary":
      return unaryExprToSql(expr)
    case "column":
      return qualifiedNameToSql(expr.name)
    case "variable":
      return `@${escapeIdentifier(expr.name)}`
    case "literal":
      return literalToSql(expr)
    case "function":
      return functionToSql(expr)
    case "case":
      return caseExprToSql(expr)
    case "cast":
      return castExprToSql(expr)
    case "typeCast":
      return typeCastExprToSql(expr)
    case "in":
      return inExprToSql(expr)
    case "between":
      return betweenExprToSql(expr)
    case "within":
      return withinExprToSql(expr)
    case "isNull":
      return isNullExprToSql(expr)
    case "paren": {
      const inner = [expressionToSql(expr.expression)]
      if (expr.additionalExpressions) {
        inner.push(...expr.additionalExpressions.map(expressionToSql))
      }
      return `(${inner.join(", ")})`
    }
    case "arrayLiteral":
      return arrayLiteralToSql(expr)
    case "arrayAccess":
      return arrayAccessToSql(expr)
    case "subquery":
      return `(${selectToSql(expr.query)})`
    default:
      throw new Error(
        `Unknown expression type: ${(expr as { type: string }).type}`,
      )
  }
}

function binaryExprToSql(expr: AST.BinaryExpression): string {
  const left = expressionToSql(expr.left)
  const right = expressionToSql(expr.right)
  return `${left} ${expr.operator} ${right}`
}

function unaryExprToSql(expr: AST.UnaryExpression): string {
  const operand = expressionToSql(expr.operand)
  if (expr.operator === "NOT") {
    return `NOT ${operand}`
  }
  return `${expr.operator}${operand}`
}

function literalToSql(lit: AST.Literal): string {
  switch (lit.literalType) {
    case "string":
      return escapeString(String(lit.value))
    case "number":
      if (lit.raw != null) return lit.raw
      return String(lit.value)
    case "boolean":
      return lit.value ? "TRUE" : "FALSE"
    case "null":
      return "NULL"
    case "geohash":
    case "duration":
      return String(lit.value)
    default:
      return String(lit.value)
  }
}

function functionToSql(fn: AST.FunctionCall): string {
  let args: string

  if (fn.subquery) {
    args = selectToSql(fn.subquery)
  } else if (fn.star) {
    args = "*"
  } else if (fn.args.length === 0) {
    args = ""
  } else {
    const prefix = fn.distinct ? "DISTINCT " : ""
    const separator = fn.fromSeparator ? " FROM " : ", "
    args = prefix + fn.args.map(expressionToSql).join(separator)
  }

  let sql = `${fn.name}(${args})`

  if (fn.ignoreNulls) {
    sql += " IGNORE NULLS"
  }

  if (fn.over) {
    sql += ` OVER (${windowSpecToSql(fn.over)})`
  }

  return sql
}

function windowSpecToSql(spec: AST.WindowSpecification): string {
  const parts: string[] = []

  if (spec.partitionBy && spec.partitionBy.length > 0) {
    parts.push(
      `PARTITION BY ${spec.partitionBy.map(expressionToSql).join(", ")}`,
    )
  }

  if (spec.orderBy && spec.orderBy.length > 0) {
    parts.push(`ORDER BY ${spec.orderBy.map(orderByItemToSql).join(", ")}`)
  }

  if (spec.frame) {
    parts.push(windowFrameToSql(spec.frame))
  }

  return parts.join(" ")
}

function windowFrameToSql(frame: AST.WindowFrame): string {
  const mode = frame.mode.toUpperCase()
  let sql: string
  if (frame.end) {
    sql = `${mode} BETWEEN ${windowFrameBoundToSql(frame.start)} AND ${windowFrameBoundToSql(frame.end)}`
  } else {
    sql = `${mode} ${windowFrameBoundToSql(frame.start)}`
  }
  if (frame.exclude) {
    switch (frame.exclude) {
      case "currentRow":
        sql += " EXCLUDE CURRENT ROW"
        break
      case "noOthers":
        sql += " EXCLUDE NO OTHERS"
        break
      case "groups":
        sql += " EXCLUDE GROUPS"
        break
    }
  }
  return sql
}

function windowFrameBoundToSql(bound: AST.WindowFrameBound): string {
  if (!bound) return ""
  switch (bound.kind) {
    case "unboundedPreceding":
      return "UNBOUNDED PRECEDING"
    case "unboundedFollowing":
      return "UNBOUNDED FOLLOWING"
    case "currentRow":
      return "CURRENT ROW"
    case "preceding":
      return `${bound.duration ?? expressionToSql(bound.value!)} PRECEDING`
    case "following":
      return `${bound.duration ?? expressionToSql(bound.value!)} FOLLOWING`
    default:
      throw new Error(
        `Unknown window frame bound: ${(bound as { kind: string }).kind}`,
      )
  }
}

function caseExprToSql(expr: AST.CaseExpression): string {
  const parts: string[] = ["CASE"]

  if (expr.operand) {
    parts.push(expressionToSql(expr.operand))
  }

  for (const { when, then } of expr.whenClauses) {
    parts.push(`WHEN ${expressionToSql(when)} THEN ${expressionToSql(then)}`)
  }

  if (expr.elseClause) {
    parts.push(`ELSE ${expressionToSql(expr.elseClause)}`)
  }

  parts.push("END")
  return parts.join(" ")
}

function castExprToSql(expr: AST.CastExpression): string {
  return `CAST(${expressionToSql(expr.expression)} AS ${expr.dataType})`
}

function typeCastExprToSql(expr: AST.TypeCastExpression): string {
  return `${expressionToSql(expr.expression)}::${expr.dataType}`
}

function inExprToSql(expr: AST.InExpression): string {
  const left = expressionToSql(expr.expression)
  const values = expr.values.map(expressionToSql).join(", ")
  const not = expr.not ? " NOT" : ""
  if (expr.parenthesized || expr.values.length > 1) {
    return `${left}${not} IN (${values})`
  }
  return `${left}${not} IN ${values}`
}

function betweenExprToSql(expr: AST.BetweenExpression): string {
  const left = expressionToSql(expr.expression)
  const low = expressionToSql(expr.low)
  const high = expressionToSql(expr.high)
  const not = expr.not ? " NOT" : ""
  return `${left}${not} BETWEEN ${low} AND ${high}`
}

function withinExprToSql(expr: AST.WithinExpression): string {
  const left = expressionToSql(expr.expression)
  const values = expr.values.map(expressionToSql).join(", ")
  return `${left} WITHIN (${values})`
}

function isNullExprToSql(expr: AST.IsNullExpression): string {
  const left = expressionToSql(expr.expression)
  return `${left} IS ${expr.not ? "NOT " : ""}NULL`
}

// =============================================================================
// Array expressions
// =============================================================================

function arrayLiteralToSql(expr: AST.ArrayLiteral): string {
  const elements = expr.elements.map((el) => {
    if (el.type === "arrayLiteral") {
      return arrayLiteralToSql(el)
    }
    return expressionToSql(el)
  })
  const prefix = expr.hasArrayKeyword ? "ARRAY" : ""
  return `${prefix}[${elements.join(", ")}]`
}

function arrayAccessToSql(expr: AST.ArrayAccessExpression): string {
  let sql = expressionToSql(expr.array)
  for (const sub of expr.subscripts) {
    if ("type" in sub && sub.type === "arraySlice") {
      const start = sub.start ? expressionToSql(sub.start) : ""
      const end = sub.end ? expressionToSql(sub.end) : ""
      sql += `[${start}:${end}]`
    } else {
      sql += `[${expressionToSql(sub)}]`
    }
  }
  return sql
}

// =============================================================================
// Helpers
// =============================================================================

function qualifiedNameToSql(name: AST.QualifiedName): string {
  if (!name || !name.parts) return ""
  return name.parts.map(escapeIdentifier).join(".")
}

function escapeString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function escapeIdentifier(name: string): string {
  // Check if identifier needs quoting (contains special chars or is a keyword)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return name
  }
  return `"${name.replace(/"/g, '""')}"`
}
