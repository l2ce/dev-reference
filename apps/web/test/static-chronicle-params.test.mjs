import assert from 'node:assert/strict'
import test from 'node:test'
import { codeSchema } from '@l2ce/database'
import { staticChronicleParams } from '../src/app/helpers/static-chronicle-params.ts'

test('пустой каталог хроник получает только удаляемый технический параметр своего языка', () => {
  assert.deepEqual(staticChronicleParams([], 'en'), [{ locale: 'en', chronicle: '__empty__' }])
  assert.deepEqual(staticChronicleParams([], 'ru'), [{ locale: 'ru', chronicle: '__empty__' }])
  assert.equal(codeSchema.safeParse('__empty__').success, false)
})

test('известные хроники сохраняют код, язык и входной порядок без технических добавлений', () => {
  const routes = [
    { locale: 'en', chronicle: 'gracia' },
    { locale: 'ru', chronicle: 'high-five' }
  ]
  assert.deepEqual(staticChronicleParams(routes, 'ru'), [routes[1]])
  assert.deepEqual(routes, [
    { locale: 'en', chronicle: 'gracia' },
    { locale: 'ru', chronicle: 'high-five' }
  ])
})
