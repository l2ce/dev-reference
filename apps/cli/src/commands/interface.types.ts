import * as z from 'zod'
import type { Collection, DatabaseSnapshot } from '@l2ce/database'

/** Аргументы текстового интерфейса; неизвестные опции отклоняет Commander. */
export const interfaceOptionsSchema = z.object({
  database: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
  format: z.enum(['text', 'json']).default('text'),
  brief: z.boolean().default(false),
  view: z.enum(['brief', 'full', 'edit']).optional(),
  content: z.string().min(1).optional(),
  fields: z.string().min(1).optional(),
  allLocales: z.boolean().default(false),
  withVersion: z.boolean().default(false),
  ifVersion: z.string().min(1).optional(),
  dryRun: z.boolean().default(false),
  diff: z.enum(['summary', 'full']).optional(),
  input: z.string().min(1).optional(),
  color: z.enum(['auto', 'always', 'never']).default('auto'),
  verbose: z.boolean().default(false),
  type: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  after: z.string().min(1).optional(),
  before: z.string().min(1).optional(),
  all: z.boolean().default(false),
  sort: z.string().min(1).optional(),
  saveSelection: z.string().min(1).optional(),
  selection: z.string().min(1).optional(),
  keysFile: z.string().min(1).optional(),
  protocol: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  saga: z.string().min(1).optional(),
  chronicle: z.string().min(1).optional(),
  release: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  server: z.enum(['login', 'game']).optional(),
  direction: z.enum(['client-to-server', 'server-to-client']).optional(),
  status: z.enum(['missing', 'partial', 'documented']).optional(),
  translationStatus: z.enum(['ready', 'missing', 'outdated']).optional(),
  has: z.array(z.string()).default([]),
  missing: z.array(z.string()).default([]),
  sourceUrl: z.string().min(1).optional(),
  sourceHost: z.string().min(1).optional(),
  searchIn: z.string().min(1).optional(),
  match: z.enum(['contains', 'exact', 'prefix']).default('contains'),
  set: z.array(z.string()).default([]),
  add: z.array(z.string()).default([]),
  remove: z.array(z.string()).default([]),
  clear: z.array(z.string()).default([]),
  setFile: z.array(z.string()).default([]),
  setStdin: z.string().min(1).optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(),
  opcode: z.string().optional(),
  order: z.string().optional(),
  releasedOn: z.string().optional(),
  ifExists: z.enum(['error', 'skip']).default('error'),
  replace: z.boolean().default(false),
  unscoped: z.boolean().default(false),
  cascadeOwned: z.boolean().default(false),
  allowBrokenLinks: z.boolean().default(false),
  allowMissing: z.boolean().default(false),
  rev: z.number().int().positive().optional(),
  from: z.string().min(1).optional(),
  url: z.string().optional(),
  id: z.string().min(1).optional(),
  matchUrl: z.string().min(1).optional(),
  matchHost: z.string().min(1).optional(),
  allMatches: z.boolean().default(false),
  text: z.string().optional(),
  by: z.string().min(1).optional(),
  depth: z.number().int().nonnegative().optional(),
  in: z.boolean().default(false),
  out: z.boolean().default(false),
  relation: z.string().min(1).optional(),
  locales: z.string().min(1).optional(),
  defaultLocale: z.string().min(1).optional(),
  links: z.boolean().default(false),
  strictLinks: z.boolean().default(false),
  output: z.string().min(1).optional()
})

/**
 * Проверенные опции единого интерфейса.
 */
export type InterfaceOptions = z.infer<typeof interfaceOptionsSchema>

/**
 * Выбранная запись и диагностируемая доступность её языка/применимости.
 */
export type ReadItem = {
  /** Запрошенный адрес. */
  key: string
  /** Предметная коллекция. */
  type: Collection
  /** Доступность, не смешиваемая с полнотой знания. */
  availability: 'available' | 'not-found' | 'unmapped' | 'translation-missing'
  /** Явно выбранная редакция. */
  revisionKey?: string
  /** Собственные данные выбранного представления. */
  record?: Record<string, unknown>
  /** Доступные технические редакции карточки. */
  revisions?: string[]
  /** Совпадения поиска с языком и именем поля. */
  matches?: SearchMatch[]
  /** Безопасные команды уточнения недоступности без подстановки чужих данных. */
  nextSteps?: string[]
}

