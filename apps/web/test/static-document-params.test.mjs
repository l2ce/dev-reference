import assert from 'node:assert/strict'
import test from 'node:test'
import { codeSchema } from '@l2ce/database'
import { EMPTY_DOCUMENT_CODE, staticDocumentParams } from '../src/app/helpers/static-document-params.ts'

test('пустая библиотека получает только технический параметр существующего профиля своего языка', () => {
  const protocols = [
    { locale: 'en', protocol: '152' },
    { locale: 'ru', protocol: '152-rev-1' }
  ]
  assert.deepEqual(staticDocumentParams([], protocols, 'en'), [
    { locale: 'en', protocol: '152', kind: 'article', code: EMPTY_DOCUMENT_CODE }
  ])
  assert.deepEqual(staticDocumentParams([], protocols, 'ru'), [
    { locale: 'ru', protocol: '152-rev-1', kind: 'article', code: EMPTY_DOCUMENT_CODE }
  ])
  assert.equal(codeSchema.safeParse(EMPTY_DOCUMENT_CODE).success, false)
  assert.deepEqual(protocols, [
    { locale: 'en', protocol: '152' },
    { locale: 'ru', protocol: '152-rev-1' }
  ])
})

test('реальные документы сохраняют профиль, вид и язык без технических добавлений', () => {
  const documents = [
    { locale: 'en', protocol: '152', kind: 'packet', code: 'key-packet' },
    { locale: 'ru', protocol: '152-rev-1', kind: 'article', code: 'framing' }
  ]
  assert.deepEqual(staticDocumentParams(documents, [], 'en'), [documents[0]])
  assert.deepEqual(staticDocumentParams(documents, [], 'ru'), [documents[1]])
  assert.deepEqual(staticDocumentParams([], [], 'ru'), [
    { locale: 'ru', protocol: '__empty__', kind: 'article', code: EMPTY_DOCUMENT_CODE }
  ])
})
