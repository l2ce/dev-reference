import { DatabaseError, snapshotRevision } from '@l2ce/database/model';
import type {
  DatabaseSnapshot,
  DatabaseEntry,
  EntityEntry,
  ImplementationEntry,
  Translation,
} from '@l2ce/database';
import {
  referenceCatalogSchema,
  referenceProtocolsSchema,
  referenceKnowledgeSchema,
  referenceReadSchema,
  referenceKindSchema,
  protocolReferenceSchema,
} from './reference-schema.js';
import { referenceMessages as messages } from './reference.messages.js';
import type {
  ReferenceCatalogItem,
  ReferenceCatalogSummary,
  ReferenceCatalogQuery,
  ReferenceDocument,
  ReferenceKnowledgeQuery,
  ReferencePage,
  ReferenceProtocolsQuery,
  ReferenceReadQuery,
  ReferenceSummary,
  ReferenceProtocol,
  ReferenceReadResult,
} from './reference.types.js';

/**
 * Нормализует короткий публичный адрес, сохраняя наш суффикс протокола.
 */
export function referenceKey(kind: string, value: string): string {
  return value.startsWith(`${kind}:`) ? value : `${kind}:${value}`;
}

/**
 * Сопоставляет произвольный Unicode-текст с поисковой строкой.
 */
function matches(
  query: string | undefined,
  values: readonly (string | null)[],
): boolean {
  const normalized = (query ?? '').normalize('NFKC').toLowerCase();
  return values.some((value) =>
    (value ?? '').normalize('NFKC').toLowerCase().includes(normalized),
  );
}

/**
 * Получает перевод без языкового fallback; missing не публикует сохранённый черновик текста.
 */
function translationFor(
  entry: DatabaseEntry,
  locale: string,
): Translation | undefined {
  return 'translations' in entry.value
    ? entry.value.translations.find((value) => value.locale === locale)
    : undefined;
}

/**
 * Определяет карточку, которой принадлежит техническая редакция.
 */
function ownerKey(entry: ImplementationEntry): string {
  switch (entry.collection) {
    case 'packet-revisions':
      return entry.value.packetKey;
    case 'scenario-revisions':
      return entry.value.scenarioKey;
    case 'article-revisions':
      return entry.value.articleKey;
  }
}

/**
 * Продуктовое представление одного неизменяемого снимка. Повторные чтения не обращаются к SQL.
 */
export class ReferenceReader {
  /* Собственная копия снимка, защищённая от изменений вызывающей стороны. */
  private readonly snapshot: DatabaseSnapshot;
  /* Общие записи по читаемому ключу. */
  private readonly entries: ReadonlyMap<string, DatabaseEntry>;
  /* Однозначный индекс протокол/карточка → редакция. */
  private readonly applicable: ReadonlyMap<string, ImplementationEntry>;
  /* Ревизия всего основания чтения. */
  readonly revision: string;

  /**
   * Принимает проверенный снимок API базы и индексирует применимость один раз.
   */
  constructor(snapshot: DatabaseSnapshot) {
    this.snapshot = structuredClone(snapshot);
    this.revision = snapshotRevision(this.snapshot);
    this.entries = new Map(
      this.snapshot.entries.map((entry) => [entry.key, entry]),
    );
    const applicable = new Map<string, ImplementationEntry>();
    for (const entry of this.snapshot.entries) {
      if (entry.kind === 'implementation') {
        for (const protocol of entry.value.protocolKeys) {
          applicable.set(`${protocol}/${ownerKey(entry)}`, entry);
        }
      }
    }
    this.applicable = applicable;
  }

  /**
   * Выбирает объявленный язык; значение по умолчанию берётся из метаданных снимка.
   */
  private locale(value?: string): string {
    const locale = value ?? this.snapshot.defaultLocale;
    if (!this.snapshot.locales.includes(locale)) {
      throw new DatabaseError('INVALID_QUERY', messages.locale, { locale });
    }
    return locale;
  }

  /**
   * Требует точный профиль; неизвестный номер не превращается в пустой каталог.
   */
  private requireProtocol(
    value: string,
  ): EntityEntry & { collection: 'protocols' } {
    const key = referenceKey('protocol', protocolReferenceSchema.parse(value));
    const entry = this.entries.get(key);
    if (!entry || entry.collection !== 'protocols') {
      throw new DatabaseError('NOT_FOUND', messages.protocol, { key });
    }
    return entry;
  }

