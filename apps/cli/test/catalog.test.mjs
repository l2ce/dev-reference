import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, success } from './helpers.mjs'

test('каталог фильтрует протоколы по ветке, хронике, выпуску и одинаковому номеру', async (t) => {
  const { json } = await fixture(t)
  assert.equal(success(await json(['protocols', 'list', '--number', '152'])).total, 2)
  assert.equal(success(await json(['protocols', 'list', '--chronicle', 'high-five'])).items[0].key, 'protocol:273')
  assert.equal(success(await json(['protocols', 'list', '--release', 'c4'])).items[0].number, 656)
  assert.equal(success(await json(['chronicles', 'list', '--branch', 'main'])).total, 2)
  assert.equal(success(await json(['releases', 'get', 'high-five'])).items[0].chronicleKey, 'chronicle:high-five')
})

test('создание дополнительного профиля сохраняет реальный номер и читаемый суффикс', async (t) => {
  const { json } = await fixture(t)
  success(await json(['protocols', 'create', '152-rev-2', '--title', 'Другой контекст']))
  const result = success(await json(['protocols', 'get', '152-rev-2'])).items[0]
  assert.equal(result.profile.number, 152)
  assert.equal(result.profile.variant, 2)
  assert.equal(result.profile.title, 'Другой контекст')
})

test('CLI создаёт сагу и одноимённые хронику и релиз без base и сохраняет адрес при перегруппировке', async (t) => {
  const { json } = await fixture(t)
  success(await json(['sagas', 'create', 'the-chaotic-throne', '--branch', 'main', '--title', 'The Chaotic Throne']))
  success(
    await json([
      'chronicles',
      'create',
      'the-kamael',
      '--branch',
      'main',
      '--saga',
      'the-chaotic-throne',
      '--title',
      'The Kamael'
    ])
  )
  success(await json(['releases', 'create', 'the-kamael', '--chronicle', 'the-kamael', '--title', 'The Kamael']))
  const before = success(await json(['releases', 'inspect', 'release:the-kamael'])).items[0].value
  assert.equal(before.key, 'release:the-kamael')
  assert.equal(before.translations[0].title, 'The Kamael')
  assert.equal(success(await json(['sagas', 'list', '--branch', 'main'])).total, 1)
  assert.equal(success(await json(['chronicles', 'list', '--saga', 'the-chaotic-throne'])).total, 1)
  success(await json(['releases', 'update', 'the-kamael', '--chronicle', 'c4']))
  const after = success(await json(['releases', 'inspect', 'the-kamael'])).items[0].value
  assert.deepEqual(after, { ...before, chronicleKey: 'chronicle:c4' })
  assert.equal(success(await json(['releases', 'list', '--chronicle', 'the-kamael'])).total, 0)
})
