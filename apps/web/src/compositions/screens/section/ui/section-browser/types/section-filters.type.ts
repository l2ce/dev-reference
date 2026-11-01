/**
 * Проверенные фильтры статического списка; page начинается с единицы.
 */
export interface SectionFilters {
  /* Поиск по содержимому выбранного языка. */
  readonly query: string;
  /* Необязательное ограничение канала. */
  readonly server: 'all' | 'login' | 'game';
  /* Необязательное ограничение направления пакета. */
  readonly direction: 'all' | 'client-to-server' | 'server-to-client';
  /* Положительный номер страницы; фактический размер ограничивается результатом. */
  readonly page: number;
}
