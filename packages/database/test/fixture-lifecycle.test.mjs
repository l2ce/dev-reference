import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { openDatabase } from '../dist/index.js'
import { temporaryDirectory } from './helpers.mjs'

let directory
after(() => {
  assert.equal(existsSync(directory), false, 'Временный каталог должен быть удалён после закрытия ресурсов.')
})

test('очистка fixture сохраняет файлы до закрытия соединений в t.after', async (t) => {
  directory = await temporaryDirectory()
  const path = join(directory, 'database.sqlite')
  const database = openDatabase({ database: path })
  t.after(() => {
    try {
      assert.equal(existsSync(path), true, 'SQLite нельзя удалять до закрытия соединения.')
      assert.equal(database.manifest(), null)
    } finally {
      database.close()
    }
  })
})
