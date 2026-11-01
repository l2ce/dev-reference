# Публикация сайта и npm

Сайт: <https://l2ce.github.io/dev-reference/>. npm-пакет для пользователей:
`@l2ce/dev-reference-mcp`, команда `protocols-mcp`.

## Состав релиза

Публикуется **только `@l2ce/dev-reference-mcp`**, первая версия — `0.1.0`.
`@l2ce/core` и `@l2ce/database` остаются приватными пакетами монорепозитория.
Их собранный код включается в MCP-архив как `bundledDependencies` вместе с
`schema.sql`, типами и JSON Schema базы. Отдельная публикация этих пакетов не нужна.

`pnpm release:pack` собирает MCP и локальные зависимости, подготавливает
`apps/mcp/build/package/` и выполняет `npm pack` для этого каталога. Результат —
`dist/npm/l2ce-dev-reference-mcp-0.1.0.tgz`; предыдущие архивы из `dist/npm/`
удаляются. Генерируемый манифест заменяет `workspace:*` точными версиями включённых
пакетов, а внешние зависимости переносит в зависимости MCP. В частности,
`better-sqlite3` устанавливается для платформы пользователя, его нативный бинарник
в архив не включается. Упаковка не меняет `nodeLinker` рабочего pnpm workspace.

Публиковать нужно готовый архив. Исходный `apps/mcp/package.json` описывает
workspace-зависимости и не является готовым манифестом публикации.

Снимок `data/` и рабочий SQLite не входят в npm. MCP получает знания из Git
и создаёт собственный кеш. Для запуска нужны Node.js 24 и Git.
CLI, Web и конфигурация TypeScript остаются приватными workspace-пакетами.

## Первая ручная публикация npm

Команды выполняются из корня репозитория, из сохранённого релизного коммита.
Нужны pnpm из `package.json` и npm-аккаунт с правом публикации в организации `l2ce`.

```bash
pnpm install --frozen-lockfile
pnpm data:build
pnpm typecheck
pnpm test
pnpm format:check
pnpm release:pack
pnpm release:check
```

`release:check` устанавливает единственный MCP-архив через npm во временный проект
вне workspace, проверяет наличие встроенных core/database, импортирует JSON-снимок
в отдельный SQLite-кеш и проверяет MCP stdio: версию, read-only инструменты,
состояние базы и каталог протоколов.

Проверьте состав архивов и войдите в npm:

```bash
npm publish ./dist/npm/l2ce-dev-reference-mcp-0.1.0.tgz --access public --dry-run
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

Опубликуйте MCP, завершив интерактивную проверку npm при запросе:

```bash
npm publish ./dist/npm/l2ce-dev-reference-mcp-0.1.0.tgz --access public --registry=https://registry.npmjs.org/
npm view @l2ce/dev-reference-mcp@0.1.0 version dependencies --registry=https://registry.npmjs.org/
```

npm может принять первую публикацию с HTTP 202 и сообщением, что пакет
обрабатывается. До завершения обработки `npm view` и установка могут возвращать 404. В этом случае повторяйте проверку чтения после обработки, а не `npm publish`.

Локальная первая публикация выполняется без `--provenance`; CI добавляет provenance
через OIDC. Версии в командах соответствуют первым манифестам; при изменении версии
используйте имена архивов из `dist/npm/`.

## Последующие npm-релизы через CI

После появления MCP на npm настройте **Trusted Publisher для `@l2ce/dev-reference-mcp`**:

- Provider: **GitHub Actions**.
- Organization or user: `l2ce`.
- Repository: `dev-reference`.
- Workflow filename: `publish.yml`.
- Environment name: `npm` (такое же GitHub environment создайте в репозитории).
- Allowed actions: разрешите прямую публикацию **npm publish**.

`NPM_TOKEN` не требуется. Используются GitHub-hosted runner, Node.js 24,
npm ≥11.5.1 из его поставки и `id-token: write`. По текущим правилам npm новая
настройка Trusted Publisher должна впервые успешно опубликовать пакет в течение
двух дней; создавайте её перед следующим релизом MCP.
Подробнее: [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

Порядок релиза:

1. Увеличьте `version` в `apps/mcp/package.json`. Изменения встроенных core/database
   также доставляются пользователям новой версией MCP; отдельные npm-версии этих
   пакетов не выпускаются.
2. Выполните проверки, `pnpm release:pack` и `pnpm release:check`.
3. Отправьте изменения в `main` и дождитесь успешного CI.
4. Создайте тег `mcp-v<версия MCP>` на этом коммите и опубликуйте GitHub Release
   для этого тега. Например, для MCP `0.1.1`:

   ```bash
   git tag mcp-v0.1.1
   git push origin mcp-v0.1.1
   gh release create mcp-v0.1.1 --verify-tag --title 'MCP 0.1.1' --generate-notes
   ```

Workflow `publish.yml` повторяет общие проверки из `check.yml` и публикует
**тот же MCP-архив**, который прошёл проверку установки. Тег должен совпадать с версией
MCP. Draft и prerelease не публикуются; поддерживаются стабильные версии `x.y.z`.
Уже существующая версия пропускается. Изменения опубликованного MCP или встроенных
пакетов всегда требуют новой версии MCP. При сбое проверьте npm и повторно запустите
workflow: успевшая опубликоваться версия будет пропущена. Сетевые ошибки не считаются
отсутствием версии и останавливают публикацию.

## Первый запуск GitHub Pages

1. В `l2ce/dev-reference` откройте **Settings → Pages → Build and deployment**
   и выберите **Source: GitHub Actions**.
2. Отправьте конфигурацию в `main`. Первый запуск можно выполнить вручную:

   ```bash
   gh workflow run ci.yml --ref main
   ```

3. Дождитесь задания `pages` и откройте <https://l2ce.github.io/dev-reference/>.

Последующие push в `main` автоматически проверяют и обновляют сайт. Pull request
проверяет сборку с `/dev-reference`, но не публикует Pages или npm. npm-релиз
запускается отдельно событием GitHub Release.

Сборка для локального просмотра:

```bash
pnpm data:build
# Только в новом клоне без локальных изменений базы:
pnpm run database import
NEXT_PUBLIC_BASE_PATH=/dev-reference SITE_URL=https://l2ce.github.io pnpm build
pnpm --filter @l2ce/web preview
```

Откройте `http://127.0.0.1:4173/dev-reference/`, русскую ветку `/dev-reference/ru/`
и прямой адрес `/dev-reference/ru/protocols/273/packet/protocol-version/`.
Сборка проверяет HTML, ссылки, ресурсы и RSC-данные; preview обслуживает `out/`
с реальными 404. В CI `configure-pages` передаёт фактические `basePath` и origin,
а импорт SQLite выполняется в чистом checkout перед сборкой.
