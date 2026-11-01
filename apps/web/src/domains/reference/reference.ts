import type { ReferenceCatalogSummary, ReferenceProtocol, ReferenceSummary } from '@l2ce/core/reference'
import { siteConfig } from 'infra/site-config'
import type { Locale } from 'shared/localization'
import { readReference } from './adapters/read-reference'
import { collectPages } from './helpers/collect-pages'
import { prepareDocument } from './helpers/prepare-document'
import type { DocumentRoute, PreparedDocument, ProtocolRoute } from './types/reference.type'

/**
 * Возвращает весь каталог, включая разные профили с одинаковым номером.
 */
export function getProtocols(locale: Locale): readonly ReferenceCatalogSummary[] {
  const { reader } = readReference()
  return collectPages((offset) => reader.protocols({ locale, offset, limit: 100 }))
}

/**
 * Возвращает точный профиль и его исторический контекст.
 */
export function getProtocol(protocol: string, locale: Locale): ReferenceProtocol {
  return readReference().reader.protocol(protocol, locale)
}

/**
 * Читает все применимые знания выбранного профиля, включая отсутствующие переводы.
 */
export function getKnowledge(protocol: string, locale: Locale): readonly ReferenceSummary[] {
  const { reader } = readReference()
  return collectPages((offset) => reader.knowledge({ protocol, locale, offset, limit: 100 }))
}

/**
 * Подготавливает документ и контекстные Markdown-директивы при сборке.
 */
export function getDocument(protocol: string, locale: Locale, key: string): PreparedDocument {
  const context = readReference()
  return prepareDocument(context.reader, protocol, locale, key, siteConfig.basePath, context.packetNames)
}

/**
 * Перечисляет языки, подтверждённые конфигурацией приложения и снимком базы.
 */
export function getLocales(): readonly Locale[] {
  return readReference().locales
}

/**
 * Перечисляет все языковые URL протоколов, обходя пагинацию API.
 */
export function getProtocolRoutes(): ProtocolRoute[] {
  return getLocales().flatMap((locale) =>
    getProtocols(locale).map((protocol) => ({
      locale,
      protocol: protocol.key.replace(/^protocol:/, '')
    }))
  )
}

/**
 * Перечисляет применимые документы каждого точного профиля и языка.
 */
export function getDocumentRoutes(): DocumentRoute[] {
  return getProtocolRoutes().flatMap((route) =>
    getKnowledge(route.protocol, route.locale).map((document) => ({
      ...route,
      kind: document.kind,
      code: document.key.slice(document.kind.length + 1)
    }))
  )
}
