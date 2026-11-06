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
      'release-context:high-five:na',
      {
        code: 'na',
        releaseKey: 'release:high-five',
        regionKey: 'region:na',
        releasedOn: '2010-07',
        countryKeys: ['country:us'],
        protocolKeys: ['protocol:273'],
        order: 0
      }
    ],
    [
      'release-contexts',
      'release-context:high-five:kr',
      {
        code: 'kr',
        releaseKey: 'release:high-five',
        regionKey: 'region:kr',
        releasedOn: '2020-02-29',
        protocolKeys: ['protocol:152-rev-1'],
        order: 1
      }
    ],
    [
      'release-contexts',
      'release-context:c4:unknown',
      {
        code: 'unknown',
        releaseKey: 'release:c4',
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
  snapshot.entries.find((entry) => entry.key === 'release:high-five').value.protocolKeys = []
  return validateSnapshot(snapshot)
}
