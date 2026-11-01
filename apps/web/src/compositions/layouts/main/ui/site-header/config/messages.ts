/**
 * Подписи постоянной навигации и внешней ссылки на проект.
 */
export const headerMessages = {
  en: {
    documentation: 'Documentation',
    navigation: 'Main navigation',
    githubHint: 'GitHub · opens in a new tab'
  },
  ru: {
    documentation: 'Документация',
    navigation: 'Главная навигация',
    githubHint: 'GitHub · откроется в новой вкладке'
  }
} as const

/**
 * Единое написание бренда и внешние ссылки верхней панели.
 */
export const headerBrand = {
  name: 'L2ce/dev-reference',
  mark: 'l2',
  github: 'GitHub',
  repository: 'https://github.com/l2ce/dev-reference'
} as const
