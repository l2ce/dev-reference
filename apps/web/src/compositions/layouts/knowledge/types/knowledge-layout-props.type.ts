import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { ProtocolRoute } from 'domains/reference';

/**
 * Параметры компонента Knowledge.
 */
export interface KnowledgeLayoutParams extends ProtocolRoute {
  /* Дочернее содержимое компонента; по умолчанию отсутствует. */
  readonly children?: ReactNode;
}

/**
 * Атрибуты корневого элемента компонента Knowledge.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>;

/**
 * Свойства компонента Knowledge.
 */
export type KnowledgeLayoutProps = RootAttrs & KnowledgeLayoutParams;
