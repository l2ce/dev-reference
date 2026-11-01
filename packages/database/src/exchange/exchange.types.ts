import type {
  Collection,
  DatabaseManifest,
  Locale,
  FileAddress,
} from '../model/model.types.js';

/**
 * Физический адрес строки таблицы; локаль остаётся обычной SQL-колонкой.
 */
export interface TableFileAddress {
  /* Имя таблицы из sqlite_schema. */
  readonly table: string;
  /* Относительный путь table/primary-key.json. */
  readonly path: string;
  /* У SQL-строки нет коллекции предметного API. */
  readonly collection?: never;
  /* Табличный экспорт не группируется по языкам. */
  readonly locale?: never;
}

/**
 * Файл нового табличного либо прежнего документного обмена.
 */
export type ExchangeFileAddress =
  | TableFileAddress
  | (FileAddress & {
      /* Документ прежнего формата не является физической SQL-строкой. */
      readonly table?: never;
    });

/**
 * План таблицы, полученный из согласованного SQL-снимка или его манифеста.
 */
export interface TablePlan {
  /* Физическое имя таблицы. */
  readonly name: string;
  /* Число строк, включая ноль для пустой таблицы. */
  readonly rows: number;
}

/**
 * Стадия файлового обмена; complete возможна только после успешной фиксации.
 */
export type ExchangePhase =
  'scan' | 'read' | 'validate' | 'write' | 'commit' | 'complete';
/**
 * Измерение одной файловой операции; чтение JSON и запись SQLite учитываются отдельно.
 */
export interface FileTiming {
  /* Полный логический адрес файла JSON. */
  readonly record: ExchangeFileAddress;
  /* Измеренный этап обработки. */
  readonly phase: 'read' | 'write';
  /* Продолжительность операции без синхронного вывода наблюдателя, мс. */
  readonly durationMs: number;
}
/**
 * Состояние коллекции: prepared означает подготовку, а не фиксацию результата.
 */
export type CollectionProgressStatus =
  'waiting' | 'active' | 'prepared' | 'complete' | 'failed' | 'aborted';
/**
 * Прогресс коллекции выбранного языка либо всех локалей; путь файла содержит локаль.
 */
export interface CollectionProgress<Name extends string = Collection> {
  /* Имя коллекции, совпадающее с каталогом и API. */
  readonly collection: Name;
  /* Число карточек и имплементаций; null до сканирования. */
  readonly total: number | null;
  /* Успешно прочитанные JSON-файлы; экспорт читает SQL-снимок целиком. */
  readonly read: number;
  /* Подготовленные строки SQLite или JSON-файлы до общей фиксации. */
  readonly written: number;
  /* Общая готовность коллекции; до фиксации максимум 99%. */
  readonly percent: number;
  /* Состояние коллекции с учётом общей транзакции. */
  readonly status: CollectionProgressStatus;
  /* Последний этап файловой обработки; null до первой записи. */
  readonly phase: 'read' | 'write' | null;
  /* Сумма времени успешного чтения файлов, мс. */
  readonly readMs: number;
  /* Сумма времени успешной записи файлов или SQL-строк, мс. */
  readonly writeMs: number;
  /* Текущий, последний либо ошибочный файл коллекции. */
  readonly record?: ExchangeFileAddress;
  /* Завершённое время последней операции либо прошедшее время текущей, мс. */
  readonly recordMs: number;
  /* true только во время выполнения конкретной файловой операции. */
  readonly active: boolean;
  /* Самая медленная завершённая операция коллекции. */
  readonly slowest?: FileTiming;
}
/**
 * Независимый прогресс физической таблицы, включая пустые и служебные таблицы.
 */
export interface TableProgress extends Omit<
  CollectionProgress<string>,
  'collection'
> {
  /* Физическое имя из динамического плана обмена. */
  readonly table: string;
}
/**
 * Независимый прогресс коллекций одной языковой базы.
 */
export interface LocaleProgress {
  /* Язык из манифеста; порядок языков совпадает с планом обмена. */
  readonly locale: Locale;
  /* Счётчики только этого языка, включая пустые коллекции. */
  readonly collections: readonly CollectionProgress[];
}
/**
 * Диагностика сбоя обмена; отсутствие path означает общую ошибку этапа.
 */
export interface ExchangeFailure {
  /* Машинный код исходной ошибки либо UNEXPECTED_ERROR. */
  readonly code: string;
  /* Исходное сообщение для человека. */
  readonly message: string;
  /* Конкретный файл, если он известен. */
  readonly path?: string;
  /* true, если сбой произошёл уже после фиксации результата. */
  readonly committed: boolean;
}
/**
 * Событие прогресса для терминала или будущего интерфейса приложения.
 */
