import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { openDatabase, parseEntry } from '@l2ce/database'
import { cli, failure, fixture, jsonCli, shellCli, success } from './helpers.mjs'

const literal = '# Документ\n\n  Отступы  \n\n```text\n$ `код` "кавычки" \\n a=b=c\n```\n\n{{link protocol:273}}\n'

test('help/schema/types работают без SQLite и описывают публичный ввод', async (t) => {
  const { parent } = await fixture(t)
  const missing = join(parent, 'missing.sqlite')
  for (const args of [
    ['help'],
    ['help', 'workflow', 'catalog'],
    ['schema', 'create', '--type', 'releases'],
    ['schema', 'update', 'packet:example:rev-1'],
    ['types']
  ]) {
    const result = await cli(['--database', missing, ...args])
    assert.equal(result.code, 0, result.stderr)
    assert.ok(result.stdout.length)
  }
  const schema = success(await jsonCli(['--database', missing, 'schema', 'create', '--type', 'releases']))
  assert.deepEqual(schema.schema.required, ['chronicle'])
  assert.equal(schema.fields.find((field) => field.name === 'description').format, 'markdown')
  assert.equal(schema.fields.find((field) => field.name === 'description').scope, 'translation')
  assert.equal(existsSync(missing), false)
})

test('текстовые create/link/update строят каталог без UUID, JSON и специальных релизов', async (t) => {
  const { run, json } = await fixture(t)
  for (const args of [
    ['create', 'branch:new', '--title', 'Новая ветка'],
    ['create', 'saga:new', '--branch', 'new', '--title', 'Сага'],
    ['create', 'chronicle:new', '--branch', 'new', '--saga', 'new'],
    ['create', 'release:new', '--chronicle', 'new', '--title', 'Релиз'],
    ['create', 'region:na', '--title', 'Регион'],
    ['create', 'release-context:new:na', '--region', 'na'],
    ['link', 'release-context:new:na', 'protocols', 'protocol:273']
  ]) {
    const result = await run(args)
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /Сохранено/)
  }
  const before = success(await json(['read', 'release:new', '--view', 'edit'])).items[0].record
  assert.match(before.id, /^[\da-f-]{36}$/)
  const updated = await run(['link', 'release:new', 'chronicle', 'chronicle:c4', '--replace', '--dry-run'])
  assert.equal(updated.code, 0, updated.stderr)
  assert.match(updated.stdout, /chronicle:c4/)
  success(await json(['link', 'release:new', 'chronicle', 'chronicle:c4', '--replace']))
  const after = success(await json(['read', 'release:new', '--view', 'edit'])).items[0].record
  assert.equal(after.id, before.id)
  assert.equal(after.key, before.key)
  assert.equal(
    success(await json(['read', 'release-context:new:na', '--view', 'edit'])).items[0].record.release,
    'release:new'
  )
})

test('многострочный аргумент, stdin, файл и content сохраняют точные байты и другие языки', async (t) => {
  const { run, json, parent } = await fixture(t)
  const key = 'packet:key-packet:rev-1'
  success(
    await json([
      'update',
      key,
      '--status',
      'partial',
      '--translation-status',
      'outdated',
      '--add',
      'states=authenticated'
    ])
  )
  const before = success(await json(['read', key, '--view', 'edit'])).items[0].record
  const preview = await run(['update', key, '--locale', 'ru', '--description', literal, '--dry-run'])
  assert.equal(preview.code, 0, preview.stderr)
  assert.match(preview.stdout, /translation.ru.description/)
  assert.match(preview.stdout, /protocol:656/)
  assert.equal(
    (await run(['read', key, '--locale', 'ru', '--content', 'description'])).stdout,
    before.translations.find((text) => text.locale === 'ru').description
  )
  for (const [args, input] of [
    [['--description', literal], ''],
    [['--set', `description=${literal}`], ''],
    [['--set-stdin', 'description'], literal]
  ]) {
    const saved = await run(['update', key, '--locale', 'ru', ...args], input)
    assert.equal(saved.code, 0, saved.stderr)
    const content = await run(['read', key, '--locale', 'ru', '--content', 'description'])
    assert.equal(content.stdout, literal)
  }
  await writeFile(join(parent, 'draft.md'), literal)
  success(await json(['update', key, '--set-file', 'description=draft.md']))
  const after = success(await json(['read', key, '--view', 'edit'])).items[0].record
  assert.deepEqual(
    after.translations.find((text) => text.locale === 'en'),
    before.translations.find((text) => text.locale === 'en')
  )
  assert.deepEqual(after.protocols, before.protocols)
  assert.deepEqual(after.opcode, before.opcode)
  assert.deepEqual(after.states, before.states)
  assert.equal(after.status, before.status)
  assert.equal(after.translations.find((text) => text.locale === 'ru').translationStatus, 'outdated')
  assert.deepEqual(after.translations[1]?.sources, before.translations[1]?.sources)
  const both = await run(['update', key, '--set', 'title=Первая\nстрока', '--set', 'summary=Вторая\nстрока'])
  assert.equal(both.code, 0, both.stderr)
  failure(await json(['update', key, '--description', 'x', '--set-stdin', 'description'], 'y'), 'USAGE', 2)
  failure(await json(['update', key, '--input', '-', '--set-stdin', 'description'], '{}'), 'USAGE', 2)
  failure(await json(['update', key, '--set', 'unknown=x']), 'INVALID_INPUT', 2)
})

