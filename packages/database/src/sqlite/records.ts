import { count, eq } from 'drizzle-orm'
import { DatabaseError } from '../errors.js'
import { parseEntry } from '../model/entry.js'
import { entityAddressSchema, implementationAddressSchema, manifestSchema } from '../model/schema.js'
import { sqliteMessages as messages } from './messages.js'
import { metadata, locales, branches, chronicles } from './schema.js'
import { publicKey } from './identities.js'
import { layouts } from './layout.js'
import { documentFields } from './record-fields.js'
import { readRelations } from './relations.js'
import { listQuerySchema } from '../api/list-schema.js'
import { listFilter } from './list-filter.js'
import { keyExpression } from './key-expression.js'
import type {
  Collection,
  EntityCollection,
  RecordValue,
  DatabaseEntry,
  DatabaseManifest,
  DatabaseSnapshot,
  EntityAddress,
  EntityValue,
  ImplementationAddress,
  ImplementationValue,
  ImplementationCollection
} from '../model/model.types.js'
import type { RecordPage, ListQuery } from '../api/database.types.js'
import type { Connection } from './sqlite.types.js'
import type { RecordRow, StorageLayout } from './storage.types.js'

/**
 * Собирает метаданные общей базы типизированными запросами; null означает отсутствие инициализации.
 */
export function readManifest(connection: Connection): DatabaseManifest | null {
  const row = connection.orm.select().from(metadata).get()
  return row
    ? manifestSchema.parse({
        schemaVersion: row.schemaVersion,
        dataVersion: row.dataVersion,
        defaultLocale: row.defaultLocale,
        locales: connection.orm
          .select({ code: locales.code })
          .from(locales)
          .orderBy(locales.position)
          .all()
          .map((locale) => locale.code)
      })
    : null
}

/**
 * Требует инициализированную базу перед полным чтением и предметной записью.
 */
export function requireManifest(connection: Connection): DatabaseManifest {
  const manifest = readManifest(connection)
  if (!manifest) {
    throw new DatabaseError('DATABASE_EMPTY', messages.empty)
  }
  return manifest
}

/**
 * Собирает DTO из декодированной Drizzle строки и связей, затем проверяет предметный контракт.
 */
function decodeEntry(connection: Connection, layout: StorageLayout, row: RecordRow): DatabaseEntry {
  const translations = layout.translations
  const value = {
    ...documentFields(row),
    key: publicKey(connection, layout.table, row.id),
    ...readRelations(connection, layout, row),
    ...('branchId' in row ? { branchKey: publicKey(connection, branches, row.branchId) } : {}),
    ...('chronicleId' in row ? { chronicleKey: publicKey(connection, chronicles, row.chronicleId) } : {}),
    ...(translations
      ? {
          translations: connection.orm
            .select()
            .from(translations)
            .where(eq(translations.ownerId, row.id))
            .orderBy(translations.locale)
            .all()
            .map(({ ownerId: _ownerId, ...translation }) => translation)
        }
      : {})
  }
  return parseEntry({
    collection: layout.collection,
    kind: layout.kind,
    key: value.key,
    value
  })
}

/**
 * Читает все предметные таблицы и переводы; согласованной транзакцией владеет вызывающий сценарий.
 */
export function readSnapshot(connection: Connection): DatabaseSnapshot {
  return {
    ...requireManifest(connection),
    entries: layouts.flatMap((layout) =>
      connection.orm
        .select()
        .from(layout.table)
        .orderBy(keyExpression(layout))
        .all()
        .map((row) => decodeEntry(connection, layout, row))
    )
  }
}

/**
 * Читает одну карточку по общему ключу без загрузки полного снимка.
 */
export function readEntity<C extends EntityCollection>(
  connection: Connection,
  target: EntityAddress<C>
): EntityValue<C> | undefined {
  const address = entityAddressSchema.parse({ ...target, kind: 'entity' })
  const layout = layouts.find((candidate) => candidate.collection === address.collection && candidate.kind === 'entity')
  if (!layout) {
    throw new DatabaseError('INVALID_QUERY', messages.query)
  }
  const row = connection.orm
    .select()
    .from(layout.table)
    .where(eq(keyExpression(layout), address.key))
    .get()
  // parseEntry проверяет схему той же коллекции C; динамический реестр скрывает корреляцию от TypeScript.
  return row ? (decodeEntry(connection, layout, row).value as EntityValue<C>) : undefined
}

/**
 * Читает одну техническую редакцию, её применимость и переводы через Query Builder.
 */
export function readImplementation<C extends ImplementationCollection>(
  connection: Connection,
  target: ImplementationAddress<C>
): ImplementationValue<C> | undefined {
  const address = implementationAddressSchema.parse({
    ...target,
    kind: 'implementation'
  })
  const layout = layouts.find(
    (candidate) => candidate.collection === address.collection && candidate.kind === 'implementation'
  )
  if (!layout) {
    throw new DatabaseError('INVALID_QUERY', messages.query)
  }
  const row = connection.orm
    .select()
    .from(layout.table)
    .where(eq(keyExpression(layout), address.key))
    .get()
  // Схема выбранной коллекции проверяет соответствие DTO конкретному C.
  return row ? (decodeEntry(connection, layout, row).value as ImplementationValue<C>) : undefined
}

/**
 * Выполняет типизированные COUNT и SELECT с общим предикатом в одной транзакции.
 * Фильтры применяются до LIMIT, связанные данные читаются только для записей страницы.
 */
export function listRecords<C extends Collection>(connection: Connection, input: ListQuery<C>): RecordPage<C> {
  const parsed = listQuerySchema.safeParse(input)
  if (!parsed.success) {
    throw new DatabaseError('INVALID_QUERY', messages.query, undefined, parsed.error)
  }
  const query = parsed.data
  const layout = layouts.find((candidate) => candidate.collection === query.collection)
  if (!layout) {
    throw new DatabaseError('INVALID_QUERY', messages.query)
  }
  const predicate = listFilter(layout, query)
  return connection.client.transaction(() => {
    const total = connection.orm.select({ total: count() }).from(layout.table).where(predicate).get()?.total ?? 0
    const rows = connection.orm
      .select()
      .from(layout.table)
      .where(predicate)
      .orderBy(keyExpression(layout))
      .limit(query.limit)
      .offset(query.offset)
      .all()
    const items = rows.map((row) => {
      // Коллекция C выбирает одну таблицу и соответствующую схему DTO.
      return decodeEntry(connection, layout, row).value as RecordValue<C>
    })
    return { total, items }
  })()
}
