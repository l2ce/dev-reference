import type { ComponentPropsWithoutRef } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента CopyConfiguration.
 */
export type CopyConfigurationParams = {
  /** Точный JSON, показанный пользователю в блоке подключения. */
  readonly configuration: string
  /** Язык подписи и результата копирования. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента CopyConfiguration.
 */
type RootAttrs = Pick<ComponentPropsWithoutRef<'div'>, 'className'>

/**
 * Свойства компонента CopyConfiguration.
 */
export type CopyConfigurationProps = RootAttrs & CopyConfigurationParams
