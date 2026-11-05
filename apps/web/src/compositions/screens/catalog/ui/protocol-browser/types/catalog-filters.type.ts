/**
 * Фильтры каталога, сохраняемые в адресе страницы.
 */
export type CatalogFilters = {
  /** Номер, точный ключ или слова из названия контекста. */
  readonly query: string
  /** Показывать только профили с доступными текстами текущего языка. */
  readonly onlyWithMaterials: boolean
}
