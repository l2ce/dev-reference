---
name: nextjs-reference
description: "Использовать при создании, изменении и ревью приложений Next.js с App Router на TypeScript: структура и Unit Architecture, Server и Client Components, SSR и гидратация, страницы и layout, загрузка и кеширование данных, Server Actions, Route Handlers, авторизация, формы, состояние, Mantine, PostCSS, SVG-спрайты, окружение и проверки. Не использовать для Pages Router, клиентских React SPA без Next.js и самостоятельных серверных сервисов."
---

# Next.js Reference

Этот skill определяет проектные решения для Next.js App Router с обязательной поддержкой серверного отображения.
Он сохраняет подход `react-reference` к владельцам, компонентам, предметным контрактам и инструментам, но самостоятельно
описывает процесс Next.js. Загружать `react-reference` для работы по этому skill не требуется.

## Исходные решения

- Страницы и каркасы остаются Server Components. Клиентскую границу добавляй только там, где требуется интерактивность.
- Содержимое первого открытия URL получай на сервере. Клиентские компоненты также должны корректно проходить SSR.
- `src/app` связывает файловые маршруты и публичные возможности юнитов. Предметные правила находятся в `domains`.
- Для REST используй `@gromlab/rest-api-codegen` и доменные адаптеры. SWR подключай для обновляемой клиентской проекции,
  а не как обязательный способ первоначальной загрузки каждой страницы.
- Mantine, `@mantine/form`, CSS Modules с PostCSS и генерация новых TSX остаются принятыми решениями.
- Состояние пользователя, сессия и настроенные под запрос клиенты не хранятся в общих изменяемых объектах процесса.

Базовый профиль: Next.js 16, совместимая React 19, Node.js и серверное развёртывание. Для нового приложения выбран
явный режим `cacheComponents: false`; общий кеш включается только для конкретных публичных данных. Это проектный выбор,
а не утверждение о настройках Next.js по умолчанию. Уже включённые Cache Components сохраняй и применяй отдельную ветку
[правил кеширования](reference/application/data-fetching/caching.md).

Сначала проверь установленные версии и инструкции проекта. Не обновляй фреймворк, не меняй модель кеширования и не
добавляй параллельную библиотеку в рамках локальной задачи.

## Порядок работы

1. Изучи `package.json`, lock-файл, `next.config.*`, `tsconfig.json`, маршруты и команды проверки.
2. Найди прикладную область в таблице ниже. Прочитай её основной документ до выбора библиотеки.
3. При изменении владельца, размещения или импортов прочитай [архитектурный профиль](reference/application/architecture/README.md)
   и загрузи `unit-architecture`.
4. Определи серверную и клиентскую части, первоначальные данные, политику кеша и область жизни состояния.
5. Перед созданием нового `.tsx` выполни [инструкцию генерации](reference/application/components/tsx-generation.md).
6. Загрузи профильные skills по области изменения. Реализуй связный сценарий и выполни [проверки](reference/application/quality/README.md).

Следуй решениям существующего приложения, если оно использует другие соглашения. Новую границу сервера и клиента
проверяй по фактическому графу импортов, а не только по имени файла. Существующий браузерный код не считается
SSR-совместимым без проверки.

## Прикладные области

| Задача | Основной документ |
| --- | --- |
| Собрать приложение, провайдеры и корневой каркас | [Структура](reference/application/structure/README.md) |
| Определить владельцев, фасеты и зависимости | [Архитектура](reference/application/architecture/README.md) |
| Разделить серверный и клиентский код, устранить ошибку гидратации | [SSR и компоненты](reference/application/rendering/README.md) |
| Создать страницу, метаданные и состояния маршрута | [Страницы](reference/application/pages/README.md) |
| Создать компонент, провайдер или экран | [Компоненты](reference/application/components/README.md) |
| Выполнить вёрстку по макету | [Вёрстка](reference/application/markup/README.md) |
| Настроить URL, переходы и файловые границы | [Маршрутизация](reference/application/routing/README.md) |
| Получить первоначальные и обновляемые данные | [Получение данных](reference/application/data-fetching/README.md) |
| Выбрать кеш и обновить его после записи | [Кеширование](reference/application/data-fetching/caching.md) |
| Выполнить запись, создать Server Action или HTTP-обработчик | [Изменение данных](reference/application/data-fetching/mutations.md) |
| Подключить подписку или имитацию API | [Подписки и имитация API](reference/application/data-fetching/realtime-and-mocking.md) |
| Проверить сессию, вход, выход и доступ | [Авторизация](reference/application/authentication/README.md) |
| Выбрать React state, Zustand или клиентский кеш | [Состояние](reference/application/state-management/README.md) |
| Создать форму и обработать её результат | [Формы](reference/application/forms/README.md) |
| Выбрать компонент и подключить тему Mantine | [Интерфейс](reference/application/ui/README.md) |
| Настроить CSS Modules, общие стили и PostCSS | [Стили](reference/application/styling/README.md) |
| Подключить собственные SVG-иконки | [Иконки](reference/application/icons/README.md) |
| Настроить окружение, сборку, изображения и развёртывание | [Платформа](reference/application/platform/README.md) |
| Обработать ошибки и проверить SSR | [Качество](reference/application/quality/README.md) |

## Профильные skills

Загружай skill по имени для соответствующей задачи. Если механизм загрузки недоступен, найди skill в указанном
публичном репозитории и начни с его точки входа. Внутренние документы выбирает сам профильный skill.

| Skill | Задача | Запасной источник |
| --- | --- | --- |
| `unit-architecture` | Владельцы, фасеты, зависимости и вложенность | [unit-architecture](https://github.com/gromlab-ru/unit-architecture) |
| `template-generation-ru` | Локальные шаблоны и запуск генератора | [template-file-generator](https://github.com/gromlab-ru/template-file-generator) |
| `rest-api-codegen-ru` | REST-клиенты, операции, транспорт и SSR | [rest-api-codegen](https://github.com/gromlab-ru/rest-api-codegen) |
| `svg-sprites-ru` | Генерация спрайта в точном режиме Next.js | [svg-sprites](https://github.com/gromlab-ru/svg-sprites) |

### Правила кода

Загрузи `ts-styleguide` для TypeScript, `tsx-styleguide` вместе с ним для компонентов, `postcss-styleguide` для CSS
и `html-styleguide` для самостоятельных HTML-файлов. Они доступны по имени в
[js-reference](https://github.com/gromlab-ru/js-reference). `value-predicates` подключай по инструкции `ts-styleguide`.

Каноны кода применяются и к серверной реализации. Доступность React API определяет среда: правило о хуках не требует
добавлять хук в Server Component. Имена специальных файлов и обязательные экспорты Next.js сохраняются.

## Настройка библиотек

| Библиотека | Проектная инструкция |
| --- | --- |
| `@gromlab/template-file-generator` | [Генератор](reference/libraries/template-generation.md) |
| Mantine | [Тема и SSR](reference/libraries/mantine.md) |
| PostCSS | [Обработка CSS](reference/libraries/postcss.md) |
| `@gromlab/rest-api-codegen` | [Серверный и браузерный транспорт](reference/libraries/rest-api-codegen.md) |
| SWR | [Начальные данные и клиентский кеш](reference/libraries/swr.md) |
| `@gromlab/svg-sprites` | [Режим App Router](reference/libraries/svg-sprites.md) |

Точные сигнатуры Next.js сверяй с документацией установленной версии; основные официальные источники собраны в
[разделе платформы](reference/application/platform/README.md#источники). Примеры в документах показывают границы интеграции;
имена предметных операций адаптируй к реальному контракту приложения.
