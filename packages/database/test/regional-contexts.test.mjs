import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import Sqlite from 'better-sqlite3'
import {
  openDatabase,
  validateSnapshot,
  exportDatabase,
  importDatabase,
  snapshotRevision,
  releaseDateSchema
} from '../dist/index.js'
import { fixture } from './helpers.mjs'
import { regionalFixture } from './fixtures/regional.mjs'

test('регионы, страны и точность даты принадлежат контексту выпуска; протоколы не дублируются', async (t) => {
  const { database, path } = await fixture(t)
  database.replaceSnapshot(regionalFixture())
  const contexts = database.list({
    collection: 'release-contexts',
    ownerKey: 'chronicle:high-five:base',
    regionKey: 'region:na'
  })
  assert.equal(contexts.total, 1)
  assert.deepEqual(contexts.items[0].protocolKeys, ['protocol:273'])
  assert.equal(contexts.items[0].releasedOn, '2010-07')
  assert.deepEqual(contexts.items[0].countryKeys, ['country:us'])
  assert.equal('regions' in database.get({ collection: 'protocols', key: 'protocol:273' }), false)
  assert.equal(database.list({ collection: 'protocols', chronicleReleaseKey: 'chronicle:high-five:base' }).total, 2)
  assert.equal(database.list({ collection: 'chronicle-releases', protocolKey: 'protocol:152-rev-1' }).total, 1)
  assert.equal(database.list({ collection: 'release-contexts', protocolKey: 'protocol:152-rev-1' }).total, 1)
  const sql = new Sqlite(path)
  t.after(() => sql.close())
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='protocol_regions'").get().n, 0)
  assert.deepEqual(sql.pragma('foreign_key_check'), [])
})

test('неизвестный регион и неизвестная дата не подменяются глобальными признаками', async (t) => {
  const { database } = await fixture(t)
  database.replaceSnapshot(regionalFixture())
  const context = database.get({ collection: 'release-contexts', key: 'chronicle:c4:base:unknown' })
  assert.equal(context.regionKey, null)
  assert.equal(context.releasedOn, null)
  assert.deepEqual(context.countryKeys, [])
  assert.deepEqual(context.protocolKeys, ['protocol:656'])
})

test('календарная дата проверяет точность и високосные дни, а не только форму строки', () => {
  for (const value of ['2024', '2024-02', '2024-02-29', '0001-01-01'])
    assert.ok(releaseDateSchema.safeParse(value).success, value)
  for (const value of [
    '',
    '0000',
    '2024-00',
    '2024-13',
    '2023-02-29',
    '2024-02-30',
    '2024-01-00',
    '2024-01-32',
    '2024-1',
    '2024-01-01T00:00:00Z'
  ])
    assert.equal(releaseDateSchema.safeParse(value).success, false, value)
})

test('источники, ссылки на регионы и страны обязательны для конкретных утверждений', () => {
  for (const patch of [
    { regionKey: 'region:absent' },
    { countryKeys: ['country:absent'] },
    { countryKeys: ['country:us', 'country:us'] },
    { translations: [] }
  ]) {
    const snapshot = regionalFixture()
    Object.assign(snapshot.entries.find((entry) => entry.key === 'chronicle:high-five:base:na').value, patch)
    assert.throws(() => validateSnapshot(snapshot), { code: 'VALIDATION_ERROR' })
  }
})

test('удаление используемого протокола, выпуска или региона защищено; ошибка пакета атомарна', async (t) => {
  const { database } = await fixture(t)
  database.replaceSnapshot(regionalFixture())
  const before = database.revision()
  for (const [collection, key] of [
    ['protocols', 'protocol:152-rev-1'],
    ['chronicle-releases', 'chronicle:high-five:base'],
    ['regions', 'region:na'],
    ['countries', 'country:us']
  ]) {
    assert.throws(() => database.delete({ collection, key, kind: 'entity' }), { code: 'VALIDATION_ERROR' })
    assert.equal(database.revision(), before)
  }
})

test('экспорт и импорт сохраняют региональные факты, источники и составные ключи', async (t) => {
  const { database, path, directory } = await fixture(t)
  database.replaceSnapshot(regionalFixture())
  const output = join(directory, 'regional-data')
  const restoredPath = join(directory, 'regional.sqlite')
  await exportDatabase({ database: path, output })
  await importDatabase({ database: restoredPath, input: output })
  const restored = openDatabase({ database: restoredPath, readOnly: true })
  t.after(() => restored.close())
  assert.equal(snapshotRevision(restored.snapshot()), database.revision())
})
