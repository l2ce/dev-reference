import { Command } from 'commander'
import * as z from 'zod'
import { collectionSchema, DatabaseError } from '@l2ce/database'
import type { Collection } from '@l2ce/database'
import { availableFields, relationDefinitions } from '../commands/definition.js'
import { TYPES } from '../commands/model.js'
import { COMMAND_SPECS, commandRules, commandSpec } from './catalog.js'
import { commandExamples, revisionType } from './examples.js'
import { examplesText } from './example-text.js'
import { commandPath, LEGACY_ROOTS, legacyExamples, legacyInput, legacyOptions, legacySpec } from './legacy.js'
import { GLOBAL_OPTION_IDS, helpOption } from './options.js'
import { optionApplies } from './parameters.js'
import { batchJsonSchema, fieldsCollection, operationFields, operationJsonSchema } from './schema.js'
import { cliCommand, databaseArguments } from '../commands/invocation.js'
import type { HelpField } from './schema.js'
import type { CommandSpec, HelpContext, HelpError, HelpExample, HelpOption, HelpRule } from './help.types.js'

/**
 * Краткий узел навигации; подробная справка конкретного действия публикуется отдельно.
 */
export type HelpCommandSummary = {
  /** Имя последнего уровня. */
  name: string
  /** Полный путь команды. */
  path: string[]
  /** Назначение. */
  description: string
  /** Вложенные доступные действия. */
  commands: HelpCommandSummary[]
}

/**
 * Позиционный аргумент выбранной команды.
 */
export type HelpArgument = {
  /** Стабильное имя позиции. */
  name: string
  /** Смысл и способ адресации. */
  description: string
  /** Обязательная позиция. */
  required: boolean
  /** Разрешено несколько значений. */
  variadic: boolean
}

/**
 * Статическая применимость полей и отношений одного типа.
 */
export type HelpTypeSummary = {
  /** Зарегистрированный тип. */
  type: Collection
  /** Форма полного адреса. */
  address: string
  /** Публичные поля этого представления. */
  fields: string[]
  /** Обязательные значения создания. */
  required: string[]
  /** Собственные исходящие отношения. */
  relations: ReturnType<typeof relationDefinitions>
}

/**
 * Согласованный документ для текста, JSON и проверки полноты.
 */
export type HelpDocument = {
  /** Имя выбранного узла, не всегда корень CLI. */
  name: string
  /** Устойчивый идентификатор действия. */
  operation: string
  /** Путь с уровнями команды. */
  path: string[]
  /** Назначение. */
  description: string
  /** Все смысловые формы вызова. */
  usage: string[]
  /** Дополнительная смысловая грамматика сложного ввода. */
  details: string[]
  /** Контекст адреса/типа без предметного чтения. */
  context: HelpContext
  /** Признак старой семантики. */
  legacy: boolean
  /** Позиционные аргументы с обязательностью. */
  arguments: HelpArgument[]
  /** Параметры, реально зарегистрированные из того же реестра. */
  options: HelpOption[]
  /** Применимые собственные поля выбранного типа. */
  fields: HelpField[]
  /** Различия доступных типов, включая собственные поля и связи. */
  types: HelpTypeSummary[]
  /** Полные применимые правила. */
  rules: HelpRule[]
  /** Содержимое результата. */
  result: string
  /** Отсутствующие значения, повторы и no-op. */
  absence: string
  /** Предметные последствия и гарантии безопасности. */
  safety: string[]
  /** Стабильные коды и восстановление. */
  errors: HelpError[]
  /** Исполняемые примеры вместе с подготовкой. */
  examples: HelpExample[]
  /** Соседние новые действия. */
  related: string[]
  /** Навигация по дочерним действиям. */
  commands: HelpCommandSummary[]
  /** Отдельная навигация совместимых корневых входов. */
  legacyCommands: HelpCommandSummary[]
  /** Полная схема структурированного ввода, если применима. */
  inputSchema?: Record<string, unknown>
}

/**
 * Выбирает совместимые с действием типы статически, без существования записей.
 */
export function supportsCommandType(operation: string, type: Collection): boolean {
  if (operation === 'revision.add' || operation === 'revision.list')
    return ['packets', 'scenarios', 'articles'].includes(type)
  if (['translation.', 'source.', 'question.'].some((prefix) => operation.startsWith(prefix)))
    return !['packets', 'scenarios', 'articles'].includes(type)
  if (operation === 'link' || operation === 'unlink')
    return Object.values(relationDefinitions(type)).some(
      (relation) => !relation.immutable && (operation === 'link' || !relation.required || relation.multiple)
    )
  return true
}

