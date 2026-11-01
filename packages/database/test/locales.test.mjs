import assert from 'node:assert/strict'
import test from 'node:test'
import Sqlite from 'better-sqlite3'
import { fixture, articleEntry, articleImplementation, address } from './helpers.mjs'

test('два перевода используют одну предметную запись, опкод и применимость', async (t) => {
  const { database, path } = await fixture(t)
  const raw = new Sqlite(path)
  t.after(() => raw.close())
  assert.equal(raw.prepare('SELECT count(*) AS n FROM packets').get().n, 4)
  assert.equal(raw.prepare('SELECT count(*) AS n FROM packet_revision_translations').get().n, 8)
  const key = 'packet:key-packet:rev-1'
  const value = database.getRevision({ collection: 'packet-revisions', key })
  const translations = structuredClone(value.translations)
  translations.find((translation) => translation.locale === 'ru').description = 'Новый перевод'
  database.update({
    target: { collection: 'packet-revisions', key, kind: 'implementation' },
    patch: { translations }
  })
  const after = database.getRevision({ collection: 'packet-revisions', key })
  assert.deepEqual(after.opcode, value.opcode)
  assert.deepEqual(after.protocolKeys, value.protocolKeys)
  assert.deepEqual(
    after.translations.find((translation) => translation.locale === 'en'),
    value.translations.find((translation) => translation.locale === 'en')
  )
})

test('отсутствующий перевод не подставляется, новый язык добавляется данными', async (t) => {
  const { database } = await fixture(t)
  const entry = articleEntry()
  const revision = articleImplementation(entry)
  database.applyChanges([
    { op: 'create', entry },
    { op: 'create', entry: revision }
  ])
  assert.deepEqual(
    database.getRevision(address(revision)).translations.map((translation) => translation.locale),
    ['ru']
  )
  const snapshot = database.snapshot()
  database.replaceSnapshot({
    ...snapshot,
    locales: [...snapshot.locales, 'de']
  })
  revision.value.translations.push({
    ...revision.value.translations[0],
    locale: 'de',
    translationStatus: 'outdated'
  })
  database.put(revision)
  assert.equal(
    database.getRevision(address(revision)).translations.find((translation) => translation.locale === 'de')
      .translationStatus,
    'outdated'
  )
})

test('повтор перевода и незарегистрированный язык отклоняются атомарно', async (t) => {
  const { database } = await fixture(t)
  const entry = articleEntry()
  const revision = articleImplementation(entry)
  for (const locale of ['ru', 'zz']) {
    const bad = structuredClone(revision)
    bad.value.translations.push({ ...bad.value.translations[0], locale })
    const before = database.revision()
    assert.throws(
      () =>
        database.applyChanges([
          { op: 'create', entry },
          { op: 'create', entry: bad }
        ]),
      { code: 'VALIDATION_ERROR' }
    )
    assert.equal(database.revision(), before)
  }
})
