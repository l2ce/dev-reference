import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { indexEntries, recordPath } from '../dist/index.js'
import { orderDatabaseJson } from '../dist/exchange/serializer.js'
import { convertSnapshotV11 } from './format-v11.mjs'

/**
 * Убирает повтор типа перед публичным ключом только в активных директивах Markdown.
 */
function rewriteDescription(lines) {
  const text = lines.join('\n')
  const edits = []
  /**
   * Обходит текстовые узлы, сохраняя код, экранирование и точные исходные пробелы.
   */
  function visit(node) {
    if (node.type === 'text') {
      const start = node.position.start.offset
      const raw = text.slice(start, node.position.end.offset)
      for (const match of raw.matchAll(
        /\{\{(link|include|value) (packet|scenario|article):((?:ru|en):(?:packet|scenario|article):[a-z0-9.-]+)/g
      )) {
        let escaped = 0
        for (let i = match.index - 1; i >= 0 && raw[i] === '\\'; i--) {
          escaped++
        }
        if (escaped % 2) {
          continue
        }
        if (match[2] !== match[3].split(':')[1]) {
          throw new Error('The directive type does not match its key.')
        }
        edits.push({
          start: start + match.index,
          end: start + match.index + match[0].length,
          value: `{{${match[1]} ${match[3]}`
        })
      }
    }
    for (const child of node.children ?? []) {
      visit(child)
    }
  }
  visit(fromMarkdown(text))
  let result = text
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end)
  }
  return lines.length ? result.split('\n') : []
}

/**
 * Преобразует обозначение vN в положительный номер; произвольные старые названия требуют ручного решения.
 */
function versionNumber(key) {
  if (!/^v[1-9][0-9]*$/.test(key)) {
    throw new Error(`Cannot assign a numeric version to ${key}.`)
  }
  const number = Number(key.slice(1))
  if (!Number.isSafeInteger(number)) {
    throw new Error(`Version exceeds the safe integer range: ${key}.`)
  }
  return number
}

/**
 * Переносит публичные идентификаторы в key, ссылки — в *Key; технические ID не экспортируются.
 */
function convertValue(input) {
  const value = { ...input, key: input.id }
  delete value.id
  if ('packetId' in input || 'scenarioId' in input || 'articleId' in input) {
    value.version = versionNumber(input.key)
  }
  for (const [from, to] of Object.entries({
    packetId: 'packetKey',
    scenarioId: 'scenarioKey',
    articleId: 'articleKey',
    chronicleId: 'chronicleKey',
    stageId: 'stageKey',
    parentId: 'parentKey',
    previousVariantId: 'previousVariantKey',
    protocolIds: 'protocolKeys'
  })) {
    if (from in value) {
      value[to] = value[from]
      delete value[from]
    }
  }
  if ('defaultVariantKey' in value) {
    value.defaultVersion = versionNumber(value.defaultVariantKey)
    delete value.defaultVariantKey
  }
  if (value.description) {
    value.description = rewriteDescription(value.description)
  }
  for (const field of ['source', 'bindings', 'stages']) {
    if (field in value) {
      value[field] = value[field].map(convertValue)
    }
  }
  if ('requires' in value) {
    value.requires = value.requires.map((reference) => {
      if (reference.kind !== reference.id.split(':')[1]) {
        throw new Error('A dependency type does not match its key.')
      }
      return {
        key: reference.id,
        ...('server' in reference ? { server: reference.server } : {})
      }
    })
  }
  return value
}

const [inputArgument, outputArgument] = process.argv.slice(2)
if (!inputArgument || !outputArgument) {
  throw new Error('Usage: node scripts/convert-v10.mjs <v10-directory> <empty-output>')
}
const input = resolve(inputArgument)
const output = resolve(outputArgument)
const manifest = JSON.parse(await readFile(join(input, 'manifest.json'), 'utf8'))
if (manifest.schemaVersion !== 10) {
  throw new Error('The input must use schemaVersion 10.')
}
const entries = []
for (const file of await readdir(input, {
  recursive: true,
  withFileTypes: true
})) {
  if (!file.isFile() || file.name === 'manifest.json') {
    continue
  }
  const path = join(file.parentPath, file.name)
  const relative = path.slice(input.length + 1).split('/')
  const original = JSON.parse(await readFile(path, 'utf8'))
  const value = convertValue(original)
  const kind = 'version' in value ? 'variant' : 'entity'
  entries.push({
    locale: relative[0],
    collection: relative[1],
    key: value.key,
    kind,
    value
  })
}
const snapshot = convertSnapshotV11({
  ...manifest,
  schemaVersion: 11,
  dataVersion: '0.12.0',
  entries
})
await mkdir(output, { recursive: true })
if ((await readdir(output)).length) {
  throw new Error('The output directory must be empty.')
}
const index = indexEntries(snapshot.entries)
for (const entry of snapshot.entries) {
  const path = join(output, recordPath(entry, index))
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(orderDatabaseJson(entry.value), null, 2) + '\n')
}
const { entries: _, ...metadata } = snapshot
await writeFile(join(output, 'manifest.json'), JSON.stringify(orderDatabaseJson(metadata), null, 2) + '\n')
console.log(`Converted ${snapshot.entries.length} records to format ${snapshot.schemaVersion}.`)
