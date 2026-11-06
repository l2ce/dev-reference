# CLI справочника

`protocols-db` — текстовый интерфейс чтения и редактирования SQLite-базы.
Грамматика едина для всех типов: `<операция> <полные адреса> [параметры]`.
SQL-модель и данные не меняются ради CLI. `l2ref` в
[проекте интерфейса](../../docs/development/cli-design.md) — условное имя того же CLI.

## Запуск и знакомство с базой

Из корня проекта, Node.js 24 и pnpm:

```bash
pnpm cli:build
pnpm cli help
pnpm cli types
pnpm cli status
pnpm cli schema create --type releases
pnpm cli help workflow catalog
```

По умолчанию используется `packages/database/.local/database.sqlite`.
`--database <path>` выбирает другой файл; относительные пути отсчитываются от cwd.
Чтения открывают SQLite read-only и не создают отсутствующий файл. Справка,
`types` и `schema` не требуют базы. UUID назначаются автоматически.

## Полная встроенная справка

Справка — основной способ изучения CLI; для работы не требуется читать этот README
или исходники. У каждого действия есть назначение, формы вызова, обязательность,
форматы и умолчания ключей, ограничения, результат, отсутствие данных/no-op,
безопасность, диагностика и примеры с командами подготовки на отдельной базе.

```bash
pnpm cli help source add --type releases
pnpm cli source add release:example --help
pnpm cli read packet:example --protocol protocol:1 --help
pnpm cli translation set release:example --help --format json
pnpm cli help workflow catalog
pnpm cli help workflow translate
pnpm cli help workflow research
pnpm cli help update release:example --brief
pnpm cli schema create --type releases --brief
pnpm cli help source update --type releases --format json --structure-only
```

Первые две формы эквивалентны по контракту: адрес уточняет тип и не обязан
существовать. Никакая справка не открывает SQLite и не читает stdin. Контекстные
флаги ограничены реальной схемой типа: у перевода нет `--opcode` или `--branch`.
Вызов группы `pnpm cli source` показывает обзор её действий, а не ошибку.
JSON `data.structure` описывает именно выбранную команду с её примерами и правилами.

`--brief` явно сокращает текст справки: синтаксис, параметры, поля, критичные
ограничения и один основной пример со всей подготовкой. Полная справка остаётся
режимом по умолчанию. Флаг работает с `help`, `--help` и текстовым `schema`;
предметное краткое представление по-прежнему выбирается через `--view brief`.
JSON Schema при `schema --brief --format json` не сокращается.

`--structure-only` требует справочный запрос с `--format json` либо `--json`:
в `data` остаётся только полная `structure`, без дублирующего текста `help`.
Прежний JSON по умолчанию сохраняется. Сочетание с `--brief` отклоняется,
как и применение этих флагов к предметной записи без справочного запроса.

Без контекста универсальная команда показывает различия типов. Совместимые старые
группы перечислены отдельно и явно предупреждают об иной замене массивов и каскадах.
Примеры используют синтетические значения, новый `./example.sqlite` и явный
`--database` в каждой команде; их нельзя выполнять на рабочей базе без осознанного
изменения адреса базы. Подстановки `<version>`/`<cursor>` объяснены до их использования.

`schema` публикует схему значений отдельно от параметров вызова (`parameters`).
Для `batch` JSON Schema зависит от `op` и типа `key`: проверяются обязательные
поля, разрешённые `values/files`, конфликты каналов и критерии вложенных операций.
Внешние ключи, состояние базы и календарные/другие предметные уточнения по-прежнему
проверяет реальный API, а не только сторонний JSON Schema-валидатор.

Проверка справки: `pnpm cli:help:check` из корня. Она входит также в `pnpm test`:
обходит реальное дерево Commander, проверяет описание ключей и контексты всех типов,
исполняет примеры в изолированных SQLite в text/JSON, проверяет JSON Schema через Ajv.
Новая неописанная команда или опция останавливает проверку. Правила развития реестра:
[контракт справки](../../docs/development/cli-help.md).

## Чтение

