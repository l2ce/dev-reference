import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { exportDatabase } from '@l2ce/database';
import { DatasetManager } from '../dist/dataset.js';
import {
  datasetFixture,
  initializeRepository,
  commit,
  git,
  eventually,
} from './helpers.mjs';

/**
 * Меняет только текст существующей записи, сохраняя число строк и имена файлов.
 */
function changeText(database, description) {
  const value = database.getRevision({
    collection: 'packet-revisions',
    key: 'packet:key-packet:rev-1',
  });
  const translations = structuredClone(value.translations);
  translations.find((text) => text.locale === 'ru').description = description;
  database.update({
    target: {
      collection: 'packet-revisions',
      key: value.key,
      kind: 'implementation',
    },
    patch: { translations },
  });
}

test(
  'Git tree hash запускает загрузку только изменившейся папки data; ошибки сохраняют активную базу',
  { timeout: 30_000 },
  async (t) => {
    const { database, repo, dataDir, cacheDir, directory } =
      await datasetFixture(t);
    await initializeRepository(repo);
    const options = {
      repository: pathToFileURL(repo).href,
      cacheDir,
      pollIntervalMs: 60_000,
    };
    const manager = new DatasetManager(options);
    t.after(() => manager.close());
    await manager.initialize();
    const initial = manager.status();
    assert.equal(
      initial.sourceHash,
      git(repo, 'rev-parse', 'HEAD:packages/database/data'),
    );
    assert.equal(initial.dataRevision, database.revision());
    const old = manager.reader();
    const sourceCache = join(cacheDir, (await readdir(cacheDir))[0]);
    const checkout = join(
      sourceCache,
      (await readdir(sourceCache)).find((name) =>
        name.startsWith('repository-'),
      ),
    );
    const checkoutCommit = git(checkout, 'rev-parse', 'HEAD');
    await writeFile(join(repo, 'README.md'), 'Documentation changed\n');
    commit(repo, 'Documentation only');
    await manager.checkForUpdates();
    assert.equal(manager.status().sourceHash, initial.sourceHash);
    assert.equal(manager.status().dataRevision, initial.dataRevision);
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), checkoutCommit);

    changeText(database, '# Новая документация\n');
    await exportDatabase({ database: database.path, output: dataDir });
    commit(repo, 'Knowledge changed');
    const pending = manager.checkForUpdates();
    assert.equal(manager.checkForUpdates(), pending);
    await pending;
    assert.notEqual(manager.status().sourceHash, initial.sourceHash);
    assert.equal(manager.status().dataRevision, database.revision());
    const request = {
      protocol: '273',
      locale: 'ru',
      keys: ['packet:key-packet'],
    };
    assert.equal(
      manager.reader().read(request).items[0].markdown,
      '# Новая документация\n',
    );
    assert.notEqual(
      old.read(request).items[0].markdown,
      '# Новая документация\n',
    );

    const successful = manager.status();
    await writeFile(join(dataDir, 'manifest.json'), '{broken');
    commit(repo, 'Invalid snapshot');
    await manager.checkForUpdates();
    assert.equal(manager.status().sourceHash, successful.sourceHash);
    assert.equal(manager.status().dataRevision, successful.dataRevision);
    assert.ok(manager.status().lastError);
    await manager.close();

    await rename(repo, join(directory, 'offline-repository'));
    const offline = new DatasetManager(options);
    t.after(() => offline.close());
    await offline.initialize();
    assert.equal(offline.status().dataRevision, successful.dataRevision);
    await offline.checkForUpdates();
    assert.ok(offline.status().lastError);
    assert.equal(
      offline.reader().read(request).items[0].markdown,
      '# Новая документация\n',
    );
  },
);

test(
  'локальный режим автоматически замечает правку содержимого и не повреждает данные при ошибке',
  { timeout: 15_000 },
  async (t) => {
    const { database, dataDir, cacheDir } = await datasetFixture(t);
    const manager = new DatasetManager({
      dataDir,
      cacheDir,
      pollIntervalMs: 100,
    });
    t.after(() => manager.close());
    await manager.initialize();
    const before = manager.status().sourceHash;
    changeText(database, 'Автоматическое обновление');
    await exportDatabase({ database: database.path, output: dataDir });
    await eventually(
      () => manager.status().dataRevision === database.revision(),
    );
    assert.notEqual(manager.status().sourceHash, before);
    const good = manager.status();
    const manifestPath = join(dataDir, 'manifest.json');
    const manifest = await readFile(manifestPath, 'utf8');
    await writeFile(manifestPath, '{}');
    await eventually(() => manager.status().lastError !== null);
    assert.equal(manager.status().dataRevision, good.dataRevision);
    await writeFile(manifestPath, manifest);
    await eventually(() => manager.status().lastError === null);
  },
);

test('без пригодного кеша повреждённый источник не запускает чтение; кеш внутри источника запрещён', async (t) => {
  const { dataDir, cacheDir } = await datasetFixture(t);
  assert.throws(() => new DatasetManager({ dataDir, cacheDir: dataDir }));
  await writeFile(join(dataDir, 'manifest.json'), '{}');
  const manager = new DatasetManager({ dataDir, cacheDir });
  t.after(() => manager.close());
  await assert.rejects(manager.initialize());
  assert.equal(manager.status().loaded, false);
  assert.throws(() => manager.reader());
});

test(
  'два экземпляра кеша используют независимые checkout и согласованные поколения',
  { timeout: 30_000 },
  async (t) => {
    const { repo, dataDir, cacheDir, database } = await datasetFixture(t);
    await initializeRepository(repo);
    const options = {
      repository: pathToFileURL(repo).href,
      cacheDir,
      pollIntervalMs: 60_000,
    };
    const first = new DatasetManager(options);
    const second = new DatasetManager(options);
    t.after(async () => {
      await first.close();
      await second.close();
    });
    await Promise.all([first.initialize(), second.initialize()]);
    const sourceCache = join(cacheDir, (await readdir(cacheDir))[0]);
    assert.equal(
      (await readdir(sourceCache)).filter((name) =>
        name.startsWith('repository-'),
      ).length,
      2,
    );
    changeText(database, 'Общее новое поколение');
    await exportDatabase({ database: database.path, output: dataDir });
    commit(repo, 'Concurrent update');
    await Promise.all([first.checkForUpdates(), second.checkForUpdates()]);
    assert.equal(first.status().lastError, null);
    assert.equal(second.status().lastError, null);
    assert.equal(first.status().dataRevision, database.revision());
    assert.equal(second.status().dataRevision, database.revision());
  },
);
