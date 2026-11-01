/**
 * Переносимые предметные контракты и проверка без открытия SQLite и чтения SQL-файлов.
 */
export { localeSchema, sourceSchema, translationSchema, manifestSchema } from './model/schema.js'
export { snapshotRevision } from './model/revision.js'
export { validateSnapshot } from './model/validation.js'
export { DatabaseError } from './errors.js'
export type * from './model/model.types.js'
