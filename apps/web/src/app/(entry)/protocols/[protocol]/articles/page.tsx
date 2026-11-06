import type { ReactElement } from 'react'
import type { Metadata } from 'next'
import { sectionMetadata } from '../../../../helpers/section-metadata'
import { SectionScreen } from 'compositions/screens/section/server'
import { englishProtocolParams, requireStaticProtocol } from '../../../../helpers/route-params'
import type { EnglishProtocolPageProps } from '../../../../types/route-props.type'
export const dynamicParams = false
export const generateStaticParams = englishProtocolParams
/**
 * Задаёт канонический адрес каталога статей.
 */
export async function generateMetadata({ params }: EnglishProtocolPageProps): Promise<Metadata> {
  return sectionMetadata('article', (await params).protocol, 'en')
}
/**
 * Подключает самостоятельный каталог статей.
 */
export default async function ArticlesPage({ params }: EnglishProtocolPageProps): Promise<ReactElement> {
  return <SectionScreen locale="en" protocol={requireStaticProtocol((await params).protocol)} kind="article" />
}
