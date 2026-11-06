import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceSchema as databaseSourceSchema } from '@l2ce/database/source'
import { sourceSchema, validateKnowledge, toDocumentationDataset, validateDataset } from '../dist/index.js'
import { knowledgeFixture } from './knowledge-fixture.mjs'
import { dataset } from './fixtures.mjs'

test('Core использует единственную схему источников базы и сохраняет необязательный summary в DTO', () => {
  assert.equal(sourceSchema, databaseSourceSchema)
  const value = dataset()
  const source = value.bases[0].protocols[0].sources[0]
  delete source.summary
  assert.deepEqual(validateDataset(value).bases[0].protocols[0].sources[0], source)
  source.locator = 'obsolete'
  assert.throws(() => validateDataset(value))
})

test('проекция сохраняет UUID и компактные источники; пояснения не являются Markdown-директивами', async () => {
  const snapshot = await knowledgeFixture()
  snapshot.sources[0].summary = '{{include unknown:document}}'
  const checked = validateKnowledge(snapshot)
  const result = toDocumentationDataset(checked, {
    renderLink: (target) => target.id
  })
  const projected = result.bases.flatMap((base) => base.protocols).flatMap((profile) => profile.sources)
  assert.ok(
    projected.some((source) => source.id === snapshot.sources[0].id && source.summary === snapshot.sources[0].summary)
  )
  for (const source of projected) assert.deepEqual(sourceSchema.parse(source), source)
})

test('документы, привязки и проекция сайта допускают отсутствие всех источников', async () => {
  const snapshot = await knowledgeFixture()
  snapshot.sources = []
  for (const record of [...snapshot.chronicles, ...snapshot.protocols, ...snapshot.documents]) record.sourceIds = []
  for (const entity of snapshot.entities) {
    for (const binding of entity.bindings) binding.sourceIds = []
  }
  const checked = validateKnowledge(snapshot)
  const result = validateDataset(toDocumentationDataset(checked, { renderLink: (target) => target.id }))
  const profiles = result.bases.flatMap((base) => base.protocols)
  assert.ok(profiles.length > 0)
  for (const profile of profiles) assert.deepEqual(profile.sources, [])
})

test('DTO сайта допускает пустой или отсутствующий список источников', () => {
  for (const omitted of [false, true]) {
    const input = dataset()
    for (const base of input.bases) {
      for (const profile of base.protocols) {
        if (omitted) delete profile.sources
        else profile.sources = []
      }
    }
    for (const base of validateDataset(input).bases) {
      for (const profile of base.protocols) assert.deepEqual(profile.sources, [])
    }
  }
})
