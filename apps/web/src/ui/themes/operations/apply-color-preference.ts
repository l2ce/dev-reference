import { COLOR_PREFERENCE_SHEET } from '../config/color-preference'

/**
 * Синхронизирует раннее CSSOM-правило с действием пользователя после гидратации.
 */
export function applyColorPreference(value: 'light' | 'dark' | 'auto'): void {
  const element = document.getElementById(COLOR_PREFERENCE_SHEET)
  if (!(element instanceof HTMLStyleElement)) {
    return
  }
  const rule = element.sheet?.cssRules[0]
  if (rule instanceof CSSStyleRule) {
    rule.style.setProperty('color-scheme', value === 'auto' ? 'light dark' : value, 'important')
  }
}
