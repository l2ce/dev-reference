import { Option } from 'commander'
import { positiveInteger, nonnegativeInteger } from '../commands/options.js'
import { TYPES } from '../commands/model.js'
import type { HelpOption } from './help.types.js'

/** Реестр общих параметров: описание, формат и разбор не расходятся между командами. */
export const HELP_OPTIONS: Readonly<Record<string, HelpOption>> = {
  database: {
    flags: '--database <path>',
    description: 'Выбрать SQLite-файл явно; язык и запись не запоминаются между процессами.',
    valueType: 'path',
    defaultDescription: 'packages/database/.local/database.sqlite',
    rules: ['Относительный путь отсчитывается от cwd. Чтение не создаёт отсутствующую базу.']
  },
  locale: {
    flags: '-l, --locale <locale>',
    description: 'Язык данных, не язык интерфейса.',
    valueType: 'locale',
    defaultDescription: 'Основной язык базы.',
    rules: [
      'Язык должен быть зарегистрирован. Другой перевод не подставляется.',
      'Нельзя одновременно задавать --locale и --all-locales.'
    ]
  },
  format: {
    flags: '--format <format>',
    description: 'Формат результата и диагностики.',
    valueType: 'enum',
    defaultDescription: 'text',
    choices: ['text', 'json'],
    defaultValue: 'text',
    rules: ['JSON успеха: {ok:true,data,meta}; ошибка исполнения: один {ok:false,error} в stderr, stdout пуст.']
  },
  color: {
    flags: '--color <mode>',
    description: 'Оформление служебных границ без изменения авторского текста.',
    valueType: 'enum',
    defaultDescription: 'auto: без ANSI вне TTY.',
    choices: ['auto', 'always', 'never'],
    defaultValue: 'auto',
    rules: ['JSON и --content не получают цветовых последовательностей.']
  },
  verbose: {
    flags: '--verbose',
    description: 'Совместимый служебный флаг; не расширяет выборку или состав изменяемых данных.',
    valueType: 'boolean',
    defaultDescription: 'Выключен.',
    rules: [
      'Сейчас отдельный поток прогресса не добавляется. Служебные сведения выбранного запроса доступны в meta при --format json.'
    ],
    legacy: true
  },
  json: {
    flags: '--json',
    description: 'Совместимое имя --format json.',
    valueType: 'boolean',
    defaultDescription: 'Выключен.',
    rules: ['Для новых сценариев используйте --format json.'],
    legacy: true
  },
  pretty: {
    flags: '--pretty',
    description: 'Добавить отступы к JSON.',
    valueType: 'boolean',
    defaultDescription: 'Выключен.',
    rules: ['Требуется --format json либо --json.']
  },
  version: {
    flags: '-V, --version',
    description: 'Показать версию установленного CLI, не версию снимка.',
    valueType: 'boolean',
    defaultDescription: 'Обычное выполнение команды.',
    rules: []
  },
  help: {
    flags: '-h, --help',
    description: 'Полный контракт выбранной команды; базу открывать не требуется.',
    valueType: 'boolean',
    defaultDescription: 'Обычное выполнение команды.',
    rules: ['Адрес уточняет тип, но не обязан существовать.']
  },
  brief: {
    flags: '--brief',
    description: 'Краткая справка или схема: синтаксис, параметры, поля, безопасность и один пример.',
    valueType: 'boolean',
    defaultDescription: 'Полный контракт без сокращений.',
    rules: [
      'Справочный режим без SQLite и stdin: help <команда> --brief либо <команда> --help --brief.',
      'У schema сокращается только текст; JSON Schema и её ограничения остаются полными.',
      'Для предметного представления используйте --view brief, а не --brief.'
    ]
  },
  structureOnly: {
    flags: '--structure-only',
    description: 'Структурированная JSON-справка без дублирующего текстового поля help.',
    valueType: 'boolean',
    defaultDescription: 'JSON-справка содержит help и structure для совместимости.',
    rules: ['Требуется справочный запрос с --format json; не сокращает структуру и не выполняет предметную команду.']
  },
  helpType: {
    flags: '--type <type>',
    description: 'Уточнить тип справки или схемы без обращения к SQLite.',
    valueType: 'collection',
    choices: Object.keys(TYPES),
    defaultDescription: 'Тип из полного адреса; без контекста показаны различия типов.',
    rules: ['Полный перечень типов приведён в разделе «Типы и поля».']
  },
  type: {
    flags: '--type <types>',
    description: 'Ограничить выборку зарегистрированными типами через запятую.',
    valueType: 'collections',
    defaultDescription: 'Все типы, совместимые с фильтрами.',
    rules: ['Явно несовместимый с фильтром тип вызывает ошибку, а не исключается молча.']
  },
  view: {
    flags: '--view <view>',
    description: 'Объём целой записи: краткая карточка, документ или исходная многоязычная запись.',
    valueType: 'enum',
    defaultDescription: 'read: full; list/find: brief.',
    choices: ['brief', 'full', 'edit'],
    rules: [
      'brief не содержит полного Markdown и объектов источников.',
      'full: все собственные поля и выбранный перевод, без рекурсивного разворачивания связей.',
      'edit: собственные UUID и все переводы; ограничивающий --locale запрещён.'
    ]
  },
  fields: {
    flags: '--fields <names>',
    description: 'Выбрать публичные поля вместо набора представления.',
    valueType: 'field-list',
    defaultDescription: 'Поля выбранного --view.',
    rules: ['Адрес остаётся видимым. Неизвестное или неприменимое поле — ошибка.']
  },
  allLocales: {
    flags: '--all-locales',
    description: 'Все существующие переводы только выбранных владельцев.',
    valueType: 'boolean',
    defaultDescription: 'Основной либо явно выбранный язык.',
    rules: [
      'Это не все записи базы и не создание отсутствующих переводов.',
      'Все языковые условия одного совпадения должны выполниться в одном переводе.'
    ]
  },
  withVersion: {
    flags: '--with-version',
    description: 'Показать полный непрозрачный токен снимка для --if-version.',
    valueType: 'boolean',
    defaultDescription: 'В тексте токен не печатается; в JSON находится в meta.version.',
    rules: ['В --content токен идёт в stderr. Не смешивайте version с SHA-256 revision прежнего API.']
  },
  limit: {
    flags: '--limit <n>',
    description: 'Максимальное число целых записей страницы, не длина документа.',
    valueType: 'positive-integer',
    parser: 'positive',
    defaultDescription: 'list/find: 20; read: весь явно заданный набор.',
    rules: ['Скрытого максимума общего набора нет. Следующую порцию можно уменьшить.']
  },
  afterCursor: {
    flags: '--after <cursor>',
    description: 'Продолжить тот же запрос с зафиксированной позиции и версии.',
    valueType: 'cursor',
    defaultDescription: 'Начало набора.',
    rules: [
      'Курсор копируется из предыдущего ответа; нельзя менять адреса, фильтры, сортировку, язык и протокол.',
      'Изменение базы даёт REVISION_CONFLICT; с --offset и --all несовместим.'
    ]
  },
  offset: {
    flags: '--offset <n>',
    description: 'Обычное смещение в отфильтрованном отсортированном наборе.',
    valueType: 'nonnegative-integer',
    parser: 'nonnegative',
    defaultDescription: '0',
    rules: ['Для согласованного обхода используйте курсор. Нельзя сочетать с --after или --all.']
  },
  all: {
    flags: '--all',
    description: 'Вернуть весь отфильтрованный результат, без скрытого лимита.',
    valueType: 'boolean',
    defaultDescription: 'Одна страница.',
    rules: ['Несовместим с --limit, --offset и --after; не снимает фильтры.']
  },
  sort: {
    flags: '--sort <fields>',
    description: 'Сортировка через запятую; минус перед полем задаёт убывание.',
    valueType: 'sort-list',
    defaultDescription: 'order,key; полный адрес всегда стабилизирует порядок.',
    rules: [
      'Поля: key,order,title,summary,status,translationStatus,releasedOn,name,number,variant,server,direction,code,id,branch,saga,chronicle,region,release; только применимые к выбранным типам.',
      'Сортировка языкового поля несовместима с --all-locales. Пример: --sort releasedOn,key.'
    ]
  },
  protocol: {
    flags: '--protocol <key>',
    description: 'Явный контекст применимости знаний или фильтр связанных записей.',
    valueType: 'protocol-key',
    defaultDescription: 'Редакция карточки не выбирается произвольно.',
    rules: [
      'В типизированном флаге 152 равнозначен protocol:152.',
      'Позиционные protocol:152 и protocol:273 читаются как записи и не становятся контекстом остальных адресов.'
    ]
  },
  saveSelection: {
    flags: '--save-selection <path>',
    description: 'Сохранить только показанные адреса, выбранные редакции и версию снимка.',
    valueType: 'path',
    defaultDescription: 'Служебный файл не создаётся.',
    rules: [
      'Для всего набора нужен --all. Существующий файл не перезаписывается.',
      'Файл выборки не переключает базу и не содержит исполняемый запрос.'
    ]
  },
  selection: {
    flags: '--selection <path>',
    description: 'Использовать фиксированный набор адресов и технических редакций.',
    valueType: 'selection-path',
    defaultDescription: 'Адреса передаются позиционно.',
    rules: [
      'Не сочетайте с позиционными адресами или --keys-file.',
      'Для пагинации нужен файл выборки. --selection - читается из stdin только целиком; одновременно читать stdin другим каналом нельзя.',
      'Чтение устаревшей выборки предупреждает; запись требует её исходной версии и завершается конфликтом при изменении базы.'
    ]
  },
  keysFile: {
    flags: '--keys-file <path|->',
    description: 'UTF-8 файл: один полный адрес на строку; - означает stdin.',
    valueType: 'keys-path',
    defaultDescription: 'Адреса передаются позиционно.',
    rules: [
      'Пустые строки разрешены. Адреса не являются командами или шаблонами; порядок сохраняется.',
      'Несовместим с позиционными адресами и --selection. Продолжение не зависит от повторного stdin.'
    ]
  },
  content: {
    flags: '--content <field>',
    description: 'Только буквальное содержимое одного разрешённого текстового поля.',
    valueType: 'text-field',
    defaultDescription: 'Оформленная запись выбранного --view.',
    rules: [
      'Нужны одна запись, один язык и точная редакция, если поле принадлежит редакции.',
      'Несовместим с --view, --fields, --all-locales и пагинацией.',
      'stdout без заголовков, отступов и добавленного перевода строки; Markdown/include не раскрывается.'
    ]
  },
  allowMissing: {
    flags: '--allow-missing',
    description: 'Явно разрешить ожидаемые пропуски с кодом завершения 0.',
    valueType: 'boolean',
    defaultDescription: 'Неполное множественное чтение: код 3 при сохранении найденных записей.',
    rules: ['Пропуски не скрываются: availability и meta.itemsComplete остаются явными.']
  },
  has: {
    flags: '--has <field>',
    description: 'Оставить записи с непустым значением, текстом, переводом или связью.',
    valueType: 'field',
    parser: 'repeat',
    defaultDescription: 'Условие наличия не применяется.',
    rules: [
      'Можно повторять. 0 — известное значение; null, пустой текст и [] отсутствуют.',
      'translation проверяет сам перевод; --has translation --missing description находит существующий пустой документ.'
    ]
  },
  missing: {
    flags: '--missing <field>',
    description: 'Оставить записи без значения указанного поля.',
    valueType: 'field',
    parser: 'repeat',
    defaultDescription: 'Условие отсутствия не применяется.',
    rules: [
      'Можно повторять; не смешивайте отсутствие перевода со статусом знания missing.',
      'Поля: собственные поля типа, title,summary,description,translationStatus,sources,questions,translation.'
    ]
  },
  searchIn: {
    flags: '--search-in <fields>',
    description: 'Поисковые поля через запятую.',
    valueType: 'field-list',
    defaultDescription: 'key и поисковые текстовые поля: name,title,summary,description, где доступны.',
    rules: [
      'Допустимы key,name,title,summary,description,sources.url,sources.title,sources.summary,questions.',
      'Текст нормализуется по Unicode и регистру; key и sources.url сравниваются буквально.'
    ]
  },
  match: {
    flags: '--match <mode>',
    description: 'Способ сопоставления текста.',
    valueType: 'enum',
    defaultDescription: 'contains',
    choices: ['contains', 'exact', 'prefix'],
    rules: []
  },
  dryRun: {
    flags: '--dry-run',
    description: 'Построить и проверить тот же план, что при записи, без сохранения.',
    valueType: 'boolean',
    defaultDescription: 'Применить проверенное изменение.',
    rules: ['Показывает исходную версию, не выдаёт расчётное будущее состояние за сохранённое.']
  },
  ifVersion: {
    flags: '--if-version <token>',
    description: 'Разрешить запись только в ожидаемое поколение снимка.',
    valueType: 'version-token',
    defaultDescription: 'Мутация защищает версию своего исходного чтения; replace требует явного токена.',
    rules: [
      'Получить: read <key> --view edit --with-version.',
      'При конфликте обновите чтение или выборку. Автоматического повтора записи нет.'
    ]
  },
  diff: {
    flags: '--diff <view>',
    description: 'Объём содержательного diff.',
    valueType: 'enum',
    defaultDescription: 'dry-run: full; запись: summary.',
    choices: ['summary', 'full'],
    rules: ['full не обрезает значения; summary явно обозначает сокращение тел документов.']
  },
  input: {
    flags: '--input <path|->',
    description: 'Структурированный JSON-ввод этой операции из UTF-8 файла или stdin.',
    valueType: 'json-path',
    defaultDescription: 'Обычные флаги и текст; для batch ввод обязателен.',
    rules: [
      'Не нужны внутренние entry/value/kind или ручные UUID.',
      'Одно поле из input и флага конфликтует; один stdin нельзя читать дважды. Предел одного ввода — 16 МиБ.'
    ]
  },
  requiredInput: {
    flags: '--input <path|->',
    description: 'Полная публичная edit-запись для сознательной замены.',
    valueType: 'json-path',
    defaultDescription: 'Обязателен.',
    required: true,
    rules: ['Автоматические адресные поля и UUID можно опустить; переданные проверяются как неизменяемые.']
  },
  importInput: {
    flags: '--input <directory>',
    description: 'Каталог полного экспортированного снимка таблиц.',
    valueType: 'directory',
    defaultDescription: 'packages/database/data/',
    rules: [
      'Это полная замена, не patch одного документа; требуется --replace.',
      'Вход проверяется до изменения рабочей базы; несовместимая старая структура восстанавливается атомарно.'
    ]
  },
  set: {
    flags: '--set <field=value>',
    description: 'Установить известное скалярное поле; настоящий многострочный текст допустим.',
    valueType: 'assignment',
    parser: 'repeat',
    defaultDescription: 'Непереданные поля сохраняются.',
    rules: [
      'Можно повторять. Деление только по первому =; остальные = принадлежат значению.',
      'Строка null не очищает поле. Источники, вопросы и связи имеют собственные операции.'
    ]
  },
  setStdin: {
    flags: '--set-stdin <field>',
    description: 'Записать буквальный UTF-8 текст одного разрешённого поля из stdin.',
    valueType: 'text-field',
    defaultDescription: 'Поле не меняется.',
    rules: [
      'До 16 МиБ. Сохраняются пробелы, реальные переносы, BOM и завершающий перевод строки.',
      'Не сочетайте с другим читателем stdin. Quoted heredoc запрещает подстановки оболочки.'
    ]
  },
  setFile: {
    flags: '--set-file <field=path>',
    description: 'Записать поле из существующего UTF-8 файла; path=- означает stdin.',
    valueType: 'file-assignment',
    parser: 'repeat',
    defaultDescription: 'Поле не меняется.',
    rules: [
      'Можно повторять для разных полей. Только поля, разрешённые схемой для файлов.',
      'Одно поле нельзя одновременно задать флагом, --set, input, stdin и файлом.'
    ]
  },
  clear: {
    flags: '--clear <field>',
    description: 'Очистить собственное поле по его типу.',
    valueType: 'field',
    parser: 'repeat',
    defaultDescription: 'Поле сохраняется.',
    rules: [
      'Nullable → null; текст → пустая строка; скалярный список → []. Обязательную связь очистить нельзя.',
      'У source update поддерживается только summary: необязательное поле удаляется из объекта.'
    ]
  },
  add: {
    flags: '--add <field=value>',
    description: 'Добавить скалярный элемент списка, сохранив остальные.',
    valueType: 'assignment',
    parser: 'repeat',
    defaultDescription: 'Список сохраняется.',
    rules: [
      'Только states,servers,loginRevisions, где доступны; тип каждого элемента проверяется.',
      'Повтор элемента — no-op. Для предметных ссылок используйте link.'
    ]
  },
  remove: {
    flags: '--remove <field=value>',
    description: 'Удалить точный скалярный элемент списка.',
    valueType: 'assignment',
    parser: 'repeat',
    defaultDescription: 'Список сохраняется.',
    rules: [
      'Только states,servers,loginRevisions. Отсутствующий элемент — no-op.',
      'Для источников, вопросов и связей используются их собственные команды.'
    ]
  },
  ifExists: {
    flags: '--if-exists <mode>',
    description: 'Поведение create при существующем адресе.',
    valueType: 'enum',
    defaultDescription: 'error',
    choices: ['error', 'skip'],
    rules: ['skip не обновляет запись и не объявляет её совпадающей с переданными значениями.']
  },
  replace: {
    flags: '--replace',
    description: 'Явно разрешить замену существующей цели связи или всего импортируемого снимка.',
    valueType: 'boolean',
    defaultDescription: 'Замена запрещена.',
    rules: [
      'link: перенос применимости между редакциями одной карточки атомарен.',
      'import: заменяются вся структура и данные, а не одно поле.'
    ]
  },
  unscoped: {
    flags: '--unscoped',
    description: 'Явно задать протокол релиза с ещё не установленным региональным контекстом.',
    valueType: 'boolean',
    defaultDescription: 'Прямой протокол релиза запрещён.',
    rules: ['Не размножает связь по регионам. Для известного выхода используйте release-context.']
  },
  before: {
    flags: '--before <key>',
    description: 'Поместить цели перед существующей целью упорядоченной связи.',
    valueType: 'target-key',
    defaultDescription: 'Новые цели добавляются в конец; существующие не перемещаются.',
    rules: ['Только множественная связь; нельзя вместе с --after или указывать перемещаемую цель как опору.']
  },
  afterTarget: {
    flags: '--after <key>',
    description: 'Поместить цели после существующей цели упорядоченной связи.',
    valueType: 'target-key',
    defaultDescription: 'Добавление в конец без перемещения существующих целей.',
    rules: ['Это адрес цели, не курсор страницы. Несовместим с --before.']
  },
  allLinks: {
    flags: '--all',
    description: 'Убрать все связи только указанного вида у одного владельца.',
    valueType: 'boolean',
    defaultDescription: 'Удаляются перечисленные цели.',
    rules: ['Не сочетайте с позиционными targets; сами целевые записи не удаляются.']
  },
  cascadeOwned: {
    flags: '--cascade-owned',
    description: 'Разрешить удаление принадлежащих технических редакций вместе с карточкой.',
    valueType: 'boolean',
    defaultDescription: 'Наличие редакций препятствует удалению карточки.',
    rules: ['Не удаляет самостоятельные связанные релизы, протоколы или региональные выходы.']
  },
  allowBrokenLinks: {
    flags: '--allow-broken-links',
    description: 'Явно сохранить новые неразрешённые Markdown-ссылки после удаления.',
    valueType: 'boolean',
    defaultDescription: 'Удаление, создающее такие ссылки, запрещено.',
    rules: ['Не отключает SQL FK или предметный валидатор.']
  },
  rev: {
    flags: '--rev <n>',
    description: 'Номер новой технической редакции справочника.',
    valueType: 'positive-integer',
    parser: 'positive',
    defaultDescription: 'Следующий номер внутри карточки, защищённый версией.',
    rules: ['Это не номер релиза игры. Существующая редакция не заменяется.']
  },
  from: {
    flags: '--from <key>',
    description: 'Копировать содержимое редакции того же вида с явными правками поверх копии.',
    valueType: 'revision-key',
    defaultDescription: 'Создать неполную редакцию без копирования.',
    rules: ['Применимость не переносится; UUID самой редакции и источников назначаются заново.']
  },
  url: {
    flags: '--url <url>',
    description: 'Новый точный HTTP(S)-URL источника.',
    valueType: 'http-url',
    field: 'url',
    defaultDescription: 'source add: обязателен через один канал ввода; update: сохраняется.',
    rules: ['Проверяется форма, не доступность сети и не достоверность сведений.']
  },
  id: {
    flags: '--id <id>',
    description: 'Выбрать существующий источник по его UUID.',
    valueType: 'uuid',
    defaultDescription: 'Нужно выбрать ровно один критерий.',
    rules: ['Не меняет ID. Несовместим с --match-url и --match-host. Получить ID: source list <key>.']
  },
  matchUrl: {
    flags: '--match-url <url>',
    description: 'Выбрать источник по точному текущему URL.',
    valueType: 'http-url',
    defaultDescription: 'Нужно выбрать ровно один критерий.',
    rules: [
      'Не новый URL: для нового значения используйте --url. Неоднозначность требует --id либо --all-matches при удалении.'
    ]
  },
  matchHost: {
    flags: '--match-host <host>',
    description: 'Выбрать источники по точному имени хоста, без поддоменов.',
    valueType: 'hostname',
    defaultDescription: 'Нужно выбрать ровно один критерий.',
    rules: ['Пример: example.invalid, не https://example.invalid/path. Несколько совпадений требуют --all-matches.']
  },
  allMatches: {
    flags: '--all-matches',
    description: 'Явно разрешить удаление нескольких источников, совпавших с критерием.',
    valueType: 'boolean',
    defaultDescription: 'Неоднозначность — конфликт, не выбор первого совпадения.',
    rules: ['Остальные источники выбранных владельцев сохраняются.']
  },
  text: {
    flags: '--text <text>',
    description: 'Полный непустой текст открытого вопроса; многострочный текст допустим.',
    valueType: 'nonempty-text',
    required: true,
    defaultDescription: 'Обязателен.',
    rules: ['remove сравнивает текст буквально, не номер строки; повтор add — no-op.']
  },
  by: {
    flags: '--by <fields>',
    description: 'Группировки счётчиков через запятую.',
    valueType: 'field-list',
    defaultDescription: 'type',
    rules: [
      'Допустимы type,locale,status,region,sourceHost.',
      'Отдельно считаются объекты источников и уникальные URL; число ссылок не определяет статус знания.'
    ]
  },
  depth: {
    flags: '--depth <n>',
    description: 'Максимальная глубина дерева классификации.',
    valueType: 'nonnegative-integer',
    parser: 'nonnegative',
    defaultDescription: '4',
    rules: ['0 показывает только корень. Классификация не означает владение жизненным циклом.']
  },
  in: {
    flags: '--in',
    description: 'Только входящие связи выбранной записи.',
    valueType: 'boolean',
    defaultDescription: 'Оба направления.',
    rules: ['Несовместим с --out.']
  },
  out: {
    flags: '--out',
    description: 'Только исходящие связи выбранной записи.',
    valueType: 'boolean',
    defaultDescription: 'Оба направления.',
    rules: ['Несовместим с --in.']
  },
  relation: {
    flags: '--relation <name>',
    description: 'Ограничить обзор одним предметным отношением.',
    valueType: 'relation-name',
    defaultDescription: 'Все отношения, включая Markdown-упоминания.',
    rules: ['Собственные связи, принадлежность, применимость и вычисленные mention показываются раздельно.']
  },
  locales: {
    flags: '--locales <codes>',
    description: 'Задать упорядоченный реестр языков новой базы через запятую.',
    valueType: 'locale-list',
    defaultDescription: 'ru,en',
    rules: ['Языки не повторяются; основной язык должен входить в реестр.']
  },
  defaultLocale: {
    flags: '--default-locale <code>',
    description: 'Основной язык новой базы.',
    valueType: 'locale',
    defaultDescription: 'Первый язык --locales, обычно ru.',
    rules: ['Регион и язык — независимые признаки.']
  },
  links: {
    flags: '--links',
    description: 'Дополнительно проверить директивы в полях, объявленных как Markdown.',
    valueType: 'boolean',
    defaultDescription: 'Проверка структуры и предметных связей.',
    rules: ['Неразрешённые ссылки — предупреждения; summary источника не разбирается как Markdown.']
  },
  strictLinks: {
    flags: '--strict-links',
    description: 'Считать неразрешённые Markdown-ссылки ошибкой.',
    valueType: 'boolean',
    defaultDescription: 'Не включён.',
    rules: ['Включает проверку ссылок. Существование ссылки не доказывает историческую достоверность.']
  },
  output: {
    flags: '--output <directory>',
    description: 'Каталог полного экспортируемого снимка таблиц.',
    valueType: 'directory',
    defaultDescription: 'packages/database/data/',
    rules: ['Экспорт явный, без Git commit/push. Произвольный непустой каталог не перезаписывается.']
  },
  legacyFile: {
    flags: '--file <path>',
    description: 'Прежний DTO-батч с entry/target/patch, не новый formatVersion:1.',
    valueType: 'json-path',
    defaultDescription: 'Для нового батча используйте --input.',
    rules: ['Совместимость: массивы в patch заменяются целиком; эта семантика не относится к новому update.'],
    legacy: true
  }
}

