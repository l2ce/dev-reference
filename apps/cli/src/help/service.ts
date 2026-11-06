import { Command } from 'commander'
import * as z from 'zod'
import { collectionSchema, DatabaseError } from '@l2ce/database'
import { address } from '../commands/model.js'
import { helpDocument, helpText, supportsCommandType } from './document.js'
import { workflowExamples } from './examples.js'
import { commandPath } from './legacy.js'
import { cliCommand, databaseArguments } from '../commands/invocation.js'
import { briefHelpText } from './brief.js'
import type { HelpDocument } from './document.js'
import type { HelpContext } from './help.types.js'

/**
 * Результат разбора справочного запроса, не требующего предметного ввода или SQLite.
 */
export type HelpRequest = {
  /** Выбранный узел реального дерева Commander. */
  command: Command
  /** Контекст типа и адреса. */
  context: HelpContext
  /** Явно запрошена справка либо обзор группы. */
  requested: boolean
  /** Формат stdout и ошибок справки. */
  json: boolean
  /** Отступы системного представления. */
  pretty: boolean
  /** Явный сокращённый текстовый режим без сокращения машинного контракта. */
  brief: boolean
  /** JSON без дублирующего текстового представления. */
  structureOnly: boolean
  /** Необязательный виртуальный рабочий сценарий. */
  workflow?: string
}

/**
 * Выбранная справка, одинаковая по составу для текста и JSON.
 */
export type HelpResponse = {
  /** Структурированный контракт выбранного узла. */
  document: HelpDocument
  /** Полный текстовый рендер того же контракта. */
  text: string
}

/**
 * Сканирует только аргументы справки и контекста; значения текстовых опций не становятся командами.
 */
