import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { DocumentScreen } from 'compositions/screens/document/server';
import { getDocument, getDocumentRoutes } from 'domains/reference/server';
import { documentPath } from 'domains/reference';
import type { DocumentRoute } from 'domains/reference';
import { routeMetadata } from '../../../../../helpers/route-metadata';
import type { EnglishDocumentPageProps } from '../../../../../types/route-props.type';

export const dynamicParams = false;

/**
 * Перечисляет все применимые английские документы без locale-префикса.
 */
export function generateStaticParams(): Omit<DocumentRoute, 'locale'>[] {
  return getDocumentRoutes()
    .filter((route) => route.locale === 'en')
    .map(({ protocol, kind, code }) => ({ protocol, kind, code }));
}

/**
 * Формирует каноническую ссылку конкретного английского документа.
 */
export async function generateMetadata({
  params,
}: EnglishDocumentPageProps): Promise<Metadata> {
  const { protocol, kind, code } = await params;
  const key = `${kind}:${code}`;
  return routeMetadata(
    getDocument(protocol, 'en', key).document.title,
    documentPath('en', protocol, key),
    'en',
  );
}

/**
 * Подключает готовое серверное чтение документа к URL.
 */
export default async function DocumentPage({
  params,
}: EnglishDocumentPageProps): Promise<ReactElement> {
  return <DocumentScreen {...await params} locale="en" />;
}
