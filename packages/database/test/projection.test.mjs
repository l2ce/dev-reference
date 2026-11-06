import assert from 'node:assert/strict'
import test from 'node:test'
import Sqlite from 'better-sqlite3'
import { openDatabase, exportDatabase, importDatabase } from '../dist/index.js'
import { fixture, articleEntry } from './helpers.mjs'
import { join } from 'node:path'

test('лёгкая проекция выбирает страницу до загрузки Markdown и посторонних переводов', async (t) => {
  const { database } = await fixture(t)
  const key = 'packet:key-packet:rev-1'
  const projected = database.readProjection({ locale: null }, (catalog, version) => {
    assert.match(version, /^v1:[a-f0-9]{64}$/)
    for (const entry of catalog.entries)
      if ('translations' in entry.value)
        for (const text of entry.value.translations) {
          assert.equal(text.locale, catalog.defaultLocale)
          assert.equal(text.description, '')
          assert.deepEqual(text.source, [])
        }
    return [key]
  })
  const selected = projected.catalog.entries.find((entry) => entry.key === key)
  assert.match(selected.value.translations[0].description, /# key-packet/)
  assert.equal(selected.value.translations.length, 1)
  assert.equal(
    projected.catalog.entries.find((entry) => entry.key === 'packet:protocol-version:rev-1').value.translations[0]
      .description,
    ''
  )
})

test('проекция, материализация и поколение удерживают один снимок при конкурентной записи', async (t) => {
  const { database, path } = await fixture(t)
  const other = openDatabase({ database: path })
  t.after(() => other.close())
  const before = database.version()
  const projected = database.readProjection({}, () => {
    other.create(articleEntry())
    return ['protocol:273']
  })
  assert.equal(projected.version, before)
  assert.notEqual(database.version(), before)
  assert.equal(
    projected.catalog.entries.some((entry) => entry.key === 'article:example'),
    false
  )
  assert.throws(() => database.commitSnapshot(projected.catalog, { ifVersion: before }), { code: 'REVISION_CONFLICT' })
})

test('commitSnapshot защищает метаданные, no-op и dry-run не меняют поколение; rollback откатывает счётчик', async (t) => {
  const { database, path } = await fixture(t)
  const before = database.snapshot()
  const version = database.version()
  const next = { ...before, locales: [...before.locales, 'de'] }
  assert.equal(database.commitSnapshot(next, { ifVersion: version, dryRun: true }).version, version)
  assert.equal(database.version(), version)
  assert.equal(database.commitSnapshot(before, { ifVersion: version }).version, version)
  const committed = database.commitSnapshot(next, { ifVersion: version })
  assert.notEqual(committed.version, version)
  assert.equal(database.version(), committed.version)
  assert.throws(() => database.commitSnapshot(before, { ifVersion: version }), { code: 'REVISION_CONFLICT' })
  const raw = new Sqlite(path)
  t.after(() => raw.close())
  raw.exec("CREATE TRIGGER fail_revision BEFORE INSERT ON metadata BEGIN SELECT RAISE(ABORT, 'fixture failure'); END")
  assert.throws(() => database.commitSnapshot(before, { ifVersion: committed.version }))
  assert.equal(database.version(), committed.version)
  assert.deepEqual(database.snapshot().locales, next.locales)
})

test('импорт и обычный CRUD меняют поколение, а экспорт и открытие read-only — нет', async (t) => {
  const { database, path } = await fixture(t)
  const version = database.version()
  const directory = join(path, '..', 'generation-export')
  await exportDatabase({ database: path, output: directory })
  assert.equal(database.version(), version)
  await importDatabase({ database: path, input: directory })
  assert.notEqual(database.version(), version)
  const imported = database.version()
  database.create(articleEntry(), { ifVersion: imported })
  assert.notEqual(database.version(), imported)
  const readOnly = openDatabase({ database: path, readOnly: true })
  try {
    assert.equal(readOnly.version(), database.version())
  } finally {
    readOnly.close()
  }
})
