import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Расположение исполняемого CLI независимо от текущего рабочего каталога. */
const ENTRYPOINT = fileURLToPath(new URL('../index.js', import.meta.url))
/** Корень workspace, в котором объявлен скрипт pnpm cli. */
const WORKSPACE = fileURLToPath(new URL('../../../../', import.meta.url))

/**
 * Выбирает способ повторного запуска, не полагаясь на наличие workspace-бинарника в PATH.
 */
export function cliLauncher(
  argv: readonly string[] = process.argv,
  environment: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): string[] {
  const entrypoint = argv[1]
  if (!entrypoint) return ['protocols-db']
  if (basename(entrypoint) === 'protocols-db') return [resolve(cwd, entrypoint)]
  if (resolve(cwd, entrypoint) !== ENTRYPOINT) return ['protocols-db']
  if (
    ['cli', 'cli:local'].includes(environment.npm_lifecycle_event ?? '') &&
    (environment.npm_lifecycle_script === 'node apps/cli/dist/index.js' ||
      environment.npm_lifecycle_script?.startsWith('node apps/cli/dist/index.js ') === true) &&
    resolve(cwd) === resolve(WORKSPACE)
  )
    return ['pnpm', '--silent', environment.npm_lifecycle_event ?? 'cli']
  return [argv[0] ?? process.execPath, ENTRYPOINT]
}

/**
 * Экранирует буквальный аргумент команды для POSIX shell без выполнения его содержимого.
 */
export function shellArgument(argument: string): string {
  return /^[\w:.,/=+-]+$/.test(argument) ? argument : `'${argument.replaceAll("'", "'\\''")}'`
}

/**
 * Формирует копируемую команду тем же доступным способом запуска, что исходный вызов.
 */
export function cliCommand(args: readonly string[]): string {
  return [...cliLauncher(), ...args].map(shellArgument).join(' ')
}

/**
 * Сохраняет выбранный SQLite-файл в командах навигации и восстановления.
 */
export function databaseArguments(context: {
  /** Явно выбранный SQLite-файл. */
  database?: string
}): string[] {
  return context.database ? ['--database', context.database] : []
}
