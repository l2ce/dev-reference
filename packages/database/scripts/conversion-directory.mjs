import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { indexEntries, recordPath } from '../dist/index.js'
import { recordKey } from '../dist/model/entry.js'
import { orderDatabaseJson } from '../dist/exchange/serializer.js'

/**
 * Проверяет прежнюю раскладку форматов 11–13 по владельцам, не подменяя её текущим recordPath.
 */
function validateLegacyPaths(entries, paths) {
  const index = indexEntries(entries)
  entries.forEach((entry, position) => {
    let expected
    if (entry.collection === 'system') {
      expected = `${entry.locale}/system/${entry.value.kind}.json`
    } else {
      const key =
        entry.kind === 'entity'
          ? entry.key
          : (entry.value.packetKey ?? entry.value.scenarioKey ?? entry.value.articleKey)
      const owner = index.get(recordKey({ locale: entry.locale, key }))
      if (!owner || owner.kind !== 'entity' || owner.collection !== entry.collection) {
        throw new Error(`Missing legacy owner: ${paths[position]}.`)
      }
      const slug = owner.value.slug
      expected = `${entry.locale}/${entry.collection}/${slug}/${slug}${entry.kind === 'variant' ? `.v${entry.value.version}` : ''}.json`
    }
    if (expected !== paths[position] || ('locale' in entry.value && entry.value.locale !== entry.locale)) {
      throw new Error(`Document path or locale mismatch: ${paths[position]}.`)
    }
  })
}

/**
 * Читает старый каталог, проверяет преобразованный снимок и сохраняет только в пустое назначение.
 * Параметр convert отвечает за контракт входного формата и полную предметную проверку результата.
 */
export async function runConversion(convert, command, options = { layout: 'legacy' }) {
  const [inputArgument, outputArgument] = process.argv.slice(2)
  if (!inputArgument || !outputArgument || process.argv.length !== 4) {
    throw new Error(`Usage: node scripts/${command} <input-directory> <empty-output>`)
  }
  const input = resolve(inputArgument)
  const output = resolve(outputArgument)
  const manifest = JSON.parse(await readFile(join(input, 'manifest.json'), 'utf8'))
  const entries = []
  const paths = []
  for (const file of await readdir(input, {
    recursive: true,
    withFileTypes: true
  })) {
    const path = join(file.parentPath, file.name)
    const address = relative(input, path)
    if (file.isDirectory() || address === 'manifest.json') {
      continue
    }
    if (!file.isFile() || !file.name.endsWith('.json')) {
      throw new Error(`Unexpected file: ${path}.`)
    }
    const [locale, collection] = address.split('/')
    const value = JSON.parse(await readFile(path, 'utf8'))
    let kind = 'version' in value ? 'variant' : 'entity'
    if (options.layout === 'separate') {
      kind =
        collection.endsWith('-implementations') || collection === 'chronicle-releases' ? 'implementation' : 'entity'
    }
    entries.push({
      locale,
      collection,
      key: value.key,
      kind,
      value
    })
    paths.push(address)
  }
  if (options.layout === 'separate') {
    const index = indexEntries(entries)
    entries.forEach((entry, position) => {
      let expected
      if (entry.collection === 'system') {
        expected = `${entry.locale}/system/${entry.value.kind}.json`
      } else if (entry.kind === 'entity') {
        expected = `${entry.locale}/${entry.collection}/${entry.value.slug}.json`
      } else {
        const ownerKey =
          entry.value.packetKey ?? entry.value.scenarioKey ?? entry.value.articleKey ?? entry.value.chronicleKey
        const owner = index.get(recordKey({ locale: entry.locale, key: ownerKey }))
        if (!owner || owner.kind !== 'entity') throw new Error(`Missing legacy owner: ${paths[position]}.`)
        const slug = owner.value.slug
        expected = `${entry.locale}/${entry.collection}/${slug}/${slug}.v${entry.value.version}.json`
      }
      if (expected !== paths[position] || entry.locale !== entry.value.locale) {
        throw new Error(`Document path or locale mismatch: ${paths[position]}.`)
      }
    })
  } else {
    validateLegacyPaths(entries, paths)
  }
  const snapshot = convert({ ...manifest, entries })
  const index = indexEntries(snapshot.entries)
  await mkdir(output, { recursive: true })
  if ((await readdir(output)).length) {
    throw new Error('The output directory must be empty.')
  }
  for (const entry of snapshot.entries) {
    const path = join(output, recordPath(entry, index))
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(orderDatabaseJson(entry.value), null, 2) + '\n')
  }
  const { entries: _, ...metadata } = snapshot
  await writeFile(join(output, 'manifest.json'), JSON.stringify(orderDatabaseJson(metadata), null, 2) + '\n')
  console.log(`Converted ${snapshot.entries.length} records to format ${snapshot.schemaVersion}.`)
}
