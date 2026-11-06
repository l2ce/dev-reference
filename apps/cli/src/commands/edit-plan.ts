import { randomUUID } from 'node:crypto'
import * as z from 'zod'
import { DatabaseError, parseEntry, sourceSchema, translationSchema, validateSnapshot } from '@l2ce/database'
import { referenceMarkdownDirectives } from '@l2ce/core/markdown'
import type { DatabaseEntry, DatabaseSnapshot, Translation } from '@l2ce/database'
import {
  address,
  emptyTranslation,
  entryMap,
  FIELD_NAMES,
  identity,
  OBJECT_SCHEMA,
  ownerKey,
  publicRecord,
  reference,
  RELATIONS,
  replaceRecord,
  requireEntry,
  TEXT_FIELDS,
  translations
} from './model.js'
import { availableFields, relationDefinitions, textFieldDefinition, valueSchema } from './definition.js'
import { invalidFieldsError, revisionOwnerError } from './diagnostics.js'
import type { EditOperation, EditPlan, InterfaceOptions } from './interface.types.js'

/**
 * Проверяет обязательную область и критерии даже у пустой сохранённой выборки.
 */
export function validateOperationOptions(operation: string, options: InterfaceOptions): void {
  if (['source.clear', 'question.clear'].includes(operation) && !options.locale && !options.allLocales)
    throw new DatabaseError('USAGE', 'Для clear явно укажите --locale либо --all-locales.')
  if (['source.update', 'source.remove'].includes(operation)) {
    if ([options.id, options.matchUrl, options.matchHost].filter((value) => value !== undefined).length !== 1)
      throw new DatabaseError('USAGE', 'Выберите ровно один критерий: --id, --match-url либо --match-host.')
    if (operation === 'source.update' && options.matchHost)
      throw new DatabaseError('USAGE', 'source update поддерживает только --id либо --match-url.')
  }
  if (operation === 'relations' && options.in && options.out)
    throw new DatabaseError('USAGE', 'Выберите --in либо --out; без них показываются оба направления.')
}

/**
 * Нормализует только однозначно типизированные ссылки до проверки схемой операции.
 */
function normalizeValues(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [
      field,
      field in RELATIONS && typeof value === 'string'
        ? reference(RELATIONS[field], value)
        : ['protocols', 'countries'].includes(field)
          ? z
              .array(z.string())
              .parse(value)
              .map((key) => reference(RELATIONS[field], key))
          : value
    ])
  )
}

/**
 * Проверяет язык до изменения перевода, не добавляя его в реестр неявно.
 */
function editLocale(operation: EditOperation, snapshot: DatabaseSnapshot): string {
  const locale = operation.locale ?? snapshot.defaultLocale
  if (!snapshot.locales.includes(locale))
    throw new DatabaseError(
      'INVALID_INPUT',
      `Язык ${locale} не зарегистрирован. Проверьте реестр через locale list; добавление выполняется явно через locale add.`,
      { key: operation.key, locale }
    )
  return locale
}

/**
 * Обновляет один перевод, сохраняя соседние языки и вложенные объекты.
 */
function withTranslation(entry: DatabaseEntry, locale: string, text: Translation | undefined): DatabaseEntry {
  if (!('translations' in entry.value))
    throw new DatabaseError(
      'INVALID_INPUT',
      `У карточки ${entry.key} нет переводов. Укажите адрес технической редакции.`,
      { key: entry.key }
    )
  return parseEntry({
    ...address(entry.key),
    value: {
      ...entry.value,
      translations: [...translations(entry).filter((previous) => previous.locale !== locale), ...(text ? [text] : [])]
    }
  })
}

/**
 * Очищает значение согласно схеме; null, пустой текст и пустой список различаются.
 */
function clearedValue(schema: z.ZodType, current: unknown, field: string): unknown {
  if (schema.safeParse(null).success) return null
  if (typeof current === 'string' && schema.safeParse('').success) return ''
  if (Array.isArray(current) && schema.safeParse([]).success) return []
  throw new DatabaseError('INVALID_INPUT', `Поле ${field} нельзя очистить: обязательное значение или связь.`, { field })
}

/**
 * Применяет точечные скалярные поля и изменения списков без замены всего перевода.
 */
