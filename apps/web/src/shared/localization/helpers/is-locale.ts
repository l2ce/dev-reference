import { isOneOf } from 'shared/lib/value-predicates'
import { SUPPORTED_LOCALES } from '../config/locales'
import type { Locale } from '../types/locale.type'

/**
 * Проверяет язык URL до обращения к словарям.
 */
export function isLocale(value: unknown): value is Locale {
  return isOneOf(value, SUPPORTED_LOCALES)
}
