import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fixture,
  articleEntry,
  articleImplementation,
  address,
} from './helpers.mjs';

test('коллекция, роль и предметный владелец редакции проверяются согласованно', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  const revision = articleImplementation(entry);
  assert.throws(() => database.create(revision), { code: 'VALIDATION_ERROR' });
  assert.throws(() => database.create({ ...revision, kind: 'entity' }), {
    code: 'INVALID_OPERATION',
  });
  database.applyChanges([
    { op: 'create', entry: revision },
    { op: 'create', entry },
  ]);
  assert.equal(
    database.list({ collection: 'article-revisions', ownerKey: entry.key })
      .total,
    1,
  );
  assert.deepEqual(
    database.getRevision(address(revision)),
    database.getImplementation(address(revision)),
  );
});

test('пересекающиеся операции удаления владельца и изменения редакции отклоняются', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  const revision = articleImplementation(entry);
  database.applyChanges([
    { op: 'create', entry },
    { op: 'create', entry: revision },
  ]);
  const before = database.revision();
  assert.throws(
    () =>
      database.applyChanges([
        { op: 'delete', target: address(entry) },
        { op: 'put', entry: revision },
      ]),
    { code: 'INVALID_OPERATION' },
  );
  assert.equal(database.revision(), before);
});
