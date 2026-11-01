import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Реестр языков переводов; новые языки добавляются данными.
 */
export const locales = sqliteTable(
  'locales',
  {
    code: text('code').primaryKey().notNull(),
    position: integer('position').notNull().unique()
  },
  (t) => [check('locale_position', sql`${t.position} >= 0`)]
)

/**
 * Постоянная предметная идентичность, независимая от языка.
 */
export const commonFields = { id: text('id').primaryKey().notNull() }

/**
 * Машинный код и необязательный порядок отображения именованной сущности.
 */
export const navigationFields = {
  code: text('code').notNull(),
  order: integer('sort_order')
}

/**
 * Полнота технического исследования, общая для всех переводов.
 */
export const researchFields = {
  status: text('status', {
    enum: ['missing', 'partial', 'documented']
  }).notNull()
}

// Фабрики заменяют эти имена предметными FK, сохраняя точный тип колонок.
const ownerColumn: string = 'packet_id'
const revisionColumn: string = 'packet_revision_id'

/**
 * Общий состав технической редакции; SQL-имя владельца задаёт конкретная таблица.
 */
export const implementationFields = {
  ...commonFields,
  ...researchFields,
  ownerId: text(ownerColumn).notNull(),
  rev: integer('rev').notNull()
}

/**
 * Явная применимость одной редакции к протоколу.
 */
export const implementationProtocolFields = {
  ownerId: text(ownerColumn).notNull(),
  implementationId: text(revisionColumn).notNull(),
  protocolId: text('protocol_id').notNull(),
  position: integer('position').notNull()
}
