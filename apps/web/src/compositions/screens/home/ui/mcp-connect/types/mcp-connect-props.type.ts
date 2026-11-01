import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента McpConnect.
 */
export type McpConnectParams = {
  /** Язык описания MCP и действий подключения. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента McpConnect.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'aside'>, 'children' | 'aria-labelledby'>

/**
 * Свойства компонента McpConnect.
 */
export type McpConnectProps = RootAttrs & McpConnectParams
