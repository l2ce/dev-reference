import type { JSX } from 'react';
import {
  COLOR_PREFERENCE_RULE,
  COLOR_PREFERENCE_SCRIPT,
  COLOR_PREFERENCE_SHEET,
} from '../../config/color-preference';

/**
 * Применяет сохранённую тему до первого кадра статической страницы.
 *
 * Используется для:
 *  - прямого открытия, перезагрузки и перехода между языковыми root layouts
 */
export const ThemeBootstrap = (): JSX.Element => (
  <>
    <style id={COLOR_PREFERENCE_SHEET}>{COLOR_PREFERENCE_RULE}</style>
    <script
      id="l2ce-theme-bootstrap"
      dangerouslySetInnerHTML={{ __html: COLOR_PREFERENCE_SCRIPT }}
    />
  </>
);
