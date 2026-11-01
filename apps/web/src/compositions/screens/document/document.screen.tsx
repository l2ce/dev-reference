import cl from 'clsx'
import Link from 'next/link'
import type { JSX } from 'react'
import { documentPath, protocolPath, sectionPath, referenceMessages, formatOpcode } from 'domains/reference'
import { getDocument } from 'domains/reference/server'
import { isNonEmptyArray } from 'shared/lib/value-predicates'
import { Markdown } from 'ui/markdown'
import { TableOfContents } from 'compositions/screens/document/ui/table-of-contents/client'
import { ReadingActions } from 'compositions/screens/document/ui/reading-actions/client'
import { DocumentDetails } from './ui/document-details/document-details'
import { documentMessages } from './config/messages'
import type { DocumentScreenProps } from './types/document-screen-props.type'
import styles from './styles/document.module.css'

/**
 * Показывает документ в контексте протокола, с оглавлением и основаниями исследования.
 *
 * Используется для:
 *  - чтения статически подготовленного Markdown
 *  - переходов к связанным материалам и возврата в выбранный раздел
 */
export const DocumentScreen = ({
  protocol,
  locale,
  kind,
  code,
  className,
  ...rootAttrs
}: DocumentScreenProps): JSX.Element => {
  const {
    document: documentData,
    markdown,
    issues: issueItems,
    sources: sourceItems
  } = getDocument(protocol, locale, `${kind}:${code}`)
  const messages = documentMessages[locale]
  const labels = referenceMessages[locale]
  const alternateLocale = locale === 'ru' ? 'en' : 'ru'
  const alternateData = getDocument(protocol, alternateLocale, documentData.key).document
  const isUnavailable = documentData.availability !== 'available'
  const hasAlternate = isUnavailable && alternateData.availability === 'available'
  const isPending = !isUnavailable && markdown.trim().length === 0
  const isPacket = kind === 'packet'
  const isOutdated = documentData.translationStatus === 'outdated'
  const opcodeLabel = formatOpcode(documentData.opcode) ?? messages.unknown
  const directionLabel = documentData.direction === 'client-to-server' ? messages.outgoing : messages.incoming
  const hasDirection = documentData.direction !== null
  const questionItems = documentData.openQuestions
  const sectionHref = sectionPath(locale, protocol, kind)

  return (
    <article {...rootAttrs} className={cl(styles.root, className)}>
      <div className={styles.reading}>
        <header className={styles.header}>
          <nav className={styles.breadcrumb} aria-label={messages.details}>
            <Link href={protocolPath(locale, protocol)}>{protocol}</Link>
            <span aria-hidden="true">/</span>
            <Link href={sectionHref}>{labels.sections[kind]}</Link>
          </nav>
          <h1 className={styles.title} id="document-title">
            {documentData.title}
          </h1>
          <p className={styles.summary}>{documentData.summary}</p>
          <div className={styles.metadata}>
            {isPacket && <code className={styles.opcode}>{opcodeLabel}</code>}
            <span className={styles.server}>{documentData.servers.join(' / ')}</span>
            {hasDirection && <span>{directionLabel}</span>}
            <span className={styles.status}>{labels.status[documentData.status ?? 'missing']}</span>
            {isOutdated && <span className={styles.status}>{labels.translation.outdated}</span>}
          </div>
        </header>
        <div className={styles.mobileOutline}>
          <TableOfContents locale={locale} collapsed />
        </div>
        <div id="document-body">
          {isUnavailable && <p className={styles.notice}>{labels.availability[documentData.availability]}</p>}
          {hasAlternate && (
            <Link
              className={styles.translation}
              href={documentPath(alternateLocale, protocol, documentData.key)}
              lang={alternateLocale}
            >
              {messages.locale} →
            </Link>
          )}
          {isPending && <p className={styles.notice}>{messages.pending}</p>}
          <Markdown markdown={markdown} />
          {isNonEmptyArray(questionItems) && (
            <section className={styles.notes}>
              <h2 id="open-questions">{messages.questions}</h2>
              <ul>
                {questionItems.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </section>
          )}
          {isNonEmptyArray(issueItems) && (
            <section className={styles.notes}>
              <h2 id="reference-notes">{messages.issues}</h2>
              <ul>
                {issueItems.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </section>
          )}
          <DocumentDetails locale={locale} document={documentData} sources={sourceItems} />
        </div>
        <ReadingActions locale={locale} sectionHref={sectionHref} />
      </div>
      <aside className={styles.outline}>
        <TableOfContents locale={locale} />
      </aside>
    </article>
  )
}
