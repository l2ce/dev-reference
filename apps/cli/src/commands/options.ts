import { Command, InvalidArgumentError } from 'commander'
import { cliMessages as messages } from '../locales/ru.js'

/**
 * Разбирает целое значение без дробей и числовых хвостов.
 */
export function positiveInteger(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new InvalidArgumentError(messages.invalidLimit)
  }
  return Number(value)
}

/**
 * Разбирает неотрицательное целое смещение или номер.
 */
export function nonnegativeInteger(value: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new InvalidArgumentError(messages.invalidOffset)
  }
  return Number(value)
}

/**
 * Показывает справку группы без запуска операций.
 */
export function showCommandHelp(this: Command): void {
  this.outputHelp()
}
