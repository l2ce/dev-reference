/**
 * Словари каталога и его локального поиска.
 */
export const catalogMessages = {
  ru: {
    eyebrow: 'СПРАВОЧНИК / ПРОТОКОЛЫ',
    title: 'Выберите точный профиль',
    description:
      'Номер — отправная точка. Уточните контекст клиента, прежде чем переходить к пакетам и механизмам обмена.',
    search: 'Найти протокол',
    placeholder: 'Номер, выпуск или название…',
    empty: 'Ничего не найдено. Попробуйте другой номер или название.',
    count: 'Найдено профилей',
    open: 'Открыть профиль',
    missingSummary: 'Описание на выбранном языке пока отсутствует.'
  },
  en: {
    eyebrow: 'REFERENCE / PROTOCOLS',
    title: 'Choose an exact profile',
    description:
      'A number is a starting point. Identify the client context before exploring packets and exchange mechanisms.',
    search: 'Find a protocol',
    placeholder: 'Number, release or title…',
    empty: 'No matches. Try another number or title.',
    count: 'Matching profiles',
    open: 'Open profile',
    missingSummary: 'A description in this language is not available yet.'
  }
} as const
