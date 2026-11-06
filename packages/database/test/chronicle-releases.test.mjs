import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers.mjs'

test('выпуск имеет собственный code без rev и может существовать без протоколов и переводов', async (t) => {
  const { database } = await fixture(t)
  const key = 'release:high-five-part-1'
  const entry = {
    collection: 'releases',
    kind: 'entity',
    key,
    value: {
      id: randomUUID(),
      key,
      code: 'high-five-part-1',
      chronicleKey: 'chronicle:high-five'
    }
  }
  database.create(entry)
  const value = database.get({ collection: entry.collection, key })
  assert.deepEqual(value.protocolKeys, [])
  assert.deepEqual(value.translations, [])
  assert.equal('rev' in value, false)
  assert.throws(() => database.put({ ...entry, value: { ...entry.value, rev: 1 } }), { code: 'VALIDATION_ERROR' })
})
