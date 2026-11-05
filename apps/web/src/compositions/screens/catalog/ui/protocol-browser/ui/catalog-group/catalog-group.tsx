import cl from 'clsx'
import type { JSX } from 'react'
import { isEmptyArray, isNonEmptyArray } from 'shared/lib/value-predicates'
import { GROUP_MESSAGES } from './config/messages'
import { ChronicleTable } from './ui/chronicle-table/chronicle-table'
import { ProtocolLinks } from './ui/protocol-links/protocol-links'
import type { CatalogGroupProps } from './types/catalog-group-props.type'
import styles from './styles/catalog-group.module.css'

/**
 * Объединяет компактные строки хроник под названием ветки игры.
 *
 * Используется для:
 *  - просмотра связи хроник и протоколов
 *  - отдельного показа профилей с неизвестной принадлежностью
 */
export const CatalogGroup = (props: CatalogGroupProps): JSX.Element => {
  const {
    groupId,
    title,
    chronicles,
    protocols,
    regions,
    expandAdditional = false,
    locale,
    className,
    ...rootAttrs
  } = props
  const messages = GROUP_MESSAGES[locale]
  const headingId = `${groupId}-heading`
  const hasUnassignedProtocols = isNonEmptyArray(protocols)
  const hasNoRecords = isEmptyArray(chronicles) && isEmptyArray(protocols)
  const primaryItems = chronicles.filter((chronicle) => chronicle.order !== null)
  const additionalItems = chronicles.filter((chronicle) => chronicle.order === null)
  const hasPrimary = isNonEmptyArray(primaryItems)
  const hasAdditional = isNonEmptyArray(additionalItems)

  return (
    <section {...rootAttrs} id={groupId} aria-labelledby={headingId} className={cl(styles.root, className)}>
      <h2 id={headingId} className={styles.title}>
        {title}
      </h2>
      {hasPrimary && (
        <ChronicleTable
          chronicles={primaryItems}
          regions={regions}
          locale={locale}
          aria-label={`${title}. ${messages.table}`}
        />
      )}
      {hasAdditional && (
        <details className={styles.additional} open={expandAdditional || !hasPrimary}>
          <summary className={styles.additionalSummary}>
            {messages.additional} ({additionalItems.length})
          </summary>
          <ChronicleTable
            chronicles={additionalItems}
            regions={regions}
            locale={locale}
            aria-label={`${title}. ${messages.additional}. ${messages.table}`}
          />
        </details>
      )}
      {hasUnassignedProtocols && (
        <ProtocolLinks className={styles.unassigned} protocols={protocols} locale={locale} context={title} />
      )}
      {hasNoRecords && <p className={styles.empty}>{messages.noChronicles}</p>}
    </section>
  )
}
