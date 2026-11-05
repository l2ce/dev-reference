import cl from 'clsx'
import Link from 'next/link'
import type { JSX } from 'react'
import { protocolPath } from 'domains/reference'
import { isEmptyArray } from 'shared/lib/value-predicates'
import { GROUP_MESSAGES } from '../../config/messages'
import { getMaterialLabel } from '../../helpers/material-label'
import type { ProtocolLinksProps } from './types/protocol-links-props.type'
import styles from './styles/protocol-links.module.css'

/**
 * Показывает ссылки на точные профили с различием доступной и незаполненной документации.
 *
 * Используется для:
 *  - перехода от выпуска к чтению материалов
 *  - просмотра зарегистрированных протоколов без описаний
 */
export const ProtocolLinks = (props: ProtocolLinksProps): JSX.Element => {
  const { protocols, context, locale, className, ...rootAttrs } = props
  const messages = GROUP_MESSAGES[locale]
  const hasNoProtocols = isEmptyArray(protocols)
  const protocolItems = [...protocols]
    .sort((left, right) => left.number - right.number || left.variant - right.variant)
    .map((protocol) => {
      const designation = protocol.key.slice('protocol:'.length)
      const availabilityLabel = getMaterialLabel(protocol.materialCount, locale)
      return {
        ...protocol,
        href: protocolPath(locale, protocol.key),
        hasMaterials: protocol.materialCount > 0,
        designation,
        availabilityLabel,
        accessibleLabel: `${messages.open} ${designation} · ${context}. ${availabilityLabel}`
      }
    })

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      {hasNoProtocols && (
        <span className={styles.empty} title={messages.noProtocols}>
          —
        </span>
      )}
      {protocolItems.map((protocol) => (
        <Link key={protocol.key} href={protocol.href} aria-label={protocol.accessibleLabel} className={styles.link}>
          <span className={cl(styles.number, { [styles._available]: protocol.hasMaterials })}>
            {protocol.designation}
          </span>
          {protocol.hasMaterials && (
            <sup className={styles.availability} title={protocol.availabilityLabel}>
              ●
            </sup>
          )}
        </Link>
      ))}
    </div>
  )
}
