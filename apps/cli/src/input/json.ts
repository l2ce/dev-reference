import { createReadStream } from 'node:fs'
import { DatabaseError } from '@l2ce/database'
import { cliMessages as messages } from '../locales/ru.js'

const MAX_INPUT_BYTES = 16 * 1024 * 1024

/**
 * Ограничивает суммарный размер входа до разбора JSON, не загружая произвольный файл целиком.
 */
async function readInputStream(stream: AsyncIterable<unknown>): Promise<string> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of stream) {
    if (typeof chunk !== 'string' && !(chunk instanceof Uint8Array)) {
      throw new DatabaseError('INVALID_JSON', messages.invalidInputChunk)
    }
    const buffer = Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > MAX_INPUT_BYTES) {
      throw new DatabaseError('INVALID_JSON', messages.inputTooLarge)
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Читает ограниченный UTF-8 текст из файла или stdin; '-' означает stdin, TTY отклоняется.
 */
export async function readInputText(file = '-'): Promise<string> {
  if (file === '-' && process.stdin.isTTY) {
    throw new DatabaseError('USAGE', messages.missingInput)
  }
  return readInputStream(file === '-' ? process.stdin : createReadStream(file))
}

/**
 * Разбирает ограниченный текстовый ввод как JSON и сохраняет путь в диагностике.
 */
export async function readInputJson(file = '-'): Promise<unknown> {
  const text = await readInputText(file)
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new DatabaseError('INVALID_JSON', messages.invalidJson, { file }, error)
  }
}
