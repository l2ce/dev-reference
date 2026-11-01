import type * as z from 'zod'
import type { operationsSchema } from './operation-schema.js'

/**
 * Проверенная оболочка операции до разбора содержимого конкретной коллекции.
 */
export type InputOperation = z.infer<typeof operationsSchema>[number]