export interface ExchangeProgress {
  /* Направление обмена. */
  readonly operation: 'import' | 'export';
  /* Начало/завершение файла различаются, чтобы учитывать медленные и ошибочные операции. */
  readonly event: 'stage' | 'record-start' | 'record-complete' | 'failure';
  /* Текущая стадия; write ещё не подтверждает фиксацию результата. */
  readonly phase: ExchangePhase;
  /* Целый общий процент 0–100; 100 только у complete. */
  readonly percent: number;
  /* Обработанные записи текущей стадии. */
  readonly completed: number;
  /* Число записей стадии; null до окончания сканирования. */
  readonly total: number | null;
  /* Текущий либо завершённый файл; при ошибке — проблемная запись, если известна. */
  readonly record?: ExchangeFileAddress;
  /* Общее прошедшее время операции, включая проверку и фиксацию, мс. */
  readonly elapsedMs: number;
  /* Сколько длится текущий этап, мс. */
  readonly phaseElapsedMs: number;
  /* Время завершённых этапов, включая вывод наблюдателя, мс. */
  readonly phaseDurationsMs: Readonly<Partial<Record<ExchangePhase, number>>>;
  /* Независимые снимки всех коллекций, включая ещё не начатые. */
  readonly collections: readonly CollectionProgress[];
  /* Динамический список физических таблиц; пуст для прежнего документного импорта. */
  readonly tables: readonly TableProgress[];
  /* Блоки объявленных языков; до чтения плана массив пуст. */
  readonly locales: readonly LocaleProgress[];
  /* Ошибка завершившегося обмена; отсутствует в обычных событиях. */
  readonly failure?: ExchangeFailure;
}
/**
 * Синхронный наблюдатель прогресса; не должен бросать исключения или изменять источник.
 */
export type ProgressObserver = (progress: ExchangeProgress) => void;
/**
 * Внутренний отправитель стадий с вычислением общего процента.
 */
export interface ProgressReporter {
  /**
   * Переключает этап; complete подтверждает фиксацию всех коллекций.
   */
  stage(phase: ExchangePhase, completed?: number, total?: number | null): void;
  /**
   * Регистрирует файлы и порядок языков до пофайловой обработки.
   * Без явного реестра языки определяются по порядку появления в records.
   */
  plan(records: readonly FileAddress[], locales?: readonly Locale[]): void;
  /**
   * Регистрирует фактические таблицы и объёмы, заменяя документный план.
   */
  planTables(tables: readonly TablePlan[]): void;
  /**
   * Объявляет файл до I/O и запускает измерение после вывода наблюдателя.
   */
  startRecord(phase: 'read' | 'write', record: ExchangeFileAddress): void;
  /**
   * Фиксирует успешное завершение одного файла и обновляет метрики коллекции.
   */
  finishRecord(): void;
  /**
   * Отмечает файл сбоя и отменённые коллекции, сохраняя исходную ошибку.
   */
  fail(error: unknown): void;
}
/**
 * Общие параметры обмена для CLI и программного вызова.
 */
export interface ExchangeOptions {
  /* SQLite-файл; по умолчанию .local/database.sqlite пакета. */
  readonly database?: string;
  /* Наблюдатель стадий и обрабатываемых записей. */
  readonly onProgress?: ProgressObserver;
}
/**
 * Импорт полного снимка с заменой содержимого в транзакции.
 */
export interface ImportOptions extends ExchangeOptions {
  /* Исходный JSON-каталог; по умолчанию data пакета. */
  readonly input?: string;
}
/**
 * Экспорт полного снимка со staging-каталогом и заменой предыдущего экспорта.
 */
export interface ExportOptions extends ExchangeOptions {
  /* Каталог назначения; по умолчанию data пакета. */
  readonly output?: string;
}
/**
 * Итог подтверждённого импорта или экспорта.
 */
export interface ExchangeResult {
  /* Полное время обмена до фиксации и закрытия SQLite, включая вывод прогресса, мс. */
  readonly durationMs: number;
  /* Абсолютный путь SQLite-файла. */
  readonly database: string;
  /* Абсолютный путь JSON-каталога. */
  readonly directory: string;
  /* Число предметных карточек и служебных документов. */
  readonly entities: number;
  /* Общее число карточек, служебных документов и имплементаций. */
  readonly records: number;
  /* Языковые базы полного снимка. */
  readonly locales: readonly Locale[];
  /* Число физических таблиц; отсутствует у прежнего документного импорта. */
  readonly tables?: number;
  /* Число SQL-строк/JSON-файлов; records сохраняет число предметных документов. */
  readonly rows?: number;
}
/**
 * Проверенный список файлов до чтения содержимого записей.
 */
export interface DirectoryInventory {
  /* Проверенный корневой манифест. */
  readonly manifest: DatabaseManifest;
  /* Адреса всех записей в стабильном порядке. */
  readonly records: readonly FileAddress[];
}
