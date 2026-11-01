import assert from 'node:assert/strict'
import test from 'node:test'
import Sqlite from 'better-sqlite3'
import { fixture } from './helpers.mjs'

test('SQL хранит общие предметные поля; язык, Markdown и источники находятся в переводах', async (t) => {
  const { path } = await fixture(t)
  const sql = new Sqlite(path)
  t.after(() => sql.close())
  for (const table of [
    'branches',
    'chronicles',
    'chronicle_releases',
    'protocols',
    'packets',
    'packet_revisions',
    'scenarios',
    'scenario_revisions',
    'articles',
    'article_revisions'
  ]) {
    const columns = sql
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => column.name)
    assert.ok(columns.includes('id'))
    for (const name of ['locale', 'key', 'slug', 'description', 'source_json', 'sources_json'])
      assert.equal(columns.includes(name), false, `${table}.${name}`)
  }
  assert.deepEqual(
    sql
      .prepare('PRAGMA table_info(protocols)')
      .all()
      .map((column) => column.name),
    ['id', 'status', 'number', 'variant']
  )
  const translation = sql.prepare('PRAGMA table_info(packet_revision_translations)').all()
  assert.deepEqual(
    translation.filter((column) => column.pk).map((column) => column.name),
    ['packet_revision_id', 'locale']
  )
  assert.equal(
    sql
      .prepare(
        "SELECT count(*) AS n FROM pragma_table_list WHERE schema = 'main' AND name NOT GLOB 'sqlite_*' AND strict = 0"
      )
      .get().n,
    0
  )
})

test('SQLite защищает уникальность вариантов, владельца редакции и языковой внешний ключ', async (t) => {
  const { path } = await fixture(t)
  const sql = new Sqlite(path)
  t.after(() => sql.close())
  sql.pragma('foreign_keys = ON')
  assert.throws(() => sql.exec('UPDATE protocols SET variant = 0 WHERE number = 152 AND variant = 1'), /UNIQUE/)
  const bindings = sql.prepare('SELECT * FROM packet_protocols ORDER BY packet_id').all()
  const first = bindings[0]
  const other = bindings.find((binding) => binding.packet_id !== first.packet_id)
  assert.throws(
    () =>
      sql
        .prepare('UPDATE packet_protocols SET packet_revision_id = ?, position = position + 100 WHERE packet_id = ?')
        .run(other.packet_revision_id, first.packet_id),
    /FOREIGN KEY/
  )
  assert.throws(
    () => sql.exec("UPDATE packet_revision_translations SET locale = 'de' WHERE locale = 'ru'"),
    /FOREIGN KEY/
  )
  assert.throws(() => sql.exec("UPDATE packet_revision_opcodes SET value = 256, type = 'u8'"), /CHECK/)
  assert.throws(() => sql.exec('UPDATE packet_revisions SET rev = 0'), /CHECK/)
  assert.throws(() => sql.exec('UPDATE protocols SET variant = 0.5'), /INTEGER/)
  assert.throws(() => sql.exec("UPDATE packet_revision_translations SET sources_json = '{}'"), /CHECK/)
  assert.deepEqual(sql.pragma('foreign_key_check'), [])
})
