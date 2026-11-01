import type { ReactElement } from 'react'
import { MainLayout } from 'compositions/layouts/main'
import { SYSTEM_COLOR_SCHEME, ThemeBootstrap } from 'ui/themes'
import { ThemeProvider } from 'ui/themes/client'
import type { DocumentShellProps } from './types/route-props.type'

/**
 * Соединяет обязательный HTML, готовые провайдеры и публичный каркас.
 * Системный framework-файл без собственной продуктовой разметки.
 */
export function RootDocument({ children, locale }: DocumentShellProps): ReactElement {
  return (
    <html lang={locale}>
      <head>
        <meta name="color-scheme" content={SYSTEM_COLOR_SCHEME} />
        <ThemeBootstrap />
      </head>
      <body>
        <ThemeProvider>
          <MainLayout locale={locale}>{children}</MainLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
