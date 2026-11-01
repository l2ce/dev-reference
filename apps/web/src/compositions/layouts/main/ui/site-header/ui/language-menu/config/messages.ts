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
  { locale: 'en', label: 'English', code: 'EN' },
  { locale: 'ru', label: 'Русский', code: 'RU' }
] as const
