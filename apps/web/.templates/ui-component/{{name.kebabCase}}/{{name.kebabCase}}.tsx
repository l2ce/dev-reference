import cl from 'clsx'
import type { JSX } from 'react'
import type { {{name.pascalCase}}Props } from './types/{{name.kebabCase}}-props.type'
import styles from './styles/{{name.kebabCase}}.module.css'

/**
 * <Назначение компонента {{name.pascalCase}} в одной строке>.
 *
 * Используется для:
 *  - <сценарий применения>
 */
export const {{name.pascalCase}} = (props: {{name.pascalCase}}Props): JSX.Element => {
  const { children, className, ...rootAttrs } = props

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      {children}
    </div>
  )
}
