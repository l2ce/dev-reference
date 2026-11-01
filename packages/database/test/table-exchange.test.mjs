import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import Sqlite from 'better-sqlite3';
import {
  exportDatabase,
  importDatabase,
  openDatabase,
  snapshotRevision,
} from '../dist/index.js';
import { fixture } from './helpers.mjs';
import { progressFrame, compactProgress } from '../dist/cli/progress-view.js';

/**
 * Читает один JSON-файл табличного снимка.
 */
async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('каждая физическая строка экспортируется буквально; все таблицы и пустые папки входят в динамический план', async (t) => {
  const { directory, path } = await fixture(t);
  const sql = new Sqlite(path);
  t.after(() => sql.close());
  const tables = sql
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
    )
    .all()
    .map((row) => row.name);
  const output = join(directory, 'tables');
  const events = [];
  const result = await exportDatabase({
    database: path,
    output,
    onProgress: (event) => events.push(event),
  });
  const manifest = await json(join(output, 'manifest.json'));
  assert.equal(manifest.format, 'sqlite-tables');
  assert.deepEqual(
    manifest.tables.map((table) => table.name),
    tables,
  );
  let total = 0;
  for (const table of manifest.tables) {
    const files = await readdir(join(output, table.name));
    assert.equal(files.length, table.rows);
    const rows = await Promise.all(
      files.map((file) => json(join(output, table.name, file))),
    );
    const expected = sql.prepare(`SELECT * FROM "${table.name}"`).all();
    assert.deepEqual(
      rows.map((row) => JSON.stringify(row)).sort(),
      expected.map((row) => JSON.stringify(row)).sort(),
      table.name,
    );
    total += table.rows;
  }
  assert.equal(result.tables, tables.length);
  assert.equal(result.rows, total);
  const planned = events.find((event) => event.tables.length > 0);
  assert.equal(planned.completed, 0);
  assert.deepEqual(
    planned.tables.map((table) => table.table),
    tables,
  );
  assert.deepEqual(planned.collections, []);
  assert.deepEqual(planned.locales, []);
  assert.ok(
    events.every(
      (event) =>
        event.phase === 'complete' ||
        event.tables.every((table) => table.percent < 100),
    ),
  );
  assert.ok(events.at(-1).tables.every((table) => table.percent === 100));
  const frame = progressFrame(events.at(-1)).join('\n');
  assert.match(frame, /^packet_protocols \(\d+\):\s+\[#{28}\] 100%$/m);
  assert.doesNotMatch(frame, /English|Russian|packet-revisions/);
  assert.equal(
    events.filter(
      (event) => event.phase === 'write' && event.event === 'record-complete',
    ).length,
    total,
  );
  const active = events.find(
    (event) => event.phase === 'write' && event.event === 'record-start',
  );
  assert.ok(compactProgress(active).includes(`${active.record.table}:`));
});

test('новые таблицы обнаруживаются без реестра в коде, включая пустую таблицу и точные INTEGER/BLOB', async (t) => {
  const { directory, path } = await fixture(t);
  const sql = new Sqlite(path);
  t.after(() => sql.close());
  sql.exec(
    'CREATE TABLE dynamic_probe (id TEXT PRIMARY KEY, integer_value INTEGER, payload BLOB); CREATE TABLE empty_probe (id INTEGER PRIMARY KEY); CREATE TABLE composite_probe (a TEXT, b TEXT, note TEXT, PRIMARY KEY (a, b));',
  );
  sql
    .prepare('INSERT INTO dynamic_probe VALUES (?, ?, ?)')
    .run('probe', 9223372036854775807n, Buffer.from([0, 255]));
  const composite = sql.prepare('INSERT INTO composite_probe VALUES (?, ?, ?)');
  composite.run('a/b', 'c', 'first');
  composite.run('a', 'b/c', 'second');
  composite.run('../../outside', 'key', 'third');
  const events = [];
  const output = join(directory, 'dynamic');
  await exportDatabase({
    database: path,
    output,
    onProgress: (event) => events.push(event),
  });
  assert.deepEqual(await json(join(output, 'dynamic_probe/probe.json')), {
    id: 'probe',
    integer_value: { $integer: '9223372036854775807' },
    payload: { $blob: 'AP8=' },
  });
  assert.deepEqual(await readdir(join(output, 'empty_probe')), []);
  const final = events.at(-1);
  assert.equal(
    final.tables.find((table) => table.table === 'empty_probe').percent,
    100,
  );
  assert.equal(
    final.tables.find((table) => table.table === 'dynamic_probe').written,
    1,
  );
  const filenames = await readdir(join(output, 'composite_probe'));
  assert.equal(filenames.length, 3);
  assert.ok(filenames.every((file) => /^[a-f0-9]{8}\.json$/.test(file)));
  sql.exec("UPDATE composite_probe SET note = 'changed'");
  await exportDatabase({ database: path, output });
  assert.deepEqual(await readdir(join(output, 'composite_probe')), filenames);
  composite.run('new', 'entry', 'fourth');
  await exportDatabase({ database: path, output });
  const expanded = await readdir(join(output, 'composite_probe'));
  assert.equal(expanded.length, 4);
  assert.ok(filenames.every((file) => expanded.includes(file)));
  const target = join(directory, 'unsupported.sqlite');
  await assert.rejects(importDatabase({ database: target, input: output }), {
    code: 'SCHEMA_MISMATCH',
  });
  assert.equal(existsSync(target), false);
});

test('обратный импорт сохраняет SQL-строки и составные ключи; пустые каталоги могут отсутствовать после Git checkout', async (t) => {
  const { directory, path, database } = await fixture(t);
  const output = join(directory, 'round-trip');
  await exportDatabase({ database: path, output });
  const manifest = await json(join(output, 'manifest.json'));
  for (const table of manifest.tables.filter((table) => table.rows === 0)) {
    await rm(join(output, table.name), { recursive: true });
  }
  const target = join(directory, 'restored.sqlite');
  await importDatabase({ database: target, input: output });
  const restored = openDatabase({ database: target });
  t.after(() => restored.close());
  assert.equal(
    snapshotRevision(restored.snapshot()),
    snapshotRevision(database.snapshot()),
  );
  const second = join(directory, 'second');
  await exportDatabase({ database: target, output: second });
  assert.deepEqual(await json(join(second, 'manifest.json')), manifest);
  for (const table of manifest.tables) {
    if (!table.rows) continue;
    const files = await readdir(join(output, table.name));
    assert.deepEqual(await readdir(join(second, table.name)), files);
    for (const file of files) {
      assert.equal(
        await readFile(join(second, table.name, file), 'utf8'),
        await readFile(join(output, table.name, file), 'utf8'),
      );
    }
  }
});

test('неверные колонки, имена, FK и переводы отклоняются до открытия целевой базы', async (t) => {
  const { directory, path } = await fixture(t);
  const output = join(directory, 'invalid');
  await exportDatabase({ database: path, output });
  const target = join(directory, 'not-created.sqlite');
  const file = join(
    output,
    'packet_revisions',
    (await readdir(join(output, 'packet_revisions')))[0],
  );
  const original = await readFile(file, 'utf8');
  const row = JSON.parse(original);
  for (const patch of [
    { unexpected: true },
    { packet_id: '00000000-0000-4000-8000-000000000001' },
    { rev: 0 },
    { previous_revision_id: row.id },
  ]) {
    await writeFile(file, JSON.stringify({ ...row, ...patch }));
    await assert.rejects(
      importDatabase({ database: target, input: output }),
      (error) => error.details.path.endsWith(`packet_revisions/${row.id}.json`),
    );
    assert.equal(existsSync(target), false);
  }
  await writeFile(file, original);
  const idFile = join(
    output,
    'packet_revision_translations',
    (await readdir(join(output, 'packet_revision_translations')))[0],
  );
  const identity = await json(idFile);
  await writeFile(
    idFile,
    JSON.stringify({
      ...identity,
      sources_json: JSON.stringify([
        { id: 'invalid', url: 'https://example.org', title: 'Source' },
      ]),
    }),
  );
  await assert.rejects(importDatabase({ database: target, input: output }), {
    code: 'VALIDATION_ERROR',
  });
  assert.equal(existsSync(target), false);
});

test('ошибка наблюдателя нового импорта откатывает пересоздание устаревшей схемы', async (t) => {
  const { directory, path } = await fixture(t);
  const output = join(directory, 'new-format');
  await exportDatabase({ database: path, output });
  const target = join(directory, 'old-schema.sqlite');
  const sql = new Sqlite(target);
  t.after(() => sql.close());
  sql.exec(
    "CREATE TABLE old_data (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO old_data VALUES (1, 'keep');",
  );
  await assert.rejects(
    importDatabase({
      database: target,
      input: output,
      onProgress: (event) => {
        if (
          event.phase === 'write' &&
          event.event === 'record-complete' &&
          event.completed === 3
        ) {
          throw new Error('abort new import');
        }
      },
    }),
    /abort new import/,
  );
  assert.deepEqual(
    sql.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all(),
    [{ name: 'old_data' }],
  );
  assert.deepEqual(sql.prepare('SELECT * FROM old_data').all(), [
    { id: 1, value: 'keep' },
  ]);
});

test('сбой записи табличного импорта откатывает базу и не показывает ложные 100%', async (t) => {
  const { directory, path, database } = await fixture(t);
  const output = join(directory, 'rollback');
  await exportDatabase({ database: path, output });
  const before = snapshotRevision(database.snapshot());
  const sql = new Sqlite(path);
  t.after(() => sql.close());
  sql.exec(
    "CREATE TRIGGER fail_table BEFORE INSERT ON packets BEGIN SELECT RAISE(ABORT, 'test table failure'); END;",
  );
  const events = [];
  await assert.rejects(
    importDatabase({
      database: path,
      input: output,
      onProgress: (event) => events.push(event),
    }),
    { code: 'INVALID_TABLE_ROW' },
  );
  assert.equal(snapshotRevision(database.snapshot()), before);
  assert.equal(
    events.at(-1).tables.find((table) => table.table === 'packets').status,
    'failed',
  );
  assert.match(events.at(-1).failure.path, /^packets\/.+\.json$/);
  assert.ok(events.every((event) => event.percent < 100));
});

test('экспорт отклоняет осиротевший перевод и сохраняет прежний снимок', async (t) => {
  const { directory, path } = await fixture(t);
  const output = join(directory, 'protected-export');
  await exportDatabase({ database: path, output });
  const before = await readFile(join(output, 'manifest.json'), 'utf8');
  const sql = new Sqlite(path);
  t.after(() => sql.close());
  sql.pragma('foreign_keys = OFF');
  sql.exec(
    "UPDATE packet_revision_translations SET packet_revision_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff' WHERE rowid = (SELECT min(rowid) FROM packet_revision_translations)",
  );
  await assert.rejects(exportDatabase({ database: path, output }), {
    code: 'DATABASE_INTEGRITY_ERROR',
  });
  assert.equal(await readFile(join(output, 'manifest.json'), 'utf8'), before);
});
