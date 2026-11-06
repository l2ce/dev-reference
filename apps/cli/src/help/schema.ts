import * as z from 'zod'
import { collectionSchema, DatabaseError, localeSchema, sourceSchema } from '@l2ce/database'
import type { Collection } from '@l2ce/database'
import {
  batchInputSchema,
  fieldDescription,
  relationDefinitions,
  textFieldDefinition,
  valueSchema
} from '../commands/definition.js'
import { OBJECT_SCHEMA, RECORD_SCHEMAS, RELATIONS, replacementSchema, TEXT_FIELDS, TYPES } from '../commands/model.js'
import { COMMAND_SPECS, commandRules, commandSpec } from './catalog.js'
import { GLOBAL_OPTION_IDS, helpOption } from './options.js'
import { optionApplies } from './parameters.js'
import { commandExamples, revisionType } from './examples.js'
import { examplesText } from './example-text.js'
import { briefExample, briefRules } from './brief.js'
import { cliCommand } from '../commands/invocation.js'

/**
 * Публичное поле с форматом, владением и реальными возможностями очистки.
 */
export type HelpField = {
  /** Стабильное смысловое имя. */
  name: string
  /** Назначение поля. */
  meaning: string
  /** Тип и допустимые значения в JSON Schema. */
  schema: Record<string, unknown>
  /** Поле обязательно при данном действии. */
  required: boolean
  /** Явное null допустимо. */
  nullable: boolean
  /** Владение значением. */
  scope: 'record' | 'translation'
  /** Формат текста либо системного значения. */
  format: string
  /** Можно читать из файла/stdin. */
  file: boolean
  /** Разрешено буквальное чтение содержимого. */
  content: boolean
  /** Поле входит в поиск по умолчанию. */
  search: boolean
  /** Семантика явной очистки. */
  clear: string
}

/**
 * Два согласованных представления схемы выбранной операции.
 */
export type SchemaDocument = {
  /** Публичные поля, правила, примеры, схема значений и параметров. */
  data: Record<string, unknown>
  /** Краткая текстовая инструкция без внутренних деталей Zod. */
  text: string
}

/**
 * Выбирает реальную схему типа для создания редакции по адресу карточки.
 */
export function fieldsCollection(operation: string, collection: Collection): Collection {
  return operation === 'revision.add' ? revisionType(collection) : collection
}

/**
 * Описывает именно значения --input либо предметные параметры выбранной операции.
 */
export function operationInputSchema(operation: string, collection?: Collection): z.ZodType {
  if (operation === 'batch') return batchInputSchema()
  if (operation === 'init')
    return z.strictObject({
      locales: z.string().min(1).default('ru,en'),
      defaultLocale: localeSchema.optional(),
      dryRun: z.boolean().optional()
    })
  if (operation === 'import')
    return z.strictObject({
      input: z.string().min(1).optional(),
      replace: z.literal(true),
      dryRun: z.boolean().optional(),
      ifVersion: z.string().min(1).optional()
    })
  if (operation === 'export')
    return z.strictObject({
      output: z.string().min(1).optional(),
      dryRun: z.boolean().optional(),
      ifVersion: z.string().min(1).optional()
    })
  if (operation.startsWith('locale.') && operation !== 'locale.list') return z.strictObject({ code: localeSchema })
  if (!collection) throw new DatabaseError('USAGE', `Для ${operation} укажите полный адрес либо --type <один тип>.`)
  const type = fieldsCollection(operation, collection)
  if (
    ['translation.', 'source.', 'question.'].some((prefix) => operation.startsWith(prefix)) &&
    !('translations' in RECORD_SCHEMAS[type].shape)
  )
    throw new DatabaseError(
      'USAGE',
      `${operation} требует собственный перевод; укажите адрес редакции :rev-N, а не карточки.`
    )
  if (operation === 'replace') return replacementSchema(type)
  if (operation === 'source.add') return sourceSchema.omit({ id: true })
  if (operation === 'source.update') return sourceSchema.omit({ id: true }).partial()
  if (operation === 'source.remove')
    return z.strictObject({
      id: sourceSchema.shape.id.optional(),
      matchUrl: z.string().min(1).optional(),
      matchHost: z.string().min(1).optional(),
      allMatches: z.boolean().optional()
    })
  if (operation === 'source.clear' || operation === 'question.clear' || operation === 'translation.delete')
    return z.strictObject({})
  if (operation === 'question.add' || operation === 'question.remove')
    return z.strictObject({ text: z.string().refine((text) => text.trim().length > 0) })
  if (operation === 'delete')
    return z.strictObject({ cascadeOwned: z.boolean().optional(), allowBrokenLinks: z.boolean().optional() })
  if (operation === 'link' || operation === 'unlink') {
    const relations = Object.entries(relationDefinitions(type))
      .filter(([, definition]) => !definition.immutable)
      .map(([name]) => name)
    return z.strictObject({
      relation: relations.length ? z.enum(relations) : z.never(),
      targets: z.array(z.string()).default([]),
      ...(operation === 'link'
        ? {
            replace: z.boolean().optional(),
            unscoped: z.boolean().optional(),
            before: z.string().optional(),
            after: z.string().optional()
          }
        : { all: z.boolean().optional() })
    })
  }
  if (['create', 'update', 'translation.set', 'revision.add'].includes(operation))
    return valueSchema(type, operation === 'revision.add' ? 'create' : operation)
  throw new DatabaseError(
    'USAGE',
    `У ${operation} нет структурированного предметного ввода; используйте его справку параметров.`
  )
}

