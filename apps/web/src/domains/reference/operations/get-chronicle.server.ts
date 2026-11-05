import 'server-only'
import { hasErrorCode } from '@l2ce/database'
import type { ReferenceCatalogItem } from '@l2ce/core/reference'
import type { Locale } from 'shared/localization'
import { readReference } from '../adapters/read-reference'
import { collectPages } from '../helpers/collect-pages'
import type { ChronicleDetails, ChronicleRoute } from '../types/chronicle.type'

/**
 * Собирает хронику и региональные контексты из одного неизменяемого reader.
 */
export const getChronicle = (code: string, locale: Locale): ChronicleDetails | null => {
  const { reader } = readReference()
  let profile: ReferenceCatalogItem
  try {
    profile = reader.catalogRecord(`chronicle:${code}`, locale)
  } catch (error) {
    if (hasErrorCode(error, 'NOT_FOUND')) {
      return null
    }
    throw error
  }
  if (profile.branchKey === undefined) {
    return null
  }
  const releases = collectPages((offset) =>
    reader.catalog({ collection: 'chronicle-releases', chronicle: profile.key, locale, offset, limit: 100 })
  )
  return {
    profile,
    branch: reader.catalogRecord(profile.branchKey, locale),
    releases: releases.map((release) => ({
      record: reader.catalogRecord(release.key, locale),
      contexts: collectPages((offset) =>
        reader.catalog({ collection: 'release-contexts', release: release.key, locale, offset, limit: 100 })
      ).map((context) => ({
        record: reader.catalogRecord(context.key, locale),
        region: context.regionKey ? reader.catalogRecord(context.regionKey, locale) : null,
        countries: (context.countryKeys ?? []).map((key) => reader.catalogRecord(key, locale))
      }))
    }))
  }
}

/**
 * Перечисляет страницы всех хроник, не ограничиваясь первой страницей API.
 */
export const getChronicleRoutes = (): ChronicleRoute[] => {
  const { reader, locales } = readReference()
  const chronicles = collectPages((offset) => reader.catalog({ collection: 'chronicles', offset, limit: 100 }))
  return locales.flatMap((locale) =>
    chronicles.map((chronicle) => ({ locale, chronicle: chronicle.key.replace(/^chronicle:/, '') }))
  )
}
