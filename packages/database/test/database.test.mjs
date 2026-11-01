import assert from 'node:assert/strict';
import test from 'node:test';
import Sqlite from 'better-sqlite3';
import { openDatabase, snapshotRevision } from '../dist/index.js';
import {
  fixture,
  articleEntry,
  articleImplementation,
  address,
} from './helpers.mjs';

test('типизированные чтения, SQL-пагинация и поиск переводов Unicode', async (t) => {
  const { database } = await fixture(t);
  assert.equal(
    database.get({ collection: 'packets', key: 'packet:key-packet' }).server,
    'game',
  );
  const page = database.list({
    collection: 'packet-revisions',
    protocolKey: 'protocol:273',
    search: 'ТЕСТ',
    limit: 1,
    offset: 1,
  });
  assert.equal(page.total, 4);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].translations.length, 2);
  assert.equal(
    database.list({ collection: 'packets', protocolKey: 'protocol:152' }).total,
    0,
  );
  assert.throws(
    () => database.list({ collection: 'branches', server: 'game' }),
    { code: 'INVALID_QUERY' },
  );
});

test('Drizzle применяет совместные фильтры до пагинации и передаёт поисковый текст параметром', async (t) => {
  const { database } = await fixture(t);
  const query = {
    collection: 'packet-revisions',
    protocolKey: 'protocol:273',
    ownerKey: 'packet:protocol-version',
    server: 'game',
    direction: 'client-to-server',
    search: 'ТЕСТ',
    limit: 1,
  };
  const first = database.list(query);
  assert.equal(first.total, 1);
  assert.equal(first.items[0].key, 'packet:protocol-version:rev-1');
  const next = database.list({ ...query, offset: 1 });
  assert.equal(next.total, 1);
  assert.deepEqual(next.items, []);
  assert.equal(
    database.list({ collection: 'branches', search: "' OR 1=1 --" }).total,
    0,
  );
  assert.equal(
    database.list({
      collection: 'scenario-revisions',
      protocolKey: 'protocol:273',
      server: 'login',
    }).total,
    2,
  );
  assert.equal(
    database.list({
      collection: 'article-revisions',
      protocolKey: 'protocol:656',
      server: 'game',
    }).total,
    1,
  );
});

test('предметная запись не очищает неизвестные таблицы открытого SQLite-файла', async (t) => {
  const { database, path } = await fixture(t);
  const raw = new Sqlite(path);
  t.after(() => raw.close());
  raw.exec(
    "CREATE TABLE external_notes (id TEXT PRIMARY KEY, note TEXT); INSERT INTO external_notes VALUES ('note', 'keep')",
  );
  database.create(articleEntry());
  assert.deepEqual(raw.prepare('SELECT * FROM external_notes').all(), [
    { id: 'note', note: 'keep' },
  ]);
});

test('CRUD и no-op используют глобальную ревизию общей базы', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  const revision = database.revision();
  assert.equal(database.create(entry, { ifRevision: revision }).changed, 1);
  assert.throws(() => database.put(entry, { ifRevision: revision }), {
    code: 'REVISION_CONFLICT',
  });
  const current = database.revision();
  assert.equal(database.put(entry, { ifRevision: current }).changed, 0);
  assert.equal(database.revision(), current);
  database.delete(address(entry));
  assert.equal(database.get(address(entry)), undefined);
});

test('dryRun проверяет связи и конфликт ревизии, но не сохраняет даже валидный пакет', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  const revision = articleImplementation(entry);
  const before = database.revision();
  const operations = [
    { op: 'create', entry: revision },
    { op: 'create', entry },
  ];
  const preview = database.applyChanges(operations, {
    dryRun: true,
    ifRevision: before,
  });
  assert.equal(preview.changed, 2);
  assert.equal(database.revision(), before);
  assert.equal(database.get(address(entry)), undefined);
  assert.throws(
    () =>
      database.applyChanges([{ op: 'create', entry: revision }], {
        dryRun: true,
      }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () =>
      database.applyChanges(operations, {
        dryRun: true,
        ifRevision: '0'.repeat(64),
      }),
    { code: 'REVISION_CONFLICT' },
  );
  assert.equal(database.applyChanges(operations).revision, preview.revision);
});

test('карточка и редакция записываются в любом порядке; ошибка перевода откатывает весь пакет', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  const revision = articleImplementation(entry);
  database.applyChanges([
    { op: 'create', entry: revision },
    { op: 'create', entry },
  ]);
  const before = database.revision();
  const other = articleEntry('other');
  assert.throws(
    () =>
      database.applyChanges([
        { op: 'create', entry: other },
        {
          op: 'update',
          target: address(revision),
          patch: {
            translations: [{ ...revision.value.translations[0], locale: 'de' }],
          },
        },
      ]),
    { code: 'VALIDATION_ERROR' },
  );
  assert.equal(database.revision(), before);
  assert.equal(database.get(address(other)), undefined);
  assert.equal(database.delete(address(entry)).changed, 2);
});

test('replaceSnapshot откатывает SQL-ошибку и сохраняет согласованное чтение другим соединением', async (t) => {
  const { database, path } = await fixture(t);
  const reader = openDatabase({ database: path, readOnly: true });
  t.after(() => reader.close());
  const before = database.revision();
  const next = {
    ...database.snapshot(),
    entries: [...database.snapshot().entries, articleEntry()],
  };
  assert.throws(
    () =>
      database.replaceSnapshot(next, () => {
        assert.equal(reader.revision(), before);
        throw new Error('abort');
      }),
    /abort/,
  );
  assert.equal(database.revision(), before);
  const raw = new Sqlite(path);
  t.after(() => raw.close());
  raw.exec(
    "CREATE TRIGGER reject_packet BEFORE INSERT ON packets BEGIN SELECT RAISE(ABORT, 'reject'); END",
  );
  assert.throws(() => database.replaceSnapshot(next), /reject/);
  assert.equal(database.revision(), before);
});

test('Markdown хранится буквально, включая неизвестные директивы и ссылки', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  const revision = articleImplementation(entry);
  revision.value.translations[0].description =
    '  текст  \n\n{{link packet:unknown}}\n{{unfinished\n```\n{{include article:unknown}}\n```\n';
  database.applyChanges([
    { op: 'create', entry },
    { op: 'create', entry: revision },
  ]);
  assert.equal(
    database.getRevision(address(revision)).translations[0].description,
    revision.value.translations[0].description,
  );
});

test('read-only соединение и закрытый экземпляр запрещают запись', async (t) => {
  const { path } = await fixture(t);
  const reader = openDatabase({ database: path, readOnly: true });
  assert.throws(() => reader.create(articleEntry()), { code: 'READ_ONLY' });
  reader.close();
  assert.throws(() => reader.snapshot(), { code: 'DATABASE_CLOSED' });
});

test('составное чтение переводов удерживает один SQL-снимок', async (t) => {
  const { database, path } = await fixture(t);
  const raw = new Sqlite(path);
  t.after(() => raw.close());
  const before = snapshotRevision(database.snapshot());
  const entry = articleEntry();
  database.replaceSnapshot(
    {
      ...database.snapshot(),
      entries: [...database.snapshot().entries, entry],
    },
    () => {
      assert.equal(
        raw.prepare('SELECT count(*) AS n FROM articles').get().n,
        1,
      );
    },
  );
  assert.notEqual(database.revision(), before);
});
