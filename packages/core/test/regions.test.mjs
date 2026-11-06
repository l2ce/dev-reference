import assert from 'node:assert/strict'
import test from 'node:test'
import { ReferenceReader } from '../dist/reference-api.js'
import { regionalFixture } from '../../database/test/fixtures/regional.mjs'

test('региональный поиск и карточка протокола не переносят соседние региональные связи', () => {
  const reader = new ReferenceReader(regionalFixture())
  assert.deepEqual(
    reader.protocols({ chronicle: 'high-five', region: 'na' }).items.map((item) => item.key),
    ['protocol:273']
  )
  assert.deepEqual(
    reader.protocols({ chronicle: 'high-five', region: 'kr' }).items.map((item) => item.key),
    ['protocol:152-rev-1']
  )
  assert.deepEqual(reader.protocol('273').regions, ['NA'])
  assert.deepEqual(reader.protocol('656').regions, [])
  assert.equal(reader.protocol('152-rev-1').contexts[0].releasedOn, '2020-02-29')
  assert.deepEqual(reader.catalogRecord('release:high-five').protocolKeys, ['protocol:273', 'protocol:152-rev-1'])
  assert.deepEqual(reader.catalogRecord('release:high-five').unscopedProtocolKeys, [])
  assert.equal(reader.read({ protocol: '152-rev-1', keys: ['packet:key-packet'] }).items[0].availability, 'unmapped')
})

test('редакционный порядок сохраняется при пагинации и поиске, независимо от ключа и даты', () => {
  const snapshot = regionalFixture()
  snapshot.entries.find((entry) => entry.key === 'chronicle:high-five').value.order = 1
  snapshot.entries.find((entry) => entry.key === 'chronicle:c4').value.order = 2
  const reader = new ReferenceReader(snapshot)
  assert.equal(reader.catalog({ collection: 'chronicles', limit: 1 }).items[0].key, 'chronicle:high-five')
  assert.equal(reader.catalog({ collection: 'chronicles', limit: 1, offset: 1 }).items[0].key, 'chronicle:c4')
  assert.equal(
    reader.catalog({ collection: 'release-contexts', release: 'high-five', region: 'kr' }).items[0].regionKey,
    'region:kr'
  )
})
