import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { ReferenceReader } from '@l2ce/core/reference'
import { parseEntry } from '@l2ce/database'
import { sharedFixture } from '../../../packages/database/test/fixtures/shared.mjs'
import { regionalFixture } from '../../../packages/database/test/fixtures/regional.mjs'
import { buildProtocolCatalog } from '../src/domains/reference/helpers/build-protocol-catalog.ts'
import {
  countCatalogProtocols,
  filterCatalog
} from '../src/compositions/screens/catalog/ui/protocol-browser/helpers/filter-catalog.ts'
import {
  parseCatalogFilters,
  serializeCatalogFilters
} from '../src/compositions/screens/catalog/ui/protocol-browser/helpers/catalog-filters.ts'

/**
 * Собирает профили тестового представления независимо от места их отображения.
 */
const catalogProtocols = (catalog) => [
  ...catalog.unassignedProtocols,
  ...catalog.branches.flatMap((branch) =>
    branch.chronicles.flatMap((chronicle) => chronicle.releases.flatMap((release) => release.protocols))
  )
]

test('региональные ячейки не используют общий список регионов номера и фильтруются вместе с выпуском', () => {
  const catalog = buildProtocolCatalog(new ReferenceReader(regionalFixture()), 'ru')
  const release = catalog.branches[0].chronicles.find((chronicle) => chronicle.key === 'chronicle:high-five')
    .releases[0]
  assert.deepEqual(
    catalog.regions.map((region) => region.key),
    ['region:na', 'region:kr']
  )
  assert.deepEqual(
    release.contexts.find((context) => context.regionKey === 'region:na').protocols.map((protocol) => protocol.number),
    [273]
  )
  assert.deepEqual(
    release.contexts.find((context) => context.regionKey === 'region:kr').protocols.map((protocol) => protocol.key),
    ['protocol:152-rev-1']
  )
  const filtered = filterCatalog(catalog, { query: '273', onlyWithMaterials: false })
  const filteredRelease = filtered.branches[0].chronicles[0].releases[0]
  assert.equal(filteredRelease.contexts.find((context) => context.regionKey === 'region:kr').protocols.length, 0)
})

/**
 * Создаёт синтетические связи M:N и два контекста одного номера без записи в рабочую базу.
 */
const linkedFixture = () => {
  const snapshot = sharedFixture()
  snapshot.entries.find((entry) => entry.key === 'release:high-five').value.protocolKeys.push('protocol:152')
  snapshot.entries
    .find((entry) => entry.key === 'release:c4')
    .value.protocolKeys.push('protocol:152', 'protocol:152-rev-1')
  return snapshot
}

test('каталог сохраняет M:N, разные профили одного номера и считает уникальные протоколы', () => {
  const catalog = buildProtocolCatalog(new ReferenceReader(linkedFixture()), 'ru')
  assert.equal(countCatalogProtocols(catalog), 4)
  assert.equal(catalogProtocols(catalog).filter((protocol) => protocol.key === 'protocol:152').length, 2)
  const matches = filterCatalog(catalog, { query: '152', onlyWithMaterials: false })
  assert.equal(countCatalogProtocols(matches), 2)
  assert.equal(matches.branches[0].chronicles.length, 2)
  assert.equal(countCatalogProtocols(filterCatalog(catalog, { query: '152-rev-1', onlyWithMaterials: false })), 1)
  const exact = filterCatalog(catalog, { query: 'protocol:152', onlyWithMaterials: false })
  assert.ok(catalogProtocols(exact).every((protocol) => protocol.variant === 0))
  assert.equal(countCatalogProtocols(exact), 1)
})

test('поиск сохраняет контекст хроники, сочетает слова и не смешивает числовые подстроки', () => {
  const catalog = buildProtocolCatalog(new ReferenceReader(linkedFixture()), 'en')
  const chronicle = filterCatalog(catalog, { query: 'high five', onlyWithMaterials: false })
  assert.equal(chronicle.branches[0].chronicles[0].key, 'chronicle:high-five')
  assert.equal(countCatalogProtocols(chronicle), 2)
  const combined = filterCatalog(catalog, { query: 'main c4 152', onlyWithMaterials: false })
  assert.equal(combined.branches[0].chronicles.length, 1)
  assert.equal(countCatalogProtocols(combined), 2)
  assert.equal(countCatalogProtocols(filterCatalog(catalog, { query: '15', onlyWithMaterials: false })), 0)
  assert.equal(countCatalogProtocols(filterCatalog(catalog, { query: '273', onlyWithMaterials: false })), 1)
})

