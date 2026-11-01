import { convertSnapshotV15 } from './format-v15.mjs'
import { stableJson } from '../dist/model/revision.js'
import { convertSourceV14 } from './source-v14.mjs'

/**
 * Обновляет источники документа, этапов и сценарных привязок, сохраняя идентичность владельцев.
 */
function convertSources(value) {
  const result = { ...value }
  if ('source' in value) {
    result.source = value.source.map(convertSourceV14)
  }
  for (const field of ['stages', 'bindings']) {
    if (field in value) {
      result[field] = value[field].map(convertSources)
    }
  }
  return result
}

/**
 * Объединяет полные совпадения источников статьи; UUID первого экземпляра сохраняется.
 * Различающиеся пояснения и адреса остаются отдельными источниками в исходном порядке.
 */
function mergeSources(groups) {
  const seen = new Set()
  return groups.flat().filter(({ id: _, ...value }) => {
    const signature = stableJson(value)
    if (seen.has(signature)) return false
    seen.add(signature)
    return true
  })
}

/**
 * Переводит формат 14 в 15: сокращает Source и переносит применимость статьи из bindings в protocolKeys.
 * Содержательные сведения источников сохраняются; статус объединяется по наиболее осторожной оценке.
 */
export function convertSnapshotV14(snapshot) {
  if (snapshot.schemaVersion !== 14) {
    throw new Error('The input must use schemaVersion 14.')
  }
  const entries = snapshot.entries.map((entry) => {
    const value = convertSources(entry.value)
    if (entry.collection !== 'article-implementations') return { ...entry, value }
    const { bindings, ...document } = value
    if (!Array.isArray(bindings) || 'protocolKeys' in value) {
      throw new Error(`Expected format 14 article bindings: ${entry.locale}/${entry.key}.`)
    }
    const statuses = [document.status, ...bindings.map((binding) => binding.status)]
    return {
      ...entry,
      value: {
        ...document,
        protocolKeys: bindings.flatMap((binding) => binding.protocolKeys),
        status: ['missing', 'partial', 'documented'].find((status) => statuses.includes(status)),
        source: mergeSources([document.source, ...bindings.map((binding) => binding.source)])
      }
    }
  })
  return convertSnapshotV15({ ...snapshot, schemaVersion: 15, entries })
}
