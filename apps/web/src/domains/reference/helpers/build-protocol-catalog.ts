import type { ReferenceCatalogSummary, ReferenceReader } from '@l2ce/core/reference'
import { isNonEmptyString, isNotDefined } from 'shared/lib/value-predicates'
import type { Locale } from 'shared/localization'
import { collectPages } from './collect-pages'
import { normalizeSearch } from './knowledge-search'
import type { CatalogProtocol, CatalogRecord, ProtocolCatalog } from '../types/protocol-catalog.type'

/**
 * Оставляет только данные названия и поиска, необходимые каталогу.
 */
const prepareCatalogRecord = (record: ReferenceCatalogSummary): CatalogRecord => ({
  order: record.order ?? null,
  key: record.key,
  title: record.title,
  translationStatus: record.translationStatus,
  searchText: normalizeSearch(`${record.key} ${record.title}`)
})

/**
 * Сохраняет игровой номер отдельно от внутреннего различителя профиля.
 */
const prepareCatalogProtocol = (
  protocol: ReferenceCatalogSummary,
  reader: ReferenceReader,
  locale: Locale
): CatalogProtocol => {
  if (isNotDefined(protocol.number) || isNotDefined(protocol.variant)) {
    throw new Error(`У протокола ${protocol.key} отсутствует номер или различитель.`)
  }

  return {
    ...prepareCatalogRecord(protocol),
    number: protocol.number,
    variant: protocol.variant,
    materialCount: countReadableMaterials(reader, protocol.key, locale)
  }
}

/**
 * Считает тексты применимых знаний, отличая пустые карточки и отсутствующие переводы.
 */
const countReadableMaterials = (reader: ReferenceReader, protocol: string, locale: Locale): number => {
  const summaries = collectPages((offset) => reader.knowledge({ protocol, locale, offset, limit: 100 }))
  const keys = summaries.filter((summary) => summary.availability === 'available').map((summary) => summary.key)
  let materialCount = 0

  for (let offset = 0; offset < keys.length; offset += 50) {
    const documents = reader.read({ protocol, locale, keys: keys.slice(offset, offset + 50) }).items
    materialCount += documents.filter((document) => isNonEmptyString(document.markdown?.trim())).length
  }

  return materialCount
}

/**
 * Строит каталог по явным связям, сохраняя M:N, пустые записи и все страницы API.
 */
export const buildProtocolCatalog = (reader: ReferenceReader, locale: Locale): ProtocolCatalog => {
  const branches = collectPages((offset) => reader.catalog({ collection: 'branches', locale, offset, limit: 100 }))
  const regions = collectPages((offset) => reader.catalog({ collection: 'regions', locale, offset, limit: 100 }))
  const contexts = collectPages((offset) =>
    reader.catalog({ collection: 'release-contexts', locale, offset, limit: 100 })
  )
  const chronicles = collectPages((offset) => reader.catalog({ collection: 'chronicles', locale, offset, limit: 100 }))
  const releases = collectPages((offset) => reader.catalog({ collection: 'releases', locale, offset, limit: 100 }))
  const protocols = collectPages((offset) => reader.protocols({ locale, offset, limit: 100 })).map((protocol) =>
    prepareCatalogProtocol(protocol, reader, locale)
  )
  const protocolsByKey = new Map(protocols.map((protocol) => [protocol.key, protocol]))
  const assignedKeys = new Set(releases.flatMap((release) => release.protocolKeys ?? []))

  /**
   * Разрешает только существующие связи, не подставляя соседний профиль.
   */
  const resolveProtocols = (keys: readonly string[]): CatalogProtocol[] =>
    keys.map((key) => {
      const protocol = protocolsByKey.get(key)
      if (isNotDefined(protocol)) {
        throw new Error(`Ссылка на отсутствующий протокол ${key}.`)
      }
      return protocol
    })

  return {
    regions: regions.map((region) => ({ ...prepareCatalogRecord(region), summary: region.summary })),
    branches: branches.map((branch) => ({
      ...prepareCatalogRecord(branch),
      chronicles: chronicles
        .filter((chronicle) => chronicle.branchKey === branch.key)
        .map((chronicle) => ({
          ...prepareCatalogRecord(chronicle),
          releases: releases
            .filter((release) => release.chronicleKey === chronicle.key)
            .map((release) => ({
              ...prepareCatalogRecord(release),
              contexts: contexts
                .filter((context) => context.releaseKey === release.key)
                .map((context) => ({
                  ...prepareCatalogRecord(context),
                  regionKey: context.regionKey ?? null,
                  releasedOn: context.releasedOn ?? null,
                  protocols: resolveProtocols(context.protocolKeys ?? [])
                })),
              unscopedProtocols: resolveProtocols(release.unscopedProtocolKeys ?? []),
              protocols: resolveProtocols(release.protocolKeys ?? [])
            }))
        }))
    })),
    unassignedProtocols: protocols.filter((protocol) => !assignedKeys.has(protocol.key))
  }
}
