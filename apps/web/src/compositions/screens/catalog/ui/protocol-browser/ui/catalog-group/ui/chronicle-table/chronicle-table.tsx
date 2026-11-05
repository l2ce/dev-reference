import cl from 'clsx'
import type { JSX } from 'react'
import { isNonEmptyArray } from 'shared/lib/value-predicates'
import { GROUP_MESSAGES } from '../../config/messages'
import { ChronicleRow } from '../chronicle-row/chronicle-row'
import type { ChronicleTableProps } from './types/chronicle-table-props.type'
import styles from './styles/chronicle-table.module.css'

/**
 * Показывает компактную таблицу выпусков и региональных протоколов.
 *
 * Используется для:
 *  - чтения исходного каталога и отдельных дополнительных сведений
 */
export const ChronicleTable = (props: ChronicleTableProps): JSX.Element => {
  const { chronicles, regions, locale, className, 'aria-label': accessibleLabel, ...rootAttrs } = props
  const messages = GROUP_MESSAGES[locale]
  const tableLabel = accessibleLabel ?? messages.table
  const hasUnknownRegion = chronicles.some((chronicle) =>
    chronicle.releases.some(
      (release) =>
        isNonEmptyArray(release.unscopedProtocols) ||
        release.contexts.some((context) => context.regionKey === null && isNonEmptyArray(context.protocols))
    )
  )

  return (
    <div {...rootAttrs} className={cl(styles.root, className)} tabIndex={0} role="region" aria-label={tableLabel}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.chronicleHeading}>
              {messages.chronicle}
            </th>
            {regions.map((region) => (
              <th key={region.key} scope="col" className={styles.regionHeading} title={region.summary ?? region.title}>
                {region.title}
              </th>
            ))}
            {hasUnknownRegion && (
              <th scope="col" className={styles.regionHeading}>
                {messages.unknownRegion}
              </th>
            )}
          </tr>
        </thead>
        {chronicles.map((chronicle) => (
          <ChronicleRow
            key={chronicle.key}
            chronicle={chronicle}
            regions={regions}
            hasUnknownRegion={hasUnknownRegion}
            locale={locale}
          />
        ))}
      </table>
    </div>
  )
}