/**
 * Строит навигацию из того же дерева, которое разбирает CLI, не скрывая старый search отдельно от текста.
 */
function commandSummary(command: Command): HelpCommandSummary {
  const path = commandPath(command)
  return {
    name: command.name(),
    path,
    description: commandSpec(path.join('.'))?.purpose ?? `Совместимость: ${command.description()}`,
    commands: command.commands.map(commandSummary)
  }
}

/**
 * Объясняет исправление ошибок, не рекомендуя автоматическую повторную запись.
 */
function errorsFor(operation: string, context: HelpContext): HelpError[] {
  const help = cliCommand([
    ...databaseArguments(context),
    'help',
    ...(operation === 'protocols-db' ? [] : operation.split('.')),
    ...(context.collection ? ['--type', context.collection] : [])
  ])
  return [
    {
      code: 'USAGE / INVALID_INPUT / INVALID_QUERY / VALIDATION_ERROR (2)',
      reason: 'Неподдерживаемое поле, тип, значение или сочетание параметров.',
      recovery: `Проверьте форматы и ограничения: ${help}`
    },
    {
      code: 'NOT_FOUND / DATABASE_NOT_FOUND (3)',
      reason: 'Нет базы, записи, выбранной применимости или нужного перевода.',
      recovery: context.key
        ? `Проверьте владельца: ${cliCommand([...databaseArguments(context), 'read', context.key, '--view', 'edit'])}. Базу создают init либо import --replace.`
        : 'Проверьте --database через status, затем точные адреса и язык; init не заменяет существующий файл.'
    },
    {
      code: 'REVISION_CONFLICT / CONFLICT / ALREADY_EXISTS (4)',
      reason: 'Устарела версия/выборка, адрес занят или выбор неоднозначен.',
      recovery:
        'Обновите чтение или выборку. Для неоднозначного источника используйте точный ID; явные разрешения применяйте только после нового предпросмотра. Не повторяйте запись автоматически.'
    },
    {
      code: 'BUSY / EXPORT_BUSY (5)',
      reason: 'SQLite либо каталог экспорта временно занят другим писателем.',
      recovery: 'Дождитесь доступности и повторите команду явно с заново проверенными данными.'
    },
    {
      code: '0 / 1',
      reason: '0 — успех, no-op, пропуск или пустой поиск; 1 — неожиданный системный сбой.',
      recovery:
        'При неполном read JSON остаётся в stdout с ok:true, itemsComplete:false и кодом 3; --allow-missing явно разрешает 0. При сбое проверьте отдельный stderr и не объявляйте запись успешной.'
    }
  ]
}

/**
 * Ограничивает параметры реальными полями и совместимостью фильтров конкретного контекста.
 */
function contextualOptions(spec: CommandSpec, context: HelpContext, fields: HelpField[]): HelpOption[] {
  const type = context.collection
  return [
    ...spec.options
      .map((id): HelpOption | undefined => {
        if (!optionApplies(id, spec.id, type, fields)) return undefined
        const option = { ...helpOption(id), required: spec.requiredOptions?.includes(id) || helpOption(id).required }
        const defaultDescription =
          id === 'view'
            ? spec.id === 'read'
              ? 'full'
              : 'brief'
            : id === 'limit'
              ? spec.id === 'read'
                ? 'Весь явно заданный набор без скрытого лимита.'
                : '20'
              : option.defaultDescription
        if (spec.id.startsWith('source.') && ['title', 'summary', 'url'].includes(id))
          return {
            ...option,
            defaultDescription:
              id === 'summary'
                ? spec.id === 'source.add'
                  ? 'Необязателен; если задан, должен содержать непустой текст.'
                  : 'Сохраняется; --clear summary удаляет необязательное поле.'
                : spec.id === 'source.add'
                  ? 'Обязателен через один канал ввода; автоматического значения нет.'
                  : 'Непереданное значение сохраняется.'
          }
        return { ...option, defaultDescription }
      })
      .filter((option): option is HelpOption => option !== undefined),
    ...GLOBAL_OPTION_IDS.filter((id) => optionApplies(id, spec.id)).map((id) => {
      const option = helpOption(id)
      return id === 'locale' && ['source.clear', 'question.clear'].includes(spec.id)
        ? { ...option, defaultDescription: 'Обязательный явный выбор --locale либо --all-locales.' }
        : option
    })
  ]
}

