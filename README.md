# L2CE Dev Reference

Справочник обмена между клиентом Lineage II и login/game-серверами.
Выберите протокол, затем сервер и нужную информацию: пакеты, сценарии или статьи.

## Состав проекта

- [База данных](packages/database/README.md) — SQLite, общие предметные записи,
  отдельные переводы, программный API и мини-CLI записи и обмена JSON.
- [Предметное ядро](packages/core/README.md) — выбор документов и сборка Markdown.
- [CLI](apps/cli/README.md) — предметные команды чтения и наполнения справочника.
  По умолчанию выводится текст; `--json` включает машинный формат.
- [Web](apps/web/README.md) — приложение на Next.js с App Router.
- [MCP](apps/mcp/README.md) — поиск и чтение с автоматическим обновлением из Git.

Источник истины — `packages/database/.local/database.sqlite`, исключённая из Git.
`packages/database/data/` — генерируемый снимок всех таблиц. Обмен с JSON
выполняется через `pnpm run database`; импорт сам создаёт актуальную структуру,
сборка компилирует библиотеку.
Веб-приложение генерирует русские и английские страницы каталога, протоколов
и документов из SQLite. Статический экспорт публикуется на GitHub Pages.

## Запуск

Нужны Node.js 24 и pnpm, указанный в `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm data:build
pnpm run database import
pnpm run database status
```

Для запуска веб-приложения: `pnpm dev:web` (или `pnpm dev`), адрес —
`http://localhost:3000/`.

Проверки: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`.
Разработка TypeScript подчиняется [ts-styleguide](.agents/skills/ts-styleguide/SKILL.md).
Выбранные skills и их область действия описаны в [профиле знаний проекта](docs/development/skills.md).
Порядок браузерной проверки описан в [apps/web/AGENTS.md](apps/web/AGENTS.md).

## Публикация

Порядок первого ручного релиза, настройка npm Trusted Publishing и GitHub Pages:
[публикация сайта и npm](docs/development/releases.md).

## Наполнение

Рабочая база создаётся из JSON текущего Git worktree:

```bash
pnpm run database import
pnpm run database status

# Предметное чтение и запись:
pnpm cli:build
pnpm cli protocols list
pnpm cli batch --file changes.json
pnpm cli export
git diff -- packages/database/data
```

Импорт полностью заменяет содержимое рабочей базы JSON-снимком, экспорт сохраняет
полный снимок в `data/`. При изменении SQL-структуры импорт пересоздаёт таблицы
из текущей схемы пакета. В PR отправляются изменения JSON, схем и кода.

Сведения добавляются для конкретного профиля с источниками. Game revision,
login revision, ветка, регион и сборка — отдельные признаки. Неизвестные значения
и неполные описания сохраняются явно. Подробности и пример документа —
в [руководстве базы](packages/database/README.md).

Источник имеет единый контракт `{ id, url, title, summary? }` из
`@l2ce/database/source`. Для кода используется ссылка на конкретный коммит;
метаданные репозитория и файла извлекаются из URL без сетевых запросов.
