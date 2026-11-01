import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Корень пакета одинаково разрешается из src и dist, независимо от cwd потребителя.
 */
export const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
export const defaultDatabasePath = join(
  packageDirectory,
  '.local/database.sqlite',
);
export const defaultDataDirectory = join(packageDirectory, 'data');
