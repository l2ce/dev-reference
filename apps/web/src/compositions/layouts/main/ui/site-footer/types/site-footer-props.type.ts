import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Контекст локализованного подвала страницы.
 */
export interface SiteFooterParams {
  /* Язык заключительной фразы текущей страницы. */
  readonly locale: Locale
}

/**
 * Атрибуты подвала; его содержимое определяется самим компонентом.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'footer'>, 'children'>

/**
 * Свойства подвала с локализацией и атрибутами корневого элемента.
 */
export type SiteFooterProps = RootAttrs & SiteFooterParams
