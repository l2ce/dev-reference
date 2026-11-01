import { Button } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import { siteConfig } from 'infra/site-config'
import { localePath } from 'shared/localization'
import { homeMessages } from './config/messages'
import type { HomeScreenProps } from './types/home-screen-props.type'
import styles from './styles/home.module.css'

/**
 * Представляет справочник и ведёт к каталогу протоколов.
 *
 * Используется для:
 *  - первого знакомства с проектом
 *  - перехода к выбору протокола в каталоге
 */
export const HomeScreen = ({ locale, className, ...rootAttrs }: HomeScreenProps): JSX.Element => {
  const messages = homeMessages[locale]
  const catalogHref = `${siteConfig.basePath}${localePath(locale, '/protocols/')}`
  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <div className={styles.hero}>
        <div className={styles.introduction}>
          <p className={styles.eyebrow}>
            <span className={styles.dot} />
            {messages.eyebrow}
          </p>
          <h1 className={styles.title}>
            {messages.title}
            <br />
            <span className={styles.accent}>{messages.titleAccent}</span>
          </h1>
          <p className={styles.description}>{messages.description}</p>
          <div className={styles.actions}>
            <Button className={styles.primary} color="indigo.7" component="a" href={catalogHref} size="md">
              {messages.action}
              <span aria-hidden="true">  →</span>
            </Button>
            <a className={styles.github} href="https://github.com/l2ce/dev-reference">
              {messages.github}
              <span aria-hidden="true"> ↗</span>
            </a>
          </div>
          <p className={styles.footnote}>{messages.footnote}</p>
        </div>
        <aside className={styles.map} aria-label={messages.map}>
          <div className={styles.mapHeader}>
            <span className={styles.mapDot} />
            <span>{messages.map}</span>
          </div>
          <div className={styles.mapRow}>
            <span className={styles.symbol}>01</span>
            <div>
              <h2>{messages.article}</h2>
              <p>{messages.articleText}</p>
            </div>
          </div>
          <div className={styles.mapRow}>
            <span className={styles.symbol}>02</span>
            <div>
              <h2>{messages.scenario}</h2>
              <p>{messages.scenarioText}</p>
            </div>
          </div>
          <div className={styles.mapRow}>
            <span className={styles.symbol}>03</span>
            <div>
              <h2>{messages.packet}</h2>
              <p>{messages.packetText}</p>
            </div>
          </div>
          <div className={styles.mapFooter}>
            <span>CLIENT</span>
            <span aria-hidden="true">← · · · · · · · · · →</span>
            <span>SERVER</span>
          </div>
        </aside>
      </div>
    </section>
  )
}
