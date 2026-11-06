import * as tables from './schema.js'
import type { StorageLayout, ImplementationStorage } from './storage.types.js'
import type { ImplementationCollection } from '../model/model.types.js'

/**
 * Конкретные предметные таблицы; порядок не задаёт очередность разрешения FK в транзакции.
 */
export const layouts: readonly StorageLayout[] = [
  { collection: 'sagas', kind: 'entity', table: tables.sagas, translations: tables.sagaTranslations },
  { collection: 'regions', kind: 'entity', table: tables.regions, translations: tables.regionTranslations },
  { collection: 'countries', kind: 'entity', table: tables.countries, translations: tables.countryTranslations },
  {
    collection: 'release-contexts',
    kind: 'entity',
    table: tables.releaseContexts,
    translations: tables.releaseContextTranslations
  },
  {
    collection: 'branches',
    kind: 'entity',
    table: tables.branches,
    translations: tables.branchTranslations
  },
  {
    collection: 'chronicles',
    kind: 'entity',
    table: tables.chronicles,
    translations: tables.chronicleTranslations
  },
  {
    collection: 'releases',
    kind: 'entity',
    table: tables.releases,
    translations: tables.releaseTranslations
  },
  {
    collection: 'protocols',
    kind: 'entity',
    table: tables.protocols,
    translations: tables.protocolTranslations
  },
  { collection: 'packets', kind: 'entity', table: tables.packets },
  { collection: 'scenarios', kind: 'entity', table: tables.scenarios },
  { collection: 'articles', kind: 'entity', table: tables.articles },
  {
    collection: 'packet-revisions',
    kind: 'implementation',
    table: tables.packetRevisions,
    translations: tables.packetRevisionTranslations
  },
  {
    collection: 'scenario-revisions',
    kind: 'implementation',
    table: tables.scenarioRevisions,
    translations: tables.scenarioRevisionTranslations
  },
  {
    collection: 'article-revisions',
    kind: 'implementation',
    table: tables.articleRevisions,
    translations: tables.articleRevisionTranslations
  }
]
/**
 * Физические FK каждого вида ревизий и его предметный владелец.
 */
export const implementationStorage: Readonly<Record<ImplementationCollection, ImplementationStorage>> = {
  'packet-revisions': {
    collection: 'packet-revisions',
    implementations: tables.packetRevisions,
    ownerField: 'packetKey',
    owners: tables.packets,
    protocols: tables.packetProtocols
  },
  'scenario-revisions': {
    collection: 'scenario-revisions',
    implementations: tables.scenarioRevisions,
    ownerField: 'scenarioKey',
    owners: tables.scenarios,
    protocols: tables.scenarioProtocols
  },
  'article-revisions': {
    collection: 'article-revisions',
    implementations: tables.articleRevisions,
    ownerField: 'articleKey',
    owners: tables.articles,
    protocols: tables.articleProtocols
  }
}
