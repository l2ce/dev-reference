import { randomBytes } from 'node:crypto'
import * as z from 'zod'
import { collectionSchema } from '@l2ce/database'
import type { DatabaseSnapshot } from '@l2ce/database'
import { entryMap, publicRecord, translations, TYPES } from '../commands/model.js'
import type { EntryChange, FieldChange, InterfaceOptions, PageInfo, ReadItem } from '../commands/interface.types.js'
import { textFieldDefinition } from '../commands/definition.js'

/**
 * Выводит явные различия пустых значений, не выдавая null за пустую строку.
 */
export function displayValue(value: unknown): string {
  if (value === undefined) return 'отсутствует'
  if (value === null) return 'неизвестно (null)'
  if (value === '') return 'пустой текст'
  if (Array.isArray(value) && !value.length) return 'пустой список []'
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/**
 * Выбирает служебную метку, не встречающуюся в исходном содержимом страницы.
 */
function outputTag(items: ReadItem[]): string {
  const content = JSON.stringify(items)
  let tag = `q${randomBytes(5).toString('hex')}`
  while (content.includes(tag)) tag = `q${randomBytes(8).toString('hex')}`
  return tag
}

/**
 * Ограждает буквальное многострочное поле без отступов и изменения авторского текста.
 */
function textField(tag: string, number: number, field: string, locale: string, content: string): string {
  return `<<< FIELD ${tag} ${number} ${field} ${locale} BEGIN | ${textFieldDefinition(field).format === 'markdown' ? 'Markdown' : 'Text'} >>>\n${content}${content.endsWith('\n') ? '' : '\n'}<<< FIELD ${tag} ${number} ${field} ${locale} END >>>\n`
}

/**
 * Форматирует одну предметную запись, а не рекурсивное дерево сериализованного DTO.
 */
function recordText(item: ReadItem, tag: string, number: number, options: InterfaceOptions): string {
  const record = item.record
  if (!record)
    return `${item.availability === 'not-found' ? 'Запись не найдена' : 'Нет применимой редакции'}: ${item.key}\n`
  let text = item.revisionKey ? `Выбрана редакция: ${item.revisionKey}\n` : ''
  if (item.availability === 'translation-missing')
    text += `Перевод ${options.locale} отсутствует. Другой язык не подставлен.\n`
  const texts = z.array(z.record(z.string(), z.unknown())).parse(record.translations ?? [])
  if (record.name) text += `Техническое имя: ${record.name}\n`
  for (const [field, value] of Object.entries(record)) {
    if (['key', 'type', 'translations', 'name', 'revisionKey', 'card'].includes(field)) continue
    if (
      ['title', 'summary', 'description'].includes(field) &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      for (const [locale, content] of Object.entries(value))
        text += textField(tag, number, field, locale, z.string().parse(content))
      continue
    }
    text +=
      typeof value === 'string' && (value.includes('\n') || ['title', 'summary', 'description'].includes(field))
        ? textField(tag, number, field, options.locale ?? '-', value)
        : `${field}: ${displayValue(value)}\n`
  }
  if (item.revisions)
    text += `Доступные редакции: ${item.revisions.length ? item.revisions.join(', ') : 'пустой список []'}\n`
  for (const translation of texts) {
    const locale = z.string().parse(translation.locale)
    const title = z.string().parse(translation.title)
    text += `${title.includes('\n') ? textField(tag, number, 'title', locale, title) : `Название: ${title || 'заголовок не заполнен'}\n`}Язык: ${locale} · Состояние перевода: ${translation.translationStatus}\n`
    const summary = z.string().parse(translation.summary)
    text += summary ? textField(tag, number, 'summary', locale, summary) : 'Краткое описание не заполнено.\n'
    if (options.view !== 'brief' || options.fields?.split(',').includes('translations')) {
      text += textField(tag, number, 'description', locale, z.string().parse(translation.description))
      const sources = z.array(z.record(z.string(), z.unknown())).parse(translation.sources)
      text += `Источники (${locale}): ${sources.length ? '' : 'пустой список []'}\n`
      for (const source of sources) {
        text += `  ${source.url} [${source.id}]\n`
        text += textField(tag, number, `sources.${source.id}.title`, locale, z.string().parse(source.title))
        if (source.summary)
          text += textField(tag, number, `sources.${source.id}.summary`, locale, z.string().parse(source.summary))
      }
      const questions = z.array(z.string()).parse(translation.questions)
      text += `Открытые вопросы (${locale}): ${questions.length ? '' : 'пустой список []'}\n${questions.map((question, index) => textField(tag, number, `questions.${index + 1}`, locale, question)).join('')}`
    }
  }
  if (record.card) text += `Карточка: ${JSON.stringify(record.card)}\n`
  if (item.matches?.length)
    text += item.matches
      .map((match) => `Совпадение ${match.field}${match.locale ? ` (${match.locale})` : ''}: ${match.fragment}\n`)
      .join('')
  return text
}

/**
 * Оформляет страницу с непрерывной нумерацией, границами документов и явным продолжением.
 */
export function pageText(
  items: ReadItem[],
  meta: {
    operation: string
    page: PageInfo
    scope: unknown
    continuation: string | null
  },
  options: InterfaceOptions
): string {
  const tag = outputTag(items)
  let text = `===== PAGE ${tag} BEGIN | ${meta.operation} | записи ${meta.page.start}–${meta.page.end} из ${meta.page.total} | ${options.view} | ${options.allLocales || options.view === 'edit' ? 'все языки' : options.locale} =====\nОбласть: ${displayValue(meta.scope)}${options.protocol ? ` · Протокол: ${referenceProtocol(options.protocol)}` : ''}\n\n`
  for (const [index, item] of items.entries()) {
    const number = meta.page.start + index
    const label = TYPES[collectionSchema.parse(item.type)][1]
    text += `----- RECORD ${tag} ${number}/${meta.page.total} BEGIN | ${label} | ${item.key} -----\n${recordText(item, tag, number, options)}${item.nextSteps?.length ? `Уточнить:\n${item.nextSteps.map((step) => `  ${step}\n`).join('')}` : ''}----- RECORD ${tag} ${number}/${meta.page.total} END | ${label} | ${item.key} -----\n\n`
  }
  text += `===== PAGE ${tag} END =====\nПоказано ${meta.page.returned} записей из ${meta.page.total}. Осталось ${meta.page.remaining}.\n${meta.continuation ? `Продолжить: ${meta.continuation}` : 'Конец выборки.'}\n`
  return text
}

/**
 * Показывает полный контекст протокола без влияния позиционных адресов.
 */
function referenceProtocol(protocol: string): string {
  return protocol.startsWith('protocol:') ? protocol : `protocol:${protocol}`
}

/**
 * Раскладывает перевод по языкам, чтобы diff одного поля не маскировался заменой массива.
 */
function diffFields(before: Record<string, unknown>, after: Record<string, unknown>, prefix = ''): FieldChange[] {
  const changes: FieldChange[] = []
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const old = before[field]
    const current = after[field]
    if (JSON.stringify(old) === JSON.stringify(current)) continue
    if (field === 'translations') {
      const oldTexts = z.array(z.record(z.string(), z.unknown())).parse(old ?? [])
      const newTexts = z.array(z.record(z.string(), z.unknown())).parse(current ?? [])
      for (const locale of new Set([...oldTexts, ...newTexts].map((text) => z.string().parse(text.locale)))) {
        changes.push(
          ...diffFields(
            oldTexts.find((text) => text.locale === locale) ?? {},
            newTexts.find((text) => text.locale === locale) ?? {},
            `translation.${locale}.`
          )
        )
      }
    } else
      changes.push({
        field: `${prefix}${field}`,
        ...(old !== undefined ? { before: old } : {}),
        ...(current !== undefined ? { after: current } : {})
      })
  }
  return changes
}

