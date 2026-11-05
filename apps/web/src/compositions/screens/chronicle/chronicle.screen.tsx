import cl from 'clsx'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { JSX } from 'react'
import { getChronicle } from 'domains/reference/server'
import { localePath } from 'shared/localization'
import { isNonEmptyArray, isNonEmptyString } from 'shared/lib/value-predicates'
import { Markdown } from 'ui/markdown'
import { CHRONICLE_MESSAGES } from './config/messages'
import { ReleaseDetails } from './ui/release-details/release-details'
import type { ChronicleScreenProps } from './types/chronicle-screen-props.type'
import styles from './styles/chronicle.module.css'

/**
 * Показывает историю хроники и региональное использование протоколов.
 *
 * Используется для:
 *  - перехода от таблицы к описаниям, выпускам и источникам
 */
export const ChronicleScreen = (props: ChronicleScreenProps): JSX.Element => {
  const { chronicle, locale, className, ...rootAttrs } = props
  const detailsData = getChronicle(chronicle, locale)
  if (detailsData === null) {
    notFound()
  }
  const messages = CHRONICLE_MESSAGES[locale]
  const descriptionMarkdown = isNonEmptyString(detailsData.profile.markdown)
    ? detailsData.profile.markdown
    : messages.noDescription
  const hasReleases = isNonEmptyArray(detailsData.releases)
  const releaseHint = hasReleases ? messages.datesHint : messages.noReleases
  const sourceItems = detailsData.profile.sources
  const backHref = localePath(locale, '/protocols/')

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <Link href={backHref} className={styles.back}>
        ← {messages.back}
      </Link>
      <p className={styles.branch}>{detailsData.branch.title}</p>
      <h1 className={styles.title}>{detailsData.profile.title}</h1>
      <Markdown className={styles.description} markdown={descriptionMarkdown} />
      <h2 className={styles.heading}>{messages.releases}</h2>
      <p className={styles.hint}>{releaseHint}</p>
      {detailsData.releases.map((release) => (
        <ReleaseDetails key={release.record.key} release={release} locale={locale} />
      ))}
      {isNonEmptyArray(sourceItems) && (
        <section className={styles.sources}>
          <h2>{messages.sources}</h2>
          <ul>
            {sourceItems.map((source) => (
              <li key={source.id}>
                <a href={source.url} rel="noreferrer">
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
