import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import * as z from 'zod'
import { DatabaseError, collectionSchema } from '@l2ce/database'
import type { Collection, DatabaseEntry, DatabaseSnapshot, Translation } from '@l2ce/database'
import { readInputJson, readInputText } from '../input/json.js'
import { address, entryMap, ownerKey, publicRecord, reference, translations, TYPES } from './model.js'
import { availableFields, textFieldDefinition } from './definition.js'
import type { InterfaceOptions, QueryPage, ReadItem } from './interface.types.js'

/** Исходные редакции, в которых выполняется поиск знания без протокольного контекста. */
const KNOWLEDGE_REVISIONS: Readonly<Record<string, string>> = {
  packets: 'packet-revisions',
  scenarios: 'scenario-revisions',
  articles: 'article-revisions'
}

/** Формат сохранённой выборки: адреса и редакции, а не исполняемый поисковый запрос. */
export const SELECTION_SCHEMA = z.strictObject({
  formatVersion: z.literal(1),
  version: z.string(),
  query: z.record(z.string(), z.unknown()),
  items: z.array(z.strictObject({ key: z.string(), revisionKey: z.string().optional() }))
})

/**
 * Читает и проверяет сохранённую выборку без неявного переключения базы.
 */
export async function readSelection(path: string): Promise<z.infer<typeof SELECTION_SCHEMA>> {
  const selection = SELECTION_SCHEMA.parse(await readInputJson(path))
  for (const item of selection.items) {
    address(item.key)
    if (item.revisionKey) address(item.revisionKey)
  }
  return selection
}

/**
 * Выбирает только применимую редакцию карточки, никогда не «последнюю».
 */
export function selectedEntry(
  entry: DatabaseEntry,
  snapshot: DatabaseSnapshot,
  options: InterfaceOptions
): DatabaseEntry | undefined {
  if (
    entry.kind === 'implementation' ||
    !['packets', 'scenarios', 'articles'].includes(entry.collection) ||
    options.view === 'edit' ||
    !options.protocol
  )
    return entry
  const protocol = reference('protocol', options.protocol)
  return snapshot.entries.find(
    (candidate) =>
      candidate.kind === 'implementation' &&
      ownerKey(candidate.key) === entry.key &&
      candidate.value.protocolKeys.includes(protocol)
  )
}

/**
 * Проецирует одну запись на brief/full/edit, сохраняя отсутствие перевода отдельно от пустого текста.
 */
