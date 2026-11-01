import type { DatabaseEntry } from './model.types.js'

/**
 * Собирает UUID документа и вложенных объектов; ссылки на чужие записи сюда не входят.
 * Источники каждого владельца имеют независимые ID, даже при одинаковом содержимом.
 */
export function entryIds(entry: DatabaseEntry): readonly string[] {
  const ids = [
    entry.value.id,
    ...('translations' in entry.value
      ? entry.value.translations.flatMap((translation) => translation.source.map((source) => source.id))
      : [])
  ]
  return ids
}
