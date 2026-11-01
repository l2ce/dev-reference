import { createTheme, Input } from '@mantine/core'

/**
 * Общая типографика и визуальные параметры справочника.
 */
export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'xs',
  radius: { xs: '2px', sm: '3px', md: '3px', lg: '3px', xl: '3px' },
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  headings: { fontFamily: 'inherit', fontWeight: '600' },
  components: {
    Input: Input.extend({
      styles: {
        input: {
          backgroundColor: 'var(--app-canvas)',
          color: 'var(--app-text)',
          borderColor: 'var(--app-border)'
        }
      }
    })
  },
  respectReducedMotion: true,
  breakpoints: { xs: '30em', sm: '48em', md: '64em', lg: '75em', xl: '90em' }
})
