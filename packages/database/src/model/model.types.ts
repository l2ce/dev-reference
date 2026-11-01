import type * as z from 'zod'
import type {
  entitySchemas,
  implementationSchemas,
  recordSchemas,
  manifestSchema,
  localeSchema,
  serverSchema,
  addressSchema,
  translationSchema,
  sourceSchema
} from './schema.js'

/**
 * Язык перевода из расширяемого реестра; предметная идентичность от него не зависит.
 */
export type Locale = z.infer<typeof localeSchema>
/**
 * Вид соединения клиента с сервером.
 */
export type Server = z.infer<typeof serverSchema>
/**
 * Встроенный источник с собственным глобально уникальным UUID; логического key нет.
 */
export type Source = z.infer<typeof sourceSchema>
/**
 * Предметная коллекция API и JSON-экспорта.
 */
export type Collection = keyof typeof recordSchemas
/**
 * Коллекция общих предметных карточек.
 */
export type EntityCollection = keyof typeof entitySchemas
/**
 * Коллекция технических редакций знаний.
 */
export type ImplementationCollection = keyof typeof implementationSchemas
/**
 * Карточка выбранной коллекции.
 */
export type EntityValue<C extends EntityCollection = EntityCollection> = z.infer<(typeof entitySchemas)[C]>
/**
 * Техническая редакция выбранной предметной коллекции.
 */
export type ImplementationValue<C extends ImplementationCollection = ImplementationCollection> = z.infer<
  (typeof implementationSchemas)[C]
>
/**
 * Предметная коллекция числовых ревизий знаний.
 */
export type RevisionCollection = ImplementationCollection
/**
 * Публичное представление ревизии; key вычисляется из владельца и rev, в SQL не хранится.
 */
export type RevisionValue<C extends RevisionCollection = RevisionCollection> = ImplementationValue<C>
/**
 * Документ любой коллекции; тип содержимого сохраняет связь с именем коллекции.
 */
export type RecordValue<C extends Collection = Collection> = z.infer<(typeof recordSchemas)[C]>
/**
 * Версия структуры и упорядоченный реестр языков переводов.
 */
export type DatabaseManifest = z.infer<typeof manifestSchema>
/**
 * Адрес общей записи: коллекция, роль и вычисляемый key. Предметная идентичность — UUID.
 */
export type RecordAddress = z.infer<typeof addressSchema>
/**
 * Общий ключ записи для индексов и диагностики.
 */
export type RecordIdentity = Pick<RecordAddress, 'key'>
/**
 * Адрес документа любой коллекции по постоянному публичному ключу.
 */
export interface DocumentAddress<C extends Collection = Collection> {
  /* Тип предметной сущности. */
  readonly collection: C
  /* Постоянный логический ключ, например packet:key-packet; не зависит от языка. */
  readonly key: string
}
/**
 * Адрес карточки выбранной коллекции.
 */
export type EntityAddress<C extends EntityCollection = EntityCollection> = DocumentAddress<C>
/**
 * Адрес имплементации по её собственному постоянному публичному ключу.
 */
export type ImplementationAddress<C extends ImplementationCollection = ImplementationCollection> = DocumentAddress<C>
/**
 * Карточка, тип значения которой определяется коллекцией.
 */
export type EntityEntry = {
  [C in EntityCollection]: EntityAddress<C> & {
    /* Явная роль карточки, независимая от имени файла. */
    readonly kind: 'entity'
    /* Предметное содержимое карточки. */
    readonly value: EntityValue<C>
  }
}[EntityCollection]
/**
 * Техническая редакция со своим ключом и явной ссылкой на карточку внутри value.
 */
export type ImplementationEntry = {
  [C in ImplementationCollection]: ImplementationAddress<C> & {
    /* Явная роль имплементации. */
    readonly kind: 'implementation'
    /* Предметное содержимое имплементации. */
    readonly value: ImplementationValue<C>
  }
}[ImplementationCollection]
/**
 * Переносимая запись карточки либо имплементации.
 */
export type DatabaseEntry = EntityEntry | ImplementationEntry
/**
 * Полный согласованный снимок общей предметной базы и её переводов.
 */
export interface DatabaseSnapshot extends DatabaseManifest {
  /* Все записи; key и UUID уникальны независимо от языка. */
  readonly entries: readonly DatabaseEntry[]
}
/**
 * Индекс общих записей по key; создаётся функцией indexEntries.
 */
export type EntryIndex = ReadonlyMap<string, DatabaseEntry>
/**
 * Локализованный Markdown и собственные источники предметной записи.
 */
export type Translation = z.infer<typeof translationSchema>
/**
 * Расположение файла для прогресса и диагностики; не является идентичностью сущности.
 */
export interface FileAddress {
  /* Язык прежнего формата; у общих предметных записей отсутствует. */
  readonly locale?: Locale
  /* Коллекция для группировки прогресса. */
  readonly collection: Collection
  /* Относительный путь от корня JSON-снимка. */
  readonly path: string
}
