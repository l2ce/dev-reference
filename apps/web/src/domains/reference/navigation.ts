import type { Locale } from 'shared/localization'
import { readReference } from './adapters/read-reference'
import { getKnowledge, getProtocols } from './reference'
import { documentPath, protocolPath } from './helpers/reference-paths'
import { formatOpcode, normalizeSearch } from './helpers/knowledge-search'
import type { ProtocolTarget, SearchDocument } from './types/navigation.type'

/**
 * Строит сериализуемый поисковый индекс только явно применимых знаний.
 * Полный текст выбирается на одном языке; SQLite недоступна клиентскому компоненту.
 */
export function getKnowledgeIndex(protocol: string, locale: Locale, includeBody = true): readonly SearchDocument[] {
  const { reader, packetNames } = readReference()
  return getKnowledge(protocol, locale).map((summary) => {
    const document = includeBody ? reader.read({ protocol, locale, keys: [summary.key] }).items[0] : undefined
    const opcodeLabel = formatOpcode(summary.opcode)
    return {
      ...summary,
      opcodeLabel,
      href: documentPath(locale, protocol, summary.key),
      searchText: normalizeSearch(
        [
          summary.key,
          packetNames.get(summary.key),
          summary.title,
          summary.summary,
          document?.markdown,
          opcodeLabel,
          summary.servers.join(' '),
          summary.direction
        ].join(' ')
      )
    }
  })
}

/**
 * Сохраняет карточку при смене профиля только при её явной применимости.
 * Иначе возвращает обзор с URL-признаком для понятного сообщения пользователю.
 */
export function getProtocolTargets(locale: Locale): readonly ProtocolTarget[] {
  return getProtocols(locale).map((profile) => {
    return {
      value: profile.key.replace(/^protocol:/, ''),
      label: profile.title,
      href: protocolPath(locale, profile.key),
      documentKeys: getKnowledge(profile.key, locale).map((document) => document.key)
    }
  })
}
