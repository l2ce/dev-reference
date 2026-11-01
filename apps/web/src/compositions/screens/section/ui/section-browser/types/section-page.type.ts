import type { SearchDocument } from 'domains/reference';

/**
 * Подготовленная страница после поиска по полному разделу.
 */
export interface SectionPage {
  /* Не более 20 документов; порядок исходного каталога сохраняется. */
  readonly items: readonly SearchDocument[];
  /* Число совпадений до ограничения размера страницы. */
  readonly total: number;
  /* Доступный номер страницы, начиная с единицы. */
  readonly currentPage: number;
  /* Число страниц, не меньше единицы даже при пустом результате. */
  readonly pageCount: number;
}
