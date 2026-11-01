import { DatabaseError } from '../errors.js';
import {
  entityKey,
  isEntity,
  parseEntry,
  recordKey,
  invalidEntry,
} from '../model/entry.js';
import { modelMessages } from '../model/messages.js';
import { snapshotRevision, stableJson } from '../model/revision.js';
import { validateSnapshot } from '../model/validation.js';
import { readSnapshot } from '../sqlite/records.js';
import { persistSnapshot } from '../sqlite/persistence.js';
import { sqliteMessages as messages } from '../sqlite/messages.js';
import { operationsSchema, writeOptionsSchema } from './operation-schema.js';
import type { DatabaseEntry, DatabaseSnapshot } from '../model/model.types.js';
import type {
  DatabaseOperation,
  WriteOptions,
  WriteResult,
} from './database.types.js';
import type { InputOperation } from './mutation.types.js';
import type { Connection } from '../sqlite/sqlite.types.js';

/**
 * Применяет изменение к частному индексу. Ссылки проверяются в конечном состоянии всего пакета.
 */
function applyOperation(
  entries: Map<string, DatabaseEntry>,
  operation: InputOperation,
): void {
  const target = 'entry' in operation ? operation.entry : operation.target;
  const previous = entries.get(target.key);
  if (
    previous &&
    (previous.kind !== target.kind || previous.collection !== target.collection)
  ) {
    throw new DatabaseError('INVALID_OPERATION', messages.invalidOperation, {
      key: target.key,
    });
  }
  if (operation.op === 'create' && previous) {
    throw new DatabaseError('ALREADY_EXISTS', messages.exists, {
      key: target.key,
    });
  }
  if ((operation.op === 'delete' || operation.op === 'update') && !previous) {
    throw new DatabaseError('NOT_FOUND', messages.notFound, {
      key: target.key,
    });
  }
  if (operation.op === 'delete') {
    entries.delete(target.key);
    if (target.kind === 'entity') {
      for (const [key, entry] of entries) {
        if (!isEntity(entry) && entityKey(entry) === target.key) {
          entries.delete(key);
        }
      }
    }
    return;
  }
  const entry =
    operation.op === 'update'
      ? parseEntry({
          ...target,
          value: { ...previous?.value, ...operation.patch },
        })
      : parseEntry(operation.entry);
  if (previous && previous.value.id !== entry.value.id) {
    invalidEntry(modelMessages.immutableId, target);
  }
  entries.set(target.key, entry);
}

/**
 * Считает изменённые адреса, включая каскадное удаление редакций карточки.
 */
function countChanges(
  before: DatabaseSnapshot,
  after: DatabaseSnapshot,
): number {
  const old = new Map(
    before.entries.map((entry) => [recordKey(entry), stableJson(entry.value)]),
  );
  const current = new Map(
    after.entries.map((entry) => [recordKey(entry), stableJson(entry.value)]),
  );
  return [...new Set([...old.keys(), ...current.keys()])].filter(
    (key) => old.get(key) !== current.get(key),
  ).length;
}

/**
 * Проверяет пакет в одной IMMEDIATE-транзакции общей базы. No-op не переписывает строки.
 * Переводы изменяются вместе с общим техническим основанием; проверка ревизии глобальная.
 */
export function writeChanges(
  connection: Connection,
  input: readonly DatabaseOperation[],
  options: WriteOptions = {},
): WriteResult {
  const parsed = operationsSchema.safeParse(input);
  const checked = writeOptionsSchema.safeParse(options);
  if (!parsed.success || !checked.success) {
    throw new DatabaseError(
      'INVALID_OPERATION',
      messages.invalidOperation,
      undefined,
      parsed.success ? checked.error : parsed.error,
    );
  }
  return connection.client
    .transaction(() => {
      const before = readSnapshot(connection);
      if (
        checked.data.ifRevision &&
        checked.data.ifRevision !== snapshotRevision(before)
      ) {
        throw new DatabaseError('REVISION_CONFLICT', messages.conflict);
      }
      const entries = new Map(
        before.entries.map((entry) => [entry.key, entry]),
      );
      const seen = new Set<string>();
      const removed = new Set(
        parsed.data
          .filter((operation) => operation.op === 'delete')
          .map((operation) => operation.target.key),
      );
      for (const operation of parsed.data) {
        const target =
          'entry' in operation ? operation.entry : operation.target;
        const candidate =
          'entry' in operation
            ? parseEntry(operation.entry)
            : entries.get(target.key);
        if (
          seen.has(target.key) ||
          (candidate &&
            !isEntity(candidate) &&
            removed.has(entityKey(candidate)))
        ) {
          throw new DatabaseError(
            'INVALID_OPERATION',
            messages.duplicateOperation,
            { key: target.key },
          );
        }
        seen.add(target.key);
        applyOperation(entries, operation);
      }
      const after = validateSnapshot({
        ...before,
        entries: [...entries.values()],
      });
      const changed = countChanges(before, after);
      if (changed > 0 && !checked.data.dryRun) {
        persistSnapshot(connection, after);
      }
      return { changed, revision: snapshotRevision(after) };
    })
    .immediate();
}
