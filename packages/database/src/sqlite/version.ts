import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'
import * as z from 'zod'
import { DatabaseError } from '../errors.js'
import type { Connection } from './sqlite.types.js'

/**
 * Возвращает поколение фиксации без чтения тел документов.
 * user_version — служебный счётчик API, не версия SQL-схемы или экспортируемое знание.
 */
export function readVersion(connection: Connection): string {
  const generation = z
    .number()
    .int()
    .nonnegative()
    .parse(connection.client.pragma('user_version', { simple: true }))
  const file =
    connection.path === ':memory:'
      ? 'memory'
      : (() => {
          const stat = statSync(connection.path, { bigint: true })
          return `${stat.dev}:${stat.ino}:${stat.birthtimeNs}`
        })()
  return `v1:${createHash('sha256').update(`${file}:${generation}`).digest('hex')}`
}

/**
 * Меняет поколение в той же SQL-транзакции, что и предметные данные; rollback откатывает оба.
 */
export function advanceVersion(connection: Connection): void {
  const generation = z
    .number()
    .int()
    .nonnegative()
    .parse(connection.client.pragma('user_version', { simple: true }))
  if (generation >= 0x7fffffff)
    throw new DatabaseError(
      'VERSION_EXHAUSTED',
      'Исчерпан счётчик фиксаций. Экспортируйте базу и импортируйте в новый SQLite-файл.'
    )
  connection.client.pragma(`user_version = ${generation + 1}`)
}
