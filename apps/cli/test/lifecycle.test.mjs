import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { fixture, success, failure } from './helpers.mjs'

test('init создаёт ru/en, экспорт и импорт сохраняют состояние и данные', async (t) => {
  const { json, parent } = await fixture(t, { initialize: false })
  assert.equal(success(await json(['status'])).exists, false)
  assert.deepEqual(success(await json(['init'])).manifest.locales, ['ru', 'en'])
  failure(await json(['init']), 'ALREADY_EXISTS', 4)
  success(await json(['protocols', 'create', '273', '--title', 'High Five']))
  const before = success(await json(['status'])).revision
  const output = join(parent, 'export')
  assert.equal(success(await json(['export', '--output', output])).tables, 29)
  success(await json(['protocols', 'create', '268']))
  success(await json(['import', '--input', output]))
  assert.equal(success(await json(['status'])).revision, before)
  assert.equal(success(await json(['validate'])).valid, true)
})