export function readItem(
  key: string,
  snapshot: DatabaseSnapshot,
  options: InterfaceOptions,
  pinnedRevision?: string
): ReadItem {
  const target = address(key)
  const entry = snapshot.entries.find((candidate) => candidate.key === key)
  if (!entry) return { key, type: target.collection, availability: 'not-found' }
  const selected = pinnedRevision
    ? snapshot.entries.find((candidate) => candidate.key === pinnedRevision)
    : selectedEntry(entry, snapshot, options)
  if (!selected)
    return {
      key,
      type: target.collection,
      availability: 'unmapped',
      ...(pinnedRevision ? { revisionKey: pinnedRevision } : {})
    }
  const record = publicRecord(selected)
  if (selected.key !== key) {
    record.key = key
    record.revisionKey = selected.key
    record.card = publicRecord(entry)
    for (const [field, value] of Object.entries(entry.value)) {
      if (['name', 'server', 'direction', 'servers'].includes(field)) record[field] = value
    }
  }
  let availability: ReadItem['availability'] = 'available'
  if (options.view !== 'edit' && 'translations' in selected.value) {
    const texts = translations(selected).filter((text) => options.allLocales || text.locale === options.locale)
    if (!options.allLocales && !texts.length) availability = 'translation-missing'
    record.translations = texts.map(({ source, openQuestions, ...text }) =>
      options.view === 'brief'
        ? { locale: text.locale, title: text.title, summary: text.summary, translationStatus: text.translationStatus }
        : { ...text, sources: source, questions: openQuestions }
    )
  }
  if (options.view === 'brief') {
    delete record.id
    delete record.code
    delete record.card
  }
  if (options.fields) {
    const fields = options.fields.split(',')
    const allowed = [...availableFields(selected.collection), ...availableFields(entry.collection)]
    for (const field of fields)
      if (!allowed.includes(field))
        throw new DatabaseError('INVALID_QUERY', `Поле ${field} недоступно у ${selected.collection}.`, { key, field })
    const allFields: Record<string, unknown> = { ...publicRecord(entry), ...publicRecord(selected), key }
    for (const field of fields) {
      if (['title', 'summary', 'description', 'translationStatus', 'sources', 'questions'].includes(field)) {
        const texts = z
          .array(z.record(z.string(), z.unknown()))
          .parse(allFields.translations ?? [])
          .filter((text) => options.view === 'edit' || options.allLocales || text.locale === options.locale)
        record[field] =
          options.allLocales || options.view === 'edit'
            ? Object.fromEntries(texts.map((text) => [z.string().parse(text.locale), text[field]]))
            : (texts[0]?.[field] ?? null)
      } else if (Object.hasOwn(allFields, field)) {
        record[field] =
          field === 'translations'
            ? z
                .array(z.record(z.string(), z.unknown()))
                .parse(allFields[field])
                .filter((text) => options.view === 'edit' || options.allLocales || text.locale === options.locale)
            : allFields[field]
      }
    }
    for (const field of Object.keys(record)) if (field !== 'key' && !fields.includes(field)) delete record[field]
  }
  const revisions =
    selected === entry && ['packets', 'scenarios', 'articles'].includes(entry.collection)
      ? snapshot.entries
          .filter((candidate) => candidate.kind === 'implementation' && ownerKey(candidate.key) === entry.key)
          .map((candidate) => candidate.key)
      : undefined
  return {
    key,
    type: target.collection,
    availability,
    ...(selected.key !== key ? { revisionKey: selected.key } : {}),
    record,
    ...(revisions ? { revisions } : {})
  }
}

/**
 * Возвращает типы, для которых предметный фильтр действительно определён.
 */
export function supportsFilter(type: Collection, field: string): boolean {
  const knowledge = [
    'packets',
    'scenarios',
    'articles',
    'packet-revisions',
    'scenario-revisions',
    'article-revisions'
  ].includes(type)
  if (field === 'server') return knowledge
  if (field === 'direction') return ['packets', 'packet-revisions'].includes(type)
  if (['status', 'translationStatus', 'sources', 'questions', 'title', 'summary', 'description'].includes(field))
    return availableFields(type).includes(field) || (knowledge && !type.endsWith('-revisions'))
  if (field === 'protocol') return ['protocols', 'releases', 'release-contexts'].includes(type) || knowledge
  if (['branch', 'saga', 'chronicle', 'release'].includes(field))
    return ['sagas', 'chronicles', 'releases', 'release-contexts', 'protocols'].includes(type) || knowledge
  if (['region', 'country'].includes(field)) return ['release-contexts', 'protocols'].includes(type) || knowledge
  if (field === 'translation') return availableFields(type).includes('translations')
  return availableFields(type).includes(field)
}

/**
 * Определяет область до чтения записей и отклоняет несовместимые явно выбранные типы.
 */
export function queryTypes(options: InterfaceOptions): Collection[] {
  let types = options.type
    ? options.type.split(',').map((type) => collectionSchema.parse(type))
    : Object.keys(TYPES).map((type) => collectionSchema.parse(type))
  const filters = [
    'branch',
    'saga',
    'chronicle',
    'release',
    'region',
    'country',
    'protocol',
    'server',
    'direction',
    'status',
    'translationStatus'
  ].filter((field) => options[field as keyof InterfaceOptions] !== undefined)
  filters.push(...options.has, ...options.missing)
  if (options.sourceHost || options.sourceUrl) filters.push('sources')
  for (const field of filters) {
    if (!Object.keys(TYPES).some((type) => supportsFilter(collectionSchema.parse(type), field))) {
      throw new DatabaseError('INVALID_QUERY', `Неизвестное поле фильтра ${field}. Посмотрите types или schema.`)
    }
    const unsupported = types.filter((type) => !supportsFilter(type, field))
    if (options.type && unsupported.length)
      throw new DatabaseError(
        'INVALID_QUERY',
        `Фильтр ${field} неприменим к типам ${unsupported.join(', ')}. Уберите фильтр или выберите совместимые типы.`,
        { field, types: unsupported }
      )
    types = types.filter((type) => supportsFilter(type, field))
  }
  if (options.searchIn)
    for (const field of options.searchIn.split(',')) {
      if (
        ![
          'key',
          'name',
          'title',
          'summary',
          'description',
          'sources.url',
          'sources.title',
          'sources.summary',
          'questions'
        ].includes(field)
      )
        throw new DatabaseError('INVALID_QUERY', `Неизвестное поисковое поле ${field}.`)
    }
  return types
}