/**
 * Конкретное совпадение поиска, не заменяющее полного чтения документа.
 */
export type SearchMatch = {
  /** Публичное поле совпадения. */
  field: string
  /** Язык текста, если совпадение локализовано. */
  locale?: string
  /** Явно краткий фрагмент поискового результата. */
  fragment: string
}

/**
 * Системный результат, позволяющий отделить буквальный текст от оформления.
 */
export type InterfaceResult = {
  /** Предметные данные. */
  data: unknown
  /** Метаданные операции. */
  meta: Record<string, unknown>
  /** Готовый текст, не изменяющий предметные данные JSON. */
  text: string
  /** Код неполного обработанного чтения. */
  exitCode?: number
  /** Диагностики, не принадлежащие содержимому stdout. */
  diagnostics?: string
}

/**
 * Операция публичного батча после чтения текстовых файлов.
 */
export type EditOperation = {
  /** Имя предметной операции. */
  op: string
  /** Один полный адрес владельца. */
  key: string
  /** Язык конкретного изменения. */
  locale?: string
  /** Значения полей, не внутренний patch базы. */
  values: Record<string, unknown>
  /** Очистка полей согласно их типу. */
  clear: string[]
  /** Добавления скалярных списков. */
  add: Record<string, unknown[]>
  /** Удаления скалярных списков. */
  remove: Record<string, unknown[]>
  /** Имена связей и другие проверенные параметры действия. */
  options: InterfaceOptions
  /** Явные цели отношения. */
  targets: string[]
  /** Имя отношения. */
  relation?: string
}

/**
 * Изменение поля, используемое одним планом предпросмотра и записи.
 */
export type FieldChange = {
  /** Публичный путь поля. */
  field: string
  /** Предыдущее значение; отсутствие передаётся отдельно от null. */
  before?: unknown
  /** Новое значение. */
  after?: unknown
  /** Явное сокращение длинного документа в summary без скрытого полного тела в JSON. */
  textSummary?: {
    /** Число строк прежнего документа. */
    beforeLines: number
    /** Число строк нового документа. */
    afterLines: number
  }
}

/**
 * Предметный diff одной записи.
 */
export type EntryChange = {
  /** Полный адрес записи. */
  key: string
  /** Вид изменения. */
  action: 'created' | 'updated' | 'deleted'
  /** Название без языкового fallback. */
  title: string
  /** Изменённые поля. */
  fields: FieldChange[]
  /** Все протоколы переиспользуемой редакции. */
  protocols: readonly string[]
}

/**
 * Полное состояние страницы; доступность записей описывается отдельно.
 */
export type PageInfo = {
  /** Сквозная позиция первой записи либо 0 у пустой страницы. */
  start: number
  /** Сквозная позиция последней записи. */
  end: number
  /** Число целых возвращённых записей. */
  returned: number
  /** Размер полного исходного набора. */
  total: number
  /** Число ещё не показанных записей. */
  remaining: number
  /** Наличие следующей страницы, не полнота исследования. */
  hasMore: boolean
  /** Токен продолжения того же запроса и поколения. */
  nextCursor: string | null
}

/**
 * Выбранная страница произвольного набора.
 */
export type QueryPage<T> = {
  /** Целые записи страницы. */
  items: T[]
  /** Метаданные границ и остатка. */
  page: PageInfo
  /** Курсор для построения копируемой команды. */
  continuation: string | null
}

/**
 * Проверенный конечный план без побочных эффектов записи.
 */
export type EditPlan = {
  /** Полное конечное состояние, пригодное для предметного API. */
  snapshot: DatabaseSnapshot
  /** Явно пропущенные существующие адреса. */
  skipped: string[]
  /** Предупреждения о неразрешённых ссылках. */
  warnings: unknown[]
  /** Адреса без итоговых изменений. */
  noops: string[]
}

/**
 * Возможности одной собственной предметной связи.
 */
export type RelationDefinition = {
  /** Множественная упорядоченная связь. */
  multiple: boolean
  /** Нельзя оставить запись без цели. */
  required: boolean
  /** Владелец входит в адрес и не меняется через link. */
  immutable: boolean
}