/**
 * Строит контекстную справку нового или совместимого узла без обращения к SQLite.
 */
export function helpDocument(command: Command, context: HelpContext = {}): HelpDocument {
  const path = commandPath(command)
  const operation = path.join('.') || 'protocols-db'
  const isRoot = !path.length
  const isLegacy = LEGACY_ROOTS.includes(path[0])
  const spec = isRoot ? rootSpec() : (commandSpec(operation) ?? legacySpec(command))
  const selected = context.collection
    ? [context.collection]
    : (context.collections ?? Object.keys(TYPES).map((type) => collectionSchema.parse(type)))
  const types = selected.filter((type) => supportsCommandType(operation, type))
  if (context.collection && spec.typed && !types.length)
    throw new DatabaseError(
      'USAGE',
      `Операция ${operation} неприменима к ${context.collection}. Укажите ${Object.keys(TYPES)
        .filter((type) => supportsCommandType(operation, collectionSchema.parse(type)))
        .join(', ')}.`
    )
  const fieldOp = spec.fieldsOperation
  const fieldsType =
    context.collection &&
    context.protocol &&
    ['read', 'list', 'find', 'stats'].includes(operation) &&
    ['packets', 'scenarios', 'articles'].includes(context.collection)
      ? revisionType(context.collection)
      : context.collection
  let fields =
    !isLegacy && fieldsType && fieldOp
      ? operationFields(fieldOp, fieldsType).map((field) =>
          ['read', 'list', 'find', 'stats', 'tree', 'relations', 'types'].includes(operation)
            ? { ...field, required: false, file: false, clear: 'Чтение не изменяет значение.' }
            : field
        )
      : []
  if (operation === 'batch')
    fields = [
      ...new Map(
        types
          .flatMap((type) => operationFields('create', type))
          .map((field) => [field.name, { ...field, required: false }])
      ).values()
    ]
  const options = isLegacy
    ? [
        ...legacyOptions(command),
        ...GLOBAL_OPTION_IDS.filter((id) => !command.options.some((option) => option.attributeName() === id)).map(
          helpOption
        )
      ]
    : contextualOptions(spec, context, fields)
  const mutable = spec.ruleSets.includes('write')
  const examples = isRoot
    ? commandExamples('help')
    : isLegacy
      ? legacyExamples(command)
      : commandExamples(operation, context.collection)
  let inputSchema: Record<string, unknown> | undefined
  if (isLegacy) {
    const input = legacyInput(command)
    fields = input.fields
    inputSchema = input.schema
  }
  if (!isLegacy && operation === 'batch') inputSchema = batchJsonSchema()
  else if (
    !isLegacy &&
    context.collection &&
    fieldOp &&
    !['read', 'list', 'find', 'stats', 'tree', 'relations', 'types'].includes(operation)
  )
    inputSchema = operationJsonSchema(operation, context.collection)
  else if (
    !isLegacy &&
    (['init', 'import', 'export'].includes(operation) ||
      (operation.startsWith('locale.') && operation !== 'locale.list'))
  )
    inputSchema = operationJsonSchema(operation)
  const usage = [`${cliCommand(path)}${command.usage() ? ` ${command.usage()}` : ''}`]
  if (['read', 'update', 'delete', 'source.remove', 'source.clear', 'validate'].includes(operation))
    usage.push(`${cliCommand(path)} --selection <path> [options]`)
  if (operation === 'read')
    usage.push(
      `${cliCommand(['read'])} --keys-file <path|-> [options]`,
      `${cliCommand(['read'])} <key> --content <field> [--locale <code>] [--protocol <key>]`
    )
  const rules = commandRules(spec)
  if (spec.typed)
    rules.push({
      id: 'typed-help',
      text: 'Уточнение без базы: help <операция> --type <тип> либо <операция> <полный-адрес> --help. Справка выбранного типа содержит только допустимые поля; существование адреса не проверяется.'
    })
  return {
    name: command.name(),
    operation,
    path,
    description: spec.purpose,
    usage,
    details: spec.details ?? [],
    context,
    legacy: isLegacy,
    arguments: command.registeredArguments.map((argument) => ({
      name: argument.name(),
      description: spec.arguments[argument.name()] ?? 'Полный адрес либо имя подкоманды.',
      required: argument.required,
      variadic: argument.variadic
    })),
    options,
    fields,
    types:
      spec.typed || operation === 'types' || isRoot
        ? types.map((type) => {
            const actual = fieldsCollection(operation, type)
            const fields = operationFields(fieldOp ?? 'create', actual)
            return {
              type,
              address: `${TYPES[type][0]}:${type === 'protocols' ? '<number>[-rev-<variant>]' : '<code>'}${type.endsWith('-revisions') ? ':rev-<n>' : type === 'release-contexts' ? ':<context>' : ''}`,
              fields: operation === 'batch' ? fields.map((field) => field.name) : availableFields(actual),
              required:
                operation === 'create' || operation === 'batch'
                  ? fields.filter((field) => field.required).map((field) => field.name)
                  : [],
              relations: relationDefinitions(actual)
            }
          })
        : [],
    rules,
    result: spec.result,
    absence: spec.absence,
    safety: mutable
      ? [
          'Мутации атомарны; --dry-run не пишет. Непереданные поля update сохраняются.',
          'Протоколы переиспользуемой редакции видны в diff; ограничение чтения не делает редакцию локальной для протокола.',
          'Неизвестные факты и ссылки не добавляются ради прохождения проверки.'
        ]
      : ['Справка не открывает SQLite; чтения не создают отсутствующий файл.'],
    errors: errorsFor(isRoot ? 'protocols-db' : operation, context),
    examples,
    related: spec.related,
    commands: command.commands.filter((child) => !LEGACY_ROOTS.includes(child.name())).map(commandSummary),
    legacyCommands: isRoot
      ? command.commands.filter((child) => LEGACY_ROOTS.includes(child.name())).map(commandSummary)
      : [],
    inputSchema
  }
}

