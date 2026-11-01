import { openDatabase } from '@l2ce/database'
import { ReferenceReader } from '@l2ce/core/reference'
import { SUPPORTED_LOCALES } from 'shared/localization'
import { referenceErrors } from '../config/messages'
import type { ReferenceContext } from '../types/reference.type'

let buildContext: ReferenceContext | undefined

/**
 * Читает согласованный снимок read-only и закрывает соединение до рендера.
 * В production переиспользует reader в процессе сборки; dev перечитывает базу.
 */
export function readReference(): ReferenceContext {
  if (process.env.NODE_ENV === 'production' && buildContext) {
    return buildContext
  }
  const database = openDatabase({ readOnly: true })
  try {
    const snapshot = database.snapshot()
    for (const locale of SUPPORTED_LOCALES) {
      if (!snapshot.locales.includes(locale)) {
        throw new Error(`${referenceErrors.locale} ${locale}`)
      }
    }
    const context = {
      reader: new ReferenceReader(snapshot),
      locales: SUPPORTED_LOCALES,
      packetNames: new Map(
        snapshot.entries.filter((entry) => entry.collection === 'packets').map((entry) => [entry.key, entry.value.name])
      )
    }
    if (process.env.NODE_ENV === 'production') {
      buildContext = context
    }
    return context
  } finally {
    database.close()
  }
}
