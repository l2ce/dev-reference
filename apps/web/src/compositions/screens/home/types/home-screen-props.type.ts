import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента Home.
 */
export type HomeScreenParams = {
  /** Язык знакомства со справочником. */
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
