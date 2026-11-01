import { join } from 'node:path'
import { DatabaseError } from '../errors.js'
import { children, readJson } from './json-files.js'
import { tableManifestSchema, tableRowSchema } from './table-schema.js'
import { tableFileAddress } from './table-codec.js'
import { exchangeMessages as messages } from './messages.js'
import type { ProgressReporter, TableFileAddress } from './exchange.types.js'
import type { TableInventory, TableRow, TableSnapshot } from './table.types.js'

/**
 * Различает табличный манифест и прежний документный формат без угадывания по файлам.
 */
export async function isTableDirectory(directory: string): Promise<boolean> {
  const manifest = await readJson(join(directory, 'manifest.json'))
  return manifest !== null && typeof manifest === 'object' && 'format' in manifest
}

/**
 * Проверяет состав каталога и число файлов до чтения строк.
 * Пустая папка может отсутствовать после Git checkout; её наличие отражено в манифесте.
 */
export async function inspectTableDirectory(directory: string): Promise<TableInventory> {
  try {
    const names = await children(directory)
    const manifest = tableManifestSchema.parse(await readJson(join(directory, 'manifest.json')))
    if (names.some((name) => name !== 'manifest.json' && !manifest.tables.some((table) => table.name === name))) {
      throw new DatabaseError('INVALID_DIRECTORY', messages.invalidTree, {
        path: directory
      })
    }
    const records: TableFileAddress[] = []
    for (const table of manifest.tables) {
      const path = join(directory, table.name)
      const files = names.includes(table.name) ? await children(path) : []
      if (files.length !== table.rows || files.some((file) => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.json$/.test(file))) {
        throw new DatabaseError('INVALID_DIRECTORY', messages.tableRows, {
          path
        })
      }
      records.push(
        ...files.map((file) => ({
          table: table.name,
          path: `${table.name}/${file}`
        }))
      )
    }
    return { manifest, records }
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    throw new DatabaseError('INVALID_DIRECTORY', messages.invalidTree, { path: directory }, error)
  }
}

/**
 * Читает физические строки с проверкой колонок, PK и имени каждого файла до открытия SQLite.
 * Принимает короткие имена и прежние key-<полный SHA-256>; данные строк не преобразуются.
 */
export async function readTableDirectory(directory: string, progress: ProgressReporter): Promise<TableSnapshot> {
  const inventory = await inspectTableDirectory(directory)
  progress.planTables(inventory.manifest.tables)
  progress.stage('read', 0, inventory.records.length)
  const rows = new Map<string, TableRow[]>()
  for (const table of inventory.manifest.tables) {
    rows.set(table.name, [])
    for (const file of inventory.records.filter((record) => record.table === table.name)) {
      progress.startRecord('read', file)
      const path = join(directory, file.path)
      try {
        const row = tableRowSchema.parse(await readJson(path))
        if (
          Object.keys(row).length !== table.columns.length ||
          table.columns.some((column) => !(column in row)) ||
          (tableFileAddress(table, row).path !== file.path && tableFileAddress(table, row, 'legacy').path !== file.path)
        ) {
          throw new Error(messages.tableRows)
        }
        rows.get(table.name)?.push(row)
      } catch (error) {
        if (error instanceof DatabaseError) {
          throw error
        }
        throw new DatabaseError('INVALID_TABLE_ROW', messages.tableRows, { path }, error)
      }
      progress.finishRecord()
    }
  }
  return { manifest: inventory.manifest, rows }
}
