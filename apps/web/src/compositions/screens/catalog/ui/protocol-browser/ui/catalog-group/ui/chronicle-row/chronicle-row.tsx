import cl from 'clsx'
import Link from 'next/link'
import type { JSX } from 'react'
import { chroniclePath } from 'domains/reference'
import { isNonEmptyArray } from 'shared/lib/value-predicates'
import { GROUP_MESSAGES } from '../../config/messages'
import { ProtocolLinks } from '../protocol-links/protocol-links'
import type { ChronicleRowProps } from './types/chronicle-row-props.type'
import styles from './styles/chronicle-row.module.css'

/**
 * Показывает хронику, её именованные выпуски и доступные точные профили.
 *
 * Используется для:
 *  - сопоставления хроники и протоколов внутри ветки игры
 */
export const ChronicleRow = (props: ChronicleRowProps): JSX.Element => {
  const { chronicle, regions, hasUnknownRegion, locale, className, ...rootAttrs } = props
  const messages = GROUP_MESSAGES[locale]
  const href = chroniclePath(locale, chronicle.key)
  const releaseItems = chronicle.releases.map((release) => {
    const unknownProtocols = [
      ...new Map(
        [
          ...release.unscopedProtocols,
          ...release.contexts.filter((context) => context.regionKey === null).flatMap((context) => context.protocols)
        ].map((protocol) => [protocol.key, protocol])
      ).values()
    ]
    return {
      ...release,
      displayTitle: release.title,
      cells: regions.map((region) => ({
        key: region.key,
        protocols: [
          ...new Map(
            release.contexts
              .filter((context) => context.regionKey === region.key)
              .flatMap((context) => context.protocols)
              .map((protocol) => [protocol.key, protocol])
          ).values()
        ]
      })),
      unknownProtocols
    }
  })
  const hasReleases = isNonEmptyArray(releaseItems)
  const remainingColumnCount = Math.max(1, regions.length + Number(hasUnknownRegion))

  return (
    <tbody {...rootAttrs} className={cl(styles.root, className)}>
      {!hasReleases && (
        <tr>
          <th scope="row" className={styles.titleCell}>
            <Link href={href}>{chronicle.title}</Link>
          </th>
          <td colSpan={remainingColumnCount} className={styles.cell} title={messages.noProtocols}>
            —
          </td>
        </tr>
      )}
      {releaseItems.map((release) => (
        <tr key={release.key}>
          <th scope="row" className={styles.titleCell}>
            <Link href={`${href}#${release.key.split(':').at(-1)}`}>{release.displayTitle}</Link>
          </th>
          {release.cells.map((cell) => (
            <td key={cell.key} className={styles.cell}>
              <ProtocolLinks protocols={cell.protocols} context={release.displayTitle} locale={locale} />
            </td>
          ))}
          {hasUnknownRegion && (
            <td className={styles.cell}>
              <ProtocolLinks protocols={release.unknownProtocols} context={release.displayTitle} locale={locale} />
            </td>
          )}
        </tr>
      ))}
    </tbody>
  )
}
