import { notFound } from 'next/navigation'
import { getProtocolRoutes, getLocales } from 'domains/reference/server'
import type { ProtocolRoute } from 'domains/reference'
import { EMPTY_PROTOCOL_CODE, staticProtocolParams } from './static-protocol-params'

/**
 * Не допускает технический маршрут сборки до предметных чтений и отображения.
 */
export function requireStaticProtocol(protocol: string): string {
  if (protocol === EMPTY_PROTOCOL_CODE) notFound()
  return protocol
}

/**
 * Перечисляет параметры английских протоколов без дополнительного языкового URL.
 */
export function englishProtocolParams(): Omit<ProtocolRoute, 'locale'>[] {
  return staticProtocolParams(getProtocolRoutes(), 'en').map(({ protocol }) => ({ protocol }))
}

/**
 * Перечисляет профили только языковых веток с явным префиксом.
 */
export function localizedProtocolParams(): ProtocolRoute[] {
  const routes = getProtocolRoutes()
  return getLocales()
    .filter((locale) => locale !== 'en')
    .flatMap((locale) => staticProtocolParams(routes, locale))
}
