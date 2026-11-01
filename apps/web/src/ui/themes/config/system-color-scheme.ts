import type { MantineColorScheme, MantineColorSchemeManager } from '@mantine/core'
import { COLOR_PREFERENCE_KEY } from './color-preference'
import { applyColorPreference } from '../operations/apply-color-preference'

/**
 * Очистка подписки единственного экземпляра темы в текущем документе.
 */
let unsubscribe = (): void => {}

/**
 * Проверяет сохранённый выбор; незнакомое значение означает системный режим.
 */
function parseColorScheme(value: string | null): MantineColorScheme {
  return value === 'light' || value === 'dark' ? value : 'auto'
}

/**
 * Сохраняет явный выбор и восстанавливает его только после гидратации.
 * Недоступность browser storage не мешает переключению в текущей вкладке.
 */
export const systemColorSchemeManager: MantineColorSchemeManager = {
  /**
   * Возвращает один и тот же режим на сервере и при гидратации.
   */
  get: (): MantineColorScheme => 'auto',
  /**
   * Сохраняет выбранный режим при доступном хранилище браузера.
   */
  set(value): void {
    applyColorPreference(value)
    try {
      window.localStorage.setItem(COLOR_PREFERENCE_KEY, value)
    } catch {
      /* Storage может быть запрещён настройками браузера. */
    }
  },
  /**
   * Восстанавливает настройку после mount и подписывается на другие вкладки.
   */
  subscribe(listener): void {
    try {
      listener(parseColorScheme(window.localStorage.getItem(COLOR_PREFERENCE_KEY)))
    } catch {
      /* Сохраняется доступный системный режим. */
    }
    /**
     * Синхронизирует явный выбор, изменённый в другой вкладке.
     */
    const handleStorage = (event: StorageEvent): void => {
      if (event.key === COLOR_PREFERENCE_KEY || event.key === null) {
        listener(parseColorScheme(event.newValue))
      }
    }
    window.addEventListener('storage', handleStorage)
    unsubscribe = (): void => window.removeEventListener('storage', handleStorage)
  },
  /**
   * Освобождает подписку при закрытии провайдера.
   */
  unsubscribe(): void {
    unsubscribe()
  },
  /**
   * Возвращает сохранённую настройку к системному режиму.
   */
  clear(): void {
    applyColorPreference('auto')
    try {
      window.localStorage.removeItem(COLOR_PREFERENCE_KEY)
    } catch {
      /* Необязательное хранилище. */
    }
  }
}
