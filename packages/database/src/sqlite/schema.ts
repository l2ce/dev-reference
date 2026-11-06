import { sql } from 'drizzle-orm'
import { check, foreignKey, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { DeclaredTable } from './schema.types.js'
import {
  locales,
  commonFields,
  navigationFields,
  researchFields,
  implementationFields,
  implementationProtocolFields
} from './schema-columns.js'
import type { Source } from '../model/model.types.js'
export { locales } from './schema-columns.js'

/**
 * Версия структуры и настройки единой многоязычной базы.
 */
export const metadata = sqliteTable(
  'metadata',
  {
    id: integer('id').primaryKey().notNull(),
    schemaVersion: integer('schema_rev').notNull(),
    dataVersion: text('data_version').notNull(),
    defaultLocale: text('default_locale')
      .notNull()
      .references(() => locales.code)
  },
  (t) => [check('metadata_singleton', sql`${t.id} = 1`), check('metadata_version', sql`${t.schemaVersion} = 21`)]
)

export const branches = sqliteTable('branches', { ...commonFields, ...navigationFields }, (t) => [unique().on(t.code)])
/**
 * Историческая группа хроник одной ветки, независимая от релизных адресов.
 */
export const sagas = sqliteTable(
  'sagas',
  {
    ...commonFields,
    ...navigationFields,
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id)
  },
  (t) => [unique().on(t.code)]
)
export const regions = sqliteTable('regions', { ...commonFields, ...navigationFields }, (t) => [unique().on(t.code)])
export const countries = sqliteTable('countries', { ...commonFields, ...navigationFields }, (t) => [
  unique().on(t.code)
])
export const chronicles = sqliteTable(
  'chronicles',
  {
    ...commonFields,
    ...navigationFields,
    branchId: text('branch_id')
      .notNull()
      .references(() => branches.id),
    sagaId: text('saga_id').references(() => sagas.id)
  },
  (t) => [unique().on(t.code)]
)
export const releases = sqliteTable(
  'releases',
  {
    ...commonFields,
    ...navigationFields,
    ...researchFields,
    chronicleId: text('chronicle_id')
      .notNull()
      .references(() => chronicles.id)
  },
  (t) => [unique().on(t.code), check('release_status', sql`${t.status} IN ('missing', 'partial', 'documented')`)]
)
export const protocols = sqliteTable(
  'protocols',
  {
    ...commonFields,
    ...researchFields,
    number: integer('number').notNull(),
    variant: integer('variant').notNull()
  },
  (t) => [
    unique().on(t.number, t.variant),
    check('protocol_number', sql`${t.number} >= 0 AND ${t.number} <= 9007199254740991`),
    check('protocol_variant', sql`${t.variant} >= 0 AND ${t.variant} <= 9007199254740991`),
    check('protocol_status', sql`${t.status} IN ('missing', 'partial', 'documented')`)
  ]
)
/**
 * Регион и календарная дата принадлежат выпуску, а не техническому протоколу.
 */
export const releaseContexts = sqliteTable(
  'release_contexts',
  {
    ...commonFields,
    ...navigationFields,
    ...researchFields,
    releaseId: text('release_id')
      .notNull()
      .references(() => releases.id),
    regionId: text('region_id').references(() => regions.id),
    releasedOn: text('released_on')
  },
  (t) => [
    unique().on(t.releaseId, t.code),
    check('context_status', sql`${t.status} IN ('missing', 'partial', 'documented')`),
    check(
      'context_date',
      sql`${t.releasedOn} IS NULL OR (length(${t.releasedOn}) IN (4, 7, 10) AND substr(${t.releasedOn}, 1, 4) GLOB '[0-9][0-9][0-9][0-9]')`
    )
  ]
)
export const releaseContextProtocols = sqliteTable(
  'release_context_protocols',
  {
    contextId: text('release_context_id')
      .notNull()
      .references(() => releaseContexts.id, { onDelete: 'cascade' }),
    protocolId: text('protocol_id')
      .notNull()
      .references(() => protocols.id),
    position: integer('position').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.contextId, t.protocolId] }),
    unique().on(t.contextId, t.position),
    check('context_protocol_position', sql`${t.position} >= 0`)
  ]
)
export const releaseContextCountries = sqliteTable(
  'release_context_countries',
  {
    contextId: text('release_context_id')
      .notNull()
      .references(() => releaseContexts.id, { onDelete: 'cascade' }),
    countryId: text('country_id')
      .notNull()
      .references(() => countries.id),
    position: integer('position').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.contextId, t.countryId] }),
    unique().on(t.contextId, t.position),
    check('context_country_position', sql`${t.position} >= 0`)
  ]
)
export const packets = sqliteTable(
  'packets',
  {
    ...commonFields,
    ...navigationFields,
    name: text('name').notNull(),
    server: text('server', { enum: ['login', 'game'] }).notNull(),
    direction: text('direction', {
      enum: ['client-to-server', 'server-to-client']
    }).notNull()
  },
  (t) => [
    unique().on(t.code),
    check('packet_server', sql`${t.server} IN ('login', 'game')`),
    check('packet_direction', sql`${t.direction} IN ('client-to-server', 'server-to-client')`)
  ]
)
export const scenarios = sqliteTable('scenarios', { ...commonFields, ...navigationFields }, (t) => [
  unique().on(t.code)
])
export const articles = sqliteTable('articles', { ...commonFields, ...navigationFields }, (t) => [unique().on(t.code)])

