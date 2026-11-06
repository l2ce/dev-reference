import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import { ProtocolScreen } from 'compositions/screens/protocol/server'
import { protocolPath } from 'domains/reference'
import type { ProtocolRoute } from 'domains/reference'
import { getProtocol } from 'domains/reference/server'
import { localizedProtocolParams, requireStaticProtocol } from '../../../helpers/route-params'
import { requireLocale, routeMetadata } from '../../../helpers/route-metadata'
import type { ProtocolPageProps } from '../../../types/route-props.type'

export const dynamicParams = false

/**
 * Перечисляет все точные протоколы вместе с языками.
 */
export function generateStaticParams(): ProtocolRoute[] {
  return localizedProtocolParams()
}

/**
 * Подключает название профиля к метаданным URL.
 */
export async function generateMetadata({ params }: ProtocolPageProps): Promise<Metadata> {
  const { protocol, locale: rawLocale } = await params
  const locale = requireLocale(rawLocale)
  return routeMetadata(
    getProtocol(requireStaticProtocol(protocol), locale).profile.title,
    protocolPath(locale, protocol),
    locale
  )
}

/**
 * Подключает серверный экран выбранного профиля.
 */
export default async function ProtocolPage({ params }: ProtocolPageProps): Promise<ReactElement> {
  const { protocol, locale } = await params
  return <ProtocolScreen protocol={requireStaticProtocol(protocol)} locale={requireLocale(locale)} />
}
