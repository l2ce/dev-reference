import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import { HomeScreen } from 'compositions/screens/home/server'
import { getLocales } from 'domains/reference/server'
import { metadataMessages } from '../config/messages'
import { requireLocale, routeMetadata } from '../helpers/route-metadata'
import type { LocalePageProps } from '../types/route-props.type'

export const dynamicParams = false

/**
 * Перечисляет все поддерживаемые языковые страницы каталога.
 */
export function generateStaticParams(): { locale: string }[] {
  return getLocales()
    .filter((locale) => locale !== 'en')
    .map((locale) => ({ locale }))
}

/**
 * Формирует локализованные метаданные каталога.
 */
export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale)
  return routeMetadata(metadataMessages.title, `/${locale}/`, locale)
}

/**
 * Подключает каталог к языковому URL без передачи framework-props в DOM.
 */
export default async function CatalogPage({ params }: LocalePageProps): Promise<ReactElement> {
  return <HomeScreen locale={requireLocale((await params).locale)} />
}
