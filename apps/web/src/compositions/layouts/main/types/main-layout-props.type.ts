import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { Locale } from 'shared/localization'

/**
 * Параметры компонента Main.
 */
export interface MainLayoutParams {
  /* Дочернее содержимое компонента; по умолчанию отсутствует. */
  readonly children: ReactNode
  /* Язык интерфейса каркаса. */
  readonly locale: Locale
}

/**
 * Атрибуты корневого элемента компонента Main.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства компонента Main.
 */
export type MainLayoutProps = RootAttrs & MainLayoutParams
