import type { Locale } from 'shared/localization'
import { GROUP_MESSAGES } from '../config/messages'

/**
 * Показывает число доступных текстов с корректной формой слова на выбранном языке.
 */
export const getMaterialLabel = (count: number, locale: Locale): string => {
  const messages = GROUP_MESSAGES[locale]
  if (count === 0) {
    return messages.noDescription
  }
  const plural = new Intl.PluralRules(locale).select(count)
  const form = plural === 'one' ? 0 : plural === 'few' ? 1 : 2
  return `${count} ${messages.materials[form]}`
}
