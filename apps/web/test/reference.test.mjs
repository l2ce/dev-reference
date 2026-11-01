import assert from 'node:assert/strict';
import test from 'node:test';
import { ReferenceReader } from '@l2ce/core/reference';
import { sharedFixture } from '../../../packages/database/test/fixtures/shared.mjs';
import { prepareDocument } from '../src/domains/reference/helpers/prepare-document.ts';

/**
 * Заменяет текст одного перевода синтетического снимка, не затрагивая рабочую базу.
 */
function setMarkdown(snapshot, key, locale, markdown) {
  snapshot.entries
    .find((entry) => entry.key === key)
    .value.translations.find((text) => text.locale === locale).description =
    markdown;
}

test('Markdown-ссылки сохраняют профиль, язык и префикс, а код остаётся буквальным', () => {
  const snapshot = sharedFixture();
  setMarkdown(
    snapshot,
    'packet:key-packet:rev-1',
    'ru',
    '{{link packet:protocol-version}}\n\n`{{link packet:protocol-version}}`',
  );
  const result = prepareDocument(
    new ReferenceReader(snapshot),
    '273',
    'ru',
    'packet:key-packet',
    '/dev-reference',
  );
  assert.match(
    result.markdown,
    /\]\(\/dev-reference\/ru\/protocols\/273\/packet\/protocol-version\/\)/,
  );
  assert.match(result.markdown, /`\{\{link packet:protocol-version\}\}`/);
  assert.deepEqual(result.issues, []);
});

test('отсутствие перевода и применимости не заменяется соседним языком или профилем', () => {
  const snapshot = sharedFixture();
  const revision = snapshot.entries.find(
    (entry) => entry.key === 'packet:key-packet:rev-1',
  );
  revision.value.translations = revision.value.translations.filter(
    (text) => text.locale === 'ru',
  );
  const reader = new ReferenceReader(snapshot);
  const missing = prepareDocument(reader, '273', 'en', 'packet:key-packet', '');
  assert.equal(missing.document.availability, 'translation-missing');
  assert.equal(missing.markdown, '');
  const unmapped = prepareDocument(
    reader,
    '152',
    'ru',
    'packet:key-packet',
    '',
  );
  assert.equal(unmapped.document.availability, 'unmapped');
  assert.equal(unmapped.document.revisionKey, null);
});

test('вставки сохраняют источники, неполноту и диагностику циклов', () => {
  const snapshot = sharedFixture();
  setMarkdown(
    snapshot,
    'packet:key-packet:rev-1',
    'ru',
    '{{include packet:protocol-version}}',
  );
  setMarkdown(
    snapshot,
    'packet:protocol-version:rev-1',
    'ru',
    '{{include packet:key-packet}}',
  );
  const result = prepareDocument(
    new ReferenceReader(snapshot),
    '273',
    'ru',
    'packet:key-packet',
    '',
  );
  assert.equal(result.sources.length, 2);
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0], /Циклическая/);
  assert.match(result.markdown, /Нет описания/);
});

test('неизвестные ссылки и неподходящий сервер явно диагностируются', () => {
  const snapshot = sharedFixture();
  setMarkdown(
    snapshot,
    'packet:key-packet:rev-1',
    'ru',
    '{{link packet:unknown}}\n\n{{link packet:protocol-version server=login}}',
  );
  const result = prepareDocument(
    new ReferenceReader(snapshot),
    '273',
    'ru',
    'packet:key-packet',
    '',
  );
  assert.equal(result.issues.length, 2);
  assert.doesNotMatch(result.markdown, /\]\(/);
});

test('value name использует техническое имя пакета, а не код или перевод заголовка', () => {
  const snapshot = sharedFixture();
  setMarkdown(
    snapshot,
    'packet:key-packet:rev-1',
    'ru',
    '{{value packet:protocol-version field=name}}',
  );
  const result = prepareDocument(
    new ReferenceReader(snapshot),
    '273',
    'ru',
    'packet:key-packet',
    '',
    new Map([['packet:protocol-version', 'ProtocolVersion']]),
  );
  assert.equal(result.markdown, 'ProtocolVersion');
});
