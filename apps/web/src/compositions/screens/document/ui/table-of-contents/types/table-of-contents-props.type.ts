import type { Locale } from 'shared/localization'

/**
 * Язык навигации по заголовкам уже отрендеренного документа.
 */
export interface TableOfContentsProps {
  /* Язык подписей оглавления. */
  readonly locale: Locale
  /* Начально свёрнутое оглавление для узкой колонки; по умолчанию раскрыто. */
  readonly collapsed?: boolean
}

/**
 * Заголовок готового HTML, включая якорь для прямой ссылки.
 */
export interface OutlineHeading {
  /* Уникальный HTML-id. */
  readonly id: string
  /* Текст заголовка без разметки. */
  readonly title: string
  /* Признак вложенного уровня h3. */
  readonly nested: boolean
}
