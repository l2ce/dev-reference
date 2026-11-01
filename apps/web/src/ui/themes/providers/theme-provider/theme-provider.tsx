import { MantineProvider } from '@mantine/core'
import type { JSX } from 'react'
import { theme } from '../../config/theme.config'
import { systemColorSchemeManager } from '../../config/system-color-scheme'
import type { ThemeProviderProps } from './types/theme-provider-props.type'
import '../../styles/index.css'

/**
 * Подключает единую тему и системную цветовую схему.
 *
 * Используется для:
 *  - оформления серверного содержимого и интерактивных элементов
 */
export const ThemeProvider = (props: ThemeProviderProps): JSX.Element => {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto" colorSchemeManager={systemColorSchemeManager}>
      {props.children}
    </MantineProvider>
  )
}
