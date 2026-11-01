import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fromMarkdown } from 'mdast-util-from-markdown'

const [inputArgument, outputArgument] = process.argv.slice(2)
if (!inputArgument || !outputArgument)
  throw new Error('Usage: node scripts/convert-v9.mjs <v9-directory> <empty-output>')
const input = resolve(inputArgument)
const output = resolve(outputArgument)
const manifest = JSON.parse(await readFile(join(input, 'manifest.json'), 'utf8'))
if (manifest.schemaVersion !== 9) throw new Error('The input must use schemaVersion 9.')
const kinds = {
  packets: 'packet',
  scenarios: 'scenario',
  records: 'article',
  chronicles: 'chronicle',
  protocols: 'protocol',
  system: 'system'
}
const files = []
const mappings = []

/**
 * Переносит только активные директивы Markdown; литералы кода и экранирование сохраняются.
 */
function rewriteDescription(lines, locale) {
  const text = lines.join('\n')
  const edits = []
  function visit(node) {
    if (node.type === 'text') {
      const start = node.position.start.offset
      const raw = text.slice(start, node.position.end.offset)
      const pattern = /\{\{(link|include|value) (packet|scenario|article|record):([a-z][a-z0-9.-]*)/g
      for (const match of raw.matchAll(pattern)) {
        let escaped = 0
        for (let i = match.index - 1; i >= 0 && raw[i] === '\\'; i--) escaped++
        if (escaped % 2) continue
        const kind = match[2] === 'record' ? 'article' : match[2]
        edits.push({
          start: start + match.index,
          end: start + match.index + match[0].length,
          value: `{{${match[1]} ${kind}:${locale}:${kind}:${match[3]}`
        })
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(fromMarkdown(text))
  let rewritten = text
  for (const edit of edits.sort((a, b) => b.start - a.start))
    rewritten = rewritten.slice(0, edit.start) + edit.value + rewritten.slice(edit.end)
  return lines.length ? rewritten.split('\n') : []
}
/**
 * Обновляет описания и вложенные источники, сохраняя локальные ID самих источников.
 */
function rewriteContent(value, locale) {
  if (value.description) value.description = rewriteDescription(value.description, locale)
  for (const source of value.source ?? []) rewriteContent(source, locale)
  for (const binding of value.bindings ?? []) rewriteContent(binding, locale)
  for (const stage of value.stages ?? []) rewriteContent(stage, locale)
}
/**
 * Регистрирует будущий файл и соответствие старого адреса постоянному ID.
 */
function addFile(oldPath, path, value) {
  files.push({ path, value })
  mappings.push({ from: oldPath, to: path, id: value.id })
}
for (const locale of manifest.locales) {
  for (const collection of await readdir(join(input, locale))) {
    if (!(collection in kinds)) throw new Error(`Unsupported collection: ${collection}`)
    const target = collection === 'records' ? 'articles' : collection
    for (const slug of await readdir(join(input, locale, collection))) {
      const oldDirectory = join(locale, collection, slug)
      const entity = JSON.parse(await readFile(join(input, oldDirectory, 'index.json'), 'utf8'))
      const oldId = entity.id
      entity.id = `${locale}:${kinds[collection]}:${oldId}`
      if (collection !== 'system') entity.slug = slug
      if (entity.parentId) entity.parentId = `${locale}:${kinds[collection]}:${entity.parentId}`
      const names = (await readdir(join(input, oldDirectory))).filter((name) => name !== 'index.json').sort()
      if (collection === 'chronicles' || collection === 'protocols') {
        if (names.some((name) => name !== 'v1.json'))
          throw new Error(`Alternative descriptions need an explicit merge: ${oldDirectory}`)
        if (names.length) {
          const description = JSON.parse(await readFile(join(input, oldDirectory, 'v1.json'), 'utf8'))
          if (
            description.title !== entity.title ||
            description.summary !== entity.summary ||
            entity.description.length ||
            Object.keys(description).some((key) => !['id', 'title', 'summary', 'description'].includes(key))
          )
            throw new Error(`Description cannot be merged losslessly: ${oldDirectory}`)
          entity.description = description.description
          mappings.push({
            from: join(oldDirectory, 'v1.json'),
            to: `${locale}/${target}/${slug}/${slug}.json`,
            id: entity.id
          })
        }
      }
      if (collection === 'chronicles') {
        for (const stage of entity.stages) {
          stage.key = stage.id
          stage.id = `${locale}:stage:${oldId}:${stage.key}`
        }
      }
      if (collection === 'protocols') {
        entity.chronicleId = `${locale}:chronicle:${entity.chronicle}`
        entity.stageId = entity.stage === null ? null : `${locale}:stage:${entity.chronicle}:${entity.stage}`
        delete entity.chronicle
        delete entity.stage
      }
      if (collection === 'system') {
        if (!['catalog', 'settings'].includes(entity.kind) || names.length)
          throw new Error(`Unsupported system document: ${oldDirectory}`)
        if (entity.kind === 'settings') {
          entity.defaultVariantKey = entity.defaultVariant
          delete entity.defaultVariant
        }
      }
      rewriteContent(entity, locale)
      const path =
        collection === 'system' ? `${locale}/system/${slug}.json` : `${locale}/${target}/${slug}/${slug}.json`
      addFile(join(oldDirectory, 'index.json'), path, entity)
      if (['chronicles', 'protocols', 'system'].includes(collection)) continue
      for (const name of names) {
        const value = JSON.parse(await readFile(join(input, oldDirectory, name), 'utf8'))
        value.key = value.id
        value.id = `${entity.id}:${value.key}`
        value[`${kinds[collection]}Id`] = entity.id
        if ('previousVersionId' in value) {
          value.previousVariantId = value.previousVersionId === null ? null : `${entity.id}:${value.previousVersionId}`
          delete value.previousVersionId
        }
        for (const [position, binding] of value.bindings.entries()) {
          binding.id = `${value.id}:binding:b${position + 1}`
          binding.protocolIds = binding.protocolIds.map((id) => `${locale}:protocol:${id}`)
        }
        for (const reference of value.requires ?? []) {
          if (reference.kind === 'record') reference.kind = 'article'
          reference.id = `${locale}:${reference.kind}:${reference.id}`
        }
        rewriteContent(value, locale)
        addFile(join(oldDirectory, name), `${locale}/${target}/${slug}/${slug}.${value.key}.json`, value)
      }
    }
  }
}
await mkdir(output, { recursive: true })
if ((await readdir(output)).length) throw new Error('The output directory must be empty.')
for (const file of files) {
  await mkdir(dirname(join(output, file.path)), { recursive: true })
  await writeFile(join(output, file.path), JSON.stringify(file.value, null, 2) + '\n')
}
await writeFile(
  join(output, 'manifest.json'),
  JSON.stringify({ ...manifest, schemaVersion: 10, dataVersion: '0.11.0' }, null, 2) + '\n'
)
await writeFile(`${output}.ids.json`, JSON.stringify(mappings, null, 2) + '\n')
console.log(`Converted ${files.length} records. ID mapping: ${output}.ids.json`)
