import assert from 'node:assert/strict'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { importDatabase } from '../dist/index.js'
import { sourceDirectory, temporaryDirectory, fixture } from './helpers.mjs'

test('формат 18 не преобразуется в общую идентичность по совпадению языковых ключей', async (t) => {
  const directory = await temporaryDirectory()
  const input = join(directory, 'old')
  await cp(sourceDirectory, input, { recursive: true })
  const file = join(input, 'manifest.json')
  const manifest = JSON.parse(await readFile(file, 'utf8'))
  await writeFile(file, JSON.stringify({ ...manifest, schemaVersion: 18 }))
  const target = join(directory, 'new.sqlite')
  await assert.rejects(importDatabase({ input, database: target }), {
    code: 'INVALID_DIRECTORY'
  })
  assert.equal(existsSync(target), false)
  const { database, path } = await fixture(t)
  const before = database.revision()
  await assert.rejects(importDatabase({ input, database: path }))
  assert.equal(database.revision(), before)
})
