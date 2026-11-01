import { DatabaseError } from '../errors.js'
import { exchangeMessages as messages } from './messages.js'
import {
  collectionSnapshots,
  exchangeFailure,
  failureRecord,
  initialCollections,
  allCollections,
  localeSnapshots,
  progressAddress,
  recordCollections
} from './progress-metrics.js'
import type {
  ExchangePhase,
  ExchangeProgress,
  ProgressObserver,
  ProgressReporter,
  ExchangeFileAddress
} from './exchange.types.js'
import type { ProgressState } from './progress.types.js'

/**
 * Вычисляет монотонный общий процент по стадиям; время работы не подменяет счётчики.
 */
function updatePercent(state: ProgressState): void {
  const fraction = state.total ? state.completed / state.total : 0
  const ranges =
    state.operation === 'import'
      ? {
          scan: 0,
          read: Math.floor(fraction * 40),
          validate: 40,
          write: 45 + Math.floor(fraction * 53),
          commit: 99,
          complete: 100
        }
      : {
          scan: 0,
          read: 5,
          validate: 10,
          write: 15 + Math.floor(fraction * 83),
          commit: 99,
          complete: 100
        }
  state.percent = Math.max(state.percent, ranges[state.phase])
}

/**
 * Отправляет независимый снимок метрик; ошибка complete явно помечает уже выполненный COMMIT.
 */
function notify(state: ProgressState, event: ExchangeProgress['event'], record?: ExchangeFileAddress): void {
  updatePercent(state)
  const now = performance.now()
  try {
    state.observer?.({
      operation: state.operation,
      event,
      phase: state.phase,
      percent: state.percent,
      completed: state.completed,
      total: state.total,
      record: record ? progressAddress(record) : undefined,
      elapsedMs: now - state.startedAt,
      phaseElapsedMs: now - state.phaseStartedAt,
      phaseDurationsMs: { ...state.phaseDurationsMs },
      collections: collectionSnapshots(state, now, state.collections),
      tables: collectionSnapshots(state, now, state.tables).map(({ collection, ...metrics }) => ({
        table: collection,
        ...metrics
      })),
      locales: localeSnapshots(state, now),
      failure: state.failure
    })
  } catch (error) {
    if (state.phase === 'complete') {
      throw new DatabaseError('PROGRESS_OBSERVER_FAILED', messages.observer, { committed: true }, error)
    }
    throw error
  }
}

/**
 * Меняет этап без потери уже накопленных показателей коллекций.
 */
function setPhase(state: ProgressState, phase: ExchangePhase): void {
  if (phase !== state.phase) {
    const now = performance.now()
    state.phaseDurationsMs[state.phase] = (state.phaseDurationsMs[state.phase] ?? 0) + now - state.phaseStartedAt
    state.phase = phase
    state.phaseStartedAt = now
    state.completed = 0
    state.lastRecord = undefined
  }
}

/**
 * Создаёт репортер полного обмена: план, начало/окончание файлов, реальные времена и сбои.
 */
