import assert from 'node:assert/strict'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { batchJsonSchema, describeSchema, operationJsonSchema, parameterJsonSchema } from '../dist/help/schema.js'
import { COMMAND_SPECS } from '../dist/help/catalog.js'
import { supportsCommandType } from '../dist/help/document.js'
import { TYPES } from '../dist/commands/model.js'
import { invokeCli } from './support/help-runner.mjs'

const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats(ajv)

test('схемы параметров отличают режимы справки от предметного действия', () => {
  const help = ajv.compile(parameterJsonSchema('help'))
  assert.equal(help({ structureOnly: true, format: 'json' }), true)
  assert.equal(help({ structureOnly: true }), false)
  assert.equal(help({ structureOnly: true, brief: true, format: 'json' }), false)
  const schema = ajv.compile(parameterJsonSchema('schema'))
  assert.equal(schema({ operation: 'update', brief: true }), true)
  assert.equal(schema({ operation: 'update', structureOnly: true, format: 'json' }), false)
  const update = ajv.compile(parameterJsonSchema('update', 'protocols'))
  assert.equal(update({ keys: ['protocol:273'], brief: true }), false)
  assert.equal(update({ keys: ['protocol:273'], structureOnly: true, format: 'json' }), false)
  assert.equal(update({ selection: '-', setStdin: 'description' }), false)
  assert.equal(update({ selection: '-', title: 'Название' }), true)
  const read = ajv.compile(parameterJsonSchema('read'))
  assert.equal(read({ selection: '-', limit: 1 }), false)
  assert.equal(read({ selection: '-' }), true)
})

test('схемы параметров всех конечных команд и значения всех допустимых мутаций — валидный JSON Schema 2020', () => {
  for (const command of COMMAND_SPECS.filter((command) => !command.group)) {
    assert.equal(ajv.validateSchema(parameterJsonSchema(command.id)), true, command.id)
  }
  for (const operation of [
    'create',
    'update',
    'replace',
    'translation.set',
    'source.add',
    'source.update',
    'source.remove',
    'question.add',
    'question.remove',
    'delete',
    'link',
    'unlink',
    'revision.add'
  ]) {
    for (const collection of Object.keys(TYPES).filter((type) => supportsCommandType(operation, type))) {
      assert.equal(
        ajv.validateSchema(operationJsonSchema(operation, collection)),
        true,
        `${operation}/${collection}: ${JSON.stringify(ajv.errors)}`
      )
    }
  }
})

test('ранее отсутствовавшие схемы revision, locale, init, import и export доступны без базы', async () => {
  for (const args of [
    ['schema', 'revision.add', 'packet:example'],
    ['schema', 'locale.add'],
    ['schema', 'locale.set-default'],
    ['schema', 'locale.delete'],
    ['schema', 'init'],
    ['schema', 'import'],
    ['schema', 'export'],
    ['schema', 'read', '--type', 'releases']
  ]) {
    const result = await invokeCli([...args, '--format', 'json'])
    assert.equal(result.code, 0, result.stderr)
    const document = JSON.parse(result.stdout).data
    assert.equal(ajv.validateSchema(document.schema), true)
    assert.ok(document.examples.length)
  }
})

