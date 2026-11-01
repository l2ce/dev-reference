import { createHash } from 'node:crypto'
import { localeSchema, protocolIdSchema, type Locale } from './schema.js'
import {
  entityKey,
  entityServers,
  serverSchema,
  directionSchema,
  type KnowledgeSnapshot,
  type KnowledgeEntity,
  type EntityKind,
  type EntityReference,
  type Server,
  type Direction,
  type Source,
  type ResearchStatus,
  type RecordContent
} from './knowledge-schema.js'
import { validateKnowledge } from './knowledge-validation.js'
import { renderMarkdown, type Directive } from './markdown.js'
import type {
  KnowledgeGap,
  KnowledgeOptions,
  KnowledgeResolution,
  ResolvedReference
} from './knowledge-options.types.js'
import { knowledgeMessages as messages } from './knowledge.messages.js'
export type {
  KnowledgeGap,
  KnowledgeOptions,
  KnowledgeResolution,
  ResolvedReference
} from './knowledge-options.types.js'

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}

export interface ProtocolContext {
  protocolId: string
  locale: Locale
  dataVersion: string
  datasetFingerprint: string
}
export interface KnowledgeContext extends ProtocolContext {
  server: Server
}
type RenderContext = ProtocolContext & { server?: Server }

export interface PageOptions {
  limit?: number
  cursor?: string
}
export interface PacketListOptions extends PageOptions {
  direction?: Direction
}

export class KnowledgeDatabase {
  readonly snapshot: KnowledgeSnapshot
  readonly fingerprint: string
  readonly options: Readonly<
    Required<Pick<KnowledgeOptions, 'maxIncludeDepth' | 'maxDescriptionBytes'>> & KnowledgeOptions
  >
  private readonly entities: Map<string, KnowledgeEntity>
  private readonly documents: Map<string, KnowledgeSnapshot['documents'][number]>
  private readonly profiles: Map<string, KnowledgeSnapshot['protocols'][number]>
  private readonly chronicles: Map<string, KnowledgeSnapshot['chronicles'][number]>

