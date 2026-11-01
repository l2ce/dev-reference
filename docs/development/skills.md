# Знания проекта

L2CE Dev Reference выбирает и устанавливает skills локально в `.agents/skills/`.
Их источники и контрольные суммы находятся в `skills-lock.json`, ссылки для Claude Code —
в `.claude/skills/`. Выбор знаний и требования к их применению принадлежат этому
репозиторию и его приложениям; глобальные инструкции агента их не закрепляют.

## Выбранные skills

| Skill                                                                          | Область применения                                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [ts-styleguide](../../.agents/skills/ts-styleguide/SKILL.md)                   | TypeScript во всех приложениях и пакетах, включая CLI, MCP, базу и Core                            |
| [tsx-styleguide](../../.agents/skills/tsx-styleguide/SKILL.md)                 | React-компоненты `apps/web`, вместе с `ts-styleguide`                                              |
| [postcss-styleguide](../../.agents/skills/postcss-styleguide/SKILL.md)         | CSS и CSS Modules веб-приложения                                                                   |
| [html-styleguide](../../.agents/skills/html-styleguide/SKILL.md)               | Самостоятельная HTML-разметка и HTML-части шаблонов                                                |
| [nextjs-reference](../../.agents/skills/nextjs-reference/SKILL.md)             | Next.js App Router, серверные и клиентские компоненты, данные, генерация и проверки веб-приложения |
| [unit-architecture](../../.agents/skills/unit-architecture/SKILL.md)           | Владельцы, слои, фасеты и зависимости в `apps/web/src`                                             |
| [template-generation-ru](../../.agents/skills/template-generation-ru/SKILL.md) | Локальные шаблоны и закреплённый генератор `apps/web`                                              |
| [rest-api-codegen-ru](../../.agents/skills/rest-api-codegen-ru/SKILL.md)       | Создание и сопровождение типизированных REST-клиентов                                              |
| [svg-sprites-ru](../../.agents/skills/svg-sprites-ru/SKILL.md)                 | Настройка и сопровождение `@gromlab/svg-sprites`                                                   |

Первые пять skills поставляются из [gromlab-ru/js-reference](https://github.com/gromlab-ru/js-reference).
`nextjs-reference` заменяет прежний SPA-ориентированный `react-reference`.
Его серверный профиль адаптирован к статическому экспорту в
[инструкциях Web](../../apps/web/AGENTS.md) и [локальном архитектурном профиле](../../apps/web/ARCHITECTURE.md).
Установлен полный набор зависимостей `nextjs-reference`: четыре стайлгайда,
`unit-architecture`, `template-generation-ru`, `rest-api-codegen-ru` и `svg-sprites-ru`.
Загрузка каждого skill определяется задачей; установка знаний сама по себе не меняет
состав npm-зависимостей приложения. Текущий сайт читает SQLite при сборке и использует
иконки `@tabler/icons-react`.

## Применение

Перед работой загружайте skill по соответствующей области, начиная с его `SKILL.md`.
Каноны обязательны для нового и содержательно изменяемого кода. Размещение ответственности,
контрактов и словарей определяется архитектурой приложения или пакета.
Обновление форматирования само по себе не требует переименования сущностей и переработки
остального кода. Смысловые требования проверяются при содержательном изменении и ревью.

Собственный стайлгайд TypeScript заменён установленным `ts-styleguide`; отдельная копия
его правил в документации проекта не поддерживается. Форматирование закреплено в
`.prettierrc.json`: два пробела, ширина 120, одинарные кавычки, без точек с запятой
и завершающих запятых. Установленные skills сохраняют исходное оформление поставщика.

## Установка и обновление

Из корня репозитория, в проектной области:

```bash
npx skills add gromlab-ru/js-reference --skill ts-styleguide tsx-styleguide postcss-styleguide html-styleguide nextjs-reference --agent opencode claude-code --yes
npx skills add gromlab-ru/unit-architecture --skill unit-architecture --agent opencode claude-code --yes
npx skills add gromlab-ru/template-file-generator --skill template-generation-ru --agent opencode claude-code --yes
npx skills add gromlab-ru/rest-api-codegen --skill rest-api-codegen-ru --agent opencode claude-code --yes
npx skills add gromlab-ru/svg-sprites --skill svg-sprites-ru --agent opencode claude-code --yes
```

При обновлении проверьте изменения `skills-lock.json`, ссылок и применимых инструкций
приложения. Локальные шаблоны должны соответствовать установленным стайлгайдам.
Проверки проекта перечислены в [AGENTS.md](../../AGENTS.md).
