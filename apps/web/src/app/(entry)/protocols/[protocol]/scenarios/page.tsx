import type { ReactElement } from 'react'
import type { Metadata } from 'next'
import { sectionMetadata } from '../../../../helpers/section-metadata'
import { SectionScreen } from 'compositions/screens/section/server'
import { englishProtocolParams } from '../../../../helpers/route-params'
import type { EnglishProtocolPageProps } from '../../../../types/route-props.type'
export const dynamicParams = false
export const generateStaticParams = englishProtocolParams
/**
 * Задаёт канонический адрес каталога сценариев.
 */
export async function generateMetadata({ params }: EnglishProtocolPageProps): Promise<Metadata> {
  return sectionMetadata('scenario', (await params).protocol, 'en')
}
/**
 * Подключает самостоятельный каталог сценариев.
 */
export default async function ScenariosPage({ params }: EnglishProtocolPageProps): Promise<ReactElement> {
  return <SectionScreen locale="en" protocol={(await params).protocol} kind="scenario" />
}
