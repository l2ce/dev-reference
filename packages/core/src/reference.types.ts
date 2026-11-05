import type * as z from 'zod'
import type { Source, Translation, RevisionValue, EntityValue } from '@l2ce/database'
import type {
  referenceProtocolsSchema,
  referenceKnowledgeSchema,
  referenceReadSchema,
  referenceCatalogSchema,
  referenceKindSchema
} from './reference-schema.js'

/**
 * Вид логического знания.
 */
export type ReferenceKind = z.infer<typeof referenceKindSchema>
/**
 * Вход каталога протоколов; пагинация получает значения по умолчанию в схеме.
 */
export type ReferenceProtocolsQuery = z.input<typeof referenceProtocolsSchema>
/**
 * Вход поиска и списка знаний в выбранном протоколе.
 */
export type ReferenceKnowledgeQuery = z.input<typeof referenceKnowledgeSchema>
/**
 * Множественное чтение в одном протоколе и языке.
 */
export type ReferenceReadQuery = z.input<typeof referenceReadSchema>
/**
 * Вход вспомогательного каталога игры.
 */
export type ReferenceCatalogQuery = z.input<typeof referenceCatalogSchema>
/**
 * Языковое представление записи каталога без подстановки другого перевода.
 */
export interface ReferenceCatalogItem {
  /** Явный редакционный порядок; null не подменяется датой или номером. */
  readonly order?: number | null
  /** Выпуск-владелец регионального контекста. */
  readonly releaseKey?: string
  /** Установленный регион; null означает неизвестность. */
  readonly regionKey?: string | null
  /** Дата выхода с точностью года, месяца или дня. */
  readonly releasedOn?: string | null
  /** Страны, явно указанные для этого контекста. */
  readonly countryKeys?: readonly string[]
  /** Связи выпуска, для которых регион пока не установлен. */
  readonly unscopedProtocolKeys?: readonly string[]
  /* Постоянный читаемый адрес записи. */
  readonly key: string
  /* Запрошенный язык. */
  readonly locale: string
  /* Переведённое название либо технический адрес при отсутствии перевода. */
  readonly title: string
  /* Аннотация нужного языка либо null. */
  readonly summary: string | null
  /* Исходный Markdown нужного языка либо null. */
  readonly markdown: string | null
  /* Состояние нужного перевода либо missing при его отсутствии. */
  readonly translationStatus: Translation['translationStatus']
  /* Источники выбранного перевода. */
  readonly sources: readonly Source[]
  /* Реальный игровой номер только у протокола. */
  readonly number?: number
  /* Различитель одинаковых номеров только у протокола. */
  readonly variant?: number
  /* Полнота профиля или выпуска; у ветки и хроники не задаётся. */
  readonly status?: EntityValue<'protocols'>['status']
  /* Владелец хроники, если применимо. */
  readonly branchKey?: string
  /* Владелец выпуска, если применимо. */
  readonly chronicleKey?: string
  /* Протоколы выпуска, если применимо. */
  readonly protocolKeys?: readonly string[]
}
/**
 * Краткая карточка каталога; Markdown и источники читаются после выбора записи.
 */
export type ReferenceCatalogSummary = Omit<ReferenceCatalogItem, 'markdown' | 'sources'>
/**
 * Читаемый документ конкретного профиля; отсутствие знаний и перевода явно различается.
 */
export interface ReferenceDocument {
  /* Логический адрес пакета, сценария или статьи. */
  readonly key: string
  /* Вид знания. */
  readonly kind: ReferenceKind
  /* Точный профиль, включая наш суффикс при наличии. */
  readonly protocol: string
  /* Запрошенный язык. */
  readonly locale: string
  /* Адрес выбранной технической редакции, null при отсутствии применимости. */
  readonly revisionKey: string | null
  /* Различает отсутствие карточки, применимости и перевода. */
  readonly availability: 'available' | 'not-found' | 'unmapped' | 'translation-missing'
  /* Название на выбранном языке либо техническое имя. */
  readonly title: string
  /* Аннотация выбранного перевода либо null. */
  readonly summary: string | null
  /* Исходный Markdown; null при отсутствии перевода. */
  readonly markdown: string | null
  /* Полнота технической редакции, null без редакции. */
  readonly status: RevisionValue['status'] | null
  /* Состояние перевода. */
  readonly translationStatus: Translation['translationStatus']
  /* Источники выбранного перевода. */
  readonly sources: readonly Source[]
  /* Открытые вопросы выбранного перевода. */
  readonly openQuestions: readonly string[]
  /* Серверы, к которым относится карточка. */
  readonly servers: readonly ('login' | 'game')[]
  /* Направление пакета; у остальных материалов null. */
  readonly direction: EntityValue<'packets'>['direction'] | null
  /* Известный опкод пакета; null для неизвестного опкода и остальных видов. */
  readonly opcode: RevisionValue<'packet-revisions'>['opcode']
  /* Установленные состояния применения пакета; пустой список означает отсутствие известного ограничения. */
  readonly states: readonly string[]
}
/**
 * Краткий результат поиска; полный Markdown читается отдельным запросом.
 */
export type ReferenceSummary = Omit<ReferenceDocument, 'markdown' | 'sources' | 'openQuestions'>
/**
 * Страница из одного неизменяемого снимка.
 */
export interface ReferencePage<T> {
  /* SHA-256 общего предметного снимка. */
  readonly revision: string
  /* Совпадения текущей страницы. */
  readonly items: readonly T[]
  /* Число совпадений до пагинации. */
  readonly total: number
  /* Следующее смещение либо null в конце списка. */
  readonly nextOffset: number | null
}
/**
 * Полное представление выбранного протокола и его исторического контекста.
 */
export interface ReferenceProtocol {
  /** Контексты использования с собственными регионами, датами и источниками. */
  readonly contexts: readonly ReferenceCatalogItem[]
  /* Общая ревизия основания чтения. */
  readonly revision: string
  /* Переведённая карточка протокола. */
  readonly profile: ReferenceCatalogItem
  /* Все связанные выпуски. */
  readonly releases: readonly ReferenceCatalogItem[]
  /* Справочные регионы. */
  readonly regions: readonly string[]
  /* Независимые Login-номера. */
  readonly loginRevisions: readonly number[]
}
/**
 * Результат множественного чтения, сохраняющий порядок запросов.
 */
export interface ReferenceReadResult {
  /* Общая ревизия основания чтения. */
  readonly revision: string
  /* Документы либо явные пробелы для каждого входного ключа. */
  readonly items: readonly ReferenceDocument[]
}
