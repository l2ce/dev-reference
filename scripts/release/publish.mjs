import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { access } from 'node:fs/promises'
import { registry, releasePackages } from './packages.mjs'

// Публикация разрешена только заданию GitHub Release; ручной релиз использует npm publish.
assert.equal(process.env.GITHUB_ACTIONS, 'true')
assert.equal(process.env.GITHUB_EVENT_NAME, 'release')
const packages = await releasePackages()
const mcp = packages.at(-1).manifest
assert.match(mcp.version, /^\d+\.\d+\.\d+$/)
assert.equal(process.env.GITHUB_REF_NAME, `mcp-v${mcp.version}`)

const pending = []
for (const entry of packages) {
  const { manifest, archive } = entry
  await access(archive)
  const response = await fetch(`${registry}${encodeURIComponent(manifest.name)}/${manifest.version}`, {
    signal: AbortSignal.timeout(30_000)
  })
  if (response.status === 404) {
    pending.push(entry)
  } else if (response.ok) {
    console.log(`${manifest.name}@${manifest.version} уже опубликован.`)
  } else {
    throw new Error(`npm registry: HTTP ${response.status} для ${manifest.name}.`)
  }
}

// Ошибки сети и авторизации останавливают процесс; повторной попытки записи нет.
for (const { archive } of pending) {
  execFileSync('npm', ['publish', archive, '--access', 'public', '--provenance', '--registry', registry], {
    stdio: 'inherit'
  })
}
