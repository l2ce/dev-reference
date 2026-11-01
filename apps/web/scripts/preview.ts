import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { isRecord, isString } from '../src/shared/lib/value-predicates/index';
import { scriptMessages as messages } from './messages';
import type { PreviewConfig } from './types/preview-config.type';

const root = fileURLToPath(new URL('../out', import.meta.url));
const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '4173' },
    host: { type: 'string', default: '127.0.0.1' },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(messages.invalidPort);
}

/**
 * Читает префикс самого артефакта, независимо от окружения preview-процесса.
 */
async function readConfig(): Promise<PreviewConfig> {
  const value: unknown = JSON.parse(
    await readFile(resolve(root, '_site.json'), 'utf8'),
  );
  if (!isRecord(value) || !isString(value.basePath)) {
    throw new Error(messages.missingExport);
  }
  return { basePath: value.basePath };
}

const config = await readConfig();
const mimeTypes: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Отдаёт готовый файл без SPA fallback; HEAD сохраняет только заголовки.
 */
async function sendFile(
  file: string,
  status: number,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const info = await stat(file);
  response.writeHead(status, {
    'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': 'no-cache',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(file);
  stream.on('error', (error) => response.destroy(error));
  stream.pipe(response);
}

/**
 * Обслуживает файлы в точке монтирования Pages и возвращает настоящий HTTP 404.
 */
async function serve(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end(messages.method);
    return;
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? '/', 'http://localhost').pathname,
    );
  } catch {
    response.writeHead(400).end(messages.badRequest);
    return;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) {
    response.writeHead(400).end(messages.badRequest);
    return;
  }
  if (config.basePath && pathname === config.basePath) {
    response.writeHead(308, { Location: `${config.basePath}/` }).end();
    return;
  }
  if (!pathname.startsWith(`${config.basePath}/`)) {
    await sendFile(resolve(root, '404.html'), 404, request, response);
    return;
  }
  const relativePath = pathname.slice(config.basePath.length);
  let file = resolve(root, `.${relativePath}`);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(400).end(messages.badRequest);
    return;
  }
  try {
    const info = await stat(file);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(308, { Location: `${pathname}/` }).end();
        return;
      }
      file = resolve(file, 'index.html');
    }
    await sendFile(file, 200, request, response);
  } catch (error) {
    if (
      isRecord(error) &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      await sendFile(resolve(root, '404.html'), 404, request, response);
      return;
    }
    throw error;
  }
}

const server = createServer((request, response) => {
  serve(request, response).catch((error: unknown) => {
    console.error(messages.internalError, error);
    if (!response.headersSent) {
      response.writeHead(500).end(messages.internalError);
    } else {
      response.destroy();
    }
  });
});
server.listen(port, values.host, () =>
  console.log(
    `${messages.ready} http://${values.host}:${port}${config.basePath}/`,
  ),
);
