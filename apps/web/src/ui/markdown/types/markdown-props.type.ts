import type { ComponentPropsWithoutRef } from 'react';

/**
 * Параметры компонента Markdown.
 */
export interface MarkdownParams {
  /* Подготовленный Markdown; сырые HTML-вставки не отображаются. */
  readonly markdown: string;
}

/**
 * Атрибуты корневого элемента компонента Markdown.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>;

/**
 * Свойства компонента Markdown.
 */
export type MarkdownProps = RootAttrs & MarkdownParams;