/**
 * Возвращает полное описание полей из фактических Zod-схем и смыслового реестра.
 */
export function operationFields(operation: string, collection: Collection): HelpField[] {
  const schema = operationInputSchema(operation, collection)
  if (!(schema instanceof z.ZodObject)) return []
  return Object.entries(schema.shape).map(([name, field]): HelpField => {
    const text = textFieldDefinition(name)
    const json = OBJECT_SCHEMA.parse(z.toJSONSchema(field, { io: 'input' }))
    const nullable = field.safeParse(null).success
    const array = json.type === 'array'
    const isSourceSummary = operation === 'source.update' && name === 'summary'
    const meaning = fieldDescription(name)
    return {
      name,
      meaning,
      schema: json,
      required: !field.safeParse(undefined).success,
      nullable,
      scope:
        TEXT_FIELDS.includes(name) || operation.startsWith('source.') || operation.startsWith('question.')
          ? 'translation'
          : 'record',
      format: text.format,
      file:
        text.file &&
        ['create', 'update', 'translation.set', 'revision.add', 'source.add', 'source.update'].includes(operation),
      content: text.content,
      search: text.search,
      clear: isSourceSummary
        ? 'Удалить необязательное поле из объекта.'
        : nullable
          ? 'Установить null.'
          : array
            ? 'Пустой список []; связи редактируются через unlink.'
            : field.safeParse('').success
              ? 'Пустой текст без удаления перевода.'
              : 'Очистка запрещена либо не является полем update.'
    }
  })
}

/**
 * Публикует схему значений с явными критериями, невыразимыми обычной optional-формой.
 */
export function operationJsonSchema(operation: string, collection?: Collection): Record<string, unknown> {
  const schema = OBJECT_SCHEMA.parse(z.toJSONSchema(operationInputSchema(operation, collection), { io: 'input' }))
  if (operation === 'source.remove')
    schema.oneOf = ['id', 'matchUrl', 'matchHost'].map((name) => ({
      required: [name],
      not: {
        anyOf: ['id', 'matchUrl', 'matchHost'].filter((other) => other !== name).map((other) => ({ required: [other] }))
      }
    }))
  return schema
}

/**
 * Описывает все зарегистрированные параметры и позиции команды, включая немутирующие запросы.
 */
