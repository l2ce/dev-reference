import type { ExchangeProgress } from '../exchange/exchange.types.js'

/**
 * Команды мини-CLI исключительно пакета базы данных.
 */
export type DatabaseCommand = 'import' | 'export' | 'status' | 'init' | 'apply'
/**
 * Проверенные параметры запуска.
 */
export interface CliArguments {
  /* Команда; help возвращается отдельно от рабочих операций. */
  readonly command: DatabaseCommand | 'help'
  /* Явный SQLite-файл либо путь по умолчанию. */
  readonly database?: string
  /* Каталог JSON для команды import. */
  readonly input?: string
  /* Каталог JSON для команды export. */
  readonly output?: string
  /* JSON-пакет операций для команды apply. */
  readonly file?: string
  /* Машинный JSON-результат в stdout. */
  readonly json: boolean
}
/**
 * Рендерер компактного многострочного прогресса.
 */
export interface TerminalProgress {
  /**
   * Обновляет строки коллекций в TTY; в перенаправленном stderr выводит итог.
   */
  update(event: ExchangeProgress): void
  /**
   * Завершает интерактивную таблицу; повторный вызов допустим.
   */
  stop(): void
}
