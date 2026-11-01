import assert from 'node:assert/strict'
import Sqlite from 'better-sqlite3'
import {
  databaseStatus,
  defaultDataDirectory,
  exportDatabase,
  importDatabase,
  openDatabase,
  snapshotRevision
} from '../dist/index.js'
import { createTerminalProgress } from '../dist/cli/progress.js'
import { readDirectory } from '../dist/exchange/directory.js'
import { createProgress } from '../dist/exchange/progress.js'
import { benchmarkFixture } from './benchmark-fixture.mjs'

/**
 * Снимает CPU и пиковый RSS процесса до проверки round-trip и других дополнительных действий.
 */
function resources(startedCpu) {
  const cpu = process.cpuUsage(startedCpu)
  return {
    cpuMs: (cpu.user + cpu.system) / 1_000,
    peakRssBytes: process.resourceUsage().maxRSS * 1024
  }
}

/**
 * Наполняет отдельный файл ровно указанным числом записей через обычный проверяемый API.
 */
async function seed(options) {
  const base = await readDirectory(defaultDataDirectory, createProgress('import'))
  const database = openDatabase({ database: options.database })
  let snapshot
  let durationMs
  let resource
  try {
    snapshot = benchmarkFixture(base, options.records, options.descriptionBytes)
    const startedCpu = process.cpuUsage()
    const startedAt = performance.now()
    database.replaceSnapshot(snapshot)
    database.close()
    durationMs = performance.now() - startedAt
    resource = resources(startedCpu)
  } finally {
    database.close()
  }
  const status = databaseStatus({ database: options.database })
  assert.equal(status.entities + status.implementations, options.records)
  const perLocale = Object.fromEntries(
    snapshot.locales.map((locale) => [
      locale,
      snapshot.entries.filter((entry) => entry.value.translations?.some((translation) => translation.locale === locale))
        .length
    ])
  )
  const perCollection = {}
  let descriptionBytes = 0
  let descriptions = 0
  for (const entry of snapshot.entries) {
    const key = entry.collection
    perCollection[key] = (perCollection[key] ?? 0) + 1
    for (const translation of entry.value.translations ?? []) {
      descriptionBytes += Buffer.byteLength(translation.description)
      if (translation.description.length) descriptions++
    }
  }
  return {
    durationMs,
    ...resource,
    entities: status.entities,
    implementations: status.implementations,
    records: options.records,
    perLocale,
    perCollection,
    descriptionBytes,
    descriptions
  }
}

/**
 * Измеряет обмен со штатным рендерером CLI, единственным владельцем активной области терминала.
 */
async function exchange(operation, options) {
  const progress = createTerminalProgress()
  let final
  const startedCpu = process.cpuUsage()
  try {
    const parameters = {
      database: options.database,
      onProgress: (event) => {
        progress.update(event)
        if (event.phase === 'complete') {
          final = event
        }
      }
    }
    const result =
      operation === 'export'
        ? await exportDatabase({ ...parameters, output: options.directory })
        : await importDatabase({ ...parameters, input: options.directory })
    const resource = resources(startedCpu)
    assert.equal(result.records, options.records)
    return {
      ...result,
      ...resource,
      phasesMs: final.phaseDurationsMs,
      progressMode: process.stderr.isTTY ? 'tty' : 'non-tty'
    }
  } finally {
    progress.stop()
  }
}

/**
 * Проверяет число записей, семантическое равенство, целостность SQLite и внешние ключи.
 * Выполняется отдельным процессом после измерения, чтобы не завышать пиковую память импорта.
 */
function verify(options) {
  const revisions = []
  for (const path of [options.source, options.database]) {
    const database = openDatabase({ database: path, readOnly: true })
    try {
      const snapshot = database.snapshot()
      assert.equal(snapshot.entries.length, options.records)
      revisions.push(snapshotRevision(snapshot))
    } finally {
      database.close()
    }
  }
  assert.equal(revisions[0], revisions[1])
  const database = new Sqlite(options.database, { readonly: true })
  try {
    assert.deepEqual(database.pragma('quick_check'), [{ quick_check: 'ok' }])
    assert.deepEqual(database.pragma('foreign_key_check'), [])
  } finally {
    database.close()
  }
  return {
    equal: true,
    records: options.records,
    revision: revisions[0],
    quickCheck: 'ok',
    foreignKeyViolations: 0
  }
}

const [operation, raw] = process.argv.slice(2)
const options = JSON.parse(raw)
let result
if (operation === 'seed') {
  result = await seed(options)
} else if (operation === 'export' || operation === 'import') {
  result = await exchange(operation, options)
} else if (operation === 'verify') {
  result = verify(options)
} else {
  throw new Error(`Unknown benchmark operation: ${operation}`)
}
process.stdout.write(JSON.stringify(result) + '\n')
