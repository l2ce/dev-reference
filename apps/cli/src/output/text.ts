import { cliMessages as messages } from '../locales/ru.js'

/**
 * Форматирует скаляр как обычный текст, сохраняя неизвестные значения явно.
 */
function scalarText(value: unknown): string {
  if (value === null || value === undefined) {
    return messages.output.empty
  }
  if (typeof value === 'boolean') {
    return value ? messages.output.yes : messages.output.no
  }
  return String(value)
}

/**
 * Выбирает подпись поля результата; технические имена незнакомых полей сохраняются буквально.
 */
function fieldLabel(key: string): string {
  const labels: Readonly<Record<string, string>> = messages.output.fields
  return labels[key] ?? key
}

/**
 * Печатает один уровень записи без JSON-скобок и экранированных переносов Markdown.
 */
function valueLines(value: unknown, depth: number): string[] {
  const indent = '  '.repeat(depth)
  if (Array.isArray(value)) {
    if (!value.length) {
      return [`${indent}${messages.output.empty}`]
    }
    return value.flatMap((item) => {
      const lines = valueLines(item, depth + 1)
      return [`${indent}- ${lines[0].trimStart()}`, ...lines.slice(1)]
    })
  }
  if (value !== null && typeof value === 'object') {
    const lines: string[] = []
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) {
        continue
      }
      const label = fieldLabel(key)
      if (
        (key === 'description' || key === 'markdown') &&
        (typeof child === 'string' || (Array.isArray(child) && child.every((line) => typeof line === 'string')))
      ) {
        const markdown = typeof child === 'string' ? child : child.join('\n')
        lines.push(
          `${indent}${label}:`,
          '',
          ...markdown.split('\n').map((line) => (line ? `${indent}${line}` : '')),
          ''
        )
      } else if (child !== null && typeof child === 'object') {
        lines.push(`${indent}${label}:`, ...valueLines(child, depth + 1))
      } else {
        lines.push(`${indent}${label}: ${scalarText(child)}`)
      }
    }
    return lines
  }
  return scalarText(value)
    .split('\n')
    .map((line) => `${indent}${line}`)
}

/**
 * Возвращает текстовое представление результата с буквальными строками Markdown.
 */
export function formatText(value: unknown): string {
  return valueLines(value, 0).join('\n').trimEnd() + '\n'
}
