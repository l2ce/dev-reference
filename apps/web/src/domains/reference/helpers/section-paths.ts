import type { ReferenceDocument } from '@l2ce/core/reference';
import type { Locale } from 'shared/localization';
import type {
  ProtocolTarget,
  ReferenceLocation,
} from '../types/navigation.type';
import { documentPath, protocolPath } from './reference-paths';

/**
 * Стабильные адреса самостоятельных разделов базы знаний.
 */
export const KNOWLEDGE_SECTIONS = [
  { kind: 'article', slug: 'articles' },
  { kind: 'scenario', slug: 'scenarios' },
  { kind: 'packet', slug: 'packets' },
] as const;

/**
 * Строит адрес каталога одного вида документов.
 */
export function sectionPath(
  locale: Locale,
  protocol: string,
  kind: ReferenceDocument['kind'],
): string {
  const section = KNOWLEDGE_SECTIONS.find((entry) => entry.kind === kind);
  return `${protocolPath(locale, protocol)}${section?.slug}/`;
}

/**
 * Определяет выбранный раздел и логическую карточку из локального URL.
 */
export function getReferenceLocation(pathname: string): ReferenceLocation {
  const match = /\/protocols\/[^/]+\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname);
  const section = KNOWLEDGE_SECTIONS.find(
    (entry) => entry.slug === match?.[1] || entry.kind === match?.[1],
  );
  if (section === undefined) {
    return {};
  }
  return {
    kind: section.kind,
    documentKey:
      match?.[2] === undefined ? undefined : `${section.kind}:${match[2]}`,
  };
}

/**
 * При смене профиля сохраняет выбранный раздел либо явно применимый документ.
 */
export function resolveProtocolTarget(
  target: ProtocolTarget,
  locale: Locale,
  location: ReferenceLocation,
): string {
  if (location.documentKey !== undefined) {
    if (target.documentKeys.includes(location.documentKey)) {
      return documentPath(locale, target.value, location.documentKey);
    }
    return `${target.href}?unavailable=${encodeURIComponent(location.documentKey)}`;
  }
  return location.kind === undefined
    ? target.href
    : sectionPath(locale, target.value, location.kind);
}
