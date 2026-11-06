import * as z from 'zod'
import { DatabaseError } from '@l2ce/database'
import { availableFields } from './definition.js'
import { address, FIELD_NAMES, IMMUTABLE_FIELDS } from './model.js'
import type { EditOperation } from './interface.types.js'

/**
 * Объясняет принадлежность полей технической редакции без автоматического выбора её номера.
 */
export function revisionOwnerError(key: string, fields: readonly string[] = []): DatabaseError | undefined {
  const target = address(key)
  if (!['packets', 'scenarios', 'articles'].includes(target.collection)) return undefined
  const revision = address(`${key}:rev-1`)
  const revisionFields = fields.filter(
    (field) =>
      !availableFields(target.collection).includes(field) && availableFields(revision.collection).includes(field)
  )
  if (fields.length && !revisionFields.length) return undefined
  return new DatabaseError(
    'INVALID_INPUT',
    `${revisionFields.length ? `Поля ${revisionFields.join(', ')} принадлежат технической редакции` : 'Переводы, источники и вопросы принадлежат технической редакции'}, а не карточке ${key}. Получите список командой revision list и укажите точный адрес ${key}:rev-N. Редакция автоматически не выбирается.`,
    { key, fields: revisionFields, expectedOwnerType: revision.collection, revisionOwnerKey: key }
  )
}

/**
 * Называет ошибочные поля и корректные предметные операции, сохраняя исходные ошибки схемы.
 */
export function invalidFieldsError(operation: EditOperation, error: z.ZodError): DatabaseError {
  const fields = [
    ...new Set(
      error.issues.flatMap((issue) =>
        issue.code === 'unrecognized_keys' ? issue.keys : issue.path.length ? [String(issue.path[0])] : []
      )
    )
  ]
  const ownerError = fields.length ? revisionOwnerError(operation.key, fields) : undefined
  if (ownerError)
    return new DatabaseError(
      ownerError.code,
      ownerError.message,
      {
        ...z.record(z.string(), z.unknown()).parse(ownerError.details),
        issues: error.issues
      },
      error
    )
  const hints = fields.flatMap((field) => {
    if (['protocols', 'countries'].includes(field) && operation.op === 'update')
      return [`Связь ${field} изменяется через link/unlink, не через update.`]
    if (field === 'translations')
      return ['Для одного перевода используйте translation set; полная замена — replace с --if-version.']
    if (field === 'sources' || field === 'questions')
      return [`Для ${field} используйте группу ${field === 'sources' ? 'source' : 'question'}.`]
    if (IMMUTABLE_FIELDS.includes(FIELD_NAMES[field] ?? field))
      return [`Поле ${field} задаёт идентичность и не изменяется через ${operation.op}.`]
    if (!Object.hasOwn(operation.values, field)) return [`Не задано обязательное поле ${field}.`]
    const issue = error.issues.find((issue) => issue.path[0] === field)
    if (issue?.code === 'invalid_value')
      return [`Поле ${field}: ожидается одно из ${issue.values.map((value) => JSON.stringify(value)).join(', ')}.`]
    if (issue?.code === 'invalid_type') return [`Поле ${field}: ожидается тип ${issue.expected}.`]
    return [`Проверьте поле ${field} по схеме операции.`]
  })
  return new DatabaseError(
    'INVALID_INPUT',
    `Неверные поля ${operation.op} ${operation.key}: ${fields.join(', ') || 'структура ввода'}. ${hints.join(' ')}`,
    { key: operation.key, fields, issues: error.issues },
    error
  )
}
