import type { ComponentPropsWithoutRef } from 'react'
import type { DocumentRoute } from 'domains/reference'

/**
 * Параметры компонента Document.
 */
export type DocumentScreenParams = DocumentRoute

/**
 * Атрибуты корневого элемента компонента Document.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'article'>, 'children'>

/**
 * Свойства компонента Document.
 */
export type DocumentScreenProps = RootAttrs & DocumentScreenParams
