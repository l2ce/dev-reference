import type { ProtocolRoute, ReferenceSummary } from 'domains/reference';

/**
 * Данные выбора одного из трёх самостоятельных разделов.
 */
export interface KnowledgeSectionsProps extends ProtocolRoute {
  /* Применимые материалы для подсчёта наполненности разделов. */
  readonly documents: readonly ReferenceSummary[];
}