export function parameterJsonSchema(operation: string, collection?: Collection): Record<string, unknown> {
  const spec = commandSpec(operation)
  if (!spec) throw new DatabaseError('USAGE', `Неизвестная операция ${operation}.`)
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  const fields = collection && spec.fieldsOperation === operation ? operationFields(operation, collection) : undefined
  for (const id of [...new Set([...spec.options, ...GLOBAL_OPTION_IDS])]) {
    if (!optionApplies(id, operation, collection, fields)) continue
    const option = helpOption(id)
    const flag = /--([a-z][a-z-]*)/.exec(option.flags)?.[1]
    if (!flag) continue
    const name = flag.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
    properties[name] = {
      description: option.description,
      ...(option.parser === 'repeat'
        ? { type: 'array', items: { type: 'string' } }
        : option.choices
          ? { type: 'string', enum: option.choices }
          : option.valueType === 'boolean'
            ? { type: 'boolean' }
            : option.parser === 'positive' || option.parser === 'nonnegative'
              ? { type: 'integer', minimum: option.parser === 'positive' ? 1 : 0 }
              : { type: 'string' })
    }
    if (option.required || spec.requiredOptions?.includes(id)) required.push(name)
  }
  for (const match of spec.signature.matchAll(/(<|\[)([a-zA-Z]+)(\.\.\.)?(>|\])/g)) {
    const [, opening, name, variadic] = match
    properties[name] = {
      description: spec.arguments[name],
      ...(variadic ? { type: 'array', items: { type: 'string' } } : { type: 'string' })
    }
    if (opening === '<') required.push(name)
  }
  const allOf: unknown[] = []
  if (operation !== 'help' && !spec.group) {
    properties.structureOnly = { const: false, description: helpOption('structureOnly').description }
    if (operation !== 'schema') properties.brief = { const: false, description: helpOption('brief').description }
  } else {
    allOf.push({
      if: { required: ['structureOnly'], properties: { structureOnly: { const: true } } },
      then: {
        anyOf: [
          { required: ['format'], properties: { format: { const: 'json' } } },
          { required: ['json'], properties: { json: { const: true } } }
        ],
        properties: { brief: { const: false } }
      }
    })
  }
  if ('allLocales' in properties)
    allOf.push({ not: { required: ['locale', 'allLocales'], properties: { allLocales: { const: true } } } })
  if ('offset' in properties && 'after' in properties) allOf.push({ not: { required: ['offset', 'after'] } })
  if ('selection' in properties) {
    const stdinChannels: unknown[] = [
      ...['input', 'keysFile']
        .filter((field) => field in properties)
        .map((field) => ({ required: [field], properties: { [field]: { const: '-' } } })),
      ...('setStdin' in properties ? [{ required: ['setStdin'] }] : []),
      ...('setFile' in properties
        ? [{ required: ['setFile'], properties: { setFile: { contains: { pattern: '^[^=]+=-$' } } } }]
        : [])
    ]
    const conflicts = [
      ...['limit', 'offset', 'after'].filter((field) => field in properties).map((field) => ({ required: [field] })),
      ...stdinChannels
    ]
    if (conflicts.length)
      allOf.push({
        if: { required: ['selection'], properties: { selection: { const: '-' } } },
        then: { not: { anyOf: conflicts } }
      })
  }
  if ('all' in properties && ['list', 'find'].includes(operation))
    for (const name of ['limit', 'offset', 'after'])
      allOf.push({ not: { required: ['all', name], properties: { all: { const: true } } } })
  if (['source.remove', 'source.update'].includes(operation)) {
    const names = operation === 'source.update' ? ['id', 'matchUrl'] : ['id', 'matchUrl', 'matchHost']
    allOf.push({
      oneOf: names.map((name) => ({
        required: [name],
        not: { anyOf: names.filter((other) => other !== name).map((other) => ({ required: [other] })) }
      }))
    })
  }
  if (['source.clear', 'question.clear'].includes(operation))
    allOf.push({
      anyOf: [{ required: ['locale'] }, { required: ['allLocales'], properties: { allLocales: { const: true } } }]
    })
  if (operation === 'relations')
    allOf.push({ not: { required: ['in', 'out'], properties: { in: { const: true }, out: { const: true } } } })
  if (operation === 'link') {
    required.push('targets')
    properties.targets = { type: 'array', items: { type: 'string' }, minItems: 1 }
    allOf.push({ not: { required: ['before', 'after'] } })
  }
  if (operation === 'unlink')
    allOf.push({
      oneOf: [
        { required: ['targets'], properties: { targets: { minItems: 1 }, all: { const: false } } },
        { required: ['all'], properties: { all: { const: true }, targets: { maxItems: 0 } } }
      ]
    })
  const addressSources =
    operation === 'read'
      ? ['keys', 'keysFile', 'selection']
      : ['update', 'delete', 'source.remove', 'source.clear'].includes(operation)
        ? ['keys', 'selection']
        : []
  if (addressSources.length)
    allOf.push({
      oneOf: addressSources.map((name) => ({
        required: [name],
        properties: { [name]: name === 'keys' ? { minItems: 1 } : { minLength: 1 } },
        not: {
          anyOf: addressSources
            .filter((other) => other !== name)
            .map((other) => ({
              required: [other],
              properties: { [other]: other === 'keys' ? { minItems: 1 } : { minLength: 1 } }
            }))
        }
      }))
    })
  if (operation === 'read')
    allOf.push({
      if: { required: ['content'] },
      then: {
        properties: { keys: { maxItems: 1 }, allLocales: { const: false } },
        not: { anyOf: ['view', 'fields', 'limit', 'offset', 'after'].map((name) => ({ required: [name] })) }
      }
    })
  if (operation === 'batch')
    allOf.push({
      oneOf: [
        { required: ['input'], not: { required: ['file'] } },
        { required: ['file'], not: { required: ['input'] } }
      ]
    })
  if (operation === 'batch')
    allOf.push({
      if: { required: ['file'] },
      then: { not: { anyOf: ['ifVersion', 'diff'].map((name) => ({ required: [name] })) } }
    })
  if (operation === 'import') properties.replace = { const: true }
  if (operation === 'source.add' || (operation === 'create' && collection)) {
    const fields =
      operation === 'source.add'
        ? operationFields(operation, collection ?? 'protocols')
        : operationFields(operation, collectionSchema.parse(collection))
    for (const field of fields.filter((field) => field.required)) {
      const alternatives: unknown[] = [
        { required: ['input'] },
        { required: [field.name] },
        { required: ['set'], properties: { set: { contains: { pattern: `^${field.name}=` } } } }
      ]
      if (field.file)
        alternatives.push(
          { required: ['setStdin'], properties: { setStdin: { const: field.name } } },
          { required: ['setFile'], properties: { setFile: { contains: { pattern: `^${field.name}=` } } } }
        )
      allOf.push({ anyOf: alternatives })
    }
  }
  return {
    type: 'object',
    properties,
    additionalProperties: false,
    ...(required.length ? { required } : {}),
    ...(allOf.length ? { allOf } : {}),
    'x-rules': commandRules(spec)
  }
}