/**
 * Описывает корневую навигацию теми же обязательными разделами, что предметные действия.
 */
function rootSpec(): CommandSpec {
  return {
    id: 'protocols-db',
    signature: '[command]',
    purpose: 'Справочник обмена клиентов Lineage II с серверами: чтение, исследование и проверяемое наполнение SQLite.',
    arguments: {},
    options: [],
    ruleSets: ['base'],
    rules: [
      {
        id: 'root-discovery',
        text: 'Для начала: types → status → list/find → read. Изменения: create/update, отдельные translation/revision/source/question, link/unlink. Сначала --dry-run, затем явное применение и export. help workflow catalog|translate|research показывает полный путь.'
      }
    ],
    result:
      'Текст по умолчанию; JSON — системное представление той же выбранной информации. Все предметные операции адресуются полными ключами.',
    absence: 'Корневой вызов без команды показывает справку, а не открывает базу.',
    related: COMMAND_SPECS.filter((spec) => !spec.id.includes('.')).map((spec) => spec.id)
  }
}

/**
 * Кратко называет реальный JSON-тип, перечисления и значения по умолчанию поля.
 */
function fieldType(field: HelpField): string {
  return schemaType(field.schema)
}

/**
 * Разворачивает вложенные массивы/объекты схемы в смысловую сигнатуру без деталей реализации Zod.
 */
function schemaType(input: unknown): string {
  const parsed = z.record(z.string(), z.unknown()).safeParse(input)
  if (!parsed.success) return 'значение'
  const schema = parsed.data
  if (Array.isArray(schema.enum)) return schema.enum.join(' | ')
  if (Array.isArray(schema.anyOf)) return schema.anyOf.map(schemaType).join(' | ')
  if (schema.type === 'array')
    return `array<${schemaType(schema.items)}>${schema.minItems !== undefined ? `; минимум ${schema.minItems} элементов` : ''}${schema.maxItems !== undefined ? `; максимум ${schema.maxItems} элементов` : ''}`
  if (schema.type === 'object') {
    const fields = z.record(z.string(), z.unknown()).parse(schema.properties ?? {})
    const required = z.array(z.string()).parse(schema.required ?? [])
    return `{ ${Object.entries(fields)
      .map(([name, field]) => `${name}${required.includes(name) ? '' : '?'}: ${schemaType(field)}`)
      .join('; ')} }`
  }
  return `${Array.isArray(schema.type) ? schema.type.join(' | ') : String(schema.type ?? 'значение')}${schema.format ? `; формат ${schema.format}` : ''}${schema.pattern ? `; шаблон ${schema.pattern}` : ''}${schema.minimum !== undefined ? `; минимум ${schema.minimum}` : ''}${schema.maximum !== undefined ? `; максимум ${schema.maximum}` : ''}${schema.minLength !== undefined ? `; минимум ${schema.minLength} символов` : ''}`
}

