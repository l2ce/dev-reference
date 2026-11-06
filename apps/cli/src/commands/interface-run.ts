import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, open, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import * as z from 'zod'
import {
  DatabaseError,
  collectionSchema,
  databaseStatus,
  defaultDatabasePath,
  defaultDataDirectory,
  exportDatabase,
  importDatabase,
  localeSchema,
  openDatabase,
  parseEntry,
  restoreDatabase,
  snapshotRevision,
  validateSnapshot
} from '@l2ce/database'
import type { DatabaseSnapshot } from '@l2ce/database'
import { changesText, displayValue, pageText, projectedChanges, snapshotChanges } from '../output/interface-text.js'
import {
  address,
  entryMap,
  identity,
  ownerKey,
  publicRecord,
  reference,
  requireEntry,
  translations,
  TYPES
} from './model.js'
import { checkStdin, prepareEdit, prepareEdits } from './edit-input.js'
import { checkReferences, markdownLinks, planEdits, validateOperationOptions } from './edit-plan.js'
import { availableFields, relationDefinitions, textFieldDefinition } from './definition.js'
import { describeSchema, operationFields } from '../help/schema.js'
import { cliCommand, databaseArguments } from './invocation.js'
import { revisionOwnerError } from './diagnostics.js'
import { filterEntries, paginate, readItem, requestedKeys, saveSelection, selectedEntry } from './query.js'
import type { EditOperation, InterfaceOptions, InterfaceResult, ReadItem } from './interface.types.js'

/**
 * Узел дерева классификации с копируемым полным адресом.
 */
type TreeNode = {
  /** Адрес предметной записи. */
  key: string
  /** Явно связанные дочерние записи в пределах глубины запроса. */
  children: TreeNode[]
}

/**
 * Строит копируемую команду продолжения, не зависящую от уже прочитанного stdin.
 */
