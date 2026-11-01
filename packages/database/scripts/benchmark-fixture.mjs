import { parseEntry, validateSnapshot } from '../dist/index.js'
import { randomUUID } from 'node:crypto'

/**
 * Дополняет снимок синтетическими общими сущностями и переводами до заданного числа записей.
 * Набор предназначен только для .local/benchmarks и не публикуется в data/.
 */
export function benchmarkFixture(base, records, descriptionBytes) {
  const entries = [...base.entries]
  if (entries.length + 3 > records) throw new Error('Too few benchmark records.')
  /**
   * Создаёт переводы фиксированного байтового размера с независимыми источниками.
   */
  function translations(key) {
    return base.locales.map((locale) => {
      const header = `# Synthetic benchmark ${key}\n\n{{link packet:unknown}}\n`
      const padding = descriptionBytes - Buffer.byteLength(header)
      if (padding < 0) throw new Error('Description size is too small.')
      return {
        locale,
        title: `Benchmark ${key}`,
        summary: 'Synthetic fixture',
        description: header + 'x'.repeat(padding),
        source: [
          {
            id: randomUUID(),
            title: 'Benchmark source',
            url: 'https://example.invalid/benchmark'
          }
        ]
      }
    })
  }
  /**
   * Добавляет проверенную запись; роль выводится из предметной коллекции.
   */
  function add(collection, key, value) {
    entries.push(
      parseEntry({
        collection,
        key,
        kind: collection.endsWith('-revisions') ? 'implementation' : 'entity',
        value: { id: randomUUID(), key, ...value }
      })
    )
  }
  add('branches', 'branch:benchmark-root', {
    code: 'benchmark-root',
    translations: translations('root')
  })
  add('chronicles', 'chronicle:benchmark-root', {
    code: 'benchmark-root',
    branchKey: 'branch:benchmark-root',
    translations: translations('root')
  })
  add('protocols', 'protocol:900000000', {
    number: 900000000,
    translations: translations('root')
  })
  const kinds = ['branch', 'chronicle', 'release', 'protocol', 'packet', 'scenario', 'article']
  for (let index = 0; entries.length < records; index++) {
    const kind = kinds[index % kinds.length]
    const code = `benchmark-${index}`
    if (kind === 'branch')
      add('branches', `branch:${code}`, {
        code,
        translations: translations(code)
      })
    if (kind === 'chronicle')
      add('chronicles', `chronicle:${code}`, {
        code,
        branchKey: 'branch:benchmark-root',
        translations: translations(code)
      })
    if (kind === 'release')
      add('chronicle-releases', `chronicle:benchmark-root:${code}`, {
        code,
        chronicleKey: 'chronicle:benchmark-root',
        protocolKeys: ['protocol:900000000'],
        translations: translations(code)
      })
    if (kind === 'protocol')
      add('protocols', `protocol:${1000000 + index}`, {
        number: 1000000 + index,
        translations: translations(code)
      })
    if (['packet', 'scenario', 'article'].includes(kind)) {
      const key = `${kind}:${code}`
      add(`${kind}s`, key, {
        code,
        ...(kind === 'packet' ? { name: code, server: 'game', direction: 'client-to-server' } : { servers: ['game'] })
      })
      if (entries.length < records)
        add(`${kind}-revisions`, `${key}:rev-1`, {
          [`${kind}Key`]: key,
          rev: 1,
          protocolKeys: ['protocol:900000000'],
          translations: translations(code)
        })
    }
  }
  return validateSnapshot({
    ...base,
    dataVersion: `benchmark-${records}`,
    entries
  })
}
