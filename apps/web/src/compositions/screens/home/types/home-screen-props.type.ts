import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента Home.
 */
export interface HomeScreenParams {
  /* Язык витрины и подготовленного каталога. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента Home.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства компонента Home.
 */
export type HomeScreenProps = RootAttrs & HomeScreenParams
