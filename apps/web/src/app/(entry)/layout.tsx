import type { ReactElement } from 'react';
import { RootDocument } from '../document';
import { metadataMessages } from '../config/messages';
import { routeMetadata } from '../helpers/route-metadata';
import type { LayoutChildren } from '../types/route-props.type';

export const metadata = routeMetadata(metadataMessages.title, '/', 'en');

/**
 * Формирует англоязычную HTML-оболочку маршрутов без языкового префикса.
 */
export default function RootLayout({ children }: LayoutChildren): ReactElement {
  return <RootDocument locale="en">{children}</RootDocument>;
}
