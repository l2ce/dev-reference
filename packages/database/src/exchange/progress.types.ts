import type { Collection, Locale } from '../model/model.types.js';
import type {
  CollectionProgressStatus,
  ExchangeFailure,
  ExchangePhase,
  ExchangeProgress,
  FileTiming,
  ProgressObserver,
  ExchangeFileAddress,
} from './exchange.types.js';

/**
 * Изменяемые счётчики коллекции, принадлежащие одному сценарию обмена.
 */
export interface CollectionMetrics {
  /* Язык отдельного блока; undefined обозначает общий счётчик всех языков. */
  readonly locale?: Locale;
  /* Коллекция файлов. */
  readonly collection: string;
  /* Плановое количество файлов либо null до сканирования. */
  total: number | null;
  /* Число завершённых чтений. */
  read: number;
  /* Число завершённых записей. */
  written: number;
  /* Состояние обработки и фиксации. */
  status: CollectionProgressStatus;
  /* Последний файловый этап. */
  phase: 'read' | 'write' | null;
  /* Накопленное время чтения, мс. */
  readMs: number;
  /* Накопленное время записи, мс. */
  writeMs: number;
  /* Последний или выполняемый файл. */
  record?: ExchangeFileAddress;
  /* Измеренная длительность последней операции, мс. */
  recordMs: number;
  /* Самая медленная завершённая операция. */
  slowest?: FileTiming;
}
/**
 * Незавершённая операция; время отсчитывается после уведомления о её начале.
 */
export interface ActiveRecord {
  /* Полный адрес текущего файла. */
  readonly record: ExchangeFileAddress;
  /* Чтение JSON либо запись SQLite/JSON. */
  readonly phase: 'read' | 'write';
  /* Монотонная отметка performance.now(), мс. */
  startedAt: number;
}
/**
 * Частное состояние одного репортера прогресса.
 */
export interface ProgressState {
  /* Направление обмена. */
  readonly operation: ExchangeProgress['operation'];
  /* Наблюдатель событий; undefined отключает внешний вывод. */
  readonly observer?: ProgressObserver;
  /* Монотонное время начала сценария. */
  readonly startedAt: number;
  /* Независимые метрики всех объявленных коллекций. */
  readonly collections: Map<Collection, CollectionMetrics>;
  /* Метрики физических таблиц, открытых при сканировании базы. */
  readonly tables: Map<string, CollectionMetrics>;
  /* Независимые счётчики языков в порядке исходного манифеста. */
  readonly localeCollections: Map<Locale, Map<Collection, CollectionMetrics>>;
  /* Текущий этап сценария. */
  phase: ExchangePhase;
  /* Монотонное время начала этапа. */
  phaseStartedAt: number;
  /* Накопленные времена завершённых этапов, мс. */
  readonly phaseDurationsMs: Partial<Record<ExchangePhase, number>>;
  /* Монотонный общий процент. */
  percent: number;
  /* Число файлов, завершённых на текущем этапе. */
  completed: number;
  /* Число файлов этапа либо null до планирования. */
  total: number | null;
  /* Выполняемая файловая операция. */
  active?: ActiveRecord;
  /* Последний файл текущей фазы для диагностики исключения наблюдателя. */
  lastRecord?: ExchangeFileAddress;
  /* Завершающая ошибка, если сценарий прерван. */
  failure?: ExchangeFailure;
}
