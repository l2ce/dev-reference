import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { datasetFixture } from './helpers.mjs';

test(
  'stdio MCP предоставляет только чтение и предметный поиск по точному профилю',
  { timeout: 15_000 },
  async (t) => {
    const { dataDir, cacheDir, database } = await datasetFixture(t);
    const client = new Client({ name: 'reference-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        fileURLToPath(new URL('../dist/index.js', import.meta.url)),
        '--data-dir',
        dataDir,
        '--cache-dir',
        cacheDir,
      ],
      stderr: 'pipe',
    });
    t.after(() => client.close());
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name).sort(),
      [
        'get_project_info',
        'get_dataset_status',
        'list_catalog',
        'list_protocols',
        'get_protocol',
        'search_knowledge',
        'read_knowledge',
      ].sort(),
    );
    assert.ok(
      tools.every(
        (tool) =>
          tool.annotations.readOnlyHint === true &&
          tool.annotations.destructiveHint === false,
      ),
    );
    const call = async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return result.structuredContent;
    };
    const status = await call('get_dataset_status');
    assert.equal(status.loaded, true);
    assert.equal(status.dataRevision, database.revision());
    assert.equal(status.schemaVersion, 19);
    assert.equal((await call('list_protocols', { number: 152 })).total, 2);
    assert.equal(
      (await call('get_protocol', { protocol: '152-rev-1' })).profile.variant,
      1,
    );
    const result = await call('read_knowledge', {
      protocol: '273',
      locale: 'ru',
      keys: [
        'packet:key-packet',
        'scenario:game-connection',
        'article:unknown',
      ],
    });
    assert.equal(result.items.length, 3);
    assert.equal(result.items[0].availability, 'available');
    assert.match(result.items[0].markdown, /key-packet/);
    assert.equal(result.items[2].availability, 'not-found');
    assert.equal(
      (
        await call('read_knowledge', {
          protocol: '152',
          keys: ['packet:key-packet'],
        })
      ).items[0].availability,
      'unmapped',
    );
    const search = await call('search_knowledge', {
      protocol: '273',
      locale: 'ru',
      query: 'ТЕСТ',
      limit: 1,
    });
    assert.equal(search.items.length, 1);
    assert.equal(search.nextOffset, 1);
    const missing = await client.callTool({
      name: 'get_protocol',
      arguments: { protocol: '999999' },
    });
    assert.equal(missing.isError, true);
    assert.equal(missing.structuredContent.error.code, 'NOT_FOUND');
    const resource = await client.readResource({ uri: 'protocols://dataset' });
    assert.equal(
      JSON.parse(resource.contents[0].text).dataRevision,
      database.revision(),
    );
  },
);
