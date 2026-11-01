import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/** Собственные параметры компонента. */
type {{name.pascalCase}}Params = {
  /** Содержимое компонента. */
  children?: ReactNode
}

/** Атрибуты корневого элемента без собственных параметров. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, keyof {{name.pascalCase}}Params>

/** Свойства {{name.pascalCase}}. */
export type {{name.pascalCase}}Props = {{name.pascalCase}}Params & RootAttrs
