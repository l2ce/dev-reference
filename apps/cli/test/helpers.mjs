import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, exportDatabase } from '@l2ce/database'
import { sharedFixture } from '../../../packages/database/test/fixtures/shared.mjs'

export const executable = fileURLToPath(new URL('../dist/index.js', import.meta.url))
const temporaryRoot = join(tmpdir(), 'opencode')
await mkdir(temporaryRoot, { recursive: true })

/**
 * Запускает настоящий CLI и сохраняет раздельные потоки и код завершения.
 * closeOutput моделирует закрытый потребителем stdout до первой записи CLI.
 */
export function cli(args, input = '', options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [executable, ...args], {
      cwd: options.cwd ?? temporaryRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') {
        reject(error)
      }
    })
    child.once('close', (code) => resolve({ code, stdout, stderr }))
    if (options.closeOutput) {
      child.stdout.destroy()
    }
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input))
  })
}

/**
 * Явно включает машинный формат для проверок контрактов и мутаций.
 */
export function jsonCli(args, input = '', options = {}) {
  return cli(['--json', ...args], input, options)
}

/**
 * Создаёт изолированную SQLite-базу с синтетическими знаниями и отдельный экспорт.
 * initialize:false оставляет создание базы проверяемой команде CLI.
 */
export async function fixture(t, options = {}) {
  const parent = await mkdtemp(join(temporaryRoot, 'protocols-cli-'))
  t.after(() => rm(parent, { recursive: true, force: true }))
  const source = join(parent, 'data')
  const database = join(parent, 'database.sqlite')
  if (options.initialize !== false) {
    const connection = openDatabase({ database })
    try {
      connection.replaceSnapshot(sharedFixture())
    } finally {
      connection.close()
    }
    await exportDatabase({ database, output: source })
  }
  return {
    parent,
    source,
    database,
    /**
     * Выполняет текстовую команду в изолированном рабочем каталоге.
     */
    run: (args, input = '') => cli(['--database', database, ...args], input, { cwd: parent }),
    /**
     * Выполняет машинную команду в том же рабочем файле фикстуры.
     */
    json: (args, input = '') => jsonCli(['--database', database, ...args], input, { cwd: parent })
  }
}

/**
 * Проверяет успешный JSON-конверт без постороннего вывода.
 */
export function success(result) {
  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  const envelope = JSON.parse(result.stdout)
  assert.equal(envelope.ok, true)
  return envelope.data
}

/**
 * Проверяет код процесса, пустой stdout и структурированную ошибку.
 */
export function failure(result, code, exit) {
  assert.equal(result.code, exit, result.stderr)
  assert.equal(result.stdout, '')
  const envelope = JSON.parse(result.stderr)
  assert.equal(envelope.ok, false)
  assert.equal(envelope.error.code, code)
  return envelope.error
}

/**
 * Читает JSON только из тестовой копии источника или экспортированного снимка.
 */
export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

/**
 * Имитирует явную правку JSON внешним редактором без обращения к workspace API.
 */
export async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n')
}
