import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента CatalogControls.
 */
export type CatalogControlsParams = {
  /** Текущий поисковый запрос. */
  readonly query: string
  /** Ограничение профилями с доступными текстами. */
  readonly onlyWithMaterials: boolean
  /** Количество уникальных найденных профилей. */
  readonly protocolCount: number
  /** Язык подписей. */
  readonly locale: Locale
  /** Передаёт изменённый поисковый запрос владельцу URL-состояния. */
  readonly onQueryChange: (query: string) => void
  /** Переключает ограничение по доступности материалов. */
  readonly onAvailabilityChange: (onlyWithMaterials: boolean) => void
}

/**
 * Атрибуты корневого элемента компонента CatalogControls.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства компонента CatalogControls.
 */
export type CatalogControlsProps = RootAttrs & CatalogControlsParams
