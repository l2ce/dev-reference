import * as z from 'zod'
import { DatabaseError, hasErrorCode } from '@l2ce/database'
import { cliMessages as messages } from '../locales/ru.js'
import { CommanderError } from 'commander'
import { formatText } from './text.js'
import type { OutputOptions } from './output.types.js'

/**
 * Пишет результат в stdout в выбранном формате; диагностик в этот поток не добавляет.
 */
export function writeSuccess(data: unknown, options: OutputOptions): void {
  process.stdout.write(
    options.json
      ? JSON.stringify({ ok: true, data, meta: {} }, null, options.pretty ? 2 : undefined) + '\n'
      : formatText(data)
  )
}

/**
 * Нормализует внешнюю ошибку на границе CLI, сохраняя её причину и ошибки полей.
 */
function normalizeError(error: unknown): DatabaseError {
  if (error instanceof CommanderError) {
    return new DatabaseError('USAGE', error.message, { commanderCode: error.code }, error)
  }
  if (error instanceof DatabaseError) {
    if (
      ['SQLITE_BUSY', 'SQLITE_BUSY_SNAPSHOT', 'SQLITE_BUSY_RECOVERY', 'SQLITE_LOCKED'].some((code) =>
        hasErrorCode(error.cause, code)
      )
    ) {
      return new DatabaseError(
        'BUSY',
        'База временно занята. Изменения не сохранены; повторите действие явно.',
        error.details,
        error
      )
    }
    return error
  }
  if (error instanceof z.ZodError) {
    return new DatabaseError('VALIDATION_ERROR', messages.invalidData, { issues: error.issues }, error)
  }
  if (error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    if (error.code.startsWith('ERR_PARSE_ARGS')) {
      return new DatabaseError('USAGE', messages.invalidArguments, undefined, error)
    }
    if (error.code.startsWith('SQLITE_BUSY') || error.code.startsWith('SQLITE_LOCKED')) {
      return new DatabaseError(
        'BUSY',
        'База временно занята. Изменения не сохранены; повторите действие явно.',
        undefined,
        error
      )
    }
    return new DatabaseError(
      'IO_ERROR',
      'Ошибка чтения или записи файла. Проверьте путь и права доступа.',
      { systemCode: error.code },
      error
    )
  }
  return new DatabaseError('INTERNAL_ERROR', messages.internalError, undefined, error)
}

/**
 * Выдаёт ошибку в stderr в выбранном формате и устанавливает стабильный код завершения.
 */
export function writeFailure(input: unknown, options: OutputOptions, nextSteps: readonly string[] = []): void {
  const error = normalizeError(input)
  const exitCodes: Readonly<Record<string, number>> = {
    USAGE: 2,
    INVALID_JSON: 2,
    INVALID_INPUT: 2,
    INVALID_FILE: 2,
    INVALID_DESTINATION: 2,
    INVALID_DIRECTORY: 2,
    INVALID_TABLE_ROW: 2,
    INVALID_TABLE_VALUE: 2,
    INVALID_TABLE_KEY: 2,
    VALIDATION_ERROR: 2,
    INVALID_QUERY: 2,
    INVALID_OPERATION: 2,
    INVALID_ARGUMENT: 2,
    INVALID_CURSOR: 2,
    INVALID_PATH: 2,
    INVALID_PATCH: 2,
    INVALID_BATCH: 2,
    INVALID_RESOLUTION: 2,
    MANIFEST_SCOPE_REQUIRED: 2,
    NOT_FOUND: 3,
    DATABASE_NOT_FOUND: 3,
    DATABASE_EMPTY: 3,
    WORKSPACE_NOT_INITIALIZED: 3,
    ALREADY_EXISTS: 4,
    REVISION_CONFLICT: 4,
    OPERATION_EXISTS: 4,
    CONFLICT: 4,
    SOURCE_CHANGED: 4,
    SYNC_CONFLICT: 4,
    STALE_RESOLUTION: 4,
    BRANCH_CHANGED: 4,
    WORKTREE_MISMATCH: 4,
    RECOVERY_CONFLICT: 4,
    RECOVERY_REQUIRED: 4,
    BUSY: 5,
    EXPORT_BUSY: 5
  }
  process.exitCode = exitCodes[error.code] ?? 1
  const data = {
    code: error.code,
    message: error.message,
    details: error.details,
    nextSteps: nextSteps.length ? nextSteps : undefined,
    cause:
      error.cause instanceof Error && !(error.cause instanceof z.ZodError) && error.cause.message !== error.message
        ? error.cause.message
        : undefined
  }
  const { nextSteps: _nextSteps, ...textData } = data
  process.stderr.write(
    options.json
      ? JSON.stringify({ ok: false, error: data }, null, options.pretty ? 2 : undefined) + '\n'
      : formatText(textData) +
          'Команда не завершена. Предметные изменения не сохранены.\n' +
          (nextSteps.length
            ? `Следующий шаг (без автоматического повтора записи):\n${nextSteps.map((step) => `  ${step}`).join('\n')}\n`
            : '')
  )
}

/**
 * Считает закрытие читающей стороны stdout нормальным завершением конвейера.
 */
export function onOutputError(error: unknown, options: OutputOptions): void {
  if (hasErrorCode(error, 'EPIPE')) {
    process.exitCode = 0
    return
  }
  writeFailure(error, options)
}
