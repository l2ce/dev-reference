/**
 * Подписи поиска, фильтров и состояний больших списков документации.
 */
export const sectionBrowserMessages = {
  en: {
    search: 'Search this section',
    placeholder: 'Search by name, opcode, or content…',
    server: 'Server',
    allServers: 'All servers',
    direction: 'Direction',
    allDirections: 'Both directions',
    outgoing: 'Client → Server',
    incoming: 'Server → Client',
    results: 'documents',
    empty: 'No documents found',
    emptyHint: 'Try a different search or clear the filters.',
    notStarted: 'This section is waiting to be explored.',
    notStartedHint:
      'Choose another section from the navigation to keep reading.',
    clear: 'Clear filters',
    title: 'DOCUMENT',
    opcode: 'OPCODE',
    context: 'CONTEXT',
    status: 'RESEARCH',
    pages: 'Document pages',
  },
  ru: {
    search: 'Поиск по разделу',
    placeholder: 'Название, опкод или текст…',
    server: 'Сервер',
    allServers: 'Все серверы',
    direction: 'Направление',
    allDirections: 'Оба направления',
    outgoing: 'Клиент → Сервер',
    incoming: 'Сервер → Клиент',
    results: 'материалов',
    empty: 'Материалы не найдены',
    emptyHint: 'Измените запрос или сбросьте фильтры.',
    notStarted: 'Этот раздел ещё предстоит исследовать.',
    notStartedHint:
      'Выберите другой раздел в навигации, чтобы продолжить чтение.',
    clear: 'Сбросить фильтры',
    title: 'МАТЕРИАЛ',
    opcode: 'ОПКОД',
    context: 'КОНТЕКСТ',
    status: 'ИССЛЕДОВАНИЕ',
    pages: 'Страницы материалов',
  },
} as const;
