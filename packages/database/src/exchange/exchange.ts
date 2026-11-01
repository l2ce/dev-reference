import { resolve } from 'node:path'
import { defaultDataDirectory, defaultDatabasePath } from '../paths.js'
import { isEntity, fileAddress, indexEntries } from '../model/entry.js'
import { validateSnapshot } from '../model/validation.js'
import { createProgress } from './progress.js'
import { readDirectory } from './directory.js'
import { publishDirectory } from './publication.js'
import { connect } from '../sqlite/connection.js'
import { restoreSnapshot } from '../sqlite/persistence.js'
import { validateStoredTables } from '../sqlite/table-validation.js'
import { readTableSnapshot } from '../sqlite/table-snapshot.js'
import { restoreTableSnapshot, validateTableSnapshot } from '../sqlite/table-storage.js'
import { isTableDirectory, readTableDirectory } from './table-directory.js'
import type { DatabaseSnapshot } from '../model/model.types.js'
import type { ExchangeResult, ExportOptions, ImportOptions, ProgressReporter } from './exchange.types.js'
import type { TableSnapshot } from './table.types.js'

/**
 * Формирует статистику полного снимка после успешного завершения обмена.
 */
function exchangeResult(
  database: string,
  directory: string,
  snapshot: DatabaseSnapshot,
  startedAt: number,
  tables?: TableSnapshot
): ExchangeResult {
  return {
    database,
    directory,
    entities: snapshot.entries.filter(isEntity).length,
    records: snapshot.entries.length,
    locales: snapshot.locales,
    durationMs: performance.now() - startedAt,
    ...(tables
      ? {
          tables: tables.manifest.tables.length,
          rows: tables.manifest.tables.reduce((sum, table) => sum + table.rows, 0)
        }
      : {})
  }
}

/**
 * Проверяет табличный снимок в памяти, затем заменяет целевую базу одной транзакцией.
 */
async function importTables(
  options: ImportOptions,
  directory: string,
  startedAt: number,
  progress: ProgressReporter
): Promise<ExchangeResult> {
  const tables = await readTableDirectory(directory, progress)
  const total = tables.manifest.tables.reduce((sum, table) => sum + table.rows, 0)
  progress.stage('validate', 0, total)
  const snapshot = validateTableSnapshot(tables)
  const connection = connect({
    path: options.database ?? defaultDatabasePath,
    create: true
  })
  try {
    restoreTableSnapshot(connection, tables, progress)
  } finally {
    connection.client.close()
  }
  progress.stage('complete', total, total)
  return exchangeResult(connection.path, directory, snapshot, startedAt, tables)
}

/**
 * Проверяет JSON до открытия SQLite, затем создаёт или полностью восстанавливает базу.
 * До COMMIT ошибки чтения, проверки, записи и наблюдателя оставляют прежнюю базу.
 * Наблюдатель complete вызывается после COMMIT; его ошибка помечается committed=true.
 */
export async function importDatabase(options: ImportOptions = {}): Promise<ExchangeResult> {
  const startedAt = performance.now()
  const progress = createProgress('import', options.onProgress)
  const directory = resolve(options.input ?? defaultDataDirectory)
  try {
    progress.stage('scan')
    if (await isTableDirectory(directory)) {
      return await importTables(options, directory, startedAt, progress)
    }
    const input = await readDirectory(directory, progress)
    progress.stage('validate', 0, input.entries.length)
    const snapshot = validateSnapshot(input)
    const index = indexEntries(snapshot.entries)
    const database = connect({
      path: options.database ?? defaultDatabasePath,
      create: true
    })
    try {
      restoreSnapshot(
        database,
        snapshot,
        (_entry, completed, total) => {
          progress.finishRecord()
          if (completed === total) {
            progress.stage('commit', completed, total)
          }
        },
        (entry) => progress.startRecord('write', fileAddress(entry, index))
      )
    } finally {
      database.client.close()
    }
    progress.stage('complete', snapshot.entries.length, snapshot.entries.length)
    return exchangeResult(database.path, directory, snapshot, startedAt)
  } catch (error) {
    progress.fail(error)
    throw error
  }
}

/**
 * Экспортирует согласованный снимок SQLite, проверяя его до файловой публикации.
 * Успешный результат содержит весь реестр локалей и удаляет устаревшие файлы предыдущего экспорта.
 */
export async function exportDatabase(options: ExportOptions = {}): Promise<ExchangeResult> {
  const startedAt = performance.now()
  const progress = createProgress('export', options.onProgress)
  const directory = resolve(options.output ?? defaultDataDirectory)
  try {
    progress.stage('scan')
    const database = connect({
      path: options.database ?? defaultDatabasePath,
      readOnly: true
    })
    let contents: { snapshot: DatabaseSnapshot; tables: TableSnapshot }
    try {
      progress.stage('read')
      contents = database.client.transaction(() => {
        const tables = readTableSnapshot(database.client)
        return { snapshot: validateStoredTables(database, tables), tables }
      })()
    } finally {
      database.client.close()
    }
    progress.planTables(contents.tables.manifest.tables)
    const total = contents.tables.manifest.tables.reduce((sum, table) => sum + table.rows, 0)
    progress.stage('validate', 0, total)
    await publishDirectory(directory, database.path, contents.tables, progress)
    progress.stage('complete', total, total)
    return exchangeResult(database.path, directory, contents.snapshot, startedAt, contents.tables)
  } catch (error) {
    progress.fail(error)
    throw error
  }
}
