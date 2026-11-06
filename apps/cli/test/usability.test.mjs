import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { cliLauncher, shellArgument } from '../dist/commands/invocation.js'
import { createCliProgram } from '../dist/commands/program.js'
import { commandPath } from '../dist/help/legacy.js'
import { invokeCli } from './support/help-runner.mjs'
import { cli, executable, failure, fixture, jsonCli, shellCli, success } from './helpers.mjs'

const collect = (command) => [command, ...command.commands.flatMap(collect)]
const workspace = fileURLToPath(new URL('../../../', import.meta.url))

test('launcher различает workspace, прямой Node.js и установленный бинарник; аргументы экранируются', () => {
  assert.deepEqual(cliLauncher([process.execPath, executable], {}, '/tmp/opencode'), [process.execPath, executable])
  assert.deepEqual(
    cliLauncher(
      [process.execPath, executable],
      {
        npm_lifecycle_event: 'cli',
        npm_lifecycle_script: 'node apps/cli/dist/index.js'
      },
      workspace
    ),
    ['pnpm', '--silent', 'cli']
  )
  assert.deepEqual(
    cliLauncher(
      [process.execPath, executable],
      {
        npm_lifecycle_event: 'cli',
        npm_lifecycle_script: 'node apps/cli/dist/index.js help --brief'
      },
      workspace
    ),
    ['pnpm', '--silent', 'cli']
  )
  assert.deepEqual(cliLauncher([process.execPath, '/opt/tools/protocols-db'], {}, workspace), [
    '/opt/tools/protocols-db'
  ])
  assert.deepEqual(
    cliLauncher(
      [process.execPath, executable],
      {
        npm_lifecycle_event: 'cli',
        npm_lifecycle_script: 'unrelated script'
      },
      workspace
    ),
    [process.execPath, executable]
  )
  assert.equal(shellArgument("a'b $(touch sentinel)"), "'a'\\''b $(touch sentinel)'")
})

test('краткая справка всех маршрутов и workflow работает без базы; полный контракт сохранён', async () => {
  const missing = `/tmp/opencode/brief-no-database-${process.pid}.sqlite`
  assert.equal(existsSync(missing), false)
  const program = createCliProgram({ stdout: '', stderr: '' })
  for (const command of collect(program)) {
    const result = await invokeCli(['--database', missing, ...commandPath(command), '--help', '--brief'])
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /Usage:/)
    assert.match(result.stdout, /Безопасность:/)
    assert.match(result.stdout, /Полная справка:/)
  }
  const full = await invokeCli(['help', 'update', 'release:example'])
  const brief = await invokeCli(['help', 'update', 'release:example', '--brief'])
  assert.ok(brief.stdout.length < full.stdout.length * 0.65)
  assert.match(brief.stdout, /title.*--title/)
  assert.doesNotMatch(brief.stdout, /--opcode/)
  assert.match(brief.stdout, /--dry-run/)
  assert.match(brief.stdout, /--if-version/)
  assert.match(full.stdout, /Ошибки и исправление:/)
  const create = await invokeCli(['help', 'create', '--type', 'releases', '--brief'])
  assert.match(create.stdout, /chronicle \(обязательно\)/)
  const workflow = await invokeCli(['help', 'workflow', 'catalog', '--brief'])
  assert.equal(workflow.code, 0, workflow.stderr)
  assert.match(workflow.stdout, /Полная справка: protocols-db help workflow catalog/)
  assert.equal(existsSync(missing), false)
})

test('structure-only убирает только дублирующий текст; brief не урезает JSON Schema', async () => {
  const args = ['help', 'update', 'release:example', '--format', 'json']
  const full = success(await invokeCli(args))
  const structured = success(await invokeCli([...args, '--structure-only']))
  assert.deepEqual(Object.keys(structured), ['structure'])
  assert.deepEqual(structured.structure, full.structure)
  const schemaArgs = ['schema', 'create', '--type', 'releases', '--format', 'json']
  assert.deepEqual(success(await invokeCli([...schemaArgs, '--brief'])), success(await invokeCli(schemaArgs)))
  for (const invalid of [
    ['help', '--structure-only'],
    ['help', '--structure-only', '--brief', '--format', 'json'],
    ['update', 'release:example', '--brief', '--format', 'json'],
    ['read', 'release:example', '--structure-only', '--format', 'json'],
    ['packets', 'get', 'example', '--brief', '--format', 'json']
  ]) {
    const result = await invokeCli(invalid)
    assert.equal(result.code, 2, `${invalid}: ${result.stderr}`)
    assert.equal(result.stdout, '')
  }
})

