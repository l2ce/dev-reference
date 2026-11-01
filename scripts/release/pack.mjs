import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { destination, releasePackages } from './packages.mjs'

const packages = await releasePackages()
for (const { manifest } of packages) {
  assert.notEqual(manifest.private, true, `${manifest.name}: пакет приватный.`)
  assert.equal(manifest.publishConfig.access, 'public')
}
await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
for (const { path, manifest } of packages) {
  execFileSync(process.execPath, [join(path, 'scripts/prepare-package.mjs')], {
    stdio: 'inherit'
  })
  // npm упаковывает реальные bundledDependencies из staging без смены pnpm nodeLinker.
  execFileSync('npm', ['pack', '--pack-destination', destination], {
    cwd: join(path, manifest.publishConfig.directory),
    stdio: 'inherit'
  })
}
console.log(`Архивы релиза: ${destination}`)