function continuationCommand(
  operation: string,
  keys: string[],
  query: string | undefined,
  options: InterfaceOptions,
  cursor: string | undefined,
  limit: number
): string {
  const args = [
    operation,
    ...(operation === 'read'
      ? options.selection
        ? ['--selection', options.selection]
        : keys
      : query === undefined || query.startsWith('-')
        ? []
        : [query])
  ]
  for (const field of [
    'database',
    'locale',
    'view',
    'fields',
    'type',
    'protocol',
    'branch',
    'saga',
    'chronicle',
    'release',
    'region',
    'country',
    'server',
    'direction',
    'status',
    'translationStatus',
    'sourceUrl',
    'sourceHost',
    'searchIn',
    'match',
    'sort'
  ] as const) {
    if (field === 'match' && operation !== 'find') continue
    if (field === 'locale' && (options.view === 'edit' || options.allLocales)) continue
    if (options[field] !== undefined)
      args.push(`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, String(options[field]))
  }
  for (const field of ['has', 'missing'] as const) for (const value of options[field]) args.push(`--${field}`, value)
  if (options.allLocales) args.push('--all-locales')
  if (options.allowMissing) args.push('--allow-missing')
  if (options.withVersion) args.push('--with-version')
  if (options.format === 'json') args.push('--format', 'json')
  args.push('--limit', String(limit))
  if (cursor) args.push('--after', cursor)
  if (operation === 'find' && query?.startsWith('-')) args.push('--', query)
  return cliCommand(args)
}

/**
 * Проверяет взаимоисключающие режимы до обращения к SQLite или stdin.
 */
function checkReadOptions(operation: string, options: InterfaceOptions): void {
  if (options.locale && options.allLocales)
    throw new DatabaseError('USAGE', '--locale и --all-locales задают взаимоисключающие области.')
  if (options.view === 'edit' && options.locale)
    throw new DatabaseError('USAGE', 'Представление edit всегда содержит все переводы; --locale недопустим.')
  if (
    options.content &&
    (options.view ||
      options.fields ||
      options.allLocales ||
      options.limit !== undefined ||
      options.after ||
      options.offset !== undefined)
  )
    throw new DatabaseError('USAGE', '--content несовместим с --view, --fields, --all-locales и пагинацией.')
  if (options.content && operation !== 'read')
    throw new DatabaseError('USAGE', '--content поддерживается только у read одной записи.')
  if (options.all && (options.limit !== undefined || options.offset !== undefined || options.after))
    throw new DatabaseError('USAGE', '--all несовместим с пагинацией.')
}

/**
 * Предлагает безопасное уточнение недоступной записи без выбора другого языка или редакции.
 */
function unavailableReadSteps(item: ReadItem, options: InterfaceOptions): string[] {
  const context = databaseArguments(options)
  const format = options.format === 'json' ? ['--format', 'json'] : []
  if (item.availability === 'unmapped') return [cliCommand([...context, 'revision', 'list', item.key, ...format])]
  if (item.availability === 'translation-missing')
    return [cliCommand([...context, 'translation', 'list', item.revisionKey ?? item.key, ...format])]
  if (item.availability === 'not-found')
    return [
      cliCommand([
        ...context,
        'list',
        '--type',
        item.type,
        ...(options.allLocales ? ['--all-locales'] : options.locale ? ['--locale', options.locale] : []),
        ...format
      ])
    ]
  return []
}

/**
 * Выполняет согласованное чтение с явным состоянием каждого элемента и фиксированными редакциями.
 */
async function readRecords(
  operation: string,
  operands: string[],
  snapshot: DatabaseSnapshot,
  rawOptions: InterfaceOptions,
  version: string,
  prepared?: Awaited<ReturnType<typeof requestedKeys>>
): Promise<InterfaceResult> {
  checkReadOptions(operation, rawOptions)
  const options = {
    ...rawOptions,
    locale: rawOptions.locale ?? snapshot.defaultLocale,
    view: rawOptions.view ?? (operation === 'read' ? 'full' : 'brief')
  }
  const query = operation === 'find' ? operands[0] : undefined
  const requested = operation === 'read' ? (prepared ?? (await requestedKeys(operands, options))) : undefined
  const filtered = operation !== 'read' ? filterEntries(snapshot, options, query) : undefined
  const keys = requested?.keys ?? filtered?.entries.map((entry) => entry.key) ?? []
  if (
    options.protocol &&
    !snapshot.entries.some((entry) => entry.key === reference('protocol', options.protocol ?? ''))
  )
    throw new DatabaseError('NOT_FOUND', `Протокол ${options.protocol} не найден.`)
  const signatureKeys = requested?.selection
    ? requested.selection.items.map((item) => `${item.key}=${item.revisionKey ?? ''}`)
    : keys
  const page = paginate(keys, operation, signatureKeys, options, version, query)
  const items = page.items.map((key) => {
    const pin = requested?.selection?.items.find((item) => item.key === key)?.revisionKey
    const item = readItem(key, snapshot, options, pin)
    const matches = filtered?.matches.get(key)
    return {
      ...item,
      ...(matches ? { matches } : {}),
      ...(item.availability !== 'available' ? { nextSteps: unavailableReadSteps(item, options) } : {})
    }
  })
  const warnings: string[] = []
  if (requested?.selection && requested.selection.version !== version)
    warnings.push(
      `Выборка создана на версии ${requested.selection.version}; текущее чтение: ${version}. Адреса и редакции сохранены.`
    )
  if (requested?.selection)
    for (const item of items) {
      if (!item.revisionKey || !options.protocol) continue
      const entry = snapshot.entries.find((candidate) => candidate.key === item.revisionKey)
      if (
        entry?.kind === 'implementation' &&
        !entry.value.protocolKeys.includes(reference('protocol', options.protocol))
      )
        warnings.push(
          `Изменилась применимость: ${item.revisionKey} больше не назначена ${reference('protocol', options.protocol)}. Прочитана зафиксированная редакция.`
        )
    }
  if (options.content) {
    if (keys.length !== 1) throw new DatabaseError('USAGE', '--content требует ровно одну запись.')
    const field = options.content
    const requestedEntry = snapshot.entries.find((candidate) => candidate.key === keys[0])
    const isOwnField =
      requestedEntry &&
      textFieldDefinition(field).scope === 'record' &&
      availableFields(requestedEntry.collection).includes(field)
    const entry = isOwnField
      ? requestedEntry
      : snapshot.entries.find((candidate) => candidate.key === (items[0]?.revisionKey ?? keys[0]))
    const item = items[0]
    if (!entry || !item || (!isOwnField && item.availability !== 'available'))
      throw new DatabaseError('NOT_FOUND', `Содержимое ${keys[0]} недоступно: ${item?.availability ?? 'not-found'}.`, {
        key: keys[0],
        locale: options.locale,
        availability: item?.availability,
        nextSteps: item?.nextSteps
      })
    if (!textFieldDefinition(field).content || !availableFields(entry.collection).includes(field))
      throw new DatabaseError(
        'INVALID_QUERY',
        `Поле ${field} не является доступным текстовым полем ${entry.collection}.`
      )
    const text = translations(entry).find((translation) => translation.locale === options.locale)
    const content = z
      .string()
      .parse(
        textFieldDefinition(field).scope === 'record'
          ? publicRecord(entry)[field]
          : text
            ? z.record(z.string(), z.unknown()).parse(text)[field]
            : undefined
      )
    return {
      data: { key: keys[0], locale: options.locale, field, content },
      meta: { version },
      text: content,
      diagnostics: options.withVersion ? `Версия: ${version}\n` : undefined
    }
  }
  const itemsComplete = items.every((item) => item.availability === 'available')
  if (operation === 'read' && keys.length === 1 && !itemsComplete && !options.allowMissing)
    throw new DatabaseError(
      'NOT_FOUND',
      `Не удалось прочитать ${keys[0]}: ${items[0]?.availability === 'translation-missing' ? `перевод ${options.locale} отсутствует; другой язык не подставлен` : items[0]?.availability === 'unmapped' ? `нет редакции, применимой к протоколу ${options.protocol}; другая редакция не выбрана` : 'запись не найдена'}.`,
      {
        key: keys[0],
        locale: options.locale,
        availability: items[0]?.availability,
        nextSteps: items[0]?.nextSteps
      }
    )
  const continuation = page.continuation
    ? continuationCommand(operation, keys, query, options, page.continuation, options.limit ?? 20)
    : null
  const meta = {
    operation,
    scope: filtered?.types ?? keys,
    view: options.view,
    locale: options.view === 'edit' || options.allLocales ? null : options.locale,
    allLocales: options.view === 'edit' || options.allLocales,
    protocol: options.protocol ? reference('protocol', options.protocol) : null,
    version,
    page: page.page,
    itemsComplete,
    continuation,
    warnings,
    ...(options.view === 'edit' && !options.type && operation !== 'read'
      ? {
          manifest: {
            schemaVersion: snapshot.schemaVersion,
            dataVersion: snapshot.dataVersion,
            defaultLocale: snapshot.defaultLocale,
            locales: snapshot.locales
          }
        }
      : {})
  }
  let text = pageText(items, meta, options)
  if (options.withVersion) text += `Версия: ${version}\n`
  if (warnings.length) text += warnings.join('\n') + '\n'
  if (options.saveSelection) {
    await saveSelection(options.saveSelection, items, options, version)
    text += `Сохранены ${items.length} показанных записей из ${page.page.total}: ${options.saveSelection}\n`
  }
  return {
    data: { items },
    meta,
    text,
    exitCode: !itemsComplete && operation === 'read' && !options.allowMissing ? 3 : 0
  }
}

/**
 * Представляет входящие и исходящие связи отдельно от вычисленных Markdown-упоминаний.
 */
function graphRelations(
  snapshot: DatabaseSnapshot
): { from: string; to: string; relation: string; role: string; computed: boolean; locale?: string }[] {
  const edges = snapshot.entries.flatMap((entry) =>
    Object.entries(relationDefinitions(entry.collection)).flatMap(([relation, definition]) => {
      const value = publicRecord(entry)[relation]
      const targets = definition.multiple ? z.array(z.string()).parse(value) : typeof value === 'string' ? [value] : []
      return targets.map((to) => ({
        from: entry.key,
        to,
        relation,
        role:
          relation === 'protocols'
            ? 'applicability'
            : ['branch', 'saga', 'chronicle'].includes(relation)
              ? 'classification'
              : 'membership',
        computed: false
      }))
    })
  )
  for (const entry of snapshot.entries)
    if (entry.kind === 'implementation')
      edges.push({ from: entry.key, to: ownerKey(entry.key), relation: 'owner', role: 'ownership', computed: false })
  return [
    ...edges,
    ...markdownLinks(snapshot).map((link) => ({
      from: link.key,
      to: link.target,
      relation: 'mention',
      role: 'markdown',
      computed: true,
      locale: link.locale
    }))
  ]
}

/**
 * Строит дерево классификации, не превращая хронику в владельца жизненного цикла релизов.
 */
function treeResult(snapshot: DatabaseSnapshot, key: string | undefined, depth: number): TreeNode[] {
  const entries = entryMap(snapshot)
  if (key) requireEntry(entries, key)
  const edges = graphRelations(snapshot).filter((edge) =>
    ['branch', 'saga', 'chronicle', 'release', 'owner'].includes(edge.relation)
  )
  const roots = key
    ? [key]
    : snapshot.entries.filter((entry) => entry.collection === 'branches').map((entry) => entry.key)
  /**
   * Строит одну ветвь с ограничением глубины и защитой от повторного обхода.
   */
  const node = (address: string, remaining: number, seen: Set<string>): TreeNode => ({
    key: address,
    children:
      remaining > 0
        ? [
            ...new Set(edges.filter((edge) => edge.to === address && !seen.has(edge.from)).map((edge) => edge.from))
          ].map((child) => node(child, remaining - 1, new Set([...seen, child])))
        : []
  })
  return roots.map((root) => node(root, depth, new Set([root])))
}

/**
 * Представляет дерево строками, не распечатывая внутренние свойства объектов.
 */
function treeText(nodes: TreeNode[], depth = 0): string {
  return nodes.map((node) => `${'  '.repeat(depth)}${node.key}\n${treeText(node.children, depth + 1)}`).join('')
}

/**
 * Готовит полную замену импорта в изолированной базе; рабочая база не меняется до проверки.
 */
async function importSnapshot(input: string): Promise<DatabaseSnapshot> {
  const root = '/tmp/opencode'
  await mkdir(root, { recursive: true })
  const directory = await mkdtemp(join(root, 'l2ref-import-'))
  try {
    const database = join(directory, 'database.sqlite')
    await importDatabase({ database, input })
    const handle = openDatabase({ database, readOnly: true })
    try {
      return handle.snapshot()
    } finally {
      handle.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/**
 * Выполняет единый интерфейс; каждое изменение фиксирует тот же проверенный план, что показывает dry-run.
 */
export async function runInterface(
  operation: string,
  operands: string[],
  options: InterfaceOptions
): Promise<InterfaceResult> {
  checkStdin(options)
  validateOperationOptions(operation, options)
  if (options.locale && options.allLocales) throw new DatabaseError('USAGE', '--locale несовместим с --all-locales.')
  const path = options.database ?? defaultDatabasePath
  if (operation === 'schema') {
    const type = operands[1]
      ? address(operands[1]).collection
      : options.type
        ? collectionSchema.parse(options.type)
        : undefined
    const schema = describeSchema(operands[0], type, operands[2], options.brief)
    return { ...schema, meta: {} }
  }
  if (operation === 'types') {
    const types = Object.entries(TYPES).map(([type, [prefix, title]]) => ({
      type,
      prefix,
      title,
      operations: ['read', 'list', 'find', 'create', 'update', 'delete', 'replace'],
      fields: availableFields(collectionSchema.parse(type)),
      fieldDetails: operationFields('create', collectionSchema.parse(type)),
      relations: relationDefinitions(collectionSchema.parse(type))
    }))
    return {
      data: types,
      meta: {},
      text:
        types
          .map(
            (type) =>
              `${type.type}: ${type.prefix}:… — ${type.title}; ${type.operations.join('/')}\n  Поля: ${type.fields.join(', ')}.\n  Обязательно при create: ${
                type.fieldDetails
                  .filter((field) => field.required)
                  .map((field) => field.name)
                  .join(', ') || 'нет'
              }; связи: ${
                Object.entries(type.relations)
                  .map(
                    ([name, relation]) =>
                      `${name} (${relation.immutable ? 'неизменяемый владелец' : relation.multiple ? 'множественная' : relation.required ? 'обязательная одиночная' : 'nullable одиночная'})`
                  )
                  .join(', ') || 'нет'
              }.`
          )
          .join('\n') + '\n'
    }
  }
  if (operation === 'status') {
    const status = databaseStatus({ database: path })
    if (!status.exists || status.schema !== 'current' || !status.manifest)
      return {
        data: status,
        meta: {},
        text: `База: ${status.database}\nСуществует: ${status.exists}\nСхема: ${status.schema}\n`
      }
  }
  if (operation === 'init') {
    if (options.ifVersion)
      throw new DatabaseError(
        'REVISION_CONFLICT',
        'init создаёт отсутствующую базу и не может совпасть с версией существующего снимка.'
      )
    if (existsSync(path))
      throw new DatabaseError('ALREADY_EXISTS', `Файл базы ${path} уже существует. init его не заменяет.`)
    const locales = (options.locales ?? 'ru,en').split(',').map((locale) => localeSchema.parse(locale))
    const snapshot = validateSnapshot({
      schemaVersion: 21,
      dataVersion: '1.0.0',
      locales,
      defaultLocale: options.defaultLocale ?? locales[0],
      entries: []
    })
    let savedVersion: string | null = null
    if (!options.dryRun) {
      await mkdir(dirname(path), { recursive: true })
      const reservation = await open(path, 'wx')
      await reservation.close()
      const database = openDatabase({ database: path })
      try {
        database.replaceSnapshot(snapshot)
        savedVersion = database.version()
      } finally {
        database.close()
      }
    }
    return {
      data: {
        action: 'init',
        dryRun: options.dryRun,
        database: path,
        locales,
        manifest: { ...snapshot, entries: undefined }
      },
      meta: { version: savedVersion },
      text: `${options.dryRun ? 'Будет создана' : 'Создана'} пустая база: ${path}\nЯзыки: ${locales.join(', ')}; основной: ${snapshot.defaultLocale}\n${savedVersion ? `Сохранённая версия: ${savedVersion}\n` : 'Запись не выполнена.\n'}`
    }
  }
  const isRead = [
    'read',
    'list',
    'find',
    'status',
    'stats',
    'tree',
    'relations',
    'validate',
    'locale.list',
    'translation.list',
    'revision.list',
    'source.list',
    'question.list',
    'export'
  ].includes(operation)
  if (!existsSync(path) && operation !== 'import')
    throw new DatabaseError(
      'DATABASE_NOT_FOUND',
      `База ${path} отсутствует. Выполните init либо import --input <directory> --replace.`,
      { path }
    )
  // Весь внешний текст батча читается до открытия пишущего соединения.
  const batch = operation === 'batch' ? await prepareEdits(options) : undefined
  if (batch?.some((edit) => edit.op === 'replace') && !options.ifVersion) {
    throw new DatabaseError('USAGE', 'Батч с replace требует явного --if-version.')
  }
  if (operation === 'import' && !options.replace)
    throw new DatabaseError('USAGE', 'Импорт полностью заменяет базу и требует --replace.')
  const incoming = operation === 'import' ? await importSnapshot(options.input ?? defaultDataDirectory) : undefined
  const importStatus = incoming && existsSync(path) ? databaseStatus({ database: path }) : undefined
  if (incoming && importStatus && (importStatus.schema !== 'current' || !importStatus.manifest)) {
    const restored = restoreDatabase(incoming, { database: path, ifVersion: options.ifVersion, dryRun: options.dryRun })
    return {
      data: { action: 'import', dryRun: options.dryRun, records: incoming.entries.length, schemaReplaced: true },
      meta: { version: restored.version },
      text: `Прежняя SQL-схема несовместима; её содержимое не объявляется проверенным.\n${options.dryRun ? 'Будет восстановлена' : 'Восстановлена'} текущая структура и ${incoming.entries.length} записей. ${options.dryRun ? 'Запись не выполнена.' : 'Изменения сохранены.'}\n${restored.version ? `${options.dryRun ? 'Исходная' : 'Сохранённая'} версия: ${restored.version}\n` : ''}`
    }
  }
  if (!existsSync(path) && incoming) {
    if (options.ifVersion) throw new DatabaseError('REVISION_CONFLICT', 'Нельзя применить версию к отсутствующей базе.')
    let savedVersion: string | null = null
    if (!options.dryRun) {
      const database = openDatabase({ database: path })
      try {
        database.replaceSnapshot(incoming)
        savedVersion = database.version()
      } finally {
        database.close()
      }
    }
    return {
      data: { action: 'import', dryRun: options.dryRun, records: incoming.entries.length },
      meta: { version: savedVersion },
      text: `${options.dryRun ? 'Проверен импорт без записи' : 'Импортировано'}: ${incoming.entries.length} записей.\n${savedVersion ? `Сохранённая версия: ${savedVersion}\n` : 'Запись не выполнена.\n'}`
    }
  }
  const database = openDatabase({ database: path, readOnly: isRead || options.dryRun })
  let requested: Awaited<ReturnType<typeof requestedKeys>> | undefined
  try {
    const isPagedRead = ['read', 'list', 'find'].includes(operation)
    if (isPagedRead) checkReadOptions(operation, options)
    requested = operation === 'read' ? await requestedKeys(operands, options) : undefined
    const needsDescription =
      (operation === 'find' && (!options.searchIn || options.searchIn.includes('description'))) ||
      [...options.has, ...options.missing].includes('description')
    const needsSources =
      options.sourceHost !== undefined ||
      options.sourceUrl !== undefined ||
      options.searchIn?.includes('sources.') === true ||
      [...options.has, ...options.missing].includes('sources')
    const needsQuestions =
      options.searchIn?.includes('questions') === true || [...options.has, ...options.missing].includes('questions')
    const isCompactOverview = [
      'stats',
      'translation.list',
      'revision.list',
      'source.list',
      'question.list',
      'locale.list'
    ].includes(operation)
    const projection = database.readProjection(
      isPagedRead
        ? {
            locale: options.allLocales || options.view === 'edit' ? undefined : (options.locale ?? null),
            description: needsDescription,
            sources: needsSources,
            questions: needsQuestions
          }
        : {
            description: !isCompactOverview || needsDescription,
            sources: !isCompactOverview || operation === 'stats' || operation === 'source.list' || needsSources,
            questions: !isCompactOverview || operation === 'question.list' || needsQuestions,
            locale:
              ['stats', 'source.list', 'question.list'].includes(operation) && !options.allLocales
                ? (options.locale ?? null)
                : undefined
          },
      (catalog, version) => {
        if (!isPagedRead) return []
        const normalized = {
          ...options,
          locale: options.locale ?? catalog.defaultLocale,
          view: options.view ?? (operation === 'read' ? 'full' : 'brief')
        }
        const keys =
          requested?.keys ??
          filterEntries(catalog, normalized, operation === 'find' ? operands[0] : undefined).entries.map(
            (entry) => entry.key
          )
        const signatureKeys = requested?.selection
          ? requested.selection.items.map((item) => `${item.key}=${item.revisionKey ?? ''}`)
          : keys
        const page = paginate(
          keys,
          operation,
          signatureKeys,
          normalized,
          version,
          operation === 'find' ? operands[0] : undefined
        )
        if (
          normalized.view === 'brief' &&
          !options.content &&
          !options.fields
            ?.split(',')
            .some((field) => ['description', 'sources', 'questions', 'translations'].includes(field))
        )
          return []
        const entries = entryMap(catalog)
        return page.items.flatMap((key) => {
          const entry = entries.get(key)
          const pinned = requested?.selection?.items.find((item) => item.key === key)?.revisionKey
          const selected = entry ? selectedEntry(entry, catalog, normalized) : undefined
          return [...new Set([key, ...(pinned ? [pinned] : selected ? [selected.key] : [])])]
        })
      }
    )
    const before = projection.catalog
    const version = projection.version
    if (options.locale && !before.locales.includes(options.locale))
      throw new DatabaseError('INVALID_INPUT', `Язык ${options.locale} не зарегистрирован.`, { locale: options.locale })
    if (options.ifVersion && options.ifVersion !== version)
      throw new DatabaseError(
        'REVISION_CONFLICT',
        'Версия базы изменилась. Перечитайте запись или выборку; изменения не сохранены.',
        { expectedVersion: options.ifVersion, actualVersion: version }
      )
    if (isPagedRead) return readRecords(operation, operands, before, options, version, requested)
    if (operation === 'export') {
      const exported = options.dryRun
        ? { database: path, directory: options.output ?? defaultDataDirectory, records: before.entries.length }
        : await exportDatabase({ database: path, output: options.output })
      return {
        data: { ...exported, dryRun: options.dryRun },
        meta: { version },
        text: `${options.dryRun ? 'Проверен экспорт без записи' : 'Экспорт сохранён'}: ${exported.directory}\nЗаписей: ${exported.records}\n`
      }
    }
    if (operation === 'status') {
      const status = databaseStatus({ database: path })
      let freshness = 'missing'
      let exportError: string | undefined
      if (existsSync(join(defaultDataDirectory, 'manifest.json'))) {
        try {
          const exported = await importSnapshot(defaultDataDirectory)
          freshness = snapshotRevision(exported) === snapshotRevision(before) ? 'current' : 'outdated'
        } catch (error) {
          freshness = 'invalid'
          exportError = error instanceof Error ? error.message : 'Ошибка чтения снимка'
        }
      }
      return {
        data: {
          ...status,
          revision: snapshotRevision(before),
          records: before.entries.length,
          locales: before.locales,
          defaultLocale: before.defaultLocale,
          export: { directory: defaultDataDirectory, freshness, error: exportError }
        },
        meta: { version },
        text: `База: ${path}\nСхема: current\nЗаписей: ${before.entries.length}\nЯзыки: ${before.locales.join(', ')}; основной: ${before.defaultLocale}\nЭкспорт: ${defaultDataDirectory}\nАктуальность экспорта: ${freshness}${exportError ? ` (${exportError})` : ''}\n${options.withVersion ? `Версия: ${version}\n` : ''}`
      }
    }
    if (operation === 'locale.list')
      return {
        data: { locales: before.locales, defaultLocale: before.defaultLocale },
        meta: { version },
        text:
          before.locales
            .map((locale) => `${locale}${locale === before.defaultLocale ? ' (основной)' : ''}`)
            .join('\n') + '\n'
      }
    if (operation === 'validate') {
      const requested = operands.length || options.selection ? await requestedKeys(operands, options) : undefined
      if (requested) for (const key of requested.keys) requireEntry(entryMap(before), key)
      checkReferences(before)
      validateSnapshot(before)
      const warnings =
        options.links || options.strictLinks
          ? markdownLinks(before).filter(
              (link) => !entryMap(before).has(link.target) && (!requested || requested.keys.includes(link.key))
            )
          : []
      if (options.strictLinks && warnings.length)
        throw new DatabaseError('VALIDATION_ERROR', 'Неразрешённые Markdown-ссылки.', { links: warnings })
      return {
        data: {
          valid: true,
          scope: requested?.keys ?? 'database',
          records: requested?.keys.length ?? before.entries.length,
          warnings
        },
        meta: { version },
        text: `Проверено: ${requested ? requested.keys.join(', ') + ' и необходимые зависимости' : 'вся база'}.\nНеразрешённых ссылок: ${warnings.length}\n${warnings.length ? JSON.stringify(warnings) + '\n' : ''}`
      }
    }
    if (operation === 'relations') {
      requireEntry(entryMap(before), operands[0])
      const edges = graphRelations(before).filter(
        (edge) =>
          (options.in
            ? edge.to === operands[0]
            : options.out
              ? edge.from === operands[0]
              : edge.from === operands[0] || edge.to === operands[0]) &&
          (!options.relation || edge.relation === options.relation)
      )
      return {
        data: { key: operands[0], relations: edges },
        meta: { version },
        text:
          edges
            .map(
              (edge) =>
                `${edge.from} --${edge.relation} (${edge.role}${edge.computed ? ', вычисленная' : ''})--> ${edge.to}`
            )
            .join('\n') + (edges.length ? '\n' : 'Связи отсутствуют.\n')
      }
    }
    if (operation === 'tree') {
      const tree = treeResult(before, operands[0], options.depth ?? 4)
      return { data: tree, meta: { version }, text: treeText(tree) || 'Классификация не заполнена.\n' }
    }
    if (operation === 'stats') {
      const filtered = filterEntries(before, { ...options, locale: options.locale ?? before.defaultLocale })
      const by = (options.by ?? 'type').split(',')
      if (by.some((field) => !['type', 'locale', 'status', 'region', 'sourceHost'].includes(field)))
        throw new DatabaseError('USAGE', '--by поддерживает type,locale,status,region,sourceHost.')
      const groups = new Map<string, number>()
      const sources = filtered.entries.flatMap((entry) =>
        translations(selectedEntry(entry, before, options) ?? entry)
          .filter((text) => options.allLocales || text.locale === (options.locale ?? before.defaultLocale))
          .flatMap((text) => text.source)
      )
      const sourceObjects = new Set(sources.map((source) => source.id)).size
      for (const entry of filtered.entries) {
        const selected = selectedEntry(entry, before, options) ?? entry
        const texts = translations(selected).filter(
          (text) => options.allLocales || text.locale === (options.locale ?? before.defaultLocale)
        )
        const languageGroups =
          by.includes('locale') || by.includes('sourceHost') ? (texts.length ? texts : [undefined]) : [undefined]
        const recordGroups = new Set<string>()
        for (const translation of languageGroups) {
          const dimensions = by.map((field) =>
            field === 'type'
              ? [entry.collection]
              : field === 'locale'
                ? [translation?.locale ?? null]
                : field === 'sourceHost'
                  ? [...new Set((translation?.source ?? []).map((source) => new URL(source.url).hostname))]
                  : [publicRecord(selected)[field] ?? null]
          )
          let rows: unknown[][] = [[]]
          for (const dimension of dimensions) rows = rows.flatMap((row) => dimension.map((value) => [...row, value]))
          for (const row of rows) recordGroups.add(JSON.stringify(row))
        }
        for (const key of recordGroups) groups.set(key, (groups.get(key) ?? 0) + 1)
      }
      const counts = [...groups].map(([group, count]) => ({ group: JSON.parse(group), count }))
      return {
        data: {
          by,
          groups: counts,
          records: filtered.entries.length,
          sourceObjects,
          uniqueSourceUrls: new Set(sources.map((source) => source.url)).size
        },
        meta: { version, scope: filtered.types },
        text:
          counts.map((row) => `${displayValue(row.group)}: ${row.count}`).join('\n') +
          `\nЗаписей: ${filtered.entries.length}; источников: ${sourceObjects}; уникальных URL: ${new Set(sources.map((source) => source.url)).size}\n`
      }
    }
    if (operation.endsWith('.list')) {
      const entry = requireEntry(entryMap(before), operands[0])
      if (operation === 'revision.list' && !['packets', 'scenarios', 'articles'].includes(entry.collection))
        throw new DatabaseError(
          'USAGE',
          'revision list требует адрес карточки packet:, scenario: либо article: без :rev-N.'
        )
      if (operation !== 'revision.list' && !('translations' in entry.value))
        throw revisionOwnerError(entry.key) ?? new DatabaseError('INVALID_INPUT', `У ${entry.key} нет перевода.`)
      const texts = translations(entry).filter(
        (text) => options.allLocales || text.locale === (options.locale ?? before.defaultLocale)
      )
      const data =
        operation === 'revision.list'
          ? before.entries
              .filter((candidate) => candidate.kind === 'implementation' && ownerKey(candidate.key) === entry.key)
              .map((candidate) => ({
                key: candidate.key,
                rev: 'rev' in candidate.value ? candidate.value.rev : null,
                status: 'status' in candidate.value ? candidate.value.status : null,
                protocols: 'protocolKeys' in candidate.value ? candidate.value.protocolKeys : [],
                locales: translations(candidate).map((text) => text.locale)
              }))
          : operation === 'translation.list'
            ? translations(entry).map((text) => ({
                locale: text.locale,
                title: text.title,
                translationStatus: text.translationStatus
              }))
            : texts.map((text) => ({
                key: entry.key,
                locale: text.locale,
                [operation === 'source.list' ? 'sources' : 'questions']:
                  operation === 'source.list' ? text.source : text.openQuestions
              }))
      const text =
        operation === 'revision.list'
          ? before.entries
              .filter((candidate) => candidate.kind === 'implementation' && ownerKey(candidate.key) === entry.key)
              .map(
                (candidate) =>
                  `${candidate.key} · полнота описания: ${'status' in candidate.value ? candidate.value.status : '-'} · протоколы: ${'protocolKeys' in candidate.value ? candidate.value.protocolKeys.join(', ') || 'пустой список []' : '-'}\n`
              )
              .join('')
          : operation === 'translation.list'
            ? translations(entry)
                .map(
                  (translation) =>
                    `${entry.key} · ${translation.locale} · ${translation.translationStatus} · ${translation.title || 'заголовок не заполнен'}\n`
                )
                .join('')
            : texts
                .map(
                  (translation) =>
                    `${entry.key} · язык: ${translation.locale}\n${operation === 'source.list' ? translation.source.map((source) => `  ${source.id} · ${source.url}\n${source.title}\n${source.summary ? source.summary + '\n' : ''}`).join('') || 'Источники отсутствуют.\n' : translation.openQuestions.map((question) => `----- QUESTION BEGIN -----\n${question}\n----- QUESTION END -----\n`).join('') || 'Открытые вопросы отсутствуют.\n'}`
                )
                .join('')
      return { data, meta: { version }, text: text || 'Нет записей.\n' }
    }
    let after = incoming ?? before
    let skipped: string[] = []
    let noops: string[] = []
    let warnings: unknown[] = []
    if (operation.startsWith('locale.')) {
      const locale = localeSchema.parse(operands[0])
      if (operation === 'locale.add')
        after = { ...before, locales: before.locales.includes(locale) ? before.locales : [...before.locales, locale] }
      if (operation === 'locale.set-default') after = { ...before, defaultLocale: locale }
      if (operation === 'locale.set-default' && !before.locales.includes(locale))
        throw new DatabaseError(
          'INVALID_INPUT',
          `Язык ${locale} не зарегистрирован. Проверьте locale list; добавление выполняется явно через locale add.`,
          { locale }
        )
      if (operation === 'locale.delete') {
        const used = before.entries
          .filter((entry) => translations(entry).some((text) => text.locale === locale))
          .map((entry) => entry.key)
        if (locale === before.defaultLocale || used.length)
          throw new DatabaseError(
            'CONFLICT',
            'Нельзя удалить основной либо используемый язык. Сначала смените основной язык и отдельно удалите переводы.',
            { locale, owners: used }
          )
        after = { ...before, locales: before.locales.filter((code) => code !== locale) }
      }
      after = validateSnapshot(after)
    } else if (!incoming) {
      let keys = operands
      if (['update', 'delete', 'source.remove', 'source.clear'].includes(operation) && options.selection) {
        const selection = await requestedKeys(operands, options)
        if (selection.selection?.version !== version)
          throw new DatabaseError(
            'REVISION_CONFLICT',
            'Выборка устарела. Повторите исходное чтение и сохраните новую выборку.'
          )
        keys = selection.selection.items.map((item) => item.revisionKey ?? item.key)
      }
      let operations: EditOperation[]
      if (batch) operations = batch
      else if (operation === 'link' || operation === 'unlink')
        operations = [await prepareEdit(operation, operands[0], options, operands.slice(2), operands[1])]
      else if (operation === 'revision.add') {
        const card = requireEntry(entryMap(before), operands[0])
        if (!['packets', 'scenarios', 'articles'].includes(card.collection))
          throw new DatabaseError('USAGE', 'revision add требует адрес карточки знания.')
        const rev =
          options.rev ??
          Math.max(
            0,
            ...before.entries
              .filter((entry) => entry.kind === 'implementation' && ownerKey(entry.key) === card.key)
              .map((entry) => ('rev' in entry.value ? entry.value.rev : 0))
          ) + 1
        const key = `${card.key}:rev-${rev}`
        const operation = await prepareEdit('create', key, options)
        if (options.from) {
          const original = requireEntry(entryMap(before), options.from)
          if (original.kind !== 'implementation' || original.collection !== address(key).collection)
            throw new DatabaseError('USAGE', '--from требует редакцию того же типа.')
          if (entryMap(before).has(key)) throw new DatabaseError('ALREADY_EXISTS', `${key} уже существует.`)
          const copied = parseEntry({
            ...address(key),
            value: {
              ...original.value,
              ...identity(key),
              protocolKeys: [],
              translations: translations(original).map((text) => ({
                ...text,
                source: text.source.map((source) => ({ ...source, id: randomUUID() }))
              }))
            }
          })
          after = planEdits({ ...before, entries: [...before.entries, copied] }, [
            { ...operation, op: 'update' }
          ]).snapshot
          operations = []
        } else operations = [operation]
      } else {
        if (operation === 'replace' && !options.ifVersion)
          throw new DatabaseError('USAGE', 'replace требует --if-version полного исходного снимка.')
        // Один stdin читается однажды, затем одно изменение применяется ко всему явно выбранному набору.
        if (!keys.length && !options.selection) throw new DatabaseError('USAGE', 'Укажите хотя бы один полный адрес.')
        const first = keys.length ? await prepareEdit(operation, keys[0], options) : undefined
        operations = first ? keys.map((key) => ({ ...first, key })) : []
      }
      if (operations.length) {
        const plan = planEdits(before, operations)
        after = plan.snapshot
        skipped = plan.skipped
        noops = plan.noops
        warnings = plan.warnings
      }
    }
    const changes = projectedChanges(snapshotChanges(before, after, options.locale ?? before.defaultLocale), options)
    const metadataChanged = JSON.stringify({ ...before, entries: [] }) !== JSON.stringify({ ...after, entries: [] })
    const committed = options.dryRun
      ? undefined
      : incoming
        ? restoreDatabase(after, { database: path, ifVersion: options.ifVersion ?? version })
        : database.commitSnapshot(after, { ifVersion: options.ifVersion ?? version })
    const meta = {
      version: committed?.version ?? version,
      previousVersion: version,
      dryRun: options.dryRun,
      diff: options.diff ?? (options.dryRun ? 'full' : 'summary')
    }
    const text =
      changesText(changes, options, version, skipped, noops, warnings) +
      (!options.dryRun ? `Сохранённая версия: ${meta.version}\n` : '') +
      (metadataChanged
        ? `Реестр языков: ${before.locales.join(',')} → ${after.locales.join(',')}; основной: ${before.defaultLocale} → ${after.defaultLocale}\n`
        : '')
    return {
      data: {
        action: operation,
        outcome: options.dryRun
          ? 'dry-run'
          : changes.length || metadataChanged
            ? 'changed'
            : skipped.length
              ? 'skipped'
              : 'no-op',
        dryRun: options.dryRun,
        changed: changes.length,
        metadataChanged,
        skipped,
        noops,
        changes,
        warnings
      },
      meta,
      text
    }
  } catch (error) {
    if (
      ['read', 'list', 'find'].includes(operation) &&
      options.after &&
      error instanceof DatabaseError &&
      ['INVALID_CURSOR', 'REVISION_CONFLICT'].includes(error.code)
    ) {
      const restart = continuationCommand(
        operation,
        requested?.keys ?? operands,
        operation === 'find' ? operands[0] : undefined,
        options,
        undefined,
        options.limit ?? (operation === 'read' ? (requested?.keys.length ?? 20) : 20)
      )
      throw new DatabaseError(
        error.code,
        error.message,
        {
          ...z.record(z.string(), z.unknown()).parse(error.details ?? {}),
          nextSteps: [restart]
        },
        error
      )
    }
    throw error
  } finally {
    database.close()
  }
}
