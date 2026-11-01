/**
 * Диагностики синтаксиса директив Markdown.
 */
export const markdownMessages = {
  missingField: 'Value directive needs a field',
  /**
   * Указывает директиву, не соответствующую поддерживаемому синтаксису.
   */
  invalidDirective: (value: string): string => `Invalid knowledge directive: ${value}`,
  /**
   * Указывает повторённый или некорректно записанный атрибут.
   */
  invalidAttribute: (attribute: string): string => `Invalid directive attribute: ${attribute}`,
  /**
   * Указывает атрибут, не поддерживаемый выбранной операцией.
   */
  unsupportedAttribute: (attribute: string): string => `Unsupported directive attribute: ${attribute}`
} as const
