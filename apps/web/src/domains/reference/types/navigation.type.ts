import type { ReferenceCatalogSummary, ReferenceSummary } from '@l2ce/core/reference'

/**
 * Карточка выбора протокола с реальной полнотой его каталога.
 */
export interface ProtocolCard extends ReferenceCatalogSummary {
  /* Число применимых документов, включая неполные описания. */
  readonly documentCount: number
  /* Установленные регионы; пустой список означает отсутствие данных. */
  readonly regions: readonly string[]
}

/**
 * Статический индекс документов одного профиля и выбранного языка.
 */
export interface SearchDocument extends ReferenceSummary {
  /* Нормализованный текст поиска; другие переводы не включаются. */
  readonly searchText: string
  /* Составной опкод с сохранением разрядности; null для неизвестного. */
  readonly opcodeLabel: string | null
  /* Локальный URL без префикса публикации. */
  readonly href: string
}

/**
 * Цель переключения профиля с сохранением применимой логической карточки.
 */
export interface ProtocolTarget {
  /* Точный ключ профиля без protocol:. */
  readonly value: string
  /* Локализованное название профиля. */
  readonly label: string
  /* Документ либо обзор с явной отметкой отсутствия применимости. */
  readonly href: string
  /* Явно применимые карточки для контекстного переключения протокола. */
  readonly documentKeys: readonly string[]
}

/**
 * Контекст навигации внутри профиля; пустой объект означает обзор.
 */
export interface ReferenceLocation {
  /* Выбранный вид материала, отсутствует на обзоре. */
  readonly kind?: ReferenceSummary['kind']
  /* Логическая карточка, отсутствует на странице списка. */
  readonly documentKey?: string
}