/**
 * Находит явно записанные контексты классификации; страны из региона не выводятся.
 */
function classification(entry: DatabaseEntry, snapshot: DatabaseSnapshot): DatabaseEntry[] {
  const entries = entryMap(snapshot)
  const result: DatabaseEntry[] = []
  const pending = [entry]
  const seen = new Set<string>()
  while (pending.length) {
    const current = pending.pop()
    if (!current || seen.has(current.key)) continue
    seen.add(current.key)
    result.push(current)
    const record = publicRecord(current)
    for (const field of ['branch', 'saga', 'chronicle', 'release']) {
      const key = record[field]
      if (typeof key === 'string' && entries.has(key)) pending.push(entries.get(key) ?? current)
    }
  }
  return result
}

/**
 * Разделяет альтернативные региональные пути, чтобы фильтры не склеивали два разных выхода.
 */
function classificationScopes(entry: DatabaseEntry, snapshot: DatabaseSnapshot): DatabaseEntry[][] {
  const revisions =
    entry.kind === 'implementation'
      ? [entry]
      : ['packets', 'scenarios', 'articles'].includes(entry.collection)
        ? snapshot.entries.filter(
            (candidate) => candidate.kind === 'implementation' && ownerKey(candidate.key) === entry.key
          )
        : []
  const protocolKeys = revisions.flatMap((revision) =>
    'protocolKeys' in revision.value ? revision.value.protocolKeys : []
  )
  const protocols =
    entry.collection === 'protocols'
      ? [entry]
      : snapshot.entries.filter((candidate) => protocolKeys.includes(candidate.key))
  if (!protocols.length) return [classification(entry, snapshot)]
  return protocols.flatMap((protocol) => {
    const contexts = snapshot.entries.filter(
      (candidate) =>
        candidate.kind === 'entity' &&
        'protocolKeys' in candidate.value &&
        candidate.value.protocolKeys.includes(protocol.key)
    )
    return contexts.length
      ? contexts.map((context) => [entry, protocol, ...classification(context, snapshot)])
      : [[entry, protocol]]
  })
}

/**
 * Проверяет наличие значения, не смешивая 0 с отсутствием и перевод с пустым описанием.
 */
function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

/**
 * Возвращает нормализованное поисковое представление, не изменяя сохранённый документ.
 */
function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase()
}

/**
 * Проверяет текст и возвращает конкретные поля совпадения и короткие фрагменты.
 */
function textMatches(
  entry: DatabaseEntry,
  text: Translation | undefined,
  query: string,
  options: InterfaceOptions
): NonNullable<ReadItem['matches']> {
  const fields = options.searchIn?.split(',') ?? [
    'key',
    ...availableFields(entry.collection).filter((field) => textFieldDefinition(field).search)
  ]
  const matches: NonNullable<ReadItem['matches']> = []
  for (const field of fields) {
    const values =
      field === 'key'
        ? [entry.key]
        : field === 'name'
          ? ['name' in entry.value ? entry.value.name : '']
          : field === 'questions'
            ? (text?.openQuestions ?? [])
            : field.startsWith('sources.')
              ? (text?.source ?? []).map((source) => textValue(source, field.slice(8)))
              : text
                ? [textValue(text, field)]
                : []
    for (const value of values) {
      const literal = field === 'key' || field === 'sources.url'
      const content = literal ? value : normalize(value)
      const needle = literal ? query : normalize(query)
      const position = content.indexOf(needle)
      if (
        options.match === 'exact'
          ? content === needle
          : options.match === 'prefix'
            ? content.startsWith(needle)
            : position >= 0
      ) {
        matches.push({
          field,
          ...(text ? { locale: text.locale } : {}),
          fragment: value.slice(Math.max(0, position - 40), Math.max(0, position) + query.length + 80)
        })
      }
    }
  }
  return matches
}

