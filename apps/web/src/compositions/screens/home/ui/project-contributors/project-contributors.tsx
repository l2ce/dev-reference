import 'server-only'
import { Tooltip } from '@mantine/core'
import cl from 'clsx'
import Image from 'next/image'
import type { JSX } from 'react'
import { getProjectContributors } from 'domains/contributors/server'
import { isNotDefined, isEmptyArray, isDefined } from 'shared/lib/value-predicates'
import { CONTRIBUTORS_MESSAGES } from './config/messages'
import type { ProjectContributorsProps } from './types/project-contributors-props.type'
import styles from './styles/project-contributors.module.css'

/**
 * Представляет участников справочника компактной группой их аватаров.
 *
 * Используется для:
 *  - отображения списка участников, подготовленного при статической сборке
 *  - перехода на GitHub при недоступности списка
 */
export const ProjectContributors = async (props: ProjectContributorsProps): Promise<JSX.Element> => {
  const { locale, className, ...rootAttrs } = props
  const messages = CONTRIBUTORS_MESSAGES[locale]
  const contributorItems = await getProjectContributors()
  const isUnavailable = isNotDefined(contributorItems)
  const hasNoContributors = isDefined(contributorItems) && isEmptyArray(contributorItems)

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <h2 className={styles.title}>{messages.title}</h2>
      <p className={styles.description}>{messages.description}</p>
      {isDefined(contributorItems) && (
        <ul className={styles.people}>
          {contributorItems.map((contributor) => (
            <li className={styles.personItem} key={contributor.id}>
              <Tooltip
                label={contributor.login}
                openDelay={200}
                events={{ hover: true, focus: true, touch: true }}
                withArrow
                multiline
                maw={280}
                interactive
              >
                <a className={styles.person} href={contributor.profileUrl} aria-label={contributor.login}>
                  <Image
                    className={styles.avatar}
                    src={contributor.avatarUrl}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                  />
                </a>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      {isUnavailable && <p className={styles.note}>{messages.unavailable}</p>}
      {hasNoContributors && <p className={styles.note}>{messages.empty}</p>}
      <a className={styles.github} href="https://github.com/l2ce/dev-reference/graphs/contributors">
        {messages.github}
        <span aria-hidden="true"> ↗</span>
      </a>
    </section>
  )
}
