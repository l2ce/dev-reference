import cl from 'clsx'
import type { JSX } from 'react'
import { useDocumentOutline } from './hooks/use-document-outline'
import { outlineMessages } from './config/messages'
import type { TableOfContentsProps } from './types/table-of-contents-props.type'
import styles from './styles/table-of-contents.module.css'

/**
 * Даёт быстрый доступ к заголовкам и источникам текущего документа.
 *
 * Используется для:
 *  - навигации по длинным документам на любом размере экрана
 */
export const TableOfContents = ({ locale, collapsed = false }: TableOfContentsProps): JSX.Element => {
  const headingItems = useDocumentOutline()
  const messages = outlineMessages[locale]
  return (
    <details className={styles.root} open={!collapsed}>
      <summary className={styles.title}>{messages.title}</summary>
      <nav className={styles.links} aria-label={messages.title}>
        {headingItems.map((heading) => (
          <a className={cl(styles.link, { [styles._nested]: heading.nested })} href={`#${heading.id}`} key={heading.id}>
            {heading.title}
          </a>
        ))}
      </nav>
      <a className={styles.top} href="#document-title">
        {messages.top}
      </a>
    </details>
  )
}
