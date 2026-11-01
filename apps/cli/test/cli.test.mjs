import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { cli, failure, fixture, jsonCli, success } from './helpers.mjs';

test('предметные команды показывают понятную справку, читаемые ключи и Markdown', async (t) => {
  const { run } = await fixture(t);
  const help = await cli(['packets', 'get', '--help']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /<keys\.\.\.>/);
  assert.match(help.stdout, /--protocol/);
  assert.match(help.stdout, /--database/);
  assert.doesNotMatch(help.stdout, /DoltLite|workspace|--variant/);
  const list = await run(['protocols', 'list', '--number', '152']);
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /protocol:152-rev-1/);
  assert.doesNotMatch(list.stdout, /Документация:/);
  const document = await run([
    'packets',
    'get',
    'key-packet',
    '--protocol',
    '273',
  ]);
  assert.equal(document.code, 0, document.stderr);
  assert.match(document.stdout, /Документация:/);
  assert.match(document.stdout, /# key-packet/);
  assert.doesNotMatch(document.stdout, /\\n/);
});

test('JSON-результаты, справка и ошибки отделены от человекочитаемого вывода', async (t) => {
  const { json } = await fixture(t);
  assert.match(success(await jsonCli(['--help'])).help, /protocols/);
  assert.match(
    success(await cli(['packets', 'create', '--help', '--json'])).help,
    /--name/,
  );
  assert.match(
    success(await cli(['--version', '--json'])).version,
    /^\d+\.\d+\.\d+$/,
  );
  failure(await jsonCli(['packets', 'list', '--unknown']), 'USAGE', 2);
  failure(await json(['protocols', 'get', '999999']), 'NOT_FOUND', 3);
  const pretty = await json(['protocols', 'list', '--pretty']);
  assert.match(pretty.stdout, /^\{\n  "ok": true/);
  assert.equal((await cli(['status', '--pretty'])).code, 2);
});

test('схемы доступны без базы, неверные параметры не создают SQLite-файл', async (t) => {
  const { parent } = await fixture(t);
  const missing = join(parent, 'missing.sqlite');
  const schema = success(
    await jsonCli(['--database', missing, 'packets', 'schema', '--rev', '1']),
  );
  assert.equal(schema.schema.properties.opcode.anyOf.length > 0, true);
  assert.ok(schema.generatedFields.includes('id'));
  for (const args of [
    ['protocols', 'list', '--limit', '2x'],
    ['protocols', 'list', '--limit', '101'],
    ['packets', 'get', 'key-packet'],
    ['packets', 'delete', 'key-packet', '--file', '-'],
  ]) {
    const result = await jsonCli(['--database', missing, ...args]);
    assert.equal(result.code, 2, result.stderr);
    assert.equal(result.stdout, '');
  }
  assert.equal(existsSync(missing), false);
  failure(
    await jsonCli(['--database', missing, 'protocols', 'list']),
    'DATABASE_NOT_FOUND',
    3,
  );
});

test('множественное чтение закреплено за протоколом и возвращает явные пробелы', async (t) => {
  const { json } = await fixture(t);
  const read = success(
    await json([
      'read',
      'packet:key-packet',
      'scenario:game-connection',
      'article:absent',
      '--protocol',
      '273',
      '--locale',
      'en',
    ]),
  );
  assert.equal(read.items.length, 3);
  assert.deepEqual(
    read.items.map((item) => item.availability),
    ['available', 'available', 'not-found'],
  );
  assert.ok(
    read.items.every(
      (item) => item.protocol === 'protocol:273' && item.locale === 'en',
    ),
  );
  const gap = success(
    await json(['packets', 'get', 'key-packet', '--protocol', '152']),
  );
  assert.equal(gap.items[0].availability, 'unmapped');
  assert.equal(gap.items[0].markdown, null);
  const search = success(
    await json([
      'search',
      '--protocol',
      '273',
      '--query',
      'ТЕСТ',
      '--locale',
      'ru',
      '--limit',
      '1',
    ]),
  );
  assert.equal(search.items.length, 1);
  assert.equal(search.nextOffset, 1);
});

test('закрытый stdout не выдаёт диагностику EPIPE', async () => {
  const result = await cli(['packets', 'schema', '--json'], '', {
    closeOutput: true,
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
});