/**
 * Читает только строковое значение известного поискового поля.
 */
function textValue(record: object, field: string): string {
  const value = z.record(z.string(), z.unknown()).parse(record)[field]
  return typeof value === 'string' ? value : ''
}

/**
 * Фильтрует исходные записи; все языковые условия проверяет в одном переводе.
 */
export function filterEntries(
  snapshot: DatabaseSnapshot,
  options: InterfaceOptions,
  query?: string
): { entries: DatabaseEntry[]; matches: Map<string, NonNullable<ReadItem['matches']>>; types: Collection[] } {
  const queryOptions =
    query !== undefined && !options.protocol
      ? {
          ...options,
          type: options.type
            ?.split(',')
            .map((type) => KNOWLEDGE_REVISIONS[type] ?? type)
            .join(',')
        }
      : options
  const types = queryTypes(queryOptions).filter(
    (type) => query === undefined || !!options.protocol || !['packets', 'scenarios', 'articles'].includes(type)
  )
  const matches = new Map<string, NonNullable<ReadItem['matches']>>()
  const entries = snapshot.entries
    .filter((entry) => types.includes(entry.collection))
    .filter((entry) => {
      const selected = selectedEntry(entry, snapshot, options)
      if (!selected) return false
      if (
        options.protocol &&
        selected.kind === 'implementation' &&
        !selected.value.protocolKeys.includes(reference('protocol', options.protocol))
      )
        return false
      if (options.protocol && ['protocols', 'releases', 'release-contexts'].includes(entry.collection)) {
        const key = reference('protocol', options.protocol)
        if (
          entry.collection === 'protocols'
            ? entry.key !== key
            : !('protocolKeys' in entry.value && entry.value.protocolKeys.includes(key)) &&
              !(
                entry.collection === 'releases' &&
                snapshot.entries.some(
                  (candidate) =>
                    candidate.collection === 'release-contexts' &&
                    candidate.value.releaseKey === entry.key &&
                    candidate.value.protocolKeys.includes(key)
                )
              )
        )
          return false
      }
      const classificationFilters = ['branch', 'saga', 'chronicle', 'release', 'region', 'country'] as const
      if (
        classificationFilters.some((field) => options[field] !== undefined) &&
        !classificationScopes(selected, snapshot).some((context) =>
          classificationFilters.every((field) => {
            if (!options[field]) return true
            const target = reference(field, options[field])
            return context.some(
              (record) =>
                record.key === target ||
                Object.values(publicRecord(record)).some(
                  (value) => value === target || (Array.isArray(value) && value.includes(target))
                )
            )
          })
        )
      )
        return false
      const owner = snapshot.entries.find((candidate) => candidate.key === ownerKey(selected.key)) ?? selected
      if (
        options.server &&
        !('server' in owner.value
          ? owner.value.server === options.server
          : 'servers' in owner.value && owner.value.servers.includes(z.enum(['login', 'game']).parse(options.server)))
      )
        return false
      if (options.direction && !('direction' in owner.value && owner.value.direction === options.direction))
        return false
      if (options.status && !('status' in selected.value && selected.value.status === options.status)) return false
      const record = publicRecord(selected)
      const languageFields = [
        'title',
        'summary',
        'description',
        'translationStatus',
        'sources',
        'questions',
        'translation'
      ]
      for (const [fields, shouldHave] of [
        [options.has, true],
        [options.missing, false]
      ] as const) {
        for (const field of fields)
          if (!languageFields.includes(field) && hasValue(record[field]) !== shouldHave) return false
      }
      const needsLanguage =
        query !== undefined ||
        options.translationStatus !== undefined ||
        options.sourceHost !== undefined ||
        options.sourceUrl !== undefined ||
        [...options.has, ...options.missing].some((field) => languageFields.includes(field))
      if (!needsLanguage) return true
      const texts = translations(selected).filter((text) => options.allLocales || text.locale === options.locale)
      const candidates: (Translation | undefined)[] = texts.length ? [...texts] : [undefined]
      const found: NonNullable<ReadItem['matches']> = []
      const matchingTexts = candidates.filter((text) => {
        const localized = text
          ? { ...text, sources: text.source, questions: text.openQuestions, translation: text }
          : {}
        if (options.translationStatus && text?.translationStatus !== options.translationStatus) return false
        if (options.sourceUrl && !text?.source.some((source) => source.url === options.sourceUrl)) return false
        if (options.sourceHost && !text?.source.some((source) => new URL(source.url).hostname === options.sourceHost))
          return false
        for (const [fields, shouldHave] of [
          [options.has, true],
          [options.missing, false]
        ] as const)
          for (const field of fields) {
            if (
              languageFields.includes(field) &&
              hasValue(z.record(z.string(), z.unknown()).parse(localized)[field]) !== shouldHave
            )
              return false
          }
        if (query === undefined) return true
        const current = textMatches(selected, text, query, options)
        found.push(...current)
        return current.length > 0
      })
      if (found.length) matches.set(entry.key, found)
      return matchingTexts.length > 0
    })
  const sort = options.sort?.split(',') ?? ['order', 'key']
  if (
    options.allLocales &&
    sort.some((field) => ['title', 'summary', 'translationStatus'].includes(field.replace(/^-/, '')))
  ) {
    throw new DatabaseError('INVALID_QUERY', 'Сортировка языкового поля требует одного языка, а не --all-locales.')
  }
  for (const field of sort)
    if (
      ![
        'key',
        'order',
        'title',
        'summary',
        'status',
        'translationStatus',
        'releasedOn',
        'name',
        'number',
        'variant',
        'server',
        'direction',
        'code',
        'id',
        'branch',
        'saga',
        'chronicle',
        'region',
        'release'
      ].includes(field.replace(/^-/, '')) ||
      (field.replace(/^-/, '') !== 'key' &&
        field.replace(/^-/, '') !== 'order' &&
        !types.every((type) =>
          availableFields(
            options.protocol && options.view !== 'edit' && KNOWLEDGE_REVISIONS[type]
              ? collectionSchema.parse(KNOWLEDGE_REVISIONS[type])
              : type
          ).includes(field.replace(/^-/, ''))
        ))
    )
      throw new DatabaseError('INVALID_QUERY', `Сортировка ${field} недоступна для выбранных типов.`)
  entries.sort((left, right) => {
    for (const sorting of [...sort, 'key']) {
      const field = sorting.replace(/^-/, '')
      const a = sortValue(left, field, snapshot, options)
      const b = sortValue(right, field, snapshot, options)
      const comparison =
        a === b
          ? 0
          : a === null || a === undefined
            ? 1
            : b === null || b === undefined
              ? -1
              : typeof a === 'number' && typeof b === 'number'
                ? a - b
                : String(a).localeCompare(String(b), 'en')
      if (comparison) return comparison * (sorting.startsWith('-') ? -1 : 1)
    }
    return 0
  })
  return { entries, matches, types }
}

