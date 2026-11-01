import * as z from 'zod';
import { localeSchema } from '@l2ce/database/model';

/**
 * Предметные виды знаний нового справочника.
 */
export const referenceKindSchema = z.enum(['packet', 'scenario', 'article']);
export const protocolReferenceSchema = z
  .string()
  .regex(/^(?:protocol:)?\d+(?:-rev-[1-9]\d*)?$/);
export const knowledgeReferenceSchema = z
  .string()
  .regex(/^(packet|scenario|article):[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const page = {
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
};
export const referenceProtocolsSchema = z.strictObject({
  locale: localeSchema.optional(),
  query: z.string().max(1000).optional(),
  number: z.number().int().nonnegative().optional(),
  branch: z.string().optional(),
  chronicle: z.string().optional(),
  release: z.string().optional(),
  ...page,
});
export const referenceKnowledgeSchema = z.strictObject({
  status: z.enum(['missing', 'partial', 'documented']).optional(),
  protocol: protocolReferenceSchema,
  locale: localeSchema.optional(),
  query: z.string().max(1000).optional(),
  kind: referenceKindSchema.optional(),
  server: z.enum(['login', 'game']).optional(),
  direction: z.enum(['client-to-server', 'server-to-client']).optional(),
  ...page,
});
export const referenceReadSchema = z.strictObject({
  protocol: protocolReferenceSchema,
  locale: localeSchema.optional(),
  keys: z.array(knowledgeReferenceSchema).min(1).max(50),
});
export const referenceCatalogSchema = z.strictObject({
  collection: z.enum(['branches', 'chronicles', 'chronicle-releases']),
  locale: localeSchema.optional(),
  query: z.string().max(1000).optional(),
  branch: z.string().optional(),
  chronicle: z.string().optional(),
  ...page,
});
