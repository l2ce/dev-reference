import type { MetadataRoute } from 'next'
import { documentPath, protocolPath, sectionPath, KNOWLEDGE_SECTIONS } from 'domains/reference'
import { localePath } from 'shared/localization'
import { getDocumentRoutes, getLocales, getProtocolRoutes } from 'domains/reference/server'
import { siteConfig } from 'infra/site-config'

export const dynamic = 'force-static'

/**
 * Перечисляет канонические URL из того же снимка, что и страницы справочника.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    ...getLocales().flatMap((locale) => [localePath(locale), localePath(locale, '/protocols/')]),
    ...getProtocolRoutes().flatMap((route) =>
      KNOWLEDGE_SECTIONS.map((section) => sectionPath(route.locale, route.protocol, section.kind))
    ),
    ...getProtocolRoutes().map((route) => protocolPath(route.locale, route.protocol)),
    ...getDocumentRoutes().map((route) => documentPath(route.locale, route.protocol, `${route.kind}:${route.code}`))
  ]
  return paths.map((path) => ({
    url: new URL(path.replace(/^\//, ''), siteConfig.siteUrl).href
  }))
}
