import { readFileSync } from 'node:fs'
import { Command, CommanderError } from 'commander'
import * as z from 'zod'
import { DatabaseError } from '@l2ce/database'
import { cliMessages as messages } from '../locales/ru.js'
import { writeFailure, writeSuccess } from '../output/writer.js'
import type { CommanderOutput, OutputOptions } from '../output/output.types.js'
import { registerRecordCommands } from './records-program.js'
import { showCommandHelp } from './options.js'

/**
 * Читает версию установленного пакета, чтобы --version совпадал с package.json.
 */
function packageVersion(): string {
  return z
    .object({ version: z.string() })
    .parse(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))).version
}

/**
 * Возвращает формат, уже разобранный Commander, включая обработку ошибок разбора.
 */
export function outputOptions(program: Command): OutputOptions {
  return {
    json: program.getOptionValue('json') === true,
    pretty: program.getOptionValue('pretty') === true
  }
}

/**
 * Проверяет совместимость формата до побочных эффектов команды.
 */
function checkOutputOptions(program: Command): void {
  const options = outputOptions(program)
  if (options.pretty && !options.json) {
    throw new DatabaseError('USAGE', messages.prettyRequiresJson)
  }
  // Версия обрабатывается после разбора всех флагов: --version --json и обратный порядок равнозначны.
  if (program.getOptionValue('version') === true) {
    throw new CommanderError(0, 'commander.version', messages.version)
  }
}

/**
 * Создаёт отдельный экземпляр Commander; его стандартные потоки буферизуются до выбора формата.
 */
export function createCliProgram(output: CommanderOutput): Command {
  const program = new Command('protocols-db')
  program
    .description(messages.description)
    .option('-V, --version', messages.version)
    .option('--database <path>', messages.flags.database)
    .option('-l, --locale <locale>', messages.flags.locale)
    .option('--json', messages.flags.json)
    .option('--pretty', messages.flags.pretty)
    .helpOption('-h, --help', messages.help)
    .helpCommand('help [command]', messages.help)
    .configureHelp({ showGlobalOptions: true, sortOptions: true })
    .configureOutput({
      /**
       * Сохраняет стандартную справку и версию для последующего форматирования.
       */
      writeOut: (text): void => {
        output.stdout += text
      },
      /**
       * Сохраняет диагностики Commander, исключая смешивание с JSON-ответом.
       */
      writeErr: (text): void => {
        output.stderr += text
      }
    })
    .exitOverride()
    .showHelpAfterError(messages.helpHint)
    .hook('preAction', checkOutputOptions)
  registerRecordCommands(program)
  program.action(showCommandHelp)
  return program
}

/**
 * Выводит справку или версию в том же формате, что и обычные результаты.
 */
function writeInformation(program: Command, output: CommanderOutput, version: boolean): void {
  const options = outputOptions(program)
  if (options.pretty && !options.json) {
    throw new DatabaseError('USAGE', messages.prettyRequiresJson)
  }
  const text = version ? packageVersion() + '\n' : output.stdout
  if (options.json) {
    writeSuccess(version ? { version: text.trim() } : { help: text }, options)
  } else {
    process.stdout.write(text)
  }
}

/**
 * Разбирает argv через Commander и выдаёт одну справку, версию, результат либо ошибку.
 */
export async function runCli(program: Command, output: CommanderOutput, argv: readonly string[]): Promise<void> {
  try {
    await program.parseAsync([...argv], { from: 'user' })
    checkOutputOptions(program)
    if (output.stdout) {
      writeInformation(program, output, false)
    }
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) {
      try {
        writeInformation(program, output, error.code === 'commander.version')
      } catch (formatError) {
        writeFailure(formatError, outputOptions(program))
      }
      return
    }
    writeFailure(error, outputOptions(program))
    if (error instanceof CommanderError && !outputOptions(program).json) {
      process.stderr.write(messages.helpHint + '\n')
    }
  }
}