function updateFields(entry: DatabaseEntry, operation: EditOperation, locale: string): DatabaseEntry {
  const fieldsToChange = [
    ...Object.keys(operation.values),
    ...operation.clear,
    ...Object.keys(operation.add),
    ...Object.keys(operation.remove)
  ]
  const ownerError = fieldsToChange.length ? revisionOwnerError(entry.key, fieldsToChange) : undefined
  if (ownerError) throw ownerError
  const schema = valueSchema(entry.collection, operation.op)
  const input = schema.parse(normalizeValues(operation.values))
  const fields = OBJECT_SCHEMA.parse(input)
  const record = OBJECT_SCHEMA.parse(entry.value)
  let text = translations(entry).find((previous) => previous.locale === locale)
  const languageFields: Record<string, unknown> = {}
  for (const [field, raw] of Object.entries(fields).filter(([field]) => Object.hasOwn(operation.values, field))) {
    if (TEXT_FIELDS.includes(field)) {
      languageFields[FIELD_NAMES[field] ?? field] = raw
      continue
    }
    const name = FIELD_NAMES[field] ?? field
    record[name] =
      field in RELATIONS && typeof raw === 'string'
        ? reference(RELATIONS[field], raw)
        : ['countries', 'protocols'].includes(field)
          ? z
              .array(z.string())
              .parse(raw)
              .map((key) => reference(RELATIONS[field], key))
          : raw
  }
  for (const field of operation.clear) {
    const fieldSchema = schema.shape[field]
    if (!fieldSchema)
      throw new DatabaseError('INVALID_INPUT', `Поле ${field} недоступно для ${operation.op} ${entry.key}.`, {
        field,
        key: entry.key
      })
    if (TEXT_FIELDS.includes(field)) {
      text ??= emptyTranslation(locale)
      languageFields[FIELD_NAMES[field] ?? field] = clearedValue(
        fieldSchema,
        OBJECT_SCHEMA.parse(text)[FIELD_NAMES[field] ?? field],
        field
      )
    } else record[FIELD_NAMES[field] ?? field] = clearedValue(fieldSchema, record[FIELD_NAMES[field] ?? field], field)
  }
  for (const [changes, shouldAdd] of [
    [operation.add, true],
    [operation.remove, false]
  ] as const) {
    for (const [field, values] of Object.entries(changes)) {
      if (!['states', 'servers', 'loginRevisions'].includes(field) || !(field in schema.shape))
        throw new DatabaseError(
          'INVALID_INPUT',
          `--add/--remove не поддерживает ${field}. Для связей используйте link/unlink, для источников — source.`,
          { key: entry.key, field }
        )
      const previous = z.array(z.unknown()).parse(record[field])
      record[field] = shouldAdd
        ? [...previous, ...values.filter((value) => !previous.includes(value))]
        : previous.filter((value) => !values.includes(value))
    }
  }
  if (Object.keys(languageFields).length) {
    text = translationSchema.parse({ ...(text ?? emptyTranslation(locale)), ...languageFields })
    record.translations = [...translations(entry).filter((previous) => previous.locale !== locale), text]
  }
  return parseEntry({ ...address(entry.key), value: record })
}

/**
 * Добавляет, удаляет и перемещает явные предметные связи с проверкой кратности.
 */
