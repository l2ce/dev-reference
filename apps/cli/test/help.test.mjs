import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { createCliProgram } from '../dist/commands/program.js'
import { checkHelpCoverage } from '../dist/help/coverage.js'
import { helpDocument, helpText, supportsCommandType } from '../dist/help/document.js'
import { inspectHelpRequest, requestedHelp } from '../dist/help/service.js'
import { COMMAND_SPECS } from '../dist/help/catalog.js'
import { TYPES } from '../dist/commands/model.js'
import { commandPath, LEGACY_ROOTS } from '../dist/help/legacy.js'
import { invokeCli } from './support/help-runner.mjs'

const createProgram = () => createCliProgram({ stdout: '', stderr: '' })
const collect = (command) => [command, ...command.commands.flatMap(collect)]

test('реестр покрывает все команды, параметры, аргументы, типы и разрешённые справочные ссылки', () => {
  const program = createProgram()
  const report = checkHelpCoverage(program)
  assert.deepEqual(report.missing, [])
  assert.equal(report.modern, COMMAND_SPECS.length)
  assert.equal(report.commands, collect(program).length)
  assert.ok(report.contexts > 200)
  assert.ok(report.examples >= report.commands)
})

test('неописанная команда или новый флаг обнаруживаются автоматически, без списка известных тесту команд', () => {
  const program = createProgram()
  program.command('undocumented').description('Тестовая команда без контракта')
  program.commands.find((command) => command.name() === 'read').option('--undocumented <value>', 'Тест')
  const report = checkHelpCoverage(program)
  assert.ok(report.missing.some((message) => message.includes('undocumented')))
  assert.ok(report.missing.some((message) => message.includes('read --undocumented')))
})

test('текстовая справка всех зарегистрированных маршрутов и корня содержит обязательные разделы без SQLite', async () => {
  const program = createProgram()
  const missing = `/tmp/opencode/help-no-database-${process.pid}.sqlite`
  assert.equal(existsSync(missing), false)
  for (const command of collect(program)) {
    const path = commandPath(command)
    const result = await invokeCli(['--database', missing, ...path, '--help'])
    assert.equal(result.code, 0, `${path.join(' ')}: ${result.stderr}`)
    assert.equal(result.stderr, '')
    for (const section of [
      'Usage:',
      'параметры и умолчания',
      'Правила и ограничения:',
      'Результат:',
      'Отсутствие данных и повторы:',
      'Безопасность:',
      'Ошибки и исправление:',
      'Примеры'
    ])
      assert.ok(result.stdout.includes(section), `${path.join(' ')}: нет ${section}`)
  }
  assert.equal(existsSync(missing), false)
})

test('help path, адрес --help и JSON эквивалентны и ограничены выбранной операцией/типом', async () => {
  const variants = [
    ['help', 'translation', 'set', '--type', 'releases'],
    ['translation', 'set', 'release:absent', '--help'],
    [
      '--database',
      '/tmp/opencode/never-open.sqlite',
      'translation',
      'set',
      'release:absent',
      '--help',
      '--format',
      'json'
    ]
  ]
  const first = await invokeCli(variants[0])
  const second = await invokeCli(variants[1])
  const third = await invokeCli(variants[2])
  for (const result of [first, second, third]) assert.equal(result.code, 0, result.stderr)
  const document = JSON.parse(third.stdout).data.structure
  assert.equal(document.operation, 'translation.set')
  assert.equal(document.name, 'set')
  assert.equal(document.context.collection, 'releases')
  assert.deepEqual(document.commands, [])
  assert.ok(document.examples.length)
  for (const wrong of ['--opcode', '--server', '--branch', '--chronicle', '--status']) {
    assert.equal(first.stdout.includes(wrong + ' <'), false)
    assert.equal(second.stdout.includes(wrong + ' <'), false)
  }
  assert.deepEqual(
    JSON.parse(third.stdout).data.structure.fields.map((field) => field.name),
    ['title', 'summary', 'description', 'translationStatus']
  )
})

