import assert from 'node:assert/strict'
import test from 'node:test'
import { changePathLocale } from '../src/shared/localization'
import { formatOpcode, getReferenceLocation, resolveProtocolTarget, sectionPath } from '../src/domains/reference'
import type { SearchDocument } from '../src/domains/reference'
import {
  parseSectionFilters,
  serializeSectionFilters
} from '../src/compositions/screens/section/ui/section-browser/helpers/section-filters'
import { selectSectionPage } from '../src/compositions/screens/section/ui/section-browser/helpers/section-page'

/**
 * Создаёт явно синтетический индекс для проверки каталога с более чем ста документами.
 */
function mockDocuments(): SearchDocument[] {
  return Array.from({ length: 137 }, (_, index) => ({
    key: `packet:example-${index}`,
    kind: 'packet',
    protocol: '273',
    locale: 'en',
    revisionKey: null,
    availability: 'available',
    title: `Synthetic packet ${index}`,
    summary: null,
    status: 'missing',
    translationStatus: 'ready',
    servers: ['game'],
    direction: 'client-to-server',
    opcode: null,
    states: [],
    opcodeLabel: null,
    href: `/protocols/273/packet/example-${index}/`,
    searchText: `synthetic packet ${index} ${index > 120 ? 'tail-marker' : ''}`
  }))
}

test('поиск выполняется до пагинации и находит документы за первой сотней', () => {
  const documents = mockDocuments()
  const lastPage = selectSectionPage(documents, parseSectionFilters('?page=7'), 'packet')
  assert.equal(lastPage.total, 137)
  assert.equal(lastPage.items.length, 17)
  assert.equal(lastPage.items[0]?.key, 'packet:example-120')
  const filtered = selectSectionPage(documents, parseSectionFilters('?q=tail-marker&page=999'), 'packet')
  assert.equal(filtered.total, 16)
  assert.equal(filtered.currentPage, 1)
  assert.equal(filtered.items[0]?.key, 'packet:example-121')
  assert.equal(selectSectionPage(documents, parseSectionFilters('?server=login'), 'packet').total, 0)
})

test('фильтры восстанавливаются из ссылки, а некорректные параметры нормализуются', () => {
  const filters = parseSectionFilters('?q=ключ&server=game&direction=server-to-client&page=3')
  assert.deepEqual(parseSectionFilters(serializeSectionFilters(filters).toString()), filters)
  const invalid = parseSectionFilters('?page=-5&server=other&direction=unknown')
  assert.equal(invalid.page, 1)
  assert.equal(invalid.server, 'all')
  assert.equal(invalid.direction, 'all')
})

test('язык, профиль и раздел сохраняются независимо от публичного префикса публикации', () => {
  assert.equal(changePathLocale('/protocols/152-rev-2/packets/', 'ru'), '/ru/protocols/152-rev-2/packets/')
  assert.equal(
    changePathLocale('/ru/protocols/273/article/game-framing/', 'en'),
    '/protocols/273/article/game-framing/'
  )
  assert.equal(sectionPath('en', '273', 'scenario'), '/protocols/273/scenarios/')
  assert.deepEqual(getReferenceLocation('/ru/protocols/273/packet/key-packet/'), {
    kind: 'packet',
    documentKey: 'packet:key-packet'
  })
  const target = {
    value: '268',
    label: 'Example',
    href: '/protocols/268/',
    documentKeys: ['packet:key-packet']
  }
  assert.equal(resolveProtocolTarget(target, 'en', { kind: 'article' }), '/protocols/268/articles/')
  assert.equal(
    resolveProtocolTarget(target, 'en', {
      kind: 'packet',
      documentKey: 'packet:key-packet'
    }),
    '/protocols/268/packet/key-packet/'
  )
  assert.equal(
    resolveProtocolTarget(target, 'en', {
      kind: 'packet',
      documentKey: 'packet:missing'
    }),
    '/protocols/268/?unavailable=packet%3Amissing'
  )
})

test('опкод сохраняет неизвестность, известный ноль и ширину компонентов', () => {
  assert.equal(formatOpcode(null), null)
  assert.equal(
    formatOpcode([
      { type: 'u8', value: 0 },
      { type: 'u16le', value: 1 }
    ]),
    '0x00 / 0x0001'
  )
})
