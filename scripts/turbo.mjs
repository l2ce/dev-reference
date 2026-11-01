import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const git = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8'
})
const commit = process.env.L2CE_SOURCE_GIT_COMMIT ?? (git.status === 0 ? git.stdout.trim() : '')
const result = spawnSync(process.execPath, [require.resolve('turbo/bin/turbo'), ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, L2CE_SOURCE_GIT_COMMIT: commit }
})
if (result.error) {
  throw result.error
}
process.exitCode = result.status ?? 1
