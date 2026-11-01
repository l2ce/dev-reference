import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { parseEntry } from '../dist/index.js'
import { fixture } from './helpers.mjs'

test('152, 152-rev-1 и 152-rev-2 различаются при одинаковом реальном номере', async (t) => {
  const { database } = await fixture(t)
  const key = 'protocol:152-rev-2'
  database.create(
    parseEntry({
      collection: 'protocols',
      kind: 'entity',
      key,
      value: { id: randomUUID(), key, number: 152, variant: 2 }
    })
  )
  const values = database.list({
    collection: 'protocols',
    search: '152'
  }).items
  assert.deepEqual(
    values.map((value) => value.key),
    ['protocol:152', 'protocol:152-rev-1', 'protocol:152-rev-2']
  )
  assert.deepEqual(
    values.map((value) => value.number),
    [152, 152, 152]
  )
  assert.equal(new Set(values.map((value) => value.id)).size, 3)
})

test('номер, различитель и код должны совпадать с адресом и не меняются обычным update', async (t) => {
  const { database } = await fixture(t)
  const before = database.revision()
  for (const patch of [{ number: 153 }, { variant: 3 }, { variant: -1 }, { variant: 0.5 }]) {
    assert.throws(
      () =>
        database.update({
          target: {
            collection: 'protocols',
            kind: 'entity',
            key: 'protocol:152'
          },
          patch
        }),
      { code: 'VALIDATION_ERROR' }
    )
    assert.equal(database.revision(), before)
  }
  assert.throws(
    () =>
      database.update({
        target: {
          collection: 'packets',
          kind: 'entity',
          key: 'packet:key-packet'
        },
        patch: { code: 'other' }
      }),
    { code: 'VALIDATION_ERROR' }
  )
})
