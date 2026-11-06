import { DatabaseError } from '@l2ce/database'
import type { EntityCollection, RecordAddress, RevisionCollection } from '@l2ce/database'
import { referenceKey, protocolReferenceSchema } from '@l2ce/core/reference'
import { cliMessages as messages } from '../locales/ru.js'
import type { ProductGroup } from '../input/arguments.types.js'

export const groupCollections = {
  branches: 'branches',
  sagas: 'sagas',
  chronicles: 'chronicles',
  releases: 'releases',
  contexts: 'release-contexts',
  regions: 'regions',
  countries: 'countries',
  protocols: 'protocols',
  packets: 'packets',
  scenarios: 'scenarios',
  articles: 'articles'
} as const satisfies Record<ProductGroup, EntityCollection>
export const groupKinds = {
  branches: 'branch',
  sagas: 'saga',
  chronicles: 'chronicle',
  releases: 'release',
  contexts: 'release-context',
  regions: 'region',
  countries: 'country',
  protocols: 'protocol',
  packets: 'packet',
  scenarios: 'scenario',
  articles: 'article'
} as const

/**
 * Возвращает коллекцию технических редакций, отклоняя каталоговые группы.
 */
export function revisionCollection(group: ProductGroup): RevisionCollection {
  switch (group) {
    case 'packets':
      return 'packet-revisions'
    case 'scenarios':
      return 'scenario-revisions'
    case 'articles':
      return 'article-revisions'
    default:
      throw new DatabaseError('USAGE', messages.invalidGroup)
  }
}

/**
 * Разрешает короткую командную ссылку в общий адрес базы.
 */
export function commandAddress(group: ProductGroup, value: string, rev?: number): RecordAddress {
  const key = referenceKey(groupKinds[group], value)
  if (group === 'protocols') {
    protocolReferenceSchema.parse(key)
  }
  if (rev !== undefined) {
    return {
      collection: revisionCollection(group),
      kind: 'implementation',
      key: `${key}:rev-${rev}`
    }
  }
  return { collection: groupCollections[group], kind: 'entity', key }
}
