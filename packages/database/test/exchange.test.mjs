import assert from 'node:assert/strict';
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';
import {
  exportDatabase,
  importDatabase,
  openDatabase,
  snapshotRevision,
} from '../dist/index.js';
import {
  fixture,
  sourceDirectory,
  tableDirectory,
  articleEntry,
  articleImplementation,
  fixtureSnapshot,
  fixturePath,
} from './helpers.mjs';

/**
 * Читает точные байты всех файлов для сравнения стабильных экспортов.
 */
async function directoryContents(root) {
  const files = await readdir(root, { recursive: true, withFileTypes: true });
  const result = {};
  for (const file of files.filter((entry) => entry.isFile())) {
    const path = join(file.parentPath, file.name);
    result[relative(root, path)] = await readFile(path, 'utf8');
  }
  return result;
}

test('JSON → SQLite → JSON сохраняет исходное содержимое и даёт стабильный экспорт', async (t) => {
  const { directory, path, database } = await fixture(t);
  const output = join(directory, 'export');
  const events = [];
  const result = await exportDatabase({
    database: path,
    output,
    onProgress: (event) => events.push(event),
  });
  assert.equal(result.records, fixtureSnapshot.entries.length);
  assert.equal(
    result.entities,
    fixtureSnapshot.entries.filter((entry) => entry.kind === 'entity').length,
  );
  const source = await directoryContents(tableDirectory);
  const exported = await directoryContents(output);
  assert.deepEqual(Object.keys(exported).sort(), Object.keys(source).sort());
  for (const file of Object.keys(source)) {
    assert.deepEqual(
      JSON.parse(exported[file]),
      JSON.parse(source[file]),
      file,
    );
  }
  await exportDatabase({ database: path, output });
  assert.deepEqual(await directoryContents(output), exported);
  const second = join(directory, 'second.sqlite');
  await importDatabase({ database: second, input: output });
  const restored = openDatabase({ database: second });
  t.after(() => restored.close());
  assert.equal(
    snapshotRevision(restored.snapshot()),
    snapshotRevision(database.snapshot()),
  );
  assert.equal(events[0].percent, 0);
  assert.equal(events.at(-1).percent, 100);
  assert.equal(
    events.filter(
      (event) => event.phase === 'write' && event.event === 'record-complete',
    ).length,
    result.rows,
  );
  assert.ok(
    events.every(
      (event, index) =>
        index === 0 || event.percent >= events[index - 1].percent,
    ),
  );
  assert.ok(
    events.every((event) => event.percent < 100 || event.phase === 'complete'),
  );
});

test('импорт заменяет снимок, сохраняет Markdown/null/массивы и сообщает прогресс по адресам', async (t) => {
  const { directory, path, database } = await fixture(t);
  const output = join(directory, 'export');
  const entry = articleEntry();
  const revision = articleImplementation(entry);
  revision.value.translations[0].description = [
    '  Отступ и два пробела  ',
    '',
    '\\{{literal}}',
    '',
    '```text',
    '{{literal}}',
    '```',
  ].join('\n');
  database.applyChanges([
    { op: 'create', entry },
    { op: 'create', entry: revision },
  ]);
  await exportDatabase({ database: path, output });
  database.create(articleEntry('removed-by-import'));
  const events = [];
  await importDatabase({
    database: path,
    input: output,
    onProgress: (event) => events.push(event),
  });
  assert.equal(
    database.get({
      collection: 'articles',
      key: 'article:removed-by-import',
    }),
    undefined,
  );
  assert.deepEqual(
    database.get({ collection: 'articles', key: entry.key }),
    entry.value,
  );
  assert.equal(
    database.getRevision({ collection: 'article-revisions', key: revision.key })
      .translations[0].description,
    revision.value.translations[0].description,
  );
  assert.equal(events[0].percent, 0);
  assert.equal(events.at(-1).percent, 100);
  assert.ok(
    events.some(
      (event) =>
        event.record?.path === `articles/${entry.value.id}.json` &&
        event.phase === 'write',
    ),
  );
});

test('невалидный JSON, битые ссылки и ошибка посреди записи не меняют прежнюю базу', async (t) => {
  const { directory, path, database } = await fixture(t);
  const input = join(directory, 'input');
  await cp(sourceDirectory, input, { recursive: true });
  const before = snapshotRevision(database.snapshot());
  const bad = join(input, fixturePath('packet:key-packet:rev-1'));
  const original = await readFile(bad, 'utf8');
  const events = [];
  await writeFile(bad, '{broken');
  await assert.rejects(
    importDatabase({
      database: path,
      input,
      onProgress: (event) => events.push(event),
    }),
    { code: 'INVALID_JSON' },
  );
  assert.equal(snapshotRevision(database.snapshot()), before);
  assert.ok(events.every((event) => event.percent < 100));
  const value = JSON.parse(original);
  value.translations[0].source = [{ key: 'incomplete-source' }];
  await writeFile(bad, JSON.stringify(value));
  await assert.rejects(importDatabase({ database: path, input }), {
    code: 'INVALID_JSON',
  });
  await writeFile(bad, original);
  await assert.rejects(
    importDatabase({
      database: path,
      input,
      onProgress: (event) => {
        if (
          event.event === 'record-complete' &&
          event.phase === 'write' &&
          event.completed === 5
        ) {
          throw new Error('Сбой импорта');
        }
      },
    }),
    /Сбой импорта/,
  );
  assert.equal(snapshotRevision(database.snapshot()), before);
});