test('ошибки владения охватывают карточки, clear, связи и вложенные операции; редакция не выбирается', async (t) => {
  const { json, parent } = await fixture(t)
  const cases = [
    ['update', 'packet:key-packet', '--title', 'Название'],
    ['update', 'scenario:game-connection', '--clear', 'description'],
    ['update', 'article:game-framing', '--status', 'partial'],
    ['translation', 'set', 'packet:key-packet', '--title', 'Название'],
    ['source', 'list', 'packet:key-packet'],
    ['link', 'packet:key-packet', 'protocols', 'protocol:152']
  ]
  for (const args of cases) {
    const error = failure(await json(args), 'INVALID_INPUT', 2)
    assert.match(error.message, /технической редакции/)
    assert.ok(error.details.expectedOwnerType.endsWith('-revisions'))
    assert.match(error.nextSteps[0], /revision list/)
    assert.doesNotMatch(error.nextSteps[0], /rev-1/)
    for (const step of error.nextSteps) success(await shellCli(step, { cwd: parent }))
  }
})

test('ошибки разных команд предлагают исполнимые безопасные шаги на той же базе', async (t) => {
  const { json, database, parent, source } = await fixture(t)
  const notDirectory = join(parent, 'not-a-directory')
  await writeFile(notDirectory, 'fixture')
  success(
    await json([
      'source',
      'add',
      'protocol:273',
      '--locale',
      'en',
      '--url',
      'https://example.org/fixture',
      '--title',
      'Второй источник'
    ])
  )
  const cases = [
    ['create', 'release:new'],
    ['update', 'protocol:273', '--set', 'protocols=[]'],
    ['replace', 'protocol:273'],
    ['delete', 'packet:key-packet'],
    ['link', 'release:high-five', 'chronicle', 'chronicle:c4'],
    ['unlink', 'release:high-five', 'chronicle', 'chronicle:high-five'],
    ['source', 'update', 'protocol:273', '--summary', 'Пояснение'],
    [
      'source',
      'update',
      'protocol:273',
      '--locale',
      'en',
      '--match-url',
      'https://absent.invalid',
      '--title',
      'Заголовок'
    ],
    ['source', 'clear', 'protocol:273'],
    [
      'source',
      'update',
      'protocol:273',
      '-len',
      '--match-url',
      'https://example.org/fixture',
      '--summary',
      'Неоднозначно'
    ],
    ['question', 'clear', 'protocol:273'],
    ['translation', 'set', 'protocol:273', '--locale', 'zz', '--title', 'Нельзя'],
    ['revision', 'add', 'protocol:273'],
    ['locale', 'set-default', 'zz'],
    ['locale', 'delete', 'ru'],
    ['relations', 'protocol:273', '--in', '--out'],
    ['read', 'release:absent'],
    ['read', 'packet:key-packet', '--protocol', '152'],
    ['stats', '--by', 'unsupported'],
    ['tree', 'branch:absent'],
    ['find', 'fixture', '--type', 'regions', '--protocol', '273'],
    ['validate', 'release:absent'],
    ['validate', '--strict-links'],
    ['export', '--output', notDirectory],
    ['export', '--output', parent],
    ['import', '--input', source],
    ['import', '--input', join(parent, 'absent-snapshot'), '--replace'],
    ['init']
  ]
  const before = JSON.parse((await json(['status'])).stdout).meta.version
  for (const args of cases) {
    const result = await json(args)
    assert.ok(result.code >= 2, `${args}: команда должна отказать`)
    assert.equal(result.stdout, '')
    const error = JSON.parse(result.stderr).error
    if (args[0] === 'export') {
      assert.equal(result.code, 2, result.stderr)
      assert.equal(error.code, 'INVALID_DESTINATION')
    }
    assert.ok(error.nextSteps.length, `${args}: нет продолжения`)
    for (const step of error.nextSteps) {
      assert.ok(step.includes(database), `${args}: потеряна база в ${step}`)
      success(await shellCli(step, { cwd: parent }))
    }
    if (args.includes('-len')) assert.match(error.nextSteps[0], /--locale en/)
  }
  assert.equal(JSON.parse((await json(['status'])).stdout).meta.version, before)
})

test('блокировка экспорта имеет код занятости 5 и не предлагает автоматически повторять запись', async (t) => {
  const { json, parent } = await fixture(t)
  const output = join(parent, 'locked-export')
  const lock = `${output}.export.lock`
  await writeFile(lock, JSON.stringify({ pid: process.pid, output }))
  const error = failure(await json(['export', '--output', output]), 'EXPORT_BUSY', 5)
  assert.equal(existsSync(lock), true)
  assert.equal(existsSync(output), false)
  for (const step of error.nextSteps) success(await shellCli(step, { cwd: parent }))
})

