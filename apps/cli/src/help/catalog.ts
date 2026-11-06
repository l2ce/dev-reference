import { FILTER_OPTION_IDS, READ_OPTION_IDS, WRITE_OPTION_IDS } from './options.js'
import type { CommandSpec, HelpRule } from './help.types.js'
import { BATCH_OPERATION_IDS } from '../commands/definition.js'

/** Действия с предметными значениями используют те же имена, что исполняемый батч. */
const FIELD_OPERATIONS = new Set<string>([...BATCH_OPERATION_IDS, 'revision.add'])

/** Смысловая грамматика батча дополняет машинную схему без внутренних DTO. */
const BATCH_DETAILS = [
  'create: values содержит поля типа из таблицы, включая обязательные. key один раз; code/number/variant/rev/владелец и UUID выводятся автоматически.',
  'update: только переданные скаляры и текст одного locale; protocols/countries, переводы целиком, источники и вопросы не заменяются.',
  'replace: полное edit-представление в values, включая translations:[{locale,title,summary,description,translationStatus,sources:[{id?,url,title,summary?}],questions:[]}]; требуется общий --if-version.',
  'translation.set: values={title?,summary?,description?,translationStatus?}; locale выбирает один перевод. translation.delete не принимает values.',
  'link/unlink: relation и targets рядом с key, values пуст. options задаёт replace,unscoped,before/after либо all для unlink. Протокол связывается с точной редакцией.',
  'source.add: values={url,title,summary?}, url HTTP(S), title/summary непустые; ID назначается автоматически. source.update меняет только переданные поля и требует options={id:...} либо {matchUrl:...}; clear:["summary"] удаляет пояснение.',
  'source.remove: пустые values и ровно один options.id/matchUrl/matchHost; несколько совпадений требуют options.allMatches=true. source.clear удаляет все источники; нужен явный locale либо options.allLocales=true.',
  'question.add/remove: values={text:"точный непустой текст"}; question.clear без values и с явным locale либо options.allLocales=true.',
  'delete: без values; options.cascadeOwned/allowBrokenLinks явно разрешают только соответствующий охват.',
  'files:{description:"./draft.md"} задаёт разрешённое текстовое поле вместо values.description. Дублировать каналы нельзя. Для stdin пути от cwd, для файла батча — от его каталога.',
  'СОВМЕСТИМОСТЬ --file: другой объект {operations:[...],ifRevision?:"SHA-256"}. create/put принимает entry:{collection,key,kind,value}; update — target:{collection,key,kind} и patch; delete — target. kind=entity для карточки либо implementation для редакции, collection — зарегистрированный тип. В value повторяются key и code; протокол вместо code задаёт number и необязательный variant; редакция — packetKey/scenarioKey/articleKey и rev. UUID можно опустить только в create. put требует полный известный ID и сохраняет существующую идентичность.',
  'В старом value/patch имена branchKey,sagaKey,chronicleKey,releaseKey,regionKey,protocolKeys,countryKeys и packetKey/scenarioKey/articleKey вместо новых branch/saga/chronicle/release/region/protocols/countries. Переводы: translations:[{locale,title,summary,description,translationStatus?,source:[{id?,url,title,summary?}],openQuestions:[]}]. Переданные массивы заменяются целиком. --file несовместим с --input/--if-version/--diff; для новых сценариев используйте --input без этих DTO-оболочек.'
]

