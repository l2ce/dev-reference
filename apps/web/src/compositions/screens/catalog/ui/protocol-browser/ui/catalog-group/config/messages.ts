/**
 * Подписи структуры каталога и состояния отдельных протоколов.
 */
export const GROUP_MESSAGES = {
  ru: {
    additional: 'Дополнительные сведения вне исходной таблицы',
    chronicle: 'Хроника / выпуск',
    unknownRegion: 'Регион не установлен',
    table: 'Протоколы по выпускам и регионам; таблицу можно прокручивать по горизонтали',
    noChronicles: 'Хроники этой ветки пока не добавлены.',
    noProtocols: 'Номер протокола пока не установлен.',
    noDescription: 'Пока без описаний',
    materials: ['материал', 'материала', 'материалов'],
    open: 'Открыть протокол',
    designation: 'Обозначение справочника',
    translationMissing: 'Перевод отсутствует',
    translationOutdated: 'Перевод требует обновления'
  },
  en: {
    additional: 'Additional records outside the initial table',
    chronicle: 'Chronicle / release',
    unknownRegion: 'Region unknown',
    table: 'Protocols by release and region; scroll horizontally to see all columns',
    noChronicles: 'No chronicles have been added to this branch yet.',
    noProtocols: 'The protocol number has not been established yet.',
    noDescription: 'No descriptions yet',
    materials: ['document', 'documents', 'documents'],
    open: 'Open protocol',
    designation: 'Reference identifier',
    translationMissing: 'Translation unavailable',
    translationOutdated: 'Translation needs updating'
  }
} as const
