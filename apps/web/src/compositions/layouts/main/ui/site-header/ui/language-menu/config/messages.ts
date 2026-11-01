import englishFlag from '../assets/en.svg'
import russianFlag from '../assets/ru.svg'

/**
 * Подписи меню языка; названия языков приведены на их собственном языке.
 */
export const languageMessages = {
  en: { title: 'Language', hint: 'Change language', selected: 'Selected' },
  ru: { title: 'Язык', hint: 'Выбрать язык', selected: 'Выбран' }
} as const

/**
 * Порядок и читаемые обозначения поддерживаемых языков в меню.
 */
export const LANGUAGE_OPTIONS = [
  { locale: 'en', label: 'English', flag: englishFlag },
  { locale: 'ru', label: 'Русский', flag: russianFlag }
] as const
