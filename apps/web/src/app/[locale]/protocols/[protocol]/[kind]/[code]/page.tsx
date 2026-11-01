import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import { DocumentScreen } from 'compositions/screens/document/server'
import { documentPath } from 'domains/reference'
import type { DocumentRoute } from 'domains/reference'
import { getDocument, getDocumentRoutes } from 'domains/reference/server'
import { requireLocale, routeMetadata } from '../../../../../helpers/route-metadata'
import type { DocumentPageProps } from '../../../../../types/route-props.type'

export const dynamicParams = false

/**
 * Перечисляет применимые документы каждого профиля и языка.
 */
export function generateStaticParams(): DocumentRoute[] {
  return getDocumentRoutes().filter((route) => route.locale !== 'en')
}

/**
 * Создаёт метаданные выбранного перевода документа.
 */
export async function generateMetadata({ params }: DocumentPageProps): Promise<Metadata> {
  const { protocol, locale: rawLocale, kind, code } = await params
  const locale = requireLocale(rawLocale)
  const key = `${kind}:${code}`
  return routeMetadata(getDocument(protocol, locale, key).document.title, documentPath(locale, protocol, key), locale)
}

/**
 * Подключает готовый экран чтения к статическому маршруту.
 */
export default async function DocumentPage({ params }: DocumentPageProps): Promise<ReactElement> {
  const { protocol, locale, kind, code } = await params
  return <DocumentScreen protocol={protocol} locale={requireLocale(locale)} kind={kind} code={code} />
}
