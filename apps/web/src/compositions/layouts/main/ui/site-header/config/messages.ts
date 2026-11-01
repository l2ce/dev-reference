/**
 * Подписи постоянной навигации и внешней ссылки на проект.
 */
export const headerMessages = {
  en: {
    documentation: 'Reference',
    navigation: 'Main navigation',
    githubHint: 'GitHub · opens in a new tab'
  },
  ru: {
    documentation: 'Справочник',
    navigation: 'Главная навигация',
    githubHint: 'GitHub · откроется в новой вкладке'
  }
} as const

/**
 * Единое написание бренда и внешние ссылки верхней панели.
 */
export const headerBrand = {
  name: 'l2ce/dev-reference',
  shortName: 'l2ce',
  product: 'dev-reference',
  github: 'GitHub',
  repository: 'https://github.com/l2ce/dev-reference'
} as const
