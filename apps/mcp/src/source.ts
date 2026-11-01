import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, lstat, readdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { mcpMessages as messages } from './messages.js';
import type { DatasetSource, SourceVersion } from './dataset.types.js';

/**
 * Асинхронный запуск отдельного процесса без shell.
 */
const execute = promisify(execFile);

/**
 * Исполняет Git без shell, с ограничением времени и отключённым запросом учётных данных в stdin.
 */
async function git(args: readonly string[], cwd?: string): Promise<string> {
  try {
    const result = await execute('git', [...args], {
      cwd,
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return result.stdout.trim();
  } catch (error) {
    throw new Error(messages.gitFailed, { cause: error });
  }
}

/**
 * Проверяет существование принадлежащего MCP Git-кеша без подавления ошибок доступа.
 */
async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Источник Git загружает blobs каталога только после изменения tree hash.
 */
export class GitDatasetSource implements DatasetSource {
  /* Режим источника, отображаемый в статусе MCP. */
  readonly origin = 'repository';
  /* Репозиторий-источник, заданный конфигурацией процесса. */
  private readonly repository: string;
  /* Приватный sparse checkout, не пользовательский worktree. */
  private readonly checkout: string;
  /* Относительная папка data. */
  private readonly dataPath: string;
  /* Удалённая ссылка для предварительной проверки. */
  private readonly ref: string;

  /**
   * Фиксирует источник; пути проверены конфигурацией менеджера.
   */
  constructor(
    repository: string,
    checkout: string,
    dataPath: string,
    branch?: string,
  ) {
    this.repository = repository;
    this.checkout = checkout;
    this.dataPath = dataPath;
    this.ref = branch ? `refs/heads/${branch}` : 'HEAD';
  }

  /**
   * Проверяет коммит и дерево каталога, не выполняя checkout при неизменных данных.
   */
  async check(previous?: SourceVersion): Promise<SourceVersion> {
    const remote = await git([
      'ls-remote',
      '--exit-code',
      '--',
      this.repository,
      this.ref,
    ]);
    const commit = remote.split(/\s+/)[0];
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) {
      throw new Error(messages.invalidGitHash);
    }
    if (previous?.commit === commit) {
      return previous;
    }
    if (!(await exists(join(this.checkout, '.git')))) {
      await mkdir(resolve(this.checkout, '..'), { recursive: true });
      await git([
        'clone',
        '--filter=blob:none',
        '--no-checkout',
        '--depth=1',
        '--',
        this.repository,
        this.checkout,
      ]);
    }
    await git(
      ['fetch', '--depth=1', '--filter=blob:none', 'origin', commit],
      this.checkout,
    );
    const hash = await git(
      ['rev-parse', `${commit}:${this.dataPath}`],
      this.checkout,
    );
    if (
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(hash) ||
      (await git(['cat-file', '-t', hash], this.checkout)) !== 'tree'
    ) {
      throw new Error(messages.invalidGitHash);
    }
    return { hash, commit };
  }

  /**
   * Материализует только выбранную папку из закреплённого коммита.
   */
  async download(version: SourceVersion): Promise<string> {
    if (!version.commit) {
      throw new Error(messages.invalidGitHash);
    }
    await git(
      ['sparse-checkout', 'set', '--no-cone', `/${this.dataPath}/`],
      this.checkout,
    );
    await git(
      ['checkout', '--force', '--detach', version.commit],
      this.checkout,
    );
    return join(this.checkout, this.dataPath);
  }

  /**
   * Удаляет только приватный checkout этого экземпляра, не затрагивая поколения SQLite.
   */
  async close(): Promise<void> {
    await rm(this.checkout, { recursive: true, force: true });
  }
}

/**
 * Хеширует обычные файлы каталога в стабильном порядке; симлинки не принимаются.
 */
async function directoryHash(directory: string): Promise<string> {
  const hash = createHash('sha256');
  /**
   * Добавляет путь и точные байты каждого файла; вложенные папки обходятся рекурсивно.
   */
  async function visit(relative: string): Promise<void> {
    const path = join(directory, relative);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      throw new Error(messages.invalidSource);
    }
    if (stat.isDirectory()) {
      for (const name of (await readdir(path)).sort()) {
        await visit(relative ? `${relative}/${name}` : name);
      }
    } else if (stat.isFile()) {
      const data = await readFile(path);
      hash.update(JSON.stringify([relative, data.length])).update(data);
    } else {
      throw new Error(messages.invalidSource);
    }
  }
  await visit('');
  return hash.digest('hex');
}

/**
 * Локальная папка экспорта для разработки и автономного запуска.
 */
export class DirectoryDatasetSource implements DatasetSource {
  /* Режим источника, отображаемый в статусе MCP. */
  readonly origin = 'directory';
  /* Абсолютный путь локального снимка. */
  private readonly directory: string;
  /**
   * Фиксирует локальный источник.
   */
  constructor(directory: string) {
    this.directory = resolve(directory);
  }
  /**
   * Учитывает изменение содержимого, даже если имена и число строк остались прежними.
   */
  async check(): Promise<SourceVersion> {
    return { hash: await directoryHash(this.directory), commit: null };
  }
  /**
   * Возвращает папку для последующего проверенного импорта.
   */
  async download(_version: SourceVersion): Promise<string> {
    return this.directory;
  }
}
