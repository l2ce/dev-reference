import { matchesKnowledge } from 'domains/reference'
import type { SearchDocument, ReferenceDocument } from 'domains/reference'
import type { SectionFilters } from '../types/section-filters.type'
import type { SectionPage } from '../types/section-page.type'

/**
 * Предельное число строк на странице самостоятельного раздела.
 */
const PAGE_SIZE = 20

/**
 * Применяет фильтры ко всему набору до пагинации и ограничивает внешний номер страницы.
 * Направление относится только к пакетам; статьи и сценарии не теряются из-за чужого фильтра.
 */
export function selectSectionPage(
  documents: readonly SearchDocument[],
  filters: SectionFilters,
  kind: ReferenceDocument['kind']
): SectionPage {
  const matches = documents.filter(
    (document) =>
      matchesKnowledge(document, filters.query) &&
      (filters.server === 'all' || document.servers.some((server) => server === filters.server)) &&
      (kind !== 'packet' || filters.direction === 'all' || document.direction === filters.direction)
  )
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const currentPage = Math.min(filters.page, pageCount)
  return {
    items: matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    total: matches.length,
    currentPage,
    pageCount
  }
}
