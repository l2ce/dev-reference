import { useSyncExternalStore } from 'react';
import type { OutlineHeading } from '../types/table-of-contents-props.type';

const EMPTY_HEADINGS: readonly OutlineHeading[] = [];
let cachedHeadings: readonly OutlineHeading[] = EMPTY_HEADINGS;
let cachedSignature = '';

/**
 * Читает заголовки готового документа; сохраняет ссылку снимка без изменений DOM.
 */
function readHeadings(): readonly OutlineHeading[] {
  const headings = Array.from(
    document.querySelectorAll('#document-body h2[id], #document-body h3[id]'),
  ).map((element) => ({
    id: element.id,
    title: element.textContent ?? '',
    nested: element.tagName === 'H3',
  }));
  const signature = JSON.stringify(headings);
  if (signature !== cachedSignature) {
    cachedSignature = signature;
    cachedHeadings = headings;
  }
  return cachedHeadings;
}

/**
 * Следит за заменой серверного содержимого при клиентской навигации.
 */
function subscribeOutline(notify: () => void): () => void {
  const observer = new MutationObserver(notify);
  observer.observe(document.body, { childList: true, subtree: true });
  return (): void => observer.disconnect();
}

/**
 * Даёт одинаковое пустое оглавление серверу и первоначальной гидратации.
 */
function serverHeadings(): readonly OutlineHeading[] {
  return EMPTY_HEADINGS;
}

/**
 * Подключает оглавление к настоящим HTML-якорям без повторного разбора Markdown.
 */
export function useDocumentOutline(): readonly OutlineHeading[] {
  return useSyncExternalStore(subscribeOutline, readHeadings, serverHeadings);
}
