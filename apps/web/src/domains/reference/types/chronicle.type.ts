import type { ReferenceCatalogItem } from '@l2ce/core/reference'
import type { Locale } from 'shared/localization'

/**
 * Независимый URL хроники для статического экспорта.
 */
export type ChronicleRoute = {
  /** Язык страницы. */
  readonly locale: Locale
  /** Постоянный код хроники. */
  readonly chronicle: string
}

/**
 * Контекст выпуска с собственными доказательствами и отдельной географией.
 */
export type ChronicleContextDetails = {
  /** Описание, дата и точная применимость из одной записи. */
  readonly record: ReferenceCatalogItem
  /** Установленный регион без подстановки языка. */
  readonly region: ReferenceCatalogItem | null
  /** Только явно установленные страны. */
  readonly countries: readonly ReferenceCatalogItem[]
}

/**
 * Выпуск хроники с региональными контекстами в редакционном порядке.
 */
export type ChronicleReleaseDetails = {
  /** Собственная карточка выпуска. */
  readonly record: ReferenceCatalogItem
  /** Региональные сведения, включая неизвестный регион. */
  readonly contexts: readonly ChronicleContextDetails[]
}

/**
 * Полная серверная проекция страницы хроники из одного снимка.
 */
export type ChronicleDetails = {
  /** Собственная карточка хроники. */
  readonly profile: ReferenceCatalogItem
  /** Ветка происхождения. */
  readonly branch: ReferenceCatalogItem
  /** Выпуски и подтверждённые региональные связи. */
  readonly releases: readonly ChronicleReleaseDetails[]
}