/**
 * Объявляет технические редакции с предметным FK и уникальным номером внутри карточки.
 */
function revisionTable(
  name: string,
  owner: typeof packets | typeof scenarios | typeof articles,
  column: string
): DeclaredTable<typeof implementationFields> {
  return sqliteTable(
    name,
    {
      ...implementationFields,
      ownerId: text(column)
        .notNull()
        .references(() => owner.id)
    },
    (t) => [
      unique().on(t.ownerId, t.id),
      unique().on(t.ownerId, t.rev),
      check(`${name}_rev`, sql`${t.rev} > 0 AND ${t.rev} <= 9007199254740991`),
      check(`${name}_status`, sql`${t.status} IN ('missing', 'partial', 'documented')`)
    ]
  )
}
export const packetRevisions = revisionTable('packet_revisions', packets, 'packet_id')
export const scenarioRevisions = revisionTable('scenario_revisions', scenarios, 'scenario_id')
export const articleRevisions = revisionTable('article_revisions', articles, 'article_id')

export const releaseProtocols = sqliteTable(
  'release_protocols',
  {
    releaseId: text('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    protocolId: text('protocol_id')
      .notNull()
      .references(() => protocols.id),
    position: integer('position').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.releaseId, t.protocolId] }),
    unique().on(t.releaseId, t.position),
    check('release_protocol_position', sql`${t.position} >= 0`)
  ]
)

/**
 * Пара карточка/протокол выбирает одну редакцию; составной FK проверяет её владельца.
 */
function applicabilityTable(
  name: string,
  revisions: DeclaredTable<typeof implementationFields>,
  ownerColumn: string,
  revisionColumn: string
): DeclaredTable<typeof implementationProtocolFields> {
  return sqliteTable(
    name,
    {
      ...implementationProtocolFields,
      ownerId: text(ownerColumn).notNull(),
      implementationId: text(revisionColumn).notNull(),
      protocolId: text('protocol_id')
        .notNull()
        .references(() => protocols.id)
    },
    (t) => [
      primaryKey({ columns: [t.ownerId, t.protocolId] }),
      unique().on(t.implementationId, t.position),
      foreignKey({
        columns: [t.ownerId, t.implementationId],
        foreignColumns: [revisions.ownerId, revisions.id]
      }).onDelete('cascade'),
      check(`${name}_position`, sql`${t.position} >= 0`)
    ]
  )
}
export const packetProtocols = applicabilityTable(
  'packet_protocols',
  packetRevisions,
  'packet_id',
  'packet_revision_id'
)
export const scenarioProtocols = applicabilityTable(
  'scenario_protocols',
  scenarioRevisions,
  'scenario_id',
  'scenario_revision_id'
)
export const articleProtocols = applicabilityTable(
  'article_protocols',
  articleRevisions,
  'article_id',
  'article_revision_id'
)

const translationOwnerColumn: string = 'packet_revision_id'
const translationFields = {
  ownerId: text(translationOwnerColumn).notNull(),
  locale: text('locale')
    .notNull()
    .references(() => locales.code),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  description: text('description').notNull(),
  source: text('sources_json', { mode: 'json' }).$type<Source[]>().notNull(),
  translationStatus: text('translation_status', {
    enum: ['ready', 'missing', 'outdated']
  }).notNull(),
  openQuestions: text('open_questions_json', { mode: 'json' }).$type<string[]>().notNull()
}

/**
 * Перевод принадлежит конкретной предметной записи; Markdown хранится буквально.
 */
