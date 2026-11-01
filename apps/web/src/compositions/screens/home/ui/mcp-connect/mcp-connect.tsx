import 'server-only'
import cl from 'clsx'
import type { JSX } from 'react'
import { CopyConfiguration } from 'compositions/screens/home/ui/mcp-connect/ui/copy-configuration/client'
import { MCP_CONFIGURATION, MCP_GUIDE_URL } from './config/mcp.config'
import { MCP_MESSAGES } from './config/messages'
import type { McpConnectProps } from './types/mcp-connect-props.type'
import styles from './styles/mcp-connect.module.css'

/**
 * Представляет доступ к справочнику через MCP и готовую конфигурацию подключения.
 *
 * Используется для:
 *  - подключения базы знаний к AI-ассистенту с главной страницы
 */
export const McpConnect = (props: McpConnectProps): JSX.Element => {
  const { locale, className, ...rootAttrs } = props
  const messages = MCP_MESSAGES[locale]

  return (
    <aside {...rootAttrs} className={cl(styles.root, className)} aria-labelledby="mcp-connect-title">
      <p className={styles.eyebrow}>MCP</p>
      <h2 className={styles.title} id="mcp-connect-title">
        {messages.title}
      </h2>
      <p className={styles.description}>{messages.description}</p>
      <div className={styles.configuration}>
        <div className={styles.toolbar}>
          <span className={styles.format}>JSON</span>
          <CopyConfiguration locale={locale} configuration={MCP_CONFIGURATION} />
        </div>
        <pre className={styles.code} tabIndex={0} aria-label={messages.configuration}>
          <code>{MCP_CONFIGURATION}</code>
        </pre>
      </div>
      <a className={styles.guide} href={MCP_GUIDE_URL}>
        {messages.guide}
        <span aria-hidden="true"> →</span>
      </a>
      <p className={styles.note}>{messages.capabilities}</p>
    </aside>
  )
}
