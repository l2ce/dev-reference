/**
 * Диагностики файлового обмена.
 */
export const exchangeMessages = {
  tableValue: 'The SQLite value cannot be represented in the table snapshot.',
  tableKey: 'Each exported row must have a unique, stable primary key.',
  tableSchema: 'The table snapshot does not match the current SQLite schema.',
  tableRows: 'The table files do not match the manifest, columns or primary keys.',
  filenameCollision:
    'Different rows resolve to the same export filename. No files were written; inspect the reported primary keys.',
  tableIdentities: 'The identity registry does not match document and source UUIDs.',
  progressState: 'A file must be started before reporting its completion.',
  invalidFile: 'Invalid database JSON file.',
  invalidTree: 'The directory does not match the database export structure.',
  destination: 'The export destination must be empty or contain a complete JSON export.',
  databaseInsideOutput: 'The SQLite file must not be inside the export directory.',
  locked: 'An export to this directory is already running; check the reported lock file.',
  publication: 'Could not replace the export directory; the previous directory was restored.',
  recovery: 'Could not restore the previous directory; its data remains at the backup path.',
  cleanup: 'The export was saved, but its temporary backup could not be removed.',
  observer: 'The progress observer failed after the result was committed.'
} as const
