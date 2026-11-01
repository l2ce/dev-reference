import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { {{name.pascalCase}}Props } from './types/{{name.kebabCase}}-props.type'
import styles from './styles/{{name.kebabCase}}.module.css'

/**
 * Отображает содержимое {{name.pascalCase}}.
 *
 * Используется для:
 *  - предоставления визуального контракта потребителям юнита
 */
export const {{name.pascalCase}} = (props: {{name.pascalCase}}Props): ReactNode => {
  const { children, className, ...rootAttrs } = props

  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      {children}
    </div>
  )
}
