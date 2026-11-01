import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, articleEntry, articleImplementation, address } from './helpers.mjs'

test('статьи используют прямой список протоколов, включая общие переиспользуемые описания', async (t) => {
  const { database } = await fixture(t)
  const entry = articleEntry()
  const revision = articleImplementation(entry)
  revision.value.protocolKeys = ['protocol:152', 'protocol:152-rev-1']
  database.applyChanges([
    { op: 'create', entry: revision },
    { op: 'create', entry }
  ])
  assert.equal(database.list({ collection: 'articles', protocolKey: 'protocol:152' }).items[0].id, entry.value.id)
  assert.equal(
    database.list({
      collection: 'article-revisions',
      protocolKey: 'protocol:152-rev-1'
    }).items[0].id,
    revision.value.id
  )
  assert.equal(
    database.list({
      collection: 'articles',
      protocolKey: 'protocol:273',
      search: 'test-article'
    }).total,
    0
  )
})

test('пустая применимость допустима, конкурирующие редакции одной статьи отклоняются', async (t) => {
  const { database } = await fixture(t)
  const entry = articleEntry()
  const first = articleImplementation(entry)
  const second = articleImplementation(entry, 2)
  database.applyChanges([
    { op: 'create', entry },
    { op: 'create', entry: first },
    { op: 'create', entry: second }
  ])
  database.update({
    target: address(first),
    patch: { protocolKeys: ['protocol:152'] }
  })
  assert.throws(
    () =>
      database.update({
        target: address(second),
        patch: { protocolKeys: ['protocol:152'] }
      }),
    { code: 'VALIDATION_ERROR' }
  )
})
