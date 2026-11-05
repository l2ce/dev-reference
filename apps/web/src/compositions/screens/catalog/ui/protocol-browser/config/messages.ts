/**
 * Подписи поиска и доступности материалов в каталоге.
 */
export const BROWSER_MESSAGES = {
  en: {
    branches: 'Game branches',
    legend: 'Numbers open documentation. ● Materials available. — Not established. The table scrolls horizontally ↔.',
    empty: 'No matches found',
    emptyHint: 'Try another number or chronicle name, or reset the filters.',
    notStarted: 'The protocol catalog is being prepared',
    notStartedHint: 'Branches, chronicles and protocols will appear here as the reference grows.',
    reset: 'Reset filters',
    unassigned: 'Context to be established',
    ambiguous: 'This number occurs in multiple profiles. Choose the matching chronicle and context.'
  },
  ru: {
    branches: 'Ветки игры',
    legend: 'Номер открывает документацию. ● Есть материалы. — Нет данных. Таблица прокручивается по горизонтали ↔.',
    empty: 'Ничего не найдено',
    emptyHint: 'Попробуйте другой номер, название хроники или сбросьте фильтры.',
    notStarted: 'Каталог протоколов готовится',
    notStartedHint: 'Здесь появятся ветки, хроники и протоколы по мере наполнения справочника.',
    reset: 'Сбросить фильтры',
    unassigned: 'Принадлежность уточняется',
    ambiguous: 'Этот номер встречается у нескольких профилей. Выберите подходящую хронику и контекст.'
  }
} as const
