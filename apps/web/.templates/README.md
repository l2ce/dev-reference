# Генерация компонентов Web

Шаблоны основаны на [Next.js Reference](../../../.agents/skills/nextjs-reference/SKILL.md)
и [локальном профиле](../ARCHITECTURE.md). Перед генерацией определите
владельца и необходимость отдельного публичного контракта.

| Шаблон         | Результат                                                                  |
| -------------- | -------------------------------------------------------------------------- |
| `ui-component` | Внутренний компонент со своей папкой, типом props и CSS Module, без фасета |
| `ui-unit`      | Компонент-юнит с той же структурой и публичным `index.ts`                  |

Запускайте из `apps/web` только для нового имени и отсутствующей целевой папки:

```bash
pnpm run create ui-unit welcome src/compositions/screens
pnpm run create ui-component welcome-note src/compositions/screens/welcome/ui
```

Примеры предназначены для ещё не существующих компонентов. Позиционный путь задаёт
родительскую папку вывода; папку компонента создаёт CLI. Генератор читает `.templates/`
из рабочего каталога команды. Команда `create` закрепляет версию `0.3.1`
и отключает проверку обновления через `--skip-update`.

Перед генерацией загрузите [template-generation-ru](../../../.agents/skills/template-generation-ru/SKILL.md),
загрузите [nextjs-reference](../../../.agents/skills/nextjs-reference/SKILL.md)
и выполните его инструкцию создания TSX. Прочитайте все файлы выбранного шаблона,
проверьте их соответствие зависимостям,
[ts-styleguide](../../../.agents/skills/ts-styleguide/SKILL.md) и
[tsx-styleguide](../../../.agents/skills/tsx-styleguide/SKILL.md).
Повторная генерация поверх существующего результата запрещена;
редактируйте созданный код обычным способом.

После генерации:

1. Для экрана используйте `<name>.screen.tsx`, для каркаса — `<name>.layout.tsx`; согласуйте имена компонента и props.
2. Замените JSDoc назначением и реальными сценариями применения.
3. Экраны всегда сохраняют полный каркас: параметр `props`, отдельный файл типов, CSS Module и фасет с типом props.
   Если собственных параметров нет, используйте `ScreenParams = object`, `RootAttrs` и `ScreenProps`.
   Разрешённые атрибуты и `className` передаются корневому элементу экрана.
4. У остальных компонентов адаптируйте типы и стили по реальному контракту; у компонента без DOM удалите `RootAttrs` и обёртку.
5. Оставьте в фасете только API для фактических потребителей. Средовые фасеты
   применяйте только по согласованным соглашениям Next.js.
6. Проверьте результат командами из [AGENTS.md](../AGENTS.md#команды-проверок).

Шаблоны создают каркас без автоматической клиентской директивы. Выбирайте
клиентскую границу по реальной интерактивности, учитывая предварительный рендер.
Framework-файл `page.tsx` подключает экран с явно выбранными props,
чтобы служебные параметры Next.js не попадали в DOM.
Зависимости: React, `clsx`, CSS Modules. `index.ts` объявляет юнит, а не локальный barrel.

Средовые фасеты определены в [локальном профиле](../ARCHITECTURE.md).
У экранов с чтением базы начальный `index.ts` заменяется на `server.ts`.
Реализация `ThemeProvider` публикуется через `ui/themes/client.ts`.

## Генерация начального каркаса

При подготовке приложения фактически выполнены следующие команды из `apps/web`:

```bash
pnpm run create ui-unit main src/compositions/layouts
pnpm run create ui-unit home src/compositions/screens
pnpm run create ui-unit not-found src/compositions/screens
pnpm run create ui-unit catalog src/compositions/screens
pnpm run create ui-unit protocol src/compositions/screens
pnpm run create ui-unit document src/compositions/screens
pnpm run create ui-component theme-provider src/ui/themes/providers
pnpm run create ui-unit markdown src/ui
pnpm run create ui-component protocol-filter src/compositions/screens/catalog/ui
pnpm run create ui-component document-details src/compositions/screens/document/ui
pnpm run create ui-component markdown-table src/ui/markdown/ui
```

Основные файлы композиций адаптированы к `main.layout.tsx`, `home.screen.tsx`,
`not-found.screen.tsx`, `catalog.screen.tsx`, `protocol.screen.tsx` и
`document.screen.tsx` внутри созданных каталогов. Остальные TSX сохраняют имя
компонента в собственной папке. Команды не предназначены для повторного запуска.

`src/app/document.tsx`, layouts, pages и `global-not-found.tsx` — связующие
framework-файлы: они подпадают под системное исключение генерации.

Исходники `.templates` исключены из TypeScript и форматирования кода.
При изменении шаблонов выполняйте пробную генерацию во временный каталог,
проверяйте подстановки и типы результата в окружении приложения. Текст заготовки
с `{{name...}}` сам по себе не является готовым TypeScript-кодом.
