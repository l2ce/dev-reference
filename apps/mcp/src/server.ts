import { readFileSync } from 'node:fs'
import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod'
import { DatabaseError, localeSchema, keySchema } from '@l2ce/database'
import {
  referenceProtocolsSchema,
  referenceKnowledgeSchema,
  referenceReadSchema,
  referenceCatalogSchema,
  protocolReferenceSchema
} from '@l2ce/core/reference'
import type { ReferenceReader } from '@l2ce/core/reference'
import { DatasetManager } from './dataset.js'
import { mcpMessages as messages } from './messages.js'
import type { ToolReply } from './server.types.js'

const { version } = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')))

/**
 * Сохраняет одинаковое содержание текстового и структурированного ответа MCP.
 */
function reply(value: object, isError = false): ToolReply {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: { ...value },
    isError
  }
}

/**
 * Выполняет чтение одним неизменяемым поколением и возвращает предметную диагностику при отказе.
 */
function query(manager: DatasetManager, read: (reader: ReferenceReader) => object): ToolReply {
  try {
    const reader = manager.reader()
    const status = manager.status()
    return reply({ ...read(reader), sourceHash: status.sourceHash })
  } catch (error) {
    return reply(
      {
        error: {
          code: error instanceof DatabaseError ? error.code : 'INVALID_QUERY',
          message: error instanceof Error ? error.message : messages.updateFailed
        },
        dataRevision: manager.status().dataRevision
      },
      true
    )
  }
}

/**
 * Регистрирует исключительно чтение; обновление кеша выполняется менеджером вне MCP-инструментов.
 */
export function createServer(manager: DatasetManager): McpServer {
  const server = new McpServer({ name: '@l2ce/dev-reference-mcp', version })
  const annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
  server.registerTool(
    'get_project_info',
    {
      description: messages.info,
      inputSchema: z.strictObject({}),
      annotations
    },
    async () => reply({ ...messages.project, version })
  )
  server.registerTool(
    'list_catalog',
    {
      description: messages.catalog,
      inputSchema: referenceCatalogSchema,
      annotations
    },
    async (input) => query(manager, (reader) => reader.catalog(input))
  )
  server.registerTool(
    'list_protocols',
    {
      description: messages.list,
      inputSchema: referenceProtocolsSchema,
      annotations
    },
    async (input) => query(manager, (reader) => reader.protocols(input))
  )
  server.registerTool(
    'get_catalog_record',
    {
      description:
        'Читает описание, источники и структурированные поля хроники, выпуска, регионального контекста, региона или страны.',
      inputSchema: z.strictObject({ key: keySchema, locale: localeSchema.optional() }),
      annotations
    },
    async (input) =>
      query(manager, (reader) => ({ revision: reader.revision, ...reader.catalogRecord(input.key, input.locale) }))
  )
  server.registerTool(
    'get_protocol',
    {
      description: messages.protocol,
      inputSchema: z.strictObject({
        protocol: protocolReferenceSchema,
        locale: localeSchema.optional()
      }),
      annotations
    },
    async (input) => query(manager, (reader) => reader.protocol(input.protocol, input.locale))
  )
  server.registerTool(
    'search_knowledge',
    {
      description: messages.search,
      inputSchema: referenceKnowledgeSchema,
      annotations
    },
    async (input) => query(manager, (reader) => reader.knowledge(input))
  )
  server.registerTool(
    'read_knowledge',
    {
      description: messages.read,
      inputSchema: referenceReadSchema,
      annotations
    },
    async (input) => query(manager, (reader) => reader.read(input))
  )
  server.registerTool(
    'get_dataset_status',
    {
      description: messages.status,
      inputSchema: z.strictObject({}),
      annotations
    },
    async () => reply(manager.status())
  )
  server.registerResource('dataset', 'protocols://dataset', { mimeType: 'application/json' }, async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(manager.status(), null, 2)
      }
    ]
  }))
  server.registerResource('project', 'protocols://project', { mimeType: 'application/json' }, async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({ ...messages.project, version }, null, 2)
      }
    ]
  }))
  return server
}
