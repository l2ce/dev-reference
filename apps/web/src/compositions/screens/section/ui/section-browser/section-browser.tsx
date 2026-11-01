import { Button, Pagination, Select, TextInput } from '@mantine/core'
import cl from 'clsx'
import Link from 'next/link'
import type { JSX } from 'react'
import { referenceMessages } from 'domains/reference'
import { isEmptyArray } from 'shared/lib/value-predicates'
import { useLocationQuery, replaceLocationQuery } from 'infra/browser-location/client'
import { parseSectionFilters, serializeSectionFilters } from './helpers/section-filters'
import type { SectionFilters } from './types/section-filters.type'
import { selectSectionPage } from './helpers/section-page'
import { sectionBrowserMessages } from './config/messages'
import type { SectionBrowserProps } from './types/section-browser-props.type'
import styles from './styles/section-browser.module.css'

/**
 * Ищет по всему разделу и показывает ограниченную страницу результатов.
 *
 * Используется для:
 *  - работы с сотнями материалов без длинного общего списка
 *  - уточнения пакетов по серверу и направлению
 */
export const SectionBrowser = ({ documents, locale, kind }: SectionBrowserProps): JSX.Element => {
  const search = useLocationQuery()
  const filters = parseSectionFilters(search)
  const { query, server, direction } = filters
  const messages = sectionBrowserMessages[locale]
  const labels = referenceMessages[locale]
  const isPacket = kind === 'packet'
  const { items: visibleItems, total, currentPage, pageCount } = selectSectionPage(documents, filters, kind)
  const listQuery = serializeSectionFilters({
    ...filters,
    page: currentPage
  }).toString()
  const documentSuffix = listQuery === '' ? '' : `?list=${encodeURIComponent(listQuery)}`
  const hasNoResults = isEmptyArray(visibleItems)
  const hasNoDocuments = isEmptyArray(documents)
  const canReset = !hasNoDocuments
  const emptyTitle = hasNoDocuments ? messages.notStarted : messages.empty
  const emptyDescription = hasNoDocuments ? messages.notStartedHint : messages.emptyHint
  const serverItems = [
    { value: 'all', label: messages.allServers },
    { value: 'login', label: 'Login' },
    { value: 'game', label: 'Game' }
  ]
  const directionItems = [
    { value: 'all', label: messages.allDirections },
    { value: 'client-to-server', label: messages.outgoing },
    { value: 'server-to-client', label: messages.incoming }
  ]

  /**
   * Сбрасывает локальные фильтры и возвращает пользователя к первой странице.
   */
  const handleReset = (): void => replaceLocationQuery(new URLSearchParams())

  /**
   * Обновляет фильтр и начинает просмотр результатов с первой страницы.
   */
  const handleFilter = (patch: Partial<SectionFilters>): void =>
    replaceLocationQuery(serializeSectionFilters({ ...filters, page: 1, ...patch }))

  /**
   * Применяет проверенный выбор сервера из UI-контрола.
   */
  const handleServer = (value: string | null): void =>
    handleFilter({
      server: value === 'login' || value === 'game' ? value : 'all'
    })

  /**
   * Применяет проверенное направление из UI-контрола.
   */
  const handleDirection = (value: string | null): void =>
    handleFilter({
      direction: value === 'client-to-server' || value === 'server-to-client' ? value : 'all'
    })

  return (
    <div className={styles.root}>
      <div className={styles.filters}>
        <TextInput
          className={styles.search}
          label={messages.search}
          placeholder={messages.placeholder}
          value={query}
          onChange={(event) => handleFilter({ query: event.currentTarget.value })}
        />
        <Select
          className={styles.select}
          label={messages.server}
          data={serverItems}
          value={server}
          allowDeselect={false}
          onChange={handleServer}
        />
        {isPacket && (
          <Select
            className={styles.select}
            label={messages.direction}
            data={directionItems}
            value={direction}
            allowDeselect={false}
            onChange={handleDirection}
          />
        )}
      </div>
      <p className={styles.count} role="status">
        {total} {messages.results}
      </p>
      {hasNoResults && (
        <div className={styles.empty}>
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
          {canReset && (
            <Button variant="light" onClick={handleReset}>
              {messages.clear}
            </Button>
          )}
        </div>
      )}
      <ul className={styles.list}>
        {visibleItems.map((document) => (
          <li key={document.key}>
            <Link href={`${document.href}${documentSuffix}`} className={styles.row}>
              <span className={styles.description}>
                <strong className={styles.title}>{document.title}</strong>
                <span className={styles.summary}>{document.summary}</span>
              </span>
              {isPacket && <code className={styles.opcode}>{document.opcodeLabel ?? '—'}</code>}
              <span className={styles.metadata}>
                <span className={styles.server}>{document.servers.join(' / ')}</span>
                <span
                  className={cl(styles.status, {
                    [styles._documented]: document.status === 'documented'
                  })}
                >
                  {labels.status[document.status ?? 'missing']}
                </span>
              </span>
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination
        className={styles.pagination}
        total={pageCount}
        value={currentPage}
        onChange={(nextPage) => handleFilter({ page: nextPage })}
        hideWithOnePage
        aria-label={messages.pages}
      />
    </div>
  )
}