/**
 * Считает содержательный diff конечных состояний, включая изменения связанных редакций.
 */
export function snapshotChanges(before: DatabaseSnapshot, after: DatabaseSnapshot, locale: string): EntryChange[] {
  const previous = entryMap(before)
  const current = entryMap(after)
  return [...new Set([...previous.keys(), ...current.keys()])].flatMap((key): EntryChange[] => {
    const old = previous.get(key)
    const entry = current.get(key)
    const fields = diffFields(old ? publicRecord(old) : {}, entry ? publicRecord(entry) : {}).filter(
      (field) =>
        !['key', 'type'].includes(field.field) && (field.field !== 'id' || (old !== undefined && entry !== undefined))
    )
    if (!fields.length) return []
    const selected = entry ?? old
    if (!selected) return []
    return [
      {
        key,
        action: !old ? 'created' : !entry ? 'deleted' : 'updated',
        title:
          translations(selected).find((text) => text.locale === locale)?.title ??
          ('name' in selected.value ? selected.value.name : key),
        fields,
        protocols:
          selected.kind === 'implementation'
            ? [
                ...new Set([
                  ...(old?.kind === 'implementation' ? old.value.protocolKeys : []),
                  ...selected.value.protocolKeys
                ])
              ]
            : []
      }
    ]
  })
}

