import * as z from 'zod'
import { DatabaseError, sourceSchema, translationSchema } from '@l2ce/database'
import type { Collection } from '@l2ce/database'
import { address, FIELD_NAMES, IMMUTABLE_FIELDS, RECORD_SCHEMAS, TEXT_FIELDS } from './model.js'
import type { RelationDefinition } from './interface.types.js'

/** Смысл полей публикуется и схемой, и справкой; неизвестное поле не получает заглушку. */
const FIELD_DESCRIPTIONS: Readonly<Record<string, string>> = {
  title: 'Заголовок выбранного языка',
  summary: 'Краткое описание / аннотация',
  description: 'Основное описание выбранного языка',
  translationStatus: 'Состояние конкретного перевода',
  sources: 'Источники конкретного перевода',
  questions: 'Открытые вопросы конкретного перевода',
  branch: 'Обязательная ветка',
  saga: 'Необязательная сага той же ветки',
  chronicle: 'Классификация самостоятельного релиза',
  region: 'Явно установленный регион выхода',
  protocols: 'Упорядоченная явная применимость к протоколам',
  countries: 'Явно установленные страны выхода',
  status: 'Полнота предметного описания',
  order: 'Редакционный порядок, не дата',
  releasedOn: 'Дата с точностью года/месяца/дня; неизвестно — null',
  name: 'Непустое техническое имя пакета',
  server: 'Сервер соединения: login либо game',
  direction: 'Направление относительно сервера',
  servers: 'Серверы карточки сценария/статьи',
  loginRevisions: 'Известные login revision, отдельно от game revision',
  opcode: 'Типизированные компоненты опкода; null неизвестен, 0 известен',
  states: 'Состояния применимости опкода',
  url: 'Точный HTTP(S)-URL источника',
  id: 'UUID, неизменяемая идентичность',
  code: 'Устойчивый код из адреса',
  key: 'Полный публичный адрес',
  type: 'Зарегистрированный тип записи',
  rev: 'Технический номер редакции',
  number: 'Реальный игровой номер протокола',
  variant: 'Различитель несовместимых профилей одного номера',
  translations: 'Все собственные переводы',
  release: 'Неизменяемый владелец регионального контекста из адреса',
  matchUrl: 'Точный текущий URL для выбора источника',
  matchHost: 'Точное имя хоста для удаления источников',
  allMatches: 'Явный охват нескольких совпадений',
  text: 'Точный непустой текст открытого вопроса',
  relation: 'Имя собственного исходящего отношения',
  targets: 'Полные адреса целей отношения',
  replace: 'Явное разрешение замены',
  unscoped: 'Явная нерегиональная связь релиза с протоколом',
  before: 'Опорный адрес для позиции перед целью',
  after: 'Опорный адрес для позиции после цели',
  all: 'Все связи указанного вида одного владельца',
  cascadeOwned: 'Явное удаление принадлежащих редакций',
  allowBrokenLinks: 'Явное сохранение новых неразрешённых Markdown-ссылок',
  packetKey: 'Неизменяемый владелец редакции пакета из адреса',
  scenarioKey: 'Неизменяемый владелец редакции сценария из адреса',
  articleKey: 'Неизменяемый владелец редакции статьи из адреса'
}

/**
 * Семантика текстового поля, независимая от SQL-имени и канала передачи.
 */
type TextFieldDefinition = {
  /** Формат буквального содержимого. */
  format: 'plain' | 'markdown'
  /** Владелец значения. */
  scope: 'record' | 'translation'
  /** Доступен ввод из файла/stdin. */
  file: boolean
  /** Доступен буквальный --content. */
  content: boolean
  /** Входит в обычный поиск. */
  search: boolean
}

/** Явный формат, а не эвристика по имени колонки. */
const TEXT_DEFINITIONS: Readonly<Record<string, TextFieldDefinition>> = {
  title: { format: 'plain', scope: 'translation', file: true, content: true, search: true },
  summary: { format: 'plain', scope: 'translation', file: true, content: true, search: true },
  description: { format: 'markdown', scope: 'translation', file: true, content: true, search: true },
  name: { format: 'plain', scope: 'record', file: true, content: true, search: true }
}

/**
 * Возвращает возможности поля из того же реестра, который публикует schema.
 */
export function textFieldDefinition(field: string): TextFieldDefinition {
  return TEXT_DEFINITIONS[field] ?? { format: 'plain', scope: 'record', file: false, content: false, search: false }
}

/**
 * Возвращает обязательное смысловое описание публичного поля.
 */
export function fieldDescription(field: string): string {
  const description = FIELD_DESCRIPTIONS[field]
  if (!description) throw new Error(`Поле ${field} не имеет смыслового описания.`)
  return description
}

/**
 * Убирает значение по умолчанию: отсутствие поля операции не является присваиванием.
 */
