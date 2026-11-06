# CLI справочника

`protocols-db` — предметный интерфейс для чтения и наполнения SQLite-базы.
Обычные команды используют читаемые ключи; UUID назначаются при создании.
По умолчанию результат выводится текстом, `--json` включает машинный формат.

## Запуск

Из корня проекта, Node.js 24 и pnpm:

```bash
pnpm cli:build
pnpm cli import
pnpm cli status
pnpm cli --help
```

По умолчанию используется `packages/database/.local/database.sqlite`.
`--database <path>` выбирает другой файл. Относительные пути файлов и каталогов
отсчитываются от текущего рабочего каталога процесса CLI.

## Поиск и чтение

```bash
pnpm cli protocols list --branch main --number 152
pnpm cli protocols get 152 152-rev-1 --locale ru
pnpm cli chronicles list --branch main
pnpm cli releases get high-five

pnpm cli packets list --protocol 273 --server game
pnpm cli search --protocol 273 --locale ru --query "соединение"
pnpm cli search --protocol 273 --kind packet --status missing
pnpm cli packets get protocol-version key-packet --protocol 273 --locale ru
pnpm cli read packet:protocol-version scenario:game-connection --protocol 273 --json
```

Группы: `branches`, `sagas`, `chronicles`, `releases`, `contexts`, `regions`, `countries`, `protocols`, `packets`, `scenarios`,
`articles`. Внутри группы достаточно короткого ключа: `key-packet`, `273`,
`152-rev-1`, `high-five`, `high-five:na`. Полные `release:...`, `saga:...`, `region:...`, `packet:...`, `protocol:...` тоже принимаются.
Для смешанного чтения через `read` указываются полные ключи.

`get` знаний требует протокол. Выбирается только применимая редакция и указанный
язык. Пробелы имеют явный `availability`: `not-found`, `unmapped`,
`translation-missing`. Для доступного текста возвращаются Markdown, источники,
статусы и вопросы. Другой язык или соседний протокол не подставляются.
Markdown возвращается буквально, включая внутренние директивы.

Поиск работает по заголовкам, аннотациям и Markdown выбранного языка.
Списки поддерживают `--limit` (1–100) и `--offset`; ответ содержит `nextOffset`.
`get` и `read` принимают до 50 ключей и читают их из одного снимка.
Каждый результат содержит общую `revision` базы.

Для исследования исходных данных:

```bash
pnpm cli packets inspect key-packet
pnpm cli packets revisions key-packet
pnpm cli packets inspect key-packet --rev 1 --json
pnpm cli packets schema --rev 1 --json
```

`inspect` возвращает технические поля и все переводы. `schema` доступна до
создания базы и перечисляет поля, назначаемые командой автоматически.
Список знаний без `--protocol` показывает общие карточки для редактирования.

## Создание и изменение

Группы и самостоятельные релизы имеют независимые адреса:

```bash
pnpm cli sagas create the-chaotic-throne --branch main --title "The Chaotic Throne"
pnpm cli chronicles create the-kamael --branch main --saga the-chaotic-throne --title "The Kamael"
pnpm cli releases create the-kamael --chronicle the-kamael --title "The Kamael"
pnpm cli releases update the-kamael --chronicle another-group --dry-run
```

Коды саг, хроник и релизов уникальны внутри своего вида. `chronicleKey` — изменяемая
классификация релиза, а не часть его адреса. Необязательный `sagaKey` можно очистить
через `--file` с `null`. Специального кода `base` нет.

Региональные контексты редактируются независимо от номера протокола:

```bash
pnpm cli regions list
pnpm cli contexts list --release high-five --region na
pnpm cli contexts get high-five:na --locale ru
pnpm cli protocols list --chronicle high-five --region na
pnpm cli contexts update high-five:na --file regional-patch.json --dry-run
```

В JSON контекста доступны `regionKey`, `releasedOn`, `countryKeys`, `protocolKeys`,
`order`, `status`, `translations`. Дата сохраняет точность `YYYY`, `YYYY-MM`,
`YYYY-MM-DD`; неизвестное значение — `null`. Источники в переводах необязательны,
в том числе для конкретных региональных фактов. Регион и язык `--locale` независимы.
При создании короткого `code` можно указать `--release high-five`;
`--file` и `batch` поддерживают полный контракт. Прямые `protocolKeys` выпуска —
только связи с ещё неустановленным контекстом; региональная применимость задаётся
в `contexts`, не в протоколе.