export function inspectHelpRequest(program: Command, argv: readonly string[]): HelpRequest {
  let command = program
  let explicit = false
  let helper = false
  let afterSeparator = false
  let json = false
  let pretty = false
  let brief = false
  let structureOnly = false
  let database: string | undefined
  let locale: string | undefined
  let allLocales = false
  let version = false
  let type: string | undefined
  let protocol: string | undefined
  let workflow: string | undefined
  const operands: string[] = []
  const unknownOptions: string[] = []
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (!afterSeparator && token === '--') {
      afterSeparator = true
      continue
    }
    if (!afterSeparator && (token === '--help' || token === '-h')) {
      explicit = true
      continue
    }
    if (!afterSeparator && token.startsWith('-') && token !== '-') {
      const equals = token.indexOf('=')
      const name = equals >= 0 ? token.slice(0, equals) : token
      const options = [...command.options, ...program.options]
      const option = options.find(
        (option) =>
          option.long === name ||
          option.short === name ||
          (option.short && name.startsWith(option.short) && option.short === '-l')
      )
      const isType = name === '--type'
      if (!option && !isType) {
        unknownOptions.push(name)
        continue
      }
      let value: string | undefined
      if (equals >= 0) value = token.slice(equals + 1)
      else if (option?.short === '-l' && token.length > 2 && token.startsWith('-l')) value = token.slice(2)
      else if (isType || option?.required || option?.optional) value = argv[++index]
      if (name === '--format') {
        if (value && !['text', 'json'].includes(value)) unknownOptions.push(`--format=${value}`)
        json = value === 'json' || json
      }
      if (name === '--json') json = true
      if (name === '--pretty') pretty = true
      if (name === '--brief') brief = true
      if (name === '--structure-only') structureOnly = true
      if (name === '--database') database = value
      if (name === '--locale' || (option?.short === '-l' && name.startsWith('-l'))) locale = value
      if (name === '--all-locales') allLocales = true
      if (name === '--version' || name === '-V') version = true
      if (isType) type = value
      if (name === '--protocol') protocol = value
      continue
    }
    if (!helper && command === program && token === 'help') {
      helper = true
      continue
    }
    if (helper && command === program && token === 'workflow' && !operands.length) {
      workflow = argv[++index]
      explicit = true
      continue
    }
    const child = command.commands.find((child) => child.name() === token)
    if (child && !operands.length) {
      command = child
      continue
    }
    operands.push(token)
  }
  const requested =
    explicit || helper || (!version && !operands.length && (command === program || command.commands.length > 0))
  const context: HelpContext = {
    ...(database ? { database } : {}),
    ...(locale ? { locale } : {}),
    ...(allLocales ? { allLocales } : {}),
    ...(json ? { format: 'json' } : {})
  }
  if (protocol) context.protocol = protocol
  // Сохраняем безопасный контекст даже при ошибке справочного запроса до Commander.
  program.setOptionValue('format', json ? 'json' : 'text')
  program.setOptionValue('pretty', pretty)
  if (database) program.setOptionValue('database', database)
  if (requested) {
    program.setOptionValue('format', json ? 'json' : 'text')
    program.setOptionValue('pretty', pretty)
    if (unknownOptions.length)
      throw new DatabaseError(
        'USAGE',
        `Неизвестные параметры справки: ${unknownOptions.join(', ')}. Используйте зарегистрированные флаги выбранной команды.`
      )
    if (pretty && !json) throw new DatabaseError('USAGE', '--pretty требует --format json либо --json.')
    if (structureOnly && !json) throw new DatabaseError('USAGE', '--structure-only требует --format json.')
    if (structureOnly && brief)
      throw new DatabaseError(
        'USAGE',
        '--brief сокращает текст; --structure-only возвращает полную JSON-структуру. Выберите один режим.'
      )
    if (helper && command === program && operands.length && !workflow)
      throw new DatabaseError(
        'USAGE',
        `Неизвестная команда ${operands[0]}. Доступны: ${program.commands.map((command) => command.name()).join(', ')}.`
      )
    if (helper && operands.some((operand) => !operand.includes(':')) && !workflow)
      throw new DatabaseError(
        'USAGE',
        `Неизвестный раздел ${operands.find((operand) => !operand.includes(':'))} команды ${command.name()}. Допустимы её подкоманды и необязательный полный адрес.`
      )
    const keys = operands.filter((operand) => operand.includes(':'))
    const addresses = (commandPath(command).join('.') === 'read' ? keys : keys.slice(0, 1)).map(address)
    const inferred = [...new Set(addresses.map((address) => address.collection))]
    if (addresses.length === 1) context.key = addresses[0].key
    if (inferred.length === 1) context.collection = inferred[0]
    else if (inferred.length) context.collections = inferred
    if (type !== undefined) {
      const types = type.split(',').map((type) => collectionSchema.parse(type))
      if (inferred.length && (types.length !== inferred.length || types.some((type) => !inferred.includes(type))))
        throw new DatabaseError('USAGE', 'Тип --type не совпадает с типом указанного адреса.')
      if (types.length === 1) context.collection = types[0]
      else context.collections = types
    }
    if (protocol) context.protocol = protocol
    if (helper && command === program && explicit && !workflow && !operands.length)
      command = program.commands.find((command) => command.name() === 'help') ?? program
  } else {
    const key = operands.find((operand) => operand.includes(':'))
    if (key) {
      try {
        context.key = address(key).key
        context.collection = address(key).collection
      } catch {
        /* Ошибка исходной операции должна остаться основной. */
      }
    }
    if (!context.collection && type) {
      const types = z.array(collectionSchema).safeParse(type.split(','))
      if (types.success && types.data.length === 1) context.collection = types.data[0]
      else if (types.success) context.collections = types.data
    }
  }
  return { command, context, requested, json, pretty, brief, structureOnly, workflow }
}

/**
 * Формирует один полный выбранный контракт, включая виртуальный workflow.
 */
export function requestedHelp(request: HelpRequest): HelpResponse {
  const document = helpDocument(request.command, request.context)
  if (request.workflow) {
    if (!['catalog', 'translate', 'research'].includes(request.workflow))
      throw new DatabaseError('USAGE', 'Сценарии: catalog, translate, research.')
    document.name = request.workflow
    document.operation = `help.workflow.${request.workflow}`
    document.path = ['help', 'workflow', request.workflow]
    document.description = `Сквозной рабочий сценарий ${request.workflow}: все предусловия и команды выполняются на отдельной новой базе.`
    document.usage = [cliCommand(['help', 'workflow', request.workflow])]
    document.examples = workflowExamples(request.workflow)
    document.commands = []
    document.legacyCommands = []
  }
  return { document, text: request.structureOnly ? '' : request.brief ? briefHelpText(document) : helpText(document) }
}

/**
 * Печатает ровно один документ справки в выбранном формате, не запуская предметное действие.
 */
export function writeRequestedHelp(request: HelpRequest): void {
  const { document, text } = requestedHelp(request)
  process.stdout.write(
    request.json
      ? JSON.stringify(
          {
            ok: true,
            data: { ...(request.structureOnly ? {} : { help: text }), structure: document },
            meta: { operation: 'help', scope: document.path }
          },
          null,
          request.pretty ? 2 : undefined
        ) + '\n'
      : text
  )
}

/**
 * Возвращает безопасную следующую команду из того же дерева, что использует справка.
 */