  /**
   * Формирует страницу после всех фильтров; порядок определяется читаемым ключом.
   */
  private page<T extends { readonly key: string }>(
    items: T[],
    limit: number,
    offset: number,
  ): ReferencePage<T> {
    items.sort((a, b) => a.key.localeCompare(b.key, 'en'));
    return {
      revision: this.revision,
      total: items.length,
      nextOffset: offset + limit < items.length ? offset + limit : null,
      items: structuredClone(items.slice(offset, offset + limit)),
    };
  }

  /**
   * Собирает краткую языковую карточку каталога с исходными предметными связями.
   */
  private catalogItem(
    entry: EntityEntry,
    locale: string,
  ): ReferenceCatalogItem {
    const text = translationFor(entry, locale);
    const readable = text && text.translationStatus !== 'missing';
    const value = entry.value;
    return {
      key: entry.key,
      locale,
      title: readable && text.title ? text.title : entry.key,
      summary: readable ? text.summary : null,
      markdown: readable ? text.description : null,
      translationStatus: text?.translationStatus ?? 'missing',
      sources: text?.source ?? [],
      ...('number' in value
        ? { number: value.number, variant: value.variant }
        : {}),
      ...('status' in value ? { status: value.status } : {}),
      ...('branchKey' in value ? { branchKey: value.branchKey } : {}),
      ...('chronicleKey' in value
        ? { chronicleKey: value.chronicleKey, protocolKeys: value.protocolKeys }
        : {}),
    };
  }

  /**
   * Читает вспомогательный каталог; неподходящие фильтры отклоняются.
   */
  catalog(
    input: ReferenceCatalogQuery,
  ): ReferencePage<ReferenceCatalogSummary> {
    const query = referenceCatalogSchema.parse(input);
    const locale = this.locale(query.locale);
    if (
      (query.branch && query.collection !== 'chronicles') ||
      (query.chronicle && query.collection !== 'chronicle-releases')
    ) {
      throw new DatabaseError('INVALID_QUERY', messages.query);
    }
    const items = this.snapshot.entries
      .filter(
        (entry): entry is EntityEntry =>
          entry.kind === 'entity' && entry.collection === query.collection,
      )
      .filter(
        (entry) =>
          !query.branch ||
          ('branchKey' in entry.value &&
            entry.value.branchKey === referenceKey('branch', query.branch)),
      )
      .filter(
        (entry) =>
          !query.chronicle ||
          ('chronicleKey' in entry.value &&
            entry.value.chronicleKey ===
              referenceKey('chronicle', query.chronicle)),
      )
      .map((entry) => this.catalogItem(entry, locale))
      .filter((item) =>
        matches(query.query, [item.key, item.title, item.summary]),
      )
      .map(({ markdown: _markdown, sources: _sources, ...summary }) => summary);
    return this.page(items, query.limit, query.offset);
  }

  /**
   * Находит протоколы по номеру и историческому контексту, сохраняя варианты одинакового номера.
   */
  protocols(
    input: ReferenceProtocolsQuery = {},
  ): ReferencePage<ReferenceCatalogSummary> {
    const query = referenceProtocolsSchema.parse(input);
    const locale = this.locale(query.locale);
    const releases = this.snapshot.entries
      .filter((entry) => entry.collection === 'chronicle-releases')
      .filter(
        (entry) =>
          !query.release ||
          entry.key === referenceKey('chronicle', query.release),
      )
      .filter(
        (entry) =>
          !query.chronicle ||
          entry.value.chronicleKey ===
            referenceKey('chronicle', query.chronicle),
      )
      .filter((entry) => {
        const chronicle = this.entries.get(entry.value.chronicleKey);
        return (
          !query.branch ||
          (chronicle?.collection === 'chronicles' &&
            chronicle.value.branchKey === referenceKey('branch', query.branch))
        );
      });
    const permitted = new Set(
      releases.flatMap((entry) => entry.value.protocolKeys),
    );
    const items = this.snapshot.entries
      .filter((entry) => entry.collection === 'protocols')
      .filter(
        (entry) =>
          query.number === undefined || entry.value.number === query.number,
      )
      .filter(
        (entry) =>
          !(query.branch || query.chronicle || query.release) ||
          permitted.has(entry.key),
      )
      .map((entry) => this.catalogItem(entry, locale))
      .filter((item) =>
        matches(query.query, [item.key, item.title, item.summary]),
      )
      .map(({ markdown: _markdown, sources: _sources, ...summary }) => summary);
    return this.page(items, query.limit, query.offset);
  }

