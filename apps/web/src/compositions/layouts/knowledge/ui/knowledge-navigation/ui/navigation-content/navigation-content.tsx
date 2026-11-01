import { Pagination, Select, TextInput } from '@mantine/core'
import cl from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { JSX } from 'react'
import {
  getReferenceLocation,
  resolveProtocolTarget,
  KNOWLEDGE_SECTIONS,
  sectionPath,
  protocolPath,
  referenceMessages,
  matchesKnowledge
} from 'domains/reference'
import { localePath } from 'shared/localization'
import { isEmptyArray } from 'shared/lib/value-predicates'
import { useLocationQuery } from 'infra/browser-location/client'
import { navigationMessages } from '../../config/messages'
import type { NavigationContentProps } from './types/navigation-content-props.type'
import styles from './styles/navigation-content.module.css'

/**
 * Максимальная длина бокового индекса без прокрутки сотен документов.
 */
const PAGE_SIZE = 12

/**
 * Показывает переключатель профиля, три раздела и короткий индекс текущего раздела.
 *
 * Используется для:
 *  - переходов без потери контекста и просмотра больших наборов материалов
 */
export const NavigationContent = ({
  protocol,
  locale,
  targets,
  documents,
  pathname,
  onNavigate
}: NavigationContentProps): JSX.Element => {
  const router = useRouter()
  const search = useLocationQuery()
  const isUnmapped = new URLSearchParams(search).has('unavailable')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState<number | null>(null)
  const location = getReferenceLocation(pathname)
  const messages = navigationMessages[locale]
  const labels = referenceMessages[locale]
  const isDocument = location.documentKey !== undefined
  const isOverview = location.kind === undefined
  const documentItems = documents.filter(
    (document) => document.kind === location.kind && matchesKnowledge(document, query)
  )
  const pageCount = Math.max(1, Math.ceil(documentItems.length / PAGE_SIZE))
  const selectedIndex = documentItems.findIndex((document) => document.key === location.documentKey)
  const selectedPage = Math.floor(Math.max(0, selectedIndex) / PAGE_SIZE) + 1
  const currentPage = Math.min(page ?? selectedPage, pageCount)
  const overviewCurrent = isOverview ? 'page' : undefined
  const navigationItems = documentItems.map((document) => ({
    ...document,
    isCurrent: document.key === location.documentKey,
    ariaCurrent: document.key === location.documentKey ? ('page' as const) : undefined
  }))
  const visibleItems = navigationItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const hasNoResults = isEmptyArray(visibleItems)

  /**
   * Открывает раздел или применимый документ в явно выбранном профиле.
   */
  const handleProtocol = (value: string | null): void => {
    const target = targets.find((entry) => entry.value === value)
    if (target === undefined) {
      return
    }
    onNavigate?.()
    router.push(resolveProtocolTarget(target, locale, location))
  }

  return (
    <div className={styles.root}>
      <Link className={styles.back} href={localePath(locale, '/protocols/')} onClick={onNavigate}>
        ← {messages.all}
      </Link>
      <Select
        label={messages.protocol}
        aria-label={messages.protocol}
        data={targets.map((target) => ({
          value: target.value,
          label: target.label
        }))}
        value={protocol}
        onChange={handleProtocol}
        searchable
        allowDeselect={false}
        size="sm"
        comboboxProps={{ withinPortal: false }}
      />
      {isUnmapped && (
        <p className={styles.notice} role="status">
          {messages.unavailable}
        </p>
      )}
      <p className={styles.caption}>{messages.sections}</p>
      <nav className={styles.sections} aria-label={messages.sections}>
        <Link
          className={cl(styles.section, { [styles._active]: isOverview })}
          href={protocolPath(locale, protocol)}
          aria-current={overviewCurrent}
          onClick={onNavigate}
        >
          {messages.overview}
        </Link>
        {KNOWLEDGE_SECTIONS.map((section) => (
          <Link
            key={section.kind}
            className={cl(styles.section, {
              [styles._active]: location.kind === section.kind
            })}
            href={sectionPath(locale, protocol, section.kind)}
            onClick={onNavigate}
          >
            <span>{labels.sections[section.kind]}</span>
            <span className={styles.count}>
              {documents.filter((document) => document.kind === section.kind).length}
            </span>
          </Link>
        ))}
      </nav>
      {isDocument && (
        <div className={styles.index}>
          <p className={styles.caption}>{messages.current}</p>
          <TextInput
            aria-label={messages.search}
            placeholder={messages.search}
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              setPage(1)
            }}
            size="xs"
          />
          <nav className={styles.documents} aria-label={messages.current}>
            {visibleItems.map((document) => (
              <Link
                className={cl(styles.document, {
                  [styles._active]: document.isCurrent
                })}
                key={document.key}
                href={document.href}
                aria-current={document.ariaCurrent}
                onClick={onNavigate}
              >
                {document.title}
              </Link>
            ))}
          </nav>
          {hasNoResults && (
            <p className={styles.notice} role="status">
              {messages.empty}
            </p>
          )}
          <Pagination
            total={pageCount}
            value={currentPage}
            onChange={setPage}
            size="xs"
            siblings={0}
            boundaries={1}
            hideWithOnePage
          />
        </div>
      )}
    </div>
  )
}
