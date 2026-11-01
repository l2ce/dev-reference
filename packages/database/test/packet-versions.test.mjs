import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fixture, freshIds } from './helpers.mjs';

test('редакция переиспользуется несколькими протоколами; технические отличия имеют отдельную редакцию', async (t) => {
  const { database } = await fixture(t);
  const first = database.getRevision({
    collection: 'packet-revisions',
    key: 'packet:key-packet:rev-1',
  });
  assert.deepEqual(first.protocolKeys, ['protocol:273', 'protocol:656']);
  const value = {
    ...freshIds(first),
    key: 'packet:key-packet:rev-2',
    rev: 2,
    protocolKeys: ['protocol:152'],
    opcode: null,
    translations: [],
  };
  database.create({
    collection: 'packet-revisions',
    kind: 'implementation',
    key: value.key,
    value,
  });
  assert.equal(
    database.list({
      collection: 'packet-revisions',
      protocolKey: 'protocol:152',
    }).items[0].rev,
    2,
  );
  assert.equal(
    database.list({
      collection: 'packet-revisions',
      protocolKey: 'protocol:273',
      ownerKey: first.packetKey,
    }).items[0].rev,
    1,
  );
  assert.throws(
    () =>
      database.update({
        target: {
          collection: 'packet-revisions',
          kind: 'implementation',
          key: value.key,
        },
        patch: { protocolKeys: ['protocol:273'] },
      }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('составные опкоды проверяются по разрядности, направлению и пересечению состояний', async (t) => {
  const { database } = await fixture(t);
  const packet = database.get({
    collection: 'packets',
    key: 'packet:key-packet',
  });
  const revision = database.getRevision({
    collection: 'packet-revisions',
    key: 'packet:key-packet:rev-1',
  });
  const card = {
    collection: 'packets',
    kind: 'entity',
    key: 'packet:other',
    value: { ...packet, id: randomUUID(), code: 'other', key: 'packet:other' },
  };
  const implementation = {
    collection: 'packet-revisions',
    kind: 'implementation',
    key: 'packet:other:rev-1',
    value: {
      ...freshIds(revision),
      packetKey: card.key,
      key: 'packet:other:rev-1',
    },
  };
  assert.throws(
    () =>
      database.applyChanges([
        { op: 'create', entry: card },
        { op: 'create', entry: implementation },
      ]),
    { code: 'VALIDATION_ERROR' },
  );
  card.value.direction = 'client-to-server';
  database.applyChanges([
    { op: 'create', entry: card },
    { op: 'create', entry: implementation },
  ]);
  assert.throws(
    () =>
      database.update({
        target: {
          collection: 'packet-revisions',
          kind: 'implementation',
          key: implementation.key,
        },
        patch: { opcode: [{ type: 'u8', value: 256 }] },
      }),
    { code: 'VALIDATION_ERROR' },
  );
});
