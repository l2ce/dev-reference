import type { SQL, InferSelectModel } from 'drizzle-orm'
import type * as tables from './schema.js'
import type { Collection, ImplementationCollection, EntityValue, RevisionValue } from '../model/model.types.js'

/**
 * Таблицы предметных коллекций; тип колонок сохраняется при выборе конкретной коллекции.
 */
export interface RecordTables {
  /** Исторические группы хроник. */
  readonly sagas: typeof tables.sagas
  /** Регионы распространения, не языки и не страны. */
  readonly regions: typeof tables.regions
  /** Страны с независимыми связями распространения. */
  readonly countries: typeof tables.countries
  /** Региональные контексты выпусков с собственными источниками. */
  readonly 'release-contexts': typeof tables.releaseContexts
  /* Ветки игры. */
  readonly branches: typeof tables.branches
  /* Хроники. */
  readonly chronicles: typeof tables.chronicles
  /* Самостоятельные выпуски. */
  readonly releases: typeof tables.releases
  /* Профили сетевого обмена. */
  readonly protocols: typeof tables.protocols
  /* Логические пакеты. */
  readonly packets: typeof tables.packets
  /* Логические сценарии. */
  readonly scenarios: typeof tables.scenarios
  /* Логические статьи. */
  readonly articles: typeof tables.articles
  /* Технические редакции пакетов. */
  readonly 'packet-revisions': typeof tables.packetRevisions
  /* Технические редакции сценариев. */
  readonly 'scenario-revisions': typeof tables.scenarioRevisions
  /* Технические редакции статей. */
  readonly 'article-revisions': typeof tables.articleRevisions
}

/**
 * Объединение предметных таблиц с общим типизированным UUID.
 */
export type RecordTable = RecordTables[Collection]
/**
 * Строка предметной таблицы после декодирования колонок средствами Drizzle.
 */
export type RecordRow = {
  [C in Collection]: InferSelectModel<RecordTables[C]>
}[Collection]
/**
 * Предметные поля строки без внутренних FK; вариант строки сохраняется в объединении.
 */
export type RecordFields = {
  [C in Collection]: Omit<
    InferSelectModel<RecordTables[C]>,
    'ownerId' | 'branchId' | 'sagaId' | 'chronicleId' | 'releaseId' | 'regionId'
  >
}[Collection]
/**
 * Карта читаемых ключей на постоянные UUID одного атомарного пакета.
 */
export type InternalIdentities = ReadonlyMap<string, string>
/**
 * Все таблицы переводов имеют одинаковые свойства Drizzle; физический FK задаётся декларацией.
 */
export type TranslationTable = typeof tables.branchTranslations
/**
 * Согласованное соответствие коллекции, роли и точной таблицы.
 */
export type StorageLayout = {
  [C in Collection]: {
    /* Предметная коллекция API. */
    readonly collection: C
    /* Тип записи, согласованный с коллекцией. */
    readonly kind: C extends ImplementationCollection ? 'implementation' : 'entity'
    /* Типизированная таблица выбранной коллекции. */
    readonly table: RecordTables[C]
    /* Собственные переводы, если предусмотрены для этой коллекции. */
    readonly translations?: TranslationTable
  }
}[Collection]
/**
 * Дочерние таблицы технических редакций с типизированными колонками.
 */
export interface ImplementationStorage {
  /* Коллекция редакций. */
  readonly collection: ImplementationCollection
  /* Таблица редакций с общим контрактом ownerId/rev/status. */
  readonly implementations: typeof tables.packetRevisions
  /* Предметное имя ссылки API на владельца. */
  readonly ownerField: 'packetKey' | 'scenarioKey' | 'articleKey'
  /* Таблица карточки-владельца. */
  readonly owners: typeof tables.packets | typeof tables.scenarios | typeof tables.articles
  /* Прямая применимость редакции к протоколам. */
  readonly protocols: typeof tables.packetProtocols
}
/**
 * Поля, собираемые из типизированных предметных связей, без универсальных SQL-строк.
 */
export type StoredRelations = Partial<
  Pick<EntityValue<'protocols'>, 'loginRevisions'> &
    Pick<EntityValue<'release-contexts'>, 'countryKeys'> &
    Pick<EntityValue<'scenarios'>, 'servers'> &
    Pick<RevisionValue<'packet-revisions'>, 'packetKey' | 'protocolKeys' | 'opcode' | 'states'> &
    Pick<RevisionValue<'scenario-revisions'>, 'scenarioKey'> &
    Pick<RevisionValue<'article-revisions'>, 'articleKey'>
>
/**
 * Параметризованный предикат Drizzle; отдельного массива SQL-параметров нет.
 */
export type RecordPredicate = SQL | undefined