/** Параметры, общие для каждого нового вызова. */
export const GLOBAL_OPTION_IDS = [
  'database',
  'locale',
  'format',
  'color',
  'verbose',
  'json',
  'pretty',
  'version',
  'brief',
  'structureOnly',
  'help'
]
/** Общие гарантии мутации. */
export const WRITE_OPTION_IDS = ['dryRun', 'ifVersion', 'diff']
/** Выбор объёма и страницы чтения. */
export const READ_OPTION_IDS = ['view', 'fields', 'allLocales', 'withVersion', 'limit', 'afterCursor', 'protocol']
/** Предметные фильтры; фактическая совместимость определяется типом и схемой. */
export const FILTER_OPTION_IDS = [
  'type',
  'branch',
  'saga',
  'chronicle',
  'release',
  'region',
  'country',
  'server',
  'direction',
  'status',
  'translationStatus',
  'sourceUrl',
  'sourceHost',
  'has',
  'missing'
]

/** Явные скалярные флаги и их семантика для ввода и фильтрации. */
const FIELD_OPTIONS: Readonly<Record<string, HelpOption>> = {
  title: {
    flags: '--title <text>',
    description: 'Заголовок выбранного перевода; не техническое имя.',
    valueType: 'text',
    field: 'title',
    defaultDescription: 'Не передан: сохраняется; у нового перевода пустой текст.',
    rules: ['Пустой заголовок допустим; соседние языки и источники не заменяются.']
  },
  summary: {
    flags: '--summary <text>',
    description: 'Самостоятельная аннотация, не начало полного документа.',
    valueType: 'text',
    field: 'summary',
    defaultDescription: 'Не передан: сохраняется; у нового перевода пустой текст.',
    rules: ['У источника пояснение необязательно и не может быть пустым; удалить: --clear summary.']
  },
  description: {
    flags: '--description <text>',
    description: 'Буквальное полное описание выбранного языка в Markdown.',
    valueType: 'markdown',
    field: 'description',
    defaultDescription: 'Не передан: сохраняется; у нового перевода пустой текст.',
    rules: ['Настоящие многострочные значения допустимы. Литералы \\n не преобразуются в переносы.']
  },
  translationStatus: {
    flags: '--translation-status <status>',
    description: 'Состояние конкретного перевода, отдельно от полноты знания.',
    valueType: 'enum',
    field: 'translationStatus',
    choices: ['ready', 'missing', 'outdated'],
    defaultDescription: 'Существующий перевод сохраняется; новый: ready.',
    rules: []
  },
  status: {
    flags: '--status <status>',
    description: 'Полнота предметного знания, не состояние перевода.',
    valueType: 'enum',
    field: 'status',
    choices: ['missing', 'partial', 'documented'],
    defaultDescription: 'Фильтр не задан / существующее значение сохраняется; новая запись: missing.',
    rules: [
      'documented требует непустого описания хотя бы одного языка; пакетная редакция также требует известный opcode. Источники не обязательны.'
    ]
  },
  name: {
    flags: '--name <text>',
    description: 'Непустое техническое имя карточки пакета.',
    valueType: 'nonempty-text',
    field: 'name',
    defaultDescription: 'При create пакета обязателен; update сохраняет непереданное.',
    rules: ['Не заменяет код или перевод заголовка.']
  },
  server: {
    flags: '--server <server>',
    description: 'Канал соединения карточки пакета либо фильтр знаний.',
    valueType: 'enum',
    field: 'server',
    choices: ['login', 'game'],
    defaultDescription: 'Фильтр не задан; create пакета требует явное значение.',
    rules: ['Не выводится из номера протокола. У сценариев/статей список servers редактируется через --add.']
  },
  direction: {
    flags: '--direction <direction>',
    description: 'Направление пакета относительно сервера.',
    valueType: 'enum',
    field: 'direction',
    choices: ['client-to-server', 'server-to-client'],
    defaultDescription: 'Фильтр не задан; create пакета требует явное значение.',
    rules: ['Только карточки пакетов и их редакции при чтении; не определяется полем server.']
  },
  opcode: {
    flags: '--opcode <opcode>',
    description: 'Типизированный опкод технической редакции пакета.',
    valueType: 'opcode',
    field: 'opcode',
    defaultDescription: 'Существующий сохраняется; новый: null (неизвестен).',
    rules: [
      'Компоненты u8, u16le, u32le; десятичные или 0x-значения, разделитель /. Пример: u8:0xFE/u16le:0x0012.',
      'Разрядность проверяется; известный u8:0 отличается от null. Состояния учитываются при проверке коллизий.'
    ]
  },
  order: {
    flags: '--order <n>',
    description: 'Целый редакционный порядок, не историческая дата.',
    valueType: 'integer',
    field: 'order',
    defaultDescription: 'Существующий сохраняется; новый: null.',
    rules: ['0 — известный порядок; --clear order возвращает null.']
  },
  releasedOn: {
    flags: '--released-on <date>',
    description: 'Дата именно регионального контекста с исходной точностью.',
    valueType: 'partial-date',
    field: 'releasedOn',
    defaultDescription: 'Существующая сохраняется; новая: null.',
    rules: [
      'Форматы YYYY, YYYY-MM, YYYY-MM-DD; проверяется реальный календарь и високосный день.',
      'Неизвестную дату очищайте через --clear releasedOn; соседние регионы не являются значением по умолчанию.'
    ]
  }
}

