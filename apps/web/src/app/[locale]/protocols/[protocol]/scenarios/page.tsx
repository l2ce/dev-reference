import type { ReactElement } from 'react'
import type { Metadata } from 'next'
import { sectionMetadata } from '../../../../helpers/section-metadata'
import { SectionScreen } from 'compositions/screens/section/server'
import { localizedProtocolParams } from '../../../../helpers/route-params'
import { requireLocale } from '../../../../helpers/route-metadata'
import type { ProtocolPageProps } from '../../../../types/route-props.type'
export const dynamicParams = false
export const generateStaticParams = localizedProtocolParams
/**
 * Задаёт канонический адрес локализованного каталога сценариев.
 */
export async function generateMetadata({ params }: ProtocolPageProps): Promise<Metadata> {
  const { protocol, locale } = await params
  return sectionMetadata('scenario', protocol, requireLocale(locale))
}
/**
 * Подключает локализованный каталог сценариев.
 */
export default async function ScenariosPage({ params }: ProtocolPageProps): Promise<ReactElement> {
  const { locale, protocol } = await params
  return <SectionScreen locale={requireLocale(locale)} protocol={protocol} kind="scenario" />
}
