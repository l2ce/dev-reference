import assert from 'node:assert/strict'
import test from 'node:test'
import { countProtocols, flattenSections, validateDataset } from '../dist/index.js'
import { dataset } from './fixtures.mjs'

test('DTO сохраняет независимые языковые базы, порядок разделов и отсутствие документов', () => {
  const input = dataset()
  const ru = structuredClone(input.bases[0].protocols[0])
  ru.title = 'Русский профиль'
  ru.sections.reverse()
  ru.documents[0].body = 'Русское описание'
  input.bases[1].protocols.push(ru)
  const result = validateDataset(input)
  const russian = result.bases.find((base) => base.locale === 'ru')
  const english = result.bases.find((base) => base.locale === 'en')
  assert.equal(russian.protocols[0].sections[0].id, 'gameplay')
  assert.equal(english.protocols[0].sections[0].id, 'overview')
  assert.equal(russian.protocols[0].documents[0].body, 'Русское описание')
  assert.equal(english.protocols[0].documents[0].body, 'English content 0.1.0\n')
  const sections = flattenSections(english.protocols[0].sections)
  assert.deepEqual(
    sections.map((section) => section.id),
    ['overview', 'gameplay', 'movement']
  )
  assert.equal(sections[2].file, null)
  assert.equal(sections[2].status, 'missing')
  assert.equal(countProtocols(result), 2)
  assert.deepEqual(validateDataset(dataset()).bases.find((base) => base.locale === 'ru').protocols, [])
})

test('DTO сохраняет отдельные профили и хроники; повторный идентификатор отклоняется', () => {
  const input = dataset()
  const other = structuredClone(input.bases[0].protocols[0])
  other.number = 456
  other.chronicle = { id: 'chronicle-b', title: 'Chronicle B' }
  other.documents[0].body = 'Different packet layout'
  input.bases[0].protocols.push(other)
  const result = validateDataset(input)
  const profiles = result.bases[0].protocols
  assert.deepEqual(
    profiles.map((profile) => [profile.number, profile.chronicle.id]),
    [
      [123, 'chronicle-a'],
      [456, 'chronicle-b']
    ]
  )
  assert.equal(profiles[1].documents[0].body, 'Different packet layout')
  assert.match(profiles[0].documents[0].body, /English content/)
  input.bases[0].protocols[1].number = 123
  assert.throws(() => validateDataset(input), /Duplicate protocol number/)
})

test('неполные разделы допустимы; документы, ID, описания и состав баз проверяются', () => {
  for (const mutate of [
    (input) => {
      input.schemaVersion = 3
    },
    (input) => {
      input.entities = []
    },
    (input) => {
      input.bases[0].protocols[0].documents = []
    },
    (input) => {
      input.bases[0].protocols[0].sections[1].children[0].id = 'overview'
    },
    (input) => {
      input.bases[0].protocols[0].sections[0].description = ' '
    },
    (input) => {
      input.bases[0].protocols[0].sections[0].file = '../other/overview.md'
    },
    (input) => {
      input.bases[0].protocols[0].sections[1].children[0].status = 'documented'
    },
    (input) => {
      input.bases[0].protocols[0].documents.push({
        file: 'unused.md',
        body: 'Orphan'
      })
    },
    (input) => {
      input.bases.pop()
    }
  ]) {
    const input = dataset()
    mutate(input)
    assert.throws(() => validateDataset(input))
  }
})
