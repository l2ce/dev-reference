import { convertSnapshotV14 } from './format-v14.mjs'

const collections = {
  packets: 'packet-implementations',
  scenarios: 'scenario-implementations',
  articles: 'article-implementations'
}

/**
 * Переводит формат 13 в 14: выделяет коллекции имплементаций и переименовывает предыдущую ссылку.
 * UUID, логические ключи, номера, источники и строки Markdown сохраняются буквально.
 */
export function convertSnapshotV13(snapshot) {
  if (snapshot.schemaVersion !== 13) {
    throw new Error('The input must use schemaVersion 13.')
  }
  const entries = snapshot.entries.map((entry) => {
    if (entry.kind === 'entity') {
      return entry
    }
    if (entry.kind !== 'variant' || !Object.hasOwn(collections, entry.collection)) {
      throw new Error(`Unexpected record role or collection: ${entry.collection}/${entry.key}.`)
    }
    const value = { ...entry.value }
    if ('previousImplementationKey' in value) {
      throw new Error(`Format 13 contains a new-format field: ${entry.key}.`)
    }
    if ('previousVariantKey' in value) {
      value.previousImplementationKey = value.previousVariantKey
      delete value.previousVariantKey
    }
    return {
      ...entry,
      kind: 'implementation',
      collection: collections[entry.collection],
      value
    }
  })
  return convertSnapshotV14({ ...snapshot, schemaVersion: 14, entries })
}
