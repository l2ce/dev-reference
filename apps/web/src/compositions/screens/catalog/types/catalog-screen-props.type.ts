import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента Catalog.
 */
export interface CatalogScreenParams {
  /* Язык каталога и запрашиваемых переводов. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента Catalog.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства компонента Catalog.
 */
export type CatalogScreenProps = RootAttrs & CatalogScreenParams
