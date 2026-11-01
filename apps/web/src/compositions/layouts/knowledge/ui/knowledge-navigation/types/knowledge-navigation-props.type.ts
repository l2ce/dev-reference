import type {
  ProtocolRoute,
  ProtocolTarget,
  SearchDocument,
} from 'domains/reference';

/**
 * Сериализуемые данные постоянной навигации по одному протоколу.
 */
export interface KnowledgeNavigationProps extends ProtocolRoute {
  /* Краткий индекс материалов без полных Markdown-текстов. */
  readonly documents: readonly SearchDocument[];
  /* Профили и их применимость для переключателя. */
  readonly targets: readonly ProtocolTarget[];
}