test('смешанное чтение не использует позиционные протоколы как контекст и различает пропуски', async (t) => {
  const { json, run } = await fixture(t)
  success(await json(['create', 'region:na', '--title', 'Регион']))
  const keys = ['chronicle:c4', 'protocol:152', 'protocol:273', 'region:na', 'packet:key-packet', 'release:absent']
  const result = await json(['read', ...keys, '--view', 'brief'])
  assert.equal(result.code, 3, result.stderr)
  const envelope = JSON.parse(result.stdout)
  assert.equal(envelope.ok, true)
  assert.equal(envelope.meta.itemsComplete, false)
  assert.deepEqual(
    envelope.data.items.map((item) => item.key),
    keys
  )
  assert.equal(envelope.data.items[4].revisionKey, undefined)
  assert.deepEqual(envelope.data.items[4].revisions, ['packet:key-packet:rev-1'])
  const explicit = success(await json(['read', ...keys.slice(0, -1), '--protocol', '273', '--view', 'full']))
  assert.equal(explicit.items[4].revisionKey, 'packet:key-packet:rev-1')
  const text = await run(['read', ...keys.slice(0, -1), '--protocol', '273'])
  assert.equal(text.code, 0, text.stderr)
  assert.match(text.stdout, /PAGE \w+ BEGIN/)
  assert.match(text.stdout, /RECORD \w+ 5\/5 END/)
  assert.match(text.stdout, /FIELD \w+ 5 description ru BEGIN/)
  failure(await json(['read', 'release:absent']), 'NOT_FOUND', 3)
})

test('переводы, вопросы и источники меняются адресно с явной языковой областью', async (t) => {
  const { json, run } = await fixture(t)
  const key = 'protocol:273'
  success(await json(['translation', 'set', key, '--locale', 'en', '--title', 'English']))
  success(
    await json(['source', 'add', key, '--locale', 'en', '--url', 'https://example.invalid/a', '--title', 'Источник'])
  )
  success(await json(['source', 'add', key, '--locale', 'ru', '--url', 'https://keep.invalid/a', '--title', 'Другой']))
  success(await json(['question', 'add', key, '--locale', 'en', '--text', 'Почему?']))
  const preview = await run([
    'source',
    'remove',
    key,
    '--locale',
    'en',
    '--match-host',
    'example.invalid',
    '--all-matches',
    '--dry-run'
  ])
  assert.equal(preview.code, 0, preview.stderr)
  assert.match(preview.stdout, /example.invalid\/a/)
  assert.match(preview.stdout, /translation.en.sources/)
  success(
    await json([
      'source',
      'update',
      key,
      '--locale',
      'en',
      '--match-url',
      'https://example.invalid/a',
      '--summary',
      'Пояснение'
    ])
  )
  success(
    await json([
      'source',
      'update',
      key,
      '--locale',
      'en',
      '--match-url',
      'https://example.invalid/a',
      '--clear',
      'summary'
    ])
  )
  const english = success(await json(['read', key, '--locale', 'en'])).items[0].record.translations[0]
  assert.equal('summary' in english.sources[0], false)
  failure(await json(['source', 'clear', key]), 'USAGE', 2)
  success(await json(['translation', 'delete', key, '--locale', 'en']))
  const after = success(await json(['read', key, '--view', 'edit'])).items[0].record
  assert.equal(
    after.translations.some((text) => text.locale === 'en'),
    false
  )
  assert.equal(after.translations.find((text) => text.locale === 'ru').sources.at(-1).url, 'https://keep.invalid/a')
})

test('батч использует публичные операции, относительные files и конечный граф; ошибка откатывает всё', async (t) => {
  const { json, parent } = await fixture(t)
  await writeFile(join(parent, 'draft.md'), literal)
  const operations = [
    {
      op: 'create',
      key: 'release:batch',
      values: { chronicle: 'chronicle:batch', title: 'Первый' },
      files: { description: './draft.md' }
    },
    { op: 'create', key: 'chronicle:batch', values: { branch: 'branch:main' } },
    { op: 'update', key: 'release:batch', values: { title: 'Последний' } },
    { op: 'translation.set', key: 'release:batch', locale: 'en', values: { title: 'English' } },
    {
      op: 'source.add',
      key: 'release:batch',
      locale: 'en',
      values: { url: 'https://example.invalid', title: 'Source' }
    }
  ]
  await writeFile(join(parent, 'batch.json'), JSON.stringify({ formatVersion: 1, operations }))
  success(await json(['batch', '--input', 'batch.json']))
  const read = success(await json(['read', 'release:batch', '--view', 'edit'])).items[0].record
  assert.equal(read.translations.find((text) => text.locale === 'ru').description, literal)
  assert.equal(read.translations.find((text) => text.locale === 'ru').title, 'Последний')
  const before = JSON.parse((await json(['status'])).stdout).meta.version
  failure(
    await json(['batch', '--input', '-'], {
      formatVersion: 1,
      operations: [
        { op: 'update', key: 'release:batch', values: { title: 'Не сохранять' } },
        { op: 'update', key: 'release:absent', values: { title: 'Ошибка' } }
      ]
    }),
    'NOT_FOUND',
    3
  )
  assert.equal(JSON.parse((await json(['status'])).stdout).meta.version, before)
  failure(await json(['update', 'release:batch', '--chronicle', 'missing']), 'VALIDATION_ERROR', 2)
})

