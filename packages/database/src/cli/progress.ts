import { compactProgress, progressFrame, terminalLine } from './progress-view.js'
import { styleProgressLine, terminalColors } from './terminal-style.js'
import type { TerminalProgress } from './cli.types.js'

/**
 * Формирует вертикальное перемещение курсора, сохраняя колонку для последующего сброса.
 */
function moveRows(rows: number): string {
  return rows === 0 ? '' : `\u001b[${Math.abs(rows)}${rows < 0 ? 'A' : 'B'}`
}

/**
 * Обновляет строки кадра; force заново рисует финальное состояние целиком.
 * Курсор остаётся под таблицей, высота которой должна помещаться в доступную область.
 */
function redraw(stream: NodeJS.WriteStream, previous: readonly string[], next: readonly string[], force = false): void {
  if (!force && previous.length === next.length && next.every((line, index) => line === previous[index])) {
    return
  }
  let output = ''
  let cursor = previous.length
  if (next.length > previous.length) {
    output += '\n'.repeat(next.length - previous.length)
    cursor = next.length
  }
  for (let index = 0; index < Math.max(previous.length, next.length); index++) {
    const line = next[index] ?? ''
    if (force || line !== previous[index]) {
      output += moveRows(index - cursor) + '\r\u001b[2K' + line
      cursor = index
    }
  }
  output += moveRows(next.length - cursor) + '\r'
  stream.write(output)
}

/**
 * Обновляет компактные строки коллекций в TTY; в pipe выводит только итог или ошибку.
 * Короткий терминал получает одну активную строку и полную итоговую таблицу обычным выводом.
 * Счётчики и шкалы меняются по фактической записи и фиксации, без таймера.
 */
export function createTerminalProgress(stream: NodeJS.WriteStream = process.stderr): TerminalProgress {
  let frame: readonly string[] = []
  let compact = false
  const colors = terminalColors(stream)
  return {
    /**
     * Перерисовывает изменившиеся счётчики либо печатает завершённый результат без ANSI.
     */
    update(event): void {
      if (stream.isTTY) {
        const width = Math.max(1, (stream.columns || 120) - 1)
        const availableRows = Math.max(1, (stream.rows || 24) - 1)
        const finished = event.phase === 'complete' || event.event === 'failure'
        const next = progressFrame(event).map((line) => styleProgressLine(terminalLine(line, width), colors))
        compact ||= next.length > availableRows
        // После уменьшения окна курсор может адресовать только видимую часть старого кадра.
        frame = frame.slice(-availableRows)
        if (compact && finished) {
          redraw(stream, frame, [])
          stream.write(next.join('\n') + '\n\n')
          frame = []
        } else {
          const visible = compact ? [terminalLine(compactProgress(event), width)] : next
          redraw(stream, frame, visible, finished)
          frame = visible
        }
      } else if (event.phase === 'complete' || event.event === 'failure') {
        stream.write(progressFrame(event).join('\n') + '\n\n')
      }
    },
    /**
     * Завершает кадр, оставляя строки на экране; повторный вызов допустим.
     */
    stop(): void {
      if (frame.length > 0) {
        stream.write('\n')
      }
      frame = []
      compact = false
    }
  }
}
