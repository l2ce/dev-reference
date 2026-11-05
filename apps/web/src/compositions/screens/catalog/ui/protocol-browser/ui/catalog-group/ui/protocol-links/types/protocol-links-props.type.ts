import type { ComponentPropsWithoutRef } from 'react'
import type { CatalogProtocol } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента ProtocolLinks.
 */
export type ProtocolLinksParams = {
  /** Точные протоколы одного выпуска либо группы неизвестной принадлежности. */
  readonly protocols: readonly CatalogProtocol[]
  /** Название контекста для доступного имени ссылки. */
  readonly context: string
  /** Язык ссылок и подписей доступности. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента ProtocolLinks.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства компонента ProtocolLinks.
 */
export type ProtocolLinksProps = RootAttrs & ProtocolLinksParams
