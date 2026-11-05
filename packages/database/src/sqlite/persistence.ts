import { is } from 'drizzle-orm'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { entityKey, isImplementation } from '../model/entry.js'
import * as tables from './schema.js'
import { layouts, implementationStorage } from './layout.js'
import { writeEntityRelations, writeImplementationRelations } from './relations.js'
import { planIdentities, internalId } from './identities.js'
import { prepareImportSchema } from './bootstrap.js'
import { DatabaseError } from '../errors.js'
import { sqliteMessages as messages } from './messages.js'
import type { DatabaseSnapshot, DatabaseEntry, EntityEntry } from '../model/model.types.js'
import type { InternalIdentities } from './storage.types.js'
import type { RecordWritten } from '../api/database.types.js'
import type { Connection } from './sqlite.types.js'

/**
 * Записывает карточку через конкретную таблицу: состав и тип каждого поля проверяет TypeScript.
 */
function writeEntity(connection: Connection, entry: EntityEntry, identities: InternalIdentities): void {
  switch (entry.collection) {
    case 'regions': {
      const { id, code, order } = entry.value
      connection.orm.insert(tables.regions).values({ id, code, order }).run()
      break
    }
    case 'countries': {
      const { id, code, order } = entry.value
      connection.orm.insert(tables.countries).values({ id, code, order }).run()
      break
    }
    case 'release-contexts': {
      const { id, code, order, status, releaseKey, regionKey, releasedOn } = entry.value
      connection.orm
        .insert(tables.releaseContexts)
        .values({
          id,
          code,
          order,
          status,
          releasedOn,
          releaseId: internalId(identities, releaseKey),
          regionId: regionKey === null ? null : internalId(identities, regionKey)
        })
        .run()
      break
    }
    case 'branches': {
      const { id, code, order } = entry.value
      connection.orm.insert(tables.branches).values({ id, code, order }).run()
      break
    }
    case 'chronicles': {
      const { id, code, order, branchKey } = entry.value
      connection.orm
        .insert(tables.chronicles)
        .values({
          id,
          code,
          order,
          branchId: internalId(identities, branchKey)
        })
        .run()
      break
    }
    case 'chronicle-releases': {
      const { id, code, order, status, chronicleKey } = entry.value
      connection.orm
        .insert(tables.chronicleReleases)
        .values({
          id,
          code,
          order,
          status,
          chronicleId: internalId(identities, chronicleKey)
        })
        .run()
      break
    }
    case 'protocols': {
      const { id, number, variant, status } = entry.value
      connection.orm.insert(tables.protocols).values({ id, number, variant, status }).run()
      break
    }
    case 'packets': {
      const { id, code, order, name, server, direction } = entry.value
      connection.orm.insert(tables.packets).values({ id, code, order, name, server, direction }).run()
      break
    }
    case 'scenarios': {
      const { id, code, order } = entry.value
      connection.orm.insert(tables.scenarios).values({ id, code, order }).run()
      break
    }
    case 'articles': {
      const { id, code, order } = entry.value
      connection.orm.insert(tables.articles).values({ id, code, order }).run()
      break
    }
  }
}

/**
 * Восстанавливает проверенный снимок с актуальной схемой одной IMMEDIATE-транзакцией.
 * Ошибка возвращает и прежнюю структуру, и данные. Файл и открытые читатели сохраняют свои inode.
 */
export function restoreSnapshot(
  connection: Connection,
  snapshot: DatabaseSnapshot,
  onRecord?: RecordWritten,
  onRecordStart?: RecordWritten
): void {
  connection.client.pragma('foreign_keys = OFF')
  try {
    connection.client
      .transaction(() => {
        prepareImportSchema(connection)
        persistSnapshot(connection, snapshot, onRecord, onRecordStart)
        const violations = connection.client.prepare('PRAGMA foreign_key_check').all()
        if (violations.length > 0) {
          throw new DatabaseError('DATABASE_INTEGRITY_ERROR', messages.integrity, { violations })
        }
      })
      .immediate()
  } finally {
    connection.client.pragma('foreign_keys = ON')
  }
}

/**
 * Записывает одну публичную запись и её дочерние связи через предварительно распределённые ID.
 * Транзакцией и уведомлениями прогресса владеет сценарий сохранения снимка.
 */
function writeEntry(connection: Connection, entry: DatabaseEntry, identities: InternalIdentities): void {
  const layout = layouts.find((candidate) => candidate.collection === entry.collection && candidate.kind === entry.kind)
  if (!layout) {
    throw new DatabaseError('DATABASE_INTEGRITY_ERROR', messages.integrity)
  }
  if (entry.kind === 'entity') {
    writeEntity(connection, entry, identities)
  } else {
    const table = implementationStorage[entry.collection].implementations
    const { id, rev, status } = entry.value
    connection.orm
      .insert(table)
      .values({
        id,
        rev,
        status,
        ownerId: internalId(identities, entityKey(entry))
      })
      .run()
  }
  if (layout.translations && 'translations' in entry.value) {
    for (const translation of entry.value.translations) {
      connection.orm
        .insert(layout.translations)
        .values({
          ...translation,
          ownerId: entry.value.id
        })
        .run()
    }
  }
  writeEntityRelations(connection, entry, identities)
  if (isImplementation(entry)) {
    writeImplementationRelations(connection, entry, identities)
  }
}

/**
 * Сохраняет проверенный снимок в транзакции вызывающей стороны.
 * Снимок включает все общие записи и переводы; частичная замена языка здесь недопустима.
 */
export function persistSnapshot(
  connection: Connection,
  snapshot: DatabaseSnapshot,
  onRecord?: RecordWritten,
  onRecordStart?: RecordWritten
): void {
  connection.client.pragma('defer_foreign_keys = ON')
  const identities = planIdentities(snapshot)
  // Владелец заменяет только объявленные предметные таблицы, а не произвольные таблицы файла.
  for (const table of Object.values(tables)) {
    if (is(table, SQLiteTable)) {
      connection.orm.delete(table).run()
    }
  }
  connection.orm
    .insert(tables.locales)
    .values(snapshot.locales.map((code, position) => ({ code, position })))
    .run()
  connection.orm
    .insert(tables.metadata)
    .values({
      id: 1,
      schemaVersion: snapshot.schemaVersion,
      dataVersion: snapshot.dataVersion,
      defaultLocale: snapshot.defaultLocale
    })
    .run()
  let completed = 0
  for (const entry of snapshot.entries) {
    onRecordStart?.(entry, completed, snapshot.entries.length)
    writeEntry(connection, entry, identities)
    onRecord?.(entry, ++completed, snapshot.entries.length)
  }
}
