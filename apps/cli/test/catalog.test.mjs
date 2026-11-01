import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, success } from './helpers.mjs'

test('каталог фильтрует протоколы по ветке, хронике, выпуску и одинаковому номеру', async (t) => {
  const { json } = await fixture(t)
  assert.equal(success(await json(['protocols', 'list', '--number', '152'])).total, 2)
  assert.equal(success(await json(['protocols', 'list', '--chronicle', 'high-five'])).items[0].key, 'protocol:273')
  assert.equal(success(await json(['protocols', 'list', '--release', 'c4:base'])).items[0].number, 656)
  assert.equal(success(await json(['chronicles', 'list', '--branch', 'main'])).total, 2)
  assert.equal(success(await json(['releases', 'get', 'high-five:base'])).items[0].chronicleKey, 'chronicle:high-five')
})

test('создание дополнительного профиля сохраняет реальный номер и читаемый суффикс', async (t) => {
  const { json } = await fixture(t)
  success(await json(['protocols', 'create', '152-rev-2', '--title', 'Другой контекст']))
  const result = success(await json(['protocols', 'get', '152-rev-2'])).items[0]
  assert.equal(result.profile.number, 152)
  assert.equal(result.profile.variant, 2)
  assert.equal(result.profile.title, 'Другой контекст')
})