/**
 * Ограничивает машинную схему батча зависимыми значениями и файловыми полями каждого типа/op.
 */
export function batchJsonSchema(): Record<string, unknown> {
  const base = operationJsonSchema('batch')
  const properties = OBJECT_SCHEMA.parse(base.properties)
  const operations = OBJECT_SCHEMA.parse(properties.operations)
  const item = OBJECT_SCHEMA.parse(operations.items)
  const itemProperties = OBJECT_SCHEMA.parse(item.properties)
  const op = OBJECT_SCHEMA.parse(itemProperties.op)
  const operationIds = z.array(z.string()).parse(op.enum)
  const keyPatterns = Object.fromEntries(
    Object.keys(TYPES).map((name) => {
      const type = collectionSchema.parse(name)
      const code = '[a-z0-9]+(?:[.-][a-z0-9]+)*'
      const prefix = TYPES[type][0]
      return [
        type,
        type === 'protocols'
          ? '^protocol:(0|[1-9][0-9]*)(?:-rev-[1-9][0-9]*)?$'
          : type.endsWith('-revisions')
            ? `^${prefix}:${code}:rev-[1-9][0-9]*$`
            : type === 'release-contexts'
              ? `^release-context:${code}:${code}$`
              : `^${prefix}:${code}$`
      ]
    })
  )
  const conditions: unknown[] = []
  for (const typeName of Object.keys(TYPES)) {
    const type = collectionSchema.parse(typeName)
    const pattern = keyPatterns[type]
    for (const operation of operationIds) {
      const condition = { properties: { op: { const: operation }, key: { pattern } }, required: ['op', 'key'] }
      if (
        ['translation.', 'source.', 'question.'].some((name) => operation.startsWith(name)) &&
        !('translations' in RECORD_SCHEMAS[type].shape)
      ) {
        conditions.push({ if: condition, then: false })
        continue
      }
      const isValues = [
        'create',
        'update',
        'replace',
        'translation.set',
        'source.add',
        'source.update',
        'question.add',
        'question.remove'
      ].includes(operation)
      const valuesSchema = isValues
        ? operationJsonSchema(operation, type)
        : { type: 'object', properties: {}, additionalProperties: false }
      const values = OBJECT_SCHEMA.parse(valuesSchema)
      const fields = OBJECT_SCHEMA.parse(values.properties ?? {})
      const fileFields = ['create', 'update', 'translation.set', 'source.add', 'source.update'].includes(operation)
        ? Object.keys(fields).filter((field) => textFieldDefinition(field).file)
        : []
      const required = z.array(z.string()).parse(values.required ?? [])
      const { required: _required, $schema: _dialect, ...optionalValues } = values
      const requiredConditions = required.map((field) => ({
        anyOf: [
          { required: ['values'], properties: { values: { required: [field] } } },
          ...(fileFields.includes(field) ? [{ required: ['files'], properties: { files: { required: [field] } } }] : [])
        ]
      }))
      const conflicts = fileFields.map((field) => ({
        not: {
          required: ['values', 'files'],
          properties: { values: { required: [field] }, files: { required: [field] } }
        }
      }))
      const lists = ['states', 'servers', 'loginRevisions'].filter((field) => field in fields)
      const listProperties = Object.fromEntries(
        lists.map((field) => [field, { type: 'array', items: OBJECT_SCHEMA.parse(fields[field]).items ?? {} }])
      )
      const clearFields =
        operation === 'source.update'
          ? ['summary']
          : ['create', 'update', 'translation.set'].includes(operation)
            ? Object.keys(fields).filter((field) => !['protocols', 'countries'].includes(field))
            : []
      const relationRules =
        operation === 'link' || operation === 'unlink'
          ? Object.entries(relationDefinitions(type))
              .filter(([, definition]) => !definition.immutable)
              .map(([relation]) => ({
                if: { properties: { relation: { const: relation } }, required: ['relation'] },
                then: {
                  properties: {
                    targets: { type: 'array', items: { type: 'string', pattern: `^${RELATIONS[relation]}:` } }
                  }
                }
              }))
          : []
      const mutableRelations = Object.entries(relationDefinitions(type))
        .filter(([, definition]) => !definition.immutable)
        .map(([name]) => name)
      const selectors =
        operation === 'source.update' || operation === 'source.remove'
          ? {
              required: ['options'],
              properties: {
                options: {
                  oneOf: (operation === 'source.update' ? ['id', 'matchUrl'] : ['id', 'matchUrl', 'matchHost']).map(
                    (name) => ({
                      required: [name],
                      not: {
                        anyOf: ['id', 'matchUrl', 'matchHost']
                          .filter((other) => other !== name)
                          .map((other) => ({ required: [other] }))
                      }
                    })
                  )
                }
              }
            }
          : undefined
      const clearScope = ['source.clear', 'question.clear'].includes(operation)
        ? {
            anyOf: [
              { required: ['locale'] },
              {
                required: ['options'],
                properties: { options: { required: ['allLocales'], properties: { allLocales: { const: true } } } }
              }
            ]
          }
        : undefined
      const targetScope =
        operation === 'link'
          ? { required: ['targets'], properties: { targets: { minItems: 1 } } }
          : operation === 'unlink'
            ? {
                oneOf: [
                  {
                    required: ['targets'],
                    properties: {
                      targets: { minItems: 1 },
                      options: { not: { required: ['all'], properties: { all: { const: true } } } }
                    }
                  },
                  {
                    required: ['options'],
                    properties: {
                      options: { required: ['all'], properties: { all: { const: true } } },
                      targets: { maxItems: 0 }
                    }
                  }
                ]
              }
            : undefined
      const clearConflicts = clearFields.map((field) => ({
        not: {
          required: ['clear', 'values'],
          properties: { clear: { contains: { const: field } }, values: { required: [field] } }
        }
      }))
      const allOf = [
        ...requiredConditions,
        ...conflicts,
        ...relationRules,
        ...clearConflicts,
        ...(selectors ? [selectors] : []),
        ...(clearScope ? [clearScope] : []),
        ...(targetScope ? [targetScope] : [])
      ]
      conditions.push({
        if: condition,
        then: {
          properties: {
            values: optionalValues,
            files: {
              type: 'object',
              properties: Object.fromEntries(
                fileFields.map((field) => [field, { type: 'string', minLength: 1, not: { const: '-' } }])
              ),
              additionalProperties: false
            },
            add: { type: 'object', properties: listProperties, additionalProperties: false },
            remove: { type: 'object', properties: listProperties, additionalProperties: false },
            clear: { type: 'array', ...(clearFields.length ? { items: { enum: clearFields } } : { maxItems: 0 }) },
            ...(['link', 'unlink'].includes(operation)
              ? { relation: mutableRelations.length ? { enum: mutableRelations } : false }
              : {})
          },
          ...(['link', 'unlink'].includes(operation) ? { required: ['relation'] } : {}),
          ...(allOf.length ? { allOf } : {})
        }
      })
    }
  }
  return {
    ...base,
    properties: {
      ...properties,
      operations: {
        ...operations,
        items: {
          ...item,
          properties: {
            ...itemProperties,
            key: { type: 'string', anyOf: Object.values(keyPatterns).map((pattern) => ({ pattern })) }
          },
          allOf: conditions
        }
      }
    }
  }
}

