import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { after } from 'node:test';
import {
  importDatabase,
  exportDatabase,
  openDatabase,
  recordPath,
  parseEntry,
} from '../dist/index.js';
import { randomUUID } from 'node:crypto';
import { sharedFixture } from './fixtures/shared.mjs';

/**
 * Копирует документ для новой сущности и выдаёт независимые UUID его источникам.
 */
export function freshIds(value) {
  return JSON.parse(JSON.stringify(value), (key, child) =>
    key === 'id' ? randomUUID() : child,
  );
}

const root = await mkdtemp(join(tmpdir(), 'l2ce-v19-fixture-'));
// Общий after выполняется после t.after всех тестов: Windows запрещает удалять открытый SQLite.
after(() => rm(root, { recursive: true, force: true }));
export const fixtureSnapshot = sharedFixture();
export const tableDirectory = join(root, 'tables');
export const sourceDirectory = join(root, 'documents');
const initialPath = join(root, 'initial.sqlite');
const initial = openDatabase({ database: initialPath });
try {
  initial.replaceSnapshot(fixtureSnapshot);
} finally {
  initial.close();
}
await exportDatabase({ database: initialPath, output: tableDirectory });
for (const entry of fixtureSnapshot.entries) {
  const path = join(sourceDirectory, recordPath(entry));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(entry.value, null, 2) + '\n');
}
const { entries: _entries, ...manifest } = fixtureSnapshot;
await writeFile(
  join(sourceDirectory, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
export const cliFile = fileURLToPath(
  new URL('../dist/cli/index.js', import.meta.url),
);

/**
 * Создаёт изолированную временную область; удаляет её после всех тестов файла и их t.after.
 */
export async function temporaryDirectory() {
  return mkdtemp(join(root, 'database-test-'));
}

/**
 * Восстанавливает синтетический снимок физическим импортом.
 */
export async function fixture(t) {
  const directory = await temporaryDirectory();
  const path = join(directory, 'database.sqlite');
  await importDatabase({ database: path, input: tableDirectory });
  const database = openDatabase({ database: path });
  t.after(() => database.close());
  return { directory, path, database };
}

/**
 * Создаёт общую карточку статьи для проверок записи.
 */
export function articleEntry(code = 'test-article') {
  const key = `article:${code}`;
  return parseEntry({
    collection: 'articles',
    key,
    kind: 'entity',
    value: { id: randomUUID(), key, code, servers: ['game'] },
  });
}

/**
 * Создаёт неполную редакцию статьи с русским текстом.
 */
export function articleImplementation(entity, rev = 1) {
  const key = `${entity.key}:rev-${rev}`;
  return parseEntry({
    collection: 'article-revisions',
    key,
    kind: 'implementation',
    value: {
      id: randomUUID(),
      key,
      articleKey: entity.key,
      rev,
      translations: [
        { locale: 'ru', title: 'Редакция', summary: 'Тест', description: '' },
      ],
    },
  });
}

/**
 * Извлекает общий адрес записи без содержимого и языка.
 */
export function address(entry) {
  return { collection: entry.collection, key: entry.key, kind: entry.kind };
}

/**
 * Возвращает документный путь записи синтетического снимка.
 */
export function fixturePath(key) {
  return recordPath(fixtureSnapshot.entries.find((entry) => entry.key === key));
}