```bash
pnpm cli list --type releases --chronicle chronicle:gracia
pnpm cli find "шифрование" --type articles,packet-revisions
pnpm cli find "https://example.invalid/source" --search-in sources.url --all
pnpm cli read chronicle:gracia release:gracia-part-1 region:na protocol:152 --view brief
pnpm cli read packet:key-packet --protocol protocol:152 --view full
pnpm cli read packet:key-packet:rev-1 --view edit --with-version
pnpm cli read release:gracia-part-1 --locale ru --content description
```

Адреса каталога, карточки знания и редакции различаются. Позиционные `protocol:152`
и `protocol:273` — самостоятельные записи, не неявный контекст остальных адресов.
Только `--protocol` выбирает применимую редакцию карточки. Без него текст редакции
не угадывается; карточка показывает собственные поля и доступные редакции.

Представления:

- `brief` — адрес, заголовок, аннотация и предметный контекст, без полного документа;
- `full` — все собственные поля и текст выбранного языка, источники и вопросы;
- `edit` — нормализованная запись со всеми переводами и собственными UUID.

У `list`/`find` по умолчанию `brief`, у `read` — `full`. `--fields title,summary`
явно выбирает поля. `--all-locales` возвращает существующие переводы, не подставляя
один язык вместо другого; языковые фильтры одного совпадения проверяются в одном
переводе. `edit` несовместим с ограничивающим `--locale`.

`--content <field>` отдаёт только буквальный текст одного разрешённого поля одной
записи. Пробелы, ограждения кода и завершающий перевод строки сохраняются; include
не раскрывается. Режим несовместим с представлениями, выбором полей, всеми языками
и пагинацией. `--with-version` направляет версию в stderr, не загрязняя документ.

### Наборы, поиск и страницы

```bash
pnpm cli list --type packets --protocol protocol:152 --view full --limit 10
pnpm cli list --type packets --protocol protocol:152 --view full --all
pnpm cli read --keys-file ./keys.txt --view full
pnpm cli list --type packets --protocol protocol:152 --limit 50 --save-selection ./packets.selection.json
pnpm cli read --selection ./packets.selection.json --view full
```

У списков по умолчанию 20 записей; `--all` не имеет скрытого максимума. У явно
заданного набора `read` нет лимита 50 адресов. `--limit` ограничивает число целых
записей, не длину текста. Страница показывает диапазон, остаток и полную команду
продолжения. `--after` фиксирует запрос и версию, `--offset` — обычное смещение.
Размер следующей страницы можно уменьшить. Изменение базы даёт конфликт, не пропуски.

Команды продолжения и восстановления сохраняют выбранную базу и применимый контекст.
В workspace они используют `pnpm --silent cli` (без служебного вывода pnpm в JSON),
при прямом запуске Node.js — абсолютные пути Node.js и CLI, при запуске установленного
бинарника — его путь. Аргументы экранируются для POSIX shell. При повреждённом
или устаревшем курсоре предлагается исходный запрос без курсора; продолжение и
восстановление `read --keys-file -` используют уже прочитанные адреса, не повторный stdin.

У страницы, каждой записи и многострочных полей есть явные BEGIN/END-границы.
Служебная метка не встречается в содержимом; Markdown остаётся буквальным.
Если оболочка усекла вывод, уменьшите порцию, а не считайте документ прочитанным.

Выборка сохраняет только показанные адреса, точные выбранные редакции и версию.
Чтение устаревшей выборки предупреждает и перечитывает те же адреса; запись по ней
завершается конфликтом. Файл выборки не переключает SQLite и не выполняет поиск заново.
`--selection -` допускает чтение выборки из stdin целиком, но для пагинации нужен
файл, чтобы сохранить точные закреплённые редакции между вызовами. Этот канал
учитывается при запрете нескольких читателей stdin.

Фильтры: `--branch`, `--saga`, `--chronicle`, `--release`, `--region`, `--country`,
`--protocol`, `--server`, `--direction`, `--status`, `--translation-status`,
повторяемые `--has`/`--missing`, `--source-url`, `--source-host`.
Несовместимый явно выбранный тип — ошибка, а не проигнорированный фильтр.
`--source-host` сравнивает точный хост, без поддоменов. Поиск нормализует Unicode
и регистр текста; адреса и URL сравниваются буквально. `--match` принимает
`contains`, `exact`, `prefix`; поля задаются через `--search-in`.
Текст поиска с ведущим дефисом передаётся после `--`, например
`pnpm cli find --type protocols -- --help`; команда продолжения сохраняет этот разделитель.