```bash
pnpm cli protocols create 152-rev-2 --title "Отдельный клиентский контекст"
pnpm cli packets create example --name ExamplePacket --server game --direction client-to-server
pnpm cli packets add-revision example --rev 1 --protocols 268,273 --title "Пример" --markdown example.md
pnpm cli packets update example --name ExampleMessage
pnpm cli packets update-revision example --rev 1 --protocols 268,273 --file technical-patch.json
```

`--file` принимает поля записи или patch в JSON. `--file -` читает stdin.
Для `create` и `add-revision` адресные поля выводятся из команды, UUID создаётся
автоматически. Несовпадение адресных полей в JSON и аргументах отклоняется.
JSON Schema описывает полный контракт базы; `generatedFields` указывает поля,
которые не нужно задавать вручную. UUID новых источников также можно опустить.

Отдельный перевод удобно изменять командой `translate`:

```bash
pnpm cli packets translate example --rev 1 --locale en --title "Example" --markdown example.en.md
pnpm cli packets translate example --rev 1 --locale ru --file translation.json
```

Она объединяет переданные поля с выбранным переводом, сохраняя остальные языки,
применимость и технические признаки. `source` — необязательный массив `{ id?, url, title, summary? }`;
пустой или отсутствующий список допустим при любом статусе записи.
Для каталоговых записей `translate` используется без `--rev`.
В обычном `update` массивы, включая `translations`, заменяются целиком.

```bash
pnpm cli packets update example --name NewName --dry-run --json
pnpm cli packets update example --name NewName --if-revision <revision>
pnpm cli packets delete example --rev 1
pnpm cli packets delete example
```

Запись выводит действие, читаемые ключи, изменяемые поля, число изменённых записей
и ревизию. `--dry-run` проверяет весь пакет без сохранения; возвращаемая `revision`
описывает рассчитанный результат, `previousRevision` — прочитанную базу.
При создании UUID рассчитанного и отдельного последующего запуска могут различаться.

`--if-revision` задаёт ожидаемый SHA-256 всей базы. Без флага CLI защищает запись
ревизией своего исходного чтения. Конфликт не перезаписывает данные.
Удаление карточки знания удаляет её редакции; остающиеся ссылки проверяются.
`delete` не читает stdin.

## Пакеты операций

```bash
pnpm cli batch --file changes.json --dry-run --json
pnpm cli batch --file changes.json
```

Формат: `{ "operations": [...], "ifRevision": "необязательный SHA-256" }`.
Операции используют контракт базы:

- `create`/`put`: `entry: { collection, key, kind, value }`;
- `update`: `target: { collection, key, kind }`, `patch`;
- `delete`: `target`.

`kind`: `entity` или `implementation`; технические коллекции называются
`packet-revisions`, `scenario-revisions`, `article-revisions`.
В `create` UUID можно опустить; `put` существующей записи сохраняет её UUID.
Связи проверяются в конечном состоянии одной транзакции, порядок создания
владельца и редакции не важен. Ошибка откатывает весь пакет.

## Жизненный цикл и вывод

`init` создаёт пустую базу с ru/en. `import --input <dir>` полностью восстанавливает
базу из снимка. `export --output <dir>` сохраняет все таблицы; по умолчанию оба
используют `packages/database/data/`. Экспорт выполняется явно после наполнения.
`validate` проверяет предметный снимок. `status` показывает состояние и общую ревизию.

С `--json` stdout содержит один `{ ok: true, data }`; ошибка направляется в stderr
как `{ ok: false, error: { code, message, details? } }`. `--pretty` добавляет отступы.
Справка и версия поддерживают тот же формат. Коды завершения: 0 — успех,
2 — неверный запрос/данные, 3 — отсутствующая база/запись, 4 — конфликт,
1 — прочие ошибки. Пробел отдельного знания при множественном чтении возвращается
в `availability`, а не превращает весь ответ в ошибку.

Проверки: `pnpm --filter @l2ce/dev-reference-cli typecheck`,
`pnpm --filter @l2ce/dev-reference-cli test`.
