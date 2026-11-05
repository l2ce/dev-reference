import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactElement } from 'react'
import { ChronicleScreen } from 'compositions/screens/chronicle/server'
import { chroniclePath } from 'domains/reference'
import { getChronicle, getChronicleRoutes } from 'domains/reference/server'
import { routeMetadata } from '../../../helpers/route-metadata'
import { staticChronicleParams } from '../../../helpers/static-chronicle-params'
import type { EnglishChroniclePageProps } from '../../../types/route-props.type'

export const dynamicParams = false

/**
 * Перечисляет английские страницы хроник без языкового префикса.
 */
export function generateStaticParams(): { chronicle: string }[] {
  return staticChronicleParams(getChronicleRoutes(), 'en').map(({ chronicle }) => ({ chronicle }))
}

/**
 * Формирует канонические метаданные карточки хроники.
 */
export async function generateMetadata({ params }: EnglishChroniclePageProps): Promise<Metadata> {
  const { chronicle } = await params
  const details = getChronicle(chronicle, 'en')
  if (details === null) {
    notFound()
  }
  return routeMetadata(details.profile.title, chroniclePath('en', chronicle), 'en')
}

/**
 * Подключает серверную страницу истории хроники.
 */
export default async function ChroniclePage({ params }: EnglishChroniclePageProps): Promise<ReactElement> {
  return <ChronicleScreen chronicle={(await params).chronicle} locale="en" />
}