/**
 * Читает сортируемое значение выбранного перевода, не подставляя заголовок другого языка.
 */
function sortValue(
  entry: DatabaseEntry,
  field: string,
  snapshot: DatabaseSnapshot,
  options: InterfaceOptions
): unknown {
  if (['title', 'summary', 'translationStatus'].includes(field)) {
    const selected = selectedEntry(entry, snapshot, options) ?? entry
    const text = translations(selected).find((translation) => translation.locale === options.locale)
    return text ? z.record(z.string(), z.unknown()).parse(text)[field] : undefined
  }
  const record = publicRecord(entry)
  return Object.hasOwn(record, field)
    ? record[field]
    : publicRecord(selectedEntry(entry, snapshot, options) ?? entry)[field]
}

/**
 * Фиксирует условия запроса без размера страницы и оформления вывода.
 */
function querySignature(operation: string, keys: string[], options: InterfaceOptions, query?: string): string {
  const {
    after: _after,
    limit: _limit,
    offset: _offset,
    format: _format,
    color: _color,
    withVersion: _version,
    saveSelection: _save,
    verbose: _verbose,
    brief: _brief,
    keysFile: _keysFile,
    selection: _selection,
    ...conditions
  } = options
  const canonicalConditions = Object.fromEntries(
    Object.entries(conditions)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
  )
  return createHash('sha256')
    .update(JSON.stringify({ operation, keys, conditions: canonicalConditions, query }))
    .digest('hex')
}