/** Общие гарантии с устойчивыми именами; команды явно выбирают применимые наборы. */
export const HELP_RULE_SETS: Readonly<Record<string, HelpRule[]>> = {
  base: [
    {
      id: 'address',
      text: 'Позиционный адрес полный: branch:example, saga:example, chronicle:example, release:example, release-context:example:na, region:na, country:us, protocol:152, packet:example или packet:example:rev-1. У scenario/article такое же различие карточки и редакции. Название, язык и родительская группа не определяют идентичность.'
    },
    {
      id: 'paths',
      text: 'Обычные относительные пути отсчитываются от cwd; - всегда означает stdin. Нет скрытого выбранного протокола, языка или записи между процессами. Нет pager, обязательного редактора или интерактивного подтверждения.'
    },
    {
      id: 'unknown',
      text: 'Неизвестность сохраняется явно: null не равен пустому тексту, [] или известному 0. Даты, источники, регионы и применимость не выводятся из соседних записей.'
    }
  ],
  read: [
    {
      id: 'read-only',
      text: 'Чтение открывает SQLite read-only и не создаёт отсутствующий файл. Один вызов использует согласованный снимок.'
    },
    {
      id: 'literal',
      text: 'Полный текст возвращается буквально: include не раскрывается, авторские пробелы и переносы не меняются. Полные документы не обрезаются; для меньшего ответа выбирайте поля или страницу.'
    },
    {
      id: 'availability',
      text: 'Отсутствующая запись, неприменимая редакция и отсутствующий перевод различаются. Язык или редакция другой версии не подставляются. availability описывает доступность, status — полноту знания.'
    }
  ],
  language: [
    {
      id: 'language',
      text: 'Текст, источники и вопросы принадлежат выбранному переводу; остальные языки сохраняются. По умолчанию язык основной. --locale несовместим с --all-locales. Язык и регион независимы.'
    },
    {
      id: 'translation-owner',
      text: 'У карточек packet/scenario/article нет собственного перевода: для текста, источников и вопросов нужен точный адрес технической редакции :rev-N.'
    }
  ],
  write: [
    {
      id: 'atomic',
      text: 'Конечный предметный граф проверяется до атомарной фиксации. Ошибка не сохраняет частичные изменения. Без явного --if-version защищается версия собственного исходного чтения; автоматического повтора записи нет.'
    },
    {
      id: 'preview',
      text: '--dry-run использует тот же план и валидатор без записи. Предпросмотр показывает поле, язык, старое и новое значение, URL и связи. full — умолчание предпросмотра, summary — записи; --diff full раскрывает значения без усечения.'
    },
    {
      id: 'no-op',
      text: 'Результат различает сохранённое изменение, dry-run, пропуск и no-op. Отсутствие изменения не переписывает базу. Токен version непрозрачен, полный и не переносится между копиями SQLite; это не SHA-256 revision старого API.'
    },
    {
      id: 'no-export',
      text: 'Предметная правка не выполняет экспорт, импорт, commit или push. Обновление снимка для Git — отдельная явная команда export.'
    }
  ],
  input: [
    {
      id: 'channels',
      text: 'Одно поле передаётся ровно одним способом: прямой флаг, --set, --set-stdin, --set-file либо --input. Дублирование — ошибка, не скрытый приоритет. У процесса один stdin; два читателя отклоняются до чтения.'
    },
    {
      id: 'utf8',
      text: 'Текст — данные, не код. UTF-8 проверяется, один файл или stdin ограничен 16 МиБ. Пробелы, отступы, BOM, пустые строки и завершающий перевод строки сохраняются. Литерал \\n не превращается в перенос. Размер аргумента ограничен ОС: для длинного текста используйте stdin, временный файл не обязателен. Для heredoc используйте разделитель в кавычках.'
    },
    {
      id: 'identity',
      text: 'UUID и составляющие адреса назначаются автоматически. Обычный update не меняет id, key, code, number, variant, rev и владельца, входящего в адрес. Внешний ввод не является SQL или внутренним DTO базы.'
    }
  ],
  filter: [
    {
      id: 'filter-scope',
      text: 'Все условия применяются до пагинации. Если --type не задан, фильтр определяет совместимую естественную область, указанную в ответе. Явно несовместимый тип — ошибка, не проигнорированный фильтр.'
    },
    {
      id: 'filter-language',
      text: 'Без --all-locales проверяется выбранный язык. При --all-locales условия источника, текста и вопросов одного совпадения должны выполниться в одном переводе; запись не дублируется по языкам.'
    },
    {
      id: 'regional-path',
      text: 'Региональные условия относятся к одному явно записанному контексту. Регион одного выхода не объединяется с релизом другого, страны не выводятся из региона, прямой unscoped-протокол не получает регион автоматически.'
    }
  ],
  page: [
    {
      id: 'pages',
      text: 'Единица страницы — целая запись, не строка или язык. list/find по умолчанию показывают 20 записей, read — весь явно заданный набор без лимита 50. --all возвращает весь отфильтрованный набор и несовместим с --limit/--offset/--after.'
    },
    {
      id: 'cursor',
      text: 'Ответ содержит общее число, диапазон, остаток и полную команду продолжения. Курсор фиксирует запрос и версию; менять можно размер следующей порции. При смене базы начните запрос заново или перечитайте сохранённую выборку.'
    },
    {
      id: 'boundaries',
      text: 'Текст имеет BEGIN/END-границы страницы, записей и многострочных полей с меткой, не встречающейся в содержимом. Усечение оболочкой не означает полного чтения: уменьшите порцию и получите пропущенное содержимое.'
    }
  ],
  selection: [
    {
      id: 'selection',
      text: 'Сохранённая выборка содержит formatVersion:1, version, query и items:[{key,revisionKey?}]. Фиксируются только показанные адреса и выбранные редакции. Файл не исполняется, не переключает базу и не повторяет поиск при записи.'
    },
    {
      id: 'selection-version',
      text: 'Чтение по устаревшей выборке предупреждает и читает те же адреса; запись завершается конфликтом. Критерий удаления источников передаётся заново явно. Пустой набор — no-op, не расширение поиска.'
    }
  ],
  links: [
    {
      id: 'link-owner',
      text: 'Отношение исходящее и собственное: branch,saga,chronicle,region,countries,protocols, где оно доступно типу. Владелец редакции или контекста неизменяем; обратные и вычисленные связи не хранятся как второй факт.'
    },
    {
      id: 'link-cardinality',
      text: 'Одиночная замена требует --replace, обязательную связь разорвать нельзя. M:N добавляет или удаляет только указанные цели. --before/--after работают лишь для упорядоченной множественной связи и могут явно переместить существующую цель.'
    },
    {
      id: 'link-applicability',
      text: 'Протокол связывается с точной редакцией :rev-N, не с карточкой. Другая редакция той же карточки в протоколе — конфликт; --replace атомарно переносит применимость. Изменение редакции затрагивает все использующие её протоколы.'
    },
    {
      id: 'link-unscoped',
      text: 'Прямая связь release → protocols требует --unscoped; для известного регионального выхода используйте release-context. Смена chronicle у релиза не меняет его адрес, UUID и региональные выходы.'
    }
  ],
  source: [
    {
      id: 'source-owner',
      text: 'Источник принадлежит конкретному переводу и имеет неизменяемый UUID. Источники необязательны при любом status, включая documented; CLI не добавляет ссылки автоматически.'
    },
    {
      id: 'source-match',
      text: 'Для update/remove нужен ровно один критерий: --id либо --match-url; remove также принимает --match-host. URL точный; hostname без поддоменов. Неоднозначность требует точный ID либо --all-matches только при удалении. Первое совпадение не выбирается.'
    },
    {
      id: 'source-fields',
      text: 'Поля источника: url (HTTP(S)), title (непустой текст), summary (необязательный непустой текст, не Markdown). --match-url — старый URL для выбора, --url — новое значение. --clear summary удаляет поле, не записывает null или пустую строку. Проверка URL не проверяет сеть и достоверность.'
    }
  ]
}

