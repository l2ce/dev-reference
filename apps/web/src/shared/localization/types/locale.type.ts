import type { SUPPORTED_LOCALES } from '../config/locales'

/**
 * Язык статической страницы и выбранного перевода документа.
 */
export type Locale = (typeof SUPPORTED_LOCALES)[number]
