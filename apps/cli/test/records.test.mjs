import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { fixture, success, failure } from './helpers.mjs'

test('агент создаёт карточку и переиспользуемую редакцию без ручных UUID', async (t) => {
  const { json, parent, run } = await fixture(t)
  const created = success(
    await json([
      'packets',
      'create',
      'example',
      '--name',
      'ExamplePacket',
      '--server',
      'game',
      '--direction',
      'client-to-server'
    ])
  )
  assert.equal(created.changes[0].key, 'packet:example')
  const markdown = join(parent, 'packet.md')
  await writeFile(markdown, '# Пример\n\nТекст  \n')
  success(
    await json([
      'packets',
      'add-revision',
      'example',
      '--rev',
      '1',
      '--protocols',
      '273,656',
      '--title',
      'Пример',
      '--markdown',
      markdown
    ])
  )
  const read = success(await json(['packets', 'get', 'example', '--protocol', '273']))
  assert.equal(read.items[0].markdown, '# Пример\n\nТекст  \n')
  const raw = success(await json(['packets', 'inspect', 'example', '--rev', '1'])).items[0].value
  assert.match(raw.id, /^[a-f0-9-]{36}$/)
  assert.deepEqual(raw.protocolKeys, ['protocol:273', 'protocol:656'])
  const human = await run(['packets', 'update', 'example', '--name', 'RenamedPacket'])
  assert.match(human.stdout, /Ключ: packet:example/)
  assert.match(human.stdout, /Изменено записей: 1/)
})

test('обновление одного перевода сохраняет остальные языки и назначает UUID источнику', async (t) => {
  const { json } = await fixture(t)
  const before = success(await json(['packets', 'inspect', 'key-packet', '--rev', '1'])).items[0].value
  const english = before.translations.find((value) => value.locale === 'en')
  success(
    await json(['packets', 'translate', 'key-packet', '--rev', '1', '--locale', 'ru', '--file', '-'], {
      description: 'Обновлённый текст',
      source: [{ url: 'https://example.org/source', title: 'Источник' }]
    })
  )
  const after = success(await json(['packets', 'inspect', 'key-packet', '--rev', '1'])).items[0].value
  assert.deepEqual(
    after.translations.find((value) => value.locale === 'en'),
    english
  )
  assert.equal(after.translations.find((value) => value.locale === 'ru').description, 'Обновлённый текст')
  assert.match(after.translations.find((value) => value.locale === 'ru').source[0].id, /^[a-f0-9-]{36}$/)
  assert.deepEqual(after.opcode, before.opcode)
  assert.deepEqual(after.protocolKeys, before.protocolKeys)
})

test('dry-run, no-op и конфликт общей ревизии защищают данные', async (t) => {
  const { json } = await fixture(t)
  const before = success(await json(['status']))
  const preview = success(await json(['packets', 'update', 'key-packet', '--name', 'Preview', '--dry-run']))
  assert.equal(preview.changed, 1)
  assert.equal(preview.dryRun, true)
  assert.equal(success(await json(['status'])).revision, before.revision)
  const saved = success(
    await json(['packets', 'update', 'key-packet', '--name', 'Preview', '--if-revision', before.revision])
  )
  assert.equal(saved.revision, preview.revision)
  failure(
    await json(['packets', 'update', 'key-packet', '--name', 'Preview', '--if-revision', before.revision]),
    'REVISION_CONFLICT',
    4
  )
  assert.equal(success(await json(['packets', 'update', 'key-packet', '--name', 'Preview'])).changed, 0)
})

test('невалидная применимость и входные данные отклоняются без частичных изменений', async (t) => {
  const { json } = await fixture(t)
  const before = success(await json(['status'])).revision
  failure(
    await json(['packets', 'update-revision', 'key-packet', '--rev', '1', '--protocols', '999999']),
    'VALIDATION_ERROR',
    2
  )
  failure(await json(['packets', 'update', 'key-packet', '--file', '-'], '{broken'), 'INVALID_JSON', 2)
  failure(
    await json(['packets', 'update', 'key-packet', '--file', '-'], {
      code: 'another'
    }),
    'VALIDATION_ERROR',
    2
  )
  assert.equal(success(await json(['status'])).revision, before)
  failure(await json(['protocols', 'create', '152', '--file', '-'], { number: 153 }), 'INVALID_INPUT', 2)
})

test('пакет проверяет связи в конечном состоянии и откатывает ошибку второй операции', async (t) => {
  const { json } = await fixture(t)
  const branch = {
    collection: 'branches',
    kind: 'entity',
    key: 'branch:new',
    value: { key: 'branch:new', code: 'new' }
  }
  const chronicle = {
    collection: 'chronicles',
    kind: 'entity',
    key: 'chronicle:new',
    value: { key: 'chronicle:new', code: 'new', branchKey: 'new' }
  }
  success(
    await json(['batch', '--file', '-'], {
      operations: [
        { op: 'create', entry: chronicle },
        { op: 'create', entry: branch }
      ]
    })
  )
  const before = success(await json(['status'])).revision
  failure(
    await json(['batch', '--file', '-'], {
      operations: [
        {
          op: 'update',
          target: {
            collection: 'packets',
            kind: 'entity',
            key: 'packet:key-packet'
          },
          patch: { name: 'Should rollback' }
        },
        {
          op: 'delete',
          target: {
            collection: 'packets',
            kind: 'entity',
            key: 'packet:absent'
          }
        }
      ]
    }),
    'NOT_FOUND',
    3
  )
  assert.equal(success(await json(['status'])).revision, before)
})

test('delete не читает stdin и показывает каскадное удаление редакций', async (t) => {
  const { json } = await fixture(t)
  const removed = success(await json(['packets', 'delete', 'key-packet'], 'не JSON'))
  assert.equal(removed.changed, 2)
  assert.equal(success(await json(['packets', 'inspect', 'key-packet'])).items[0].found, false)
})
