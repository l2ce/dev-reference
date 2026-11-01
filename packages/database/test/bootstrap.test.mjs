import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import Sqlite from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import {
  databaseStatus,
  importDatabase,
  openDatabase,
  snapshotRevision,
} from '../dist/index.js';
import * as tables from '../dist/sqlite/schema.js';
import {
  fixture,
  fixtureSnapshot,
  sourceDirectory,
  temporaryDirectory,
} from './helpers.mjs';

test('API создаёт пустую базу, а импорт самостоятельно создаёт и наполняет новый файл', async (t) => {
  const directory = await temporaryDirectory();
  const path = join(directory, 'empty.sqlite');
  assert.equal(databaseStatus({ database: path }).schema, 'missing');
  assert.equal(existsSync(path), false);
  assert.throws(() => openDatabase({ database: path, readOnly: true }), {
    code: 'DATABASE_NOT_FOUND',
  });
  const database = openDatabase({ database: path });
  t.after(() => database.close());
  assert.equal(database.manifest(), null);
  assert.throws(() => database.snapshot(), { code: 'DATABASE_EMPTY' });
  assert.equal(databaseStatus({ database: path }).schema, 'current');
  const importedPath = join(directory, 'nested/import.sqlite');
  const result = await importDatabase({
    database: importedPath,
    input: sourceDirectory,
  });
  assert.equal(result.records, fixtureSnapshot.entries.length);
  assert.ok(Number.isFinite(result.durationMs) && result.durationMs > 0);
  assert.equal(
    databaseStatus({ database: importedPath }).entities,
    fixtureSnapshot.entries.filter((entry) => entry.kind === 'entity').length,
  );
  const raw = new Sqlite(importedPath);
  t.after(() => raw.close());
  assert.equal(
    raw
      .prepare(
        "SELECT name FROM sqlite_schema WHERE name = '__drizzle_migrations'",
      )
      .get(),
    undefined,
  );
});

test('SQL-схема создания согласована с типизированными таблицами Drizzle', async (t) => {
  const { path } = await fixture(t);
  const raw = new Sqlite(path);
  t.after(() => raw.close());
  for (const table of Object.values(tables)) {
    const config = getTableConfig(table);
    const actual = raw
      .prepare('SELECT name, type, "notnull" FROM pragma_table_info(?)')
      .all(config.name);
    const expected = config.columns.map((column) => ({
      name: column.name,
      type: column.getSQLType().toUpperCase(),
      notnull: Number(column.notNull),
    }));
    // INTEGER PRIMARY KEY не обязан хранить флаг NOT NULL в PRAGMA SQLite.
    for (const column of expected) {
      const actualColumn = actual.find((item) => item.name === column.name);
      assert.equal(
        actualColumn?.type,
        column.type,
        `${config.name}.${column.name}`,
      );
      if (column.name !== 'id' || config.name !== 'metadata') {
        assert.equal(
          actualColumn?.notnull,
          column.notnull,
          `${config.name}.${column.name}`,
        );
      }
    }
    assert.equal(actual.length, expected.length);
  }
});

test('проверка структуры учитывает уникальные индексы Drizzle Kit; импорт восстанавливает их', async (t) => {
  const { path, database } = await fixture(t);
  const before = database.revision();
  const raw = new Sqlite(path);
  t.after(() => raw.close());
  const index = raw
    .prepare(
      "SELECT name FROM pragma_index_list('protocols') WHERE origin = 'c' AND \"unique\" = 1",
    )
    .get();
  assert.ok(index);
  raw.exec(`DROP INDEX "${index.name}"`);
  assert.equal(databaseStatus({ database: path }).schema, 'outdated');
  assert.throws(() => openDatabase({ database: path, readOnly: true }), {
    code: 'SCHEMA_MISMATCH',
  });
  await importDatabase({ database: path, input: sourceDirectory });
  assert.equal(databaseStatus({ database: path }).schema, 'current');
  assert.equal(database.revision(), before);
  assert.throws(
    () =>
      raw.exec(
        'UPDATE protocols SET variant = 0 WHERE number = 152 AND variant = 1',
      ),
    /UNIQUE/,
  );
});

test('проверка JSON выполняется до создания файла или изменения устаревшей базы', async (t) => {
  const directory = await temporaryDirectory();
  const input = join(directory, 'input');
  await cp(sourceDirectory, input, { recursive: true });
  const file = join(input, 'manifest.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.schemaVersion = 999;
  await writeFile(file, JSON.stringify(manifest));
  const path = join(directory, 'database.sqlite');
  await assert.rejects(importDatabase({ database: path, input }));
  assert.equal(existsSync(path), false);
  const raw = new Sqlite(path);
  t.after(() => raw.close());
  raw.exec(
    'CREATE TABLE old_records (id INTEGER); INSERT INTO old_records VALUES (42)',
  );
  await assert.rejects(importDatabase({ database: path, input }));
  assert.equal(raw.prepare('SELECT id FROM old_records').get().id, 42);
});

test('пересоздание структуры и импорт атомарны, старые таблицы и история удаляются после успеха', async (t) => {
  const { path, database } = await fixture(t);
  const before = snapshotRevision(database.snapshot());
  const raw = new Sqlite(path);
  t.after(() => raw.close());
  raw.exec(`
    ALTER TABLE packets ADD COLUMN old_field TEXT;
    CREATE TABLE obsolete (id INTEGER);
    INSERT INTO obsolete VALUES (42);
    CREATE VIEW obsolete_view AS SELECT id FROM obsolete;
    CREATE TABLE __drizzle_migrations (id INTEGER);
  `);
  assert.equal(databaseStatus({ database: path }).schema, 'outdated');
  assert.throws(() => openDatabase({ database: path }), {
    code: 'SCHEMA_MISMATCH',
  });
  await assert.rejects(
    importDatabase({
      database: path,
      input: sourceDirectory,
      onProgress: (event) => {
        if (
          event.event === 'record-complete' &&
          event.phase === 'write' &&
          event.completed === 5
        ) {
          throw new Error('Прерывание импорта после пересоздания схемы');
        }
      },
    }),
    /Прерывание/,
  );
  assert.equal(databaseStatus({ database: path }).schema, 'outdated');
  assert.equal(raw.prepare('SELECT id FROM obsolete_view').get().id, 42);
  assert.equal(snapshotRevision(database.snapshot()), before);
  await importDatabase({ database: path, input: sourceDirectory });
  assert.equal(databaseStatus({ database: path }).schema, 'current');
  assert.equal(
    raw
      .prepare(
        "SELECT name FROM sqlite_schema WHERE name IN ('obsolete', 'obsolete_view', '__drizzle_migrations')",
      )
      .all().length,
    0,
  );
  assert.equal(
    raw
      .prepare(
        "SELECT name FROM pragma_table_info('packets') WHERE name = 'old_field'",
      )
      .get(),
    undefined,
  );
  assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(snapshotRevision(database.snapshot()), before);
});
