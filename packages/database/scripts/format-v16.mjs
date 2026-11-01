import { convertSnapshotV17 } from './format-v17.mjs'

/**
 * Переименовывает коллекцию выпусков в формате 17, сохраняя UUID, key и содержимое документов.
 * Смешение старой и новой коллекций в снимке формата 16 отклоняется до записи.
 */
export function convertSnapshotV16(snapshot) {
  if (snapshot.schemaVersion !== 16) {
    throw new Error('The input must use schemaVersion 16.')
  }
  if (snapshot.entries.some((entry) => entry.collection === 'chronicle-releases')) {
    throw new Error('Format 16 contains the new chronicle-releases collection.')
  }
  return convertSnapshotV17({
    ...snapshot,
    schemaVersion: 17,
    entries: snapshot.entries.map((entry) => ({
      ...entry,
      collection: entry.collection === 'chronicle-implementations' ? 'chronicle-releases' : entry.collection
    }))
  })
}
