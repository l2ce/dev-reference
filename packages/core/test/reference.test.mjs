import assert from 'node:assert/strict';
import test from 'node:test';
import { ReferenceReader } from '../dist/reference-api.js';
import { sharedFixture } from '../../database/test/fixtures/shared.mjs';

test('новый читатель различает повторные номера и фильтрует каталог по реальным связям', () => {
  const reader = new ReferenceReader(sharedFixture());
  assert.deepEqual(
    reader.protocols({ number: 152 }).items.map((item) => item.key),
    ['protocol:152', 'protocol:152-rev-1'],
  );
  assert.equal(
    reader.protocols({ branch: 'main', chronicle: 'high-five' }).items[0].key,
    'protocol:273',
  );
  assert.equal(reader.protocol('152-rev-1').profile.variant, 1);
  assert.throws(() => reader.protocol('999999'), { code: 'NOT_FOUND' });
  assert.equal('markdown' in reader.protocols().items[0], false);
});

test('множественное чтение не переносит редакции и переводы между контекстами', () => {
  const snapshot = structuredClone(sharedFixture());
  const revision = snapshot.entries.find(
    (entry) => entry.key === 'packet:key-packet:rev-1',
  );
  revision.value.translations = revision.value.translations.filter(
    (translation) => translation.locale === 'ru',
  );
  const reader = new ReferenceReader(snapshot);
  const result = reader.read({
    protocol: '273',
    locale: 'en',
    keys: ['packet:key-packet', 'article:game-framing', 'packet:missing'],
  });
  assert.deepEqual(
    result.items.map((item) => item.availability),
    ['translation-missing', 'available', 'not-found'],
  );
  assert.equal(result.items[0].markdown, null);
  assert.deepEqual(result.items[0].opcode, revision.value.opcode);
  assert.equal(
    reader.read({ protocol: '152', keys: ['packet:key-packet'] }).items[0]
      .availability,
    'unmapped',
  );
  assert.throws(
    () =>
      reader.read({
        protocol: '273',
        locale: 'de',
        keys: ['packet:key-packet'],
      }),
    { code: 'INVALID_QUERY' },
  );
});

test('поиск учитывает только выбранный язык и применимость, сохраняет снимок и пагинацию', () => {
  const snapshot = structuredClone(sharedFixture());
  const revision = snapshot.entries.find(
    (entry) => entry.key === 'packet:key-packet:rev-1',
  );
  revision.value.translations.find((text) => text.locale === 'ru').description =
    'УНИКАЛЬНЫЙ ТЕКСТ';
  const reader = new ReferenceReader(snapshot);
  assert.equal(
    reader.knowledge({ protocol: '273', locale: 'ru', query: 'уникальный' })
      .total,
    1,
  );
  assert.equal(
    reader.knowledge({ protocol: '273', locale: 'en', query: 'уникальный' })
      .total,
    0,
  );
  assert.equal(
    reader.knowledge({ protocol: '273', status: 'documented' }).total,
    0,
  );
  const first = reader.knowledge({ protocol: '273', kind: 'packet', limit: 1 });
  const next = reader.knowledge({
    protocol: '273',
    kind: 'packet',
    limit: 1,
    offset: first.nextOffset,
  });
  assert.equal(first.total, 4);
  assert.notEqual(first.items[0].key, next.items[0].key);
  snapshot.entries.length = 0;
  const value = reader.read({ protocol: '273', keys: ['packet:key-packet'] });
  value.items[0].sources.length = 0;
  assert.equal(
    reader.read({ protocol: '273', keys: ['packet:key-packet'] }).items[0]
      .sources.length,
    1,
  );
});
