import { Tooltip } from '@mantine/core'
import { IconBook2 } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { JSX } from 'react'
import { localePath } from 'shared/localization'
import { LanguageMenu } from 'compositions/layouts/main/ui/site-header/ui/language-menu/client'
import { ThemeMenu } from 'compositions/layouts/main/ui/site-header/ui/theme-menu/client'
import { headerMessages, headerBrand } from './config/messages'
import type { SiteHeaderProps } from './types/site-header-props.type'
import styles from './styles/site-header.module.css'

/**
 * Собирает бренд, основные ссылки и компактные настройки чтения.
 *
 * Используется для:
 *  - перехода в справочник и к исходному коду
 *  - постоянного доступа к выбору языка и оформления
 */
export const SiteHeader = ({ locale }: SiteHeaderProps): JSX.Element => {
  const pathname = usePathname()
  const messages = headerMessages[locale]
  const isDocumentation = pathname.includes('/protocols')
  const documentationCurrent = isDocumentation ? 'page' : undefined

  return (
    <header className={styles.root}>
      <div className={styles.inner}>
        <Link className={styles.brand} href={localePath(locale)} aria-label={headerBrand.name}>
          <span>{headerBrand.shortName}</span>
          <span className={styles.brandSuffix}>
            <span className={styles.brandSeparator} aria-hidden="true">
              /
            </span>
            {headerBrand.product}
          </span>
        </Link>
        <nav className={styles.navigation} aria-label={messages.navigation}>
          <Link
            className={styles.link}
            href={localePath(locale, '/protocols/')}
            aria-current={documentationCurrent}
            aria-label={messages.documentation}
          >
            <IconBook2 size={20} stroke={1.8} aria-hidden="true" />
            <span className={styles.linkLabel}>{messages.documentation}</span>
          </Link>
          <Tooltip label={messages.githubHint} openDelay={400} events={{ hover: true, focus: true, touch: false }}>
            <a
              className={styles.link}
              href={headerBrand.repository}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={messages.githubHint}
            >
              <span className={styles.githubIcon} aria-hidden="true" />
              <span className={styles.linkLabel}>{headerBrand.github}</span>
            </a>
          </Tooltip>
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.controls}>
            <LanguageMenu locale={locale} />
            <ThemeMenu locale={locale} />
          </div>
        </nav>
      </div>
    </header>
  )
}
