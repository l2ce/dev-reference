/**
 * Исключает null и undefined, сохраняя 0, false и пустую строку.
 */
export const isDefined = <T>(value: T | null | undefined): value is T => value != null

/**
 * Определяет отсутствие значения, не смешивая его с falsy-значениями.
 */
export const isNotDefined = <T>(value: T | null | undefined): value is null | undefined => value == null

/**
 * Проверяет строковое runtime-значение.
 */
export const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * Проверяет конечное число, исключая NaN и бесконечности.
 */
export const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * Проверяет логическое runtime-значение.
 */
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

/**
 * Проверяет строку с хотя бы одним непробельным символом.
 */
export const isNonEmptyString = (value: unknown): value is string => isString(value) && value.trim().length > 0

/**
 * Проверяет массив без проверки элементов.
 */
export const isArray = (value: unknown): value is unknown[] => Array.isArray(value)

/**
 * Проверяет массив и форму каждого элемента переданным предикатом.
 */
export const isArrayOf = <T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] =>
  Array.isArray(value) && value.every(isItem)

/**
 * Считает null, undefined и массив без элементов пустым списком.
 */
export const isEmptyArray = (value: readonly unknown[] | null | undefined): boolean =>
  !Array.isArray(value) || value.length === 0

/**
 * Сужает существующий массив до кортежа с первым элементом.
 */
export const isNonEmptyArray = <T>(value: readonly T[] | null | undefined): value is readonly [T, ...T[]] =>
  Array.isArray(value) && value.length > 0

/**
 * Проверяет объект, исключая null и массивы; поля требуют отдельных проверок.
 */
export const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Проверяет наличие собственного свойства объекта.
 */
export const hasOwn = <K extends PropertyKey>(value: object, key: K): value is Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(value, key)

/**
 * Проверяет принадлежность значению из конечного readonly-набора.
 */
export const isOneOf = <T extends readonly unknown[]>(value: unknown, values: T): value is T[number] =>
  values.some((item) => item === value)
