import { DatabaseError } from '../errors.js'
import {
  entityKey,
  indexEntries,
  invalidEntry,
  isEntity,
  isImplementation,
  ownerCollection,
  parseEntry
} from './entry.js'
import { manifestSchema, snapshotEnvelopeSchema } from './schema.js'
import { modelMessages as messages } from './messages.js'
import { entryIds } from './identities.js'
import type {
  DatabaseEntry,
  DatabaseSnapshot,
  EntityCollection,
  EntityEntry,
  EntryIndex,
  ImplementationEntry
} from './model.types.js'

/**
 * Требует существующую карточку указанного предметного вида независимо от переводов.
 */
function requireEntity(
  index: EntryIndex,
  owner: DatabaseEntry,
  collection: EntityCollection,
  key: string
): EntityEntry {
  const target = index.get(key)
  if (!target || !isEntity(target) || target.collection !== collection) {
    invalidEntry(messages.reference, owner)
  }
  return target
}

/**
 * Проверяет уникальность списка без изменения его значимого порядка.
 */
function unique(values: readonly (string | number)[], entry: DatabaseEntry): void {
  if (new Set(values).size !== values.length) {
    invalidEntry(messages.duplicate, entry)
  }
}

/**
 * Проверяет UUID, языки и полноту документа; содержимое Markdown остаётся непрозрачным текстом.
 */
function validateContent(snapshot: DatabaseSnapshot, entry: DatabaseEntry, ids: Set<string>): void {
  for (const id of entryIds(entry)) {
    if (ids.has(id)) {
      invalidEntry(messages.duplicateId, entry)
    }
    ids.add(id)
  }
  const value = entry.value
  if ('translations' in value) {
    unique(
      value.translations.map((translation) => translation.locale),
      entry
    )
    for (const translation of value.translations) {
      if (!snapshot.locales.includes(translation.locale)) {
        invalidEntry(messages.locale, entry)
      }
    }
    if (
      'status' in value &&
      value.status === 'documented' &&
      !value.translations.some((translation) => translation.description.trim())
    ) {
      invalidEntry(messages.content, entry)
    }
  }
}

/**
 * Проверяет технический селектор и пересечение состояний в пределах одного протокола.
 */
function validateOpcode(
  index: EntryIndex,
  entry: Extract<ImplementationEntry, { collection: 'packet-revisions' }>,
  selectors: Map<string, readonly string[][]>
): void {
  const packet = requireEntity(index, entry, 'packets', entry.value.packetKey)
  if (packet.collection !== 'packets') {
    invalidEntry(messages.reference, entry)
  }
  const value = entry.value
  unique(value.states, entry)
  if (value.status === 'documented' && value.opcode === null) {
    invalidEntry(messages.opcode, entry)
  }
  for (const part of value.opcode ?? []) {
    if (part.value >= 2 ** { u8: 8, u16le: 16, u32le: 32 }[part.type]) {
      invalidEntry(messages.opcode, entry)
    }
  }
  if (!value.opcode) {
    return
  }
  for (const protocol of value.protocolKeys) {
    const key = JSON.stringify([
      protocol,
      packet.value.server,
      packet.value.direction,
      value.opcode.map((part) => [part.type, part.value])
    ])
    const previous = selectors.get(key) ?? []
    if (
      previous.some(
        (states) =>
          states.length === 0 || value.states.length === 0 || states.some((state) => value.states.includes(state))
      )
    ) {
      invalidEntry(messages.opcode, entry)
    }
    selectors.set(key, [...previous, value.states])
  }
}

/**
 * Проверяет типизированные связи и единственную редакцию карточки для каждого протокола.
 */
function validateRelations(
  index: EntryIndex,
  entry: DatabaseEntry,
  bindings: Set<string>,
  selectors: Map<string, readonly string[][]>
): void {
  if (entry.collection === 'chronicles' || entry.collection === 'sagas') {
    requireEntity(index, entry, 'branches', entry.value.branchKey)
  }
  if (entry.collection === 'chronicles' && entry.value.sagaKey !== null) {
    const saga = requireEntity(index, entry, 'sagas', entry.value.sagaKey)
    if (saga.collection !== 'sagas' || saga.value.branchKey !== entry.value.branchKey) {
      invalidEntry(messages.reference, entry)
    }
  }
  if (entry.collection === 'releases') {
    requireEntity(index, entry, 'chronicles', entry.value.chronicleKey)
  }
  if (entry.collection === 'release-contexts') {
    requireEntity(index, entry, 'releases', entry.value.releaseKey)
    if (entry.value.regionKey !== null) {
      requireEntity(index, entry, 'regions', entry.value.regionKey)
    }
    unique(entry.value.countryKeys, entry)
    for (const country of entry.value.countryKeys) {
      requireEntity(index, entry, 'countries', country)
    }
  }
  if (isImplementation(entry)) {
    requireEntity(index, entry, ownerCollection(entry.collection), entityKey(entry))
  }
  if ('servers' in entry.value) {
    unique(entry.value.servers, entry)
  }
  if (entry.collection === 'protocols') {
    unique(entry.value.loginRevisions, entry)
  }
  if ('protocolKeys' in entry.value) {
    unique(entry.value.protocolKeys, entry)
    for (const protocol of entry.value.protocolKeys) {
      requireEntity(index, entry, 'protocols', protocol)
      if (isImplementation(entry)) {
        const binding = JSON.stringify([entityKey(entry), protocol])
        if (bindings.has(binding)) {
          invalidEntry(messages.binding, entry)
        }
        bindings.add(binding)
      }
    }
  }
  if (entry.collection === 'packet-revisions') {
    validateOpcode(index, entry, selectors)
  }
}

/**
 * Проверяет полный снимок общих сущностей и переводов перед атомарной записью.
 * Неполные записи, отсутствие переводов и пустая применимость допустимы.
 */
export function validateSnapshot(input: unknown): DatabaseSnapshot {
  try {
    const { entries: raw, ...metadata } = snapshotEnvelopeSchema.parse(input)
    const snapshot: DatabaseSnapshot = {
      ...manifestSchema.parse(metadata),
      entries: raw.map(parseEntry)
    }
    const index = indexEntries(snapshot.entries)
    const ids = new Set<string>()
    const bindings = new Set<string>()
    const selectors = new Map<string, readonly string[][]>()
    for (const entry of snapshot.entries) {
      validateContent(snapshot, entry, ids)
      validateRelations(index, entry, bindings, selectors)
    }
    return snapshot
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    throw new DatabaseError('VALIDATION_ERROR', messages.invalid, undefined, error)
  }
}
