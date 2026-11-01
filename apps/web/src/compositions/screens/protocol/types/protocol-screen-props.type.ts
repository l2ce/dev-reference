import type { ComponentPropsWithoutRef } from 'react'
import type { ProtocolRoute } from 'domains/reference'

/**
 * Параметры компонента Protocol.
 */
export type ProtocolScreenParams = ProtocolRoute

/**
 * Атрибуты корневого элемента компонента Protocol.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства компонента Protocol.
 */
export type ProtocolScreenProps = RootAttrs & ProtocolScreenParams
