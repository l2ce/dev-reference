import type { HelpExample } from './help.types.js'
import { cliLauncher } from '../commands/invocation.js'

/**
 * Экранирует буквальный аргумент для POSIX shell, не выполняя его содержимое.
 */
export function shellArgument(argument: string): string {
  if (/^[\w:.,/=+-]+$/.test(argument) || /^<(version|cursor)>$/.test(argument)) return argument
  return `'${argument.replaceAll("'", "'\\''")}'`
}

/**
 * Печатает настоящие команды подготовки и stdin из тех же шагов, что выполняют тесты.
 */
export function examplesText(examples: HelpExample[]): string {
  return examples
    .map((example) => {
      let text = `Пример ${example.id}: ${example.title}\nБаза примера: ./example.sqlite (отдельный новый файл; не рабочая база).\n`
      if (example.preconditions.length) text += example.preconditions.map((condition) => `  ${condition}\n`).join('')
      for (const [path, content] of Object.entries(example.files ?? {}))
        text += `Существующий UTF-8 файл ${path}:\n<<< FILE BEGIN >>>\n${content}${content.endsWith('\n') ? '' : '\n'}<<< FILE END >>>\n`
      for (const [label, steps] of [
        ['Подготовка', example.setup],
        ['Выполнение', example.steps]
      ] as const) {
        if (!steps.length) continue
        text += `${label}:\n`
        for (const step of steps) {
          const command = [...cliLauncher(), '--database', './example.sqlite', ...step.args]
            .map(shellArgument)
            .join(' ')
          if (step.stdin !== undefined) {
            if (!step.stdin.endsWith('\n')) text += `printf '%s' ${shellArgument(step.stdin)} | ${command}\n`
            else {
              let delimiter = 'L2REF_INPUT'
              while (step.stdin.split('\n').includes(delimiter)) delimiter += '_TEXT'
              text += `${command} <<'${delimiter}'\n${step.stdin}${delimiter}\n`
            }
          } else text += command + '\n'
          if (step.exitCode)
            text += `Ожидаемый код ${step.exitCode}: это намеренный отказ; изменения не должны сохраниться.\n`
          if (step.captureVersion) text += 'Скопируйте полный токен «Версия» в <version> следующей команды.\n'
          if (step.captureCursor) text += 'Скопируйте курсор из предложенной команды продолжения в <cursor>.\n'
        }
      }
      return text + `Ожидается: ${example.expected.join(' ')}\n`
    })
    .join('\n')
}
