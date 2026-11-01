import type { Locale } from './schema.js';
import type {
  Direction,
  DocumentTranslation,
  DocumentVersion,
  EntityKind,
  EntityReference,
  KnowledgeEntity,
  Opcode,
  ResearchStatus,
  Server,
  Source,
} from './knowledge-schema.js';

/**
 * Ссылка, разрешённая в точном контексте профиля, сервера и языка.
 */
export interface ResolvedReference extends EntityReference {
  /* Полный ID профиля, включая суффикс варианта клиента. */
  protocolId: string;
  /* Язык запрошенного описания. */
  locale: Locale;
  /* Сервер, в контексте которого разрешена ссылка. */
  server: Server;
  /* ID применимого документа; null при отсутствии привязки. */
  documentVersionId: string | null;
  /* Заголовок выбранного языка; null при отсутствии текста. */
  title: string | null;
  /* Результат проверки применимости и сервера. */
  resolution: 'available' | 'unmapped' | 'wrong-server';
  /* Доступность текста точной версии без языкового fallback. */
  translationStatus: 'ready' | 'missing';
}

/**
 * Представление ссылок и ограничения раскрытия конкретного экземпляра API.
 */
export interface KnowledgeOptions {
  /* Адаптер приложения: веб-ссылка или ID для агента. */
  readonly renderLink?: (target: Readonly<ResolvedReference>) => string;
  /* Максимальная глубина вставок; по умолчанию 24. */
  readonly maxIncludeDepth?: number;
  /* Максимальный суммарный размер раскрытия в байтах; по умолчанию 1 МиБ. */
  readonly maxDescriptionBytes?: number;
  /* Документы с известными техническими сведениями, но ещё отсутствующим текстом локали. */
  readonly untranslatedDocumentIds?: readonly string[];
}

/**
 * Явный пробел описания в выбранном контексте, не подменяемый догадкой или другим языком.
 */
export interface KnowledgeGap {
  /* Причина недоступности или неполноты сведений. */
  readonly code:
    | 'unmapped'
    | 'wrong-server'
    | 'translation-missing'
    | 'entity-translation-missing'
    | 'research-missing'
    | 'research-partial'
    | 'value-missing';
  /* Тип сущности, которой относится пробел. */
  readonly kind: EntityKind | 'protocol';
  /* ID сущности внутри её типа. */
  readonly id: string;
  /* Сервер документа; отсутствует у обзора профиля. */
  readonly server?: Server;
  /* Применимая версия; null при отсутствии установленной привязки. */
  readonly documentVersionId: string | null;
}

/**
 * Метаданные выбранного документа, включая независимые статусы исследования и перевода.
 */
export interface ResolvedMetadata extends ResolvedReference {
  /* Аннотация текущего языка; null при отсутствии текста. */
  readonly summary: string | null;
  /* Порядок записи в навигации. */
  readonly order: number;
  /* ID родителя того же типа; null у корневой записи. */
  readonly parentId: string | null;
  /* Итоговая полнота привязки и документа. */
  readonly researchStatus: ResearchStatus;
  /* Полнота привязки к протоколу; null без привязки. */
  readonly bindingStatus: ResearchStatus | null;
  /* Полнота варианта; null при отсутствии применимого документа. */
  readonly documentStatus: ResearchStatus | null;
  /* Каноническое имя пакета; null для других сущностей. */
  readonly name: string | null;
  /* Направление пакета; null для других сущностей. */
  readonly direction: Direction | null;
  /* Составной опкод выбранного профиля; null означает неизвестное значение. */
  readonly opcode: Opcode;
  /* Известные состояния обработки; пустой список не устанавливает ограничений. */
  readonly states: string[];
  /* Область статьи; у пакетов и сценариев поле отсутствует. */
  readonly scope?: 'protocol' | 'general';
}

/**
 * Результат выбора сущности и точного варианта до раскрытия Markdown.
 */
export interface KnowledgeResolution {
  /* Общие технические сведения и привязки сущности. */
  readonly entity: KnowledgeEntity;
  /* Применимый вариант; null при отсутствии привязки или неверном сервере. */
  readonly version: DocumentVersion | null;
  /* Текст выбранного языка; undefined при отсутствии перевода. */
  readonly document: DocumentVersion | DocumentTranslation | undefined;
  /* Общий вводный текст и описание варианта; null при недоступном переводе. */
  readonly description: string[] | null;
  /* Ссылка с полностью разрешённым контекстом. */
  readonly target: ResolvedReference;
  /* Обнаруженные пробелы; пустой массив означает отсутствие выявленных пробелов. */
  readonly gaps: KnowledgeGap[];
  /* Метаданные для списка или страницы документа. */
  readonly meta: ResolvedMetadata;
  /* Источники привязки и варианта; используются только данные текущего снимка. */
  readonly sources: Source[];
}
