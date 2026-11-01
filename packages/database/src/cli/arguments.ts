import { parseArgs } from 'node:util'
import * as z from 'zod'
import { DatabaseError } from '../errors.js'
import { cliMessages as messages } from './messages.js'
import type { CliArguments } from './cli.types.js'

const commandSchema = z.enum(['import', 'export', 'status', 'init', 'apply'])

/**
 * Разбирает аргументы без скрытых операций; несовместимые параметры отклоняются.
 */
export function parseCliArguments(args: readonly string[]): CliArguments {
  try {
    const { values, positionals } = parseArgs({
      args: [...args],
      allowPositionals: true,
      strict: true,
      options: {
        database: { type: 'string' },
        input: { type: 'string' },
        output: { type: 'string' },
        file: { type: 'string' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false }
      }
    })
    if (values.help || positionals.length === 0) {
      return { command: 'help', json: false }
    }
    const command = commandSchema.parse(positionals[0])
    if (
      positionals.length !== 1 ||
      (values.input !== undefined && command !== 'import') ||
      (values.output !== undefined && command !== 'export') ||
      (values.file !== undefined && command !== 'apply') ||
      (command === 'apply' && values.file === undefined)
    ) {
      throw new Error(messages.arguments)
    }
    for (const value of [values.database, values.input, values.output, values.file]) {
      if (value !== undefined && value.trim().length === 0) {
        throw new Error(messages.arguments)
      }
    }
    return {
      command,
      database: values.database,
      input: values.input,
      output: values.output,
      file: values.file,
      json: values.json
    }
  } catch (error) {
    throw new DatabaseError('INVALID_ARGUMENT', messages.arguments, undefined, error)
  }
}
