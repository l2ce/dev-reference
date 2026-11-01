/**
 * Подписи предметных состояний и диагностики чтения справочника.
 */
export const referenceMessages = {
  ru: {
    sections: { article: 'Статьи', scenario: 'Сценарии', packet: 'Пакеты' },
    sectionDescriptions: {
      article: 'Устройство соединений, кодирование, шифрование и другие механизмы обмена.',
      scenario: 'Последовательности сообщений: от установки соединения до взаимодействия с игровым миром.',
      packet: 'Сообщения клиента и сервера: опкоды, направления и известные форматы.'
    },
    status: {
      missing: 'Нет описания',
      partial: 'Частично исследовано',
      documented: 'Описано'
    },
    translation: {
      ready: 'Перевод готов',
      missing: 'Перевод отсутствует',
      outdated: 'Перевод устарел'
    },
    kind: { packet: 'Пакет', scenario: 'Сценарий', article: 'Статья' },
    availability: {
      available: '',
      'not-found': 'Материал не найден.',
      unmapped: 'Для этого протокола описание отсутствует.',
      'translation-missing': 'Текст на выбранном языке пока отсутствует.'
    },
    unresolved: 'Ссылка или вставка недоступна в выбранном протоколе и языке',
    cycle: 'Циклическая вставка Markdown',
    unknownValue: 'Значение не установлено'
  },
  en: {
    sections: { article: 'Articles', scenario: 'Scenarios', packet: 'Packets' },
    sectionDescriptions: {
      article: 'Connections, encoding, encryption, and the mechanics behind the exchange.',
      scenario: 'Follow the conversation, from establishing a connection to interacting with the game world.',
      packet: 'Client and server messages: opcodes, directions, and known formats.'
    },
    status: {
      missing: 'Not described',
      partial: 'Partially researched',
      documented: 'Documented'
    },
    translation: {
      ready: 'Translation ready',
      missing: 'Translation missing',
      outdated: 'Translation outdated'
    },
    kind: { packet: 'Packet', scenario: 'Scenario', article: 'Article' },
    availability: {
      available: '',
      'not-found': 'Document not found.',
      unmapped: 'No description is available for this protocol.',
      'translation-missing': 'The text is not available in the selected language yet.'
    },
    unresolved: 'The reference is unavailable for the selected protocol and language',
    cycle: 'Cyclic Markdown inclusion',
    unknownValue: 'Value not established'
  }
} as const

/**
 * Сборочные ошибки, которые нельзя выдавать за пустой справочник.
 */
export const referenceErrors = {
  pagination: 'Пагинация справочника не продвигается к следующей странице.',
  locale: 'В SQLite отсутствует язык, для которого настроен интерфейс Web.',
  document: 'ReferenceReader не вернул результат запрошенного документа.',
  key: 'Некорректный публичный ключ документа.'
} as const
