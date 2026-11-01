import * as z from 'zod'
import { addressSchema, entryEnvelopeSchema } from '../model/schema.js'

/**
 * Внешняя оболочка пакета; содержимое create/put/update проверяется схемой коллекции.
 */
export const operationsSchema = z.array(
  z.discriminatedUnion('op', [
    z.strictObject({
      op: z.enum(['create', 'put']),
      entry: entryEnvelopeSchema
    }),
    z.strictObject({ op: z.literal('delete'), target: addressSchema }),
    z.strictObject({
      op: z.literal('update'),
      target: addressSchema,
      patch: z.record(z.string(), z.unknown())
    })
  ])
)
export const writeOptionsSchema = z.strictObject({
  dryRun: z.boolean().optional(),
  ifRevision: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional()
})