  /**
   * Проверяет и закрепляет неизменяемый снимок, строит индексы и копирует параметры перевода.
   * Чтение не обращается к сети или файлам; некорректные ограничения раскрытия отклоняются.
   */
  constructor(input: unknown, options: KnowledgeOptions = {}) {
    this.snapshot = freeze(validateKnowledge(input))
    this.fingerprint = createHash('sha256').update(JSON.stringify(this.snapshot)).digest('hex')
    this.entities = new Map(this.snapshot.entities.map((entity) => [entityKey(entity), entity]))
    this.documents = new Map(this.snapshot.documents.map((document) => [document.id, document]))
    this.profiles = new Map(this.snapshot.protocols.map((profile) => [profile.id, profile]))
    this.chronicles = new Map(this.snapshot.chronicles.map((chronicle) => [chronicle.id, chronicle]))
    this.options = Object.freeze({
      maxIncludeDepth: 24,
      maxDescriptionBytes: 1024 * 1024,
      ...options,
      untranslatedDocumentIds: Object.freeze([...(options.untranslatedDocumentIds ?? [])])
    })
    for (const value of [this.options.maxIncludeDepth, this.options.maxDescriptionBytes]) {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error(messages.invalidLimits)
      }
    }
  }

  translation(locale: Locale) {
    localeSchema.parse(locale)
    const translation = this.snapshot.translations.find((value) => value.locale === locale)
    if (!translation) throw new Error(`Unknown language base: ${locale}`)
    return translation
  }

  content(
    record: RecordContent & { id: string },
    kind: EntityKind | 'protocol' | 'chronicle',
    locale: Locale
  ): RecordContent | null {
    const translation = this.translation(locale)
    if (locale === this.snapshot.defaultLocale) return record
    return translation.entities.find((item) => item.kind === kind && item.id === record.id) ?? null
  }

  sources(ids: readonly string[]): Source[] {
    return this.snapshot.sources.filter((source) => ids.includes(source.id))
  }

  listProtocols({ locale = this.snapshot.defaultLocale }: { locale?: Locale } = {}) {
    this.translation(locale)
    return {
      dataVersion: this.snapshot.dataVersion,
      datasetFingerprint: this.fingerprint,
      locale,
      items: this.snapshot.protocols.map((profile) => {
        const { title, summary, description, ...technical } = profile
        const content = this.content(profile, 'protocol', locale)
        const chronicle = this.chronicles.get(profile.chronicle)!
        return {
          ...technical,
          title: content?.title ?? null,
          summary: content?.summary ?? null,
          chronicleTitle: this.content(chronicle, 'chronicle', locale)?.title ?? null,
          translationStatus: content ? ('ready' as const) : ('missing' as const)
        }
      })
    }
  }

  forProtocol({ id, locale = this.snapshot.defaultLocale }: { id: string; locale?: Locale }) {
    protocolIdSchema.parse(id)
    this.translation(locale)
    const profile = this.profiles.get(id)
    if (!profile) throw new Error(`Unknown protocol ID: ${id}`)
    return new ProtocolView(
      this,
      profile,
      freeze({
        protocolId: id,
        locale,
        dataVersion: this.snapshot.dataVersion,
        datasetFingerprint: this.fingerprint
      })
    )
  }

  /**
   * Выбирает применимый вариант и его текст в точном контексте профиля, сервера и языка.
   * Неизвестный ID является ошибкой; отсутствие применимости или перевода возвращается как пробел.
   */
  resolve(context: RenderContext, reference: EntityReference): KnowledgeResolution {
    const entity = this.entities.get(entityKey(reference))
    if (!entity) {
      throw new Error(messages.unknownEntity(entityKey(reference)))
    }
    const servers = entityServers(entity)
    const server = reference.server ?? context.server ?? (servers.length === 1 ? servers[0] : undefined)
    if (!server) {
      throw new Error(messages.explicitServer(entityKey(reference)))
    }
    const binding = servers.includes(server)
      ? entity.bindings.find((item) => item.protocolIds.includes(context.protocolId))
      : undefined
    const packetBinding =
      entity.kind === 'packet' && entity.server === server
        ? entity.bindings.find((item) => item.protocolIds.includes(context.protocolId))
        : undefined
    const versionId =
      entity.kind === 'article' && entity.scope === 'general'
        ? entity.documentVersionId
        : (binding?.documentVersionId ?? null)
    let resolution: ResolvedReference['resolution'] = 'unmapped'
    if (!servers.includes(server)) {
      resolution = 'wrong-server'
    } else if (versionId) {
      resolution = 'available'
    }
    const version = versionId && resolution === 'available' ? (this.documents.get(versionId) ?? null) : null
    if (versionId && resolution === 'available' && !version) {
      throw new Error(messages.unknownVersion(versionId))
    }
    const label = this.content(entity, entity.kind, context.locale)
    let document: KnowledgeResolution['document']
    if (version && !this.options.untranslatedDocumentIds?.includes(version.id)) {
      document =
        context.locale === this.snapshot.defaultLocale
          ? version
          : this.translation(context.locale).documents.find((item) => item.id === version.id)
    }
    const target: ResolvedReference = {
      kind: entity.kind,
      id: entity.id,
      server,
      protocolId: context.protocolId,
      locale: context.locale,
      documentVersionId: version?.id ?? null,
      title: label?.title ?? document?.title ?? null,
      resolution,
      translationStatus: document ? 'ready' : 'missing'
    }
    const statuses = [binding?.status, version?.status].filter(Boolean)
    let researchStatus: ResearchStatus = 'missing'
    if (statuses.length && !statuses.includes('missing')) {
      researchStatus = statuses.includes('partial') ? 'partial' : 'documented'
    }
    const gaps: KnowledgeGap[] = []
    /**
     * Добавляет пробел с идентичностью разрешаемого документа и текущим сервером.
     */
    const gap = (code: KnowledgeGap['code']): void => {
      gaps.push({
        code,
        kind: entity.kind,
        id: entity.id,
        server,
        documentVersionId: version?.id ?? null
      })
    }
    if (resolution !== 'available') {
      gap(resolution)
    } else {
      if (!document) {
        gap('translation-missing')
      }
      if (!label) {
        gap('entity-translation-missing')
      }
      if (researchStatus !== 'documented') {
        gap(researchStatus === 'partial' ? 'research-partial' : 'research-missing')
      }
    }
    const introduction = label?.description ?? []
    const description = document
      ? [...introduction, ...(introduction.length && document.description.length ? [''] : []), ...document.description]
      : null
    return {
      entity,
      version,
      document,
      description,
      target,
      gaps,
      meta: {
        ...target,
        summary: label?.summary ?? document?.summary ?? null,
        order: entity.order,
        parentId: entity.parentId,
        researchStatus,
        bindingStatus: binding?.status ?? null,
        documentStatus: version?.status ?? null,
        name: entity.kind === 'packet' ? entity.name : null,
        direction: entity.kind === 'packet' ? entity.direction : null,
        opcode: packetBinding?.opcode ?? null,
        states: packetBinding?.states ?? [],
        ...(entity.kind === 'article' ? { scope: entity.scope } : {})
      },
      sources: this.sources([...new Set([...(binding?.sourceIds ?? []), ...(version?.sourceIds ?? [])])])
    }
  }

  renderDescription(
    context: RenderContext,
    description: string[] | null,
    origin: string,
    sources: Source[],
    initialGaps: KnowledgeGap[]
  ) {
    const references = new Map<string, ResolvedReference>()
    const sourceMap = new Map(sources.map((source) => [source.id, source]))
    const gaps = [...initialGaps]
    let expandedBytes = 0
    const visit = (lines: string[] | null, current: RenderContext, key: string, stack: string[]): string | null => {
      if (!lines?.join('\n').trim()) return null
      if (stack.includes(key)) throw new Error(`Include cycle: ${[...stack, key].join(' -> ')}`)
      if (stack.length >= this.options.maxIncludeDepth) throw new Error('Maximum include depth exceeded')
      const remember = (directive: Directive) => {
        const target = this.resolve(current, directive)
        references.set(`${target.target.server}:${entityKey(target.target)}`, target.target)
        gaps.push(...target.gaps)
        for (const source of target.sources) sourceMap.set(source.id, source)
        return target
      }
      const placeholder = (directive: Directive) =>
        current.locale === 'ru'
          ? `[Сведения недоступны: ${entityKey(directive)}]`
          : `[Information unavailable: ${entityKey(directive)}]`
      const output = renderMarkdown(lines.join('\n'), {
        link: (directive) => {
          const target = remember(directive)
          if (!this.options.renderLink) throw new Error('A renderLink adapter is required to render knowledge links')
          return this.options.renderLink(Object.freeze(target.target))
        },
        include: (directive) => {
          const target = remember(directive)
          return (
            visit(
              target.description,
              { ...current, server: target.target.server },
              `${target.target.server}:${target.version?.id}`,
              [...stack, key]
            ) ?? placeholder(directive)
          )
        },
        value: (directive) => {
          const target = remember(directive)
          let value: string | null = null
          if (directive.field === 'title') value = target.meta.title
          if (directive.field === 'name') value = target.meta.name
          if (directive.field === 'opcode' && target.meta.opcode)
            value = target.meta.opcode.map((part) => part.value).join(' / ')
          if (value === null) {
            gaps.push({
              code: 'value-missing',
              kind: directive.kind,
              id: directive.id,
              server: target.target.server,
              documentVersionId: target.version?.id ?? null
            })
            return placeholder(directive)
          }
          return value
        }
      })
      expandedBytes += Buffer.byteLength(output)
      if (expandedBytes > this.options.maxDescriptionBytes)
        throw new Error('Maximum rendered description size exceeded')
      return output
    }
    const rendered = visit(description, context, origin, [])
    return {
      description: rendered,
      references: [...references.values()],
      sources: [...sourceMap.values()],
      gaps: [...new Map(gaps.map((gap) => [JSON.stringify(gap), gap])).values()]
    }
  }
}

