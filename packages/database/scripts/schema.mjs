import { readFile, writeFile } from 'node:fs/promises'
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api'
import * as schema from '../dist/sqlite/schema.js'

/**
 * Сохраняет обязательный STRICT-режим, который Drizzle Kit 0.31 ещё не описывает.
 * Сами колонки, ограничения, индексы и SQL-экранирование полностью генерирует Drizzle Kit.
 */
function strictTable(statement) {
  if (!statement.startsWith('CREATE TABLE ')) {
    return statement.trim()
  }
  if (!/\);\s*$/.test(statement)) {
    throw new Error('Unsupported Drizzle Kit CREATE TABLE output. STRICT mode must be preserved.')
  }
  return statement.replace(/\);\s*$/, ') STRICT;')
}

// Генерация относительно пустой схемы даёт полный DDL без истории миграций и служебных файлов.
const empty = await generateSQLiteDrizzleJson({})
const current = await generateSQLiteDrizzleJson(schema)
const statements = await generateSQLiteMigration(empty, current)
const sql = statements.map(strictTable).join('\n\n') + '\n'
const path = new URL('../schema.sql', import.meta.url)
if (process.argv.includes('--write')) {
  await writeFile(path, sql)
} else if ((await readFile(path, 'utf8')) !== sql) {
  throw new Error('schema.sql differs from the Drizzle declarations. Run pnpm --filter @l2ce/database schema:generate.')
}
