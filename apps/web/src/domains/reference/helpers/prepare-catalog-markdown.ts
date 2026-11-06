import { DatabaseError } from '@l2ce/database/model'
import { renderReferenceMarkdown } from '@l2ce/core/markdown'
import type { ReferenceDirective } from '@l2ce/core/markdown'
import type { ReferenceCatalogItem, ReferenceReader } from '@l2ce/core/reference'
import type { Locale } from 'shared/localization'
import { chroniclePath, protocolPath } from './reference-paths'

/**
 * Разрешает самостоятельный адрес каталога только в существующий маршрут сайта.
 * Новые страницы регионов и групп не подменяются придуманными URL.
 */
export function catalogMarkdownLink(
  reader: ReferenceReader,
  directive: ReferenceDirective,
  locale: Locale,
  basePath: string
): string | null {
  const key = `${directive.kind}:${directive.id}`
  let record: ReferenceCatalogItem
  try {
    record = directive.kind === 'protocol' ? reader.protocol(key, locale).profile : reader.catalogRecord(key, locale)
  } catch (error) {
    if (error instanceof DatabaseError && error.code === 'NOT_FOUND') return null
    throw error
  }
  let path: string | null = null
  if (directive.kind === 'protocol') path = protocolPath(locale, key)
  if (directive.kind === 'chronicle') path = chroniclePath(locale, key)
  if (directive.kind === 'release' && record.chronicleKey) {
    path = `${chroniclePath(locale, record.chronicleKey)}#${directive.id}`
  }
  if (path === null || record.translationStatus === 'missing') return null
  const label = record.title.replace(/[\\`*_[\]<>]/g, '\\$&').replace(/[\r\n]+/g, ' ')
  return `[${label}](${basePath}${path})`
}

/**
 * Готовит описание группы или релиза без неявного выбора технического протокола.
 */
export function prepareCatalogMarkdown(
  reader: ReferenceReader,
  markdown: string | null,
  locale: Locale,
  basePath: string
): string | null {
  if (markdown === null) return null
  const unavailable = locale === 'ru' ? 'Ссылка недоступна' : 'Link unavailable'
  return renderReferenceMarkdown(markdown, {
    link: (directive) =>
      catalogMarkdownLink(reader, directive, locale, basePath) ?? `${unavailable}: ${directive.kind}:${directive.id}`,
    value: (directive) => `${unavailable}: ${directive.kind}:${directive.id}`,
    include: (directive) => `${unavailable}: ${directive.kind}:${directive.id}`
  })
}