test('пагинация 105 пакетов не обрезает документы; курсоры сохраняют запрос и конфликтуют при смене базы', async (t) => {
  const { json, run, database, parent } = await fixture(t)
  const db = openDatabase({ database })
  const snapshot = db.snapshot()
  const additions = Array.from({ length: 105 }, (_, index) => {
    const code = `bulk-${String(index).padStart(3, '0')}`
    return [
      parseEntry({
        collection: 'packets',
        kind: 'entity',
        key: `packet:${code}`,
        value: {
          id: randomUUID(),
          key: `packet:${code}`,
          code,
          name: code,
          server: 'game',
          direction: 'client-to-server'
        }
      }),
      parseEntry({
        collection: 'packet-revisions',
        kind: 'implementation',
        key: `packet:${code}:rev-1`,
        value: {
          id: randomUUID(),
          key: `packet:${code}:rev-1`,
          packetKey: `packet:${code}`,
          rev: 1,
          protocolKeys: ['protocol:273'],
          translations: [
            { locale: 'ru', title: code, summary: 'Аннотация', description: `${literal}\n${index}\n` },
            { locale: 'en', title: code, summary: 'Summary', description: `Full ${index}` }
          ]
        }
      })
    ]
  }).flat()
  db.replaceSnapshot({ ...snapshot, entries: [...snapshot.entries, ...additions] })
  db.close()
  const all = success(await json(['list', '--type', 'packets', '--protocol', '273', '--all']))
  assert.ok(all.items.length >= 105)
  const full = success(
    await json(['list', '--type', 'packets', '--protocol', '273', '--view', 'full', '--all-locales', '--all'])
  )
  assert.deepEqual(
    full.items.map((item) => item.key),
    all.items.map((item) => item.key)
  )
  assert.equal(
    full.items.find((item) => item.key === 'packet:bulk-104').record.translations.find((text) => text.locale === 'ru')
      .description,
    `${literal}\n104\n`
  )
  const keys = additions.filter((entry) => entry.kind === 'entity').map((entry) => entry.key)
  assert.equal(success(await json(['read', ...keys, '--protocol', '273', '--view', 'brief'])).items.length, 105)
  const first = JSON.parse(
    (await json(['read', ...keys, '--protocol', '273', '--view', 'full', '--limit', '10'])).stdout
  )
  const continued = success(await shellCli(first.meta.continuation, { cwd: parent }))
  assert.equal(continued.items[0].key, keys[10])
  const second = await run([
    'read',
    ...keys,
    '--protocol',
    '273',
    '--view',
    'full',
    '--limit',
    '3',
    '--after',
    first.meta.page.nextCursor
  ])
  assert.equal(second.code, 0, second.stderr)
  assert.match(second.stdout, /записи 11–13 из 105/)
  assert.match(second.stdout, /RECORD \w+ 11\/105 BEGIN/)
  assert.match(second.stdout, /Продолжить: .*index\.js read/)
  failure(
    await json([
      'read',
      ...keys,
      '--protocol',
      '273',
      '--view',
      'brief',
      '--limit',
      '10',
      '--after',
      first.meta.page.nextCursor
    ]),
    'INVALID_CURSOR',
    2
  )
  success(
    await json(['list', '--type', 'packets', '--protocol', '273', '--limit', '50', '--save-selection', 'packets.json'])
  )
  const selection = JSON.parse(await readFile(join(parent, 'packets.json'), 'utf8'))
  assert.equal(selection.items.length, 50)
  assert.ok(selection.items.every((item) => item.revisionKey))
  success(await json(['update', 'packet:bulk-000', '--name', 'Changed']))
  failure(
    await json([
      'read',
      ...keys,
      '--protocol',
      '273',
      '--view',
      'full',
      '--limit',
      '10',
      '--after',
      first.meta.page.nextCursor
    ]),
    'REVISION_CONFLICT',
    4
  )
  failure(await json(['delete', '--selection', 'packets.json', '--cascade-owned']), 'REVISION_CONFLICT', 4)
  const reread = await run(['read', '--selection', 'packets.json', '--protocol', '273', '--view', 'brief'])
  assert.equal(reread.code, 0, reread.stderr)
  assert.match(reread.stdout, /Выборка создана на версии/)
})
