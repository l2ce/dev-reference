import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import * as z from 'zod';
import { importDatabase, openDatabase, validateSnapshot } from '@l2ce/database';
import { ReferenceReader } from '@l2ce/core/reference';
import { GitDatasetSource, DirectoryDatasetSource } from './source.js';
import { mcpMessages as messages } from './messages.js';
import type {
  ActiveDataset,
  DatasetOptions,
  DatasetSource,
  DatasetStatus,
  SourceVersion,
} from './dataset.types.js';

const stateSchema = z.strictObject({
  hash: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  commit: z
    .string()
    .regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
    .nullable(),
  file: z.string().regex(/^database-[a-f0-9-]+\.sqlite$/),
});

const MAX_POLL_INTERVAL_MS = 2_147_483_647;

/**
 * Владеет кешем MCP: обновляет только локальную копию, а запросам выдаёт read-only поколение.
 */
export class DatasetManager {
  /* Источник данных без инструментов предметной записи. */
  private readonly source: DatasetSource;
  /* Изолированный по настройкам каталог кеша. */
  private readonly directory: string;
  /* Интервал автоматической проверки. */
  private readonly intervalMs: number;
  /* Последнее полностью проверенное поколение. */
  private active?: ActiveDataset;
  /* Версия источника, соответствующая активной базе. */
  private version?: SourceVersion;
  /* Единая выполняющаяся синхронизация для всех инициаторов. */
  private pending?: Promise<DatasetStatus>;
  /* Фоновый таймер; не удерживает процесс самостоятельно. */
  private timer?: ReturnType<typeof setInterval>;
  /* Момент последней проверки. */
  private checkedAt: string | null = null;
  /* Ошибка последней проверки или импорта. */
  private lastError: string | null = null;
  /* Запрещает переключение после начала закрытия. */
  private closing = false;

