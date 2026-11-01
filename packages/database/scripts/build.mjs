import { mkdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as z from 'zod'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
await rm(join(root, 'dist'), { recursive: true, force: true })
const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], {
  cwd: root,
  stdio: 'inherit'
})
if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
const sql = spawnSync(
  process.execPath,
  ['scripts/schema.mjs', ...(process.argv.includes('--write-schema') ? ['--write'] : [])],
  { cwd: root, stdio: 'inherit' }
)
if (sql.status !== 0) process.exit(sql.status ?? 1)
const { entitySchemas, implementationSchemas, manifestSchema, sourceSchema } = await import('../dist/model/schema.js')
const { tableManifestSchema, tableRowSchema } = await import('../dist/exchange/table-schema.js')
await mkdir(join(root, 'dist/schemas'), { recursive: true })
for (const [name, schema] of Object.entries({
  manifest: manifestSchema,
  source: sourceSchema,
  'table-manifest': tableManifestSchema,
  'table-row': tableRowSchema,
  ...entitySchemas,
  ...implementationSchemas
})) {
  await writeFile(
    join(root, 'dist/schemas', `${name}.schema.json`),
    JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n'
  )
}