/**
 * Рендерит полный выбранный контракт, не отсылая за обязательной информацией к README или исходникам.
 */
export function helpText(document: HelpDocument): string {
  let text = `Usage: ${document.usage[0]}\n\n${document.description}\n${document.legacy ? 'ВНИМАНИЕ: совместимый старый контракт, не семантика нового update.\n' : ''}`
  if (document.context.collection)
    text += `Тип: ${document.context.collection}${document.context.key ? ` · адрес: ${document.context.key}` : ''}\n`
  if (document.usage.length > 1)
    text += `\nФормы вызова:\n${document.usage
      .slice(1)
      .map((usage) => `  ${usage}`)
      .join('\n')}\n`
  if (document.arguments.length)
    text += `\nАргументы:\n${document.arguments.map((argument) => `  ${argument.name}${argument.required ? ' (обязательно)' : ''}${argument.variadic ? ' (несколько)' : ''}: ${argument.description}`).join('\n')}\n`
  if (document.commands.length)
    text += `\nКоманды:\n${document.commands.map((command) => `  ${command.name}${command.commands.length ? ` [${command.commands.map((child) => child.name).join(', ')}]` : ''}: ${command.description}`).join('\n')}\n`
  text += `\nOptions — параметры и умолчания:\n${document.options.map((option) => `  ${option.flags}${option.required ? ' (обязательно)' : ''}${option.legacy ? ' [совместимость]' : ''}\n    ${option.description}\n    Тип: ${option.valueType}${option.choices ? `; значения: ${option.choices.join(' | ')}` : ''}. По умолчанию: ${option.defaultDescription}${option.rules.length ? `\n    ${option.rules.join(' ')}` : ''}`).join('\n')}\n`
  if (document.fields.length)
    text += `\nПоля выбранного типа:\n${document.fields.map((field) => `  ${field.name}${field.required ? ' (обязательно)' : ''}: ${field.meaning}\n    ${fieldType(field)}; ${field.scope === 'translation' ? 'выбранный перевод' : 'общая запись'}; ${field.format}${field.nullable ? '; null допустим' : ''}. ${field.clear}${field.file ? ` Файл/stdin: --set-file ${field.name}=<path>, --set-stdin ${field.name}.` : ''}`).join('\n')}\n`
  if (document.types.length)
    text += `\nТипы и поля:\n${document.types
      .map(
        (type) =>
          `  ${type.type} — ${type.address}\n    Поля: ${type.fields.join(', ')}.${type.required.length ? ` Обязательно при создании: ${type.required.join(', ')}.` : ''}${
            Object.keys(type.relations).length
              ? ` Связи: ${Object.entries(type.relations)
                  .map(
                    ([name, relation]) =>
                      `${name} (${relation.immutable ? 'владелец неизменяем' : relation.multiple ? 'множественная, упорядоченная' : relation.required ? 'обязательная одиночная' : 'nullable одиночная'})`
                  )
                  .join(', ')}.`
              : ''
          }`
      )
      .join('\n')}\n`
  if (document.details.length)
    text += `\nФормат сложного ввода:\n${document.details.map((detail) => `- ${detail}`).join('\n')}\n`
  text += `\nПравила и ограничения:\n${document.rules.map((rule) => `- [${rule.id}] ${rule.text}`).join('\n')}\n\nРезультат:\n${document.result}\n\nОтсутствие данных и повторы:\n${document.absence}\n\nБезопасность:\n${document.safety.map((safety) => `- ${safety}`).join('\n')}\n\nОшибки и исправление:\n${document.errors.map((error) => `- ${error.code}: ${error.reason}\n  ${error.recovery}`).join('\n')}\n\nПримеры (синтетические данные, не исторические факты):\n${examplesText(document.examples)}`
  if (document.related.length)
    text += `\nСледующие действия: ${document.related.map((name) => `help ${name.replaceAll('.', ' ')}`).join('; ')}.\n`
  if (document.legacyCommands.length)
    text += `\nСовместимость — старые точки входа (отдельная семантика, не основной путь):\n${document.legacyCommands.map((command) => `  ${command.path.join(' ')}: ${command.description}`).join('\n')}\n`
  return text
}