export function createProgress(
  operation: ExchangeProgress['operation'],
  observer?: ProgressObserver
): ProgressReporter {
  const startedAt = performance.now()
  const state: ProgressState = {
    operation,
    observer,
    startedAt,
    collections: operation === 'import' ? initialCollections() : new Map(),
    tables: new Map(),
    localeCollections: new Map(),
    phase: 'scan',
    phaseStartedAt: startedAt,
    phaseDurationsMs: {},
    percent: 0,
    completed: 0,
    total: null
  }
  return {
    /**
     * Показывает общий этап; только complete переводит подготовленные коллекции в готовые.
     */
    stage(phase, completed = 0, total = state.total): void {
      setPhase(state, phase)
      state.completed = completed
      state.total = total
      state.active = undefined
      state.lastRecord = undefined
      if (phase === 'complete') {
        for (const group of allCollections(state)) {
          group.status = 'complete'
        }
      }
      notify(state, 'stage')
    },
    /**
     * Устанавливает точные общие объёмы до чтения/записи первого файла.
     */
    plan(records, locales = [...new Set(records.flatMap((record) => (record.locale ? [record.locale] : [])))]): void {
      state.tables.clear()
      if (state.collections.size === 0) {
        for (const [key, group] of initialCollections()) {
          state.collections.set(key, group)
        }
      }
      state.localeCollections.clear()
      for (const locale of locales) {
        state.localeCollections.set(locale, initialCollections(locale))
      }
      for (const group of allCollections(state)) {
        group.total = 0
      }
      for (const record of records) {
        for (const group of recordCollections(state, record)) {
          group.total = (group.total ?? 0) + 1
        }
      }
      state.total = records.length
      notify(state, 'stage')
    },
    /**
     * Показывает все обнаруженные таблицы до первой записи, включая пустые.
     */
    planTables(tables): void {
      state.collections.clear()
      state.localeCollections.clear()
      state.tables.clear()
      for (const table of tables) {
        state.tables.set(table.name, {
          collection: table.name,
          total: table.rows,
          read: 0,
          written: 0,
          status: 'waiting',
          phase: null,
          readMs: 0,
          writeMs: 0,
          recordMs: 0
        })
      }
      state.total = tables.reduce((total, table) => total + table.rows, 0)
      notify(state, 'stage')
    },
    /**
     * Сначала показывает новый файл, затем начинает измерение его реальной обработки.
     */
    startRecord(phase, record): void {
      setPhase(state, phase)
      const address = progressAddress(record)
      state.active = { record: address, phase, startedAt: performance.now() }
      for (const group of recordCollections(state, record)) {
        group.record = address
        group.phase = phase
        group.status = 'active'
        group.recordMs = 0
      }
      notify(state, 'record-start', record)
      state.active.startedAt = performance.now()
    },
    /**
     * Учитывает успешное завершение без времени, потраченного на синхронный вывод прогресса.
     */
    finishRecord(): void {
      const active = state.active
      if (!active) {
        throw new DatabaseError('INVALID_PROGRESS', messages.progressState)
      }
      const durationMs = performance.now() - active.startedAt
      for (const group of recordCollections(state, active.record)) {
        if (active.phase === 'read') {
          group.read++
          group.readMs += durationMs
        } else {
          group.written++
          group.writeMs += durationMs
        }
        group.recordMs = durationMs
        if (!group.slowest || durationMs > group.slowest.durationMs) {
          group.slowest = {
            record: active.record,
            phase: active.phase,
            durationMs
          }
        }
        group.status = group.written === group.total ? 'prepared' : 'waiting'
      }
      state.completed++
      state.active = undefined
      state.lastRecord = active.record
      notify(state, 'record-complete', active.record)
    },
    /**
     * Сохраняет точный файл сбоя; подготовленные, но не зафиксированные коллекции отменяются.
     */
    fail(error): void {
      const failure = exchangeFailure(error)
      const parts = failure.path?.replaceAll('\\', '/').split('/')
      const table = parts?.at(-2)
      const tableRecord = table && state.tables.has(table) ? { table, path: `${table}/${parts?.at(-1)}` } : undefined
      const record: ExchangeFileAddress | undefined =
        tableRecord ?? failureRecord(failure.path) ?? state.active?.record ?? state.lastRecord
      state.failure = {
        ...failure,
        path: failure.path ?? record?.path
      }
      for (const group of allCollections(state)) {
        if (failure.committed) {
          group.status = 'complete'
        } else if (
          (record?.table ?? record?.collection) === group.collection &&
          (group.locale === undefined || group.locale === record?.locale)
        ) {
          group.status = 'failed'
          group.record = record
          group.recordMs = state.active ? performance.now() - state.active.startedAt : 0
        } else {
          group.status = 'aborted'
        }
      }
      state.active = undefined
      notify(state, 'failure', record)
    }
  }
}