/**
 * Выбирает одинаковый объём diff для текста и JSON; полные тела выдаются только при full.
 */
export function projectedChanges(changes: EntryChange[], options: InterfaceOptions): EntryChange[] {
  if ((options.diff ?? (options.dryRun ? 'full' : 'summary')) === 'full') return changes
  return changes.map((change) => ({
    ...change,
    fields: change.fields.map((field) => {
      if (!field.field.endsWith('.description')) return field
      if ((field.before === undefined || field.before === '') && (field.after === undefined || field.after === ''))
        return field
      return {
        field: field.field,
        textSummary: {
          beforeLines: typeof field.before === 'string' ? field.before.split('\n').length : 0,
          afterLines: typeof field.after === 'string' ? field.after.split('\n').length : 0
        }
      }
    })
  }))
}

/**
 * Выводит осмысленный план или подтверждение, не выдавая будущую ревизию за сохранённую.
 */
export function changesText(
  changes: EntryChange[],
  options: InterfaceOptions,
  version: string,
  skipped: string[],
  noops: string[],
  warnings: unknown[]
): string {
  const isFull = (options.diff ?? (options.dryRun ? 'full' : 'summary')) === 'full'
  let text = ''
  for (const change of changes) {
    text += `${options.dryRun ? 'План' : 'Сохранено'}: ${change.action === 'created' ? 'создание' : change.action === 'deleted' ? 'удаление' : 'изменение'} ${change.key} — ${change.title}\n`
    for (const field of change.fields) {
      if (field.field.endsWith('.sources')) {
        text += `  ${field.field}: источников ${Array.isArray(field.before) ? field.before.length : 0} → ${Array.isArray(field.after) ? field.after.length : 0}.\n`
      }
      if (field.textSummary) {
        text += `  ${field.field}: изменён документ (${field.textSummary.beforeLines} → ${field.textSummary.afterLines} строк).\n`
      } else
        text += `  ${field.field}:\n    было: ${displayValue(field.before)}\n    станет: ${displayValue(field.after)}\n`
    }
    if (change.protocols.length) text += `  Затрагивает протоколы: ${change.protocols.join(', ')}\n`
  }
  if (skipped.length)
    text += `Пропущено существующих: ${skipped.join(', ')}. Переданные значения не сравнивались и не применялись.\n`
  if (noops.length) text += `Без изменений: ${noops.join(', ')}.\n`
  if (warnings.length) text += `Предупреждения о Markdown-ссылках: ${JSON.stringify(warnings)}\n`
  if (!isFull && changes.some((change) => change.fields.some((field) => field.textSummary)))
    text += 'Показан сокращённый diff; полный: --diff full (для предпросмотра добавьте --dry-run).\n'
  return (
    text +
    `${options.dryRun ? 'Запись не выполнена. Изменится' : 'Сохранено'}: ${changes.length} записей. Без изменений: ${noops.length}.\nИсходная версия: ${version}\n`
  )
}