test('батч не рекламирует произвольные values/files: схема проверяет тип, op, обязательные поля и файловый канал', () => {
  const schema = batchJsonSchema()
  assert.equal(ajv.validateSchema(schema), true, JSON.stringify(ajv.errors))
  const validate = ajv.compile(schema)
  const batch = (operation) => ({ formatVersion: 1, operations: [operation] })
  for (const operation of [
    { op: 'create', key: 'release:example', values: { chronicle: 'chronicle:example', title: 'Пример' } },
    {
      op: 'source.add',
      key: 'protocol:1',
      values: { url: 'https://example.invalid' },
      files: { title: './title.txt' }
    },
    { op: 'update', key: 'packet:example:rev-1', values: { opcode: [{ type: 'u8', value: 0 }] } },
    { op: 'translation.set', key: 'release:example', locale: 'en', values: { title: 'Example' } },
    { op: 'source.remove', key: 'protocol:1', options: { matchHost: 'example.invalid', allMatches: true } },
    { op: 'source.clear', key: 'protocol:1', options: { allLocales: true } },
    { op: 'link', key: 'packet:example:rev-1', relation: 'protocols', targets: ['protocol:1'] },
    { op: 'unlink', key: 'packet:example:rev-1', relation: 'protocols', options: { all: true } }
  ])
    assert.equal(validate(batch(operation)), true, JSON.stringify(validate.errors))
  for (const operation of [
    { op: 'create', key: 'release:example', values: {} },
    { op: 'create', key: 'invented:example', values: {} },
    { op: 'create', key: 'protocol:not-a-number', values: {} },
    { op: 'create', key: 'branch:WrongCase', values: {} },
    { op: 'update', key: 'release:example', values: { invented: 'x' } },
    { op: 'update', key: 'release:example', values: { title: 'x' }, files: { title: './title.txt' } },
    { op: 'update', key: 'release:example', values: { title: 'x' }, clear: ['title'] },
    { op: 'translation.set', key: 'packet:example', values: { title: 'Wrong owner' } },
    { op: 'translation.set', key: 'release:example', values: { opcode: null } },
    { op: 'source.add', key: 'protocol:1', values: { url: 'https://example.invalid' } },
    { op: 'source.remove', key: 'protocol:1' },
    {
      op: 'source.remove',
      key: 'protocol:1',
      options: { id: '00000000-0000-4000-8000-000000000001', matchHost: 'example.invalid' }
    },
    { op: 'source.clear', key: 'protocol:1' },
    { op: 'link', key: 'packet:example:rev-1', relation: 'protocols' },
    { op: 'update', key: 'protocol:1', files: { loginRevisions: './numbers.txt' } },
    { op: 'update', key: 'protocol:1', files: { description: '-' } }
  ])
    assert.equal(validate(batch(operation)), false, `Схема приняла ${JSON.stringify(operation)}`)
})

test('схема и обычная справка согласуют обязательность и типы полей без ручных UUID', () => {
  const document = describeSchema('create', 'releases').data
  assert.deepEqual(document.schema.required, ['chronicle'])
  assert.equal(document.fields.find((field) => field.name === 'description').format, 'markdown')
  assert.equal(
    document.fields.some((field) => field.name === 'id'),
    false
  )
  assert.ok(document.parameters.properties.dryRun)
})

test('схемы параметров выражают обязательные флаги, альтернативные каналы и несовместимые области', () => {
  const check = (operation, collection, input, expected) => {
    const validate = ajv.compile(parameterJsonSchema(operation, collection))
    assert.equal(
      validate(input),
      expected,
      `${operation}: ${JSON.stringify(input)}\n${JSON.stringify(validate.errors)}`
    )
  }
  check('source.add', 'protocols', { key: 'protocol:1', url: 'https://example.invalid', title: 'Источник' }, true)
  check('source.add', 'protocols', { key: 'protocol:1' }, false)
  check('source.add', 'protocols', { key: 'protocol:1', url: 'https://example.invalid', setStdin: 'title' }, true)
  check('source.clear', 'protocols', { keys: ['protocol:1'] }, false)
  check('source.clear', 'protocols', { keys: ['protocol:1'], allLocales: true }, true)
  check(
    'source.remove',
    'protocols',
    { selection: './selected.json', matchHost: 'example.invalid', allMatches: true },
    true
  )
  check('source.remove', 'protocols', { selection: './selected.json', id: 'id', matchUrl: 'url' }, false)
  check('replace', 'protocols', { key: 'protocol:1', input: '-' }, false)
  check('replace', 'protocols', { key: 'protocol:1', input: '-', ifVersion: 'v1:example' }, true)
  check('import', undefined, { input: './snapshot' }, false)
  check('import', undefined, { input: './snapshot', replace: false }, false)
  check('import', undefined, { input: './snapshot', replace: true }, true)
  check('read', 'protocols', { keys: ['protocol:1'], content: 'description', limit: 1 }, false)
  check('read', 'protocols', { keys: ['protocol:1'], content: 'description' }, true)
  check('list', 'protocols', { all: true, limit: 1 }, false)
  check('list', 'protocols', { locale: 'ru', allLocales: true }, false)
  check('create', 'releases', { key: 'release:example' }, false)
  check('create', 'releases', { key: 'release:example', chronicle: 'chronicle:example' }, true)
})
