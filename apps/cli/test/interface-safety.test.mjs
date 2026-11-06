import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, success, failure } from './helpers.mjs'
import { createRequire } from 'node:module'

const requireDatabase = createRequire(new URL('../../../packages/database/package.json', import.meta.url))
const Sqlite = requireDatabase('better-sqlite3')

test('import требует replace, проверяет dry-run и восстанавливает несовместимую схему', async (t) => {
  const { json, database, source } = await fixture(t)
  failure(await json(['import', '--input', source]), 'USAGE', 2)
  const raw = new Sqlite(database)
  raw.exec('DROP TABLE metadata; CREATE TABLE metadata (legacy TEXT)')
  raw.close()
  const preview = success(await json(['import', '--input', source, '--replace', '--dry-run']))
  assert.equal(preview.schemaReplaced, true)
  assert.notEqual(success(await json(['status'])).schema, 'current')
  success(await json(['import', '--input', source, '--replace']))
  assert.equal(success(await json(['status'])).schema, 'current')
})

test('поиск без протокола находит Markdown каталога, редакции знания и точный URL источника', async (t) => {
  const { run, json } = await fixture(t)
  success(await json(['update', 'release:c4', '--description', '# Только здесь\n\nЁЖИК — редкий термин.']))
  const found = await run(['find', 'ёжик', '--type', 'releases'])
  assert.equal(found.code, 0, found.stderr)
  assert.match(found.stdout, /release:c4/)
  assert.match(found.stdout, /description \(ru\)/)
  assert.equal(success(await json(['find', 'ёжик', '--type', 'releases'])).items[0].key, 'release:c4')
  success(await json(['update', 'article:game-framing:rev-1', '--description', 'Уникальное шифрование']))
  const knowledge = success(await json(['find', 'шифрование', '--type', 'articles']))
  assert.equal(knowledge.items[0].key, 'article:game-framing:rev-1')
  const sources = success(await json(['find', 'https://example.org/fixture', '--search-in', 'sources.url', '--all']))
  assert.ok(sources.items.length > 0)
  assert.ok(sources.items.every((item) => item.matches.some((match) => match.field === 'sources.url')))
  failure(await json(['list', '--type', 'countries', '--server', 'game']), 'INVALID_QUERY', 2)
  failure(await json(['list', '--has', 'invented']), 'INVALID_QUERY', 2)
})

test('all-locales не смешивает источник одного языка с вопросом другого', async (t) => {
  const { json } = await fixture(t)
  const key = 'protocol:273'
  success(
    await json(['source', 'add', key, '--locale', 'en', '--url', 'https://specific.invalid/en', '--title', 'English'])
  )
  success(await json(['question', 'add', key, '--locale', 'ru', '--text', 'Русский вопрос']))
  const empty = success(
    await json([
      'list',
      '--type',
      'protocols',
      '--has',
      'questions',
      '--source-host',
      'specific.invalid',
      '--all-locales',
      '--all'
    ])
  )
  assert.equal(empty.items.length, 0)
  success(await json(['question', 'add', key, '--locale', 'en', '--text', 'English question']))
  assert.equal(
    success(
      await json([
        'list',
        '--type',
        'protocols',
        '--has',
        'questions',
        '--source-host',
        'specific.invalid',
        '--all-locales',
        '--all'
      ])
    ).items.length,
    1
  )
})

test('совместные региональные фильтры не объединяют разные контексты одного протокола', async (t) => {
  const { json } = await fixture(t)
  for (const code of ['na', 'eu']) success(await json(['create', `region:${code}`]))
  success(await json(['create', 'release-context:c4:na', '--region', 'na']))
  success(await json(['create', 'release-context:high-five:eu', '--region', 'eu']))
  const context = success(await json(['read', 'release-context:c4:na', '--view', 'edit'])).items[0].record
  assert.equal(context.region, 'region:na')
  assert.deepEqual(context.translations, [])
  for (const key of ['release-context:c4:na', 'release-context:high-five:eu'])
    success(await json(['link', key, 'protocols', 'protocol:152']))
  assert.equal(
    success(await json(['list', '--type', 'protocols', '--release', 'c4', '--region', 'eu', '--all'])).items.length,
    0
  )
  assert.equal(
    success(await json(['list', '--type', 'protocols', '--release', 'c4', '--region', 'na', '--all'])).items.length,
    1
  )
  assert.ok(
    success(await json(['list', '--type', 'releases', '--protocol', '152', '--all'])).items.some(
      (item) => item.key === 'release:c4'
    )
  )
})

test('связи сохраняют соседние цели; перенос применимости требует replace и точный адрес редакции', async (t) => {
  const { json, run } = await fixture(t)
  const key = 'packet:key-packet:rev-1'
  success(await json(['unlink', key, 'protocols', 'protocol:656']))
  assert.deepEqual(success(await json(['read', key, '--view', 'edit'])).items[0].record.protocols, ['protocol:273'])
  const noop = await run(['link', key, 'protocols', 'protocol:273'])
  assert.equal(noop.code, 0, noop.stderr)
  assert.match(noop.stdout, /Без изменений/)
  success(await json(['revision', 'add', 'packet:key-packet', '--title', 'Другая редакция', '--opcode', 'u8:0']))
  failure(await json(['link', 'packet:key-packet:rev-2', 'protocols', 'protocol:273']), 'CONFLICT', 4)
  success(await json(['link', 'packet:key-packet:rev-2', 'protocols', 'protocol:273', '--replace']))
  assert.deepEqual(success(await json(['read', key, '--view', 'edit'])).items[0].record.protocols, [])
  assert.equal(
    success(await json(['read', 'packet:key-packet', '--protocol', '273'])).items[0].revisionKey,
    'packet:key-packet:rev-2'
  )
  failure(await json(['link', 'packet:key-packet', 'protocols', 'protocol:273']), 'INVALID_INPUT', 2)
  failure(await json(['link', 'release:c4', 'protocols', 'protocol:152']), 'USAGE', 2)
  success(await json(['link', 'release:c4', 'protocols', 'protocol:152', '--unscoped']))
  success(await json(['link', 'release:c4', 'protocols', 'protocol:152', '--before', 'protocol:656', '--unscoped']))
  assert.deepEqual(success(await json(['read', 'release:c4', '--view', 'edit'])).items[0].record.protocols, [
    'protocol:152',
    'protocol:656'
  ])
})

