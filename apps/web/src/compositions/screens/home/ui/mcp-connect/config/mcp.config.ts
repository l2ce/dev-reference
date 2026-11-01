/**
 * Конфигурация stdio из apps/mcp/README.md для клиентов с форматом mcpServers.
 */
export const MCP_CONFIGURATION = `{
  "mcpServers": {
    "l2ce": {
      "command": "npx",
      "args": ["--yes", "@l2ce/dev-reference-mcp"]
    }
  }
}`

/**
 * Руководство запуска и настройки MCP справочника.
 */
export const MCP_GUIDE_URL = 'https://github.com/l2ce/dev-reference/blob/main/apps/mcp/README.md#запуск'
