import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры компонента NotFound.
 */
export type NotFoundScreenParams = object

/**
 * Атрибуты корневого элемента компонента NotFound.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства компонента NotFound.
 */
export type NotFoundScreenProps = RootAttrs & NotFoundScreenParams
