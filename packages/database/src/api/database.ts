import { DatabaseError } from '../errors.js'
import { defaultDatabasePath } from '../paths.js'
import { snapshotRevision } from '../model/revision.js'
import { validateSnapshot } from '../model/validation.js'
import { connect } from '../sqlite/connection.js'
import { prepareDatabase } from '../sqlite/bootstrap.js'
import { readEntity, readManifest, readSnapshot, readImplementation, listRecords } from '../sqlite/records.js'
import { restoreSnapshot } from '../sqlite/persistence.js'
import { sqliteMessages as messages } from '../sqlite/messages.js'
import { writeChanges } from './mutation.js'
import type {
  Collection,
  EntityCollection,
  DatabaseEntry,
  DatabaseManifest,
  DatabaseSnapshot,
  EntityAddress,
  EntityValue,
  RecordAddress,
  ImplementationAddress,
  ImplementationValue,
  ImplementationCollection
} from '../model/model.types.js'
import type { Connection } from '../sqlite/sqlite.types.js'
import type {
  Database,
  DatabaseOperation,
  RecordPage,
  ListQuery,
  OpenDatabaseOptions,
  RecordWritten,
  UpdateInput,
  WriteOptions,
  WriteResult
} from './database.types.js'

/**
 * Реализация публичного API; детали соединения не экспортируются потребителям.
 */
class DatabaseHandle implements Database {
  /* Единственное соединение, принадлежащее экземпляру. */
  private readonly connection: Connection
  /* Абсолютный путь файла SQLite. */
  readonly path: string

  /**
   * Принимает уже открытое и проверенное соединение во владение.
   */
  constructor(connection: Connection) {
    this.connection = connection
    this.path = connection.path
  }

  /**
   * Проверяет срок жизни соединения и право на запись.
   */
  private assertOpen(write = false): void {
    if (!this.connection.client.open) {
      throw new DatabaseError('DATABASE_CLOSED', messages.closed)
    }
    if (write && this.connection.readOnly) {
      throw new DatabaseError('READ_ONLY', messages.readOnly)
    }
  }

  /**
   * Возвращает манифест или null до первого наполнения базы.
   */
  manifest(): DatabaseManifest | null {
    this.assertOpen()
    return this.connection.client.transaction(() => readManifest(this.connection))()
  }

  /**
   * Читает одну общую карточку с её собственными переводами без загрузки остальных записей.
   */
  get<C extends EntityCollection>(target: EntityAddress<C>): EntityValue<C> | undefined {
    this.assertOpen()
    return this.connection.client.transaction(() => readEntity(this.connection, target))()
  }

  /**
   * Читает одну техническую редакцию с применимостью и всеми имеющимися переводами.
   */
  getImplementation<C extends ImplementationCollection>(
    target: ImplementationAddress<C>
  ): ImplementationValue<C> | undefined {
    this.assertOpen()
    return this.connection.client.transaction(() => readImplementation(this.connection, target))()
  }

  /**
   * Читает ревизию знаний в одном снимке; getImplementation сохраняет техническую совместимость API.
   */
  getRevision<C extends ImplementationCollection>(
    target: ImplementationAddress<C>
  ): ImplementationValue<C> | undefined {
    return this.getImplementation(target)
  }

  /**
   * Возвращает ограниченную SQL-страницу и согласованный COUNT.
   */
  list<C extends Collection>(query: ListQuery<C>): RecordPage<C> {
    this.assertOpen()
    return listRecords(this.connection, query)
  }

  /**
   * Загружает полный многоязычный снимок одной читающей транзакцией.
   */
  snapshot(): DatabaseSnapshot {
    this.assertOpen()
    return this.connection.client.transaction(() => readSnapshot(this.connection))()
  }

  /**
   * Вычисляет ревизию всей базы из согласованного снимка.
   */
  revision(): string {
    return snapshotRevision(this.snapshot())
  }

  /**
   * Проверяет полный снимок до транзакции и атомарно заменяет содержимое базы.
   * Исключение callback до COMMIT откатывает импорт; сам callback не должен менять базу.
   */
  replaceSnapshot(input: DatabaseSnapshot, onRecord?: RecordWritten, onRecordStart?: RecordWritten): void {
    this.assertOpen(true)
    const snapshot = validateSnapshot(input)
    restoreSnapshot(this.connection, snapshot, onRecord, onRecordStart)
  }

  /**
   * Атомарно изменяет базу с проверкой конечных связей и ожидаемой общей ревизии.
   */
  applyChanges(operations: readonly DatabaseOperation[], options?: WriteOptions): WriteResult {
    this.assertOpen(true)
    return writeChanges(this.connection, operations, options)
  }

  /**
   * Создаёт отсутствующую запись в проверенном пакете из одного изменения.
   */
  create(entry: DatabaseEntry, options?: WriteOptions): WriteResult {
    return this.applyChanges([{ op: 'create', entry }], options)
  }

  /**
   * Полностью заменяет или создаёт одну запись.
   */
  put(entry: DatabaseEntry, options?: WriteOptions): WriteResult {
    return this.applyChanges([{ op: 'put', entry }], options)
  }

  /**
   * Заменяет переданные поля; окончательное значение проверяет схема коллекции.
   */
  update(operation: UpdateInput, options?: WriteOptions): WriteResult {
    return this.applyChanges([{ ...operation, op: 'update' }], options)
  }

  /**
   * Удаляет запись; удаление карточки также удаляет принадлежащие ей имплементации.
   */
  delete(target: RecordAddress, options?: WriteOptions): WriteResult {
    return this.applyChanges([{ op: 'delete', target }], options)
  }

  /**
   * Закрывает принадлежащее экземпляру соединение; повторный вызов безопасен.
   */
  close(): void {
    if (this.connection.client.open) {
      this.connection.client.close()
    }
  }
}

/**
 * Открывает текущую базу или создаёт пустую при обычном открытии отсутствующего файла.
 * Read-only не создаёт файлов. Несовместимая схема требует явного импорта из JSON.
 */
export function openDatabase(options: OpenDatabaseOptions = {}): Database {
  const connection = connect({
    path: options.database ?? defaultDatabasePath,
    readOnly: options.readOnly,
    create: !options.readOnly
  })
  try {
    prepareDatabase(connection)
    return new DatabaseHandle(connection)
  } catch (error) {
    connection.client.close()
    throw error
  }
}
