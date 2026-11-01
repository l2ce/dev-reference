import { DatabaseError } from '../errors.js'
import { databaseStatus } from '../api/status.js'
import { importDatabase, exportDatabase } from '../exchange/exchange.js'
import { parseCliArguments } from './arguments.js'
import { createTerminalProgress } from './progress.js'
import { cliMessages as messages } from './messages.js'
import { terminalColors, terminalStyle } from './terminal-style.js'
import type { TerminalProgress } from './cli.types.js'
import { runWrite } from './write.js'

/**
 * Выполняет одну команду; stdout содержит результат, stderr принадлежит прогрессу и ошибкам.
 */
async function run(args: readonly string[], progress: TerminalProgress): Promise<void> {
  const input = parseCliArguments(args)
  if (input.command === 'help') {
    process.stdout.write(messages.help)
    return
  }
  if (input.command === 'status') {
    const result = databaseStatus({ database: input.database })
    process.stdout.write((input.json ? JSON.stringify(result) : messages.status(result)) + '\n')
    return
  }
  const options = { database: input.database, onProgress: progress.update }
  if (input.command === 'init' || input.command === 'apply') {
    await runWrite(input)
    return
  }
  const result =
    input.command === 'import'
      ? await importDatabase({ ...options, input: input.input })
      : await exportDatabase({ ...options, output: input.output })
  progress.stop()
  process.stdout.write(
    (input.json
      ? JSON.stringify(result)
      : terminalStyle(messages.exchanged(result), 'strong', terminalColors(process.stdout))) + '\n'
  )
}

/**
 * Управляет терминальной строкой и кодами завершения, включая прерывание пользователем.
 */
async function main(): Promise<void> {
  const progress = createTerminalProgress()
  /**
   * Завершает строку прогресса и процесс; незавершённую SQL-транзакцию откатит SQLite.
   */
  const interrupt = (signal: NodeJS.Signals): void => {
    progress.stop()
    process.stderr.write(messages.cancelled + '\n')
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', interrupt)
  try {
    await run(process.argv.slice(2), progress)
  } catch (error) {
    progress.stop()
    const code = error instanceof DatabaseError ? error.code : 'UNEXPECTED_ERROR'
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${messages.failed} [${code}]: ${message}\n`)
    if (error instanceof DatabaseError && error.details !== undefined) {
      process.stderr.write(JSON.stringify(error.details) + '\n')
    }
    process.exitCode = 1
  } finally {
    progress.stop()
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', interrupt)
  }
}

await main()
