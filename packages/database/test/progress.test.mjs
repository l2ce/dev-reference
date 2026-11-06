import assert from 'node:assert/strict'
import { cp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Writable } from 'node:stream'
import { stripVTControlCharacters } from 'node:util'
import test from 'node:test'
import Sqlite from 'better-sqlite3'
import { importDatabase, snapshotRevision, collectionSchema } from '../dist/index.js'
import { createProgress } from '../dist/exchange/progress.js'
import { createTerminalProgress } from '../dist/cli/progress.js'
import { progressFrame } from '../dist/cli/progress-view.js'
import { fixture, sourceDirectory, fixturePath } from './helpers.mjs'

const packet = {
  locale: 'ru',
  collection: 'packets',
  path: 'ru/packets/key-packet.json'
}
const profile = {
  locale: 'en',
  collection: 'protocols',
  path: 'en/protocols/273-rev-1.json'
}

test('все коллекции видны заранее, времена отделены от ожидания и вывода, 100% только после фиксации', (t) => {
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const events = []
  const progress = createProgress('import', (event) => {
    events.push(event)
    now += 10 // Медленный терминальный вывод не должен попадать во время файла.
  })
  progress.stage('scan')
  progress.plan([packet, profile])
  assert.equal(events[0].collections.length, collectionSchema.options.length)
  const planned = events.at(-1)
  assert.equal(planned.collections.find((group) => group.collection === 'packets').total, 1)
  progress.stage('read')
  progress.startRecord('read', packet)
  now += 50
  progress.finishRecord()
  progress.startRecord('read', profile)
  now += 5
  progress.finishRecord()
  progress.stage('validate')
  now += 500
  progress.startRecord('write', packet)
  now += 20
  progress.finishRecord()
  progress.startRecord('write', profile)
  now += 2
  progress.finishRecord()
  const prepared = events.at(-1)
  assert.equal(prepared.collections.find((group) => group.collection === 'packets').status, 'prepared')
  assert.equal(prepared.collections.find((group) => group.collection === 'packets').percent, 99)
  assert.equal(prepared.phaseDurationsMs.validate, 510)
  progress.stage('commit', 2, 2)
  progress.stage('complete', 2, 2)
  const final = events.at(-1)
  const packets = final.collections.find((group) => group.collection === 'packets')
  assert.equal(packets.readMs, 50)
  assert.equal(packets.writeMs, 20)
  assert.equal(packets.slowest.durationMs, 50)
  assert.deepEqual(packets.slowest.record, packet)
  assert.equal(final.collections.find((group) => group.collection === 'protocols').writeMs, 2)
  assert.ok(final.collections.every((group) => group.status === 'complete' && group.percent === 100))
  assert.equal(planned.collections.find((group) => group.collection === 'packets').read, 0)
  const frame = progressFrame(final).join('\n')
  assert.match(frame, /^  packets \(1\):\s+\[#{28}\] 100%$/m)
  assert.match(frame, /^\[1\/2\] Russian \(ru\)$/m)
  assert.match(frame, /^\[2\/2\] English \(en\)$/m)
  assert.equal(progressFrame(final).length, collectionSchema.options.length * 2 + 3)
  const columnPositions = progressFrame(final)
    .filter((line) => line.startsWith('  '))
    .map((line) => line.indexOf('['))
  assert.equal(new Set(columnPositions).size, 1)
  assert.doesNotMatch(frame, /Самый медленный|оп\/с|мс|\.json/)
})

test('ошибка чтения показывает начатый файл и точную коллекцию без ложного успешного завершения', async (t) => {
  const { directory, path, database } = await fixture(t)
  const input = join(directory, 'broken-input')
  await cp(sourceDirectory, input, { recursive: true })
  const failedPath = join(input, fixturePath('packet:key-packet:rev-1'))
  await writeFile(failedPath, '{broken')
  const before = snapshotRevision(database.snapshot())
  const events = []
  await assert.rejects(
    importDatabase({
      database: path,
      input,
      onProgress: (event) => events.push(event)
    }),
    { code: 'INVALID_JSON' }
  )
  const failure = events.at(-1)
  assert.equal(failure.event, 'failure')
  assert.equal(failure.phase, 'read')
  assert.equal(failure.failure.path, fixturePath('packet:key-packet:rev-1'))
  assert.equal(failure.record.path, fixturePath('packet:key-packet:rev-1'))
  assert.equal(failure.collections.find((group) => group.collection === 'packet-revisions').status, 'failed')
  assert.ok(failure.collections.every((group) => group.status !== 'complete'))
  const fileEvents = events.filter((event) => event.record?.path === fixturePath('packet:key-packet:rev-1'))
  assert.deepEqual(
    fileEvents.map((event) => event.event),
    ['record-start', 'failure']
  )
  assert.equal(snapshotRevision(database.snapshot()), before)
  assert.match(progressFrame(failure).join('\n'), /^packet-revisions \(4\):.* ERROR$/m)
  assert.deepEqual(failure.locales, [])
})

test('ошибка SQL-записи помечает правильную карточку и сохраняет откат импорта', async (t) => {
  const { path, database } = await fixture(t)
  const raw = new Sqlite(path)
  t.after(() => raw.close())
  raw.exec(`CREATE TRIGGER fail_packet BEFORE INSERT ON packets
    WHEN NEW.code = 'key-packet'
    BEGIN SELECT RAISE(ABORT, 'test write failure'); END;`)
  const before = snapshotRevision(database.snapshot())
  const events = []
  await assert.rejects(
    importDatabase({
      database: path,
      input: sourceDirectory,
      onProgress: (event) => events.push(event)
    })
  )
  const failure = events.at(-1)
  assert.equal(failure.phase, 'write')
  assert.equal(failure.failure.path, fixturePath('packet:key-packet'))
  assert.equal(failure.collections.find((group) => group.collection === 'packets').status, 'failed')
  assert.equal(snapshotRevision(database.snapshot()), before)
})

test('TTY меняет компактные счётчики только после записи, а 100% показывает после фиксации', (t) => {
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const chunks = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString())
      callback()
    }
  })
  stream.isTTY = true
  stream.columns = 120
  stream.rows = 24
  const terminal = createTerminalProgress(stream)
  t.after(() => terminal.stop())
  const progress = createProgress('import', terminal.update)
  progress.stage('scan')
  progress.plan([packet])
  progress.startRecord('read', packet)
  const beforeRead = chunks.length
  now = 2_000
  progress.finishRecord()
  assert.equal(chunks.length, beforeRead)
  progress.startRecord('write', packet)
  assert.equal(chunks.length, beforeRead)
  progress.finishRecord()
  assert.match(stripVTControlCharacters(chunks.join('')), /packets \(1\):\s+\[#{27}-\]\s+99%/)
  assert.doesNotMatch(stripVTControlCharacters(chunks.join('')), /100%/)
  progress.stage('complete', 1, 1)
  assert.match(stripVTControlCharacters(chunks.join('')), /packets \(1\):\s+\[#{28}\] 100%/)
  assert.doesNotMatch(chunks.join(''), /ru\/packets|мс|Самый медленный/)
  terminal.stop()
})

test('одинаковые коллекции разных языков имеют независимые объёмы, прогресс и диагностику', () => {
  const events = []
  const progress = createProgress('export', (event) => events.push(event))
  const first = {
    ...packet,
    locale: 'en',
    path: 'en/packets/key-packet.json'
  }
  const second = {
    ...first,
    path: 'en/packets/other-packet.json'
  }
  progress.plan([first, second, packet], ['en', 'ru'])
  const planned = events.at(-1)
  progress.startRecord('write', first)
  progress.finishRecord()
  const partial = events.at(-1)
  assert.deepEqual(
    partial.locales.map((language) => {
      const group = language.collections.find((item) => item.collection === 'packets')
      return [language.locale, group.total, group.written]
    }),
    [
      ['en', 2, 1],
      ['ru', 1, 0]
    ]
  )
  progress.startRecord('write', packet)
  progress.finishRecord()
  const preparedRussian = events
    .at(-1)
    .locales.find((language) => language.locale === 'ru')
    .collections.find((group) => group.collection === 'packets')
  assert.equal(preparedRussian.percent, 99)
  assert.equal(preparedRussian.status, 'prepared')
  progress.startRecord('write', second)
  progress.fail(new Error('Ошибка файла английской базы'))
  const failed = events.at(-1)
  assert.equal(failed.locales[0].collections.find((group) => group.collection === 'packets').status, 'failed')
  assert.equal(failed.locales[1].collections[0].status, 'aborted')
  assert.equal(failed.record.locale, 'en')
  assert.equal(planned.locales[0].collections[0].written, 0)
  assert.equal(partial.locales[1].collections[0].written, 0)

  const singleLanguageEvents = []
  const singleLanguage = createProgress('export', (event) => singleLanguageEvents.push(event))
  singleLanguage.plan([packet], ['ru'])
  const singleFrame = progressFrame(singleLanguageEvents.at(-1))
  assert.equal(singleFrame[0], '[1/1] Russian (ru)')
  assert.equal(singleFrame.length, collectionSchema.options.length + 1)
  assert.doesNotMatch(singleFrame.join('\n'), /English/)
})
