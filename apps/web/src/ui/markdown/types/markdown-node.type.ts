/**
 * Минимальная структурная часть Markdown AST, используемая плагином якорей.
 */
export interface MarkdownNode {
  /* Тип узла mdast. */
  readonly type: string
  /* Текст листового узла, если он предусмотрен форматом. */
  readonly value?: string
  /* Дочерние узлы, если текущий узел составной. */
  readonly children?: readonly MarkdownNode[]
  /* Данные для преобразования в HTML; изменяются плагином до рендера. */
  data?: {
    /* HTML-атрибуты заголовка. */
    hProperties?: Record<string, unknown>
  }
}
