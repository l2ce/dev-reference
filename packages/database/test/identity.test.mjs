import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  fixture,
  articleEntry,
  articleImplementation,
  address,
} from './helpers.mjs';

test('UUID предметных записей и вложенных источников глобально уникальны', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  entry.value.id = database.get({
    collection: 'packets',
    key: 'packet:key-packet',
  }).id;
  assert.throws(() => database.create(entry), { code: 'VALIDATION_ERROR' });
  entry.value.id = randomUUID();
  const revision = articleImplementation(entry);
  const source = database.getRevision({
    collection: 'packet-revisions',
    key: 'packet:key-packet:rev-1',
  }).translations[0].source[0];
  revision.value.translations[0].source = [source];
  assert.throws(
    () =>
      database.applyChanges([
        { op: 'create', entry },
        { op: 'create', entry: revision },
      ]),
    { code: 'VALIDATION_ERROR' },
  );
});

test('ID неизменяем через put/update, одинаковый ключ не создаёт второй языковой объект', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  database.create(entry);
  assert.throws(
    () =>
      database.put({ ...entry, value: { ...entry.value, id: randomUUID() } }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(
    () =>
      database.update({ target: address(entry), patch: { id: randomUUID() } }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.throws(() => database.create(entry), { code: 'ALREADY_EXISTS' });
});
