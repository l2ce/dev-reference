import { lstat, readdir, readFile } from 'node:fs/promises';
import { DatabaseError } from '../errors.js';
import { exchangeMessages as messages } from './messages.js';

/**
 * Читает обычный JSON-файл; симлинки и повреждение JSON получают точный путь диагностики.
 */
export async function readJson(path: string): Promise<unknown> {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(messages.invalidTree);
    }
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new DatabaseError(
      'INVALID_JSON',
      messages.invalidFile,
      { path },
      error,
    );
  }
}

/**
 * Перечисляет реальный каталог в стабильном порядке, отклоняя симлинки.
 */
export async function children(path: string): Promise<string[]> {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new DatabaseError('INVALID_DIRECTORY', messages.invalidTree, {
      path,
    });
  }
  return (await readdir(path)).sort();
}