test('батч показывает ошибочную операцию и её поля, а не только справку batch', async (t) => {
  const { json, parent } = await fixture(t)
  const error = failure(
    await json(['batch', '--input', '-'], {
      formatVersion: 1,
      operations: [
        { op: 'create', key: 'branch:rollback' },
        { op: 'update', key: 'packet:key-packet', values: { title: 'Нельзя' } }
      ]
    }),
    'INVALID_INPUT',
    2
  )
  assert.equal(error.details.operationIndex, 1)
  assert.equal(error.details.operation, 'update')
  assert.deepEqual(error.details.fields, ['title'])
  for (const step of error.nextSteps) success(await shellCli(step, { cwd: parent }))
  failure(await json(['read', 'branch:rollback']), 'NOT_FOUND', 3)
})

test('текстовая запись показывает новую версию, no-op сохраняет её, dry-run не обещает будущую', async (t) => {
  const { json, run } = await fixture(t)
  const before = JSON.parse((await json(['status'])).stdout).meta.version
  const preview = await run(['update', 'protocol:273', '--title', 'Новое', '--dry-run'])
  assert.equal(preview.code, 0, preview.stderr)
  assert.match(preview.stdout, new RegExp(`Исходная версия: ${before}`))
  assert.doesNotMatch(preview.stdout, /Сохранённая версия:/)
  const saved = await run(['update', 'protocol:273', '--title', 'Новое', '--if-version', before])
  const version = /Сохранённая версия: (v1:[a-f0-9]{64})/.exec(saved.stdout)?.[1]
  assert.ok(version)
  assert.notEqual(version, before)
  const noop = await run(['update', 'protocol:273', '--title', 'Новое', '--if-version', version])
  assert.match(noop.stdout, new RegExp(`Сохранённая версия: ${version}`))
  const conflict = failure(
    await json(['update', 'protocol:273', '--title', 'Не сохранять', '--if-version', before]),
    'REVISION_CONFLICT',
    4
  )
  assert.equal(conflict.details.expectedVersion, before)
  assert.equal(conflict.details.actualVersion, version)
})

test('пагинация list/find/read выполняет напечатанную команду, включая shell-символы и отдельную базу', async (t) => {
  const { parent, database } = await fixture(t)
  const directory = await mkdtemp(join(parent, "база с 'кавычкой' $ "))
  const moved = join(directory, 'example.sqlite')
  await rename(database, moved)
  const invoke = (args, input = '') => jsonCli(['--database', moved, ...args], input, { cwd: parent })
  const query = "$(touch sentinel) ' $ `echo x`"
  for (const key of ['protocol:273', 'protocol:656']) success(await invoke(['update', key, '--title', query]))
  for (const args of [
    ['list', '--type', 'protocols', '--locale', 'en'],
    ['find', query, '--type', 'protocols', '--locale', 'ru'],
    ['read', '--keys-file', '-', '--view', 'edit']
  ]) {
    const first = JSON.parse((await invoke([...args, '--limit', '1'], 'protocol:273\nprotocol:656\n')).stdout)
    assert.ok(first.meta.continuation)
    assert.ok(first.meta.continuation.includes('index.js'))
    assert.doesNotMatch(first.meta.continuation, /--keys-file/)
    const next = success(await shellCli(first.meta.continuation, { cwd: parent }))
    assert.notEqual(next.items[0].key, first.data.items[0].key)
  }
  assert.equal(existsSync(join(parent, 'sentinel')), false)
})

test('повреждённый и устаревший курсоры предлагают исходный запрос без повторного stdin', async (t) => {
  const { json, parent } = await fixture(t)
  const first = JSON.parse(
    (await json(['find', 'Test', '--type', 'protocols', '--locale', 'en', '--limit', '1'])).stdout
  )
  success(await json(['update', 'branch:main', '--title', 'Изменение']))
  const stale = failure(
    await json([
      'find',
      'Test',
      '--type',
      'protocols',
      '--locale',
      'en',
      '--limit',
      '1',
      '--after',
      first.meta.page.nextCursor
    ]),
    'REVISION_CONFLICT',
    4
  )
  assert.match(stale.nextSteps[0], /find Test/)
  assert.doesNotMatch(stale.nextSteps[0], /--after/)
  success(await shellCli(stale.nextSteps[0], { cwd: parent }))
  const broken = failure(
    await json(['read', '--keys-file', '-', '--limit', '1', '--after', 'broken'], 'protocol:273\nprotocol:656\n'),
    'INVALID_CURSOR',
    2
  )
  assert.doesNotMatch(broken.nextSteps[0], /--keys-file|--after/)
  success(await shellCli(broken.nextSteps[0], { cwd: parent }))
})

