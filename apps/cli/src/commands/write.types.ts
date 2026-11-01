import type { DatabaseOperation } from '@l2ce/database'

/**
 * Проверенный пакет для единственного атомарного вызова базы.
 */
export interface PreparedBatch {
  /* Операции с разрешёнными читаемыми адресами и назначенными UUID. */
  readonly operations: readonly DatabaseOperation[]
  /* Явная ожидаемая ревизия либо undefined для ревизии исходного чтения CLI. */
  readonly ifRevision?: string
}

/**
 * Человекочитаемое резюме одной операции записи.
 */
export interface WriteChangeSummary {
  /* Название выполненной или проверенной операции. */
  readonly action: string
  /* Читаемый адрес затронутой записи. */
  readonly key: string
  /* Заменяемые поля update; для остальных операций пустой список. */
  readonly fields: readonly string[]
}
