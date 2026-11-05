import cl from 'clsx'
import type { JSX } from 'react'
import { getProtocolCatalog } from 'domains/reference/server'
import { ProtocolBrowser } from 'compositions/screens/catalog/ui/protocol-browser/client'
import { CATALOG_MESSAGES } from './config/messages'
import type { CatalogScreenProps } from './types/catalog-screen-props.type'
import styles from './styles/catalog.module.css'

/**
 * Показывает ветки и хроники с поиском и доступностью документации протоколов.
 *
 * Используется для:
 *  - выбора профиля из статически отрендеренного каталога
 */
export const CatalogScreen = (props: CatalogScreenProps): JSX.Element => {
  const { locale, className, ...rootAttrs } = props
  const messages = CATALOG_MESSAGES[locale]
  const catalogData = getProtocolCatalog(locale)

  return (
    <section {...rootAttrs} className={cl(styles.root, className)}>
      <ProtocolBrowser locale={locale} catalog={catalogData}>
        <header className={styles.header}>
          <h1 className={styles.title}>{messages.title}</h1>
          <p className={styles.description}>{messages.description}</p>
        </header>
      </ProtocolBrowser>
    </section>
  )
}
