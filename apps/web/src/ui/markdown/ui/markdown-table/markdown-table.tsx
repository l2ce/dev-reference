import type { JSX } from 'react'
import type { MarkdownTableProps } from './types/markdown-table-props.type'

/**
 * Делает широкую Markdown-таблицу доступной для прокрутки клавиатурой.
 *
 * Используется для:
 *  - чтения таблиц на узком экране без дробления слов на буквы
 */
export const MarkdownTable = (props: MarkdownTableProps): JSX.Element => {
  const { children, className } = props

  return (
    <table tabIndex={0} className={className}>
      {children}
    </table>
  )
}