/**
 * Создаёт страницы с версионированным курсором; размер следующей порции можно уменьшить.
 */
export function paginate<T>(
  items: T[],
  operation: string,
  keys: string[],
  options: InterfaceOptions,
  version: string,
  query?: string
): QueryPage<T> {
  if (options.all && (options.limit !== undefined || options.offset !== undefined || options.after))
    throw new DatabaseError('USAGE', '--all несовместим с --limit, --offset и --after.')
  if (options.after && options.offset !== undefined) throw new DatabaseError('USAGE', '--after несовместим с --offset.')
  const signature = querySignature(operation, keys, options, query)
  let offset = options.offset ?? 0
  if (options.after) {
    let cursor: { version: string; signature: string; offset: number }
    try {
      cursor = z
        .strictObject({ version: z.string(), signature: z.string(), offset: z.number().int().nonnegative() })
        .parse(JSON.parse(Buffer.from(options.after, 'base64url').toString('utf8')))
    } catch {
      throw new DatabaseError('INVALID_CURSOR', 'Курсор повреждён. Начните чтение заново.')
    }
    if (cursor.version !== version)
      throw new DatabaseError(
        'REVISION_CONFLICT',
        'База изменилась между страницами. Повторите исходный запрос или перечитайте сохранённую выборку.'
      )
    if (cursor.signature !== signature)
      throw new DatabaseError(
        'INVALID_CURSOR',
        'Курсор принадлежит другому запросу, языку, представлению или протоколу.'
      )
    offset = cursor.offset
  }
  const limit = options.all ? items.length : (options.limit ?? (operation === 'read' ? items.length : 20))
  const selected = items.slice(offset, offset + limit)
  const end = Math.min(offset + selected.length, items.length)
  const hasMore = end < items.length
  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ version, signature, offset: end })).toString('base64url')
    : null
  return {
    items: selected,
    page: {
      start: selected.length ? offset + 1 : 0,
      end,
      returned: selected.length,
      total: items.length,
      remaining: Math.max(0, items.length - end),
      hasMore,
      nextCursor
    },
    continuation: nextCursor
  }
}

/**
 * Читает адреса одним вводом; явный список не ограничивается пятьюдесятью записями.
 */
export async function requestedKeys(
  keys: string[],
  options: InterfaceOptions
): Promise<{ keys: string[]; selection?: z.infer<typeof SELECTION_SCHEMA> }> {
  if ([keys.length > 0, options.keysFile !== undefined, options.selection !== undefined].filter(Boolean).length !== 1)
    throw new DatabaseError(
      'USAGE',
      'Укажите адреса, --keys-file либо --selection, но не несколько источников адресов.'
    )
  const selection = options.selection ? await readSelection(options.selection) : undefined
  const selected = selection
    ? selection.items.map((item) => item.key)
    : options.keysFile
      ? (await readInputText(options.keysFile))
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : keys
  for (const key of selected) address(key)
  return { keys: selected, selection }
}

/**
 * Сохраняет только действительно показанные записи вместе с выбранными редакциями.
 */
export async function saveSelection(
  path: string,
  items: ReadItem[],
  options: InterfaceOptions,
  version: string
): Promise<void> {
  await writeFile(
    path,
    JSON.stringify(
      {
        formatVersion: 1,
        version,
        query: { ...options, saveSelection: undefined },
        items: items.map(({ key, revisionKey }) => ({ key, revisionKey }))
      },
      null,
      2
    ) + '\n',
    { flag: 'wx' }
  )
}
