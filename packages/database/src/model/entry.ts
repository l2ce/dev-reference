import { DatabaseError } from '../errors.js';
import { ZodError } from 'zod';
import {
  entryEnvelopeSchema,
  entitySchemas,
  implementationSchemas,
} from './schema.js';
import { modelMessages as messages } from './messages.js';
import type {
  DatabaseEntry,
  EntityEntry,
  ImplementationEntry,
  Collection,
  EntityCollection,
  RecordIdentity,
  EntryIndex,
  FileAddress,
} from './model.types.js';

export const entityKinds = {
  branches: 'branch',
  packets: 'packet',
  scenarios: 'scenario',
  articles: 'article',
  chronicles: 'chronicle',
  'chronicle-releases': 'chronicle',
  protocols: 'protocol',
} as const;
/**
 * Определяет коллекцию владельца имплементации либо самой карточки.
 */
export function ownerCollection(collection: Collection): EntityCollection {
  switch (collection) {
    case 'packet-revisions':
      return 'packets';
    case 'scenario-revisions':
      return 'scenarios';
    case 'article-revisions':
      return 'articles';
    default:
      return collection;
  }
}
/**
 * Возвращает постоянный ключ владельца имплементации либо самой карточки.
 */
export function entityKey(entry: DatabaseEntry): string {
  if (isEntity(entry)) {
    return entry.key;
  }
  switch (entry.collection) {
    case 'packet-revisions':
      return entry.value.packetKey;
    case 'scenario-revisions':
      return entry.value.scenarioKey;
    case 'article-revisions':
      return entry.value.articleKey;
  }
}
/**
 * Возвращает общий адрес записи; язык принадлежит вложенному переводу.
 */
export function recordKey(address: RecordIdentity): string {
  return address.key;
}
/**
 * Индексирует общие записи по логическому ключу, отклоняя повторные адреса.
 * Используется вместе с recordPath/fileAddress для полного многоязычного снимка.
 */
export function indexEntries(entries: readonly DatabaseEntry[]): EntryIndex {
  const index = new Map<string, DatabaseEntry>();
  for (const entry of entries) {
    const key = recordKey(entry);
    if (index.has(key)) {
      invalidEntry(messages.duplicate, entry);
    }
    index.set(key, entry);
  }
  return index;
}
/**
 * Проверяет явную роль предметной карточки.
 */
export function isEntity(entry: DatabaseEntry): entry is EntityEntry {
  return entry.kind === 'entity';
}
/**
 * Проверяет явную роль имплементации.
 */
export function isImplementation(
  entry: DatabaseEntry,
): entry is ImplementationEntry {
  return entry.kind === 'implementation';
}
/**
 * Формирует путь вспомогательного документного импорта из коллекции и UUID.
 */
export function recordPath(entry: DatabaseEntry, _index?: EntryIndex): string {
  return `${entry.collection}/${entry.value.id}.json`;
}
/**
 * Вычисляет адрес документа из значимых полей, не используя сохранённый key как источник сведений.
 */
export function computedKey(entry: DatabaseEntry): string {
  if (isImplementation(entry)) {
    return `${entityKey(entry)}:rev-${entry.value.rev}`;
  }
  if (entry.collection === 'protocols') {
    const suffix =
      entry.value.variant === 0 ? '' : `-rev-${entry.value.variant}`;
    return `protocol:${entry.value.number}${suffix}`;
  }
  if (entry.collection === 'chronicle-releases') {
    return `${entry.value.chronicleKey}:${entry.value.code}`;
  }
  return `${entityKinds[entry.collection]}:${entry.value.code}`;
}
/**
 * Создаёт файловый адрес для наблюдателей обмена без включения содержимого записи.
 */
export function fileAddress(
  entry: DatabaseEntry,
  index: EntryIndex,
): FileAddress {
  return {
    collection: entry.collection,
    path: recordPath(entry, index),
  };
}
/**
 * Создаёт предметную ошибку; валидатор снимка дополняет её текущим файловым путём.
 */
export function invalidEntry(message: string, address: RecordIdentity): never {
  throw new DatabaseError('VALIDATION_ERROR', message, {
    key: address.key,
  });
}
/**
 * Проверяет представление записи и совпадение публичного адреса с предметными полями.
 */
export function parseEntry(input: unknown): DatabaseEntry {
  let key: string | undefined;
  try {
    const envelope = entryEnvelopeSchema.parse(input);
    key = envelope.key;
    const { value: raw, ...address } = envelope;
    const schema =
      address.kind === 'entity'
        ? entitySchemas[address.collection]
        : implementationSchemas[address.collection];
    const value = schema.parse(raw);
    const parts = key.split(':');
    if (
      value.key !== key ||
      parts[0] !== entityKinds[ownerCollection(address.collection)] ||
      parts.length !==
        (address.kind === 'entity' &&
        address.collection !== 'chronicle-releases'
          ? 2
          : 3)
    ) {
      invalidEntry(messages.address, address);
    }
    // Схема коллекции и роли проверила корреляцию value; динамический выбор скрывает её от TS.
    const entry = { ...address, value } as DatabaseEntry;
    if ('translations' in entry.value) {
      entry.value.translations.sort((left, right) =>
        left.locale.localeCompare(right.locale, 'en'),
      );
    }
    if (entry.key !== computedKey(entry)) {
      invalidEntry(messages.address, entry);
    }
    return entry;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(
      'VALIDATION_ERROR',
      messages.invalid,
      {
        key,
        issues: error instanceof ZodError ? error.issues : undefined,
      },
      error,
    );
  }
}
