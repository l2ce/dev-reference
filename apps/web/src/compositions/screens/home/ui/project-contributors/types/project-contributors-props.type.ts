import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента ProjectContributors.
 */
export type ProjectContributorsParams = {
  /** Язык благодарности и состояния списка. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента ProjectContributors.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства компонента ProjectContributors.
 */
export type ProjectContributorsProps = RootAttrs & ProjectContributorsParams
