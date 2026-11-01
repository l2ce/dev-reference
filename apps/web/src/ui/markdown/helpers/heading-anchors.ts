import type { MarkdownNode } from '../types/markdown-node.type';

/**
 * Собирает текст заголовка из обычного текста, ссылок и inline code.
 */
function headingText(node: MarkdownNode): string {
  return node.value ?? node.children?.map(headingText).join('') ?? '';
}

/**
 * Присваивает заголовкам стабильные уникальные якоря до серверного HTML-рендера.
 * Кодовые блоки не интерпретируются как заголовки; повторения получают суффикс.
 */
export function headingAnchors(): (tree: MarkdownNode) => void {
  return (tree): void => {
    const counts = new Map<string, number>();
    /**
     * Обходит узлы AST и добавляет только HTML-id заголовков.
     */
    const visit = (node: MarkdownNode): void => {
      if (node.type === 'heading') {
        const base = `section-${
          headingText(node)
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, '-')
            .replace(/^-|-$/g, '') || 'heading'
        }`;
        const count = counts.get(base) ?? 0;
        counts.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        node.data = {
          ...node.data,
          hProperties: { ...node.data?.hProperties, id },
        };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
