import type { ProtocolRoute } from 'domains/reference'
import type { Locale } from 'shared/localization'
import { isNonEmptyArray } from 'shared/lib/value-predicates'

/**
 * Непредметный параметр сборки для пустой базы; маршрут удаляется из экспорта.
 */
export const EMPTY_PROTOCOL_CODE = '__empty__'

/**
 * Сохраняет настоящие маршруты либо даёт единственный технический маршрут нужного языка.
 */
export function staticProtocolParams(routes: readonly ProtocolRoute[], locale: Locale): ProtocolRoute[] {
  const localized = routes.filter((route) => route.locale === locale)
  return isNonEmptyArray(localized) ? localized : [{ locale, protocol: EMPTY_PROTOCOL_CODE }]
}
