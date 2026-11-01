import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { count } from 'drizzle-orm'
import { defaultDatabasePath } from '../paths.js'
import { connect } from '../sqlite/connection.js'
import { schemaStatus } from '../sqlite/bootstrap.js'
import { layouts } from '../sqlite/layout.js'
import { readManifest } from '../sqlite/records.js'
import type { DatabaseStatus, DatabaseStatusOptions } from './status.types.js'

/**
 * Читает состояние схемы и счётчики одним снимком; отсутствующий файл не создаётся.
 */
export function databaseStatus(options: DatabaseStatusOptions = {}): DatabaseStatus {
  const database = resolve(options.database ?? defaultDatabasePath)
  const initial: DatabaseStatus = {
    database,
    exists: existsSync(database),
    schema: 'missing',
    manifest: null,
    entities: null,
    implementations: null
  }
  if (!initial.exists) {
    return initial
  }
  const connection = connect({ path: database, readOnly: true })
  try {
    return connection.client.transaction(() => {
      const schema = schemaStatus(connection)
      if (schema !== 'current') {
        return { ...initial, schema }
      }
      return {
        ...initial,
        schema,
        manifest: readManifest(connection),
        entities: layouts
          .filter((layout) => layout.kind === 'entity')
          .reduce(
            (total, layout) => total + (connection.orm.select({ value: count() }).from(layout.table).get()?.value ?? 0),
            0
          ),
        implementations: layouts
          .filter((layout) => layout.kind === 'implementation')
          .reduce(
            (total, layout) => total + (connection.orm.select({ value: count() }).from(layout.table).get()?.value ?? 0),
            0
          )
      }
    })()
  } finally {
    connection.client.close()
  }
}
