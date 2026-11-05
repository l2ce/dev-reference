import { randomUUID } from 'node:crypto'
import { parseEntry, validateSnapshot } from '../../dist/index.js'
import { sharedFixture } from './shared.mjs'

/**
 * Синтетические региональные факты, не историческое наполнение справочника.
 */
export function regionalFixture() {
  const snapshot = sharedFixture()
  const additions = [
    ['regions', 'region:na', { code: 'na', order: 0 }],
    ['regions', 'region:kr', { code: 'kr', order: 1 }],
    ['countries', 'country:us', { code: 'us' }],
    [
      'release-contexts',
      'chronicle:high-five:base:na',
      {
        code: 'na',
        releaseKey: 'chronicle:high-five:base',
        regionKey: 'region:na',
        releasedOn: '2010-07',
        countryKeys: ['country:us'],
        protocolKeys: ['protocol:273'],
        order: 0
      }
    ],
    [
      'release-contexts',
      'chronicle:high-five:base:kr',
      {
        code: 'kr',
        releaseKey: 'chronicle:high-five:base',
        regionKey: 'region:kr',
        releasedOn: '2020-02-29',
        protocolKeys: ['protocol:152-rev-1'],
        order: 1
      }
    ],
    [
      'release-contexts',
      'chronicle:c4:base:unknown',
      {
        code: 'unknown',
        releaseKey: 'chronicle:c4:base',
        protocolKeys: ['protocol:656']
      }
    ]
  ]
  for (const [collection, key, value] of additions) {
    snapshot.entries.push(
      parseEntry({
        collection,
        key,
        kind: 'entity',
        value: {
          ...value,
          id: randomUUID(),
          key,
          translations: [
            {
              locale: 'ru',
              title: key,
              summary: 'Synthetic',
              description: '',
              source: [{ id: randomUUID(), url: 'https://example.org/regional-fixture', title: 'Synthetic evidence' }]
            }
          ]
        }
      })
    )
  }
  snapshot.entries.find((entry) => entry.key === 'chronicle:high-five:base').value.protocolKeys = []
  return validateSnapshot(snapshot)
}
