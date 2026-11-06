import assert from 'node:assert/strict'
import test from 'node:test'
import { protocolReferenceSchema } from '@l2ce/core/reference'
import { EMPTY_PROTOCOL_CODE, staticProtocolParams } from '../src/app/helpers/static-protocol-params.ts'

test('пустая база получает непредметный параметр сборки без фиктивного протокола', () => {
  assert.deepEqual(staticProtocolParams([], 'ru'), [{ locale: 'ru', protocol: EMPTY_PROTOCOL_CODE }])
  assert.equal(protocolReferenceSchema.safeParse(EMPTY_PROTOCOL_CODE).success, false)
})

test('настоящие маршруты не дополняются техническим и сохраняют точные варианты протокола', () => {
  const routes = [
    { locale: 'en', protocol: '152' },
    { locale: 'ru', protocol: '152-rev-1' }
  ]
  assert.deepEqual(staticProtocolParams(routes, 'en'), [routes[0]])
  assert.deepEqual(staticProtocolParams(routes, 'ru'), [routes[1]])
})
