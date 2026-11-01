import type { DatabaseStatus } from '../api/status.types.js'
import type { ExchangeResult } from '../exchange/exchange.types.js'

/**
 * Англоязычные сообщения мини-CLI; бизнес-логика не формирует терминальные подписи.
 */
export const cliMessages = {
  help: `L2CE Database — SQLite and JSON

Usage: pnpm run database <command> [options]

  import    Create or restore the database from a complete JSON snapshot
  export    Export SQLite tables: one directory per table, one JSON file per row
  status    Show the database file, schema and record counts
  init      Initialize an empty database with Russian and English locales
  apply     Apply an atomic JSON batch of record changes

  --database <path>  SQLite file (default: package .local/database.sqlite)
  --input <dir>     Import source (default: package data directory)
  --output <dir>    Export destination (default: package data directory)
  --file <path>     JSON batch for apply: { operations, ifRevision? }
  --json            JSON result on stdout; progress remains on stderr
  --help, -h        Show this help

Import creates the current SQL structure automatically.
Default paths are relative to the package, independently of the working directory.
`,
  arguments: 'Invalid arguments. Run pnpm run database --help.',
  failed: 'Operation failed',
  cancelled: 'Operation interrupted.',
  initialized: 'Initialized an empty database (ru, en).',
  alreadyInitialized: 'The database has already been initialized.',
  applied: 'Changes committed.',
  previewed: 'Changes validated; no records written.',
  import: 'Import',
  export: 'Export',
  phases: {
    scan: 'Scanning',
    read: 'Reading',
    validate: 'Validating',
    write: 'Writing',
    commit: 'Committing',
    complete: 'Done'
  },
  /**
   * Форматирует итог обмена и полное время его выполнения в секундах.
   */
  exchanged: (result: ExchangeResult): string =>
    result.tables === undefined
      ? `Done: ${result.entities} entities, ${result.records} records.\nCompleted in ${(result.durationMs / 1_000).toFixed(2)} seconds.`
      : `Done: ${result.tables} tables, ${result.rows} rows.\nCompleted in ${(result.durationMs / 1_000).toFixed(2)} seconds.`,
  /**
   * Показывает состояние текущей схемы и счётчики без создания файла.
   */
  status: (status: DatabaseStatus): string =>
    [
      `Database: ${status.database}`,
      status.exists ? 'File exists.' : 'File has not been created yet.',
      `Schema: ${status.schema}`,
      status.manifest
        ? `Data ${status.manifest.dataVersion}: ${status.manifest.locales.join(', ')}; ${status.entities} entities, ${status.implementations} implementations.`
        : 'No data imported yet, or the schema needs to be recreated from JSON.'
    ].join('\n')
} as const
