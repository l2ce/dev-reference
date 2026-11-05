import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { ProtocolCatalog } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Параметры интерактивного каталога протоколов.
 */
export type ProtocolBrowserParams = {
  /** Серверное введение в каталог, размещаемое рядом с поиском. */
  readonly children: ReactNode
  /** Полная иерархия из одного сборочного снимка. */
  readonly catalog: ProtocolCatalog
  /** Язык подписей, материалов и ссылок. */
  readonly locale: Locale
}

/**
 * Атрибуты корневой области каталога.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства поиска и просмотра сгруппированного каталога.
 */
export type ProtocolBrowserProps = RootAttrs & ProtocolBrowserParams
