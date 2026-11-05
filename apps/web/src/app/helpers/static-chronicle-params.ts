import type { ChronicleRoute } from 'domains/reference'
import type { Locale } from 'shared/localization'
import { isNonEmptyArray } from 'shared/lib/value-predicates'
import { EMPTY_DOCUMENT_CODE } from './static-document-params'

/**
 * Позволяет экспортировать неполный каталог без хроник, не создавая предметную заглушку.
 * Технический URL завершается notFound и удаляется общим finalize-export.
 */
export const staticChronicleParams = (chronicles: readonly ChronicleRoute[], locale: Locale): ChronicleRoute[] => {
  const routes = chronicles.filter((route) => route.locale === locale)
  if (isNonEmptyArray(routes)) {
    return routes
  }
  return [{ locale, chronicle: EMPTY_DOCUMENT_CODE }]
}
