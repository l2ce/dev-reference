/**
 * Сообщения инструментов статического preview и финализации экспорта.
 */
export const scriptMessages = {
  missingExport: 'Сначала выполните pnpm build --filter=@l2ce/web.',
  invalidPort: 'Порт должен быть целым числом от 1 до 65535.',
  internalError: 'Не удалось прочитать статический файл.',
  badRequest: 'Некорректный путь запроса.',
  method: 'Разрешены только GET и HEAD.',
  ready: 'Статический preview:',
} as const;
