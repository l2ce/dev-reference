import { collectionSchema, localeSchema } from '../model/schema.js'
import type { Locale, FileAddress } from '../model/model.types.js'
import type { CollectionProgress, ExchangeFailure, LocaleProgress, ExchangeFileAddress } from './exchange.types.js'
import type { CollectionMetrics, ProgressState } from './progress.types.js'

/**
 * Копирует только адрес, чтобы события не раскрывали и не удерживали содержимое записи.
 */
export function progressAddress(record: ExchangeFileAddress): ExchangeFileAddress {
  if (record.table !== undefined) {
    return { table: record.table, path: record.path }
  }
  return {
    locale: record.locale,
    collection: record.collection,
    path: record.path
  }
}

/**
 * Создаёт пустые метрики всех коллекций, чтобы они были видны до сканирования.
 */
export function initialCollections(locale?: Locale): ProgressState['collections'] {
  return new Map(
    collectionSchema.options.map((collection) => [
      collection,
      {
        locale,
        collection,
        total: null,
        read: 0,
        written: 0,
        status: 'waiting',
        phase: null,
        readMs: 0,
        writeMs: 0,
        recordMs: 0
      }
    ])
  )
}

/**
 * Возвращает общий и языковой счётчики ровно той коллекции, которой принадлежит файл.
 */
export function recordCollections(state: ProgressState, record: ExchangeFileAddress): readonly CollectionMetrics[] {
  if (record.table !== undefined) {
    const group = state.tables.get(record.table)
    return group ? [group] : []
  }
  return [
    state.collections.get(record.collection),
    record.locale ? state.localeCollections.get(record.locale)?.get(record.collection) : undefined
  ].filter((group): group is CollectionMetrics => group !== undefined)
}

/**
 * Перечисляет изменяемые счётчики для общей фиксации или отмены всего обмена.
 */
export function* allCollections(state: ProgressState): Iterable<CollectionMetrics> {
  yield* state.collections.values()
  yield* state.tables.values()
  for (const groups of state.localeCollections.values()) {
    yield* groups.values()
  }
}

/**
 * Вычисляет готовность коллекции; подготовленные строки не обозначаются зафиксированными.
 */
function collectionPercent(state: ProgressState, group: CollectionMetrics): number {
  if (group.status === 'complete') {
    return 100
  }
  if (!group.total) {
    return 0
  }
  const processed = state.operation === 'import' ? group.read + group.written : group.written
  const total = group.total * (state.operation === 'import' ? 2 : 1)
  return Math.min(99, Math.floor((processed / total) * 100))
}

/**
 * Возвращает независимые снимки метрик с текущей длительностью активного файла.
 */
export function collectionSnapshots<Name extends string>(
  state: ProgressState,
  now: number,
  groups: ReadonlyMap<Name, CollectionMetrics>
): readonly CollectionProgress<Name>[] {
  return [...groups].map(([collection, group]) => {
    const { locale, ...metrics } = group
    const active =
      (state.active?.record.table ?? state.active?.record.collection) === group.collection &&
      (locale === undefined || state.active?.record.locale === locale)
    return {
      ...metrics,
      collection,
      percent: collectionPercent(state, group),
      active,
      record: group.record ? progressAddress(group.record) : undefined,
      recordMs: active && state.active ? now - state.active.startedAt : group.recordMs,
      slowest: group.slowest ? { ...group.slowest, record: progressAddress(group.slowest.record) } : undefined
    }
  })
}

/**
 * Создаёт снимки всех языковых блоков без смешивания одинаковых коллекций разных локалей.
 */
export function localeSnapshots(state: ProgressState, now: number): readonly LocaleProgress[] {
  return [...state.localeCollections].map(([locale, groups]) => ({
    locale,
    collections: collectionSnapshots(state, now, groups)
  }))
}

/**
 * Извлекает диагностические поля без предположений о классе системной ошибки.
 */
export function exchangeFailure(error: unknown): ExchangeFailure {
  const object = error !== null && typeof error === 'object' ? error : {}
  const details =
    'details' in object && object.details !== null && typeof object.details === 'object' ? object.details : {}
  const path = 'path' in details ? details.path : 'path' in object ? object.path : undefined
  return {
    code: 'code' in object && typeof object.code === 'string' ? object.code : 'UNEXPECTED_ERROR',
    message: error instanceof Error ? error.message : String(error),
    path: typeof path === 'string' ? path : undefined,
    committed: 'committed' in details && details.committed === true
  }
}

/**
 * Разрешает относительный либо абсолютный путь ошибки в адрес JSON-записи.
 */
export function failureRecord(path?: string): FileAddress | undefined {
  const match = path?.replaceAll('\\', '/').match(/(?:^|\/)((en|ru)\/([^/]+)\/(?:[^/]+\/)?[^/]+\.json)$/)
  if (!match) {
    return undefined
  }
  const collection = collectionSchema.safeParse(match[3])
  return collection.success
    ? {
        locale: localeSchema.parse(match[2]),
        collection: collection.data,
        path: match[1]
      }
    : undefined
}
