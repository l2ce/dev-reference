import type { ComponentPropsWithoutRef } from 'react'
import type { ReferenceDocument } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента DocumentDetails.
 */
export interface DocumentDetailsParams {
  /* Язык подписей. */
  readonly locale: Locale
  /* Контекст выбранной редакции без самостоятельного чтения базы. */
  readonly document: ReferenceDocument
  /* Источники текста и фактически включённых материалов. */
  readonly sources: ReferenceDocument['sources']
}

/**
 * Атрибуты корневого элемента компонента DocumentDetails.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'aside'>, 'children'>

/**
 * Свойства компонента DocumentDetails.
 */
export type DocumentDetailsProps = RootAttrs & DocumentDetailsParams
