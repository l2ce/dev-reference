import { join, resolve } from 'node:path'
import { DatabaseError } from '../errors.js'
import { collectionSchema, implementationCollectionSchema, manifestSchema, idSchema } from '../model/schema.js'
import { parseEntry } from '../model/entry.js'
import { exchangeMessages as messages } from './messages.js'
import { readJson, children } from './json-files.js'
import { isTableDirectory, readTableDirectory } from './table-directory.js'
import { validateTableSnapshot } from '../sqlite/table-storage.js'
import type { DatabaseSnapshot, FileAddress } from '../model/model.types.js'
import type { DirectoryInventory, ProgressReporter } from './exchange.types.js'

/**
 * Проверяет вспомогательный документный импорт формата 19: collection/UUID.json.
 * Основной экспорт по-прежнему хранит все физические таблицы SQLite.
 */
export async function inspectDirectory(input: string): Promise<DirectoryInventory> {
  const directory = resolve(input)
  try {
    const manifest = manifestSchema.parse(await readJson(join(directory, 'manifest.json')))
    const records: FileAddress[] = []
    for (const name of await children(directory)) {
      if (name === 'manifest.json') {
        continue
      }
      const collection = collectionSchema.parse(name)
      for (const file of await children(join(directory, name))) {
        if (!file.endsWith('.json') || !idSchema.safeParse(file.slice(0, -5)).success) {
          throw new DatabaseError('INVALID_DIRECTORY', messages.invalidTree, {
            path: join(directory, name, file)
          })
        }
        records.push({ collection, path: `${name}/${file}` })
      }
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
 * Читает общий снимок из табличного либо документного каталога; локализация вложена в записи.
 */
export async function readDirectory(directory: string, progress: ProgressReporter): Promise<DatabaseSnapshot> {
  if (await isTableDirectory(directory)) {
    return validateTableSnapshot(await readTableDirectory(directory, progress))
  }
  const inventory = await inspectDirectory(directory)
  progress.plan(inventory.records, [])
  progress.stage('read', 0, inventory.records.length)
  const entries = []
  for (const file of inventory.records) {
    progress.startRecord('read', file)
    try {
      const value = await readJson(join(directory, file.path))
      const key = value !== null && typeof value === 'object' && 'key' in value ? value.key : undefined
      const kind = implementationCollectionSchema.safeParse(file.collection).success ? 'implementation' : 'entity'
      const entry = parseEntry({
        collection: file.collection,
        key,
        kind,
        value
      })
      if (file.path !== `${entry.collection}/${entry.value.id}.json`) {
        throw new Error(messages.invalidTree)
      }
      entries.push(entry)
    } catch (error) {
      throw new DatabaseError('INVALID_JSON', messages.invalidFile, { path: file.path }, error)
    }
    progress.finishRecord()
  }
  return { ...inventory.manifest, entries }
}
