import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactElement } from 'react'
import { DocumentScreen } from 'compositions/screens/document/server'
import { documentPath } from 'domains/reference'
import type { DocumentRoute } from 'domains/reference'
import { getDocument, getDocumentRoutes, getProtocolRoutes } from 'domains/reference/server'
import { requireLocale, routeMetadata } from '../../../../../helpers/route-metadata'
import { EMPTY_DOCUMENT_CODE, staticDocumentParams } from '../../../../../helpers/static-document-params'
import type { DocumentPageProps } from '../../../../../types/route-props.type'

export const dynamicParams = false

/**
 * Перечисляет применимые документы каждого профиля и языка.
 */
export function generateStaticParams(): DocumentRoute[] {
  return staticDocumentParams(getDocumentRoutes(), getProtocolRoutes(), 'ru')
}

/**
 * Создаёт метаданные выбранного перевода документа.
 */
export async function generateMetadata({ params }: DocumentPageProps): Promise<Metadata> {
  const { protocol, locale: rawLocale, kind, code } = await params
  if (code === EMPTY_DOCUMENT_CODE) {
    notFound()
  }
  const locale = requireLocale(rawLocale)
  const key = `${kind}:${code}`
  return routeMetadata(getDocument(protocol, locale, key).document.title, documentPath(locale, protocol, key), locale)
}

/**
 * Подключает готовый экран чтения к статическому маршруту.
 *
 * Используется для:
 *  - чтения локализованного документа или завершения технического маршрута сборки через 404
 */
export default async function DocumentPage({ params }: DocumentPageProps): Promise<ReactElement> {
  const { protocol, locale, kind, code } = await params
  if (code === EMPTY_DOCUMENT_CODE) {
    notFound()
  }
  return <DocumentScreen protocol={protocol} locale={requireLocale(locale)} kind={kind} code={code} />
}