export function createKnowledgeApi(input: unknown, options: KnowledgeOptions = {}) {
  return new KnowledgeDatabase(input, options)
}

export class ProtocolView {
  constructor(
    private readonly database: KnowledgeDatabase,
    private readonly profile: KnowledgeSnapshot['protocols'][number],
    readonly context: Readonly<ProtocolContext>
  ) {
    Object.freeze(this)
  }

  getOverview() {
    const meta = this.database
      .listProtocols({ locale: this.context.locale })
      .items.find((item) => item.id === this.context.protocolId)!
    const content = this.database.content(this.profile, 'protocol', this.context.locale)
    const gaps: KnowledgeGap[] = content
      ? []
      : [
          {
            code: 'translation-missing',
            kind: 'protocol',
            id: this.profile.id,
            documentVersionId: null
          }
        ]
    return {
      context: this.context,
      meta,
      servers: ['login', 'game'] as const,
      ...this.database.renderDescription(
        this.context,
        content?.description ?? null,
        `protocol:${this.profile.id}`,
        this.database.sources(this.profile.sourceIds),
        gaps
      )
    }
  }

  forServer(server: Server) {
    serverSchema.parse(server)
    return new ServerView(this.database, freeze({ ...this.context, server }))
  }
}

export class ServerView {
  constructor(
    private readonly database: KnowledgeDatabase,
    readonly context: Readonly<KnowledgeContext>
  ) {
    Object.freeze(this)
  }

