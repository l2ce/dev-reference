# Web

`@l2ce/web` — статический справочник **L2ce/dev-reference** на Next.js 16, React 19, Mantine 9 и TypeScript.
Архитектура: [локальный профиль](ARCHITECTURE.md), Unit Architecture и Next.js Reference.
Исходники разделены по владельцам в `src/`; словари находятся в `config/` своих юнитов.
Общие настройки TypeScript наследуются из `@l2ce/typescript-config`.

## Запуск

Из корня репозитория:

```bash
pnpm install --frozen-lockfile
pnpm dev:web
```

Главная страница доступна по адресу `http://localhost:3000/`. Нужен Node.js 24.
При первом клонировании подготовьте базу командами `pnpm data:build` и
`pnpm run database import`. Импорт **заменяет** рабочий SQLite: при наличии
локальных изменений используйте существующую базу. Dev и build автоматически
собирают workspace-зависимости через Turborepo.

```bash
pnpm build --filter=@l2ce/web
pnpm --filter @l2ce/web preview
pnpm --filter @l2ce/web typecheck
```

## Публикация и данные

Режим — статический экспорт Next.js (`output: 'export'`): CI импортирует
`packages/database/data/` в SQLite, приложение читает данные через
`@l2ce/database` и `@l2ce/core/reference`, генерирует страницы и публикует
`apps/web/out/` на GitHub Pages. REST API для чтения документации не требуется.

`preview` обслуживает только файлы `out/`, возвращает HTTP 404 для неизвестных
адресов и автоматически использует префикс из `out/_site.json`. Адрес по умолчанию —
`http://127.0.0.1:4173/`; параметры: `pnpm --filter @l2ce/web preview --port 4180`.
Команда `start` является алиасом preview. Рабочий Node.js-сервер сайту не требуется.

Настройки описаны в [.env.example](.env.example):

- `NEXT_PUBLIC_BASE_PATH`: пусто для корня домена, `/dev-reference` для сайта репозитория;
- `SITE_URL`: HTTP(S) origin публикации без пути.

Проверка варианта GitHub Pages из корня:

```bash
NEXT_PUBLIC_BASE_PATH=/dev-reference SITE_URL=https://l2ce.github.io pnpm build --filter=@l2ce/web
pnpm --filter @l2ce/web preview
```

Откройте `http://127.0.0.1:4173/dev-reference/`. Префикс встраивается при сборке.
`next/link` добавляет его сам; обычные ссылки подготовленного Markdown получают
его в серверном адаптере. Каждая сборка проверяет HTML, внутренние ссылки,
ресурсы, `html[lang]`, 404 и наличие статических RSC payload.

Workflow [.github/workflows/ci.yml](../../.github/workflows/ci.yml) после успешных
проверок публикует `main` через GitHub Actions. В настройках репозитория Pages
должен быть выбран источник **GitHub Actions**. `configure-pages` передаёт
реальные origin и basePath; pull requests выполняют проверки без публикации.
Первое включение Pages и ручной запуск workflow описаны в
[руководстве релизов](../../docs/development/releases.md#первый-запуск-github-pages).

Кеш web build отключён, чтобы изменения рабочего SQLite всегда попадали в HTML.
Dev и build используют Webpack с явными server externals для pnpm workspace
пакетов; причина описана в [профиле](ARCHITECTURE.md#интеграция-nextjs-и-статический-экспорт).

## Маршруты и данные

- `/` — знакомство со справочником, вход в каталог, подключение MCP и благодарность участникам GitHub;
- `/protocols/` — полный каталог;
- `/protocols/{protocol}/` — обзор точного профиля;
- `/protocols/{protocol}/articles/`, `scenarios/`, `packets/` — самостоятельные разделы;
- `/protocols/{protocol}/{kind}/{code}/` — документ (`article`, `scenario`, `packet`);
- `/ru/…` — те же страницы на русском; английский используется без префикса;
- `404.html`, `sitemap.xml`, `robots.txt` — статические служебные файлы.

На главной доступен блок подключения MCP: описание, готовый JSON для клиентов
с форматом `mcpServers`, копирование конфигурации и ссылка на руководство MCP.
Код и описание присутствуют в статическом HTML; только копирование использует клиентский lifecycle.

Пример: `/ru/protocols/273/packet/protocol-version/`.
`domains/reference` читает read-only snapshot, закрывает соединение и использует
`ReferenceReader`. Все страницы перечисляются с обходом пагинации. Директивы
`link`, `include`, `value` разрешаются в том же профиле и языке; циклы и
неразрешённые ссылки показываются явно. HTML из Markdown не исполняется.
Пробелы знания и отсутствие перевода сохраняются без fallback на соседний контекст.

Первый рендер документа уже находится в HTML. Поиск, пагинация, меню и тема
используют клиентский lifecycle. Каждый раздел имеет собственный поиск по полному
индексу и страницы по 20 материалов. Фильтры и номер страницы сохраняются в query;
возврат из документа восстанавливает список. Навигация по трём разделам доступна
на desktop и mobile; боковой индекс документа ограничен 12 строками на страницу.

Главная получает участников `l2ce/dev-reference` из публичного GitHub API при сборке.
Список включает профили людей, обходится полностью и кешируется на час; опубликованный
сайт обновляет его при следующей сборке после истечения кеша. При недоступности API
остаётся сообщение со ссылкой на GitHub. Токен и браузерный API-запрос не требуются.
REST-клиент самодостаточен и генерируется командой `pnpm --filter @l2ce/web generate:github`
из локальной выдержки официальной OpenAPI в `src/infra/github-api/schema/`.

Две темы — белая и графитовая; скругления 2–3 px. Первый визит следует системе,
явный выбор сохраняется в `localStorage`. Синхронный `ThemeBootstrap` в `head`
применяет выбранный `color-scheme` через CSSOM до первого кадра, не меняя DOM.
Mantine синхронизируется после гидратации. Ошибки гидратации не подавляются.

## Проверки

```bash
pnpm --filter @l2ce/web lint
pnpm --filter @l2ce/web typecheck
pnpm test --filter=@l2ce/web
pnpm build --filter=@l2ce/web
pnpm format:check
```

Тесты используют существующий в монорепозитории `node:test` через `tsx`.
Покрываются пагинация, контекстные ссылки, пропуски перевода, вставки, циклы,
конфигурация Pages и негативные примеры архитектурного графа.
`lint` также запускает `architecture:check`; смысл ответственности проверяется на ревью.

## Добавление кода

Сначала выберите владельца и фасет по `ARCHITECTURE.md`. Компоненты создаются
через `pnpm run create` из `apps/web`; шаблоны содержат props, CSS Module и
при необходимости фасет. Системные Next.js-файлы только подключают готовые API.
Тема находится в `ui/themes`, общие predicates — в `shared/lib/value-predicates`.
Медиавыражения задаются в `ui/themes/styles/media.css`, локальные стили — у DOM-владельца.

Правила разработки и браузерные проверки описаны в [AGENTS.md](AGENTS.md),
генерация компонентов — в [.templates/README.md](.templates/README.md).
