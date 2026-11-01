/**
 * Ответ инструмента MCP одновременно в текстовом и структурированном представлении.
 */
export interface ToolReply extends CallToolResult {
  /* JSON для клиентов, читающих только стандартное текстовое содержимое. */
  content: Extract<CallToolResult['content'][number], { type: 'text' }>[];
  /* Те же данные без повторного JSON-декодирования на стороне клиента. */
  structuredContent: Record<string, unknown>;
  /* true обозначает ошибку запроса или обновления, а не отсутствие исследованных данных. */
  isError: boolean;
}
import type { CallToolResult } from '@modelcontextprotocol/server';