export function helpRecovery(program: Command, argv: readonly string[], error?: unknown): string[] {
  try {
    const request = inspectHelpRequest(program, argv)
    const path = commandPath(request.command)
    const parsed = z.record(z.string(), z.unknown()).safeParse(error instanceof DatabaseError ? error.details : {})
    const details = parsed.success ? parsed.data : {}
    const key = typeof details.key === 'string' ? details.key : request.context.key
    const failedOperation = typeof details.operation === 'string' ? details.operation : path.join('.')
    const context = { ...request.context, ...(typeof details.locale === 'string' ? { locale: details.locale } : {}) }
    const database = databaseArguments(context)
    const format = context.format === 'json' ? ['--format', 'json'] : []
    const helpFormat = context.format === 'json' ? ['--format', 'json', '--structure-only'] : ['--brief']
    const isUnknownLocale =
      typeof details.locale === 'string' &&
      error instanceof DatabaseError &&
      error.message.includes('не зарегистрирован')
    const isMissingRecord = details.notFoundKind === 'record' || details.availability === 'not-found'
    const canInspectOwner =
      key &&
      !details.revisionOwnerKey &&
      !isMissingRecord &&
      (failedOperation !== 'create' || (error instanceof DatabaseError && error.code === 'ALREADY_EXISTS'))
    const language = isUnknownLocale
      ? []
      : context.allLocales
        ? ['--all-locales']
        : context.locale
          ? ['--locale', context.locale]
          : []
    const steps: string[] = []
    if (Array.isArray(details.nextSteps))
      steps.push(...details.nextSteps.filter((step): step is string => typeof step === 'string'))
    if (typeof details.revisionOwnerKey === 'string')
      steps.push(cliCommand([...database, 'revision', 'list', details.revisionOwnerKey, ...format]))
    if (error instanceof DatabaseError && ['DATABASE_NOT_FOUND', 'ALREADY_EXISTS'].includes(error.code))
      steps.push(cliCommand([...database, 'status', ...format]))
    if (isUnknownLocale || failedOperation.startsWith('locale.'))
      steps.push(cliCommand([...database, 'locale', 'list', ...format]))
    if (key && isMissingRecord)
      steps.push(cliCommand([...database, 'list', '--type', address(key).collection, ...language, ...format]))
    if (canInspectOwner && failedOperation.startsWith('source.'))
      steps.push(cliCommand([...database, 'source', 'list', key, ...language, ...format]))
    if (canInspectOwner && failedOperation.startsWith('question.'))
      steps.push(cliCommand([...database, 'question', 'list', key, ...language, ...format]))
    if (
      canInspectOwner &&
      (failedOperation.startsWith('revision.') || Array.isArray(details.owned)) &&
      ['packets', 'scenarios', 'articles'].includes(address(key).collection)
    )
      steps.push(cliCommand([...database, 'revision', 'list', key, ...format]))
    if (
      canInspectOwner &&
      (failedOperation.startsWith('translation.') || details.availability === 'translation-missing')
    )
      steps.push(cliCommand([...database, 'translation', 'list', key, ...format]))
    if (canInspectOwner && ['link', 'unlink'].includes(failedOperation))
      steps.push(cliCommand([...database, 'relations', key, ...format]))
    if (typeof details.value === 'string' && details.value.includes(':'))
      steps.push(cliCommand([...database, 'list', '--type', address(details.value).collection, ...format]))
    const collection = key ? address(key).collection : context.collection
    const typed = collection && supportsCommandType(failedOperation, collection)
    steps.push(
      cliCommand([
        ...database,
        'help',
        ...failedOperation.split('.').filter(Boolean),
        ...(typed ? ['--type', collection] : context.collections ? ['--type', context.collections.join(',')] : []),
        ...helpFormat
      ])
    )
    if (canInspectOwner && details.availability === undefined) {
      const isLocalized = language.length > 0 || context.protocol !== undefined
      steps.push(
        cliCommand([
          ...database,
          'read',
          key,
          '--view',
          isLocalized ? 'full' : 'edit',
          ...language,
          ...(context.protocol ? ['--protocol', context.protocol] : []),
          ...format
        ])
      )
    }
    return [...new Set(steps)]
  } catch {
    const database = program.getOptionValue('database')
    return [
      cliCommand([
        ...(typeof database === 'string' ? ['--database', database] : []),
        'help',
        ...(program.getOptionValue('format') === 'json' || program.getOptionValue('json') === true
          ? ['--format', 'json', '--structure-only']
          : ['--brief'])
      ])
    ]
  }
}
