import type { ReferenceCatalogSummary } from '@l2ce/core/reference'

/**
 * Название и поисковый контекст записи на выбранном языке.
 */
export type CatalogRecord = {
  /** Порядок основного каталога; null оставляет дополнительные сведения отдельно. */
  readonly order: number | null
  /** Точный публичный ключ записи. */
  readonly key: string
  /** Переведённое название либо технический ключ при отсутствии перевода. */
  readonly title: string
  /** Необязательное пояснение, например расшифровка региональной метки. */
  readonly summary?: string | null
  /** Состояние именно запрошенного перевода. */
  readonly translationStatus: ReferenceCatalogSummary['translationStatus']
  /** Нормализованные ключ и название без подстановки другого языка. */
  readonly searchText: string
}

/**
 * Точный профиль с отдельными игровым номером и различителем справочника.
 */
export type CatalogProtocol = CatalogRecord & {
  /** Реальный игровой номер. */
  readonly number: number
  /** Внутренний различитель профилей с одинаковым номером. */
  readonly variant: number
  /** Число применимых материалов с непустым текстом на выбранном языке. */
  readonly materialCount: number
}

/**
 * Выпуск хроники с явно связанными протоколами.
 */
export type CatalogRelease = CatalogRecord & {
  /** Региональные контексты; страна и язык не выводятся из региона. */
  readonly contexts: readonly CatalogReleaseContext[]
  /** Номера, для которых регион ещё не установлен. */
  readonly unscopedProtocols: readonly CatalogProtocol[]
  /** Технический выпуск без отдельного именованного этапа. */
  readonly isBase: boolean
  /** Профили в порядке явных связей выпуска. */
  readonly protocols: readonly CatalogProtocol[]
}

/**
 * Подтверждённая региональная применимость конкретного выпуска.
 */
export type CatalogReleaseContext = CatalogRecord & {
  /** Регион либо неизвестная принадлежность. */
  readonly regionKey: string | null
  /** Дата с сохранённой точностью, без подстановки даты публикации источника. */
  readonly releasedOn: string | null
  /** Только явно связанные профили. */
  readonly protocols: readonly CatalogProtocol[]
}

/**
 * Хроника одной ветки со всеми её выпусками, включая неполные записи.
 */
export type CatalogChronicle = CatalogRecord & {
  /** Выпуски; пустой список сохраняет отсутствие исследования. */
  readonly releases: readonly CatalogRelease[]
}

/**
 * Ветка игры как самостоятельная область каталога.
 */
export type CatalogBranch = CatalogRecord & {
  /** Хроники этой ветки. */
  readonly chronicles: readonly CatalogChronicle[]
}

/**
 * Сериализуемый каталог из одного согласованного снимка.
 */
export type ProtocolCatalog = {
  /** Упорядоченные динамические колонки регионов. */
  readonly regions: readonly CatalogRecord[]
  /** Ветки, хроники, выпуски и их явные связи с протоколами. */
  readonly branches: readonly CatalogBranch[]
  /** Профили, принадлежность которых пока не установлена. */
  readonly unassignedProtocols: readonly CatalogProtocol[]
}
