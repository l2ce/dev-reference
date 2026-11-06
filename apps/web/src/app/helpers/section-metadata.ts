import type { Metadata } from 'next'
import { referenceMessages, sectionPath } from 'domains/reference'
import type { ReferenceDocument } from 'domains/reference'
import type { Locale } from 'shared/localization'
import { routeMetadata } from './route-metadata'
import { requireStaticProtocol } from './route-params'

/**
 * Формирует самостоятельный title и canonical для каталога выбранного вида знаний.
 */
export function sectionMetadata(kind: ReferenceDocument['kind'], protocol: string, locale: Locale): Metadata {
  requireStaticProtocol(protocol)
  return routeMetadata(
    `${referenceMessages[locale].sections[kind]} · ${protocol}`,
    sectionPath(locale, protocol, kind),
    locale
  )
}
