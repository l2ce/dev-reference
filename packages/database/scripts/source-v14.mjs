import { sourceMetadata, sourceSchema } from '../dist/source.js'

/**
 * Дополняет закреплённую ссылку единственным явным диапазоном строк, сохраняя существующий якорь.
 * Несколько диапазонов остаются в пояснении: выбор одного из них был бы неоднозначным.
 */
function locatedUrl(input, metadata) {
  const url = new URL(input.url)
  if (!metadata?.filePath || url.hash || url.hostname === 'raw.githubusercontent.com') {
    return input.url
  }
  const ranges = [...(input.locator ?? '').matchAll(/(?:lines?|строк(?:и|а|ах|е)?)\s+(\d+)(?:\s*[–—-]\s*(\d+))?/giu)]
  if (ranges.length !== 1) {
    return input.url
  }
  const start = Number(ranges[0][1])
  const end = Number(ranges[0][2] ?? ranges[0][1])
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
    return input.url
  }
  let suffix = ''
  if (end !== start) {
    suffix = metadata.provider === 'github' ? `-L${end}` : `-${end}`
  }
  url.hash = `L${start}${suffix}`
  return url.href
}

/**
 * Переводит источник в компактный контракт без потери содержательных пояснений.
 * UUID сохраняется. Непредставленная в URL revision переносится в summary, ветки не разрешаются по сети.
 */
export function convertSourceV14(input) {
  const fields = ['id', 'url', 'title', 'summary', 'description', 'method', 'locator', 'revision']
  if (Object.keys(input).some((field) => !fields.includes(field))) {
    throw new Error(`Unexpected field in legacy source: ${input.id}.`)
  }
  const metadata = sourceMetadata(input.url)
  if (
    input.revision &&
    /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(input.revision) &&
    metadata?.commit &&
    input.revision.toLowerCase() !== metadata.commit.toLowerCase()
  ) {
    throw new Error(`Source revision conflicts with its URL: ${input.id}.`)
  }
  const parts = [input.summary, input.locator, input.description?.join('\n')].filter(
    (text) => typeof text === 'string' && text.trim().length > 0
  )
  if (
    input.revision &&
    metadata?.commit?.toLowerCase() !== input.revision.toLowerCase() &&
    !input.url.includes(input.revision)
  ) {
    parts.push(`Revision: ${input.revision}`)
  }
  const summary = [...new Set(parts)].join('\n\n')
  return sourceSchema.parse({
    id: input.id,
    url: locatedUrl(input, metadata),
    title: input.title,
    ...(summary ? { summary } : {})
  })
}