test('доступность определяется непустым текстом применимого знания именно выбранного языка', () => {
  const snapshot = sharedFixture()
  for (const entry of snapshot.entries.filter((entry) => entry.kind === 'implementation')) {
    entry.value.translations.find((translation) => translation.locale === 'ru').description = '   '
  }
  const revision = snapshot.entries.find((entry) => entry.key === 'packet:key-packet:rev-1')
  revision.value.status = 'partial'
  revision.value.translations.find((translation) => translation.locale === 'ru').description =
    'Частично известный обмен.'
  const reader = new ReferenceReader(snapshot)
  const catalog = buildProtocolCatalog(reader, 'ru')
  const protocol = catalogProtocols(catalog).find((profile) => profile.key === 'protocol:273')
  assert.equal(protocol.materialCount, 1)
  const filtered = filterCatalog(catalog, { query: '', onlyWithMaterials: true })
  assert.equal(countCatalogProtocols(filtered), 2)
  assert.equal(filtered.unassignedProtocols.length, 0)
  assert.ok(catalogProtocols(filtered).every((profile) => profile.materialCount > 0))
  const english = buildProtocolCatalog(reader, 'en')
  assert.equal(catalogProtocols(english).find((profile) => profile.key === 'protocol:273').materialCount, 7)

  revision.value.translations.find((translation) => translation.locale === 'ru').translationStatus = 'missing'
  const missing = buildProtocolCatalog(new ReferenceReader(snapshot), 'ru')
  assert.equal(countCatalogProtocols(filterCatalog(missing, { query: '', onlyWithMaterials: true })), 0)
})

test('неполные записи, отсутствие перевода и неизвестная принадлежность остаются видимыми', () => {
  const snapshot = sharedFixture()
  const chronicle = snapshot.entries.find((entry) => entry.key === 'chronicle:c4')
  chronicle.value.translations = chronicle.value.translations.filter((translation) => translation.locale === 'en')
  snapshot.entries.find((entry) => entry.key === 'release:c4').value.protocolKeys = []
  const catalog = buildProtocolCatalog(new ReferenceReader(snapshot), 'ru')
  const untranslated = catalog.branches[0].chronicles.find((entry) => entry.key === 'chronicle:c4')
  assert.equal(untranslated.title, 'chronicle:c4')
  assert.equal(untranslated.translationStatus, 'missing')
  assert.equal(untranslated.releases[0].protocols.length, 0)
  assert.ok(catalog.unassignedProtocols.some((protocol) => protocol.key === 'protocol:656'))
  assert.equal(filterCatalog(catalog, { query: 'c4', onlyWithMaterials: false }).branches[0].chronicles.length, 1)
  assert.equal(filterCatalog(catalog, { query: 'c4', onlyWithMaterials: true }).branches.length, 0)
})

test('профили за первой страницей API входят в каталог без потери пустых веток и хроник', () => {
  const snapshot = sharedFixture()
  for (let index = 0; index < 107; index += 1) {
    snapshot.entries.push(
      parseEntry({
        collection: 'protocols',
        kind: 'entity',
        key: `protocol:${2000 + index}`,
        value: { id: randomUUID(), key: `protocol:${2000 + index}`, number: 2000 + index, variant: 0, translations: [] }
      })
    )
  }
  snapshot.entries.push(
    parseEntry({
      collection: 'branches',
      kind: 'entity',
      key: 'branch:empty',
      value: { id: randomUUID(), key: 'branch:empty', code: 'empty', translations: [] }
    })
  )
  snapshot.entries.push(
    parseEntry({
      collection: 'chronicles',
      kind: 'entity',
      key: 'chronicle:empty',
      value: { id: randomUUID(), key: 'chronicle:empty', code: 'empty', branchKey: 'branch:main', translations: [] }
    })
  )
  const catalog = buildProtocolCatalog(new ReferenceReader(snapshot), 'en')
  assert.equal(countCatalogProtocols(catalog), 111)
  assert.ok(catalog.unassignedProtocols.some((protocol) => protocol.number === 2106))
  assert.equal(catalog.branches.find((branch) => branch.key === 'branch:empty').chronicles.length, 0)
  assert.equal(
    catalog.branches
      .find((branch) => branch.key === 'branch:main')
      .chronicles.find((entry) => entry.key === 'chronicle:empty').releases.length,
    0
  )
})

test('ссылка восстанавливает поиск и доступность, неподдерживаемые значения нормализуются', () => {
  const filters = { query: 'Main 152', onlyWithMaterials: true }
  assert.deepEqual(parseCatalogFilters(serializeCatalogFilters(filters).toString()), filters)
  assert.deepEqual(parseCatalogFilters('?materials=unknown&other=1'), { query: '', onlyWithMaterials: false })
  assert.equal(parseCatalogFilters(`?q=${'a'.repeat(250)}`).query.length, 200)
  assert.equal(serializeCatalogFilters({ query: '', onlyWithMaterials: false }).toString(), '')
})