/** Поля перевода и разрешённые каналы передачи текста. */
const TEXT_OPTIONS = [
  'title',
  'summary',
  'description',
  'translationStatus',
  'input',
  'set',
  'setStdin',
  'setFile',
  'clear'
]
/** Универсальные скалярные поля; контекст справки ограничивает их реальной схемой типа. */
const EDIT_OPTIONS = [
  ...TEXT_OPTIONS,
  'name',
  'server',
  'direction',
  'opcode',
  'order',
  'releasedOn',
  'status',
  'branch',
  'saga',
  'chronicle',
  'region',
  'add',
  'remove',
  ...WRITE_OPTION_IDS
]
/** Общий список и его выборки. */
const LIST_OPTIONS = [...READ_OPTION_IDS, ...FILTER_OPTION_IDS, 'offset', 'all', 'sort', 'saveSelection']

/**
 * Формирует запись команды с обязательными разделами и собственными правилами.
 */
function spec(
  id: string,
  signature: string,
  purpose: string,
  options: string[],
  result: string,
  absence: string,
  ruleSets: string[],
  rules: HelpRule[],
  related: string[],
  args: Record<string, string> = {},
  typed = false
): CommandSpec {
  return {
    id,
    signature,
    purpose,
    options: [...new Set(options)],
    result,
    absence,
    ruleSets: ['base', ...ruleSets],
    rules,
    related,
    arguments: args,
    typed
  }
}

