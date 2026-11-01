import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { siteConfig } from 'infra/site-config'
import { isLocale } from 'shared/localization'
import type { Locale } from 'shared/localization'
import { metadataMessages } from '../config/messages'

/**
 * Преобразует язык framework-маршрута в проверенный контракт интерфейса.
 */
export function requireLocale(locale: string): Locale {
  if (!isLocale(locale)) {
    notFound()
  }
  return locale
}

/**
 * Создаёт метаданные с каноническим URL, сохраняющим префикс Pages.
 */
export function routeMetadata(title: string, path: string, locale: Locale): Metadata {
  return {
    title: title === metadataMessages.title ? title : `${title} · ${metadataMessages.title}`,
    description: metadataMessages[locale].description,
    metadataBase: new URL(siteConfig.siteUrl),
    alternates: {
      canonical: new URL(path.replace(/^\//, ''), siteConfig.siteUrl).href
    }
  }
}