function changeRelation(entries: Map<string, DatabaseEntry>, entry: DatabaseEntry, operation: EditOperation): void {
  const relation = operation.relation ?? ''
  const ownerError = revisionOwnerError(entry.key, [relation])
  if (ownerError) throw ownerError
  const definition = relationDefinitions(entry.collection)[relation]
  if (!definition || definition.immutable)
    throw new DatabaseError(
      'INVALID_INPUT',
      `Отношение ${relation} у ${entry.key} отсутствует либо является неизменяемым владельцем.`,
      { key: entry.key, field: relation }
    )
  const options = operation.options
  if (entry.collection === 'releases' && relation === 'protocols' && operation.op === 'link' && !options.unscoped)
    throw new DatabaseError(
      'USAGE',
      'Прямой протокол релиза требует --unscoped; для региональной применимости укажите release-context:….'
    )
  const targets = operation.targets.map((key) => reference(RELATIONS[relation], key))
  if (new Set(targets).size !== targets.length) throw new DatabaseError('USAGE', 'Цели связи не должны повторяться.')
  if ((!targets.length && !(operation.op === 'unlink' && options.all)) || (targets.length && options.all))
    throw new DatabaseError('USAGE', 'Укажите цели связи либо unlink --all, но не оба варианта.')
  const field = FIELD_NAMES[relation]
  const record = OBJECT_SCHEMA.parse(entry.value)
  if (!definition.multiple) {
    if (options.before || options.after)
      throw new DatabaseError('USAGE', 'Позиция поддерживается только у упорядоченной множественной связи.')
    if (targets.length > 1) throw new DatabaseError('USAGE', `Связь ${relation} допускает только одну цель.`)
    if (operation.op === 'unlink') {
      if (definition.required)
        throw new DatabaseError('INVALID_INPUT', `Обязательную связь ${relation} нельзя разорвать.`)
      if (options.all || targets.includes(z.string().nullable().parse(record[field]) ?? '')) record[field] = null
    } else {
      if (record[field] !== null && record[field] !== targets[0] && !options.replace)
        throw new DatabaseError(
          'CONFLICT',
          `Связь ${relation} уже ведёт к ${record[field]}. Для замены укажите --replace.`
        )
      record[field] = targets[0]
    }
  } else {
    if (options.before && options.after) throw new DatabaseError('USAGE', 'Выберите --before либо --after.')
    let keys = z.array(z.string()).parse(record[field])
    if (operation.op === 'unlink') keys = options.all ? [] : keys.filter((key) => !targets.includes(key))
    else {
      if (entry.kind === 'implementation' && relation === 'protocols') {
        for (const other of entries.values()) {
          if (other.key === entry.key || other.kind !== 'implementation' || ownerKey(other.key) !== ownerKey(entry.key))
            continue
          const conflicts = other.value.protocolKeys.filter((key) => targets.includes(key))
          if (!conflicts.length) continue
          if (!options.replace)
            throw new DatabaseError(
              'CONFLICT',
              `Протоколы ${conflicts.join(', ')} уже используют ${other.key}. Для переноса применимости укажите --replace.`
            )
          entries.set(
            other.key,
            parseEntry({
              ...address(other.key),
              value: {
                ...other.value,
                protocolKeys: other.value.protocolKeys.filter((key) => !conflicts.includes(key))
              }
            })
          )
        }
      }
      if (options.before || options.after) {
        const anchor = reference(RELATIONS[relation], options.before ?? options.after ?? '')
        if (!keys.includes(anchor) || targets.includes(anchor))
          throw new DatabaseError(
            'INVALID_INPUT',
            'Позиция должна указывать существующую связь, не входящую в перемещаемый набор.'
          )
        keys = keys.filter((key) => !targets.includes(key))
        const position = keys.indexOf(anchor) + (options.after ? 1 : 0)
        keys.splice(position, 0, ...targets)
      } else keys = [...keys, ...targets.filter((key) => !keys.includes(key))]
    }
    record[field] = keys
  }
  entries.set(entry.key, parseEntry({ ...address(entry.key), value: record }))
}

/**
 * Изменяет источники одного перевода по точному ID, URL либо хосту.
 */
function editSources(text: Translation, operation: EditOperation): Translation {
  const options = operation.options
  const sourceInput = sourceSchema.omit({ id: true })
  if (operation.op === 'source.add')
    return { ...text, source: [...text.source, { ...sourceInput.parse(operation.values), id: randomUUID() }] }
  if (operation.op === 'source.clear') return { ...text, source: [] }
  if ([options.id, options.matchUrl, options.matchHost].filter((value) => value !== undefined).length !== 1)
    throw new DatabaseError('USAGE', 'Выберите ровно один критерий: --id, --match-url либо --match-host.')
  if (operation.op === 'source.update' && options.matchHost)
    throw new DatabaseError('USAGE', 'Обновление источника поддерживает только --id либо --match-url.')
  const matches = text.source.filter((source) =>
    options.id
      ? source.id === options.id
      : options.matchUrl
        ? source.url === options.matchUrl
        : new URL(source.url).hostname === options.matchHost
  )
  if (matches.length > 1 && !(operation.op === 'source.remove' && options.allMatches))
    throw new DatabaseError(
      'CONFLICT',
      'Совпало несколько источников. Укажите точный --id либо для удаления --all-matches.',
      { key: operation.key, locale: text.locale, matches }
    )
  if (operation.op === 'source.remove')
    return { ...text, source: text.source.filter((source) => !matches.includes(source)) }
  if (!matches.length)
    throw new DatabaseError('NOT_FOUND', 'Источник по указанному критерию не найден.', {
      key: operation.key,
      locale: text.locale
    })
  const patch = sourceInput.partial().parse(operation.values)
  if (operation.clear.some((field) => field !== 'summary'))
    throw new DatabaseError('USAGE', 'У источника можно очистить только необязательное поле summary.')
  return {
    ...text,
    source: text.source.map((source) => {
      if (!matches.includes(source)) return source
      const updated = { ...source, ...patch }
      if (operation.clear.includes('summary')) delete updated.summary
      return sourceSchema.parse(updated)
    })
  }
}

