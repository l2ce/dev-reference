import { randomUUID } from 'node:crypto'
import * as z from 'zod'
import {
  DatabaseError,
  addressSchema,
  collectionSchema,
  entitySchemas,
  revisionSchemas,
  parseEntry,
  sourceSchema,
  translationSchema
} from '@l2ce/database'
import type { Collection, DatabaseEntry, DatabaseSnapshot, RecordAddress, Translation } from '@l2ce/database'

/** Типы и пространства адресов публичного интерфейса. */
export const TYPES = {
  branches: ['branch', 'Ветка'],
  sagas: ['saga', 'Сага'],
  chronicles: ['chronicle', 'Хроника'],
  releases: ['release', 'Релиз'],
  'release-contexts': ['release-context', 'Региональный контекст'],
  regions: ['region', 'Регион'],
  countries: ['country', 'Страна'],
  protocols: ['protocol', 'Протокол'],
  packets: ['packet', 'Пакет'],
  scenarios: ['scenario', 'Сценарий'],
  articles: ['article', 'Статья'],
  'packet-revisions': ['packet', 'Редакция пакета'],
  'scenario-revisions': ['scenario', 'Редакция сценария'],
  'article-revisions': ['article', 'Редакция статьи']
} satisfies Record<Collection, readonly [string, string]>

/** Схемы предметных значений всех зарегистрированных коллекций. */
export const RECORD_SCHEMAS = { ...entitySchemas, ...revisionSchemas }
/** Проверяет внешние динамические объекты без утверждения типа. */
export const OBJECT_SCHEMA = z.record(z.string(), z.unknown())
/** Поля выбранного перевода, включая его вложенные сведения. */
export const TEXT_FIELDS = ['title', 'summary', 'description', 'translationStatus', 'sources', 'questions']
/** Отображение публичных смысловых имён на поля предметного API. */
export const FIELD_NAMES: Readonly<Record<string, string>> = {
  branch: 'branchKey',
  saga: 'sagaKey',
  chronicle: 'chronicleKey',
  release: 'releaseKey',
  region: 'regionKey',
  countries: 'countryKeys',
  protocols: 'protocolKeys',
  sources: 'source',
  questions: 'openQuestions'
}
/** Однозначные типы целей собственных исходящих отношений. */
export const RELATIONS: Readonly<Record<string, string>> = {
  branch: 'branch',
  saga: 'saga',
  chronicle: 'chronicle',
  release: 'release',
  region: 'region',
  countries: 'country',
  protocols: 'protocol'
}
/** Системные поля, назначаемые из адреса и не изменяемые обычной правкой. */
export const IMMUTABLE_FIELDS = [
  'id',
  'key',
  'code',
  'number',
  'variant',
  'rev',
  'packetKey',
  'scenarioKey',
  'articleKey',
  'releaseKey'
]

/**
 * Разбирает полный адрес, не принимая название или случайный префикс за идентичность.
 */
export function address(key: string): RecordAddress {
  const match =
    /^(branch|saga|chronicle|release|region|country|protocol|packet|scenario|article|release-context):([a-z0-9]+(?:[.-][a-z0-9]+)*)(?::([a-z0-9]+(?:[.-][a-z0-9]+)*))?$/.exec(
      key
    )
  if (!match) {
    throw new DatabaseError(
      'USAGE',
      `Неверный адрес «${key}». Используйте полный адрес, например release:the-kamael.`,
      { key }
    )
  }
  const [, prefix, code, suffix] = match
  const isRevision = ['packet', 'scenario', 'article'].includes(prefix) && suffix !== undefined
  const numericParts = prefix === 'protocol' ? code.split('-rev-') : isRevision ? [suffix.slice(4)] : []
  if (
    (prefix === 'release-context' && !suffix) ||
    (suffix && prefix !== 'release-context' && !isRevision) ||
    (isRevision && !/^rev-[1-9]\d*$/.test(suffix)) ||
    (prefix === 'protocol' && !/^(0|[1-9]\d*)(?:-rev-[1-9]\d*)?$/.test(code)) ||
    numericParts.some((part) => !Number.isSafeInteger(Number(part)))
  ) {
    throw new DatabaseError('USAGE', `Неверная форма адреса «${key}».`, { key })
  }
  const collection = Object.keys(TYPES).find(
    (name) => TYPES[collectionSchema.parse(name)][0] === prefix && name.endsWith('-revisions') === isRevision
  )
  if (!collection) {
    throw new DatabaseError('USAGE', `Неизвестный тип адреса «${key}».`)
  }
  return addressSchema.parse({ key, collection, kind: isRevision ? 'implementation' : 'entity' })
}

/**
 * Нормализует короткий код только внутри однозначно типизированного поля.
 */
export function reference(prefix: string, key: string): string {
  const normalized = key.includes(':') ? key : `${prefix}:${key}`
  const target = address(normalized)
  if (!normalized.startsWith(`${prefix}:`) || target.kind !== 'entity') {
    throw new DatabaseError('INVALID_INPUT', `Ожидался адрес ${prefix}:…, получен «${key}».`)
  }
  return normalized
}

