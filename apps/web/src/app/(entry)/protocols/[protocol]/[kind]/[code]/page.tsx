import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactElement } from 'react'
import { DocumentScreen } from 'compositions/screens/document/server'
import { getDocument, getDocumentRoutes, getProtocolRoutes } from 'domains/reference/server'
import { documentPath } from 'domains/reference'
import type { DocumentRoute } from 'domains/reference'
import { routeMetadata } from '../../../../../helpers/route-metadata'
import { EMPTY_DOCUMENT_CODE, staticDocumentParams } from '../../../../../helpers/static-document-params'
import type { EnglishDocumentPageProps } from '../../../../../types/route-props.type'

export const dynamicParams = false

/**
 * Перечисляет все применимые английские документы без locale-префикса.
 */
export function generateStaticParams(): Omit<DocumentRoute, 'locale'>[] {
  return staticDocumentParams(getDocumentRoutes(), getProtocolRoutes(), 'en').map(({ protocol, kind, code }) => ({
    protocol,
    kind,
    code
  }))
}

/**
 * Формирует каноническую ссылку конкретного английского документа.
 */
export async function generateMetadata({ params }: EnglishDocumentPageProps): Promise<Metadata> {
  const { protocol, kind, code } = await params
  if (code === EMPTY_DOCUMENT_CODE) {
    notFound()
  }
  const key = `${kind}:${code}`
  return routeMetadata(getDocument(protocol, 'en', key).document.title, documentPath('en', protocol, key), 'en')
}

/**
 * Подключает готовое серверное чтение документа к URL.
 *
 * Используется для:
 *  - чтения английского документа или завершения технического маршрута сборки через 404
 */
export default async function DocumentPage({ params }: EnglishDocumentPageProps): Promise<ReactElement> {
  const route = await params
  if (route.code === EMPTY_DOCUMENT_CODE) {
    notFound()
  }
  return <DocumentScreen {...route} locale="en" />
}
