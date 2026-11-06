import { Command } from 'commander'
import { collectionSchema } from '@l2ce/database'
import { TYPES } from '../commands/model.js'
import { COMMAND_SPECS, commandSpec } from './catalog.js'
import { commandPath, LEGACY_ROOTS } from './legacy.js'
import { helpDocument, supportsCommandType } from './document.js'
import { commandExamples, workflowExamples } from './examples.js'
import { helpOption } from './options.js'

/**
 * Измеряемое покрытие реестра, а не субъективная оценка текста.
 */
export type HelpCoverage = {
  /** Все узлы вместе с корнем и совместимостью. */
  commands: number
  /** Узлы нового интерфейса без корня. */
  modern: number
  /** Совместимые узлы. */
  legacy: number
  /** Описанные собственные параметры. */
  options: number
  /** Проверенные типовые контексты. */
  contexts: number
  /** Сценарии примеров до выполнения их отдельных тестов. */
  examples: number
  /** Непокрытые возможности; CI требует пустой список. */
  missing: string[]
}

/**
 * Обходит реальное исполняемое дерево и обнаруживает команды/ключи без справочного контракта.
 */
export function checkHelpCoverage(program: Command): HelpCoverage {
  const report: HelpCoverage = { commands: 0, modern: 0, legacy: 0, options: 0, contexts: 0, examples: 0, missing: [] }
  const registered = new Set<string>()
  /**
   * Проверяет один узел и независимые от состояния SQLite контексты.
   */
  const visit = (command: Command): void => {
    const path = commandPath(command)
    const id = path.join('.')
    const legacy = LEGACY_ROOTS.includes(path[0])
    report.commands++
    if (path.length) {
      if (legacy) report.legacy++
      else report.modern++
    }
    registered.add(id)
    const spec = commandSpec(id)
    if (path.length && !legacy && !spec) {
      report.missing.push(`Нет CommandSpec: ${id}`)
      return
    }
    try {
      const document = helpDocument(command)
      if (![document.description, document.result, document.absence].every((text) => text.trim().length > 10))
        report.missing.push(`Неполное описание/результат/отсутствие: ${id}`)
      if (
        !document.examples.length ||
        document.examples.some((example) => !example.steps.length || !example.expected.length || !example.title)
      )
        report.missing.push(`Нет исполняемого примера: ${id}`)
      if (!document.rules.length || !document.errors.length || !document.safety.length)
        report.missing.push(`Нет правил/ошибок/безопасности: ${id}`)
      if (new Set(document.rules.map((rule) => rule.id)).size !== document.rules.length)
        report.missing.push(`Повтор ID правила: ${id}`)
      const declared = new Set(document.options.flatMap((option) => option.flags.match(/--[a-z][a-z-]*/g) ?? []))
      for (const option of command.options) {
        report.options++
        if (option.long && !declared.has(option.long)) report.missing.push(`Нет описания ${id} ${option.long}`)
        const description = document.options.find(
          (declared) => option.long && declared.flags.split(/[ ,]+/).some((flag) => flag === option.long)
        )
        if (option.mandatory && !description?.required)
          report.missing.push(`Не указана обязательность ${id} ${option.long}`)
        if (option.argChoices && JSON.stringify(option.argChoices) !== JSON.stringify(description?.choices))
          report.missing.push(`Различаются choices ${id} ${option.long}`)
      }
      for (const argument of command.registeredArguments)
        if (!spec?.arguments[argument.name()] && !legacy)
          report.missing.push(`Нет описания аргумента ${id} ${argument.name()}`)
      for (const option of document.options)
        if (!option.description || !option.valueType || !option.defaultDescription || !Array.isArray(option.rules))
          report.missing.push(`Неполный ключ: ${id} ${option.flags}`)
      report.examples += document.examples.length
      if (
        path.length &&
        !command.commands.length &&
        !document.examples.some((example) =>
          example.steps.some(
            (step) =>
              step.args.slice(0, path.length).join('.') === id &&
              (step.exitCode ?? 0) === 0 &&
              !step.args.includes('--help')
          )
        )
      )
        report.missing.push(`Нет успешного предметного вызова выбранной команды в примерах: ${id}`)
      if (spec?.typed)
        for (const typeName of Object.keys(TYPES)) {
          const type = collectionSchema.parse(typeName)
          if (!supportsCommandType(id, type)) continue
          const typed = helpDocument(command, { collection: type })
          if (!typed.examples.length) report.missing.push(`Нет примера ${id}/${type}`)
          report.contexts++
        }
    } catch (error) {
      report.missing.push(`${id || 'root'}: ${error instanceof Error ? error.message : String(error)}`)
    }
    for (const child of command.commands) visit(child)
  }
  visit(program)
  for (const spec of COMMAND_SPECS) {
    if (!registered.has(spec.id)) report.missing.push(`Нет исполняемой команды ${spec.id}`)
    for (const id of spec.options) {
      const option = helpOption(id)
      if (!option.description) report.missing.push(`Нет описания ${spec.id}/${id}`)
    }
    for (const related of spec.related)
      if (!commandSpec(related)) report.missing.push(`Неразрешённая справочная ссылка ${spec.id} → ${related}`)
    commandExamples(spec.id)
  }
  for (const name of ['catalog', 'translate', 'research'])
    if (!workflowExamples(name).length) report.missing.push(`Нет workflow ${name}`)
  return report
}
