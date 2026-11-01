/**
 * Диагностики разрешения документов и настройки общего рендерера.
 */
export const knowledgeMessages = {
  invalidLimits: 'Rendering limits must be positive integers',
  /**
   * Указывает несуществующий ID документной сущности.
   */
  unknownEntity: (key: string): string => `Unknown entity: ${key}`,
  /**
   * Требует сервер для ссылки, применимой сразу к нескольким серверам.
   */
  explicitServer: (key: string): string => `Reference needs an explicit server: ${key}`,
  /**
   * Обозначает нарушенную связь с отсутствующей версией документа.
   */
  unknownVersion: (id: string): string => `Unknown document version: ${id}`
} as const