/**
 * Возвращает краткую текстовую схему и полный машинный контракт одной операции.
 */
export function describeSchema(
  operation: string,
  collection?: Collection,
  relation?: string,
  brief = false
): SchemaDocument {
  const spec = commandSpec(operation)
  if (!spec || spec.group)
    throw new DatabaseError(
      'USAGE',
      `Неизвестная операция ${operation}. Доступны: ${COMMAND_SPECS.filter(
        (command) => !command.group && command.id !== 'schema' && command.id !== 'help'
      )
        .map((command) => command.id)
        .join(', ')}.`
    )
  const isValueOperation = spec.fieldsOperation === operation
  let schema: Record<string, unknown>
  if (operation === 'batch') schema = batchJsonSchema()
  else if (
    isValueOperation ||
    ['init', 'import', 'export'].includes(operation) ||
    (operation.startsWith('locale.') && operation !== 'locale.list')
  )
    schema = operationJsonSchema(operation, collection)
  else schema = parameterJsonSchema(operation, collection)
  const fields = collection && isValueOperation ? operationFields(operation, collection) : []
  const relations = collection && ['link', 'unlink'].includes(operation) ? relationDefinitions(collection) : undefined
  if (relation && !relations?.[relation]) throw new DatabaseError('USAGE', `Нет отношения ${relation} у ${collection}.`)
  const address = collection
    ? `${TYPES[collection][0]}:${collection === 'protocols' ? '<number>[-rev-<variant>]' : '<code>'}${collection.endsWith('-revisions') ? ':rev-<n>' : collection === 'release-contexts' ? ':<context>' : ''}`
    : undefined
  const examples = commandExamples(operation, collection)
  const rules = commandRules(spec)
  const data = {
    operation,
    type: collection,
    address,
    fields,
    relations,
    schema,
    parameters: parameterJsonSchema(operation, collection),
    rules,
    examples,
    inputKind:
      operation === 'batch'
        ? 'batch'
        : isValueOperation &&
            ![
              'link',
              'unlink',
              'delete',
              'source.remove',
              'source.clear',
              'question.clear',
              'translation.delete'
            ].includes(operation)
          ? 'values'
          : 'parameters'
  }
  return {
    data,
    text: `${spec.purpose}\nОперация: ${operation}${collection ? ` · тип: ${collection}` : ''}${address ? `\nАдрес: ${address}` : ''}\n\n${fields.map((field) => `  ${field.name}${field.required ? ' (обязательно)' : ''}: ${field.meaning}; ${field.scope}; ${field.format}${field.nullable ? '; null допустим' : ''}. ${field.clear}${field.file ? ` Ввод: --${field.name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}, --set-stdin ${field.name}, --set-file ${field.name}=<path>.` : ''}`).join('\n')}\n${relations ? `Связи: ${JSON.stringify(relations)}\n` : ''}\nПравила:\n${(brief ? briefRules(rules) : rules).map((rule) => `- ${rule.text}`).join('\n')}\n\n${examplesText(brief ? briefExample(examples) : examples)}${brief ? `\nПолная справка: ${cliCommand(['help', ...operation.split('.'), ...(collection ? ['--type', collection] : [])])}\n` : ''}`
  }
}
