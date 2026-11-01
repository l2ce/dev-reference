import type BetterSqlite3 from 'better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from './schema.js'

/**
 * Соединение принадлежит одному экземпляру API и закрывается его владельцем.
 */
export interface Connection {
  /* Физическое соединение SQLite и синхронные транзакции. */
  readonly client: BetterSqlite3.Database
  /* Типизированные SQL-запросы к таблицам пакета. */
  readonly orm: BetterSQLite3Database<typeof schema>
  /* Абсолютный путь открытого файла. */
  readonly path: string
  /* Соединение запрещает изменения на уровне SQLite. */
  readonly readOnly: boolean
}
/**
 * Внутренние параметры открытия; создание разрешается сценарием API или импорта.
 */
export interface ConnectionOptions {
  /* Файл SQLite; относительный путь разрешается от cwd вызывающей стороны. */
  readonly path: string
  /* Разрешение создать отсутствующий файл; по умолчанию false. */
  readonly create?: boolean
  /* Открытие только для чтения; по умолчанию false. */
  readonly readOnly?: boolean
}

/**
 * Определение таблицы или явного индекса из sqlite_schema; sql выбран с условием IS NOT NULL.
 */
export interface TableDefinition {
  /* Имя объекта структуры в main. */
  readonly name: string
  /* Фактический CREATE TABLE или CREATE INDEX, сохранённый SQLite. */
  readonly sql: string
}

/**
 * Совместимость структуры файла с единственной актуальной схемой пакета.
 */
export type SchemaStatus = 'empty' | 'current' | 'outdated'
