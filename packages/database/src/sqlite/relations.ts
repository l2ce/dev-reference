import { eq } from 'drizzle-orm'
import { DatabaseError } from '../errors.js'
import { entityKey } from '../model/entry.js'
import { internalId, publicKey } from './identities.js'
import * as tables from './schema.js'
import { implementationStorage } from './layout.js'
import { sqliteMessages as messages } from './messages.js'
import type { DatabaseEntry, ImplementationEntry } from '../model/model.types.js'
import type { Connection } from './sqlite.types.js'
import type { RecordRow, StoredRelations, StorageLayout, InternalIdentities } from './storage.types.js'

/**
 * Сохраняет связи карточки через типизированные INSERT; транзакцией владеет сценарий записи.
 */
export function writeEntityRelations(
  connection: Connection,
  entry: DatabaseEntry,
  identities: InternalIdentities
): void {
  const id = entry.value.id
  if (entry.collection === 'protocols') {
    entry.value.loginRevisions.forEach((number, position) =>
      connection.orm.insert(tables.protocolLoginRevisions).values({ protocolId: id, number, position }).run()
    )
  }
  if (entry.collection === 'release-contexts') {
    entry.value.protocolKeys.forEach((key, position) =>
      connection.orm
        .insert(tables.releaseContextProtocols)
        .values({ contextId: id, protocolId: internalId(identities, key), position })
        .run()
    )
    entry.value.countryKeys.forEach((key, position) =>
      connection.orm
        .insert(tables.releaseContextCountries)
        .values({ contextId: id, countryId: internalId(identities, key), position })
        .run()
    )
  }
  if (entry.collection === 'chronicle-releases') {
    entry.value.protocolKeys.forEach((key, position) =>
      connection.orm
        .insert(tables.chronicleReleaseProtocols)
        .values({
          chronicleReleaseId: id,
          protocolId: internalId(identities, key),
          position
        })
        .run()
    )
  }
  if (entry.collection === 'articles') {
    entry.value.servers.forEach((server, position) =>
      connection.orm.insert(tables.articleServers).values({ articleId: id, server, position }).run()
    )
  }
  if (entry.collection === 'scenarios') {
    entry.value.servers.forEach((server, position) =>
      connection.orm.insert(tables.scenarioServers).values({ scenarioId: id, server, position }).run()
    )
  }
}

/**
 * Сохраняет прямую применимость, опкоды и состояния; Drizzle проверяет форму значений колонок.
 */
export function writeImplementationRelations(
  connection: Connection,
  entry: ImplementationEntry,
  identities: InternalIdentities
): void {
  const storage = implementationStorage[entry.collection]
  const implementationId = entry.value.id
  const ownerId = internalId(identities, entityKey(entry))
  entry.value.protocolKeys.forEach((key, position) =>
    connection.orm
      .insert(storage.protocols)
      .values({
        ownerId,
        implementationId,
        protocolId: internalId(identities, key),
        position
      })
      .run()
  )
  if (entry.collection === 'packet-revisions') {
    entry.value.opcode?.forEach((part, position) =>
      connection.orm
        .insert(tables.packetRevisionOpcodes)
        .values({ ...part, position, packetRevisionId: implementationId })
        .run()
    )
    entry.value.states.forEach((state, position) =>
      connection.orm
        .insert(tables.packetRevisionStates)
        .values({ state, position, packetRevisionId: implementationId })
        .run()
    )
  }
}

/**
 * Читает справочные признаки и связи общей карточки типизированными SELECT.
 */
function readEntityRelations(connection: Connection, layout: StorageLayout, id: string): StoredRelations {
  if (layout.collection === 'protocols') {
    return {
      loginRevisions: connection.orm
        .select()
        .from(tables.protocolLoginRevisions)
        .where(eq(tables.protocolLoginRevisions.protocolId, id))
        .orderBy(tables.protocolLoginRevisions.position)
        .all()
        .map((row) => row.number)
    }
  }
  if (layout.collection === 'release-contexts') {
    return {
      protocolKeys: connection.orm
        .select()
        .from(tables.releaseContextProtocols)
        .where(eq(tables.releaseContextProtocols.contextId, id))
        .orderBy(tables.releaseContextProtocols.position)
        .all()
        .map((row) => publicKey(connection, tables.protocols, row.protocolId)),
      countryKeys: connection.orm
        .select()
        .from(tables.releaseContextCountries)
        .where(eq(tables.releaseContextCountries.contextId, id))
        .orderBy(tables.releaseContextCountries.position)
        .all()
        .map((row) => publicKey(connection, tables.countries, row.countryId))
    }
  }
  if (layout.collection === 'chronicle-releases') {
    return {
      protocolKeys: connection.orm
        .select()
        .from(tables.chronicleReleaseProtocols)
        .where(eq(tables.chronicleReleaseProtocols.chronicleReleaseId, id))
        .orderBy(tables.chronicleReleaseProtocols.position)
        .all()
        .map((row) => publicKey(connection, tables.protocols, row.protocolId))
    }
  }
  if (layout.collection === 'scenarios') {
    return {
      servers: connection.orm
        .select()
        .from(tables.scenarioServers)
        .where(eq(tables.scenarioServers.scenarioId, id))
        .orderBy(tables.scenarioServers.position)
        .all()
        .map((row) => row.server)
    }
  }
  if (layout.collection === 'articles') {
    return {
      servers: connection.orm
        .select()
        .from(tables.articleServers)
        .where(eq(tables.articleServers.articleId, id))
        .orderBy(tables.articleServers.position)
        .all()
        .map((row) => row.server)
    }
  }
  return {}
}

/**
 * Собирает типизированные дочерние данные для DTO; пустые опкоды представлены null.
 */
export function readRelations(connection: Connection, layout: StorageLayout, row: RecordRow): StoredRelations {
  if (layout.kind === 'entity') {
    return readEntityRelations(connection, layout, row.id)
  }
  if (!('ownerId' in row)) {
    throw new DatabaseError('DATABASE_INTEGRITY_ERROR', messages.integrity)
  }
  const storage = implementationStorage[layout.collection]
  const result: StoredRelations = {
    [storage.ownerField]: publicKey(connection, storage.owners, row.ownerId),
    protocolKeys: connection.orm
      .select()
      .from(storage.protocols)
      .where(eq(storage.protocols.implementationId, row.id))
      .orderBy(storage.protocols.position)
      .all()
      .map((item) => publicKey(connection, tables.protocols, item.protocolId))
  }
  if (layout.collection === 'packet-revisions') {
    const opcode = connection.orm
      .select({
        type: tables.packetRevisionOpcodes.type,
        value: tables.packetRevisionOpcodes.value
      })
      .from(tables.packetRevisionOpcodes)
      .where(eq(tables.packetRevisionOpcodes.packetRevisionId, row.id))
      .orderBy(tables.packetRevisionOpcodes.position)
      .all()
    result.opcode = opcode.length ? opcode : null
    result.states = connection.orm
      .select()
      .from(tables.packetRevisionStates)
      .where(eq(tables.packetRevisionStates.packetRevisionId, row.id))
      .orderBy(tables.packetRevisionStates.position)
      .all()
      .map((item) => item.state)
  }
  return result
}
