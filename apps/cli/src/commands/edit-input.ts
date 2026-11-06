import { dirname, resolve } from 'node:path'
import * as z from 'zod'
import { DatabaseError } from '@l2ce/database'
import { readInputJson, readInputText } from '../input/json.js'
import { address, OBJECT_SCHEMA } from './model.js'
import { batchInputSchema, textFieldDefinition, valueSchema } from './definition.js'
import { interfaceOptionsSchema } from './interface.types.js'
import type { EditOperation, InterfaceOptions } from './interface.types.js'

/**
 * Делит только по первому «=», сохраняя оставшийся многострочный текст буквально.
 */
export function assignment(input: string): [string, string] {
  const position = input.indexOf('=')
  if (position < 1) throw new DatabaseError('USAGE', `Ожидалось поле=значение, получено «${input}».`)
  return [input.slice(0, position), input.slice(position + 1)]
}

/**
 * Проверяет единственного читателя stdin до начала чтения любого внешнего ввода.
 */
export function checkStdin(options: InterfaceOptions): void {
  const readers = [
    options.input === '-',
    options.keysFile === '-',
    options.selection === '-',
    options.setStdin !== undefined,
    ...options.setFile.map((input) => assignment(input)[1] === '-')
  ].filter(Boolean)
  if (readers.length > 1)
    throw new DatabaseError(
      'USAGE',
      'У процесса один stdin. Нельзя одновременно читать --input -, --keys-file -, --selection -, --set-stdin или --set-file поле=-.'
    )
  if (options.selection === '-' && (options.limit !== undefined || options.offset !== undefined || options.after))
    throw new DatabaseError(
      'USAGE',
      'Для пагинации --selection нужен файл: сохраните выборку и передайте его путь. --selection - можно прочитать целиком без пагинации; --keys-file - поддерживает продолжение по явным адресам.'
    )
}

/**
 * Преобразует только явно типизированные скаляры; строка «null» остаётся строкой.
 */
function scalar(field: string, text: string): unknown {
  if (['order', 'loginRevisions'].includes(field)) {
    if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(Number(text)))
      throw new DatabaseError('INVALID_INPUT', `Поле ${field}: ожидалось безопасное целое число, получено «${text}».`, {
        field,
        value: text
      })
    return Number(text)
  }
  if (field === 'opcode') {
    return text.split('/').map((component) => {
      const match = /^(u8|u16le|u32le):(0x[\da-f]+|\d+)$/i.exec(component)
      if (!match)
        throw new DatabaseError(
          'INVALID_INPUT',
          `Неверный компонент опкода «${component}». Пример: u8:0xFE/u16le:0x0012.`
        )
      const type = z.enum(['u8', 'u16le', 'u32le']).parse(match[1])
      const value = Number(match[2])
      if (value >= 2 ** { u8: 8, u16le: 16, u32le: 32 }[type])
        throw new DatabaseError('INVALID_INPUT', `Опкод ${component} превышает разрядность ${type}.`)
      return { type, value }
    })
  }
  return text
}

/**
 * Добавляет поле ровно один раз независимо от канала передачи значения.
 */
function setValue(values: Record<string, unknown>, field: string, value: unknown): void {
  if (Object.hasOwn(values, field))
    throw new DatabaseError(
      'USAGE',
      `Поле ${field} задано несколькими способами. Оставьте один аргумент, stdin, файл или значение input.`,
      { field }
    )
  values[field] = value
}

/**
 * Читает только разрешённые схемой текстовые поля и не меняет их пробелы.
 */
async function readTextFields(
  operation: string,
  key: string,
  values: Record<string, unknown>,
  files: Record<string, string>,
  baseDirectory: string
): Promise<void> {
  const schema = valueSchema(address(key).collection, operation)
  for (const [field, path] of Object.entries(files)) {
    if (!textFieldDefinition(field).file || !(field in schema.shape)) {
      throw new DatabaseError('USAGE', `Поле ${field} не разрешено для чтения из файла у ${key}.`, { key, field, path })
    }
    if (Object.hasOwn(values, field))
      throw new DatabaseError('USAGE', `Поле ${field} одновременно задано значением и файлом.`, { key, field, path })
    setValue(values, field, await readInputText(path === '-' ? '-' : resolve(baseDirectory, path)))
  }
}

