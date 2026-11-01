import type { Locale } from '../model/model.types.js'

/**
 * Подписи компактного прогресса и диагностики сбоя мини-CLI.
 */
export const progressMessages = {
  unknown: '?',
  file: 'File',
  /**
   * Показывает текущий этап, когда весь языковой блок не помещается по высоте терминала.
   */
  compact: (phase: string, percent: number): string => `${phase}: ${percent}%`,
  /**
   * Сохраняет имя активной таблицы и её процент в коротком терминале.
   */
  tableCompact: (phase: string, percent: number, table: string, tablePercent: number): string =>
    `${phase}: ${percent}% · ${table}: ${tablePercent}%`,
  languages: { en: 'English', ru: 'Russian' } satisfies Record<Locale, string>,
  statuses: {
    failed: 'ERROR',
    aborted: 'cancelled'
  },
  /**
   * Форматирует имя коллекции с числом записей выбранного языка.
   */
  collectionName: (name: string, total: number | string): string => `${name} (${total}):`,
  /**
   * Форматирует выровненную строку со шкалой и процентом.
   */
  collection: (name: string, bar: string, percent: number): string =>
    `${name} [${bar}] ${String(percent).padStart(3)}%`,
  /**
   * Показывает язык перед его коллекциями и количество языковых блоков.
   */
  locale: (name: string, locale: Locale, position: number, total: number): string =>
    `[${position}/${total}] ${name} (${locale})`,
  /**
   * Выделяет сбой этапа; полный путь выводится отдельной строкой.
   */
  failure: (phase: string, code: string, message: string): string => `ERROR · ${phase} [${code}]: ${message}`
} as const
