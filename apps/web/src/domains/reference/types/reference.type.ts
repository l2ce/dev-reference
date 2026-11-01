import type { ReferenceDocument, ReferenceReader } from '@l2ce/core/reference';
import type { Locale } from 'shared/localization';

/**
 * Неизменяемое основание сборочного чтения без открытого SQLite-соединения.
 */
export interface ReferenceContext {
  /* Reader одного согласованного снимка. */
  readonly reader: ReferenceReader;
  /* Поддерживаемые языки, присутствующие в снимке. */
  readonly locales: readonly Locale[];
  /* Технические имена пакетов для value name, независимо от заголовков переводов. */
  readonly packetNames: ReadonlyMap<string, string>;
}

/**
 * Параметры статического маршрута протокола.
 */
export interface ProtocolRoute {
  /* Выбранный язык URL. */
  readonly locale: Locale;
  /* Точный ключ без префикса protocol:, включая различитель ревизии. */
  readonly protocol: string;
}

/**
 * Параметры статического маршрута документа.
 */
export interface DocumentRoute extends ProtocolRoute {
  /* Вид карточки знания. */
  readonly kind: ReferenceDocument['kind'];
  /* Код логической карточки без номера технической редакции. */
  readonly code: string;
}

/**
 * Подготовленный документ с разрешёнными директивами и явными пробелами.
 */
export interface PreparedDocument {
  /* Исходный предметный результат выбранного профиля и языка. */
  readonly document: ReferenceDocument;
  /* Markdown после обработки директив; пуст при отсутствии текста. */
  readonly markdown: string;
  /* Диагностики неразрешённых директив и циклических вставок. */
  readonly issues: readonly string[];
  /* Источники исходного документа и реально включённых материалов. */
  readonly sources: ReferenceDocument['sources'];
}
