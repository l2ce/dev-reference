import cl from 'clsx'
import type { JSX } from 'react'
import { referenceMessages } from 'domains/reference'
import { getKnowledge, getProtocol } from 'domains/reference/server'
import { isDefined, isNonEmptyArray } from 'shared/lib/value-predicates'
import { Markdown } from 'ui/markdown'
import { KnowledgeSections } from 'compositions/screens/protocol/ui/knowledge-sections'
import { protocolMessages } from './config/messages'
import type { ProtocolScreenProps } from './types/protocol-screen-props.type'
import styles from './styles/protocol.module.css'

/**
 * Представляет профиль и предлагает три самостоятельных направления чтения.
 *
 * Используется для:
 *  - знакомства с контекстом выбранного клиента
 *  - перехода к статьям, сценариям или пакетам
 */
export const ProtocolScreen = ({ locale, protocol, className, ...rootAttrs }: ProtocolScreenProps): JSX.Element => {
  const contextData = getProtocol(protocol, locale)
  const documentItems = getKnowledge(protocol, locale)
  const messages = protocolMessages[locale]
  const profileData = contextData.profile
  const statusLabel = referenceMessages[locale].status[profileData.status ?? 'missing']
  const loginLabel = isNonEmptyArray(contextData.loginRevisions)
    ? contextData.loginRevisions.join(', ')
    : messages.unknown
  const regionLabel = isNonEmptyArray(contextData.regions) ? contextData.regions.join(', ') : messages.unknown
  const releaseLabel = isNonEmptyArray(contextData.releases)
    ? contextData.releases.map((release) => release.title).join(', ')
    : messages.unknown
  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <p className={styles.eyebrow}>
        {messages.context} / {protocol}
      </p>
      <h1 className={styles.title}>{profileData.title}</h1>
      <p className={styles.summary}>{profileData.summary}</p>
      <span className={styles.status}>
        <span className={styles.statusDot} />
        {statusLabel}
      </span>
      <dl className={styles.facts}>
        <div>
          <dt>{messages.releases}</dt>
          <dd>{releaseLabel}</dd>
        </div>
        <div>
          <dt>{messages.regions}</dt>
          <dd>{regionLabel}</dd>
        </div>
        <div>
          <dt>{messages.login}</dt>
          <dd>{loginLabel}</dd>
        </div>
      </dl>
      <h2 className={styles.sectionTitle}>{messages.title}</h2>
      <p className={styles.sectionDescription}>{messages.choose}</p>
      <KnowledgeSections documents={documentItems} protocol={protocol} locale={locale} />
      {isDefined(profileData.markdown) && (
        <section className={styles.context}>
          <h2>{messages.about}</h2>
          <Markdown markdown={profileData.markdown} />
        </section>
      )}
    </section>
  )
}
