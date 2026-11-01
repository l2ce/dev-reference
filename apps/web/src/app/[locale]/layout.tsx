import type { ReactElement } from 'react';
import { RootDocument } from '../document';
import { requireLocale } from '../helpers/route-metadata';
import type { LocaleLayoutProps } from '../types/route-props.type';

/**
 * Подключает HTML-оболочку с языком статически сгенерированной ветки.
 */
export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps): Promise<ReactElement> {
  const { locale } = await params;
  return <RootDocument locale={requireLocale(locale)}>{children}</RootDocument>;
}
