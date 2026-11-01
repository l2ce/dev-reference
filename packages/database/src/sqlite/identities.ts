import { eq } from 'drizzle-orm';
import { DatabaseError } from '../errors.js';
import { recordKey } from '../model/entry.js';
import { sqliteMessages as messages } from './messages.js';
import { layouts } from './layout.js';
import { keyExpression } from './key-expression.js';
import type { DatabaseSnapshot } from '../model/model.types.js';
import type { Connection } from './sqlite.types.js';
import type { InternalIdentities, RecordTable } from './storage.types.js';

/**
 * Индексирует UUID карточек и имплементаций, разрешая ссылки в любом порядке.
 * UUID берутся из документов и не зависят от порядка импорта или содержимого другой базы.
 */
export function planIdentities(snapshot: DatabaseSnapshot): InternalIdentities {
  const result = new Map<string, string>();
  for (const entry of snapshot.entries) {
    result.set(recordKey(entry), entry.value.id);
  }
  return result;
}

/**
 * Разрешает общий логический ключ в UUID; отсутствие — нарушение целостности.
 */
export function internalId(
  identities: InternalIdentities,
  key: string,
): string {
  const id = identities.get(key);
  if (id === undefined) {
    throw new DatabaseError('DATABASE_INTEGRITY_ERROR', messages.integrity, {
      key,
    });
  }
  return id;
}

/**
 * Восстанавливает логический ключ по публичному UUID из конкретной предметной таблицы.
 */
export function publicKey(
  connection: Connection,
  table: RecordTable,
  id: string,
): string {
  const layout = layouts.find((item) => item.table === table);
  if (!layout) {
    throw new DatabaseError('DATABASE_INTEGRITY_ERROR', messages.integrity);
  }
  const row = connection.orm
    .select({ key: keyExpression(layout) })
    .from(table)
    .where(eq(table.id, id))
    .get();
  if (!row) {
    throw new DatabaseError('DATABASE_INTEGRITY_ERROR', messages.integrity);
  }
  return row.key;
}