## Создание и точечные изменения

```bash
pnpm cli create branch:example --title "Example"
pnpm cli create saga:example --branch example
pnpm cli create chronicle:example --branch example --saga example
pnpm cli create release:example --chronicle example --title "Example"
pnpm cli create release-context:example:na --region na
pnpm cli update release:example --locale ru --title "Новое название" --dry-run
```

Названия в примерах не являются историческими фактами. Тип и составляющие адреса
выводятся из ключа. В типизированных флагах допустим короткий код. Код, UUID и
владелец редакции/регионального контекста неизменяемы. `--if-exists skip` явно
пропускает существующую запись, не сравнивая и не обновляя её поля.

Обычный `update` изменяет только переданные поля. Он не заменяет массив переводов,
источники, вопросы или списки предметных связей. `--clear` даёт `null`, пустой текст
или список согласно типу; обязательную связь очистить нельзя. `--add`/`--remove`
работают только со скалярными списками `states`, `servers`, `loginRevisions`.
Известный опкод `u8:0` не равен неизвестному `null`; составной: `u8:0xFE/u16le:0x0012`.

### Текст без временных файлов

```bash
pnpm cli update release:example --locale ru --set 'title=Название' --set 'summary=Аннотация'
pnpm cli update release:example --locale ru --set-stdin description --dry-run <<'DOCUMENT'
# Описание

  Авторские отступы, $ и `код` сохраняются.
DOCUMENT
pnpm cli update release:example --set-file description=./existing-draft.md
```

`--description` и повторяемый `--set поле=значение` принимают настоящий многострочный
текст; разделяется только первый `=`. `--set-file поле=-` равнозначен `--set-stdin`.
Одно поле нельзя задавать несколькими способами. Два читателя stdin отклоняются
до чтения; TTY не меняет семантику `-`. Ввод ограничен 16 МиБ, проверяется UTF-8,
ничего не обрезается и литералы `\n` не преобразуются в переносы.

### Связи, переводы, редакции и вложенные сведения

```bash
pnpm cli link release-context:example:na protocols protocol:152
pnpm cli unlink release-context:example:na protocols protocol:152
pnpm cli link release:example chronicle chronicle:another --replace --dry-run
pnpm cli translation set release:example --locale en --title "Example"
pnpm cli translation delete release:example --locale en --dry-run
pnpm cli revision add packet:example --title "Первая редакция"
pnpm cli revision add packet:example --from packet:example:rev-1
pnpm cli source add release:example --locale ru --url https://example.invalid/source --title "Источник"
pnpm cli source update release:example --match-url https://example.invalid/source --summary "Пояснение"
pnpm cli source remove --selection ./sources.selection.json --all-locales --match-host example.invalid --all-matches --dry-run
pnpm cli question add release:example --text "Что ещё требуется проверить?"
```

Одиночная замена связи и перенос применимости между редакциями требуют `--replace`.
Множественная связь сохраняет остальных участников; `--before`/`--after` явно меняют
порядок. Прямой протокол релиза без регионального контекста требует `--unscoped`.
Протокол связывается с точным адресом редакции, не с карточкой.

`translation set` создаёт отсутствующий перевод или меняет только переданные поля.
`revision add` назначает следующий номер с защитой версии; копирование не переносит
применимость, UUID источников назначаются заново. Обычные `read/update/delete` редакции
используют её собственный адрес. Все вложенные группы имеют `list`.

Источники принадлежат переводу. Выбор существующего источника — `--id` либо точный
`--match-url`; новый URL — `--url`. Неоднозначность требует ID или явного
`--all-matches` для удаления. `--clear summary` удаляет необязательное поле.
`source clear` и `question clear` требуют явного `--locale` либо `--all-locales`.
Источники необязательны при любом статусе и не добавляются автоматически.

## Безопасность, батчинг и обмен

Любая предметная мутация поддерживает `--dry-run` и `--if-version`.
Предпросмотр использует тот же конечный план, что запись: поля, язык, старые/новые
значения, URL, связи и протоколы переиспользуемых редакций. По умолчанию предпросмотр
показывает `--diff full`, запись — `--diff summary`. Токен версии всегда полный;
dry-run не объявляет будущую версию сохранённой. Автоматического повтора записи нет.
Текст успешной записи показывает исходную и сохранённую версии; `init` и импорт
в новый файл — сохранённую. No-op сохраняет прежний токен. В JSON это
`meta.previousVersion`/`meta.version` для обычной мутации; предпросмотр не выдаёт
будущую версию. У конфликта явного `--if-version` доступны ожидаемая и текущая версии.

