import cl from 'clsx'
import type { JSX } from 'react'
import { SiteFooter } from 'compositions/layouts/main/ui/site-footer'
import { SiteHeader } from 'compositions/layouts/main/ui/site-header/client'
import { mainMessages } from './config/messages'
import type { MainLayoutProps } from './types/main-layout-props.type'
import styles from './styles/main.module.css'

/**
 * Собирает общий каркас витрины и документации.
 *
 * Используется для:
 *  - постоянной навигации и доступного перехода к серверному содержимому
 */
export const MainLayout = ({ children, locale, className, ...rootAttrs }: MainLayoutProps): JSX.Element => {
  const messages = mainMessages[locale]
  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <a className={styles.skip} href="#content">
        {messages.skip}
      </a>
      <SiteHeader locale={locale} />
      <main className={styles.content} id="content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