/**
 * Возвращает описание параметра и нормализацию адресных полей из единого реестра.
 */
export function helpOption(id: string): HelpOption {
  const defined = HELP_OPTIONS[id] ?? FIELD_OPTIONS[id]
  if (defined) return defined
  const references: Readonly<Record<string, string>> = {
    branch: 'branch',
    saga: 'saga',
    chronicle: 'chronicle',
    release: 'release',
    region: 'region',
    country: 'country'
  }
  if (references[id])
    return {
      flags: `--${id} <key>`,
      description: `Явная ${id === 'country' ? 'страна' : 'предметная связь или классификация'} ${id}.`,
      valueType: `${id}-key`,
      field: id,
      defaultDescription: 'Фильтр не задан; непереданное поле сохраняется.',
      rules: [
        `В типизированном флаге example равнозначен ${references[id]}:example; это не поиск по названию.`,
        'Обязательность и nullable определяются типом записи. Владелец, входящий в адрес, неизменяем.'
      ]
    }
  if (id === 'sourceUrl' || id === 'sourceHost')
    return {
      flags: id === 'sourceUrl' ? '--source-url <url>' : '--source-host <host>',
      description:
        id === 'sourceUrl'
          ? 'Фильтр по точному URL источника выбранного перевода.'
          : 'Фильтр по точному имени хоста источника выбранного перевода.',
      valueType: id === 'sourceUrl' ? 'http-url' : 'hostname',
      defaultDescription: 'Ограничение по источнику отсутствует.',
      rules: ['Не выполняет сетевых запросов.', 'Хост не включает поддомены; URL сравнивается буквально.']
    }
  throw new Error(`Параметр ${id} не описан в реестре CLI.`)
}

/**
 * Накапливает повторяемое значение без скрытого приоритета последнего аргумента.
 */
function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

/**
 * Создаёт исполняемый параметр из того же контракта, который публикует справка.
 */
export function commandOption(id: string): Option {
  const spec = helpOption(id)
  const option = new Option(spec.flags, spec.description)
  if (spec.choices) option.choices(spec.choices)
  if (spec.parser === 'repeat') option.argParser(collect).default([])
  if (spec.parser === 'positive') option.argParser(positiveInteger)
  if (spec.parser === 'nonnegative') option.argParser(nonnegativeInteger)
  if (spec.defaultValue !== undefined) option.default(spec.defaultValue)
  if (spec.required) option.makeOptionMandatory()
  if (spec.legacy && id === 'legacyFile') option.hideHelp()
  return option
}
