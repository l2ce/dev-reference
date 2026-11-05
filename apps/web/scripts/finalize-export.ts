import { readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { EMPTY_DOCUMENT_CODE } from '../src/app/helpers/static-document-params'
import { isRecord, isString } from '../src/shared/lib/value-predicates/index'
import { scriptMessages } from './messages'

/**
 * Удаляет только зарезервированные технические маршруты из генерируемого экспорта.
 * Next.js 16 сохраняет HTML даже после notFound; без очистки статический хост вернул бы 200.
 */
async function removeEmptyDocumentRoutes(directory: URL): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    const child = new URL(`${entry.name}/`, directory)
    if (entry.name === EMPTY_DOCUMENT_CODE) {
      await rm(child, { recursive: true })
      continue
    }
    await removeEmptyDocumentRoutes(child)
  }
}

// Next.js читает .env в своём процессе: берём фактическую конфигурацию готовой сборки.
const manifest: unknown = JSON.parse(await readFile(new URL('../.next/routes-manifest.json', import.meta.url), 'utf8'))
if (!isRecord(manifest) || !isString(manifest.basePath)) {
  throw new Error(scriptMessages.missingExport)
}

await writeFile(new URL('../out/.nojekyll', import.meta.url), '')
await writeFile(new URL('../out/_site.json', import.meta.url), JSON.stringify({ basePath: manifest.basePath }))
await removeEmptyDocumentRoutes(new URL('../out/', import.meta.url))
