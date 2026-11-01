import type { BuildColumns } from 'drizzle-orm'
import type { SQLiteColumnBuilderBase, SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

/**
 * Таблица с именем, заданным фабрикой, и точным набором типизированных деклараций колонок.
 */
export type DeclaredTable<Columns extends Record<string, SQLiteColumnBuilderBase>> = SQLiteTableWithColumns<{
  /* Физическое имя конкретной предметной таблицы. */
  name: string
  /* SQLite не использует отдельную именованную SQL-схему. */
  schema: undefined
  /* SQL-колонки выводятся из деклараций без ручного дублирования предметных типов. */
  columns: BuildColumns<string, Columns, 'sqlite'>
  /* Диалект типизированного хранилища. */
  dialect: 'sqlite'
}>
