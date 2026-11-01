import cl from 'clsx'
import type { JSX } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { headingAnchors } from './helpers/heading-anchors'
import type { MarkdownProps } from './types/markdown-props.type'
import { MarkdownTable } from './ui/markdown-table/markdown-table'
import styles from './styles/markdown.module.css'

/**
 * Отображает подготовленный Markdown с таблицами и безопасными ссылками.
 *
 * Используется для:
 *  - чтения документации без выполнения HTML из текста
 */
export const Markdown = (props: MarkdownProps): JSX.Element => {
  const { markdown, className, ...rootAttrs } = props

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, headingAnchors]}
        components={{ h1: 'h2', table: MarkdownTable }}
        skipHtml
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
