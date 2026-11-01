/**
 * Англоязычные диагностики хранения и программных операций.
 */
export const sqliteMessages = {
  missing: 'Database not found. Run: pnpm run database import',
  schemaMismatch: 'The database structure is outdated. Recreate it from JSON with: pnpm run database import',
  integrity: 'The imported snapshot violates SQLite foreign keys.',
  open: 'Could not open the SQLite database.',
  empty: 'The database is empty. Import JSON or call replaceSnapshot().',
  readOnly: 'The database is read-only.',
  closed: 'The database connection is closed.',
  exists: 'The record already exists.',
  notFound: 'The record was not found.',
  duplicateOperation: 'A record address occurs more than once in the batch.',
  invalidOperation: 'Invalid database operation.',
  conflict: 'The database has changed since it was read.',
  query: 'Invalid query parameters.'
} as const