/**
 * Применяет вложенную операцию, не затрагивая соседние переводы или сведения.
 */
function editNested(entry: DatabaseEntry, operation: EditOperation, locale: string): DatabaseEntry {
  if (operation.op === 'translation.delete') return withTranslation(entry, locale, undefined)
  const locales = operation.options.allLocales ? translations(entry).map((text) => text.locale) : [locale]
  if (operation.op === 'source.remove' && operation.options.allLocales && !operation.options.allMatches) {
    const matches = translations(entry).flatMap((text) =>
      text.source
        .filter((source) =>
          operation.options.id
            ? source.id === operation.options.id
            : operation.options.matchUrl
              ? source.url === operation.options.matchUrl
              : new URL(source.url).hostname === operation.options.matchHost
        )
        .map((source) => ({ locale: text.locale, id: source.id, url: source.url }))
    )
    if (matches.length > 1)
      throw new DatabaseError(
        'CONFLICT',
        'Совпало несколько источников в разных языках. Укажите --id либо --all-matches.',
        { key: entry.key, matches }
      )
  }
  if (operation.op.endsWith('.clear') && !operation.options.allLocales && !operation.locale)
    throw new DatabaseError('USAGE', 'Для clear явно укажите --locale либо --all-locales.')
  let updated = entry
  for (const language of locales) {
    const previous = translations(updated).find((text) => text.locale === language)
    if (!previous && (operation.op.endsWith('.clear') || operation.op.endsWith('.remove'))) continue
    let text = previous ?? emptyTranslation(language)
    if (operation.op.startsWith('source.')) text = editSources(text, operation)
    if (operation.op.startsWith('question.')) {
      if (operation.op === 'question.clear') text = { ...text, openQuestions: [] }
      else {
        const question = z
          .strictObject({ text: z.string().refine((value) => value.trim().length > 0) })
          .parse(operation.values).text
        text = {
          ...text,
          openQuestions:
            operation.op === 'question.add'
              ? [...text.openQuestions, ...(!text.openQuestions.includes(question) ? [question] : [])]
              : text.openQuestions.filter((value) => value !== question)
        }
      }
    }
    updated = withTranslation(updated, language, text)
  }
  return updated
}

/**
 * Выполняет одну операцию частного плана; проверка предметных ссылок отложена до конца пакета.
 */
