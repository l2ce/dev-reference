import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, rename } from 'node:fs/promises';
import { join, relative } from 'node:path';
import test from 'node:test';
import Sqlite from 'better-sqlite3';
import { exportDatabase, importDatabase, openDatabase } from '../dist/index.js';
import { fixture } from './helpers.mjs';

/**
 * Читает точные байты файлов, чтобы обнаружить даже частичную перезапись старого экспорта.
 */
async function directoryContents(directory) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return Object.fromEntries(
    await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const path = join(entry.parentPath, entry.name);
          return [relative(directory, path), await readFile(path, 'utf8')];
        }),
    ),
  );
}

for (const kind of ['composite', 'readable']) {
  test(`коллизия ${kind}: экспорт останавливается до записи и сохраняет прежний каталог`, async (t) => {
    const { directory, path } = await fixture(t);
    const output = join(directory, 'existing');
    await exportDatabase({ database: path, output });
    const previous = await directoryContents(output);
    const sql = new Sqlite(path);
    t.after(() => sql.close());
    let filename;
    if (kind === 'composite') {
      // Разные полные SHA-256 этой пары имеют один 8-символьный префикс.
      sql.exec(
        "CREATE TABLE collision_probe (a TEXT, b INTEGER, PRIMARY KEY (a, b)); INSERT INTO collision_probe VALUES ('example', 75553), ('example', 91517)",
      );
      filename = '6a5e944a.json';
    } else {
      // Проверяется также совпадение хеша небезопасного PK с читаемым одиночным ключом.
      sql.exec(
        "CREATE TABLE collision_probe (id TEXT PRIMARY KEY); INSERT INTO collision_probe VALUES ('outside/path'), ('96d1f355')",
      );
      filename = '96d1f355.json';
    }
    for (const destination of [output, join(directory, 'new')]) {
      const events = [];
      await assert.rejects(
        exportDatabase({
          database: path,
          output: destination,
          onProgress: (event) => events.push(event),
        }),
        (error) => {
          assert.equal(error.code, 'EXPORT_FILENAME_COLLISION');
          assert.equal(error.details.path, `collision_probe/${filename}`);
          assert.equal(error.details.table, 'collision_probe');
          assert.notDeepEqual(error.details.first, error.details.second);
          return true;
        },
      );
      assert.equal(
        events.some((event) => event.phase === 'write'),
        false,
      );
      assert.equal(events.at(-1).event, 'failure');
      assert.ok(events.every((event) => event.percent < 100));
    }
    assert.deepEqual(await directoryContents(output), previous);
    assert.equal(existsSync(join(directory, 'new')), false);
    assert.ok(
      (await readdir(directory)).every(
        (name) => !name.includes('.export-') && !name.endsWith('.export.lock'),
      ),
    );
  });
}

test('одинаковые короткие имена в разных таблицах допустимы', async (t) => {
  const { directory, path } = await fixture(t);
  const sql = new Sqlite(path);
  t.after(() => sql.close());
  sql.exec(
    "CREATE TABLE collision_left (a TEXT, b INTEGER, PRIMARY KEY (a, b)); CREATE TABLE collision_right (a TEXT, b INTEGER, PRIMARY KEY (a, b)); INSERT INTO collision_left VALUES ('example', 75553); INSERT INTO collision_right VALUES ('example', 91517)",
  );
  const output = join(directory, 'separate-tables');
  await exportDatabase({ database: path, output });
  assert.deepEqual(
    JSON.parse(
      await readFile(join(output, 'collision_left/6a5e944a.json'), 'utf8'),
    ),
    { a: 'example', b: 75553 },
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(join(output, 'collision_right/6a5e944a.json'), 'utf8'),
    ),
    { a: 'example', b: 91517 },
  );
});

test('повтор полного nullable PK отклоняется как неверный ключ, независимо от длины имени', async (t) => {
  const { directory, path } = await fixture(t);
  const sql = new Sqlite(path);
  t.after(() => sql.close());
  sql.exec(
    'CREATE TABLE nullable_probe (id TEXT PRIMARY KEY); INSERT INTO nullable_probe VALUES (NULL), (NULL)',
  );
  const output = join(directory, 'invalid-primary-key');
  await assert.rejects(exportDatabase({ database: path, output }), {
    code: 'INVALID_TABLE_KEY',
  });
  assert.equal(existsSync(output), false);
});

test('прежние длинные имена импортируются; экспорт заменяет их короткими без изменения строк', async (t) => {
  const { directory, path, database } = await fixture(t);
  const output = join(directory, 'legacy');
  await exportDatabase({ database: path, output });
  const expected = await directoryContents(output);
  const manifest = JSON.parse(expected['manifest.json']);
  for (const table of manifest.tables.filter(
    (table) => table.primaryKey.length > 1,
  )) {
    for (const name of await readdir(join(output, table.name))) {
      const filename = join(output, table.name, name);
      const row = JSON.parse(await readFile(filename, 'utf8'));
      const hash = createHash('sha256')
        .update(JSON.stringify(table.primaryKey.map((key) => row[key])))
        .digest('hex');
      assert.match(name, /^[a-f0-9]{8}\.json$/);
      await rename(filename, join(output, table.name, `key-${hash}.json`));
    }
  }
  const target = join(directory, 'imported.sqlite');
  await importDatabase({ database: target, input: output });
  const imported = openDatabase({ database: target, readOnly: true });
  t.after(() => imported.close());
  assert.equal(imported.revision(), database.revision());
  await exportDatabase({ database: target, output });
  assert.deepEqual(await directoryContents(output), expected);
  const name = (await readdir(join(output, 'packet_protocols')))[0];
  const invalid = join(output, 'packet_protocols/not-the-primary-key.json');
  await rename(join(output, 'packet_protocols', name), invalid);
  const rejected = join(directory, 'rejected.sqlite');
  await assert.rejects(
    importDatabase({ database: rejected, input: output }),
    (error) =>
      error.code === 'INVALID_TABLE_ROW' && error.details.path === invalid,
  );
  assert.equal(existsSync(rejected), false);
});
