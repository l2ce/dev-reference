import * as z from 'zod';
import {
  collectionSchema,
  entitySchemas,
  implementationCollectionSchema,
  keySchema,
  serverSchema,
} from '../model/schema.js';

const knowledgeCollections = [
  'packets',
  'scenarios',
  'articles',
  'packet-revisions',
  'scenario-revisions',
  'article-revisions',
];

/**
 * Проверяет область каждого SQL-фильтра; неподходящие коллекции не игнорируют переданные условия.
 * Регионы — справочные данные, отдельного регионального селектора нет.
 */
export const listQuerySchema = z
  .strictObject({
    collection: collectionSchema,
    search: z.string().optional(),
    branchKey: keySchema.regex(/^branch:[^:]+$/).optional(),
    ownerKey: keySchema.optional(),
    protocolKey: keySchema.regex(/^protocol:[^:]+$/).optional(),
    chronicleReleaseKey: keySchema.regex(/^chronicle:[^:]+:[^:]+$/).optional(),
    server: serverSchema.optional(),
    direction: entitySchemas.packets.shape.direction.optional(),
    limit: z.number().int().min(1).max(1000).default(50),
    offset: z.number().int().nonnegative().default(0),
  })
  .refine(
    (query) =>
      (!query.branchKey || query.collection === 'chronicles') &&
      (!query.ownerKey ||
        query.collection === 'chronicle-releases' ||
        implementationCollectionSchema.safeParse(query.collection).success) &&
      (!query.chronicleReleaseKey || query.collection === 'protocols') &&
      (!query.protocolKey ||
        knowledgeCollections.includes(query.collection) ||
        query.collection === 'chronicle-releases') &&
      (!query.server || knowledgeCollections.includes(query.collection)) &&
      (!query.direction ||
        ['packets', 'packet-revisions'].includes(query.collection)),
  );