`delete` не удаляет связанные самостоятельные записи ради устранения FK-конфликта.
Для принадлежащих редакций нужен `--cascade-owned`; для новых неразрешённых ссылок
Markdown — `--allow-broken-links`. `replace <key> --input <path|-> --if-version …`
явно заменяет всё edit-представление, включая переводы; это не обычная правка текста.

```bash
pnpm cli batch --input ./changes.json --dry-run
pnpm cli validate --links
pnpm cli export
pnpm cli import --input ./snapshot --replace --dry-run
pnpm cli init --locales ru,en --default-locale ru
pnpm cli locale add de --dry-run
```

Батч: `{ "formatVersion": 1, "operations": [...] }`. Операция содержит `op`, один
`key`, необязательный `locale`, `values` и `files`. Например:

```json
{
  "formatVersion": 1,
  "operations": [
    { "op": "create", "key": "release:example", "values": { "chronicle": "chronicle:example" } },
    { "op": "update", "key": "release:example", "files": { "description": "./draft.md" } },
    { "op": "translation.set", "key": "release:example", "locale": "en", "values": { "title": "Example" } }
  ]
}
```

Пути `files` отсчитываются от каталога пакета, для stdin — от cwd. Файлы читаются
до SQL-записи. Операции выполняются по порядку, ссылки проверяются по конечному
графу; ошибка откатывает весь пакет. Для связей используются `relation`, `targets`;
критерии источников и явные разрешения передаются в `options`. Схема: `schema batch`.

Экспорт выполняется только явно, без commit/push. Импорт требует `--replace`,
поддерживает dry-run и восстанавливает даже несовместимую старую SQL-структуру
атомарно. `init` никогда не заменяет существующий файл. Удаление основного либо
используемого языка не удаляет переводы скрыто.

## JSON, диагностика и совместимость

`--format json` возвращает один `{ ok: true, data, meta }`; ошибка исполнения —
пустой stdout и `{ ok: false, error }` в stderr. Метаданные содержат версию, область,
язык, представление и `page`: `start/end/returned/total/remaining/hasMore/nextCursor`.
Неполное множественное чтение сохраняет найденные записи в stdout и устанавливает
`meta.itemsComplete: false`, код 3; `--allow-missing` явно разрешает код 0.
Недоступные элементы чтения содержат `nextSteps`; в тексте это раздел «Уточнить».
Отсутствующий перевод ведёт к списку переводов, неприменимая редакция — к списку
редакций, неизвестный адрес — к каталогу соответствующего типа. Другие язык и
редакция не подставляются автоматически.

Диагностика полей сохраняет `issues` схемы и объясняет предметное исправление:
поля редакции нельзя записывать в карточку, связи меняются через `link/unlink`,
переводы и вложенные сведения — собственными действиями. Ошибки отдельных операций батча указывают
`operationIndex` (с нуля), `operation`, адрес и язык ошибочной операции.
`nextSteps` предлагают безопасное уточнение, не автоматическое повторение записи.

Коды: 0 — успех/no-op/пустой поиск, 1 — неожиданный сбой, 2 — неверный ввод
(включая неверный каталог импорта/экспорта и строки снимка),
3 — недоступные данные, 4 — конфликт версии/существования, 5 — занятая база или каталог экспорта.
`EPIPE` не печатает стек. По умолчанию язык данных — основной язык базы, интерфейс — русский.

Прежние предметные группы и `--json` сохранены для совместимости, но скрыты из
основной справки. Их DTO-батч доступен только через старый `batch --file`.
Новый интерфейс не использует эти оболочки или прежнюю замену массивов в `update`.
Семантический SHA-256 старого API (`revision/ifRevision`) и непрозрачный токен
нового интерфейса (`version/ifVersion`) — разные контракты; смешивать их нельзя.

Проверки: `pnpm cli:build`, `pnpm --filter @l2ce/dev-reference-cli test`, `pnpm typecheck`.
