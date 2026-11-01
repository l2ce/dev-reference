import { Button } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import { KnowledgeOverview } from 'compositions/screens/home/ui/knowledge-overview'
import { McpConnect } from 'compositions/screens/home/ui/mcp-connect/server'
import { ProjectContributors } from 'compositions/screens/home/ui/project-contributors/server'
import { siteConfig } from 'infra/site-config'
import { localePath } from 'shared/localization'
import { homeMessages } from './config/messages'
import type { HomeScreenProps } from './types/home-screen-props.type'
import styles from './styles/home.module.css'

/**
 * Знакомит со справочником, доступом через MCP и участниками проекта.
 *
 * Используется для:
 *  - первого знакомства с проектом
 *  - перехода к чтению базы знаний и подключению MCP
 */
export const HomeScreen = (props: HomeScreenProps): JSX.Element => {
  const { locale, className, ...rootAttrs } = props
  const messages = homeMessages[locale]
  const catalogHref = `${siteConfig.basePath}${localePath(locale, '/protocols/')}`

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <div className={styles.hero}>
        <header className={styles.introduction}>
          <h1 className={styles.title}>{messages.title}</h1>
          <p className={styles.description}>{messages.description}</p>
          <p className={styles.audience}>{messages.audience}</p>
          <KnowledgeOverview locale={locale} className={styles.knowledge} />
          <Button className={styles.primary} color="indigo.7" component="a" href={catalogHref} size="sm">
            {messages.action}
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
          </Button>
        </header>
        <McpConnect locale={locale} />
      </div>
      <ProjectContributors locale={locale} className={styles.community} />
    </section>
  )
}
