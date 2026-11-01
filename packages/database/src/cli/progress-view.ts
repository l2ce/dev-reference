import { stripVTControlCharacters } from 'node:util';
import { cliMessages as messages } from './messages.js';
import { progressMessages as labels } from './progress.messages.js';
import type {
  CollectionProgress,
  ExchangeProgress,
} from '../exchange/exchange.types.js';

const BAR_WIDTH = 28;

/**
 * Показывает число подготовленных записей; 100% достигается только после фиксации.
 */
function collectionLine(
  group: CollectionProgress<string>,
  nameWidth: number,
): string {
  const total = group.total ?? labels.unknown;
  let percent = 0;
  if (group.status === 'complete') {
    percent = 100;
  } else if (group.total) {
    percent = Math.min(99, Math.floor((group.written / group.total) * 100));
  }
  const filled = Math.floor((percent * BAR_WIDTH) / 100);
  const bar = '#'.repeat(filled) + '-'.repeat(BAR_WIDTH - filled);
  const line = labels.collection(
    labels.collectionName(group.collection, total).padEnd(nameWidth),
    bar,
    percent,
  );
  if (group.status === 'failed' || group.status === 'aborted') {
    return `${line} ${labels.statuses[group.status]}`;
  }
  return line;
}

/**
 * Размещает каждый язык над его коллекциями и выравнивает шкалы между всеми блоками.
 * До определения языков показывает этап; при сбое добавляет конкретный файл.
 */
export function progressFrame(event: ExchangeProgress): readonly string[] {
  const lines: string[] = [];
  if (event.tables.length > 0) {
    const width = Math.max(
      ...event.tables.map(
        (group) =>
          labels.collectionName(group.table, group.total ?? labels.unknown)
            .length,
      ),
    );
    lines.push(
      ...event.tables.map(({ table, ...metrics }) =>
        collectionLine({ ...metrics, collection: table }, width),
      ),
    );
  }
  const nameWidth = Math.max(
    0,
    ...event.locales.flatMap((language) =>
      language.collections.map(
        (group) =>
          labels.collectionName(group.collection, group.total ?? labels.unknown)
            .length,
      ),
    ),
  );
  for (const [index, language] of event.locales.entries()) {
    if (index > 0) {
      lines.push('');
    }
    lines.push(
      labels.locale(
        language.locale === 'ru' || language.locale === 'en'
          ? labels.languages[language.locale]
          : language.locale,
        language.locale,
        index + 1,
        event.locales.length,
      ),
    );
    lines.push(
      ...language.collections.map(
        (group) => `  ${collectionLine(group, nameWidth)}`,
      ),
    );
  }
  if (event.locales.length === 0 && event.tables.length === 0) {
    if (event.collections.some((group) => group.total !== null)) {
      const width = Math.max(
        ...event.collections.map(
          (group) =>
            labels.collectionName(
              group.collection,
              group.total ?? labels.unknown,
            ).length,
        ),
      );
      lines.push(
        ...event.collections.map((group) => collectionLine(group, width)),
      );
    } else {
      lines.push(messages.phases[event.phase]);
    }
  }
  if (event.failure) {
    lines.push(
      labels.failure(
        messages.phases[event.phase],
        event.failure.code,
        event.failure.message,
      ),
    );
    if (event.failure.path) {
      lines.push(`${labels.file}: ${event.failure.path}`);
    }
  }
  return lines;
}

/**
 * Возвращает однострочный текущий прогресс для терминала с недостаточной высотой.
 */
export function compactProgress(event: ExchangeProgress): string {
  const active = event.tables.find(
    (table) => table.table === event.record?.table,
  );
  if (active) {
    return labels.tableCompact(
      messages.phases[event.phase],
      event.percent,
      active.table,
      active.percent,
    );
  }
  return labels.compact(messages.phases[event.phase], event.percent);
}

/**
 * Убирает управляющие символы из одной экранной строки и ограничивает её ширину.
 */
export function terminalLine(line: string, width: number): string {
  const plain = stripVTControlCharacters(line).replace(
    /[\u0000-\u001f\u007f]/g,
    ' ',
  );
  return plain.length > width
    ? plain.slice(0, Math.max(0, width - 1)) + '…'
    : plain;
}