test('контекстный рендер всех типов не публикует чужие скалярные флаги и печатает форматы/обязательность', () => {
  const program = createProgram()
  for (const spec of COMMAND_SPECS.filter((spec) => spec.typed)) {
    let command = program
    for (const name of spec.id.split('.')) command = command.commands.find((child) => child.name() === name)
    for (const collection of Object.keys(TYPES).filter((type) => supportsCommandType(spec.id, type))) {
      const document = helpDocument(command, { collection })
      const rendered = helpText(document)
      for (const field of document.fields) {
        assert.ok(field.meaning)
        assert.ok(rendered.includes(field.name))
        assert.ok(field.schema)
      }
      for (const option of document.options)
        if (option.field && !['list', 'find', 'stats'].includes(spec.id))
          assert.ok(
            document.fields.some((field) => field.name === option.field),
            `${spec.id}/${collection}: ${option.flags}`
          )
    }
  }
})

test('группы без подкоманды показывают обзор, а литерал --help в значении не запускает справку', async () => {
  for (const group of ['translation', 'revision', 'source', 'question', 'locale']) {
    const result = await invokeCli([group, '--format', 'json'])
    assert.equal(result.code, 0, result.stderr)
    const document = JSON.parse(result.stdout).data.structure
    assert.equal(document.operation, group)
    assert.ok(document.commands.length >= 2)
  }
  const program = createProgram()
  const parsed = inspectHelpRequest(program, ['update', 'release:example', '--description', '--help'])
  assert.equal(parsed.requested, false)
  assert.equal(inspectHelpRequest(program, ['read', '--', '--help']).requested, false)
})

test('недопустимый справочный контекст выдаёт один JSON ошибки и действующую следующую команду', async () => {
  const invalid = await invokeCli(['help', 'translation', 'set', 'packet:example', '--format', 'json'])
  assert.equal(invalid.code, 2)
  assert.equal(invalid.stdout, '')
  const error = JSON.parse(invalid.stderr).error
  assert.ok(error.nextSteps.length)
  assert.ok(error.message.includes('неприменима'))
  const mismatched = await invokeCli(['help', 'update', 'release:example', '--type', 'protocols', '--format', 'json'])
  assert.equal(mismatched.code, 2)
  const unknown = await invokeCli(['help', 'source', 'invented', '--format', 'json'])
  assert.equal(unknown.code, 2)
  assert.equal(unknown.stdout, '')
  assert.equal(JSON.parse(unknown.stderr).ok, false)
})

test('смешанный read --help сохраняет все типы адресов, не считая позиционный протокол контекстом', async () => {
  const result = await invokeCli(['read', 'protocol:1', 'release:example', '--help', '--format', 'json'])
  assert.equal(result.code, 0, result.stderr)
  const document = JSON.parse(result.stdout).data.structure
  assert.deepEqual(document.context.collections, ['protocols', 'releases'])
  assert.equal(document.context.protocol, undefined)
  assert.deepEqual(
    document.types.map((type) => type.type),
    ['protocols', 'releases']
  )
})

test('новый и прежний каналы batch не выбираются скрытым приоритетом и не читают конфликтующий stdin', async () => {
  const result = await invokeCli(['batch', '--file', '-', '--input', '-', '--format', 'json'], 'это не JSON')
  assert.equal(result.code, 2)
  assert.equal(result.stdout, '')
  assert.equal(JSON.parse(result.stderr).error.code, 'USAGE')
})

test('навигация совместимости и metadata совпадают; старое изменение массивов не выдаётся за новое', () => {
  const program = createProgram()
  const root = helpDocument(program)
  assert.deepEqual(
    root.legacyCommands.map((command) => command.name),
    LEGACY_ROOTS
  )
  assert.equal(
    root.commands.some((command) => LEGACY_ROOTS.includes(command.name)),
    false
  )
  const document = helpDocument(
    program.commands
      .find((command) => command.name() === 'packets')
      .commands.find((command) => command.name() === 'update')
  )
  assert.equal(document.legacy, true)
  assert.ok(helpText(document).includes('заменяет массивы'))
})
