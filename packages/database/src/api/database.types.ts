import type {
  Collection,
  EntityCollection,
  RecordValue,
  DatabaseEntry,
  DatabaseManifest,
  DatabaseSnapshot,
  EntityAddress,
  EntityValue,
  RecordAddress,
  ImplementationAddress,
  ImplementationValue,
  ImplementationCollection,
  Server
} from '../model/model.types.js'

/**
 * Параметры открытия базы; обычное открытие создаёт отсутствующий файл с текущей схемой.
 */
export interface OpenDatabaseOptions {
  /* SQLite-файл; по умолчанию .local/database.sqlite пакета. */
  readonly database?: string
  /* Запрет записи на уровне SQLite, по умолчанию false. */
  readonly readOnly?: boolean
}
/**
 * Параметры SQL-страницы общих карточек или редакций одной коллекции.
 */
export interface ListQuery<C extends Collection = Collection> {
  /* Коллекция, определяющая тип items. */
  readonly collection: C
  /* Подстрока вычисляемого ключа, code, названия или аннотации без учёта регистра Unicode. */
  readonly search?: string
  /* Только chronicles: ключ ветки. */
  readonly branchKey?: string
  /* Выпуски и ревизии: вычисляемый ключ карточки-владельца. */
  readonly ownerKey?: string
  /* Карточки знаний и редакции: точная применимость к выбранному протоколу. */
  readonly protocolKey?: string
  /* Только protocols: ключ выпуска хроники, определяющего список профилей. */
  readonly chronicleReleaseKey?: string
  /** Регион только для release-contexts; не фильтрует язык перевода. */
  readonly regionKey?: string
  /* Пакеты, сценарии, статьи и их имплементации: принадлежность к Login или Game. */
  readonly server?: Server
  /* Пакеты и их имплементации: отправитель относительно сервера, независимо от server. */
  readonly direction?: EntityValue<'packets'>['direction']
  /* Размер страницы 1–1000, по умолчанию 50. */
  readonly limit?: number
  /* Смещение в сортировке по публичному ключу, по умолчанию 0. */
  readonly offset?: number
}
/**
 * Страница и число совпадений из одной SQL-транзакции.
 */
export interface RecordPage<C extends Collection> {
  /* Записи только запрошенной страницы, в порядке публичных ключей. */
  readonly items: readonly RecordValue<C>[]
  /* Общее число совпадений фильтра до LIMIT. */
  readonly total: number
}
/**
 * Частичное обновление одной записи; переданные поля заменяются целиком, включая массивы.
 */
export type UpdateOperation =
  | {
      [C in EntityCollection]: {
        /* Частичное изменение карточки. */
        readonly op: 'update'
        /* Постоянный публичный ключ и явная роль карточки. */
        readonly target: EntityAddress<C> & { readonly kind: 'entity' }
        /* Изменяемое содержание карточки без UUID и составляющих вычисляемого адреса. */
        readonly patch: Partial<
          Omit<EntityValue<C>, 'id' | 'key' | 'code' | 'number' | 'variant' | 'rev' | 'chronicleKey' | 'releaseKey'>
        >
      }
    }[EntityCollection]
  | {
      [C in ImplementationCollection]: {
        /* Частичное изменение имплементации. */
        readonly op: 'update'
        /* Собственный постоянный публичный ключ имплементации. */
        readonly target: ImplementationAddress<C> & {
          readonly kind: 'implementation'
        }
        /* Изменяемое содержание ревизии без идентичности, владельца и числового rev. */
        readonly patch: Partial<
          Omit<ImplementationValue<C>, 'id' | 'key' | 'rev' | 'packetKey' | 'scenarioKey' | 'articleKey'>
        >
      }
    }[ImplementationCollection]
/**
 * Типизированный ввод update без служебного поля op; корреляция коллекции и patch сохраняется.
 */
export type UpdateInput = UpdateOperation extends infer Operation
  ? Operation extends UpdateOperation
    ? Omit<Operation, 'op'>
    : never
  : never
/**
 * Элемент атомарного пакета: создание, полная замена, частичное изменение или удаление.
 */
