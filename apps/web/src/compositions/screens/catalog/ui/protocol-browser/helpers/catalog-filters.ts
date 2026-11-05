import type { CatalogFilters } from '../types/catalog-filters.type'

/**
 * Читает поддерживаемые параметры, сохраняя согласованное пустое состояние для prerender.
 */
export const parseCatalogFilters = (search: string): CatalogFilters => {
  const params = new URLSearchParams(search)
  return {
    query: (params.get('q') ?? '').slice(0, 200),
    onlyWithMaterials: params.get('materials') === 'available'
  }
}

/**
 * Записывает только активные фильтры без служебных значений по умолчанию.
 */
export const serializeCatalogFilters = (filters: CatalogFilters): URLSearchParams => {
  const params = new URLSearchParams()
  if (filters.query !== '') {
    params.set('q', filters.query)
  }
  if (filters.onlyWithMaterials) {
    params.set('materials', 'available')
  }
  return params
}
