import { and, eq, exists, inArray, or, sql } from 'drizzle-orm'
import type { SQL, SQLWrapper } from 'drizzle-orm'
import { QueryBuilder } from 'drizzle-orm/sqlite-core'
import { DatabaseError } from '../errors.js'
import { sqliteMessages as messages } from './messages.js'
import { ownerCollection } from '../model/entry.js'
import { implementationStorage, layouts } from './layout.js'
import { keyExpression } from './key-expression.js'
import {
  packets,
  scenarioServers,
  articleServers,
  releaseProtocols,
  releaseContexts,
  releaseContextProtocols
} from './schema.js'
import type { ListQuery } from '../api/database.types.js'
import type { Collection, ImplementationCollection } from '../model/model.types.js'
import type { StorageLayout, RecordPredicate } from './storage.types.js'

const builder = new QueryBuilder()

/**
 * Выбирает UUID по читаемому адресу средствами Drizzle, без разбора публичного ключа.
 */
function targetId(collection: Collection, key: string): SQLWrapper {
  const layout = layouts.find((item) => item.collection === collection)
  if (!layout) {
    throw new DatabaseError('INVALID_QUERY', messages.query)
  }
  return builder
    .select({ id: layout.table.id })
    .from(layout.table)
    .where(eq(keyExpression(layout), key))
}

/**
 * Определяет коллекцию редакций по карточке или непосредственно редакции.
 */
function revisionCollection(collection: Collection): ImplementationCollection {
  switch (collection) {
    case 'packets':
    case 'packet-revisions':
      return 'packet-revisions'
    case 'scenarios':
    case 'scenario-revisions':
      return 'scenario-revisions'
    case 'articles':
    case 'article-revisions':
      return 'article-revisions'
    default:
      throw new DatabaseError('INVALID_QUERY', messages.query)
  }
}

/**
 * Строит применимость карточки либо редакции через типизированную таблицу связей.
 */
function protocolCondition(layout: StorageLayout, protocol: string): SQL {
  const profile = targetId('protocols', protocol)
  if (layout.collection === 'release-contexts') {
    return inArray(
      layout.table.id,
      builder
        .select({ id: releaseContextProtocols.contextId })
        .from(releaseContextProtocols)
        .where(inArray(releaseContextProtocols.protocolId, profile))
    )
  }
  if (layout.collection === 'releases') {
    return sql`${or(
      inArray(
        layout.table.id,
        builder
          .select({ id: releaseProtocols.releaseId })
          .from(releaseProtocols)
          .where(inArray(releaseProtocols.protocolId, profile))
      ),
      inArray(
        layout.table.id,
        builder
          .select({ id: releaseContexts.releaseId })
          .from(releaseContexts)
          .innerJoin(releaseContextProtocols, eq(releaseContextProtocols.contextId, releaseContexts.id))
          .where(inArray(releaseContextProtocols.protocolId, profile))
      )
    )}`
  }
  const relation = implementationStorage[revisionCollection(layout.collection)].protocols
  const selected = layout.kind === 'implementation' ? relation.implementationId : relation.ownerId
  return inArray(
    layout.table.id,
    builder.select({ id: selected }).from(relation).where(inArray(relation.protocolId, profile))
  )
}

/**
 * Фильтрует соединение и направление по общим карточкам владельцев.
 */
function communicationFilter(layout: StorageLayout, query: ListQuery): RecordPredicate {
  if (!query.server && !query.direction) {
    return undefined
  }
  const collection = ownerCollection(layout.collection)
  if (collection === 'packets') {
    const condition = and(
      query.server ? eq(packets.server, query.server) : undefined,
      query.direction ? eq(packets.direction, query.direction) : undefined
    )
    if (layout.collection === 'packets') {
      return condition
    }
    if (layout.kind !== 'implementation') {
      throw new DatabaseError('INVALID_QUERY', messages.query)
    }
    return inArray(layout.table.ownerId, builder.select({ id: packets.id }).from(packets).where(condition))
  }
  if (!query.server) {
    return undefined
  }
  const owner = layout.kind === 'implementation' ? layout.table.ownerId : layout.table.id
  if (collection === 'scenarios') {
    return inArray(
      owner,
      builder
        .select({ id: scenarioServers.scenarioId })
        .from(scenarioServers)
        .where(eq(scenarioServers.server, query.server))
    )
  }
  return inArray(
    owner,
    builder.select({ id: articleServers.articleId }).from(articleServers).where(eq(articleServers.server, query.server))
  )
}

/**
 * Ищет подстроку в читаемом ключе и доступных текстах; нормализация не меняет хранимый Markdown.
 */
function searchCondition(layout: StorageLayout, search: string): RecordPredicate {
  const value = search.normalize('NFKC').toLowerCase()
  const conditions: SQL[] = [sql`instr(search_normalize(${keyExpression(layout)}), ${value}) > 0`]
  if (layout.collection === 'packets') {
    conditions.push(sql`instr(search_normalize(${layout.table.name}), ${value}) > 0`)
  }
  if (layout.translations) {
    const translation = layout.translations
    conditions.push(
      exists(
        builder
          .select({ id: translation.ownerId })
          .from(translation)
          .where(
            and(
              eq(translation.ownerId, layout.table.id),
              sql`instr(search_normalize(${translation.title} || char(10) || ${translation.summary}), ${value}) > 0`
            )
          )
      )
    )
  }
  return or(...conditions)
}

/**
 * Объединяет все фильтры перед COUNT/LIMIT. Колонки и параметры принадлежат Drizzle.
 */
export function listFilter(layout: StorageLayout, query: ListQuery): RecordPredicate {
  const conditions: (SQL | undefined)[] = []
  if (query.search) {
    conditions.push(searchCondition(layout, query.search))
  }
  if (query.branchKey && (layout.collection === 'chronicles' || layout.collection === 'sagas')) {
    conditions.push(inArray(layout.table.branchId, targetId('branches', query.branchKey)))
  }
  if (query.sagaKey && layout.collection === 'chronicles') {
    conditions.push(inArray(layout.table.sagaId, targetId('sagas', query.sagaKey)))
  }
  if (query.ownerKey) {
    if (layout.collection === 'releases') {
      conditions.push(inArray(layout.table.chronicleId, targetId('chronicles', query.ownerKey)))
    } else if (layout.collection === 'release-contexts') {
      conditions.push(inArray(layout.table.releaseId, targetId('releases', query.ownerKey)))
    } else if (layout.kind === 'implementation') {
      conditions.push(inArray(layout.table.ownerId, targetId(ownerCollection(layout.collection), query.ownerKey)))
    }
  }
  if (query.releaseKey && layout.collection === 'protocols') {
    conditions.push(
      or(
        inArray(
          layout.table.id,
          builder
            .select({ id: releaseProtocols.protocolId })
            .from(releaseProtocols)
            .where(inArray(releaseProtocols.releaseId, targetId('releases', query.releaseKey)))
        ),
        inArray(
          layout.table.id,
          builder
            .select({ id: releaseContextProtocols.protocolId })
            .from(releaseContextProtocols)
            .innerJoin(releaseContexts, eq(releaseContexts.id, releaseContextProtocols.contextId))
            .where(inArray(releaseContexts.releaseId, targetId('releases', query.releaseKey)))
        )
      )
    )
  }
  if (query.regionKey && layout.collection === 'release-contexts') {
    conditions.push(inArray(layout.table.regionId, targetId('regions', query.regionKey)))
  }
  if (query.protocolKey) {
    conditions.push(protocolCondition(layout, query.protocolKey))
  }
  conditions.push(communicationFilter(layout, query))
  return and(...conditions)
}
