import { IconPackage, IconPlugConnected, IconRoute } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { KNOWLEDGE_MESSAGES } from './config/messages'
import type { KnowledgeOverviewProps } from './types/knowledge-overview-props.type'
import styles from './styles/knowledge-overview.module.css'

/**
 * Кратко представляет три вида знаний во вступлении к справочнику.
 *
 * Используется для:
 *  - знакомства с пакетами, сценариями и механизмами перед переходом в каталог
 */
export const KnowledgeOverview = (props: KnowledgeOverviewProps): JSX.Element => {
  const { locale, className, ...rootAttrs } = props
  const messages = KNOWLEDGE_MESSAGES[locale]

  return (
    <dl {...rootAttrs} className={cl(styles.root, className)} aria-label={messages.title}>
      <div className={styles.topic}>
        <dt className={styles.term}>
          <IconPackage className={styles.icon} size={20} stroke={1.6} aria-hidden="true" />
          <span>{messages.packets}</span>
        </dt>
        <dd className={styles.description}>{messages.packetsText}</dd>
      </div>
      <div className={styles.topic}>
        <dt className={styles.term}>
          <IconRoute className={styles.icon} size={20} stroke={1.6} aria-hidden="true" />
          <span>{messages.scenarios}</span>
        </dt>
        <dd className={styles.description}>{messages.scenariosText}</dd>
      </div>
      <div className={styles.topic}>
        <dt className={styles.term}>
          <IconPlugConnected className={styles.icon} size={20} stroke={1.6} aria-hidden="true" />
          <span>{messages.mechanisms}</span>
        </dt>
        <dd className={styles.description}>{messages.mechanismsText}</dd>
      </div>
    </dl>
  )
}
