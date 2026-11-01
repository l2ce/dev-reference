import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDatabase, exportDatabase } from '@l2ce/database';
import { sharedFixture } from '../../../packages/database/test/fixtures/shared.mjs';

/**
 * Создаёт независимую базу и её табличный экспорт для синхронизации MCP.
 */
export async function datasetFixture(t) {
  const directory = await mkdtemp('/tmp/opencode/l2ce-mcp-test-');
  const database = openDatabase({ database: join(directory, 'source.sqlite') });
  database.replaceSnapshot(sharedFixture());
  const repo = join(directory, 'repository');
  const dataDir = join(repo, 'packages/database/data');
  await exportDatabase({ database: database.path, output: dataDir });
  t.after(async () => {
    database.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    directory,
    database,
    repo,
    dataDir,
    cacheDir: join(directory, 'cache'),
  };
}

/**
 * Выполняет Git только в изолированном тестовом репозитории.
 */
export function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Создаёт тестовый коммит без изменения настроек или истории основного репозитория.
 */
export function commit(repo, message) {
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', message);
}

/**
 * Инициализирует источник Git для проверки настоящего sparse checkout.
 */
export async function initializeRepository(repo) {
  git(repo, 'init');
  git(repo, 'config', 'user.name', 'MCP test');
  git(repo, 'config', 'user.email', 'mcp-test@example.invalid');
  await writeFile(join(repo, 'README.md'), 'Repository fixture\n');
  commit(repo, 'Initial data');
}

/**
 * Ожидает наблюдаемого результата фонового таймера с ограничением времени теста.
 */
export async function eventually(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Background refresh timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
