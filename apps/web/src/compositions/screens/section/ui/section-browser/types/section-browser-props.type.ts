import type { SearchDocument, ReferenceDocument } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Данные одного самостоятельного раздела; размер ответа не ограничивает поиск.
 */
export interface SectionBrowserProps {
  /* Полный статический индекс только выбранного раздела и языка. */
  readonly documents: readonly SearchDocument[]
  /* Язык подписей. */
  readonly locale: Locale
  /* Вид документов, определяющий доступные фильтры. */
  readonly kind: ReferenceDocument['kind']
}