  listPackets(options: PacketListOptions = {}) {
    return this.list('packet', options)
  }
  listScenarios(options: PageOptions = {}) {
    return this.list('scenario', options)
  }
  listArticles(options: PageOptions = {}) {
    return this.list('article', options)
  }

  private list(kind: EntityKind, options: PacketListOptions) {
    const limit = options.limit ?? 50
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Limit must be between 1 and 100')
    if (options.direction) directionSchema.parse(options.direction)
    const signature = JSON.stringify([this.context, kind, options.direction ?? null, limit])
    let offset = 0
    if (options.cursor) {
      try {
        const cursor = JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8'))
        if (cursor.signature !== signature || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0)
          throw new Error()
        offset = cursor.offset
      } catch {
        throw new Error('Cursor does not match this context or snapshot')
      }
    }
    const items = this.database.snapshot.entities
      .filter(
        (entity) =>
          entity.kind === kind &&
          entityServers(entity).includes(this.context.server) &&
          (!options.direction || (entity.kind === 'packet' && entity.direction === options.direction))
      )
      .map((entity) => this.database.resolve(this.context, entity))
      .filter((item) => item.target.resolution === 'available')
      .map((item) => item.meta)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id, 'en'))
    if (offset > items.length) throw new Error('Cursor offset is out of range')
    return {
      context: this.context,
      total: items.length,
      items: items.slice(offset, offset + limit),
      nextCursor:
        offset + limit < items.length
          ? Buffer.from(JSON.stringify({ signature, offset: offset + limit })).toString('base64url')
          : null
    }
  }

  getPacket(id: string) {
    return this.read({ kind: 'packet', id })
  }
  getScenario(id: string) {
    return this.read({ kind: 'scenario', id })
  }
  getArticle(id: string) {
    return this.read({ kind: 'article', id })
  }

  private read(reference: EntityReference) {
    const root = this.database.resolve(this.context, reference)
    const requires = (root.version?.requires ?? []).map((ref) => this.database.resolve(this.context, ref))
    return {
      context: this.context,
      meta: root.meta,
      ...this.database.renderDescription(
        this.context,
        root.description,
        `${this.context.server}:${root.version?.id}`,
        root.sources,
        [...root.gaps, ...requires.flatMap((item) => item.gaps)]
      ),
      changes: root.document?.changes ?? [],
      openQuestions: root.document?.openQuestions ?? [],
      requires: requires.map((item) => item.target)
    }
  }
}

/** Check complete descriptions in every declared context before publishing. */
export function validateKnowledgeRendering(input: unknown): KnowledgeSnapshot {
  const api = createKnowledgeApi(input, {
    renderLink: (target) => `\`${entityKey(target)}\``
  })
  for (const locale of api.snapshot.locales) {
    for (const profile of api.snapshot.protocols) {
      const selected = api.forProtocol({ id: profile.id, locale })
      selected.getOverview()
      for (const server of ['login', 'game'] as const) {
        const view = selected.forServer(server)
        for (const entity of api.snapshot.entities) {
          if (!entityServers(entity).includes(server)) continue
          if (entity.kind === 'packet') view.getPacket(entity.id)
          else if (entity.kind === 'scenario') view.getScenario(entity.id)
          else view.getArticle(entity.id)
        }
      }
    }
  }
  return api.snapshot
}
