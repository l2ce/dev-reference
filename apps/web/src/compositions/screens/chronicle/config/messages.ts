/**
 * Подписи истории хроники, отдельно от технической документации протокола.
 */
export const CHRONICLE_MESSAGES = {
  ru: {
    back: 'Все хроники и протоколы',
    releases: 'Выпуски',
    region: 'Регион',
    date: 'Дата выхода',
    protocols: 'Протоколы',
    countries: 'Страны',
    sources: 'Источники',
    unknown: 'Не установлено',
    noReleases: 'Выпуски этой хроники пока не исследованы.',
    noDescription: 'Описание хроники пока не подготовлено.',
    noReleaseDescription: 'Описание выпуска пока не подготовлено.',
    datesHint: 'Даты относятся к конкретному региональному выпуску. — означает, что сведения ещё не установлены.',
    unscoped: 'Регион этих протоколов пока не установлен'
  },
  en: {
    back: 'All chronicles and protocols',
    releases: 'Releases',
    region: 'Region',
    date: 'Release date',
    protocols: 'Protocols',
    countries: 'Countries',
    sources: 'Sources',
    unknown: 'Not established',
    noReleases: 'The releases of this chronicle have not been researched yet.',
    noDescription: 'The chronicle description has not been prepared yet.',
    noReleaseDescription: 'The release description has not been prepared yet.',
    datesHint: 'Dates belong to individual regional releases. — means the information has not been established.',
    unscoped: 'The region of these protocols has not been established'
  }
} as const