export type DatabaseOperation =
  | {
      /* create требует отсутствия адреса; put создаёт или заменяет. */
      readonly op: 'create' | 'put'
      /* Полная запись выбранной коллекции. */
      readonly entry: DatabaseEntry
    }
  | UpdateOperation
  | {
      /* Удаление карточки удаляет также все её имплементации. */
      readonly op: 'delete'
      /* Полный адрес удаляемой записи. */
      readonly target: RecordAddress
    }
/**
 * Оптимистическая проверка всей общей базы перед изменениями.
 */
export interface WriteOptions {
  /* Ожидаемый SHA-256 полного снимка; проверяется даже для no-op. */
  readonly ifRevision?: string
  /* Проверить пакет и вычислить результат без сохранения строк. */
  readonly dryRun?: boolean
}
/**
 * Результат атомарного пакета; changed включает автоматически удалённые имплементации.
 */
export interface WriteResult {
  /* Число созданных, изменённых или удалённых адресов. */
  readonly changed: number
  /* Новая ревизия полного многоязычного снимка. */
  readonly revision: string
}
/**
 * Уведомление о записанной внутри транзакции строке; не является подтверждением COMMIT.
 */
export type RecordWritten = (entry: DatabaseEntry, completed: number, total: number) => void
/**
 * Публичный синхронный API SQLite; владелец обязан вызвать close().
 * Массовая проверка загружает общий снимок; get/list выполняются SQL-запросами.
 */
export interface Database {
  /* Абсолютный путь рабочего SQLite-файла. */
  readonly path: string
  /**
   * Возвращает манифест; null означает созданную, но ещё не наполненную базу.
   */
  manifest(): DatabaseManifest | null
  /**
   * Читает карточку выбранной коллекции по публичному ключу; отсутствие даёт undefined.
   */
  get<C extends EntityCollection>(target: EntityAddress<C>): EntityValue<C> | undefined
  /**
   * Читает имплементацию по её собственному постоянному публичному ключу.
   */
  getImplementation<C extends ImplementationCollection>(
    target: ImplementationAddress<C>
  ): ImplementationValue<C> | undefined
  /**
   * Читает ревизию знаний по адресу, вычисляемому из владельца и числового rev.
   */
  getRevision<C extends ImplementationCollection>(target: ImplementationAddress<C>): ImplementationValue<C> | undefined
  /**
   * Возвращает SQL-страницу с согласованным числом совпадений.
   */
  list<C extends Collection>(query: ListQuery<C>): RecordPage<C>
  /**
   * Читает согласованный полный снимок общих записей и всех переводов.
   */
  snapshot(): DatabaseSnapshot
  /**
   * Возвращает семантическую ревизию всей базы, включая переводы.
   */
  revision(): string
  /**
   * Проверяет и целиком заменяет базу одной транзакцией; callbacks вызываются до COMMIT.
   * onRecordStart сообщает адрес перед записью строки и число ранее записанных строк.
   */
  replaceSnapshot(snapshot: DatabaseSnapshot, onRecord?: RecordWritten, onRecordStart?: RecordWritten): void
  /**
   * Проверяет конечное состояние всего пакета и атомарно сохраняет общий снимок.
   */
  applyChanges(operations: readonly DatabaseOperation[], options?: WriteOptions): WriteResult
  /**
   * Создаёт отсутствующую запись с полной проверкой конечного предметного графа.
   */
  create(entry: DatabaseEntry, options?: WriteOptions): WriteResult
  /**
   * Создаёт или полностью заменяет запись с проверкой конечного предметного графа.
   */
  put(entry: DatabaseEntry, options?: WriteOptions): WriteResult
  /**
   * Заменяет переданные поля записи; вложенные объекты и массивы не объединяются.
   */
  update(operation: UpdateInput, options?: WriteOptions): WriteResult
  /**
   * Удаляет запись; удаление карточки каскадно удаляет имплементации после проверки ссылок.
   */
  delete(target: RecordAddress, options?: WriteOptions): WriteResult
  /**
   * Освобождает соединение; повторное закрытие допустимо.
   */
  close(): void
}