test('сохранённая выборка очищает только точные источники владельцев и не расширяет пустой набор', async (t) => {
  const { json, run } = await fixture(t)
  for (const [locale, host] of [
    ['ru', 'remove.invalid'],
    ['en', 'keep.invalid']
  ]) {
    success(
      await json([
        'source',
        'add',
        'protocol:273',
        '--locale',
        locale,
        '--url',
        `https://${host}/source`,
        '--title',
        host
      ])
    )
  }
  success(
    await json([
      'list',
      '--type',
      'protocols',
      '--source-host',
      'remove.invalid',
      '--all-locales',
      '--all',
      '--save-selection',
      'sources.json'
    ])
  )
  const preview = await run([
    'source',
    'remove',
    '--selection',
    'sources.json',
    '--all-locales',
    '--match-host',
    'remove.invalid',
    '--all-matches',
    '--dry-run'
  ])
  assert.equal(preview.code, 0, preview.stderr)
  assert.match(preview.stdout, /https:\/\/remove.invalid\/source/)
  success(
    await json([
      'source',
      'remove',
      '--selection',
      'sources.json',
      '--all-locales',
      '--match-host',
      'remove.invalid',
      '--all-matches'
    ])
  )
  const after = success(await json(['read', 'protocol:273', '--view', 'edit'])).items[0].record
  assert.ok(
    after.translations
      .find((text) => text.locale === 'en')
      .sources.some((source) => source.url === 'https://keep.invalid/source')
  )
  assert.equal(
    after.translations
      .find((text) => text.locale === 'ru')
      .sources.some((source) => source.url === 'https://remove.invalid/source'),
    false
  )
  success(await json(['find', 'zero-nonexistent', '--all', '--save-selection', 'empty.json']))
  assert.equal(success(await json(['source', 'clear', '--selection', 'empty.json', '--all-locales'])).changed, 0)
})

test('replace защищён версией, редакция from копирует содержимое с новыми UUID и без применимости', async (t) => {
  const { json } = await fixture(t)
  const original = success(await json(['read', 'packet:key-packet:rev-1', '--view', 'edit'])).items[0].record
  success(await json(['revision', 'add', 'packet:key-packet', '--from', original.key, '--title', 'Копия']))
  const copied = success(await json(['read', 'packet:key-packet:rev-2', '--view', 'edit'])).items[0].record
  assert.notEqual(copied.id, original.id)
  assert.deepEqual(copied.protocols, [])
  assert.notEqual(copied.translations[0].sources[0].id, original.translations[0].sources[0].id)
  assert.equal(copied.translations.find((text) => text.locale === 'ru').title, 'Копия')
  const read = JSON.parse((await json(['read', 'release:c4', '--view', 'edit', '--with-version'])).stdout)
  const record = read.data.items[0].record
  failure(await json(['replace', record.key, '--input', '-'], record), 'USAGE', 2)
  record.translations.find((text) => text.locale === 'ru').title = 'Заменён'
  success(await json(['replace', record.key, '--input', '-', '--if-version', read.meta.version], record))
  failure(
    await json(['update', record.key, '--title', 'Устаревшая запись', '--if-version', read.meta.version]),
    'REVISION_CONFLICT',
    4
  )
  const current = JSON.parse((await json(['status'])).stdout).meta.version
  failure(
    await json(['replace', record.key, '--input', '-', '--if-version', current], { ...record, code: 'rename' }),
    'INVALID_INPUT',
    2
  )
})

test('удаление защищает владельцев и Markdown, языки не удаляются вместе с переводами скрыто', async (t) => {
  const { json } = await fixture(t)
  failure(await json(['delete', 'packet:key-packet']), 'CONFLICT', 4)
  success(await json(['update', 'protocol:273', '--description', '{{link release:c4}}']))
  failure(await json(['delete', 'release:c4']), 'CONFLICT', 4)
  success(await json(['delete', 'release:c4', '--allow-broken-links']))
  success(await json(['locale', 'add', 'de']))
  success(await json(['translation', 'set', 'protocol:273', '--locale', 'de', '--title', 'Deutsch']))
  failure(await json(['locale', 'delete', 'de']), 'CONFLICT', 4)
  success(await json(['translation', 'delete', 'protocol:273', '--locale', 'de']))
  success(await json(['locale', 'delete', 'de']))
  failure(await json(['locale', 'delete', 'ru']), 'CONFLICT', 4)
  const knownZero = success(await json(['list', '--type', 'packet-revisions', '--has', 'opcode', '--all']))
  assert.ok(knownZero.items.some((item) => item.key === 'packet:key-packet:rev-1' && item.record.opcode[0].value === 0))
})
