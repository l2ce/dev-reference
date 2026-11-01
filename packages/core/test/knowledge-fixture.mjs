import { readFile } from 'node:fs/promises'
import { convertSourceV14 } from '../../database/scripts/source-v14.mjs'

/**
 * Адаптирует неизменяемый исторический fixture к текущему контракту источников.
 * Тестовые UUID детерминированы; все ссылки sourceIds переводятся тем же отображением.
 */
export async function knowledgeFixture() {
  const snapshot = JSON.parse(await readFile(new URL('./fixtures/knowledge-v6.json', import.meta.url), 'utf8'))
  const ids = new Map(
    snapshot.sources.map((source, index) => [
      source.id,
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
    ])
  )
  snapshot.sources = snapshot.sources.map((source) => convertSourceV14({ ...source, id: ids.get(source.id) }))
  /**
   * Обновляет только ссылки источников, сохраняя предметные ID рендерера.
   */
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if ('sourceIds' in value)
      value.sourceIds = value.sourceIds.map((id) => {
        if (!ids.has(id)) throw new Error(`Unknown fixture source: ${id}`)
        return ids.get(id)
      })
    Object.values(value).forEach(visit)
  }
  visit(snapshot)
  snapshot.schemaVersion = 7
  return snapshot
}