/**
 * Возвращает собственные переводы без подстановки соседнего языка или редакции.
 */
export function translations(entry: DatabaseEntry): readonly Translation[] {
  return 'translations' in entry.value ? entry.value.translations : []
}

/**
 * Возвращает адрес владельца редакции или самой карточки.
 */
export function ownerKey(key: string): string {
  return key.replace(/:rev-\d+$/, '')
}

/**
 * Создаёт значения идентичности исключительно из адреса и назначает UUID.
 */
export function identity(key: string): Record<string, unknown> {
  const target = address(key)
  const [, code, suffix] = key.split(':')
  if (target.kind === 'implementation') {
    return { id: randomUUID(), key, rev: Number(suffix.slice(4)), [`${key.split(':')[0]}Key`]: ownerKey(key) }
  }
  if (target.collection === 'protocols') {
    const [number, variant] = code.split('-rev-').map(Number)
    return { id: randomUUID(), key, number, variant: variant ?? 0 }
  }
  if (target.collection === 'release-contexts') {
    return { id: randomUUID(), key, code: suffix, releaseKey: `release:${code}` }
  }
  return { id: randomUUID(), key, code }
}

/**
 * Возвращает публичное редактируемое представление без внутренних SQL/DTO-имён связей.
 */
export function publicRecord(entry: DatabaseEntry): Record<string, unknown> {
  const record: Record<string, unknown> = { key: entry.key, type: entry.collection }
  for (const [name, value] of Object.entries(entry.value)) {
    const publicName = Object.keys(FIELD_NAMES).find((field) => FIELD_NAMES[field] === name) ?? name
    record[publicName] =
      name === 'translations'
        ? translations(entry).map(({ source, openQuestions, ...text }) => ({
            ...text,
            sources: source,
            questions: openQuestions
          }))
        : value
  }
  return record
}

/**
 * Описывает полную замену публичного edit-представления, включая необязательную неизменяемую идентичность.
 */
export function replacementSchema(collection: Collection): z.ZodObject {
  const shape: Record<string, z.ZodType> = {}
  for (const [field, fieldSchema] of Object.entries(RECORD_SCHEMAS[collection].shape)) {
    const name = Object.keys(FIELD_NAMES).find((name) => FIELD_NAMES[name] === field) ?? field
    shape[name] = IMMUTABLE_FIELDS.includes(field)
      ? fieldSchema.optional()
      : field === 'translations'
        ? z
            .array(
              z.strictObject({
                ...translationSchema.omit({ source: true, openQuestions: true }).shape,
                sources: z.array(sourceSchema.extend({ id: sourceSchema.shape.id.optional() })).default([]),
                questions: translationSchema.shape.openQuestions
              })
            )
            .default([])
        : fieldSchema
  }
  shape.type = z.literal(collection).optional()
  return z.strictObject(shape)
}

/**
 * Проверяет полную замену edit-представления и сохраняет неизменяемую идентичность.
 */
export function replaceRecord(previous: DatabaseEntry, input: unknown): DatabaseEntry {
  const raw = replacementSchema(previous.collection).parse(input)
  const fields: Record<string, unknown> = { ...identity(previous.key), id: previous.value.id }
  for (const [name, value] of Object.entries(raw)) {
    if (name === 'type') {
      if (value !== previous.collection) throw new DatabaseError('INVALID_INPUT', 'Тип записи неизменяем.')
      continue
    }
    const field = FIELD_NAMES[name] ?? name
    if (IMMUTABLE_FIELDS.includes(field) && field in fields && value !== fields[field]) {
      throw new DatabaseError('INVALID_INPUT', `Поле ${name} неизменяемо.`, { key: previous.key, field: name, value })
    }
    fields[field] =
      name === 'translations'
        ? z
            .array(OBJECT_SCHEMA)
            .parse(value)
            .map((text) => {
              const { sources, questions, ...rest } = text
              return {
                ...rest,
                source: z
                  .array(OBJECT_SCHEMA)
                  .parse(sources ?? [])
                  .map((source) => ({ id: randomUUID(), ...source })),
                openQuestions: questions
              }
            })
        : value
  }
  return parseEntry({ ...address(previous.key), value: fields })
}

/**
 * Проверяет наличие предметной записи с диагностикой следующего действия.
 */
export function requireEntry(entries: ReadonlyMap<string, DatabaseEntry>, key: string): DatabaseEntry {
  address(key)
  const entry = entries.get(key)
  if (!entry)
    throw new DatabaseError('NOT_FOUND', `Запись ${key} не найдена. Проверьте полный адрес и выбранную базу.`, {
      notFoundKind: 'record',
      key
    })
  return entry
}

/**
 * Создаёт пустой перевод без выдуманного заголовка и текста другого языка.
 */
export function emptyTranslation(locale: string): Translation {
  return translationSchema.parse({ locale, title: '', summary: '', description: '' })
}

/**
 * Возвращает согласованный индекс адресов снимка.
 */
export function entryMap(snapshot: DatabaseSnapshot): Map<string, DatabaseEntry> {
  return new Map(snapshot.entries.map((entry) => [entry.key, entry]))
}
