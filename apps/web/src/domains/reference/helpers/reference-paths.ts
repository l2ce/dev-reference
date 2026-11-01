import type { Locale } from 'shared/localization';
import { localePath } from 'shared/localization';
import { referenceErrors } from '../config/messages';

/**
 * Строит ссылку на точный профиль; next/link добавляет basePath самостоятельно.
 */
export function protocolPath(locale: Locale, protocol: string): string {
  return localePath(
    locale,
    `/protocols/${encodeURIComponent(protocol.replace(/^protocol:/, ''))}/`,
  );
}

/**
 * Строит контекстную ссылку на логическую карточку знания.
 */
export function documentPath(
  locale: Locale,
  protocol: string,
  key: string,
): string {
  const match =
    /^(packet|scenario|article):([a-z0-9]+(?:[.-][a-z0-9]+)*)$/.exec(key);
  if (!match) {
    throw new Error(referenceErrors.key);
  }
  return `${protocolPath(locale, protocol)}${match[1]}/${match[2]}/`;
}
