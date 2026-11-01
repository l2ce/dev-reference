import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseError } from '../errors.js';
import * as schema from './schema.js';
import { sqliteMessages as messages } from './messages.js';
import type { Connection, ConnectionOptions } from './sqlite.types.js';

const BUSY_TIMEOUT_MS = 5_000;

/**
 * Нормализует только поисковое представление Unicode, сохраняя исходный текст в таблицах.
 */
function searchNormalize(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').toLowerCase() : '';
}

/**
 * Создаёт изолированное соединение в памяти для проверки импорта до открытия целевого файла.
 * Вызывающая сторона владеет соединением и обязана закрыть client.
 */
export function memoryConnection(): Connection {
  const client = new BetterSqlite3(':memory:');
  client.pragma('foreign_keys = ON');
  client.function('search_normalize', { deterministic: true }, searchNormalize);
  return {
    client,
    orm: drizzle(client, { schema }),
    path: ':memory:',
    readOnly: false,
  };
}

/**
 * Открывает обычный файл SQLite с внешними ключами и ожиданием занятого писателя.
 * Рабочие соединения используют WAL; read-only открытие не изменяет режим журнала.
 */
export function connect(options: ConnectionOptions): Connection {
  const path = resolve(options.path);
  if (!options.create && !existsSync(path)) {
    throw new DatabaseError('DATABASE_NOT_FOUND', messages.missing, { path });
  }
  if (options.create) {
    mkdirSync(dirname(path), { recursive: true });
  }
  let client: BetterSqlite3.Database | undefined;
  try {
    client = new BetterSqlite3(path, {
      readonly: options.readOnly ?? false,
      fileMustExist: !options.create,
      timeout: BUSY_TIMEOUT_MS,
    });
    client.pragma('foreign_keys = ON');
    client.function(
      'search_normalize',
      { deterministic: true },
      searchNormalize,
    );
    if (!options.readOnly) {
      client.pragma('journal_mode = WAL');
    }
    return {
      client,
      orm: drizzle(client, { schema }),
      path,
      readOnly: options.readOnly ?? false,
    };
  } catch (error) {
    client?.close();
    throw new DatabaseError(
      'DATABASE_OPEN_FAILED',
      messages.open,
      { path },
      error,
    );
  }
}
