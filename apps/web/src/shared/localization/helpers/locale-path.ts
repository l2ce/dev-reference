import type { Locale } from '../types/locale.type';

/**
 * Строит локальный URL: английский без префикса, русский под /ru/.
 * Путь не содержит basePath; next/link добавляет его самостоятельно.
 */
export function localePath(locale: Locale, path = '/'): string {
  return `${locale === 'en' ? '' : '/ru'}${path}`;
}

/**
 * Переключает язык известного пути, сохраняя профиль и карточку документа.
 */
export function changePathLocale(path: string, locale: Locale): string {
  const localPath = path.replace(/^\/ru(?=\/|$)/, '') || '/';
  return localePath(locale, localPath);
}
