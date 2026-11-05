import type { ComponentPropsWithoutRef } from 'react'
import type { ChronicleReleaseDetails } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента ReleaseDetails.
 */
export type ReleaseDetailsParams = {
  /** Выпуск с точными региональными свидетельствами. */
  readonly release: ChronicleReleaseDetails
  /** Язык подписей. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента ReleaseDetails.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children' | 'id'>

/**
 * Свойства компонента ReleaseDetails.
 */
export type ReleaseDetailsProps = RootAttrs & ReleaseDetailsParams
