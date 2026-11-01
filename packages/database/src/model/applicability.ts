import type { ImplementationEntry } from './model.types.js'

/**
 * Возвращает прямую применимость ревизии знаний к профилям.
 * Пустой список означает ещё не установленную применимость.
 */
export function implementationProtocols(entry: ImplementationEntry): readonly string[] {
  return entry.value.protocolKeys
}