/**
 * Собирает одно изменение из флагов, файлов и необязательного структурированного ввода.
 */
export async function prepareEdit(
  op: string,
  key: string,
  options: InterfaceOptions,
  targets: string[] = [],
  relation?: string
): Promise<EditOperation> {
  const values: Record<string, unknown> = options.input ? OBJECT_SCHEMA.parse(await readInputJson(options.input)) : {}
  for (const field of [
    'title',
    'summary',
    'description',
    'translationStatus',
    'name',
    'server',
    'direction',
    'opcode',
    'order',
    'releasedOn',
    'status',
    'branch',
    'saga',
    'chronicle',
    'region',
    'url',
    'text'
  ] as const) {
    if (options[field] !== undefined) setValue(values, field, scalar(field, options[field]))
  }
  for (const input of options.set) {
    const [field, text] = assignment(input)
    setValue(values, field, scalar(field, text))
  }
  const files: Record<string, string> = {}
  for (const input of options.setFile) {
    const [field, path] = assignment(input)
    if (Object.hasOwn(files, field)) throw new DatabaseError('USAGE', `Поле ${field} повторяется в --set-file.`)
    files[field] = path
  }
  if (options.setStdin) {
    if (Object.hasOwn(files, options.setStdin))
      throw new DatabaseError('USAGE', `Поле ${options.setStdin} одновременно задано stdin и файлом.`)
    files[options.setStdin] = '-'
  }
  await readTextFields(op, key, values, files, process.cwd())
  const add: Record<string, unknown[]> = {}
  const remove: Record<string, unknown[]> = {}
  for (const [inputs, destination] of [
    [options.add, add],
    [options.remove, remove]
  ] as const) {
    for (const input of inputs) {
      const [field, text] = assignment(input)
      destination[field] = [...(destination[field] ?? []), scalar(field, text)]
    }
  }
  for (const field of options.clear) {
    if (Object.hasOwn(values, field) || Object.hasOwn(add, field) || Object.hasOwn(remove, field))
      throw new DatabaseError('USAGE', `Очистка ${field} конфликтует с записью этого поля.`)
  }
  return { op, key, locale: options.locale, values, clear: options.clear, add, remove, options, targets, relation }
}

/**
 * Полностью читает и проверяет файлы батча до начала SQL-записи.
 */
export async function prepareEdits(options: InterfaceOptions): Promise<EditOperation[]> {
  if (!options.input) throw new DatabaseError('USAGE', 'Батч требует --input <path|->.')
  const input = batchInputSchema().parse(await readInputJson(options.input))
  const baseDirectory = options.input === '-' ? process.cwd() : dirname(resolve(options.input))
  const operations: EditOperation[] = []
  for (const [index, raw] of z.array(OBJECT_SCHEMA).parse(input.operations).entries()) {
    // Повторная проверка задаёт точный тип динамической публичной схемы на внешней границе.
    const operation = z
      .object({
        op: z.string(),
        key: z.string(),
        locale: z.string().optional(),
        values: OBJECT_SCHEMA,
        files: z.record(z.string(), z.string()),
        clear: z.array(z.string()),
        add: z.record(z.string(), z.array(z.unknown())),
        remove: z.record(z.string(), z.array(z.unknown())),
        targets: z.array(z.string()),
        relation: z.string().optional(),
        options: OBJECT_SCHEMA.optional()
      })
      .parse(raw)
    try {
      if (Object.values(operation.files).includes('-'))
        throw new DatabaseError('USAGE', 'Внутри батча files не может читать stdin; используйте values.')
      await readTextFields(operation.op, operation.key, operation.values, operation.files, baseDirectory)
      operations.push({
        ...operation,
        options: interfaceOptionsSchema.parse({ ...operation.options, locale: operation.locale })
      })
    } catch (error) {
      if (error instanceof DatabaseError)
        throw new DatabaseError(
          error.code,
          `Операция ${index + 1}, ${operation.key}: ${error.message}`,
          { ...OBJECT_SCHEMA.parse(error.details ?? {}), operationIndex: index, key: operation.key },
          error
        )
      throw error
    }
  }
  return operations
}
