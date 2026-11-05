import type { ComponentPropsWithoutRef } from 'react'
import type { CatalogChronicle, CatalogProtocol, CatalogRecord } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Содержимое визуальной группы ветки либо протоколов с неизвестной принадлежностью.
 */
export type CatalogGroupParams = {
  /** Раскрывает дополнительные совпадения при активном поиске или фильтре. */
  readonly expandAdditional?: boolean
  /** Регионы — динамические колонки таблицы. */
  readonly regions: readonly CatalogRecord[]
  /** Стабильный якорь раздела. */
  readonly groupId: string
  /** Название ветки либо явного незавершённого контекста. */
  readonly title: string
  /** Хроники установленной ветки. */
  readonly chronicles: readonly CatalogChronicle[]
  /** Протоколы без установленной принадлежности. */
  readonly protocols: readonly CatalogProtocol[]
  /** Язык подписей и ссылок. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента CatalogGroup.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children' | 'id' | 'title' | 'aria-labelledby'>

/**
 * Свойства компонента CatalogGroup.
 */
export type CatalogGroupProps = RootAttrs & CatalogGroupParams
