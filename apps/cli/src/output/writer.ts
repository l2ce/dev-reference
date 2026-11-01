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
    options.json ? JSON.stringify({ ok: true, data }, null, options.pretty ? 2 : undefined) + '\n' : formatText(data)
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
    return error
  }
  if (error instanceof z.ZodError) {
    return new DatabaseError('VALIDATION_ERROR', messages.invalidData, { issues: error.issues }, error)
  }
  if (error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    if (error.code.startsWith('ERR_PARSE_ARGS')) {
      return new DatabaseError('USAGE', messages.invalidArguments, undefined, error)
    }
    return new DatabaseError('IO_ERROR', messages.internalError, { systemCode: error.code }, error)
  }
  return new DatabaseError('INTERNAL_ERROR', messages.internalError, undefined, error)
}

/**
 * Выдаёт ошибку в stderr в выбранном формате и устанавливает стабильный код завершения.
 */
export function writeFailure(input: unknown, options: OutputOptions): void {
  const error = normalizeError(input)
  const exitCodes: Readonly<Record<string, number>> = {
    USAGE: 2,
    INVALID_JSON: 2,
    INVALID_INPUT: 2,
    INVALID_FILE: 2,
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
    BUSY: 5
  }
  process.exitCode = exitCodes[error.code] ?? 1
  const data = {
    code: error.code,
    message: error.message,
    details: error.details,
    cause:
      error.cause instanceof Error && !(error.cause instanceof z.ZodError) && error.cause.message !== error.message
        ? error.cause.message
        : undefined
  }
  process.stderr.write(
    options.json
      ? JSON.stringify({ ok: false, error: data }, null, options.pretty ? 2 : undefined) + '\n'
      : formatText(data)
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
