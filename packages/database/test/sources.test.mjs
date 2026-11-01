import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  fixture,
  articleEntry,
  articleImplementation,
  address,
} from './helpers.mjs';

test('источники принадлежат конкретному переводу редакции и сохраняют точный URL', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  const revision = articleImplementation(entry);
  const source = {
    id: randomUUID(),
    title: 'Source',
    url: 'https://example.org/commit/file#L20-L30',
    summary: '{{link packet:unknown}}',
  };
  revision.value.translations[0].source = [source];
  revision.value.translations.push({
    ...revision.value.translations[0],
    locale: 'en',
    source: [{ ...source, id: randomUUID(), title: 'English source' }],
  });
  database.applyChanges([
    { op: 'create', entry },
    { op: 'create', entry: revision },
  ]);
  const saved = database.getRevision(address(revision));
  assert.deepEqual(
    saved.translations.find((translation) => translation.locale === 'ru')
      .source,
    [source],
  );
  assert.notEqual(
    saved.translations[0].source[0].id,
    saved.translations[1].source[0].id,
  );
});

test('подтверждённая полнота требует источников; неполная запись без описания допустима', async (t) => {
  const { database } = await fixture(t);
  const entry = articleEntry();
  const revision = articleImplementation(entry);
  database.applyChanges([
    { op: 'create', entry },
    { op: 'create', entry: revision },
  ]);
  assert.throws(
    () =>
      database.update({
        target: address(revision),
        patch: { status: 'partial' },
      }),
    { code: 'VALIDATION_ERROR' },
  );
  const translation = revision.value.translations[0];
  translation.source = [
    { id: randomUUID(), url: 'https://example.org', title: 'Source' },
  ];
  database.update({
    target: address(revision),
    patch: { status: 'partial', translations: [translation] },
  });
  assert.throws(
    () =>
      database.update({
        target: address(revision),
        patch: { status: 'documented' },
      }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('неверный UUID, не-HTTP URL, повтор источника и удалённые поля отклоняются', async (t) => {
  const { database } = await fixture(t);
  for (const patch of [
    { id: 'bad' },
    { url: 'file:///etc/passwd' },
    { locator: 'line 1' },
  ]) {
    const entry = articleEntry();
    const revision = articleImplementation(entry);
    revision.value.translations[0].source = [
      {
        id: randomUUID(),
        url: 'https://example.org',
        title: 'Source',
        ...patch,
      },
    ];
    assert.throws(
      () =>
        database.applyChanges([
          { op: 'create', entry },
          { op: 'create', entry: revision },
        ]),
      { code: 'VALIDATION_ERROR' },
    );
  }
});
