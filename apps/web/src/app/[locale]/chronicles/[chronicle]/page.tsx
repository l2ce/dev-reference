import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactElement } from 'react'
import { ChronicleScreen } from 'compositions/screens/chronicle/server'
import { chroniclePath } from 'domains/reference'
import type { ChronicleRoute } from 'domains/reference'
import { getChronicle, getChronicleRoutes, getLocales } from 'domains/reference/server'
import { requireLocale, routeMetadata } from '../../../helpers/route-metadata'
import { staticChronicleParams } from '../../../helpers/static-chronicle-params'
import type { ChroniclePageProps } from '../../../types/route-props.type'

export const dynamicParams = false

/**
 * Перечисляет страницы хроник с явным языковым префиксом.
 */
export function generateStaticParams(): ChronicleRoute[] {
  const chronicles = getChronicleRoutes()
  return getLocales()
    .filter((locale) => locale !== 'en')
    .flatMap((locale) => staticChronicleParams(chronicles, locale))
}

/**
 * Формирует метаданные без подстановки другого перевода.
 */
export async function generateMetadata({ params }: ChroniclePageProps): Promise<Metadata> {
  const { chronicle, locale: rawLocale } = await params
  const locale = requireLocale(rawLocale)
  const details = getChronicle(chronicle, locale)
  if (details === null) {
    notFound()
  }
  return routeMetadata(details.profile.title, chroniclePath(locale, chronicle), locale)
}

/**
 * Соединяет URL с серверной композицией хроники.
 */
export default async function ChroniclePage({ params }: ChroniclePageProps): Promise<ReactElement> {
  const { chronicle, locale } = await params
  return <ChronicleScreen chronicle={chronicle} locale={requireLocale(locale)} />
}
