import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { fixture } from './helpers.mjs'

test('ветки, хроники и выпуски фильтруются отдельно от M:N протоколов', async (t) => {
  const { database } = await fixture(t)
  const chronicles = database.list({
    collection: 'chronicles',
    branchKey: 'branch:main'
  })
  assert.equal(chronicles.total, 2)
  const release = {
    collection: 'releases',
    kind: 'entity',
    key: 'release:high-five'
  }
  database.update({
    target: release,
    patch: { protocolKeys: ['protocol:273', 'protocol:656'] }
  })
  assert.deepEqual(
    database.list({ collection: 'protocols', releaseKey: release.key }).items.map((value) => value.number),
    [273, 656]
  )
  assert.equal(
    database.list({
      collection: 'releases',
      protocolKey: 'protocol:656'
    }).total,
    2
  )
  assert.equal(
    database.list({
      collection: 'packet-revisions',
      protocolKey: 'protocol:656'
    }).total,
    4
  )
})

test('неполная хроника допустима, битые связи и удаление используемой ветки отклоняются', async (t) => {
  const { database } = await fixture(t)
  const key = 'chronicle:incomplete'
  database.create({
    collection: 'chronicles',
    kind: 'entity',
    key,
    value: {
      id: randomUUID(),
      key,
      code: 'incomplete',
      branchKey: 'branch:main'
    }
  })
  assert.equal(database.list({ collection: 'releases', ownerKey: key }).total, 0)
  const before = database.revision()
  assert.throws(
    () =>
      database.delete({
        collection: 'branches',
        kind: 'entity',
        key: 'branch:main'
      }),
    { code: 'VALIDATION_ERROR' }
  )
  assert.throws(
    () =>
      database.update({
        target: { collection: 'chronicles', kind: 'entity', key },
        patch: { branchKey: 'branch:missing' }
      }),
    { code: 'VALIDATION_ERROR' }
  )
  assert.equal(database.revision(), before)
})