function translationTable(
  name: string,
  ownerId: SQLiteColumn,
  column: string
): DeclaredTable<typeof translationFields> {
  return sqliteTable(
    name,
    {
      ...translationFields,
      ownerId: text(column)
        .notNull()
        .references(() => ownerId, { onDelete: 'cascade' })
    },
    (t) => [
      primaryKey({ columns: [t.ownerId, t.locale] }),
      check(`${name}_status`, sql`${t.translationStatus} IN ('ready', 'missing', 'outdated')`),
      check(`${name}_sources`, sql`json_type(${t.source}) = 'array'`),
      check(`${name}_questions`, sql`json_type(${t.openQuestions}) = 'array'`),
      check(`${name}_sources_json`, sql`json_valid(${t.source})`),
      check(`${name}_questions_json`, sql`json_valid(${t.openQuestions})`)
    ]
  )
}
export const branchTranslations = translationTable('branch_translations', branches.id, 'branch_id')
export const sagaTranslations = translationTable('saga_translations', sagas.id, 'saga_id')
export const regionTranslations = translationTable('region_translations', regions.id, 'region_id')
export const countryTranslations = translationTable('country_translations', countries.id, 'country_id')
export const releaseContextTranslations = translationTable(
  'release_context_translations',
  releaseContexts.id,
  'release_context_id'
)
export const chronicleTranslations = translationTable('chronicle_translations', chronicles.id, 'chronicle_id')
export const releaseTranslations = translationTable('release_translations', releases.id, 'release_id')
export const protocolTranslations = translationTable('protocol_translations', protocols.id, 'protocol_id')
export const packetRevisionTranslations = translationTable(
  'packet_revision_translations',
  packetRevisions.id,
  'packet_revision_id'
)
export const scenarioRevisionTranslations = translationTable(
  'scenario_revision_translations',
  scenarioRevisions.id,
  'scenario_revision_id'
)
export const articleRevisionTranslations = translationTable(
  'article_revision_translations',
  articleRevisions.id,
  'article_revision_id'
)

export const protocolLoginRevisions = sqliteTable(
  'protocol_login_revisions',
  {
    protocolId: text('protocol_id')
      .notNull()
      .references(() => protocols.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    position: integer('position').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.protocolId, t.number] }),
    unique().on(t.protocolId, t.position),
    check('login_number', sql`${t.number} >= 0 AND ${t.number} <= 9007199254740991`),
    check('login_position', sql`${t.position} >= 0`)
  ]
)
export const packetRevisionOpcodes = sqliteTable(
  'packet_revision_opcodes',
  {
    packetRevisionId: text('packet_revision_id')
      .notNull()
      .references(() => packetRevisions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    type: text('type', { enum: ['u8', 'u16le', 'u32le'] }).notNull(),
    value: integer('value').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.packetRevisionId, t.position] }),
    check('opcode_position', sql`${t.position} >= 0 AND ${t.position} < 8`),
    check(
      'opcode_value',
      sql`${t.value} >= 0 AND ((${t.type} = 'u8' AND ${t.value} <= 255) OR (${t.type} = 'u16le' AND ${t.value} <= 65535) OR (${t.type} = 'u32le' AND ${t.value} <= 4294967295))`
    )
  ]
)
export const packetRevisionStates = sqliteTable(
  'packet_revision_states',
  {
    packetRevisionId: text('packet_revision_id')
      .notNull()
      .references(() => packetRevisions.id, { onDelete: 'cascade' }),
    state: text('state').notNull(),
    position: integer('position').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.packetRevisionId, t.state] }),
    unique().on(t.packetRevisionId, t.position),
    check('state_text', sql`length(trim(${t.state})) > 0`),
    check('state_position', sql`${t.position} >= 0`)
  ]
)
export const scenarioServers = sqliteTable(
  'scenario_servers',
  {
    scenarioId: text('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    server: text('server', { enum: ['login', 'game'] }).notNull(),
    position: integer('position').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.scenarioId, t.server] }),
    unique().on(t.scenarioId, t.position),
    check('scenario_server', sql`${t.server} IN ('login', 'game')`),
    check('scenario_server_position', sql`${t.position} >= 0`)
  ]
)
export const articleServers = sqliteTable(
  'article_servers',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    server: text('server', { enum: ['login', 'game'] }).notNull(),
    position: integer('position').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.server] }),
    unique().on(t.articleId, t.position),
    check('article_server', sql`${t.server} IN ('login', 'game')`),
    check('article_server_position', sql`${t.position} >= 0`)
  ]
)
