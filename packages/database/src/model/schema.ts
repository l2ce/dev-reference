import * as z from 'zod'

/**
 * Формат 21: самостоятельные релизы, саги и региональные выходы.
 */
export const localeSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
export const idSchema = z.uuidv4().regex(/^[0-9a-f-]+$/)
export const codeSchema = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/)
export const revSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
export const keySchema = z
  .string()
  .regex(
    /^(branch|saga|release|release-context|packet|scenario|article|protocol|chronicle|region|country):[a-z0-9]+(?:[.-][a-z0-9]+)*(?::[a-z0-9]+(?:[.-][a-z0-9]+)*)*$/
  )
export const serverSchema = z.enum(['login', 'game'])
export const statusSchema = z.enum(['missing', 'partial', 'documented'])
const text = z.string().refine((value) => value.trim().length > 0)

/**
 * Источник принадлежит одному языковому документу; ссылки на код могут закреплять commit и строки.
 */
export const sourceSchema = z.strictObject({
  id: idSchema,
  url: z.url({ protocol: /^https?$/ }),
  title: text,
  summary: text.optional()
})
export const translationSchema = z.strictObject({
  locale: localeSchema,
  title: z.string(),
  summary: z.string(),
  description: z.string(),
  source: z.array(sourceSchema).default([]),
  translationStatus: z.enum(['ready', 'missing', 'outdated']).default('ready'),
  openQuestions: z.array(text).default([])
})
const translations = z.array(translationSchema).default([])
const identity = { id: idSchema, key: keySchema }
const named = {
  ...identity,
  code: codeSchema,
  order: z.number().int().nullable().default(null)
}
const research = { status: statusSchema.default('missing') }
/**
 * Проверяет календарную дату с явно сохранённой точностью года, месяца или дня.
 */
export const releaseDateSchema = z
  .string()
  .regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    if (year < 1 || (month !== undefined && (month < 1 || month > 12))) {
      return false
    }
    if (day === undefined) {
      return true
    }
    const date = new Date(`${value}T00:00:00Z`)
    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
  })
export const opcodeSchema = z
  .array(
    z.strictObject({
      type: z.enum(['u8', 'u16le', 'u32le']),
      value: z.number().int().nonnegative().max(0xffffffff)
    })
  )
  .min(1)
  .max(8)
  .nullable()
export const entitySchemas = {
  branches: z.strictObject({ ...named, translations }),
  sagas: z.strictObject({ ...named, branchKey: keySchema, translations }),
  regions: z.strictObject({ ...named, translations }),
  countries: z.strictObject({ ...named, translations }),
  chronicles: z.strictObject({
    ...named,
    branchKey: keySchema,
    sagaKey: keySchema.nullable().default(null),
    translations
  }),
  releases: z.strictObject({
    ...named,
    chronicleKey: keySchema,
    protocolKeys: z.array(keySchema).default([]),
    ...research,
    translations
  }),
  'release-contexts': z.strictObject({
    ...named,
    releaseKey: keySchema,
    regionKey: keySchema.nullable().default(null),
    releasedOn: releaseDateSchema.nullable().default(null),
    countryKeys: z.array(keySchema).default([]),
    protocolKeys: z.array(keySchema).default([]),
    ...research,
    translations
  }),
  protocols: z.strictObject({
    ...identity,
    number: z.number().int().nonnegative(),
    variant: z.number().int().nonnegative().default(0),
    ...research,
    loginRevisions: z.array(z.number().int().nonnegative()).default([]),
    translations
  }),
  packets: z.strictObject({
    ...named,
    name: text,
    server: serverSchema,
    direction: z.enum(['client-to-server', 'server-to-client'])
  }),
  scenarios: z.strictObject({
    ...named,
    servers: z.array(serverSchema).default([])
  }),
  articles: z.strictObject({
    ...named,
    servers: z.array(serverSchema).default([])
  })
} as const
const revision = {
  ...identity,
  rev: revSchema,
  ...research,
  protocolKeys: z.array(keySchema).default([]),
  translations
}
export const implementationSchemas = {
  'packet-revisions': z.strictObject({
    ...revision,
    packetKey: keySchema,
    opcode: opcodeSchema.default(null),
    states: z.array(text).default([])
  }),
  'scenario-revisions': z.strictObject({ ...revision, scenarioKey: keySchema }),
  'article-revisions': z.strictObject({ ...revision, articleKey: keySchema })
} as const
export const entityCollectionSchema = z.strictObject(entitySchemas).keyof()
export const implementationCollectionSchema = z.strictObject(implementationSchemas).keyof()
export const recordSchemas = {
  ...entitySchemas,
  ...implementationSchemas
} as const
export const collectionSchema = z.strictObject(recordSchemas).keyof()
export const entityAddressSchema = z.strictObject({
  key: keySchema,
  collection: entityCollectionSchema,
  kind: z.literal('entity')
})
export const implementationAddressSchema = z.strictObject({
  key: keySchema,
  collection: implementationCollectionSchema,
  kind: z.literal('implementation')
})
export const addressSchema = z.discriminatedUnion('kind', [entityAddressSchema, implementationAddressSchema])
export const entryEnvelopeSchema = z.discriminatedUnion('kind', [
  entityAddressSchema.extend({ value: z.unknown() }),
  implementationAddressSchema.extend({ value: z.unknown() })
])
export const manifestSchema = z
  .strictObject({
    schemaVersion: z.literal(21),
    dataVersion: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/),
    defaultLocale: localeSchema,
    locales: z.array(localeSchema).min(1)
  })
  .refine(
    (manifest) =>
      new Set(manifest.locales).size === manifest.locales.length && manifest.locales.includes(manifest.defaultLocale)
  )
export const snapshotEnvelopeSchema = z.strictObject({
  ...manifestSchema.shape,
  entries: z.array(z.unknown())
})
