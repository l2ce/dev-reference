import { eq, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { QueryBuilder } from 'drizzle-orm/sqlite-core'
import { entityKinds, ownerCollection } from '../model/entry.js'
import { implementationStorage } from './layout.js'
import { chronicles, chronicleReleases } from './schema.js'
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
  if (layout.collection === 'chronicle-releases') {
    const owner = builder
      .select({ code: chronicles.code })
      .from(chronicles)
      .where(eq(chronicles.id, layout.table.chronicleId))
    return sql<string>`'chronicle:' || (${owner}) || ':' || ${layout.table.code}`
  }
  if (layout.collection === 'release-contexts') {
    const owner = builder
      .select({ key: sql<string>`${chronicles.code} || ':' || ${chronicleReleases.code}` })
      .from(chronicleReleases)
      .innerJoin(chronicles, eq(chronicles.id, chronicleReleases.chronicleId))
      .where(eq(chronicleReleases.id, layout.table.releaseId))
    return sql<string>`'chronicle:' || (${owner}) || ':' || ${layout.table.code}`
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
