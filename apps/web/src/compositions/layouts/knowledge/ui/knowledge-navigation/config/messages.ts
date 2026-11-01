/**
 * Подписи постоянной навигации и мобильной панели.
 */
export const navigationMessages = {
  en: {
    overview: 'Overview',
    protocol: 'Protocol',
    sections: 'DOCUMENTATION',
    search: 'Find in this section',
    empty: 'No matching documents.',
    all: 'All protocols',
    open: 'Browse',
    close: 'Close navigation',
    current: 'IN THIS SECTION',
    unavailable:
      'This document has not been mapped to the selected protocol. Explore its available documentation below.',
    overviewHint: 'Choose a section to explore its documentation.'
  },
  ru: {
    overview: 'Обзор',
    protocol: 'Протокол',
    sections: 'ДОКУМЕНТАЦИЯ',
    search: 'Поиск в разделе',
    empty: 'Материалы не найдены.',
    all: 'Все протоколы',
    open: 'Меню',
    close: 'Закрыть навигацию',
    current: 'В ЭТОМ РАЗДЕЛЕ',
    unavailable:
      'Для выбранного протокола применимость этого материала не установлена. Ниже доступна документация профиля.',
    overviewHint: 'Выберите раздел и изучайте его материалы.'
  }
} as const
