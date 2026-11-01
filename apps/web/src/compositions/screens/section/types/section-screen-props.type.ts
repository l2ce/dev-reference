import type { ComponentPropsWithoutRef } from 'react'
import type { ProtocolRoute, ReferenceDocument } from 'domains/reference'

/**
 * Параметры каталога самостоятельного раздела документации.
 */
export interface SectionScreenParams extends ProtocolRoute {
  /* Вид документов выбранного раздела. */
  readonly kind: ReferenceDocument['kind']
}

/**
 * Атрибуты корневого раздела без управляемого содержимого.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Контракт экрана списка статей, сценариев или пакетов.
 */
export type SectionScreenProps = SectionScreenParams & RootAttrs
