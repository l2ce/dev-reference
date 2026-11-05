import { isNonEmptyArray } from 'shared/lib/value-predicates'
import type { DocumentRoute, ProtocolRoute } from 'domains/reference'
import type { Locale } from 'shared/localization'

/**
 * Зарезервированный параметр сборки: подчёркивания запрещены в предметном code.
 * Такой маршрут обязан завершаться через notFound и не является документом базы.
 */
export const EMPTY_DOCUMENT_CODE = '__empty__'

/**
 * Адаптирует пустую библиотеку к требованию Next.js export о непустых static params.
 * Реальные документы возвращает без добавлений; технический маршрут не публикуется.
 */
export function staticDocumentParams(
  documents: readonly DocumentRoute[],
  protocols: readonly ProtocolRoute[],
  locale: Locale
): DocumentRoute[] {
  const routes = documents.filter((route) => route.locale === locale)
  if (isNonEmptyArray(routes)) {
    return routes
  }
  const protocol = protocols.find((route) => route.locale === locale)
  if (!protocol) {
    throw new Error(`Cannot generate document routes without a protocol for locale ${locale}`)
  }
  return [{ ...protocol, kind: 'article', code: EMPTY_DOCUMENT_CODE }]
}
