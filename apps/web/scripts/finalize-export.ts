import { readFile, writeFile } from 'node:fs/promises';
import { isRecord, isString } from '../src/shared/lib/value-predicates/index';
import { scriptMessages } from './messages';

// Next.js читает .env в своём процессе: берём фактическую конфигурацию готовой сборки.
const manifest: unknown = JSON.parse(
  await readFile(
    new URL('../.next/routes-manifest.json', import.meta.url),
    'utf8',
  ),
);
if (!isRecord(manifest) || !isString(manifest.basePath)) {
  throw new Error(scriptMessages.missingExport);
}

await writeFile(new URL('../out/.nojekyll', import.meta.url), '');
await writeFile(
  new URL('../out/_site.json', import.meta.url),
  JSON.stringify({ basePath: manifest.basePath }),
);
