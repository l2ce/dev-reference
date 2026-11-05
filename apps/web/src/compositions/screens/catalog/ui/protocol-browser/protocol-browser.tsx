'use client'

import { Button } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import { CatalogGroup } from 'compositions/screens/catalog/ui/protocol-browser/ui/catalog-group'
import type { CatalogGroupProps } from 'compositions/screens/catalog/ui/protocol-browser/ui/catalog-group'
import { CatalogControls } from 'compositions/screens/catalog/ui/protocol-browser/ui/catalog-controls'
import { useLocationQuery, replaceLocationQuery } from 'infra/browser-location/client'
import { isEmptyArray, isNonEmptyArray, isNonEmptyString } from 'shared/lib/value-predicates'
import { BROWSER_MESSAGES } from './config/messages'
import { parseCatalogFilters, serializeCatalogFilters } from './helpers/catalog-filters'
import { countCatalogProtocols, filterCatalog } from './helpers/filter-catalog'
import type { CatalogFilters } from './types/catalog-filters.type'
import type { ProtocolBrowserProps } from './types/protocol-browser-props.type'
import styles from './styles/protocol-browser.module.css'

/**
 * Совмещает просмотр веток и поиск протоколов с сохранением состояния в URL.
 *
 * Используется для:
 *  - изучения связи хроник и протоколов
 *  - поиска документации и различения незаполненных профилей
 */
export const ProtocolBrowser = (props: ProtocolBrowserProps): JSX.Element => {
  const { catalog, locale, children, className, ...rootAttrs } = props
  const search = useLocationQuery()
  const filters = parseCatalogFilters(search)
  const messages = BROWSER_MESSAGES[locale]
  const regionLegend = catalog.regions
    .filter((region) => isNonEmptyString(region.summary))
    .map((region) => `${region.title} — ${region.summary}`)
    .join(' · ')
  const filteredData = filterCatalog(catalog, filters)
  const protocolCount = countCatalogProtocols(filteredData)
  const hasFilters = filters.query !== '' || filters.onlyWithMaterials
  const hasAmbiguousNumber = /^\d+$/.test(filters.query.trim()) && protocolCount > 1
  const legendText = [messages.legend, regionLegend, hasAmbiguousNumber ? messages.ambiguous : '']
    .filter(isNonEmptyString)
    .join('\n')
  const groupItems: CatalogGroupProps[] = filteredData.branches.map((branch) => ({
    groupId: branch.key.replace(':', '-'),
    regions: catalog.regions,
    expandAdditional: hasFilters,
    title: branch.title,
    chronicles: branch.chronicles,
    protocols: [],
    locale
  }))

  if (isNonEmptyArray(filteredData.unassignedProtocols)) {
    groupItems.push({
      groupId: 'unassigned-protocols',
      regions: [],
      title: messages.unassigned,
      chronicles: [],
      protocols: filteredData.unassignedProtocols,
      locale
    })
  }

  const hasNoResults = isEmptyArray(groupItems)
  const emptyTitle = hasFilters ? messages.empty : messages.notStarted
  const emptyHint = hasFilters ? messages.emptyHint : messages.notStartedHint

  /**
   * Заменяет фильтры текущего адреса без отдельной записи истории на каждый символ.
   */
  const handleFilter = (patch: Partial<CatalogFilters>): void =>
    replaceLocationQuery(serializeCatalogFilters({ ...filters, ...patch }))

  /**
   * Возвращает полный каталог, сохраняя маршрут и язык.
   */
  const handleReset = (): void => replaceLocationQuery(new URLSearchParams())

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <div className={styles.introduction}>
        {children}
        <CatalogControls
          query={filters.query}
          onlyWithMaterials={filters.onlyWithMaterials}
          protocolCount={protocolCount}
          locale={locale}
          onQueryChange={(query) => handleFilter({ query })}
          onAvailabilityChange={(onlyWithMaterials) => handleFilter({ onlyWithMaterials })}
        />
      </div>
      <nav className={styles.navigation} aria-label={messages.branches}>
        {groupItems.map((group) => (
          <a key={group.groupId} href={`#${group.groupId}`}>
            {group.title}
          </a>
        ))}
      </nav>
      <p className={styles.hint}>{legendText}</p>
      {hasNoResults && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>{emptyTitle}</h2>
          <p className={styles.emptyHint}>{emptyHint}</p>
          {hasFilters && (
            <Button variant="default" onClick={handleReset}>
              {messages.reset}
            </Button>
          )}
        </div>
      )}
      <div className={styles.groups}>
        {groupItems.map((group) => (
          <CatalogGroup key={group.groupId} {...group} />
        ))}
      </div>
    </div>
  )
}
