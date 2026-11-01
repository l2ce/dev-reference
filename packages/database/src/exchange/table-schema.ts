import * as z from 'zod';

/**
 * Безопасное физическое имя каталога/колонки; список имён берётся из SQLite.
 */
export const tableNameSchema = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/);

/**
 * Значение SQLite без потери больших INTEGER и BLOB при JSON-сериализации.
 */
export const tableCellSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.strictObject({ $integer: z.string().regex(/^-?(0|[1-9][0-9]*)$/) }),
  z.strictObject({ $blob: z.base64() }),
]);

/**
 * Строка использует физические имена колонок и сохраняет TEXT, включая source_json, буквально.
 */
export const tableRowSchema = z.record(tableNameSchema, tableCellSchema);

/**
 * Метаданные таблицы достаточны для проверки файлов и сопоставления с текущей SQL-схемой.
 */
export const tableDefinitionSchema = z
  .strictObject({
    name: tableNameSchema,
    columns: z.array(tableNameSchema).min(1),
    primaryKey: z.array(tableNameSchema).min(1),
    rows: z.number().int().nonnegative(),
  })
  .refine(
    (table) =>
      new Set(table.columns).size === table.columns.length &&
      new Set(table.primaryKey).size === table.primaryKey.length &&
      table.primaryKey.every((key) => table.columns.includes(key)),
  );

/**
 * Версия файловой раскладки независима от предметного schema_rev в таблице metadata.
 */
export const tableManifestSchema = z
  .strictObject({
    format: z.literal('sqlite-tables'),
    formatVersion: z.literal(1),
    tables: z.array(tableDefinitionSchema).min(1),
  })
  .refine(
    (manifest) =>
      new Set(manifest.tables.map((table) => table.name)).size ===
      manifest.tables.length,
  );
