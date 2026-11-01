import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../../', import.meta.url))
export const destination = join(root, 'dist/npm')
export const registry = 'https://registry.npmjs.org/'

/**
 * Возвращает единственный публикуемый пакет MCP; core и database входят в его архив.
 */
export async function releasePackages() {
  return Promise.all(
    ['apps/mcp'].map(async (directory) => {
      const path = join(root, directory)
      const manifest = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'))
      const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`
      return { path, manifest, archive: join(destination, filename) }
    })
  )
}