test('запрос find с ведущим дефисом остаётся текстом поиска в команде продолжения', async (t) => {
  const { json, parent } = await fixture(t)
  for (const key of ['protocol:273', 'protocol:656']) success(await json(['update', key, '--title', '--help']))
  const first = JSON.parse((await json(['find', '--type', 'protocols', '--limit', '1', '--', '--help'])).stdout)
  assert.equal(first.data.items.length, 1)
  assert.match(first.meta.continuation, /-- --help$/)
  const next = success(await shellCli(first.meta.continuation, { cwd: parent }))
  assert.notEqual(next.items[0].key, first.data.items[0].key)
})

test('stdin-выборка не обещает невоспроизводимую пагинацию и учитывается как читатель stdin', async (t) => {
  const { json } = await fixture(t)
  for (const args of [
    ['read', '--selection', '-', '--limit', '1'],
    ['update', '--selection', '-', '--set-stdin', 'description']
  ]) {
    const error = failure(await json(args, 'не читать как JSON'), 'USAGE', 2)
    assert.match(error.message, /stdin|пагинации/)
  }
})

test('неполное чтение объясняет отсутствие перевода и применимости и даёт продолжение каждой записи', async (t) => {
  const { json, parent, run } = await fixture(t)
  success(await json(['translation', 'delete', 'protocol:273', '--locale', 'en']))
  const missing = failure(await json(['read', 'protocol:273', '--locale', 'en']), 'NOT_FOUND', 3)
  assert.match(missing.message, /перевод en отсутствует/)
  assert.match(missing.nextSteps[0], /translation list protocol:273/)
  const partial = await json([
    'read',
    'protocol:273',
    'release:absent',
    'scenario:game-connection',
    '--locale',
    'en',
    '--protocol',
    '656'
  ])
  assert.equal(partial.code, 3, partial.stderr)
  const envelope = JSON.parse(partial.stdout)
  assert.equal(envelope.meta.itemsComplete, false)
  for (const item of envelope.data.items) {
    assert.ok(item.nextSteps.length)
    for (const step of item.nextSteps) success(await shellCli(step, { cwd: parent }))
  }
  const text = await run(['read', 'protocol:273', 'release:absent', '--locale', 'en'])
  assert.match(text.stdout, /Уточнить:/)
})

test('ошибка справки тоже сохраняет базу, а init/import показывают сохранённую версию', async (t) => {
  const { parent, database, source } = await fixture(t)
  const badHelp = failure(await jsonCli(['--database', database, 'help', 'invented']), 'USAGE', 2)
  assert.ok(badHelp.nextSteps[0].includes(database))
  success(await shellCli(badHelp.nextSteps[0], { cwd: parent }))
  for (const [name, args] of [
    ['init', ['init']],
    ['import', ['import', '--input', source, '--replace']]
  ]) {
    const target = join(parent, `${name}.sqlite`)
    const preview = await cli(['--database', target, ...args, '--dry-run'])
    assert.equal(preview.code, 0, preview.stderr)
    assert.doesNotMatch(preview.stdout, /Сохранённая версия:/)
    assert.equal(existsSync(target), false)
    const saved = await cli(['--database', target, ...args])
    assert.equal(saved.code, 0, saved.stderr)
    const version = /Сохранённая версия: (v1:[a-f0-9]{64})/.exec(saved.stdout)?.[1]
    assert.equal(version, JSON.parse((await jsonCli(['--database', target, 'status'])).stdout).meta.version)
  }
})

test('workspace-подсказки используют pnpm и не добавляют служебный вывод в JSON-потоки', async (t) => {
  const { database } = await fixture(t)
  const first = await shellCli(
    `pnpm --silent cli --database ${shellArgument(database)} list --type protocols --limit 1 --format json`,
    { cwd: workspace }
  )
  const envelope = JSON.parse(first.stdout)
  assert.equal(first.code, 0, first.stderr)
  assert.match(envelope.meta.continuation, /^pnpm --silent cli /)
  success(await shellCli(envelope.meta.continuation, { cwd: workspace }))
  const failed = await shellCli(
    `pnpm --silent cli --database ${shellArgument(database)} read release:absent --format json`,
    { cwd: workspace }
  )
  for (const step of failure(failed, 'NOT_FOUND', 3).nextSteps) {
    assert.match(step, /^pnpm --silent cli /)
    success(await shellCli(step, { cwd: workspace }))
  }
})
