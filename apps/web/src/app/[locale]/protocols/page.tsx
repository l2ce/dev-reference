import type { ReactElement } from 'react'
import type { Metadata } from 'next'
import { CatalogScreen } from 'compositions/screens/catalog/server'
import { getLocales } from 'domains/reference/server'
import { localePath } from 'shared/localization'
import { requireLocale, routeMetadata } from '../../helpers/route-metadata'
import { metadataMessages } from '../../config/messages'
import type { LocalePageProps } from '../../types/route-props.type'

export const dynamicParams = false

/**
 * Перечисляет поддерживаемые локализованные каталоги.
 */
export function generateStaticParams(): { locale: string }[] {
  return getLocales()
    .filter((locale) => locale !== 'en')
    .map((locale) => ({ locale }))
}

/**
 * Создаёт метаданные локализованного каталога.
 */
export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale)
  return routeMetadata(metadataMessages[locale].catalog, localePath(locale, '/protocols/'), locale)
}

/**
 * Подключает каталог к языковой ветке.
 */
export default async function CatalogPage({ params }: LocalePageProps): Promise<ReactElement> {
  return <CatalogScreen locale={requireLocale((await params).locale)} />
}
