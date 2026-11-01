import * as z from 'zod'
import { sourceSchema } from '@l2ce/database/source'
export { sourceSchema } from '@l2ce/database/source'
export type { Source } from '@l2ce/database/source'
import { localeSchema, versionSchema, protocolIdSchema } from './schema.js'

export const knowledgeIdSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)
const text = z.string().trim().min(1)
const sourceIdsSchema = z.array(sourceSchema.shape.id)
export const descriptionSchema = z.array(
  z.string().regex(/^(?![\s\S]*[\r\n])/, 'Each description item must contain exactly one line')
)
export const contentSchema = z.strictObject({
  title: text,
  summary: text,
  description: descriptionSchema
})
const recordShape = { id: knowledgeIdSchema, ...contentSchema.shape }
export const serverSchema = z.enum(['login', 'game'])
export const entityKindSchema = z.enum(['packet', 'scenario', 'article'])
export const researchStatusSchema = z.enum(['missing', 'partial', 'documented'])
export const directionSchema = z.enum(['client-to-server', 'server-to-client'])

export const knowledgeMetadataSchema = z.strictObject({
  schemaVersion: z.literal(7),
  dataVersion: versionSchema,
  defaultLocale: localeSchema,
  locales: z.array(localeSchema).min(1)
})

export const knowledgeProfileSchema = z.strictObject({
  ...contentSchema.shape,
  id: protocolIdSchema,
  number: z.number().int().nonnegative(),
  variant: z
    .string()
    .regex(/^[a-z]+$/)
    .nullable(),
  chronicle: knowledgeIdSchema,
  stage: knowledgeIdSchema.nullable(),
  family: text,
  region: text.nullable(),
  loginRevisions: z.array(z.number().int().nonnegative()),
  sourceIds: sourceIdsSchema
})

export const chronicleSchema = z.strictObject({
  ...recordShape,
  stages: z.array(z.strictObject(recordShape)),
  sourceIds: sourceIdsSchema
})

export function protocolRecordId(profile: { number: number; variant: string | null }): string {
  return `${profile.number}${profile.variant === null ? '' : `-${profile.variant}`}`
}

export const entityReferenceSchema = z.strictObject({
  kind: entityKindSchema,
  id: knowledgeIdSchema,
  server: serverSchema.optional()
})

export const opcodeSchema = z
  .array(
    z.strictObject({
      type: z.enum(['u8', 'u16le', 'u32le']),
      value: z.string().regex(/^0x[0-9A-Fa-f]+$/)
    })
  )
  .min(1)
  .max(8)
  .nullable()

const bindingShape = {
  protocolIds: z.array(protocolIdSchema).min(1),
  documentVersionId: knowledgeIdSchema,
  status: researchStatusSchema,
  sourceIds: sourceIdsSchema
}
export const bindingSchema = z.strictObject(bindingShape)
export const packetBindingSchema = z.strictObject({
  ...bindingShape,
  opcode: opcodeSchema,
  states: z.array(text).default([])
})

const entityShape = {
  ...recordShape,
  order: z.number().int().default(0),
  parentId: knowledgeIdSchema.nullable().default(null)
}
export const packetSchema = z.strictObject({
  ...entityShape,
  kind: z.literal('packet'),
  name: text,
  server: serverSchema,
  direction: directionSchema,
  bindings: z.array(packetBindingSchema)
})
export const scenarioSchema = z.strictObject({
  ...entityShape,
  kind: z.literal('scenario'),
  servers: z.array(serverSchema).min(1),
  bindings: z.array(bindingSchema)
})
export const articleSchema = z.strictObject({
  ...entityShape,
  kind: z.literal('article'),
  servers: z.array(serverSchema).min(1),
  scope: z.enum(['protocol', 'general']),
  bindings: z.array(bindingSchema),
  documentVersionId: knowledgeIdSchema.nullable().default(null)
})
export const entitySchema = z.discriminatedUnion('kind', [packetSchema, scenarioSchema, articleSchema])

export const documentVersionSchema = z.strictObject({
  ...recordShape,
  entity: z.strictObject({ kind: entityKindSchema, id: knowledgeIdSchema }),
  status: researchStatusSchema,
  sourceIds: sourceIdsSchema,
  previousVersionId: knowledgeIdSchema.nullable().default(null),
  requires: z.array(entityReferenceSchema).default([]),
  changes: z.array(text).default([]),
  openQuestions: z.array(text).default([])
})

export const entityTranslationSchema = z.strictObject({
  ...contentSchema.shape,
  kind: z.enum(['protocol', 'chronicle', 'packet', 'scenario', 'article']),
  id: z.union([knowledgeIdSchema, protocolIdSchema])
})
export const documentTranslationSchema = z.strictObject({
  ...recordShape,
  changes: z.array(text).default([]),
  openQuestions: z.array(text).default([])
})
export const knowledgeLocaleSchema = z.strictObject({
  ...contentSchema.shape,
  locale: localeSchema
})
export const knowledgeTranslationSchema = knowledgeLocaleSchema.extend({
  entities: z.array(entityTranslationSchema),
  documents: z.array(documentTranslationSchema)
})
export const knowledgeSnapshotSchema = knowledgeMetadataSchema.extend({
  sources: z.array(sourceSchema),
  chronicles: z.array(chronicleSchema),
  protocols: z.array(knowledgeProfileSchema),
  entities: z.array(entitySchema),
  documents: z.array(documentVersionSchema),
  translations: z.array(knowledgeTranslationSchema)
})

export type KnowledgeSnapshot = z.infer<typeof knowledgeSnapshotSchema>
export type KnowledgeProfile = z.infer<typeof knowledgeProfileSchema>
export type KnowledgeEntity = z.infer<typeof entitySchema>
export type DocumentVersion = z.infer<typeof documentVersionSchema>
export type DocumentTranslation = z.infer<typeof documentTranslationSchema>
export type EntityReference = z.infer<typeof entityReferenceSchema>
export type EntityKind = z.infer<typeof entityKindSchema>
export type Server = z.infer<typeof serverSchema>
export type Direction = z.infer<typeof directionSchema>
export type Opcode = z.infer<typeof opcodeSchema>
export type ResearchStatus = z.infer<typeof researchStatusSchema>
export type RecordContent = z.infer<typeof contentSchema>

export function entityKey(entity: { kind: string; id: string }): string {
  return `${entity.kind}:${entity.id}`
}

export function entityServers(entity: KnowledgeEntity): Server[] {
  return entity.kind === 'packet' ? [entity.server] : entity.servers
}
