import type { SectionFilters } from '../types/section-filters.type'

/**
 * Проверяет параметры внешнего URL и нормализует недопустимые значения.
 */
export function parseSectionFilters(search: string): SectionFilters {
  const params = new URLSearchParams(search)
  const server = params.get('server')
  const direction = params.get('direction')
  const page = Number(params.get('page') ?? 1)
  return {
    query: params.get('q') ?? '',
    server: server === 'login' || server === 'game' ? server : 'all',
    direction: direction === 'client-to-server' || direction === 'server-to-client' ? direction : 'all',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1
  }
}

/**
 * Сохраняет только значимые параметры фильтров для повторного открытия списка.
 */
export function serializeSectionFilters(filters: SectionFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.query !== '') {
    params.set('q', filters.query)
  }
  if (filters.server !== 'all') {
    params.set('server', filters.server)
  }
  if (filters.direction !== 'all') {
    params.set('direction', filters.direction)
  }
  if (filters.page > 1) {
    params.set('page', String(filters.page))
  }
  return params
}
