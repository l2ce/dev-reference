/**
 * Ключ явного выбора темы; значения light/dark, отсутствие либо auto означает систему.
 */
export const COLOR_PREFERENCE_KEY = 'l2ce-color-scheme';

/**
 * Стабильный ID таблицы стилей, доступной до первого кадра и после гидратации.
 */
export const COLOR_PREFERENCE_SHEET = 'l2ce-color-preference';

/**
 * Исходное CSS-правило одинаково на сервере и клиенте.
 * Приоритет защищает нативную палитру от временного системного атрибута Mantine.
 */
export const COLOR_PREFERENCE_RULE = ':root{color-scheme:light dark!important}';

/**
 * Синхронный head-bootstrap меняет CSSOM, не меняя DOM или ожидаемые React-атрибуты.
 * Исполняется до body; отсутствие storage сохраняет системную тему.
 */
export const COLOR_PREFERENCE_SCRIPT = `(function(){try{var value=localStorage.getItem(${JSON.stringify(COLOR_PREFERENCE_KEY)});if(value==='light'||value==='dark'){var sheet=document.getElementById(${JSON.stringify(COLOR_PREFERENCE_SHEET)}).sheet;sheet.cssRules[0].style.setProperty('color-scheme',value,'important')}}catch{}})();`;

/**
 * Системная цветовая схема начального HTML.
 */
export const SYSTEM_COLOR_SCHEME = 'light dark';