/** Реестр нового интерфейса; отсутствие описания команды или параметра останавливает проверку покрытия. */
export const COMMAND_SPECS: readonly CommandSpec[] = [
  spec(
    'help',
    'help [topics...]',
    'Изучить выбранную команду, тип, группу или рабочий сценарий без базы и внешней документации.',
    ['helpType'],
    'Полный контракт команды: параметры, правила, поля, результат, ошибки и исполняемые примеры; JSON описывает выбранный узел.',
    'Без темы — обзор CLI. Неизвестная команда/тип — ошибка с допустимыми вариантами.',
    [],
    [
      {
        id: 'help-routing',
        text: 'Равнозначны help update --type releases и update release:example --help. Для вложенных команд: help source add --type releases. workflow: catalog,translate,research.'
      }
    ],
    ['types', 'schema'],
    { topics: 'Путь команды (source add), необязательный полный адрес или workflow <name>.' }
  ),
  spec(
    'types',
    'types',
    'Узнать пространства адресов, доступные типы, поля и отношения, не открывая SQLite.',
    [],
    'Реестр 14 типов, их адреса и собственные операции; техническая карточка и редакция различаются.',
    'Работает до init и при отсутствующем файле базы.',
    [],
    [],
    ['schema', 'create']
  ),
  spec(
    'schema',
    'schema <operation> [key] [relation]',
    'Получить публичную схему ввода именно выбранной операции и типа без существующей записи.',
    ['helpType'],
    'Текст: смысл, типы, форматы, обязательность, очистка и каналы ввода. JSON: машиночитаемая схема, не внутренние DTO.',
    'Тип определяется из адреса либо --type; для операций без предметного типа он не нужен.',
    [],
    [
      {
        id: 'schema-operation',
        text: 'Имена вложенных операций записываются с точкой: translation.set, revision.add, source.remove, locale.add. Батч описывает операции и зависимые поля values/files; обязательные UUID не вводятся.'
      }
    ],
    ['help', 'types'],
    {
      operation: 'Имя операции с точками между уровнями.',
      key: 'Необязательный полный адрес для определения типа; существование не проверяется.',
      relation: 'Необязательное имя связи для link/unlink.'
    }
  ),
  spec(
    'status',
    'status',
    'Проверить путь и состояние SQLite, языки, счётчики и актуальность экспортированного снимка.',
    ['withVersion'],
    'Путь, exists, схема, основной язык и реестр, количество записей, состояние экспорта; по запросу полный токен версии.',
    'Отсутствующая или несовместимая база описывается, но не создаётся и не импортируется.',
    ['read'],
    [],
    ['init', 'import', 'validate', 'stats']
  ),
  spec(
    'read',
    'read [keys...]',
    'Прочитать любые полные адреса одним согласованным запросом, сохраняя исходный порядок.',
    [...READ_OPTION_IDS, 'keysFile', 'selection', 'content', 'allowMissing'],
    'Выбранные записи с availability, точным адресом редакции и выбранным языком; JSON meta.page и meta.itemsComplete.',
    'Одна недоступная запись — ошибка 3; множественный read сохраняет успешные блоки в stdout и даёт код 3. --allow-missing разрешает 0 без сокрытия пропусков.',
    ['read', 'language', 'page', 'selection'],
    [
      {
        id: 'read-input',
        text: 'Нужен ровно один источник адресов: keys..., --keys-file либо --selection. Для --content нужен ровно один текст одного языка; режим несовместим с представлением, выбором полей и пагинацией.'
      },
      {
        id: 'read-card',
        text: 'Без --protocol карточка показывает свои поля и перечень редакций, не заимствуя произвольный заголовок. read packet:example:rev-1 читает точную редакцию. edit карточки не является полным текстом редакций.'
      }
    ],
    ['list', 'find', 'update'],
    { keys: 'Один или несколько полных адресов разных типов, без скрытого лимита 50.' },
    true
  ),
  spec(
    'list',
    'list',
    'Перечислить все либо отфильтрованные записи с явным объёмом и продолжением.',
    LIST_OPTIONS,
    'Целые записи brief по умолчанию, область, общее число, диапазон, остаток, курсор и полная команда продолжения.',
    'Пустая выборка — успех с 0 записей; непереведённая запись не исчезает. --all действительно снимает пагинацию.',
    ['read', 'language', 'filter', 'page', 'selection'],
    [],
    ['read', 'find', 'stats'],
    {},
    true
  ),
  spec(
    'find',
    'find <text>',
    'Найти текст во всём каталоге и знаниях без обязательного протокола.',
    [...LIST_OPTIONS, 'searchIn', 'match'],
    'Краткие записи, имя поля совпадения, язык и фрагмент; полный документ читается read.',
    'Пустой результат — успех. Без протокола знания ищутся в исходных редакциях под адресами :rev-N; с протоколом — только применимые.',
    ['read', 'language', 'filter', 'page', 'selection'],
    [
      {
        id: 'find-normalize',
        text: 'Поиск нормализует Unicode и регистр текста. key и sources.url имеют буквальное сравнение. Аннотация не вычисляется из description.'
      }
    ],
    ['read', 'list'],
    { text: 'Настоящий текст поиска; кавычки оболочки нужны для пробелов и специальных символов.' },
    true
  ),
  spec(
    'stats',
    'stats',
    'Посчитать записи по предметным признакам и источники без вывода длинных документов.',
    [...FILTER_OPTION_IDS, 'protocol', 'allLocales', 'by'],
    'Группы счётчиков, число записей, число объектов источников и число уникальных URL.',
    'Пустой набор даёт нулевые счётчики. Отсутствующие данные не превращаются в выдуманный статус.',
    ['read', 'language', 'filter'],
    [],
    ['list', 'status'],
    {},
    true
  ),
  spec(
    'tree',
    'tree [key]',
    'Обозреть дерево классификации и выпусков с копируемыми адресами.',
    ['depth'],
    'Корни и дочерние записи до заданной глубины; без JSON-дерева служебных свойств в тексте.',
    'Без key — ветки; depth 0 показывает только корень. Пустая классификация описывается явно.',
    ['read'],
    [],
    ['relations', 'list'],
    { key: 'Необязательный полный адрес корня.' },
    true
  ),
  spec(
    'relations',
    'relations <key>',
    'Показать роль входящих и исходящих связей, включая вычисленные Markdown-упоминания.',
    ['in', 'out', 'relation'],
    'Адрес источника, отношение, адрес цели, роль и отметка вычисленной связи.',
    'Без --in/--out — оба направления; отсутствие связей не означает отсутствие самой записи.',
    ['read'],
    [
      {
        id: 'relations-direction',
        text: '--in и --out несовместимы. Вычисленная mention не редактируется как отдельный факт; для неё изменяется исходный Markdown.'
      }
    ],
    ['link', 'unlink', 'read'],
    { key: 'Полный адрес существующей записи.' },
    true
  ),
  spec(
    'create',
    'create <key>',
    'Создать новую предметную запись без ручных UUID и повторения адресных полей.',
    [...EDIT_OPTIONS, 'ifExists', 'unscoped'],
    'Созданная запись и содержательный diff; код и UUID определяются адресом и API.',
    'Существующий адрес — конфликт; --if-exists skip явно пропускает без сравнения/обновления. Без языковых полей пустой перевод не создаётся.',
    ['write', 'input', 'language'],
    [
      {
        id: 'create-required',
        text: 'Обязательные поля различаются: saga — branch; chronicle — branch; release — chronicle; packet — name,server,direction. Контекст берёт release и локальный code из адреса, редакция — владельца и rev. Другие необязательные поля остаются неизвестными.'
      }
    ],
    ['read', 'update', 'link'],
    { key: 'Полный новый адрес; одинаковые коды chronicle:example и release:example допустимы.' },
    true
  ),
  spec(
    'update',
    'update [keys...]',
    'Изменить только явно переданные поля выбранных записей и одного перевода.',
    [...EDIT_OPTIONS, 'selection'],
    'Конечный diff по полям и языкам, число реально изменённых записей, версия сохранённого результата.',
    'Непереданное поле не меняется, включая order, opcode, status и translationStatus. Повтор значения — no-op.',
    ['write', 'input', 'language', 'selection'],
    [
      {
        id: 'update-owned',
        text: 'Нельзя передать translations целиком или заменить sources/questions/protocols/countries обычным update. Перевод редактируется адресно, списки связей — link/unlink, полная замена — replace с версией.'
      }
    ],
    ['read', 'translation.set', 'replace'],
    { keys: 'Полные адреса одного или нескольких владельцев; альтернатива — --selection.' },
    true
  ),
  spec(
    'replace',
    'replace <key>',
    'Сознательно заменить всё edit-представление записи, включая переводы и списки.',
    ['requiredInput', ...WRITE_OPTION_IDS],
    'Полный diff замены существующего адреса без переименования или изменения UUID.',
    'Требуются --input и явный --if-version. Пропущенные необязательные поля становятся умолчаниями полной записи, а не сохраняются как в update.',
    ['write', 'input'],
    [
      {
        id: 'replace-version',
        text: 'Прочитайте исходную запись через read <key> --view edit --with-version. Вход — сама публичная запись, не оболочка {ok,data,meta}. Системные поля можно опустить; переданные id/key/code/владелец проверяются как неизменяемые.'
      }
    ],
    ['read', 'update'],
    { key: 'Полный адрес существующей записи.' },
    true
  ),
  spec(
    'delete',
    'delete [keys...]',
    'Удалить указанные записи без удаления связанных самостоятельных сущностей.',
    ['selection', 'cascadeOwned', 'allowBrokenLinks', ...WRITE_OPTION_IDS],
    'Удаляемые адреса, тексты и принадлежащие сведения в diff; атомарный результат.',
    'Неразрешённые предметные ссылки препятствуют удалению. Принадлежащие редакции требуют --cascade-owned; отсутствующий адрес — ошибка.',
    ['write', 'selection'],
    [
      {
        id: 'delete-dependencies',
        text: 'Перенесите мешающие связи либо явно удалите нужные записи одним батчем. Хроника не владеет жизненным циклом релизов. Новые битые Markdown-ссылки требуют --allow-broken-links; FK не отключаются.'
      }
    ],
    ['relations', 'batch', 'unlink'],
    { keys: 'Точные полные адреса или --selection.' },
    true
  ),
  spec(
    'link',
    'link <key> <relation> [targets...]',
    'Добавить или явно заменить предметную связь, сохранив остальные.',
    ['replace', 'unscoped', 'before', 'afterTarget', ...WRITE_OPTION_IDS],
    'Добавленные/перемещённые связи с обоими адресами и ролью; затронутые переиспользуемые редакции.',
    'Повтор существующей связи без перемещения — no-op. Нет неявного выбора последней редакции.',
    ['write', 'links'],
    [],
    ['relations', 'unlink'],
    {
      key: 'Полный адрес владельца исходящей связи.',
      relation: 'Собственное отношение из схемы типа.',
      targets: 'Полные адреса целей. Нужна хотя бы одна цель; краткие коды в позициях не используются.'
    },
    true
  ),
  spec(
    'unlink',
    'unlink <key> <relation> [targets...]',
    'Убрать указанные связи, не удаляя сами целевые записи.',
    ['allLinks', ...WRITE_OPTION_IDS],
    'Удалённые связи одного владельца; остальные цели сохраняются.',
    'Отсутствующая связь — no-op. Нужны targets либо --all, но не оба варианта. Обязательную одиночную связь удалить нельзя.',
    ['write', 'links'],
    [],
    ['relations', 'link'],
    {
      key: 'Полный адрес владельца.',
      relation: 'Имя собственного отношения.',
      targets: 'Полные адреса удаляемых целей; альтернатива --all.'
    },
    true
  ),
  spec(
    'translation',
    'translation',
    'Работать с отдельными переводами без замены массива языков.',
    [],
    'Группа list/set/delete; выберите подкоманду для её полного контракта.',
    'Вызов группы без подкоманды показывает обзор, не ошибку.',
    ['language'],
    [],
    ['translation.list', 'translation.set', 'translation.delete']
  ),
  spec(
    'translation.list',
    'list <key>',
    'Перечислить сохранённые переводы и их состояния.',
    [],
    'Язык, заголовок и translationStatus каждого существующего перевода, без полных документов.',
    'Пустой список переводов отличается от отсутствующей записи. Автоматические переводы не создаются.',
    ['read', 'language'],
    [],
    ['translation.set', 'read'],
    { key: 'Адрес записи с собственными переводами.' },
    true
  ),
  spec(
    'translation.set',
    'set <key>',
    'Создать отсутствующий перевод либо изменить только переданные языковые поля.',
    [...TEXT_OPTIONS, ...WRITE_OPTION_IDS],
    'Diff только выбранного языка; источники, вопросы, другие языки и технические признаки сохраняются.',
    'Отсутствующий перевод начинается с пустых title/summary/description и ready; текст соседнего языка не копируется.',
    ['write', 'input', 'language'],
    [],
    ['translation.list', 'translation.delete', 'read'],
    { key: 'Адрес владельца перевода; для знания — точная редакция.' },
    true
  ),
  spec(
    'translation.delete',
    'delete <key>',
    'Удалить один перевод с его источниками и вопросами.',
    WRITE_OPTION_IDS,
    'Diff удаляемого языка, включая его Markdown и вложенные сведения.',
    'Другие переводы и предметная запись сохраняются. Ограничение documented по непустому описанию продолжает проверяться.',
    ['write', 'language'],
    [],
    ['translation.list', 'translation.set'],
    { key: 'Полный адрес владельца.' },
    true
  ),
  spec(
    'revision',
    'revision',
    'Перечислять и создавать технические редакции карточки знания.',
    [],
    'Группа list/add; существующие редакции читаются и изменяются по собственным адресам.',
    'Номер редакции не равен номеру игрового релиза.',
    [],
    [],
    ['revision.list', 'revision.add', 'read', 'update']
  ),
  spec(
    'revision.list',
    'list <key>',
    'Перечислить редакции одной карточки и их явную применимость.',
    [],
    'Адрес, номер, status, protocols и языки каждой редакции, без полных документов.',
    'Карточка без редакций даёт пустой список; адрес редакции вместо карточки — ошибка.',
    ['read'],
    [],
    ['revision.add', 'read'],
    { key: 'Карточка packet:, scenario: или article: без :rev-N.' },
    true
  ),
  spec(
    'revision.add',
    'add <key>',
    'Создать новую редакцию карточки, при необходимости копируя описанное содержимое.',
    [...TEXT_OPTIONS, 'status', 'opcode', 'add', 'remove', 'rev', 'from', ...WRITE_OPTION_IDS],
    'Новый адрес :rev-N и diff; применимость назначается отдельно через link.',
    'Без --rev выбирается следующий номер; без --from содержимое не копируется. Ошибка версии не повторяет выделение номера автоматически.',
    ['write', 'input', 'language'],
    [
      {
        id: 'revision-copy',
        text: '--from копирует редакцию того же вида, но не protocols. UUID источников новые, явно переданные поля меняют копию. Изменять старую редакцию нужно через update по полному адресу.'
      }
    ],
    ['revision.list', 'link', 'read'],
    { key: 'Карточка packet:, scenario: или article:, не существующая редакция.' },
    true
  ),
  spec(
    'source',
    'source',
    'Добавлять, изменять и адресно удалять источники конкретного перевода.',
    [],
    'Группа list/add/update/remove/clear; remove сохраняет несовпавшие источники, clear удаляет все в явной области.',
    'Количество источников не определяет status знания.',
    ['language'],
    [],
    ['source.list', 'source.add', 'source.update', 'source.remove', 'source.clear']
  ),
  spec(
    'source.list',
    'list <key>',
    'Прочитать источники владельца с ID, URL и языком.',
    ['allLocales'],
    'Существующие объекты источников выбранного языка либо всех языков.',
    'Пустой список — нормальное состояние; источник другого языка не подставляется.',
    ['read', 'language'],
    [],
    ['source.add', 'source.update', 'source.remove'],
    { key: 'Адрес владельца с собственными переводами.' },
    true
  ),
  spec(
    'source.add',
    'add <key>',
    'Добавить один источник выбранному переводу без чтения и перезаписи остальных.',
    ['url', 'title', 'summary', 'input', 'set', 'setStdin', 'setFile', ...WRITE_OPTION_IDS],
    'Новый источник с автоматически назначенным ID; в diff видны URL и язык.',
    'Обязательны url и title, каждый через один канал (флаг, input или разрешённый текстовый файл). summary необязателен.',
    ['write', 'language', 'input', 'source'],
    [],
    ['source.list', 'source.update'],
    { key: 'Полный адрес владельца перевода.' },
    true
  ),
  spec(
    'source.update',
    'update <key>',
    'Изменить поля одного точно выбранного источника, сохранив его ID.',
    ['id', 'matchUrl', 'url', 'title', 'summary', 'clear', 'input', 'set', 'setStdin', 'setFile', ...WRITE_OPTION_IDS],
    'Diff конкретного источника и языка, остальные объекты не заменяются.',
    'Нужен ровно один --id либо --match-url. Несовпавший критерий — NOT_FOUND, неоднозначный URL — CONFLICT.',
    ['write', 'language', 'input', 'source'],
    [],
    ['source.list', 'source.remove'],
    { key: 'Адрес владельца; --id не заменяет адрес владельца.' },
    true
  ),
  spec(
    'source.remove',
    'remove [keys...]',
    'Удалить только источники, совпавшие с явно заданным критерием.',
    ['selection', 'allLocales', 'id', 'matchUrl', 'matchHost', 'allMatches', ...WRITE_OPTION_IDS],
    'URL и языки удалённых совпадений; остальные источники выбранных владельцев сохраняются.',
    'Нужен ровно один критерий. Ноль совпадений — no-op без расширения поиска; несколько требуют --all-matches.',
    ['write', 'language', 'selection', 'source'],
    [],
    ['source.list', 'source.clear', 'list'],
    { keys: 'Точные адреса владельцев либо --selection.' },
    true
  ),
  spec(
    'source.clear',
    'clear [keys...]',
    'Удалить все источники выбранных владельцев только в явно указанной языковой области.',
    ['selection', 'allLocales', ...WRITE_OPTION_IDS],
    'Удаляемые URL, конкретные языки и число объектов в diff.',
    'Обязательно явно передать --locale либо --all-locales, даже для пустой выборки. Не удаляет перевод, вопросы или владельца.',
    ['write', 'language', 'selection', 'source'],
    [],
    ['source.remove', 'source.list'],
    { keys: 'Точные владельцы либо --selection; это не все записи базы.' },
    true
  ),
  spec(
    'question',
    'question',
    'Работать с открытыми вопросами конкретного перевода.',
    [],
    'Группа list/add/remove/clear; идентичность вопроса — точный текст, не номер строки.',
    'Повтор неизменённого вопроса может быть no-op.',
    ['language'],
    [],
    ['question.list', 'question.add', 'question.remove', 'question.clear']
  ),
  spec(
    'question.list',
    'list <key>',
    'Прочитать полные открытые вопросы выбранного языка.',
    ['allLocales'],
    'Тексты вопросов с владельцем и языком, без усечения.',
    'Пустой список не означает полного исторического знания и не меняет status.',
    ['read', 'language'],
    [],
    ['question.add', 'question.remove'],
    { key: 'Адрес владельца с собственными переводами.' },
    true
  ),
  spec(
    'question.add',
    'add <key>',
    'Добавить один непустой вопрос, сохранив остальные.',
    ['text', ...WRITE_OPTION_IDS],
    'Diff вопроса конкретного перевода.',
    'Неизменённый повтор — no-op. Отсутствующий перевод создаётся пустым, без копирования другого языка.',
    ['write', 'language'],
    [],
    ['question.list', 'question.remove'],
    { key: 'Полный адрес владельца перевода.' },
    true
  ),
  spec(
    'question.remove',
    'remove <key>',
    'Убрать вопрос по точному тексту, не по номеру строки.',
    ['text', ...WRITE_OPTION_IDS],
    'Удалённый текст конкретного языка; другие вопросы сохраняются.',
    'Отсутствующий вопрос — no-op, не удаление соседнего вопроса.',
    ['write', 'language'],
    [],
    ['question.list', 'question.clear'],
    { key: 'Полный адрес владельца.' },
    true
  ),
  spec(
    'question.clear',
    'clear <key>',
    'Убрать все вопросы одного владельца в явной языковой области.',
    ['allLocales', ...WRITE_OPTION_IDS],
    'Diff всех удаляемых вопросов указанного языка либо всех существующих языков.',
    'Обязательно явно указать --locale либо --all-locales. Источники, тексты и соседние владельцы сохраняются.',
    ['write', 'language'],
    [],
    ['question.list', 'question.remove'],
    { key: 'Один полный адрес владельца.' },
    true
  ),
  spec(
    'locale',
    'locale',
    'Управлять реестром языков базы без SQL и полной подмены снимка.',
    [],
    'Группа list/add/set-default/delete; изменение реестра не переводит документы автоматически.',
    'Основной язык и используемый язык не удаляются скрыто вместе с переводами.',
    [],
    [],
    ['locale.list', 'locale.add', 'locale.set-default', 'locale.delete']
  ),
  spec(
    'locale.list',
    'list',
    'Показать зарегистрированные языки и основной язык.',
    [],
    'Упорядоченный реестр и явная отметка defaultLocale.',
    'Для предметных чтений язык по умолчанию берётся из этого реестра.',
    ['read'],
    [],
    ['locale.add', 'locale.set-default']
  ),
  spec(
    'locale.add',
    'add <code>',
    'Зарегистрировать новый язык, не создавая пустые переводы.',
    WRITE_OPTION_IDS,
    'Проверенный diff реестра языков и токен сохранённого состояния.',
    'Уже зарегистрированный язык — no-op; документы и их статусы не меняются.',
    ['write'],
    [
      {
        id: 'locale-code',
        text: 'Код: 2–3 строчные латинские буквы, необязательные сегменты через дефис, например ru,en,pt-BR. Язык не является регионом игры.'
      }
    ],
    ['locale.list', 'translation.set'],
    { code: 'Новый код языка.' }
  ),
  spec(
    'locale.set-default',
    'set-default <code>',
    'Изменить основной язык базы без переписывания переводов.',
    WRITE_OPTION_IDS,
    'Новое defaultLocale в метаданных, без копирования текстов.',
    'Язык должен быть зарегистрирован; повтор текущего основного — no-op.',
    ['write'],
    [],
    ['locale.add', 'locale.list'],
    { code: 'Существующий зарегистрированный код.' }
  ),
  spec(
    'locale.delete',
    'delete <code>',
    'Удалить неиспользуемый неосновной язык из реестра.',
    WRITE_OPTION_IDS,
    'Diff реестра без скрытого удаления переводов.',
    'Основной или используемый язык — конфликт. Сначала отдельно смените основной язык и удалите нужные переводы.',
    ['write'],
    [],
    ['locale.list', 'translation.delete', 'locale.set-default'],
    { code: 'Код неосновного языка без сохранённых переводов.' }
  ),
  spec(
    'batch',
    'batch',
    'Выполнить публичные предметные операции одной транзакцией.',
    ['input', 'legacyFile', ...WRITE_OPTION_IDS],
    'Итоговый общий diff и счётчики; ошибка содержит индекс операции, адрес, поле и язык.',
    '--input обязателен для нового батча; пустой operations — no-op. Прежний --file принимает другой совместимый DTO-контракт.',
    ['write', 'input'],
    [
      {
        id: 'batch-order',
        text: 'Вход: {formatVersion:1,operations:[{op,key,locale?,values?,files?,clear?,add?,remove?,relation?,targets?,options?}]}. op: create,update,replace,delete,translation.set,translation.delete,link,unlink,source.add,source.update,source.remove,source.clear,question.add,question.remove,question.clear.'
      },
      {
        id: 'batch-final',
        text: 'Операции выполняются по порядку: create затем update того же адреса разрешены, изменение после delete — ошибка. Последняя явная запись скаляра побеждает; ссылки проверяются по конечному графу.'
      },
      {
        id: 'batch-files',
        text: 'values содержит непосредственные публичные поля, files — пути по именам разрешённых текстовых полей. Одно поле не может быть в обоих. Пути от каталога файла батча; для --input - от cwd. files не читает stdin, все файлы загружаются до SQL-записи.'
      },
      {
        id: 'batch-replace',
        text: 'Для replace внутри батча требуется явный общий --if-version. options содержит критерии источников, replace,unscoped,all,allLocales,allMatches,cascadeOwned,allowBrokenLinks,ifExists,before,after; поле key передаётся один раз, UUID не обязательны.'
      }
    ],
    ['schema', 'validate', 'read']
  ),
  spec(
    'validate',
    'validate [keys...]',
    'Проверить структуру знаний, предметные ссылки и при запросе Markdown.',
    ['selection', 'links', 'strictLinks'],
    'Явная область проверки, число записей и предупреждения; полнота исследования не приравнивается к валидности.',
    'Без адресов — вся база. С адресами/выборкой — записи и необходимые зависимости, не заявление о проверке всей базы.',
    ['read', 'selection'],
    [],
    ['read', 'relations', 'export'],
    { keys: 'Необязательный точный набор адресов; альтернатива --selection.' },
    true
  ),
  spec(
    'export',
    'export',
    'Явно сохранить согласованный снимок всех таблиц в каталог для Git.',
    ['output', ...WRITE_OPTION_IDS],
    'Проверенный полный экспорт с атомарной публикацией каталога; предметная база не меняется.',
    '--dry-run не создаёт экспорт. Произвольный непустой каталог и каталог с рабочим SQLite не заменяются.',
    ['read'],
    [
      {
        id: 'export-explicit',
        text: 'Экспорт не запускается автоматически после правки и не делает commit/push. Используйте новый каталог либо каталог штатного экспорта. --if-version проверяет ожидаемый снимок.'
      }
    ],
    ['validate', 'status', 'import']
  ),
  spec(
    'import',
    'import',
    'Полностью заменить рабочую базу проверенным экспортированным снимком.',
    ['importInput', 'replace', ...WRITE_OPTION_IDS],
    'Все данные и текущая SQL-структура восстанавливаются атомарно, включая несовместимую старую структуру.',
    'Всегда требуется явный --replace; --dry-run проверяет вход без изменения/создания рабочей базы. Это не способ правки одного текста.',
    ['write'],
    [
      {
        id: 'import-atomic',
        text: 'Некорректный JSON, ссылки, структура или ошибка записи не оставляют частично заменённую базу. Укажите --database явно при работе с другой базой; каталог входа не переключает её сам.'
      }
    ],
    ['status', 'validate', 'export']
  ),
  spec(
    'init',
    'init',
    'Создать пустую SQLite-базу и начальный реестр языков.',
    ['locales', 'defaultLocale', ...WRITE_OPTION_IDS],
    'Новый файл с текущими таблицами, без исследовательских примеров, источников и фиктивных профилей.',
    'Существующий файл никогда не заменяется, даже пустой. --dry-run не создаёт файл; --if-version не может совпасть с отсутствующим снимком.',
    [],
    [
      {
        id: 'init-default',
        text: 'По умолчанию locales=ru,en и defaultLocale=ru. При --locales основной по умолчанию первый; явный --default-locale должен входить в реестр.'
      }
    ],
    ['status', 'create', 'import']
  )
].map((command) => ({
  ...command,
  typed: command.typed || command.id === 'batch',
  details: command.id === 'batch' ? BATCH_DETAILS : undefined,
  options:
    command.id === 'create' ? command.options.filter((id) => !['clear', 'remove'].includes(id)) : command.options,
  requiredOptions: command.id === 'replace' ? ['ifVersion'] : command.id === 'import' ? ['replace'] : [],
  group: ['translation', 'revision', 'source', 'question', 'locale'].includes(command.id),
  fieldsOperation: FIELD_OPERATIONS.has(command.id)
    ? command.id
    : ['read', 'list', 'find', 'stats', 'tree', 'relations', 'types'].includes(command.id)
      ? 'create'
      : undefined
}))

/**
 * Находит точный зарегистрированный новый контракт.
 */
export function commandSpec(id: string): CommandSpec | undefined {
  return COMMAND_SPECS.find((command) => command.id === id)
}

/**
 * Разворачивает применимые правила, не теряя собственные ограничения команды.
 */
export function commandRules(command: CommandSpec): HelpRule[] {
  return [
    ...command.ruleSets.flatMap((name) => {
      const rules = HELP_RULE_SETS[name]
      if (!rules) throw new Error(`Неизвестный набор правил ${name}: ${command.id}`)
      return rules
    }),
    ...command.rules
  ]
}