function applyEdit(
  entries: Map<string, DatabaseEntry>,
  operation: EditOperation,
  snapshot: DatabaseSnapshot,
  skipped: string[]
): void {
  const locale = editLocale(operation, snapshot)
  validateOperationOptions(operation.op, { ...operation.options, locale: operation.locale })
  for (const field of operation.clear) {
    if (
      Object.hasOwn(operation.values, field) ||
      Object.hasOwn(operation.add, field) ||
      Object.hasOwn(operation.remove, field)
    ) {
      throw new DatabaseError('USAGE', `Очистка ${field} конфликтует с записью этого поля.`, { field })
    }
  }
  if (
    !['create', 'update', 'translation.set'].includes(operation.op) &&
    (Object.keys(operation.add).length || Object.keys(operation.remove).length)
  ) {
    throw new DatabaseError('INVALID_INPUT', `${operation.op} не поддерживает add/remove скалярных списков.`)
  }
  if (
    ['delete', 'translation.delete', 'link', 'unlink', 'source.remove', 'source.clear', 'question.clear'].includes(
      operation.op
    ) &&
    (Object.keys(operation.values).length || operation.clear.length)
  ) {
    throw new DatabaseError(
      'INVALID_INPUT',
      `${operation.op} не принимает изменяемые values или clear. Используйте предметные параметры операции.`
    )
  }
  if (operation.op === 'create') {
    if (entries.has(operation.key)) {
      if (operation.options.ifExists === 'skip') {
        skipped.push(operation.key)
        return
      }
      throw new DatabaseError(
        'ALREADY_EXISTS',
        `${operation.key} уже существует. Для явного пропуска используйте --if-exists skip.`
      )
    }
    const target = address(operation.key)
    const shape = valueSchema(target.collection, 'create')
    const input = OBJECT_SCHEMA.parse(shape.parse(normalizeValues(operation.values)))
    if (
      target.collection === 'releases' &&
      Array.isArray(input.protocols) &&
      input.protocols.length &&
      !operation.options.unscoped
    ) {
      throw new DatabaseError(
        'USAGE',
        'Прямые протоколы релиза требуют явного unscoped; региональные связи задаются у release-context.'
      )
    }
    const base: Record<string, unknown> = { ...identity(operation.key) }
    for (const [field, value] of Object.entries(input)) {
      if (TEXT_FIELDS.includes(field)) continue
      base[FIELD_NAMES[field] ?? field] =
        field in RELATIONS && typeof value === 'string'
          ? reference(RELATIONS[field], value)
          : ['protocols', 'countries'].includes(field)
            ? z
                .array(z.string())
                .parse(value)
                .map((key) => reference(RELATIONS[field], key))
            : value
    }
    if (TEXT_FIELDS.some((field) => Object.hasOwn(input, field)))
      base.translations = [
        translationSchema.parse({
          ...emptyTranslation(locale),
          ...Object.fromEntries(
            Object.entries(input)
              .filter(([field]) => TEXT_FIELDS.includes(field))
              .map(([field, value]) => [FIELD_NAMES[field] ?? field, value])
          )
        })
      ]
    const created = parseEntry({ ...target, value: base })
    entries.set(operation.key, updateFields(created, { ...operation, op: 'update', values: {}, clear: [] }, locale))
    return
  }
  const entry = requireEntry(entries, operation.key)
  if (
    ['translation.', 'source.', 'question.'].some((prefix) => operation.op.startsWith(prefix)) &&
    !('translations' in entry.value)
  ) {
    throw revisionOwnerError(entry.key) ?? new DatabaseError('INVALID_INPUT', `У ${entry.key} нет переводов.`)
  }
  if (operation.op === 'update' || operation.op === 'translation.set') {
    entries.set(entry.key, updateFields(entry, operation, locale))
    return
  }
  if (operation.op === 'replace') {
    entries.set(entry.key, replaceRecord(entry, operation.values))
    return
  }
  if (operation.op === 'delete') {
    const owned = [...entries.values()].filter(
      (candidate) => candidate.kind === 'implementation' && ownerKey(candidate.key) === entry.key
    )
    if (owned.length && !operation.options.cascadeOwned)
      throw new DatabaseError('CONFLICT', `У ${entry.key} есть редакции. Для их удаления нужен --cascade-owned.`, {
        key: entry.key,
        owned: owned.map((candidate) => candidate.key)
      })
    for (const candidate of owned) entries.delete(candidate.key)
    entries.delete(entry.key)
    return
  }
  if (operation.op === 'link' || operation.op === 'unlink') {
    changeRelation(entries, entry, operation)
    return
  }
  entries.set(entry.key, editNested(entry, operation, locale))
}

/**
 * Возвращает исходящие ссылки Markdown, не разбирая аннотации источников как Markdown.
 */
export function markdownLinks(snapshot: DatabaseSnapshot): MarkdownLink[] {
  return snapshot.entries.flatMap((entry) =>
    availableFields(entry.collection)
      .filter((field) => textFieldDefinition(field).format === 'markdown')
      .flatMap((field) => {
        const documents =
          textFieldDefinition(field).scope === 'translation'
            ? translations(entry).map((text) => ({ locale: text.locale, fields: OBJECT_SCHEMA.parse(text) }))
            : [{ locale: undefined, fields: publicRecord(entry) }]
        return documents.flatMap(({ locale, fields }) => {
          try {
            return referenceMarkdownDirectives(z.string().parse(fields[field])).map((directive) => ({
              key: entry.key,
              locale,
              field,
              target: `${directive.kind}:${directive.id}`
            }))
          } catch (error) {
            throw new DatabaseError(
              'VALIDATION_ERROR',
              `Неверная директива Markdown в ${entry.key}, ${locale ?? 'общая запись'}, ${field}: ${error instanceof Error ? error.message : 'ошибка синтаксиса'}`,
              { key: entry.key, locale, field }
            )
          }
        })
      })
  )
}

