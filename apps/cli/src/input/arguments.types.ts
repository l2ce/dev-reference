import type * as z from 'zod';
import type { argumentSchema, groupSchema } from './schema.js';

/**
 * Проверенные аргументы предметной команды.
 */
export type CliArguments = z.infer<typeof argumentSchema>;
/**
 * Предметная группа CLI.
 */
export type ProductGroup = z.infer<typeof groupSchema>;
