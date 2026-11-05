import { readFile } from 'node:fs/promises'
import * as z from 'zod'
import { openDatabase } from '../api/database.js'
import { operationsSchema, writeOptionsSchema } from '../api/operation-schema.js'
import { parseEntry } from '../model/entry.js'
import { DatabaseError } from '../errors.js'
import { cliMessages as messages } from './messages.js'
import type { DatabaseOperation } from '../api/database.types.js'
import type { InputOperation } from '../api/mutation.types.js'
import type { CliArguments } from './cli.types.js'

/**
 * Проверяет содержимое create/put; patch проверяется по конечной записи внутри транзакции.
 */
function checkedOperation(operation: InputOperation): DatabaseOperation {
  if (operation.op === 'create' || operation.op === 'put') {
    return { op: operation.op, entry: parseEntry(operation.entry) }
  }
  if (operation.op === 'delete') {
    return operation
  }
  // Адрес проверен Zod; динамический patch проверит parseEntry после объединения с записью.
  return operation as DatabaseOperation
}

/**
 * Создаёт пустой реестр либо применяет пакет через проверенный API, не исполняя входной SQL.
 */
export async function runWrite(input: CliArguments): Promise<void> {
  const database = openDatabase({ database: input.database })
  try {
    if (input.command === 'init') {
      if (database.manifest()) {
        throw new DatabaseError('ALREADY_EXISTS', messages.alreadyInitialized)
      }
      database.replaceSnapshot({
        schemaVersion: 20,
        dataVersion: '1.0.0',
        defaultLocale: 'ru',
        locales: ['ru', 'en'],
        entries: []
      })
      process.stdout.write((input.json ? JSON.stringify(database.manifest()) : messages.initialized) + '\n')
      return
    }
    if (!input.file) {
      throw new DatabaseError('INVALID_ARGUMENT', messages.arguments)
    }
    const batchSchema = writeOptionsSchema.extend({
      operations: operationsSchema
    })
    const batch = batchSchema.parse(JSON.parse(await readFile(input.file, 'utf8')))
    const result = database.applyChanges(batch.operations.map(checkedOperation), {
      ifRevision: batch.ifRevision,
      dryRun: batch.dryRun
    })
    let output: string = batch.dryRun ? messages.previewed : messages.applied
    if (input.json) {
      output = JSON.stringify({
        ...result,
        ...(batch.dryRun ? { dryRun: true } : {})
      })
    }
    process.stdout.write(output + '\n')
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new DatabaseError('INVALID_OPERATION', messages.arguments, error.issues, error)
    }
    throw error
  } finally {
    database.close()
  }
}
