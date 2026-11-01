import type { Locale } from 'shared/localization'

/**
 * Действия после чтения: возврат к разделу и копирование прямой ссылки.
 */
export interface ReadingActionsProps {
  /* Язык подписей. */
  readonly locale: Locale
  /* Безопасный локальный URL раздела, вычисленный доменом. */
  readonly sectionHref: string
}
