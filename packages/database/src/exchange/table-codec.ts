import { createHash } from 'node:crypto'
import { DatabaseError } from '../errors.js'
import { exchangeMessages as messages } from './messages.js'
import type { TableCell, TableDefinition, TableFileNameFormat, TableRow, TableSnapshot } from './table.types.js'
import type { TableFileAddress } from './exchange.types.js'

const SHORT_KEY_LENGTH = 8

/**
 * Сохраняет значение SQLite, не превращая большие целые в округлённые JSON-числа.
 */
export function encodeSqlCell(value: unknown): TableCell {
  if (typeof value === 'bigint') {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : { $integer: String(value) }
  }
  if (Buffer.isBuffer(value)) {
    return { $blob: value.toString('base64') }
  }
  if (value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
    return value
  }
  throw new DatabaseError('INVALID_TABLE_VALUE', messages.tableValue)
}

/**
 * Восстанавливает параметр SQLite из проверенного JSON-значения.
 */
export function decodeSqlCell(value: TableCell): string | number | bigint | Buffer | null {
  if (value !== null && typeof value === 'object') {
    return '$integer' in value ? BigInt(value.$integer) : Buffer.from(value.$blob, 'base64')
  }
  return value
}

/**
 * Вычисляет стабильное имя по PK: читаемый одиночный ключ либо первые 8 символов SHA-256.
 * Типы и порядок компонентов входят в хеш; остальные поля не меняют имя.
 * legacy используется только для проверки прежних имён key-<полный SHA-256> при импорте.
 */
export function tableFileAddress(
  table: TableDefinition,
  row: TableRow,
  format: TableFileNameFormat = 'short'
): TableFileAddress {
  const keys = table.primaryKey.map((key) => row[key])
  const single = keys.length === 1 ? keys[0] : undefined
  const readable =
    (typeof single === 'string' || typeof single === 'number') &&
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,149}$/.test(String(single))
  let filename: string
  if (readable) {
    filename = String(single)
  } else {
    const hash = createHash('sha256').update(JSON.stringify(keys)).digest('hex')
    filename = format === 'legacy' ? `key-${hash}` : hash.slice(0, SHORT_KEY_LENGTH)
  }
  return { table: table.name, path: `${table.name}/${filename}.json` }
}

/**
 * Проверяет однозначность имён внутри каждой таблицы до создания файлов экспорта.
 * При коллизии выдаёт путь и оба полных PK; порядок строк не влияет на выбранные имена.
 */
export function validateTableFileNames(snapshot: TableSnapshot): void {
  for (const table of snapshot.manifest.tables) {
    const names = new Map<string, readonly TableCell[]>()
    for (const row of snapshot.rows.get(table.name) ?? []) {
      const file = tableFileAddress(table, row)
      const keys = table.primaryKey.map((key) => row[key])
      const previous = names.get(file.path)
      if (previous !== undefined) {
        throw new DatabaseError('EXPORT_FILENAME_COLLISION', messages.filenameCollision, {
          path: file.path,
          table: table.name,
          primaryKey: table.primaryKey,
          first: previous,
          second: keys
        })
      }
      names.set(file.path, keys)
    }
  }
}
