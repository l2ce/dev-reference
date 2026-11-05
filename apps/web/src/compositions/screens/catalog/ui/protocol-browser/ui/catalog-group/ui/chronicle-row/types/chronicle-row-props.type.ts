import type { ComponentPropsWithoutRef } from 'react'
import type { CatalogChronicle, CatalogRecord } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента ChronicleRow.
 */
export type ChronicleRowParams = {
  /** Явные регионы колонок, без вывода региона из номера. */
  readonly regions: readonly CatalogRecord[]
  /** Общая для таблицы колонка неустановленного региона. */
  readonly hasUnknownRegion: boolean
  /** Хроника с выпусками и явно связанными протоколами. */
  readonly chronicle: CatalogChronicle
  /** Язык интерфейса. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента ChronicleRow.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'tbody'>, 'children'>

/**
 * Свойства компонента ChronicleRow.
 */
export type ChronicleRowProps = RootAttrs & ChronicleRowParams
