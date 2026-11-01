import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента KnowledgeOverview.
 */
export type KnowledgeOverviewParams = {
  /** Язык описания разделов справочника. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента KnowledgeOverview.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'dl'>, 'children' | 'aria-label'>

/**
 * Свойства компонента KnowledgeOverview.
 */
export type KnowledgeOverviewProps = RootAttrs & KnowledgeOverviewParams
