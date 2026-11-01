import type { Locale } from 'shared/localization';

/**
 * Параметры выбора языка с сохранением текущего адреса документации.
 */
export interface LanguageMenuProps {
  /* Язык текущей страницы, определяемый URL. */
  readonly locale: Locale;
}
