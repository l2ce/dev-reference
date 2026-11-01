import { eq, getTableName } from 'drizzle-orm'
import { DatabaseError } from '../errors.js'
import { validateSnapshot } from '../model/validation.js'
import { readSnapshot } from './records.js'
import { identifier } from './sql-identifiers.js'
import { layouts } from './layout.js'
import { keyExpression } from './key-expression.js'
import { encodeSqlCell, tableFileAddress } from '../exchange/table-codec.js'
import { exchangeMessages as messages } from '../exchange/messages.js'
import type { Connection } from './sqlite.types.js'
import type { DatabaseSnapshot } from '../model/model.types.js'
import type { ForeignKeyViolation, TableSnapshot } from '../exchange/table.types.js'

/**
 * Находит физический JSON-адрес предметной диагностики, не возвращая путь прежнего формата.
 */
function documentFailurePath(connection: Connection, tables: TableSnapshot, details: object): string | undefined {
  if (!('key' in details) || typeof details.key !== 'string') {
    return undefined
  }
  for (const layout of layouts) {
    const row = connection.orm
      .select({ id: layout.table.id })
      .from(layout.table)
      .where(eq(keyExpression(layout), details.key))
      .get()
    const table = tables.manifest.tables.find((table) => table.name === getTableName(layout.table))
    if (row && table) {
      return tableFileAddress(table, { id: row.id }).path
    }
  }
  return undefined
}

/**
 * Проверяет FK и связывает нарушение с конкретным файлом SQL-строки.
 */
function validateForeignKeys(connection: Connection, snapshot: TableSnapshot): void {
  const violations = connection.client.prepare<[], ForeignKeyViolation>('PRAGMA foreign_key_check').all()
  const first = violations[0]
  if (!first) {
    return
  }
  const table = snapshot.manifest.tables.find((table) => table.name === first.table)
  const row =
    table && first.rowid !== null
      ? connection.client
          .prepare<[number], Record<string, unknown>>(`SELECT * FROM ${identifier(table.name)} WHERE rowid = ?`)
          .get(first.rowid)
      : undefined
  const path =
    table && row
      ? tableFileAddress(
          table,
          Object.fromEntries(Object.entries(row).map(([key, value]) => [key, encodeSqlCell(value)]))
        ).path
      : undefined
  throw new DatabaseError('DATABASE_INTEGRITY_ERROR', messages.tableRows, {
    violations,
    path
  })
}

/**
 * Проверяет содержательные связи, общие UUID и переводы после восстановления SQL-строк.
 * Вызывающая сторона удерживает транзакцию; диагностики относятся к табличной раскладке.
 */
export function validateStoredTables(connection: Connection, tables: TableSnapshot): DatabaseSnapshot {
  validateForeignKeys(connection, tables)
  let snapshot: DatabaseSnapshot
  try {
    snapshot = validateSnapshot(readSnapshot(connection))
  } catch (error) {
    if (error instanceof DatabaseError && error.details !== null && typeof error.details === 'object') {
      const path = documentFailurePath(connection, tables, error.details)
      throw new DatabaseError(error.code, error.message, { ...error.details, path }, error)
    }
    throw error
  }
  return snapshot
}
