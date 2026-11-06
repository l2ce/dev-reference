import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import test from 'node:test'
import { openDatabase, exportDatabase, importDatabase } from '../dist/index.js'
import { fixture } from './helpers.mjs'
import { regionalFixture } from './fixtures/regional.mjs'

test('хроника-группа и единственный релиз могут иметь одинаковые код и название', async (t) => {
  const { database } = await fixture(t)
  const translations = [{ locale: 'ru', title: 'The Kamael', summary: '', description: '' }]
  database.applyChanges([
    {
      op: 'create',
      entry: {
        collection: 'chronicles',
        kind: 'entity',
        key: 'chronicle:the-kamael',
        value: {
          id: randomUUID(),
          key: 'chronicle:the-kamael',
          code: 'the-kamael',
          branchKey: 'branch:main',
          translations
        }
      }
    },
    {
      op: 'create',
      entry: {
        collection: 'releases',
        kind: 'entity',
        key: 'release:the-kamael',
        value: {
          id: randomUUID(),
          key: 'release:the-kamael',
          code: 'the-kamael',
          chronicleKey: 'chronicle:the-kamael',
          translations
        }
      }
    }
  ])
  const chronicle = database.get({ collection: 'chronicles', key: 'chronicle:the-kamael' })
  const releases = database.list({ collection: 'releases', ownerKey: chronicle.key })
  assert.equal(releases.total, 1)
  assert.equal(releases.items[0].translations[0].title, chronicle.translations[0].title)
  assert.notEqual(releases.items[0].id, chronicle.id)
  assert.equal(releases.items[0].code, 'the-kamael')
  assert.equal(chronicle.sagaKey, null)
})

test('сага необязательна, принадлежит ветке и не может содержать хронику другой ветки', async (t) => {
  const { database } = await fixture(t)
  database.create({
    collection: 'sagas',
    kind: 'entity',
    key: 'saga:the-chaotic-throne',
    value: {
      id: randomUUID(),
      key: 'saga:the-chaotic-throne',
      code: 'the-chaotic-throne',
      branchKey: 'branch:main'
    }
  })
  const target = { collection: 'chronicles', key: 'chronicle:high-five', kind: 'entity' }
  database.update({ target, patch: { sagaKey: 'saga:the-chaotic-throne' } })
  assert.equal(database.list({ collection: 'sagas', branchKey: 'branch:main' }).total, 1)
  assert.equal(database.list({ collection: 'chronicles', sagaKey: 'saga:the-chaotic-throne' }).total, 1)
  assert.equal(database.list({ collection: 'chronicles', sagaKey: 'saga:unknown' }).total, 0)
  database.create({
    collection: 'branches',
    kind: 'entity',
    key: 'branch:classic',
    value: {
      id: randomUUID(),
      key: 'branch:classic',
      code: 'classic'
    }
  })
  const before = database.revision()
  assert.throws(() => database.update({ target, patch: { branchKey: 'branch:classic' } }), { code: 'VALIDATION_ERROR' })
  assert.throws(() => database.delete({ collection: 'sagas', key: 'saga:the-chaotic-throne', kind: 'entity' }), {
    code: 'VALIDATION_ERROR'
  })
  assert.equal(database.revision(), before)
  database.update({ target, patch: { sagaKey: null } })
  database.delete({ collection: 'sagas', key: 'saga:the-chaotic-throne', kind: 'entity' })
  assert.equal(database.get(target).sagaKey, null)
})

test('перегруппировка не меняет UUID и адрес релиза, региональных выходов и протоколов', async (t) => {
  const { database, directory } = await fixture(t)
  database.replaceSnapshot(regionalFixture())
  const target = { collection: 'releases', key: 'release:high-five', kind: 'entity' }
  const before = database.get(target)
  const contexts = database.list({ collection: 'release-contexts', ownerKey: target.key }).items
  database.update({ target, patch: { chronicleKey: 'chronicle:c4' } })
  const after = database.get(target)
  assert.deepEqual(after, { ...before, chronicleKey: 'chronicle:c4' })
  assert.deepEqual(database.list({ collection: 'release-contexts', ownerKey: target.key }).items, contexts)
  assert.equal(database.list({ collection: 'releases', ownerKey: 'chronicle:high-five' }).total, 0)
  assert.equal(database.list({ collection: 'releases', ownerKey: 'chronicle:c4' }).total, 2)
  assert.equal(database.list({ collection: 'protocols', releaseKey: target.key }).total, 2)
  const output = join(directory, 'classification-data')
  const path = join(directory, 'classification.sqlite')
  await exportDatabase({ database: database.path, output })
  await importDatabase({ database: path, input: output })
  const restored = openDatabase({ database: path, readOnly: true })
  t.after(() => restored.close())
  assert.equal(restored.revision(), database.revision())
  assert.deepEqual(restored.get(target), after)
})
