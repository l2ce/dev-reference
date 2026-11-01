import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { inspectArchitecture } from '../scripts/architecture/inspect-architecture.mjs'

/**
 * Проверяет синтетическое дерево импортов и удаляет только созданный тестом каталог.
 */
function inspect(files) {
  const temporary = resolve('.local/architecture-tests')
  mkdirSync(temporary, { recursive: true })
  const root = mkdtempSync(`${temporary}/case-`)
  try {
    for (const [name, contents] of Object.entries(files)) {
      const target = resolve(root, name)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, contents)
    }
    return inspectArchitecture(root)
  } finally {
    rmSync(root, { recursive: true })
  }
}

test('архитектурная проверка принимает фасеты и type-only контракт сервера', () => {
  assert.deepEqual(
    inspect({
      'domains/data/index.ts': "export type { Data } from './types';",
      'domains/data/types.ts': 'export interface Data { id: string }',
      'compositions/screens/page/client.ts': "'use client'; export { page } from './page';",
      'compositions/screens/page/page.ts':
        "import type { Data } from 'domains/data'; export const page = (value: Data) => value.id;"
    }),
    []
  )
})

test('архитектурная проверка обнаруживает глубокий импорт и цикл юнитов', () => {
  const errors = inspect({
    'domains/a/index.ts': "export { a } from './a';",
    'domains/a/a.ts': "import { b } from 'domains/b/b'; export const a = b;",
    'domains/b/index.ts': "export { b } from './b';",
    'domains/b/b.ts': "import { a } from 'domains/a'; export const b = a;"
  })
  assert.ok(errors.some((error) => error.includes('Глубокий')))
  assert.ok(errors.some((error) => error.includes('Цикл')))
})

test('универсальный фасет не скрывает клиентскую framework-границу', () => {
  const errors = inspect({
    'ui/theme/index.ts': "export { Theme } from './client';",
    'ui/theme/client.ts': "'use client'; export { Theme } from './theme';",
    'ui/theme/theme.ts': 'export const Theme = () => null;'
  })
  assert.ok(errors.some((error) => error.includes('импортирует средовой фасет')))
})

test('архитектурная проверка запрещает соседа вложенного юнита и Node.js в клиенте', () => {
  const errors = inspect({
    'compositions/screens/page/client.ts': "'use client'; export { page } from './page';",
    'compositions/screens/page/page.ts': "import { a } from 'compositions/screens/page/ui/a'; export const page = a;",
    'compositions/screens/page/ui/a/index.ts': "export { a } from './a';",
    'compositions/screens/page/ui/a/a.ts': "import { b } from 'compositions/screens/page/ui/b'; export const a = b;",
    'compositions/screens/page/ui/b/index.ts': "export { b } from './b';",
    'compositions/screens/page/ui/b/b.ts': "import { readFile } from 'node:fs'; export const b = readFile;"
  })
  assert.ok(errors.some((error) => error.includes('доступен только родителю')))
  assert.ok(errors.some((error) => error.includes('Клиентский runtime-граф')))
})