  /**
   * Нормализует конфигурацию, не открывая сеть или SQLite до initialize().
   */
  constructor(options: DatasetOptions = {}) {
    const repository =
      options.repository ?? 'https://github.com/l2ce/dev-reference.git';
    const dataPath = options.dataPath ?? 'packages/database/data';
    if (
      (options.dataDir !== undefined && !options.dataDir.trim()) ||
      (options.cacheDir !== undefined && !options.cacheDir.trim())
    ) {
      throw new Error(messages.invalidSource);
    }
    if (
      !repository ||
      repository.startsWith('-') ||
      !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(dataPath) ||
      dataPath.split('/').some((part) => part === '.' || part === '..')
    ) {
      throw new Error(messages.invalidSource);
    }
    if (
      options.branch &&
      (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(options.branch) ||
        options.branch.includes('..'))
    ) {
      throw new Error(messages.invalidSource);
    }
    this.intervalMs = z
      .number()
      .int()
      .min(100)
      .max(MAX_POLL_INTERVAL_MS)
      .parse(options.pollIntervalMs ?? 60_000);
    const sourceId = createHash('sha256')
      .update(
        JSON.stringify(
          options.dataDir
            ? ['directory', resolve(options.dataDir)]
            : ['repository', repository, options.branch ?? null, dataPath],
        ),
      )
      .digest('hex');
    const cache = resolve(
      options.cacheDir ??
        join(
          process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'),
          'l2ce-protocols',
        ),
    );
    if (options.dataDir) {
      const source = resolve(options.dataDir);
      const path = relative(source, cache);
      if (
        path === '' ||
        (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path))
      ) {
        throw new Error(messages.invalidSource);
      }
    }
    this.directory = join(cache, sourceId);
    this.source = options.dataDir
      ? new DirectoryDatasetSource(options.dataDir)
      : new GitDatasetSource(
          repository,
          join(this.directory, `repository-${randomUUID()}`),
          dataPath,
          options.branch,
        );
  }

  /**
   * Возвращает независимые метаданные без проверки сети и изменения базы.
   */
  status(): DatasetStatus {
    return {
      loaded: !!this.active,
      origin: this.source.origin,
      sourceHash: this.version?.hash ?? null,
      sourceCommit: this.version?.commit ?? null,
      dataRevision: this.active?.reader.revision ?? null,
      schemaVersion: this.active?.manifest.schemaVersion ?? null,
      locales: [...(this.active?.manifest.locales ?? [])],
      checkedAt: this.checkedAt,
      lastError: this.lastError,
      updating: !!this.pending,
    };
  }

  /**
   * Закрепляет неизменяемое основание одного запроса; обновление не меняет уже полученный reader.
   */
  reader(): ReferenceReader {
    if (!this.active || this.closing) {
      throw new Error(messages.notLoaded);
    }
    return this.active.reader;
  }

  /**
   * Открывает поколение только для чтения и проверяет предметное содержимое.
   */
  private openGeneration(file: string): ActiveDataset {
    const database = openDatabase({ database: file, readOnly: true });
    try {
      const snapshot = validateSnapshot(database.snapshot());
      const { entries: _entries, ...manifest } = snapshot;
      return {
        file,
        database,
        reader: new ReferenceReader(snapshot),
        manifest,
      };
    } catch (error) {
      database.close();
      throw error;
    }
  }

  /**
   * Восстанавливает последнее сохранённое поколение; ошибка кеша допускает загрузку источника.
   */
  async initialize(): Promise<DatasetStatus> {
    await mkdir(this.directory, { recursive: true });
    try {
      const state = stateSchema.parse(
        JSON.parse(await readFile(join(this.directory, 'active.json'), 'utf8')),
      );
      this.active = this.openGeneration(join(this.directory, state.file));
      this.version = { hash: state.hash, commit: state.commit };
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )) {
        this.lastError = messages.cacheFailed;
      }
    }
    if (this.active) {
      void this.checkForUpdates();
    } else {
      await this.checkForUpdates();
    }
    if (!this.active) {
      throw new Error(this.lastError ?? messages.notLoaded);
    }
    this.timer = setInterval(() => {
      void this.checkForUpdates();
    }, this.intervalMs);
    this.timer.unref();
    return this.status();
  }

  /**
   * Атомарно сохраняет указатель поколения; старый файл остаётся доступен при сбое записи.
   */
  private async saveState(version: SourceVersion, file: string): Promise<void> {
    const temporary = join(this.directory, `state-${randomUUID()}.json`);
    try {
      await writeFile(
        temporary,
        JSON.stringify({
          ...version,
          file: file.slice(this.directory.length + 1),
        }) + '\n',
        { flag: 'wx' },
      );
      await rename(temporary, join(this.directory, 'active.json'));
    } finally {
      await rm(temporary, { force: true });
    }
  }

  /**
   * Загружает и импортирует новое поколение отдельно; ошибка сохраняет прежний reader и SQLite.
   */
  private async update(): Promise<DatasetStatus> {
    this.checkedAt = new Date().toISOString();
    let candidate: string | undefined;
    let prepared: ActiveDataset | undefined;
    try {
      const version = await this.source.check(this.version);
      if (this.active && version.hash === this.version?.hash) {
        if (version.commit !== this.version.commit) {
          await this.saveState(version, this.active.file);
        }
        this.version = version;
        this.lastError = null;
        return this.status();
      }
      const source = await this.source.download(version);
      candidate = join(this.directory, `database-${randomUUID()}.sqlite`);
      await importDatabase({ database: candidate, input: source });
      if (
        this.source.origin === 'directory' &&
        (await this.source.check()).hash !== version.hash
      ) {
        throw new Error(messages.sourceChanged);
      }
      prepared = this.openGeneration(candidate);
      if (this.closing) {
        throw new Error(messages.closed);
      }
      await this.saveState(version, candidate);
      const old = this.active;
      this.active = prepared;
      prepared = undefined;
      candidate = undefined;
      this.version = version;
      this.lastError = null;
      old?.database.close();
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : messages.updateFailed;
    } finally {
      prepared?.database.close();
      if (candidate) {
        await rm(candidate, { force: true });
        await rm(`${candidate}-wal`, { force: true });
        await rm(`${candidate}-shm`, { force: true });
      }
    }
    return this.status();
  }

  /**
   * Объединяет одновременные проверки. Метод внутренний для процесса, не MCP-инструмент.
   */
  checkForUpdates(): Promise<DatasetStatus> {
    if (this.closing) {
      return Promise.resolve(this.status());
    }
    if (!this.pending) {
      this.pending = this.update()
        .catch((error: unknown) => {
          this.lastError =
            error instanceof Error ? error.message : messages.updateFailed;
          return this.status();
        })
        .finally(() => {
          this.pending = undefined;
        });
    }
    return this.pending;
  }

  /**
   * Прекращает таймер, дожидается текущей загрузки и закрывает read-only соединение.
   */
  async close(): Promise<void> {
    this.closing = true;
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.pending;
    this.active?.database.close();
    this.active = undefined;
    await this.source.close?.();
  }
}
