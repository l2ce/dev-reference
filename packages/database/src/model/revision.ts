import { createHash } from 'node:crypto';
import { recordKey } from './entry.js';
import { DatabaseError } from '../errors.js';
import { modelMessages as messages } from './messages.js';
import type { DatabaseSnapshot } from './model.types.js';

/**
 * Канонизирует проверенное JSON-значение, сохраняя массивы и строки буквально.
 */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new DatabaseError('VALIDATION_ERROR', messages.invalid);
  }
  return serialized;
}

/**
 * Хеширует семантический снимок; форматирование файлов и порядок записей не влияют.
 */
export function snapshotRevision(snapshot: DatabaseSnapshot): string {
  const entries = [...snapshot.entries].sort((left, right) =>
    recordKey(left).localeCompare(recordKey(right), 'en'),
  );
  return createHash('sha256')
    .update(stableJson({ ...snapshot, entries }))
    .digest('hex');
}
