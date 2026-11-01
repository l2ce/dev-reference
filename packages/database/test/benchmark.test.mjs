import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { runInTerminal, terminalLines } from './terminal.mjs'

const benchmark = fileURLToPath(new URL('../scripts/benchmark.mjs', import.meta.url))
const artifacts = fileURLToPath(new URL('../.local/benchmarks/', import.meta.url))

test(
  'бенчмарк выполняет один цикл и завершает динамический список SQL-таблиц в TTY',
  { skip: process.platform === 'win32' },
  async (t) => {
    if (spawnSync('python3', ['--version']).error?.code === 'ENOENT') {
      t.skip('Для интеграционной проверки PTY требуется python3.')
      return
    }
    for (const rows of [32, 12]) {
      const result = runInTerminal([process.execPath, benchmark, '--records', '100'], rows)
      assert.equal(result.status, 0, result.stderr + result.stdout)
      const directory = /Benchmark directory: (.+)/.exec(result.stdout)?.[1].trim()
      assert.ok(directory?.startsWith(artifacts))
      t.after(() => rm(directory, { recursive: true, force: true }))
      const report = JSON.parse(await readFile(join(directory, 'results.json'), 'utf8'))
      assert.equal('runs' in report.config, false)
      assert.equal('runs' in report, false)
      assert.equal(report.export.records, 100)
      assert.equal(report.import.records, 100)
      assert.equal(report.verification.equal, true)
      assert.equal(report.export.progressMode, 'tty')
      assert.equal(report.import.progressMode, 'tty')
      assert.doesNotMatch(result.stdout, /\[(?:export|import)\] (?:scan|read|write|complete)|Median|Run \d/)
      for (const marker of ['Importing...', 'Verifying round-trip...']) {
        const position = result.stdout.indexOf(marker)
        assert.ok(position >= 0)
        const lines = terminalLines(result.stdout.slice(0, position), rows)
        const start = lines.findLastIndex((line) => line.startsWith('article_protocols ('))
        assert.ok(start >= 0, lines.join('\n'))
        const frame = lines.slice(start, start + report.export.tables)
        assert.equal(frame.length, report.export.tables)
        assert.equal(new Set(frame.map((line) => /^(\w+)/.exec(line)?.[1])).size, report.export.tables)
        assert.ok(
          frame.every((line) => /^\w+ \(\d+\):\s+\[#{28}\] 100%$/.test(line)),
          frame.join('\n')
        )
      }
    }
  }
)

test('параметр повторений бенчмарка больше не принимается', () => {
  const result = spawnSync(process.execPath, [benchmark, '--records', '100', '--runs', '3'], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /ERR_PARSE_ARGS_UNKNOWN_OPTION/)
  assert.doesNotMatch(result.stdout, /Preparing|Exporting|Importing/)
})
