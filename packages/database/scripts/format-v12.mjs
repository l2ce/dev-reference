import { randomUUID } from 'node:crypto'
import { convertSnapshotV13 } from './format-v13.mjs'
import { stableJson } from '../dist/model/revision.js'

/**
 * Объединяет источники по полному содержимому без старого локального ключа.
 * Различающиеся описания одного URL сохраняются; каждый экземпляр получает собственный UUID.
 */
function sources(groups) {
  const seen = new Set()
  return groups.flat().flatMap(({ key: _, ...source }) => {
    const signature = stableJson(source)
    if (seen.has(signature)) {
      return []
    }
    seen.add(signature)
    return [{ ...source, id: randomUUID() }]
  })
}

/**
 * Назначает UUID документу, этапам и оставшимся привязкам; ключи источников/привязок удаляются.
 */
function identifiedValue(input) {
  if ('id' in input) {
    throw new Error('Format 12 must not contain public IDs.')
  }
  const value = { ...input, id: randomUUID() }
  if ('source' in input) {
    value.source = sources([input.source])
  }
  if ('stages' in input) {
    value.stages = input.stages.map(identifiedValue)
  }
  if ('bindings' in input) {
    value.bindings = input.bindings.map(({ key: _, ...binding }) => identifiedValue(binding))
  }
  return value
}

/**
 * Группирует старые пакетные привязки по точным техническим полям версии.
 * Порядок списков и отличие отсутствующих states от [] сохраняются.
 */
function packetGroups(value) {
  const groups = new Map()
  for (const binding of value.bindings) {
    const signature = stableJson({
      opcode: binding.opcode,
      ...('states' in binding ? { states: binding.states } : {})
    })
    const group = groups.get(signature) ?? []
    group.push(binding)
    groups.set(signature, group)
  }
  return groups.size ? [...groups.values()] : [[]]
}

/**
 * Выбирает наиболее осторожный статус при объединении описания и применимости.
 */
function researchStatus(statuses) {
  return ['missing', 'partial', 'documented'].find((status) => statuses.includes(status))
}

/**
 * Переводит формат 12 в 13; разные опкоды/состояния получают отдельные версии пакета.
 * Исходная версия остаётся у первой группы, новые номера идут после максимального номера владельца.
 * Неоднозначные цепочки previousVariantKey требуют ручного решения до преобразования.
 */
export function convertSnapshotV12(snapshot) {
  if (snapshot.schemaVersion !== 12) {
    throw new Error('The input must use schemaVersion 12.')
  }
  const versions = new Map()
  const split = new Set()
  for (const entry of snapshot.entries) {
    if (entry.kind !== 'variant' || entry.collection !== 'packets') {
      continue
    }
    const owner = `${entry.locale}/${entry.value.packetKey}`
    versions.set(owner, Math.max(versions.get(owner) ?? 0, entry.value.version))
    if (packetGroups(entry.value).length > 1) {
      split.add(`${entry.locale}/${entry.key}`)
    }
  }
  const entries = snapshot.entries.flatMap((entry) => {
    if (entry.kind !== 'variant' || entry.collection !== 'packets') {
      return [{ ...entry, value: identifiedValue(entry.value) }]
    }
    const { bindings, ...original } = entry.value
    if (original.previousVariantKey && split.has(`${entry.locale}/${original.previousVariantKey}`)) {
      throw new Error(`Ambiguous previous packet version: ${entry.locale}/${entry.key}.`)
    }
    const owner = `${entry.locale}/${original.packetKey}`
    return packetGroups(entry.value).map((group, position) => {
      const version = position === 0 ? original.version : versions.get(owner) + 1
      if (position > 0) {
        versions.set(owner, version)
      }
      const value = {
        ...identifiedValue(original),
        key: `${original.packetKey}:v${version}`,
        version,
        protocolKeys: group.flatMap((binding) => binding.protocolKeys),
        opcode: group[0]?.opcode ?? null,
        ...(group[0] && 'states' in group[0] ? { states: group[0].states } : {}),
        status: researchStatus([original.status, ...group.map((binding) => binding.status)]),
        source: sources([original.source, ...group.map((binding) => binding.source)])
      }
      return { ...entry, key: value.key, value }
    })
  })
  return convertSnapshotV13({ ...snapshot, schemaVersion: 13, entries })
}
