import { Command } from 'commander'
import { DatabaseError } from '@l2ce/database'
import { interfaceOptionsSchema } from './interface.types.js'
import { runInterface } from './interface-run.js'
import { writeSuccess } from '../output/writer.js'
import { runCommand } from './run.js'
import { argumentSchema } from '../input/schema.js'
import { COMMAND_SPECS } from '../help/catalog.js'
import { commandOption } from '../help/options.js'
import { helpDocument } from '../help/document.js'
import { commandPath } from '../help/legacy.js'
import { inspectHelpRequest, writeRequestedHelp } from '../help/service.js'
import type { InterfaceOptions, InterfaceResult } from './interface.types.js'

/**
 * Окрашивает только собственные границы страницы, не меняя строки авторского текста.
 */
function formattedText(result: InterfaceResult, options: InterfaceOptions): string {
  if (options.content || options.color === 'never' || (options.color === 'auto' && !process.stdout.isTTY))
    return result.text
  const tag = /^===== PAGE (q[0-9a-f]+) BEGIN/.exec(result.text)?.[1]
  if (!tag) return result.text
  return result.text.replace(
    new RegExp(`^(?:===== PAGE ${tag} .*|----- RECORD ${tag} .*|<<< FIELD ${tag} .*)$`, 'gm'),
    '\u001b[36m$&\u001b[0m'
  )
}

/**
 * Выполняет ровно зарегистрированную операцию и выдаёт один результат либо диагностику.
 */
async function executeInterface(this: Command): Promise<void> {
  const raw = this.optsWithGlobals()
  const options = interfaceOptionsSchema.parse({ ...raw, format: raw.json === true ? 'json' : raw.format })
  const operation = commandPath(this).join('.')
  if (raw.structureOnly || (raw.brief && operation !== 'schema'))
    throw new DatabaseError('USAGE', '--brief и --structure-only требуют help либо --help; schema допускает --brief.')
  const operands = this.processedArgs.flat().filter((argument): argument is string => typeof argument === 'string')
  if (operation === 'batch' && raw.file) {
    if (raw.input || raw.ifVersion || raw.diff)
      throw new DatabaseError(
        'USAGE',
        'Совместимый batch --file нельзя сочетать с --input, --if-version или --diff. Для него SHA-256 ifRevision задаётся внутри старого JSON; новый формат использует --input.'
      )
    const { format: _format, color: _color, verbose: _verbose, ...legacyOptions } = raw
    writeSuccess(await runCommand(argumentSchema.parse({ ...legacyOptions, command: 'batch', operands: [] })), {
      json: options.format === 'json',
      pretty: raw.pretty === true
    })
    return
  }
  const result = await runInterface(operation, operands, options)
  process.stdout.write(
    options.format === 'json'
      ? JSON.stringify({ ok: true, data: result.data, meta: result.meta }, null, raw.pretty ? 2 : undefined) + '\n'
      : formattedText(result, options)
  )
  if (result.diagnostics && options.format === 'text') process.stderr.write(result.diagnostics)
  if (result.exitCode) process.exitCode = result.exitCode
}

/**
 * Поддерживает вызов группы и прямой разбор Commander тем же справочным сервисом.
 */
function showRegisteredHelp(this: Command): void {
  let program = this
  while (program.parent) program = program.parent
  const topics =
    this.name() === 'help'
      ? this.processedArgs.flat().filter((argument): argument is string => typeof argument === 'string')
      : commandPath(this)
  const options = this.optsWithGlobals()
  const argv = [
    'help',
    ...topics,
    ...(options.type ? ['--type', String(options.type)] : []),
    ...(options.format === 'json' || options.json ? ['--format', 'json'] : []),
    ...(options.pretty ? ['--pretty'] : []),
    ...(options.brief ? ['--brief'] : []),
    ...(options.structureOnly ? ['--structure-only'] : [])
  ]
  writeRequestedHelp(inspectHelpRequest(program, argv))
}

/**
 * Совместимая точка получения структуры; конкретный узел больше не подменяется корневым деревом.
 */
export function commandStructure(command: Command): unknown {
  return helpDocument(command)
}

/**
 * Регистрирует исполняемые команды и параметры исключительно из реестра справочных контрактов.
 */
export function registerInterface(program: Command): void {
  program.addHelpCommand(false)
  const commandsById = new Map<string, Command>([['', program]])
  for (const spec of COMMAND_SPECS) {
    const parentId = spec.id.split('.').slice(0, -1).join('.')
    const parent = commandsById.get(parentId)
    if (!parent) throw new Error(`Не зарегистрирован родитель ${parentId}: ${spec.id}`)
    const command = parent.command(spec.signature).description(spec.purpose)
    for (const id of spec.options) {
      const option = commandOption(id)
      if (spec.requiredOptions?.includes(id)) option.makeOptionMandatory()
      command.addOption(option)
    }
    command.action(spec.group || spec.id === 'help' ? showRegisteredHelp : executeInterface)
    commandsById.set(spec.id, command)
  }
}
