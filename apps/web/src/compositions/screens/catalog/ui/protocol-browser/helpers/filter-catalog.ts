import { normalizeSearch } from 'domains/reference'
import type { CatalogProtocol, ProtocolCatalog } from 'domains/reference'
import { isEmptyArray } from 'shared/lib/value-predicates'
import type { CatalogFilters } from '../types/catalog-filters.type'

/**
 * Сопоставляет слова запроса с установленным контекстом ветки, хроники и выпуска.
 */
const matchesContext = (text: string, words: readonly string[]): boolean => words.every((word) => text.includes(word))

/**
 * Отличает точный ключ от номера, который может соответствовать нескольким профилям.
 */
const matchesProtocol = (protocol: CatalogProtocol, context: string, words: readonly string[]): boolean => {
  const text = `${context} ${protocol.searchText}`
  return words.every((word) => {
    if (/^\d+$/.test(word)) {
      return protocol.number === Number(word)
    }
    if (/^(?:protocol:)?\d+-rev-\d+$/.test(word) || /^protocol:\d+$/.test(word)) {
      const key = word.startsWith('protocol:') ? word : `protocol:${word}`
      return protocol.key === key
    }
    return text.includes(word)
  })
}

/**
 * Фильтрует дерево, сохраняя контекст совпадений и неполные записи общего каталога.
 */
export const filterCatalog = (catalog: ProtocolCatalog, filters: CatalogFilters): ProtocolCatalog => {
  const query = normalizeSearch(filters.query).trim()
  if (query === '' && !filters.onlyWithMaterials) {
    return catalog
  }

  const words = query.split(/\s+/).filter((word) => word !== '')

  /**
   * Применяет условие доступности текста вместе с поиском конкретного профиля.
   */
  const isProtocolMatch = (protocol: CatalogProtocol, context: string): boolean =>
    (!filters.onlyWithMaterials || protocol.materialCount > 0) && matchesProtocol(protocol, context, words)

  return {
    regions: catalog.regions,
    branches: catalog.branches.flatMap((branch) => {
      const chronicles = branch.chronicles.flatMap((chronicle) => {
        const chronicleContext = `${branch.searchText} ${chronicle.searchText}`
        const releases = chronicle.releases.flatMap((release) => {
          const context = `${chronicleContext} ${release.searchText}`
          const protocols = release.protocols.filter((protocol) => isProtocolMatch(protocol, context))
          const shouldKeepEmpty = !filters.onlyWithMaterials && matchesContext(context, words)
          if (isEmptyArray(protocols) && !shouldKeepEmpty) {
            return []
          }
          const permitted = new Set(protocols.map((protocol) => protocol.key))
          return [
            {
              ...release,
              protocols,
              unscopedProtocols: release.unscopedProtocols.filter((protocol) => permitted.has(protocol.key)),
              contexts: release.contexts.map((context) => ({
                ...context,
                protocols: context.protocols.filter((protocol) => permitted.has(protocol.key))
              }))
            }
          ]
        })
        const shouldKeepEmpty = !filters.onlyWithMaterials && matchesContext(chronicleContext, words)
        if (isEmptyArray(releases) && !shouldKeepEmpty) {
          return []
        }
        return [{ ...chronicle, releases }]
      })
      const shouldKeepEmpty = !filters.onlyWithMaterials && matchesContext(branch.searchText, words)
      if (isEmptyArray(chronicles) && !shouldKeepEmpty) {
        return []
      }
      return [{ ...branch, chronicles }]
    }),
    unassignedProtocols: catalog.unassignedProtocols.filter((protocol) => isProtocolMatch(protocol, ''))
  }
}

/**
 * Считает точные профили один раз независимо от числа связанных выпусков.
 */
export const countCatalogProtocols = (catalog: ProtocolCatalog): number => {
  const keys = catalog.branches.flatMap((branch) =>
    branch.chronicles.flatMap((chronicle) =>
      chronicle.releases.flatMap((release) => release.protocols.map((protocol) => protocol.key))
    )
  )
  return new Set([...keys, ...catalog.unassignedProtocols.map((protocol) => protocol.key)]).size
}
