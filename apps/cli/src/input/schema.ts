import * as z from 'zod'
import { localeSchema } from '@l2ce/database'

/**
 * Предметные группы команд; releases обозначает самостоятельные выпуски хроник.
 */
export const groupSchema = z.enum([
  'branches',
  'sagas',
  'chronicles',
  'releases',
  'contexts',
  'regions',
  'countries',
  'protocols',
  'packets',
  'scenarios',
  'articles'
])
export const argumentSchema = z.strictObject({
  command: z.enum([
    'list',
    'get',
    'inspect',
    'revisions',
    'create',
    'update',
    'delete',
    'add-revision',
    'update-revision',
    'translate',
    'schema',
    'status',
    'init',
    'import',
    'export',
    'validate',
    'batch',
    'search',
    'read'
  ]),
  group: groupSchema.optional(),
  operands: z.array(z.string()).default([]),
  database: z.string().optional(),
  locale: localeSchema.optional(),
  json: z.boolean().default(false),
  pretty: z.boolean().default(false),
  file: z.string().optional(),
  markdown: z.string().optional(),
  input: z.string().optional(),
  output: z.string().optional(),
  protocol: z.string().optional(),
  protocols: z.string().optional(),
  branch: z.string().optional(),
  saga: z.string().optional(),
  chronicle: z.string().optional(),
  release: z.string().optional(),
  region: z.string().optional(),
  query: z.string().optional(),
  number: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
  rev: z.number().int().positive().optional(),
  server: z.enum(['login', 'game']).optional(),
  direction: z.enum(['client-to-server', 'server-to-client']).optional(),
  kind: z.enum(['packet', 'scenario', 'article']).optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  status: z.enum(['missing', 'partial', 'documented']).optional(),
  ifRevision: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  dryRun: z.boolean().default(false)
})
