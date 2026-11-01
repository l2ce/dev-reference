import type { ReferenceSummary } from '@l2ce/core/reference'
import type { SearchDocument } from '../types/navigation.type'

/**
 * Форматирует известную последовательность опкода, сохраняя нулевое значение и ширину.
 */
export function formatOpcode(opcode: ReferenceSummary['opcode']): string | null {
  if (opcode === null) {
    return null
  }
  const widths = { u8: 2, u16le: 4, u32le: 8 } as const
  return opcode.map((part) => `0x${part.value.toString(16).toUpperCase().padStart(widths[part.type], '0')}`).join(' / ')
}

/**
 * Нормализует технический текст и поисковый запрос одинаковым способом.
 */
export function normalizeSearch(text: string): string {
  return text.normalize('NFKC').toLowerCase()
}

/**
 * Ищет все слова запроса в подготовленном индексе текущего профиля и языка.
 */
export function matchesKnowledge(document: SearchDocument, query: string): boolean {
  return normalizeSearch(query)
    .trim()
    .split(/\s+/)
    .every((word) => document.searchText.includes(word))
}
