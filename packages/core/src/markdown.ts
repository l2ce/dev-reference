import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, RootContent, PhrasingContent } from 'mdast';
import type { EntityReference } from './knowledge-schema.js';
import { markdownMessages as messages } from './markdown.messages.js';

const parser = unified().use(remarkParse);

export interface Directive extends EntityReference {
  operation: 'link' | 'include' | 'value';
  field?: 'title' | 'opcode' | 'name';
}

/**
 * Проверяет одну директиву и её атрибуты; record является публичным именем article.
 * Некорректный синтаксис, повтор атрибута и отсутствие field у value — ошибки.
 */
function parseDirective(value: string): Directive {
  const match =
    /^\{\{(link|include|value) (packet|scenario|article|record):([a-z][a-z0-9.-]*)(.*?)\}\}$/.exec(
      value,
    );
  if (!match) {
    throw new Error(messages.invalidDirective(value));
  }
  // Группы регулярного выражения ограничивают операцию и тип перечисленными литералами.
  const directive: Directive = {
    operation: match[1] as Directive['operation'],
    kind: (match[2] === 'record' ? 'article' : match[2]) as Directive['kind'],
    id: match[3],
  };
  const seen = new Set<string>();
  for (const attribute of match[4].trim().split(/\s+/).filter(Boolean)) {
    const [key, data, extra] = attribute.split('=');
    if (extra || !data || seen.has(key)) {
      throw new Error(messages.invalidAttribute(attribute));
    }
    seen.add(key);
    if (key === 'server' && (data === 'login' || data === 'game')) {
      directive.server = data;
    } else if (
      key === 'field' &&
      directive.operation === 'value' &&
      ['title', 'opcode', 'name'].includes(data)
    ) {
      // Допустимые значения проверены непосредственно перед присваиванием.
      directive.field = data as Directive['field'];
    } else {
      throw new Error(messages.unsupportedAttribute(attribute));
    }
  }
  if (directive.operation === 'value' && !directive.field) {
    throw new Error(messages.missingField);
  }
  return directive;
}

type Node = Root | RootContent | PhrasingContent;
interface Occurrence {
  directive: Directive;
  start: number;
  end: number;
}

function occurrences(markdown: string): Occurrence[] {
  const result: Occurrence[] = [];
  function visit(node: Node, ancestors: Node[]) {
    if (node.type === 'text') {
      const start = node.position!.start.offset!;
      const end = node.position!.end.offset!;
      const raw = markdown.slice(start, end);
      let offset = 0;
      while (offset < raw.length) {
        const opening = raw.indexOf('{{', offset);
        if (opening === -1) break;
        let slashes = 0;
        for (
          let index = opening - 1;
          index >= 0 && raw[index] === '\\';
          index--
        )
          slashes++;
        if (slashes % 2) {
          offset = opening + 2;
          continue;
        }
        const closing = raw.indexOf('}}', opening + 2);
        if (closing === -1 || raw.slice(opening, closing).includes('\n'))
          throw new Error('Unclosed knowledge directive');
        const token = raw.slice(opening, closing + 2);
        const directive = parseDirective(token);
        const parent = ancestors.at(-1);
        if (
          directive.operation === 'include' &&
          (parent?.type !== 'paragraph' ||
            parent.children.length !== 1 ||
            ancestors.at(-2)?.type !== 'root' ||
            raw.trim() !== token)
        ) {
          throw new Error(
            'Include must occupy its own top-level Markdown paragraph',
          );
        }
        if (
          directive.operation === 'link' &&
          ancestors.some(
            (ancestor) =>
              ancestor.type === 'link' || ancestor.type === 'linkReference',
          )
        )
          throw new Error('Link directive cannot be nested in a Markdown link');
        result.push({
          directive,
          start: start + opening,
          end: start + closing + 2,
        });
        offset = closing + 2;
      }
    }
    if ('children' in node)
      for (const child of node.children) visit(child, [...ancestors, node]);
  }
  visit(parser.parse(markdown) as Root, []);
  return result;
}

/**
 * Извлекает проверенные директивы, сохраняя буквальные шаблоны в коде и экранированном тексте.
 */
export function markdownDirectives(markdown: string): Directive[] {
  return occurrences(markdown).map((item) => item.directive);
}

export interface MarkdownResolver {
  link(directive: Directive): string;
  value(directive: Directive): string;
  include(directive: Directive): string;
}

/** Replace only directives; preserve the author's lines, whitespace and code verbatim. */
export function renderMarkdown(
  markdown: string,
  resolver: MarkdownResolver,
): string {
  const replacements = occurrences(markdown).map((item) => {
    const { directive } = item;
    let value: string;
    if (directive.operation === 'include') value = resolver.include(directive);
    else if (directive.operation === 'value')
      value = resolver.value(directive).replace(/[\\`*_[\]<>]/g, '\\$&');
    else {
      value = resolver.link(directive);
      if (typeof value !== 'string')
        throw new Error('renderLink must return inline Markdown');
      const parsed = parser.parse(value) as Root;
      if (
        parsed.children.length !== 1 ||
        parsed.children[0].type !== 'paragraph' ||
        /[\r\n]/.test(value)
      )
        throw new Error('renderLink must return inline Markdown');
    }
    return { ...item, value };
  });
  let offset = 0;
  const parts: string[] = [];
  for (const item of replacements) {
    parts.push(markdown.slice(offset, item.start), item.value);
    offset = item.end;
  }
  parts.push(markdown.slice(offset));
  return parts.join('');
}
