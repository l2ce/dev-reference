#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { parseArgs } from 'node:util';
import { DatasetManager } from './dataset.js';
import { createServer } from './server.js';
import { mcpMessages as messages } from './messages.js';

/**
 * Запускает stdio MCP; stdout принадлежит протоколу, диагностики направляются в stderr.
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'data-dir': { type: 'string' },
      repository: { type: 'string' },
      branch: { type: 'string' },
      'data-path': { type: 'string' },
      'cache-dir': { type: 'string' },
      'poll-interval': { type: 'string' },
    },
  });
  const interval = Number(
    values['poll-interval'] ?? process.env.PROTOCOLS_POLL_INTERVAL ?? '60',
  );
  if (!Number.isFinite(interval) || interval < 0.1) {
    throw new Error(messages.invalidOptions);
  }
  const manager = new DatasetManager({
    dataDir: values['data-dir'] ?? process.env.PROTOCOLS_DATA_DIR,
    repository: values.repository ?? process.env.PROTOCOLS_REPOSITORY,
    branch: values.branch ?? process.env.PROTOCOLS_BRANCH,
    dataPath: values['data-path'] ?? process.env.PROTOCOLS_DATA_PATH,
    cacheDir: values['cache-dir'] ?? process.env.PROTOCOLS_CACHE_DIR,
    pollIntervalMs: interval * 1000,
  });
  try {
    await manager.initialize();
    const server = createServer(manager);
    /**
     * Закрывает транспорт; освобождение менеджера завершается обработчиком onclose.
     */
    const shutdown = (): void => {
      void server
        .close()
        .catch((error: unknown) => console.error(messages.startupError, error));
    };
    /**
     * Снимает обработчики и завершает фоновые обновления после закрытия stdio.
     */
    server.server.onclose = (): void => {
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
      void manager
        .close()
        .catch((error: unknown) => console.error(messages.datasetError, error));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    await server.connect(new StdioServerTransport());
  } catch (error) {
    await manager.close();
    throw error;
  }
}

try {
  await main();
} catch (error) {
  console.error(messages.startupError, error);
  process.exitCode = 1;
}