  /**
   * Читает точный профиль с его выпусками и техническими признаками.
   */
  protocol(value: string, requestedLocale?: string): ReferenceProtocol {
    const entry = this.requireProtocol(value);
    const locale = this.locale(requestedLocale);
    return structuredClone({
      revision: this.revision,
      profile: this.catalogItem(entry, locale),
      regions: entry.value.regions,
      loginRevisions: entry.value.loginRevisions,
      releases: this.snapshot.entries
        .filter((release) => release.collection === 'chronicle-releases')
        .filter((release) => release.value.protocolKeys.includes(entry.key))
        .map((release) => this.catalogItem(release, locale)),
    });
  }

  /**
   * Читает один перевод вспомогательной карточки по полному ключу.
   */
  catalogRecord(key: string, requestedLocale?: string): ReferenceCatalogItem {
    const entry = this.entries.get(key);
    if (
      !entry ||
      entry.kind !== 'entity' ||
      !['branches', 'chronicles', 'chronicle-releases'].includes(
        entry.collection,
      )
    ) {
      throw new DatabaseError('NOT_FOUND', messages.record, { key });
    }
    return structuredClone(
      this.catalogItem(entry, this.locale(requestedLocale)),
    );
  }

  /**
   * Читает одно логическое знание строго в заданном профиле; пробелы возвращаются явно.
   */
  private document(
    key: string,
    protocol: string,
    locale: string,
  ): ReferenceDocument {
    const kind = referenceKindSchema.parse(key.split(':')[0]);
    const card = this.entries.get(key);
    const revision = this.applicable.get(`${protocol}/${key}`);
    const text = revision ? translationFor(revision, locale) : undefined;
    const readable = text && text.translationStatus !== 'missing';
    let availability: ReferenceDocument['availability'] = 'available';
    if (!card) {
      availability = 'not-found';
    } else if (!revision) {
      availability = 'unmapped';
    } else if (!readable) {
      availability = 'translation-missing';
    }
    let title = key;
    let servers: ReferenceDocument['servers'] = [];
    if (card?.collection === 'packets') {
      title = card.value.name;
      servers = [card.value.server];
    } else if (card && 'servers' in card.value) {
      servers = card.value.servers;
    }
    if (readable && text.title) {
      title = text.title;
    }
    return {
      key,
      kind,
      protocol,
      locale,
      revisionKey: revision?.key ?? null,
      availability,
      title,
      summary: readable ? text.summary : null,
      markdown: readable ? text.description : null,
      status: revision?.value.status ?? null,
      translationStatus: text?.translationStatus ?? 'missing',
      sources: text?.source ?? [],
      openQuestions: text?.openQuestions ?? [],
      servers,
      direction: card?.collection === 'packets' ? card.value.direction : null,
      opcode:
        revision?.collection === 'packet-revisions'
          ? revision.value.opcode
          : null,
      states:
        revision?.collection === 'packet-revisions'
          ? revision.value.states
          : [],
    };
  }

  /**
   * Читает до 50 знаний одним снимком; отсутствующие карточки представлены отдельными результатами.
   */
  read(input: ReferenceReadQuery): ReferenceReadResult {
    const query = referenceReadSchema.parse(input);
    const profile = this.requireProtocol(query.protocol);
    const locale = this.locale(query.locale);
    return structuredClone({
      revision: this.revision,
      items: query.keys.map((key) => this.document(key, profile.key, locale)),
    });
  }

  /**
   * Ищет в заголовках, аннотациях и Markdown выбранного языка среди применимых знаний.
   */
  knowledge(input: ReferenceKnowledgeQuery): ReferencePage<ReferenceSummary> {
    const query = referenceKnowledgeSchema.parse(input);
    const protocol = this.requireProtocol(query.protocol).key;
    const locale = this.locale(query.locale);
    if (query.direction && query.kind && query.kind !== 'packet') {
      throw new DatabaseError('INVALID_QUERY', messages.query);
    }
    const items: ReferenceSummary[] = [];
    for (const entry of this.snapshot.entries) {
      if (
        entry.kind !== 'entity' ||
        !['packets', 'scenarios', 'articles'].includes(entry.collection) ||
        !this.applicable.has(`${protocol}/${entry.key}`)
      ) {
        continue;
      }
      const document = this.document(entry.key, protocol, locale);
      if (query.kind && document.kind !== query.kind) {
        continue;
      }
      if (query.status && document.status !== query.status) {
        continue;
      }
      if (query.server && !document.servers.includes(query.server)) {
        continue;
      }
      if (query.direction && document.direction !== query.direction) {
        continue;
      }
      if (
        !matches(query.query, [
          document.key,
          document.title,
          document.summary,
          document.markdown,
        ])
      ) {
        continue;
      }
      const {
        markdown: _markdown,
        sources: _sources,
        openQuestions: _questions,
        ...summary
      } = document;
      items.push(summary);
    }
    return this.page(items, query.limit, query.offset);
  }
}
