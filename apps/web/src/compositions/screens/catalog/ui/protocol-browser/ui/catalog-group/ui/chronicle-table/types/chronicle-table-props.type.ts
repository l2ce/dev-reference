import type { ComponentPropsWithoutRef } from 'react'
import type { CatalogChronicle, CatalogRecord } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента ChronicleTable.
 */
export type ChronicleTableParams = {
  /** Хроники в уже установленном порядке. */
  readonly chronicles: readonly CatalogChronicle[]
  /** Динамические региональные колонки. */
  readonly regions: readonly CatalogRecord[]
  /** Язык подписей. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента ChronicleTable.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'role' | 'tabIndex'>

/**
 * Свойства компонента ChronicleTable.
 */
export type ChronicleTableProps = RootAttrs & ChronicleTableParams
