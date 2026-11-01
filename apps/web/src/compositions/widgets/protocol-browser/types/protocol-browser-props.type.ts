import type { ComponentPropsWithoutRef } from 'react';
import type { ProtocolCard } from 'domains/reference';
import type { Locale } from 'shared/localization';

/**
 * Параметры компонента ProtocolFilter.
 */
export interface ProtocolBrowserParams {
  /* Полный сериализуемый список из сборочного снимка. */
  readonly protocols: readonly ProtocolCard[];
  /* Язык подписей и ссылок. */
  readonly locale: Locale;
}

/**
 * Атрибуты корневого элемента компонента ProtocolFilter.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>;

/**
 * Свойства компонента ProtocolFilter.
 */
export type ProtocolBrowserProps = RootAttrs & ProtocolBrowserParams;
