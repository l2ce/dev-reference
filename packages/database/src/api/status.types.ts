import type { DatabaseManifest } from '../model/model.types.js'
import type { SchemaStatus } from '../sqlite/sqlite.types.js'

/**
 * Выбор SQLite-файла для диагностики без его создания.
 */
export interface DatabaseStatusOptions {
  /* SQLite-файл; отсутствие использует путь пакета по умолчанию. */
  readonly database?: string
}

/**
 * Диагностика файла без скрытого создания или пересоздания.
 */
export interface DatabaseStatus {
  /* Абсолютный путь файла SQLite. */
  readonly database: string
  /* Существует ли файл на диске. */
  readonly exists: boolean
  /* Наличие структуры и её соответствие актуальной схеме пакета. */
  readonly schema: SchemaStatus | 'missing'
  /* Манифест наполненной базы; null до импорта или обновления схемы. */
  readonly manifest: DatabaseManifest | null
  /* Число сущностей; null при отсутствии файла или неактуальной схеме. */
  readonly entities: number | null
  /* Число имплементаций; null при отсутствии файла или неактуальной схеме. */
  readonly implementations: number | null
}
