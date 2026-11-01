import type { Locale } from 'shared/localization';

/**
 * Параметры компонента SiteHeader.
 */
export interface SiteHeaderProps {
  /* Язык текущей статической страницы. */
  readonly locale: Locale;
}
