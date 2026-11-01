import BetterSqlite3 from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { DatabaseError } from '../errors.js';
import { sqliteMessages as messages } from './messages.js';
import { identifier } from './sql-identifiers.js';
import type {
  Connection,
  SchemaStatus,
  TableDefinition,
} from './sqlite.types.js';

const SCHEMA_SQL = readFileSync(
  new URL('../../schema.sql', import.meta.url),
  'utf8',
);
const TABLES_SQL =
  "SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND sql IS NOT NULL ORDER BY name";
const STRUCTURE_SQL =
  "SELECT name, sql FROM sqlite_schema WHERE type IN ('table', 'index') AND name NOT GLOB 'sqlite_*' AND sql IS NOT NULL ORDER BY type, name";
const LEGACY_HISTORY = '__drizzle_migrations';

/**
 * Получает канонические определения из актуального SQL без собственного разбора DDL.
 * Временная база живёт только в памяти; определения кешируются на срок жизни модуля.
 */
function expectedStructure(): readonly TableDefinition[] {
  const database = new BetterSqlite3(':memory:');
  try {
    database.exec(SCHEMA_SQL);
    return database.prepare<[], TableDefinition>(STRUCTURE_SQL).all();
  } finally {
    database.close();
  }
}

const EXPECTED_STRUCTURE = expectedStructure();

/**
 * Сравнивает определения таблиц и явных индексов с единственной текущей схемой.
 * Историческая служебная таблица не влияет на совместимость и удаляется при импорте.
 */
export function schemaStatus(connection: Connection): SchemaStatus {
  const objects = connection.client
    .prepare<[], TableDefinition>(STRUCTURE_SQL)
    .all()
    .filter((table) => table.name !== LEGACY_HISTORY);
  if (objects.length === 0) {
    return 'empty';
  }
  const current =
    objects.length === EXPECTED_STRUCTURE.length &&
    objects.every(
      (object, index) =>
        object.name === EXPECTED_STRUCTURE[index].name &&
        object.sql === EXPECTED_STRUCTURE[index].sql,
    );
  return current ? 'current' : 'outdated';
}

/**
 * Проверяет обычное открытие, создавая схему только в пустой доступной для записи базе.
 * Существующие несовместимые данные не удаляются; их заменяет явный импорт снимка.
 */
export function prepareDatabase(connection: Connection): void {
  if (connection.readOnly) {
    if (schemaStatus(connection) !== 'current') {
      throw new DatabaseError('SCHEMA_MISMATCH', messages.schemaMismatch);
    }
    return;
  }
  connection.client
    .transaction(() => {
      const status = schemaStatus(connection);
      if (status === 'empty') {
        connection.client.exec(SCHEMA_SQL);
      } else if (status !== 'current') {
        throw new DatabaseError('SCHEMA_MISMATCH', messages.schemaMismatch);
      }
    })
    .immediate();
}

/**
 * Готовит структуру к полной замене JSON-снимком внутри транзакции владельца.
 * Несовместимая схема пересоздаётся целиком; внешние ключи временно отключает владелец.
 */
export function prepareImportSchema(connection: Connection): void {
  if (schemaStatus(connection) !== 'current') {
    const views = connection.client
      .prepare<[], { name: string }>(
        "SELECT name FROM sqlite_schema WHERE type = 'view'",
      )
      .all();
    for (const view of views) {
      connection.client.exec(`DROP VIEW IF EXISTS ${identifier(view.name)}`);
    }
    const tables = connection.client
      .prepare<[], TableDefinition>(TABLES_SQL)
      .all();
    for (const table of tables) {
      connection.client.exec(`DROP TABLE IF EXISTS ${identifier(table.name)}`);
    }
    connection.client.exec(SCHEMA_SQL);
  }
  connection.client.exec(`DROP TABLE IF EXISTS ${identifier(LEGACY_HISTORY)}`);
}
