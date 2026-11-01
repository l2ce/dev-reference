import { getProtocolRoutes } from 'domains/reference/server'
import type { ProtocolRoute } from 'domains/reference'

/**
 * Перечисляет параметры английских протоколов без дополнительного языкового URL.
 */
export function englishProtocolParams(): Omit<ProtocolRoute, 'locale'>[] {
  return getProtocolRoutes()
    .filter((route) => route.locale === 'en')
    .map(({ protocol }) => ({ protocol }))
}

/**
 * Перечисляет профили только языковых веток с явным префиксом.
 */
export function localizedProtocolParams(): ProtocolRoute[] {
  return getProtocolRoutes().filter((route) => route.locale !== 'en')
}
