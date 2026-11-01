import { renderMarkdown } from '@l2ce/core/markdown';
import type { Directive } from '@l2ce/core/markdown';
import type { ReferenceDocument, ReferenceReader } from '@l2ce/core/reference';
import { isDefined } from 'shared/lib/value-predicates';
import type { Locale } from 'shared/localization';
import { referenceErrors, referenceMessages } from '../config/messages';
import type { PreparedDocument } from '../types/reference.type';
import { documentPath } from './reference-paths';

/**
 * Экранирует подпись для безопасной вставки в Markdown-ссылку.
 */
function escapeLabel(value: string): string {
  return value.replace(/[\\`*_[\]<>]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

/**
 * Разрешает директивы через текущую модель без подстановки другого профиля/языка.
 * Циклы и недоступные вставки остаются видимыми; повреждённый синтаксис прерывает сборку.
 */
export function prepareDocument(
  reader: ReferenceReader,
  protocol: string,
  locale: Locale,
  key: string,
  basePath: string,
  packetNames: ReadonlyMap<string, string> = new Map(),
): PreparedDocument {
  const messages = referenceMessages[locale];
  const issues = new Set<string>();
  const sources = new Map<string, ReferenceDocument['sources'][number]>();

  /**
   * Читает один ожидаемый результат, отличая дефект API от отсутствия знания.
   */
  function read(keyToRead: string): ReferenceDocument {
    const document = reader.read({ protocol, locale, keys: [keyToRead] })
      .items[0];
    if (!document) {
      throw new Error(referenceErrors.document);
    }
    return document;
  }

  /**
   * Проверяет контекст ссылки и явно сообщает о неприменимой карточке.
   */
  function resolve(directive: Directive): ReferenceDocument | null {
    const target = read(`${directive.kind}:${directive.id}`);
    const isWrongServer =
      isDefined(directive.server) && !target.servers.includes(directive.server);
    if (target.availability !== 'available' || isWrongServer) {
      issues.add(`${messages.unresolved}: ${target.key}`);
      return null;
    }
    return target;
  }

  /**
   * Разворачивает вставки, сохраняя источники и проверяя текущий стек включений.
   */
  function expand(
    document: ReferenceDocument,
    ancestors: readonly string[],
  ): string {
    if (ancestors.includes(document.key)) {
      const issue = `${messages.cycle}: ${[...ancestors, document.key].join(' → ')}`;
      issues.add(issue);
      return issue;
    }
    for (const source of document.sources) {
      sources.set(source.id, source);
    }
    return renderMarkdown(document.markdown ?? '', {
      /**
       * Создаёт ссылку с basePath для обычного Markdown-якоря.
       */
      link(directive): string {
        const target = resolve(directive);
        if (!target) {
          return escapeLabel(
            `${messages.unresolved}: ${directive.kind}:${directive.id}`,
          );
        }
        return `[${escapeLabel(target.title)}](${basePath}${documentPath(locale, protocol, target.key)})`;
      },
      /**
       * Читает установленное значение без выдуманного опкода.
       */
      value(directive): string {
        const target = resolve(directive);
        if (!target) {
          return messages.unknownValue;
        }
        if (directive.field === 'opcode') {
          return (
            target.opcode
              ?.map((part) => `0x${part.value.toString(16).toUpperCase()}`)
              .join(' / ') ?? messages.unknownValue
          );
        }
        return directive.field === 'name'
          ? (packetNames.get(target.key) ?? messages.unknownValue)
          : target.title;
      },
      /**
       * Вставляет только текст точного контекста, с явным указанием неполноты.
       */
      include(directive): string {
        const target = resolve(directive);
        if (!target) {
          return `${messages.unresolved}: ${directive.kind}:${directive.id}`;
        }
        const status = target.status
          ? messages.status[target.status]
          : messages.unknownValue;
        const questions = target.openQuestions
          .map((question) => `- ${question}`)
          .join('\n');
        return `> ${target.title} · ${status} · ${messages.translation[target.translationStatus]}\n\n${expand(target, [...ancestors, document.key])}\n\n${questions}`;
      },
    });
  }

  const document = read(key);
  const markdown = expand(document, []);
  return {
    document,
    markdown,
    issues: [...issues],
    sources: [...sources.values()],
  };
}
