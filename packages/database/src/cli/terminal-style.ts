/**
 * Минимальные ANSI-стили применяются после очистки и ограничения ширины строки.
 */
const styles = {
  strong: ['\u001b[1m', '\u001b[22m'],
  muted: ['\u001b[90m', '\u001b[39m'],
  success: ['\u001b[32m', '\u001b[39m']
} as const

/**
 * Включает оформление только для TTY с учётом явного отключения цвета.
 */
export function terminalColors(stream: NodeJS.WriteStream): boolean {
  return (
    Boolean(stream.isTTY) &&
    process.env.NO_COLOR === undefined &&
    process.env.FORCE_COLOR !== '0' &&
    process.env.TERM !== 'dumb'
  )
}

/**
 * Применяет один стиль к уже подготовленному тексту либо возвращает обычный текст.
 */
export function terminalStyle(text: string, style: keyof typeof styles, enabled: boolean): string {
  if (!enabled) {
    return text
  }
  const [opening, closing] = styles[style]
  return opening + text + closing
}

/**
 * Оформляет шкалу: заполнение зелёное, рамка и незаполненная часть приглушены.
 */
function styledBar(_match: string, filled: string, remaining: string): string {
  return (
    terminalStyle('[', 'muted', true) +
    terminalStyle(filled, 'success', true) +
    terminalStyle(remaining + ']', 'muted', true)
  )
}

/**
 * Выделяет заголовки языков и заполнение шкал, не меняя видимую ширину строки.
 */
export function styleProgressLine(line: string, enabled: boolean): string {
  if (!enabled) {
    return line
  }
  if (/^\[\d+\/\d+\]/.test(line)) {
    return terminalStyle(line, 'strong', true)
  }
  return line.replace(/\[(#*)(-*)\]/g, styledBar)
}