/**
 * Упоминание адреса в поле, объявленном схемой как Markdown.
 */
type MarkdownLink = {
  /** Адрес документа-владельца. */
  key: string
  /** Язык, если поле принадлежит переводу. */
  locale?: string
  /** Публичное имя поля. */
  field: string
  /** Адрес цели директивы. */
  target: string
}

/**
 * Проверяет ссылки с указанием поля, владельца и точного отсутствующего адреса.
 */
export function checkReferences(snapshot: DatabaseSnapshot): void {
  const entries = entryMap(snapshot)
  for (const entry of snapshot.entries) {
    const record = publicRecord(entry)
    for (const [field, definition] of Object.entries(relationDefinitions(entry.collection))) {
      const targets = definition.multiple
        ? z.array(z.string()).parse(record[field])
        : typeof record[field] === 'string'
          ? [z.string().parse(record[field])]
          : []
      for (const target of targets)
        if (!entries.has(target))
          throw new DatabaseError(
            'VALIDATION_ERROR',
            `Поле ${field} записи ${entry.key} ссылается на отсутствующую запись ${target}.`,
            { key: entry.key, field, value: target }
          )
    }
    if (entry.kind === 'implementation' && !entries.has(ownerKey(entry.key)))
      throw new DatabaseError(
        'VALIDATION_ERROR',
        `У редакции ${entry.key} отсутствует владелец ${ownerKey(entry.key)}.`,
        { key: entry.key, field: 'owner', value: ownerKey(entry.key) }
      )
  }
}

/**
 * Выделяет только буквальное Markdown-поле для проверки изменений, не затрагивая заголовки и источники.
 */
function markdownContent(entry: DatabaseEntry | undefined, field: string): unknown {
  if (!entry) return undefined
  return textFieldDefinition(field).scope === 'translation'
    ? translations(entry).map((text) => [text.locale, OBJECT_SCHEMA.parse(text)[field]])
    : publicRecord(entry)[field]
}

/**
 * Строит один полностью проверенный план для dry-run и атомарной записи.
 */
export function planEdits(before: DatabaseSnapshot, operations: EditOperation[]): EditPlan {
  const entries = entryMap(before)
  const skipped: string[] = []
  const originals = entryMap(before)
  for (const [index, operation] of operations.entries()) {
    try {
      applyEdit(entries, operation, before, skipped)
    } catch (error) {
      const failure = error instanceof z.ZodError ? invalidFieldsError(operation, error) : error
      if (failure instanceof DatabaseError)
        throw new DatabaseError(
          failure.code,
          `Операция ${index + 1} (${operation.op} ${operation.key}): ${failure.message}`,
          {
            ...OBJECT_SCHEMA.parse(failure.details ?? {}),
            operationIndex: index,
            operation: operation.op,
            key: operation.key,
            locale: operation.locale
          },
          failure
        )
      throw error
    }
  }
  const candidate = { ...before, entries: [...entries.values()] }
  checkReferences(candidate)
  const snapshot = validateSnapshot(candidate)
  const noops = [...new Set(operations.map((operation) => operation.key))].filter(
    (key) =>
      !skipped.includes(key) && JSON.stringify(originals.get(key)?.value) === JSON.stringify(entries.get(key)?.value)
  )
  const deleted = new Set(before.entries.filter((entry) => !entries.has(entry.key)).map((entry) => entry.key))
  const checkedEntries = deleted.size
    ? snapshot.entries
    : snapshot.entries.filter((entry) => {
        const previous = originals.get(entry.key)
        return availableFields(entry.collection)
          .filter((field) => textFieldDefinition(field).format === 'markdown')
          .some((field) => {
            return JSON.stringify(markdownContent(entry, field)) !== JSON.stringify(markdownContent(previous, field))
          })
      })
  const warnings = markdownLinks({ ...snapshot, entries: checkedEntries }).filter((link) => !entries.has(link.target))
  const broken = warnings.filter((link) => deleted.has(link.target))
  if (
    broken.length &&
    !operations
      .filter((operation) => operation.op === 'delete')
      .every((operation) => operation.options.allowBrokenLinks)
  )
    throw new DatabaseError(
      'CONFLICT',
      'Удаление оставляет неразрешённые Markdown-ссылки. Исправьте их либо явно передайте --allow-broken-links.',
      { links: broken }
    )
  return { snapshot, skipped, warnings, noops }
}
