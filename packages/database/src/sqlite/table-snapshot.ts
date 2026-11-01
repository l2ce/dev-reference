import type BetterSqlite3 from 'better-sqlite3';
import { DatabaseError } from '../errors.js';
import { identifier } from './sql-identifiers.js';
import { encodeSqlCell } from '../exchange/table-codec.js';
import { tableManifestSchema } from '../exchange/table-schema.js';
import { exchangeMessages as messages } from '../exchange/messages.js';
import type {
  SqlColumn,
  TableDefinition,
  TableRow,
  TableSnapshot,
} from '../exchange/table.types.js';

/**
 * Получает таблицы, колонки, PK и COUNT из самой базы; вызывающая сторона держит снимок.
 * Внутренние sqlite_* не являются пользовательскими таблицами обмена.
 */
export function inspectTables(
  database: BetterSqlite3.Database,
): TableDefinition[] {
  return database
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
    )
    .all()
    .map(({ name }) => {
      const columns = database
        .prepare<[], SqlColumn>(`PRAGMA table_info(${identifier(name)})`)
        .all();
      const primaryKey = columns
        .filter((column) => column.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((column) => column.name);
      if (primaryKey.length === 0) {
        throw new DatabaseError(
          'TABLE_WITHOUT_PRIMARY_KEY',
          messages.tableKey,
          { table: name },
        );
      }
      const count = database
        .prepare<[], { total: number }>(
          `SELECT COUNT(*) AS total FROM ${identifier(name)}`,
        )
        .get();
      if (!count) {
        throw new DatabaseError(
          'DATABASE_INTEGRITY_ERROR',
          messages.tableValue,
          { table: name },
        );
      }
      return {
        name,
        columns: columns.map((column) => column.name),
        primaryKey,
        rows: count.total,
      };
    });
}

/**
 * Читает все физические строки в транзакции владельца без обращения к реестру коллекций API.
 * Стоимость — полный SQL-снимок в памяти, как и у прежнего документного экспорта.
 */
export function readTableSnapshot(
  database: BetterSqlite3.Database,
): TableSnapshot {
  const tables = inspectTables(database);
  const manifest = tableManifestSchema.parse({
    format: 'sqlite-tables',
    formatVersion: 1,
    tables,
  });
  const rows = new Map<string, readonly TableRow[]>();
  for (const table of tables) {
    const values = database
      .prepare<[], Record<string, unknown>>(
        `SELECT ${table.columns.map(identifier).join(', ')} FROM ${identifier(table.name)} ORDER BY ${table.primaryKey.map(identifier).join(', ')}`,
      )
      .safeIntegers()
      .all()
      .map((row) =>
        Object.fromEntries(
          table.columns.map((column) => [column, encodeSqlCell(row[column])]),
        ),
      );
    const keys = values.map((row) =>
      JSON.stringify(table.primaryKey.map((column) => row[column])),
    );
    if (new Set(keys).size !== keys.length) {
      throw new DatabaseError('INVALID_TABLE_KEY', messages.tableKey, {
        table: table.name,
      });
    }
    rows.set(table.name, values);
  }
  return { manifest, rows };
}
