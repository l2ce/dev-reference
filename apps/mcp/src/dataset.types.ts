import type { Database, DatabaseManifest } from '@l2ce/database'
import type { ReferenceReader } from '@l2ce/core/reference'

/**
 * Настройки источника и локального кеша. dataDir выбирает локальный режим вместо Git.
 */
export interface DatasetOptions {
  /* Локальная папка табличного экспорта для разработки. */
  readonly dataDir?: string
  /* URL или путь Git-репозитория; по умолчанию публичный l2ce/dev-reference. */
  readonly repository?: string
  /* Ветка; при отсутствии используется HEAD удалённого репозитория. */
  readonly branch?: string
  /* Относительная папка экспорта в репозитории. */
  readonly dataPath?: string
  /* Корень принадлежащего MCP кеша. */
  readonly cacheDir?: string
  /* Интервал фоновой проверки в миллисекундах, минимум 100. */
  readonly pollIntervalMs?: number
}
/**
 * Идентичность версии данных, полученная до загрузки папки.
 */
export interface SourceVersion {
  /* Git tree hash папки либо SHA-256 локальных файлов. */
  readonly hash: string
  /* Коммит для закреплённой загрузки; null у локальной папки. */
  readonly commit: string | null
}
/**
 * Источник сначала проверяет содержимое, затем явно материализует выбранную версию.
 */
export interface DatasetSource {
  /* Режим источника для статуса. */
  readonly origin: 'repository' | 'directory'
  /**
   * Проверяет версию, используя предыдущий коммит для исключения лишнего fetch.
   */
  check(previous?: SourceVersion): Promise<SourceVersion>
  /**
   * Загружает выбранную папку и возвращает её абсолютный путь.
   */
  download(version: SourceVersion): Promise<string>
  /**
   * Освобождает принадлежащую экземпляру временную материализацию после завершения запросов.
   */
  close?(): Promise<void>
}
/**
 * Одно полностью проверенное поколение, читаемое только через read-only соединение.
 */
export interface ActiveDataset {
  /* Файл локального поколения. */
  readonly file: string
  /* Соединение без права предметной записи. */
  readonly database: Database
  /* Неизменяемое представление для запросов. */
  readonly reader: ReferenceReader
  /* Метаданные языков и версии схемы. */
  readonly manifest: DatabaseManifest
}
/**
 * Состояние синхронизации, доступное инструментам только на чтение.
 */
export interface DatasetStatus {
  /* Есть ли пригодное для чтения поколение. */
  readonly loaded: boolean
  /* Откуда получены данные. */
  readonly origin: DatasetSource['origin']
  /* Хеш содержимого источника, null до первого успешного импорта. */
  readonly sourceHash: string | null
  /* Закреплённый коммит, null в локальном режиме. */
  readonly sourceCommit: string | null
  /* SHA-256 предметных данных активной SQLite-базы. */
  readonly dataRevision: string | null
  /* Версия SQL-модели, null до загрузки. */
  readonly schemaVersion: number | null
  /* Доступные языки. */
  readonly locales: readonly string[]
  /* Последняя проверка источника в ISO 8601. */
  readonly checkedAt: string | null
  /* Последняя ошибка обновления; старое поколение может оставаться доступным. */
  readonly lastError: string | null
  /* Выполняется ли синхронизация сейчас. */
  readonly updating: boolean
}