function withoutDefault(schema: z.ZodType): z.ZodType {
  if (!(schema instanceof z.ZodDefault)) return schema
  const inner = schema.removeDefault()
  if (!(inner instanceof z.ZodType))
    throw new DatabaseError('INTERNAL_ERROR', 'Реестр CLI должен использовать классические схемы Zod.')
  return withoutDefault(inner)
}

/**
 * Возвращает исполняемую схему только доступных публичных значений данной операции.
 */
export function valueSchema(collection: Collection, operation: string): z.ZodObject {
  if (operation === 'source.add') return sourceSchema.omit({ id: true })
  if (operation === 'source.update') return sourceSchema.omit({ id: true }).partial()
  const shape: Record<string, z.ZodType> = {}
  const schema = RECORD_SCHEMAS[collection]
  if (!operation.startsWith('translation.'))
    for (const [field, fieldSchema] of Object.entries(schema.shape)) {
      if (IMMUTABLE_FIELDS.includes(field) || field === 'translations') continue
      const name = Object.keys(FIELD_NAMES).find((key) => FIELD_NAMES[key] === field) ?? field
      if (operation === 'update' && ['countries', 'protocols'].includes(name)) continue
      shape[name] = fieldSchema
    }
  if ('translations' in schema.shape)
    for (const [field, fieldSchema] of Object.entries(translationSchema.shape)) {
      if (['locale', 'source', 'openQuestions'].includes(field)) continue
      shape[field] = withoutDefault(fieldSchema).optional()
    }
  return z.strictObject(
    operation === 'create'
      ? shape
      : Object.fromEntries(Object.entries(shape).map(([name, field]) => [name, withoutDefault(field).optional()]))
  )
}

/**
 * Возвращает кратность, обязательность и неизменяемость собственных исходящих связей.
 */
export function relationDefinitions(collection: Collection): Record<string, RelationDefinition> {
  const shape = RECORD_SCHEMAS[collection].shape
  return Object.fromEntries(
    Object.entries(FIELD_NAMES)
      .filter(
        ([name, field]) =>
          ['branch', 'saga', 'chronicle', 'release', 'region', 'countries', 'protocols'].includes(name) &&
          field in shape
      )
      .map(([name, field]) => [
        name,
        {
          multiple: ['countries', 'protocols'].includes(name),
          required: !['countries', 'protocols', 'saga', 'region'].includes(name),
          immutable: IMMUTABLE_FIELDS.includes(field)
        }
      ])
  )
}

/**
 * Возвращает уникальные публичные имена полей для чтения и фильтрации.
 */
export function availableFields(collection: Collection): string[] {
  const shape = RECORD_SCHEMAS[collection].shape
  return [
    ...new Set([
      'key',
      'type',
      ...Object.keys(shape).map(
        (field) => Object.keys(FIELD_NAMES).find((name) => FIELD_NAMES[name] === field) ?? field
      ),
      ...('translations' in shape ? TEXT_FIELDS : [])
    ])
  ]
}

/** Предметные операции, разрешённые внутри нового батча. */
export const BATCH_OPERATION_IDS = [
  'create',
  'update',
  'replace',
  'delete',
  'translation.set',
  'translation.delete',
  'link',
  'unlink',
  'source.add',
  'source.update',
  'source.remove',
  'source.clear',
  'question.add',
  'question.remove',
  'question.clear'
] as const

/**
 * Проверяет оболочку батча до чтения файлов и SQL-записи; values проверяет конкретная схема операции.
 */
export function batchInputSchema(): z.ZodObject {
  return z.strictObject({
    formatVersion: z.literal(1),
    operations: z.array(
      z.strictObject({
        op: z.enum(BATCH_OPERATION_IDS),
        key: z.string().refine((key) => {
          address(key)
          return true
        }),
        locale: z.string().optional(),
        values: z.record(z.string(), z.unknown()).default({}),
        files: z.record(z.string(), z.string()).default({}),
        clear: z.array(z.string()).default([]),
        add: z.record(z.string(), z.array(z.unknown())).default({}),
        remove: z.record(z.string(), z.array(z.unknown())).default({}),
        relation: z.string().optional(),
        targets: z.array(z.string()).default([]),
        options: z
          .strictObject({
            replace: z.boolean().optional(),
            unscoped: z.boolean().optional(),
            all: z.boolean().optional(),
            allLocales: z.boolean().optional(),
            allMatches: z.boolean().optional(),
            cascadeOwned: z.boolean().optional(),
            allowBrokenLinks: z.boolean().optional(),
            ifExists: z.enum(['error', 'skip']).optional(),
            before: z.string().optional(),
            after: z.string().optional(),
            id: z.string().optional(),
            matchUrl: z.string().optional(),
            matchHost: z.string().optional()
          })
          .optional()
      })
    )
  })
}
