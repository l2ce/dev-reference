import { eq, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { QueryBuilder } from 'drizzle-orm/sqlite-core'
import { entityKinds, ownerCollection } from '../model/entry.js'
import { implementationStorage } from './layout.js'
import { releases } from './schema.js'
import type { StorageLayout } from './storage.types.js'

const builder = new QueryBuilder()

/**
 * Строит вычисляемый ключ как выражение Drizzle из типизированных колонок и подзапросов.
 * Выражение подходит для SELECT, WHERE и ORDER BY; значения передаются параметрами.
 */
export function keyExpression(layout: StorageLayout): SQL<string> {
  if (layout.collection === 'protocols') {
    return sql<string>`'protocol:' || ${layout.table.number} || CASE WHEN ${layout.table.variant} = 0 THEN '' ELSE '-rev-' || ${layout.table.variant} END`
  }
  if (layout.collection === 'release-contexts') {
    const owner = builder.select({ code: releases.code }).from(releases).where(eq(releases.id, layout.table.releaseId))
    return sql<string>`'release-context:' || (${owner}) || ':' || ${layout.table.code}`
  }
  const prefix = `${entityKinds[ownerCollection(layout.collection)]}:`
  if (layout.kind === 'implementation') {
    const storage = implementationStorage[layout.collection]
    const owner = builder
      .select({ code: storage.owners.code })
      .from(storage.owners)
      .where(eq(storage.owners.id, layout.table.ownerId))
    return sql<string>`${prefix} || (${owner}) || ':rev-' || ${layout.table.rev}`
  }
  return sql<string>`${prefix} || ${layout.table.code}`
}
