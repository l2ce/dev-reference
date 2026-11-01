import type * as z from 'zod'
import type { tableCellSchema, tableRowSchema, tableManifestSchema, tableDefinitionSchema } from './table-schema.js'
import type { TableFileAddress } from './exchange.types.js'

/**
 * Обратимое JSON-представление значения SQL.
 */
export type TableCell = z.infer<typeof tableCellSchema>
/**
 * Строка с физическими именами колонок.
 */
export type TableRow = z.infer<typeof tableRowSchema>
/**
 * Определение таблицы из манифеста экспорта.
 */
export type TableDefinition = z.infer<typeof tableDefinitionSchema>
/**
 * Манифест файлового табличного формата.
 */
export type TableManifest = z.infer<typeof tableManifestSchema>
/**
 * Именование файлов: короткий хеш для экспорта либо прежний полный хеш для чтения архивных снимков.
 */
export type TableFileNameFormat = 'short' | 'legacy'
/**
 * Согласованный снимок физических таблиц, включая пустые.
 */
export interface TableSnapshot {
  /* Версия раскладки и динамический перечень таблиц. */
  readonly manifest: TableManifest
  /* Строки по имени таблицы в порядке первичного ключа. */
  readonly rows: ReadonlyMap<string, readonly TableRow[]>
}
/**
 * Колонка, прочитанная через PRAGMA table_info.
 */
export interface SqlColumn {
  /* Физическое имя колонки. */
  readonly name: string
  /* Позиция в первичном ключе, начиная с 1; ноль вне PK. */
  readonly pk: number
}
/**
 * Проверенный список файлов до чтения табличных строк.
 */
export interface TableInventory {
  /* Динамический состав снимка. */
  readonly manifest: TableManifest
  /* Относительные пути файлов и физические таблицы. */
  readonly records: readonly TableFileAddress[]
}
/**
 * Нарушение, возвращаемое SQLite foreign_key_check.
 */
export interface ForeignKeyViolation {
  /* Физическая таблица нарушающей строки. */
  readonly table: string
  /* Внутренний rowid; null у WITHOUT ROWID. */
  readonly rowid: number | null
  /* Таблица отсутствующего или неверного владельца. */
  readonly parent: string
  /* Номер ограничения FK внутри таблицы. */
  readonly fkid: number
}
