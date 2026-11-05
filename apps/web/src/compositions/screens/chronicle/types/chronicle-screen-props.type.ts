import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента Chronicle.
 */
export type ChronicleScreenParams = {
  /** Постоянный код хроники. */
  readonly chronicle: string
  /** Язык страницы. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента Chronicle.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства компонента Chronicle.
 */
export type ChronicleScreenProps = RootAttrs & ChronicleScreenParams
