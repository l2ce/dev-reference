import type { ReferencePage } from '@l2ce/core/reference'
import { isDefined } from 'shared/lib/value-predicates'
import { referenceErrors } from '../config/messages'

/**
 * Собирает все страницы одного запроса, проверяя продвижение nextOffset.
 */
export function collectPages<T>(readPage: (offset: number) => ReferencePage<T>): T[] {
  const items: T[] = []
  let offset: number | null = 0
  while (isDefined(offset)) {
    const page = readPage(offset)
    items.push(...page.items)
    if (isDefined(page.nextOffset) && page.nextOffset <= offset) {
      throw new Error(referenceErrors.pagination)
    }
    offset = page.nextOffset
  }
  return items
}
