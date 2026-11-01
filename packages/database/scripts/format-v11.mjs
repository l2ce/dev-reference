import { fromMarkdown } from 'mdast-util-from-markdown'
import { convertSnapshotV12 } from './format-v12.mjs'

/**
 * Убирает языковой префикс, отклоняя ссылки за пределы локали документа.
 */
function logicalKey(key, locale) {
  if (typeof key !== 'string' || !key.startsWith(`${locale}:`)) {
    throw new Error(`Expected a ${locale} key, received ${JSON.stringify(key)}.`)
  }
  return key.slice(locale.length + 1)
}

/**
 * Переписывает активные директивы, сохраняя код, экранирование и остальные байты Markdown.
 */
function rewriteDescription(lines, locale) {
  const text = lines.join('\n')
  const edits = []
  /**
   * Собирает замены по исходным позициям текстовых узлов Markdown.
   */
  function visit(node) {
    if (node.type === 'text') {
      const start = node.position.start.offset
      const raw = text.slice(start, node.position.end.offset)
      for (const match of raw.matchAll(
        /\{\{(link|include|value) ((?:ru|en):(?:packet|scenario|article):[a-z0-9.-]+)/g
      )) {
        let slashes = 0
        for (let index = match.index - 1; index >= 0 && raw[index] === '\\'; index--) {
          slashes++
        }
        if (slashes % 2) {
          continue
        }
        edits.push({
          start: start + match.index,
          end: start + match.index + match[0].length,
          value: `{{${match[1]} ${logicalKey(match[2], locale)}`
        })
      }
    }
    for (const child of node.children ?? []) {
      visit(child)
    }
  }
  visit(fromMarkdown(text))
  let result = text
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end)
  }
  return lines.length ? result.split('\n') : []
}

/**
 * Преобразует ключи и ссылки владельца; локальные ключи встроенных источников сохраняются.
 */
function convertValue(input, locale, source = false) {
  const value = { ...input }
  if (!source) {
    value.key = logicalKey(input.key, locale)
  }
  for (const field of [
    'packetKey',
    'scenarioKey',
    'articleKey',
    'chronicleKey',
    'stageKey',
    'parentKey',
    'previousVariantKey'
  ]) {
    if (field in value && value[field] !== null) {
      value[field] = logicalKey(value[field], locale)
    }
  }
  if ('protocolKeys' in value) {
    value.protocolKeys = value.protocolKeys.map((key) => logicalKey(key, locale))
  }
  if ('description' in value) {
    value.description = rewriteDescription(value.description, locale)
  }
  for (const field of ['bindings', 'stages', 'requires', 'source']) {
    if (field in value) {
      value[field] = value[field].map((child) => convertValue(child, locale, field === 'source'))
    }
  }
  return value
}

/**
 * Переводит снимок 11 через 12 в текущий формат без изменения входа.
 * Локаль документа обязана совпадать с прежним ключом и файловым адресом.
 */
export function convertSnapshotV11(snapshot) {
  if (snapshot.schemaVersion !== 11) {
    throw new Error('The input must use schemaVersion 11.')
  }
  const entries = snapshot.entries.map((entry) => {
    if ('locale' in entry.value && entry.value.locale !== entry.locale) {
      throw new Error(`Document locale mismatch: ${entry.key}.`)
    }
    const value = {
      ...convertValue(entry.value, entry.locale),
      locale: entry.locale
    }
    return { ...entry, key: logicalKey(entry.key, entry.locale), value }
  })
  return convertSnapshotV12({ ...snapshot, schemaVersion: 12, entries })
}
