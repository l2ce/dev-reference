const FIELD_ORDER = [
  'schemaVersion',
  'dataVersion',
  'defaultLocale',
  'locales',
  'id',
  'key',
  'locale',
  'code',
  'rev',
  'branchKey',
  'sagaKey',
  'releaseKey',
  'chronicleKey',
  'packetKey',
  'scenarioKey',
  'articleKey',
  'kind',
  'name',
  'server',
  'direction',
  'number',
  'variant',
  'regions',
  'loginRevisions',
  'translations',
  'title',
  'summary',
  'description',
  'status',
  'translationStatus',
  'source',
  'protocolKeys',
  'opcode',
  'states',
  'order',
  'openQuestions',
  'value'
] as const

const FIELD_PRIORITY = new Map<string, number>(FIELD_ORDER.map((field, index) => [field, index]))

/**
 * Сравнивает ключи по предметному приоритету, затем по устойчивому алфавитному порядку.
 */
function compareFields(left: string, right: string): number {
  const order = (FIELD_PRIORITY.get(left) ?? FIELD_ORDER.length) - (FIELD_PRIORITY.get(right) ?? FIELD_ORDER.length)
  return order || left.localeCompare(right, 'en')
}

/**
 * Отличает JSON-объект от массивов и скаляров без изменения исходного значения.
 */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Упорядочивает поля записи, её привязок и встроенных источников.
 * Не валидирует предметную форму, не удаляет значения по умолчанию и не меняет вход.
 * Порядок массивов, строки Markdown и любые вложенные данные
 * сохраняются; скаляры и массивы верхнего уровня возвращаются без преобразования.
 */
export function orderDatabaseJson(value: unknown): unknown {
  if (!isJsonObject(value)) {
    return value
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareFields(left, right))
      .map(([key, child]) => [key, key === 'source' && Array.isArray(child) ? child.map(orderDatabaseJson) : child])
  )
}
