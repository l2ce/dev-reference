import cl from 'clsx'
import Link from 'next/link'
import type { JSX } from 'react'
import { protocolPath } from 'domains/reference'
import { isNonEmptyArray, isNonEmptyString } from 'shared/lib/value-predicates'
import { Markdown } from 'ui/markdown'
import { CHRONICLE_MESSAGES } from '../../config/messages'
import type { ReleaseDetailsProps } from './types/release-details-props.type'
import styles from './styles/release-details.module.css'

/**
 * Раскрывает сведения выпуска по регионам, сохраняя источники у конкретных фактов.
 *
 * Используется для:
 *  - просмотра дат, стран и протоколов без переноса сведений между регионами
 */
export const ReleaseDetails = (props: ReleaseDetailsProps): JSX.Element => {
  const { release, locale, className, ...rootAttrs } = props
  const messages = CHRONICLE_MESSAGES[locale]
  const id = release.record.key.split(':').at(-1)
  const descriptionMarkdown = isNonEmptyString(release.record.markdown)
    ? release.record.markdown
    : messages.noReleaseDescription
  const unscopedItems = (release.record.unscopedProtocolKeys ?? []).map((key) => ({
    key,
    label: key.replace(/^protocol:/, ''),
    href: protocolPath(locale, key)
  }))
  const hasUnscoped = isNonEmptyArray(unscopedItems)
  const contextItems = release.contexts.map((context) => ({
    key: context.record.key,
    region: context.region?.summary
      ? `${context.region.title} · ${context.region.summary}`
      : (context.region?.title ?? messages.unknown),
    date: context.record.releasedOn ?? '—',
    countries: context.countries.map((country) => country.title).join(', ') || '—',
    sources: context.record.sources,
    hasSources: isNonEmptyArray(context.record.sources),
    protocolPlaceholder: isNonEmptyArray(context.record.protocolKeys) ? '' : '—',
    protocols: (context.record.protocolKeys ?? [])
      .map((key) => ({
        key,
        label: key.replace(/^protocol:/, ''),
        href: protocolPath(locale, key)
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'en', { numeric: true }))
  }))
  const hasContexts = isNonEmptyArray(contextItems)

  return (
    <section {...rootAttrs} id={id} className={cl(styles.root, className)}>
      <h3 className={styles.title}>{release.record.title}</h3>
      <Markdown className={styles.description} markdown={descriptionMarkdown} />
      {hasContexts && (
        <div
          className={styles.scroll}
          role="region"
          tabIndex={0}
          aria-label={`${release.record.title}: ${messages.region}`}
        >
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th scope="col" className={styles.cell}>
                  {messages.region}
                </th>
                <th scope="col" className={styles.cell}>
                  {messages.date}
                </th>
                <th scope="col" className={styles.cell}>
                  {messages.protocols}
                </th>
                <th scope="col" className={styles.cell}>
                  {messages.countries}
                </th>
                <th scope="col" className={styles.cell}>
                  {messages.sources}
                </th>
              </tr>
            </thead>
            <tbody>
              {contextItems.map((context) => (
                <tr key={context.key}>
                  <th scope="row" className={styles.cell}>
                    {context.region}
                  </th>
                  <td className={styles.cell}>{context.date}</td>
                  <td className={styles.cell}>
                    <div className={styles.protocols}>
                      {context.protocols.map((protocol) => (
                        <Link key={protocol.key} href={protocol.href}>
                          {protocol.label}
                        </Link>
                      ))}
                      {context.protocolPlaceholder}
                    </div>
                  </td>
                  <td className={styles.cell}>{context.countries}</td>
                  <td className={styles.cell}>
                    {context.hasSources && (
                      <details className={styles.evidence}>
                        <summary className={styles.evidenceSummary}>
                          {messages.sources} ({context.sources.length})
                        </summary>
                        <ul className={styles.sourceList}>
                          {context.sources.map((source) => (
                            <li key={source.id}>
                              <a href={source.url} rel="noreferrer">
                                {source.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasUnscoped && (
        <div className={styles.unscoped}>
          <p>{messages.unscoped}</p>
          {unscopedItems.map((protocol) => (
            <Link key={protocol.key} href={protocol.href}>
              {protocol.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
