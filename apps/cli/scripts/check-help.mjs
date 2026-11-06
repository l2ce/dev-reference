import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createCliProgram } from '../dist/commands/program.js'
import { checkHelpCoverage } from '../dist/help/coverage.js'

const report = checkHelpCoverage(createCliProgram({ stdout: '', stderr: '' }))
console.log(`Справка: ${report.commands} узла с корнем; новых ${report.modern}, совместимых ${report.legacy}.`)
console.log(
  `Описано параметров: ${report.options}; контекстов типов: ${report.contexts}; примеров: ${report.examples}.`
)
if (report.missing.length) {
  for (const missing of report.missing) console.error(missing)
  process.exitCode = 1
} else {
  const tests = (await readdir(new URL('../test/', import.meta.url)))
    .filter((name) => name.startsWith('help') && name.endsWith('.test.mjs'))
    .sort()
    .map((name) => fileURLToPath(new URL(`../test/${name}`, import.meta.url)))
  const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
}
