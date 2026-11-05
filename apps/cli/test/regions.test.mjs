import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, success, failure } from './helpers.mjs'

test('CLI редактирует контекст отдельно от протокола и читает региональную применимость', async (t) => {
  const { json } = await fixture(t)
  success(await json(['regions', 'create', 'na', '--title', 'NA']))
  success(await json(['countries', 'create', 'us', '--title', 'US']))
  success(
    await json(['contexts', 'create', 'na', '--release', 'high-five:base', '--file', '-'], {
      regionKey: 'na',
      countryKeys: ['us'],
      protocolKeys: ['273'],
      releasedOn: '2024-02',
      translations: [
        {
          locale: 'ru',
          title: 'Synthetic regional release',
          summary: '',
          description: '',
          source: [{ url: 'https://example.org/cli-regions', title: 'Synthetic evidence' }]
        }
      ]
    })
  )
  const context = success(await json(['contexts', 'inspect', 'high-five:base:na'])).items[0].value
  assert.equal(context.releaseKey, 'chronicle:high-five:base')
  assert.equal(context.regionKey, 'region:na')
  assert.equal(context.releasedOn, '2024-02')
  assert.deepEqual(context.countryKeys, ['country:us'])
  assert.equal(success(await json(['contexts', 'list', '--release', 'high-five:base', '--region', 'na'])).total, 1)
  assert.equal(success(await json(['protocols', 'list', '--region', 'na'])).total, 1)
  assert.equal(success(await json(['protocols', 'list', '--region', 'kr'])).total, 0)
  const revision = success(await json(['status'])).revision
  success(
    await json(['contexts', 'update', 'high-five:base:na', '--file', '-', '--dry-run'], { releasedOn: '2024-02-29' })
  )
  assert.equal(success(await json(['status'])).revision, revision)
  failure(
    await json(['contexts', 'update', 'high-five:base:na', '--file', '-'], { releasedOn: '2023-02-29' }),
    'VALIDATION_ERROR',
    2
  )
  assert.equal(success(await json(['status'])).revision, revision)
  assert.ok(success(await json(['contexts', 'schema'])).generatedFields.includes('releaseKey'))
})
