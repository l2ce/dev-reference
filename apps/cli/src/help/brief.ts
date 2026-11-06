import { cliCommand, databaseArguments } from '../commands/invocation.js'
import { examplesText } from './example-text.js'
import { COMMAND_SPECS } from './catalog.js'
import type { HelpDocument } from './document.js'
import type { HelpExample, HelpRule } from './help.types.js'

/** Правила, которые нельзя скрывать за сокращением справочного документа. */
const SAFETY_RULE_IDS = new Set([
  'atomic',
  'preview',
  'no-export',
  'translation-owner',
  'link-applicability',
  'link-cardinality',
  'source-match',
  'batch-replace',
  'schema-operation',
  'availability',
  'selection-version',
  ...COMMAND_SPECS.flatMap((command) => command.rules.map((rule) => rule.id))
])

/**
 * Сохраняет критичные ограничения из основного реестра, не создавая второй контракт безопасности.
 */
export function briefRules(rules: HelpRule[]): HelpRule[] {
  return rules.filter((rule) => SAFETY_RULE_IDS.has(rule.id))
}

/**
 * Выбирает один основной самодостаточный пример вместе со всей подготовкой.
 */
export function briefExample(examples: HelpExample[]): HelpExample[] {
  return examples.slice(0, 1)
}

/**
 * Рендерит явный краткий обзор, сохраняя обязательные параметры, поля и предупреждения.
 */
export function briefHelpText(document: HelpDocument): string {
  let text = `Usage: ${document.usage[0]}\n${document.description}\n`
  if (document.legacy) text += 'ВНИМАНИЕ: совместимый старый контракт, не семантика нового update.\n'
  if (document.context.collection) text += `Тип: ${document.context.collection}\n`
  for (const command of document.commands) text += `  ${command.name}: ${command.description}\n`
  const options = document.options.filter(
    (option) => !option.legacy && (!option.field || !document.fields.some((field) => field.name === option.field))
  )
  if (options.length)
    text += `\nПараметры:\n${options.map((option) => `  ${option.flags}${option.required ? ' (обязательно)' : ''}: ${option.description}${option.choices ? ` [${option.choices.join('|')}]` : ''}`).join('\n')}\n`
  if (document.fields.length)
    text += `\nПоля:\n${document.fields
      .map((field) => {
        const option = document.options.find((option) => option.field === field.name)
        return `  ${field.name}${field.required ? ' (обязательно)' : ''}${option ? ` (${option.flags})` : ''}: ${field.meaning}${option?.choices ? ` [${option.choices.join('|')}]` : ''}${field.scope === 'translation' ? '; перевод' : ''}${field.nullable ? '; null допустим' : ''}`
      })
      .join('\n')}\n`
  if (document.types.length && !document.fields.length && !document.commands.length)
    text += `\nТипы:\n${document.types.map((type) => `  ${type.type}: ${type.address}; поля: ${type.fields.join(', ')}${type.required.length ? `; обязательны: ${type.required.join(', ')}` : ''}`).join('\n')}\n`
  text += `\nБезопасность:\n${[...document.safety, ...briefRules(document.rules).map((rule) => rule.text)].map((rule) => `- ${rule}`).join('\n')}\n`
  text += `\n${examplesText(briefExample(document.examples))}`
  const context = document.context
  const fullHelp = cliCommand([
    ...databaseArguments(context),
    'help',
    ...(document.path[0] === 'help' ? document.path.slice(1) : document.path),
    ...(context.key ? [context.key] : context.collection ? ['--type', context.collection] : []),
    ...(context.protocol ? ['--protocol', context.protocol] : [])
  ])
  return `${text}\nПолная справка: ${fullHelp}\n`
}
