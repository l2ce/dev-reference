import type { ComponentPropsWithoutRef } from 'react';

/**
 * Параметры компонента MarkdownTable.
 */
export type MarkdownTableParams = object;

/**
 * Атрибуты корневого элемента компонента MarkdownTable.
 */
type RootAttrs = Pick<
  ComponentPropsWithoutRef<'table'>,
  'children' | 'className'
>;

/**
 * Свойства компонента MarkdownTable.
 */
export type MarkdownTableProps = RootAttrs & MarkdownTableParams;
