import type { Locale } from 'shared/localization';

/**
 * Локализация меню настройки общей цветовой схемы.
 */
export interface ThemeMenuProps {
  /* Язык подписей; не влияет на сохранённый режим темы. */
  readonly locale: Locale;
}