test('ошибка staging сохраняет предыдущий экспорт; успешная замена убирает устаревшие файлы', async (t) => {
  const { directory, path, database } = await fixture(t);
  const output = join(directory, 'output');
  const entry = articleEntry();
  database.create(entry);
  await exportDatabase({ database: path, output });
  const previous = await directoryContents(output);
  database.delete({
    collection: 'articles',
    key: 'article:test-article',
    kind: 'entity',
  });
  await assert.rejects(
    exportDatabase({
      database: path,
      output,
      onProgress: (event) => {
        if (
          event.event === 'record-complete' &&
          event.phase === 'write' &&
          event.completed === 5
        ) {
          throw new Error('Сбой экспорта');
        }
      },
    }),
    /Сбой экспорта/,
  );
  assert.deepEqual(await directoryContents(output), previous);
  await exportDatabase({ database: path, output });
  assert.equal(
    (await directoryContents(output))[`articles/${entry.value.id}.json`],
    undefined,
  );
  assert.ok(
    (await readdir(directory)).every(
      (name) =>
        !name.includes('.export-') &&
        !name.includes('.backup-') &&
        !name.endsWith('.lock'),
    ),
  );
});

test('экспорт не заменяет произвольный каталог или каталог с рабочим SQLite-файлом', async (t) => {
  const { directory, path } = await fixture(t);
  const output = join(directory, 'unmanaged');
  await mkdir(output);
  await writeFile(join(output, 'important.txt'), 'пользовательский файл');
  await assert.rejects(exportDatabase({ database: path, output }));
  assert.equal(
    await readFile(join(output, 'important.txt'), 'utf8'),
    'пользовательский файл',
  );
  await assert.rejects(exportDatabase({ database: path, output: directory }), {
    code: 'INVALID_DESTINATION',
  });
});

test('экспорт читает единый снимок, даже если база изменяется во время записи JSON', async (t) => {
  const { directory, path, database } = await fixture(t);
  const output = join(directory, 'snapshot-output');
  const before = snapshotRevision(database.snapshot());
  await exportDatabase({
    database: path,
    output,
    onProgress: (event) => {
      if (
        event.event === 'record-complete' &&
        event.phase === 'write' &&
        event.completed === 1
      ) {
        database.create(articleEntry('concurrent-change'));
      }
    },
  });
  const second = join(directory, 'snapshot.sqlite');
  await importDatabase({ database: second, input: output });
  const restored = openDatabase({ database: second });
  t.after(() => restored.close());
  assert.equal(snapshotRevision(restored.snapshot()), before);
  assert.notEqual(snapshotRevision(database.snapshot()), before);
});

test('одновременные экспорты в одно назначение используют эксклюзивную блокировку', async (t) => {
  const { directory, path } = await fixture(t);
  const output = join(directory, 'shared-output');
  const results = await Promise.allSettled([
    exportDatabase({ database: path, output }),
    exportDatabase({ database: path, output }),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    results.find((result) => result.status === 'rejected').reason.code,
    'EXPORT_BUSY',
  );
  const contents = await directoryContents(output);
  const manifest = JSON.parse(contents['manifest.json']);
  assert.equal(
    Object.keys(contents).length,
    1 + manifest.tables.reduce((total, table) => total + table.rows, 0),
  );
});

test('имя документного файла соответствует UUID; переименование не меняет идентичность', async (t) => {
  const { directory, path, database } = await fixture(t);
  const input = join(directory, 'mismatched-name');
  await cp(sourceDirectory, input, { recursive: true });
  const before = snapshotRevision(database.snapshot());
  const original = join(input, fixturePath('packet:key-packet:rev-1'));
  const renamedAddress =
    'packet-revisions/ffffffff-ffff-4fff-8fff-ffffffffffff.json';
  const renamed = join(input, renamedAddress);
  await rename(original, renamed);
  await assert.rejects(
    importDatabase({ database: path, input }),
    (error) =>
      error.code === 'INVALID_JSON' && error.details.path === renamedAddress,
  );
  assert.equal(snapshotRevision(database.snapshot()), before);
  const value = JSON.parse(await readFile(renamed, 'utf8'));
  value.id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  await writeFile(renamed, JSON.stringify(value));
  await importDatabase({ database: path, input });
  assert.equal(
    database.getImplementation({
      collection: 'packet-revisions',
      key: 'packet:key-packet:rev-1',
    }).id,
    value.id,
  );
});
