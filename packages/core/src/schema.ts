import * as z from 'zod'
import { sourceSchema } from '@l2ce/database/source'

const label = z.string().trim().min(1)
const id = z.string().regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)
const markdownFile = z.string().regex(/^(?:[a-z0-9][a-z0-9.-]*\/)*[a-z0-9][a-z0-9.-]*\.md$/)
export const localeSchema = z.enum(['en', 'ru'])
export const protocolNumberSchema = z.number().int().nonnegative()
export const protocolIdSchema = z.string().regex(/^(?:0|[1-9][0-9]*)(?:-[a-z]+)?$/)
export const versionSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/)

export interface DocumentationSection {
  id: string
  title: string
  description: string
  status: 'missing' | 'partial' | 'documented'
  translationStatus?: 'ready' | 'missing'
  file: string | null
  children: DocumentationSection[]
}

export const documentationSectionSchema: z.ZodType<DocumentationSection> = z.lazy(() =>
  z.strictObject({
    id,
    title: label,
    description: label,
    status: z.enum(['missing', 'partial', 'documented']),
    translationStatus: z.enum(['ready', 'missing']).optional(),
    file: markdownFile.nullable(),
    children: z.array(documentationSectionSchema).default([])
  })
)

export const documentationTocSchema = z.strictObject({
  schemaVersion: z.literal(1),
  protocol: protocolNumberSchema,
  sections: z.array(documentationSectionSchema).min(1)
})

export const documentationConfigSchema = z.strictObject({
  schemaVersion: z.literal(2),
  id: protocolIdSchema.optional(),
  number: protocolNumberSchema,
  title: label,
  description: label,
  chronicle: z.strictObject({ id, title: label }),
  family: label,
  loginRevision: protocolNumberSchema.nullable(),
  loginRevisions: z.array(protocolNumberSchema).optional(),
  region: label.nullable(),
  clientBuild: label.nullable(),
  sources: z.array(sourceSchema).default([])
})

export const documentationIndexSchema = z.strictObject({
  schemaVersion: z.literal(1),
  locale: localeSchema,
  title: label,
  description: label,
  protocols: z.array(protocolNumberSchema)
})

export const documentationBaseSchema = documentationIndexSchema.extend({
  protocols: z.array(
    documentationConfigSchema.extend({
      sections: z.array(documentationSectionSchema).min(1),
      documents: z.array(
        z.strictObject({
          file: markdownFile,
          body: z.string().refine((body) => body.trim().length > 0)
        })
      )
    })
  )
})

export const metadataSchema = z.strictObject({
  schemaVersion: z.literal(5),
  dataVersion: versionSchema,
  locales: z.array(localeSchema).min(1)
})

export const datasetSchema = metadataSchema.extend({
  bases: z.array(documentationBaseSchema).min(1)
})

export type Dataset = z.infer<typeof datasetSchema>
export type Locale = z.infer<typeof localeSchema>
export type DocumentationBase = z.infer<typeof documentationBaseSchema>
export type DocumentationProfile = DocumentationBase['protocols'][number]

export function flattenSections(sections: DocumentationSection[]): DocumentationSection[] {
  return sections.flatMap((section) => [section, ...flattenSections(section.children)])
}

export function countProtocols(dataset: Dataset): number {
  return dataset.bases.reduce((total, base) => total + base.protocols.length, 0)
}

export function validateDataset(input: unknown): Dataset {
  const dataset = datasetSchema.parse(input)
  const unique = (values: (string | number)[], name: string) => {
    if (new Set(values).size !== values.length) throw new Error(`Duplicate ${name}`)
  }
  unique(dataset.locales, 'locale')
  unique(
    dataset.bases.map((base) => base.locale),
    'language base'
  )
  if (
    dataset.bases.length !== dataset.locales.length ||
    dataset.bases.some((base) => !dataset.locales.includes(base.locale))
  ) {
    throw new Error('Language bases must match declared locales')
  }
  for (const base of dataset.bases) {
    unique(
      base.protocols.map((profile) => profile.id ?? profile.number),
      `protocol number in ${base.locale}`
    )
    const chronicles = new Map<string, string>()
    for (const profile of base.protocols) {
      const previous = chronicles.get(profile.chronicle.id)
      if (previous && previous !== profile.chronicle.title)
        throw new Error(`Inconsistent chronicle title: ${profile.chronicle.id}`)
      chronicles.set(profile.chronicle.id, profile.chronicle.title)
      const sections = flattenSections(profile.sections)
      unique(
        sections.map((section) => section.id),
        `section in ${base.locale}/${profile.number}`
      )
      unique(
        profile.documents.map((document) => document.file),
        `document in ${profile.number}`
      )
      const files = sections.flatMap((section) => (section.file ? [section.file] : []))
      unique(files, `document reference in ${profile.number}`)
      for (const section of sections) {
        if (section.file && !profile.documents.some((document) => document.file === section.file)) {
          throw new Error(`Missing document: ${base.locale}/${profile.number}/${section.file}`)
        }
        if (
          section.status === 'documented' &&
          section.translationStatus !== 'missing' &&
          !section.file &&
          section.children.length === 0
        ) {
          throw new Error(`Researched section needs a document: ${profile.number}/${section.id}`)
        }
      }
      for (const document of profile.documents) {
        if (!files.includes(document.file)) throw new Error(`Unreferenced document: ${profile.number}/${document.file}`)
      }
    }
  }
  return dataset
}
