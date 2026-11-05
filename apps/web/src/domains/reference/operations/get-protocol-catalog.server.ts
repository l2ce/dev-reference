import 'server-only'
import type { Locale } from 'shared/localization'
import { readReference } from '../adapters/read-reference'
import { buildProtocolCatalog } from '../helpers/build-protocol-catalog'
import type { ProtocolCatalog } from '../types/protocol-catalog.type'

/**
 * Читает иерархию каталога из одного снимка для первоначального HTML и поиска.
 */
export const getProtocolCatalog = (locale: Locale): ProtocolCatalog => {
  const { reader } = readReference()
  return buildProtocolCatalog(reader, locale)
}
