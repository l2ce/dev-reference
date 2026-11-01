import assert from 'node:assert/strict';
import test from 'node:test';
import { createSiteConfig } from '../src/infra/site-config/index';
import { documentPath, protocolPath } from '../src/domains/reference/index';
import { collectPages } from '../src/domains/reference/helpers/collect-pages';
import {
  hasOwn,
  isArrayOf,
  isDefined,
  isEmptyArray,
  isNumber,
  isRecord,
  isString,
} from '../src/shared/lib/value-predicates/index';

test('предикаты сохраняют falsy-значения и отвергают нечисловые и унаследованные поля', () => {
  assert.deepEqual([0, false, '', null, undefined].filter(isDefined), [
    0,
    false,
    '',
  ]);
  assert.equal(isNumber(NaN), false);
  assert.equal(isNumber(Infinity), false);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord([]), false);
  assert.equal(isArrayOf(['valid', 1], isString), false);
  assert.equal(hasOwn(Object.create({ inherited: true }), 'inherited'), false);
  assert.equal(isEmptyArray(undefined), true);
});

test('публикация сохраняет origin и basePath, отвергает неоднозначные конфигурации', () => {
  assert.equal(
    createSiteConfig('/dev-reference', 'https://example.org').siteUrl,
    'https://example.org/dev-reference/',
  );
  assert.equal(
    createSiteConfig('', 'https://example.org').siteUrl,
    'https://example.org/',
  );
  for (const base of [
    'dev-reference',
    '/',
    '/dev-reference/',
    '//cdn',
    '/a/../b',
  ]) {
    assert.throws(() => createSiteConfig(base));
  }
  assert.throws(() => createSiteConfig('', 'https://example.org/subpath'));
  assert.throws(() => createSiteConfig('', 'ftp://example.org'));
});

test('маршруты сохраняют язык и различитель повторяющегося игрового номера', () => {
  assert.equal(
    protocolPath('ru', 'protocol:152-rev-1'),
    '/ru/protocols/152-rev-1/',
  );
  assert.equal(
    documentPath('en', 'protocol:152-rev-2', 'packet:user-info'),
    '/protocols/152-rev-2/packet/user-info/',
  );
  assert.throws(() => documentPath('ru', '273', 'packet:../other'));
});

test('обход страниц не теряет элементы после лимита API и обнаруживает зацикливание', () => {
  const source = Array.from({ length: 237 }, (_, index) => index);
  const items = collectPages((offset) => ({
    items: source.slice(offset, offset + 50),
    total: source.length,
    revision: 'test',
    nextOffset: offset + 50 < source.length ? offset + 50 : null,
  }));
  assert.deepEqual(items, source);
  assert.throws(() =>
    collectPages(() => ({
      items: [],
      total: 1,
      revision: 'test',
      nextOffset: 0,
    })),
  );
});
