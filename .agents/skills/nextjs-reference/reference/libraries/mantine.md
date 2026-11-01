# Mantine с App Router

Используй совместимые версии `@mantine/core` и `@mantine/hooks`; `@mantine/form` и расширения устанавливай по задаче.
Сохраняй одну согласованную версию пакетов Mantine и проверь её совместимость с React проекта.

## Тема и Provider

Тема принадлежит `ui/themes`, а не `app`. Создай внутренний ThemeProvider через генератор, добавь `'use client'`
и опубликуй его через `ui/themes/client`. `createTheme`, переопределения компонентов и функции настройки остаются
в клиентском графе этого юнита. Внешний контракт Provider принимает `children`, а не сервером созданный объект
темы с функциями.

Корневой layout остаётся Server Component. Пример связующего файла для начальной светлой темы:

```tsx
import '@mantine/core/styles.css'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import type { ReactNode } from 'react'
import 'ui/themes/styles.css'
import { ThemeProvider } from 'ui/themes/client'

/**
 * Подключает документ и общую тему приложения.
 *
 * Используется для:
 *  - серверного отображения всех маршрутов
 */
export default function RootLayout(props: LayoutProps<'/'>): ReactNode {
  return (
    <html lang="ru" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <ThemeProvider>{props.children}</ThemeProvider>
      </body>
    </html>
  )
}
```

Внутри ThemeProvider подключи `MantineProvider` с тем же `defaultColorScheme="light"` и настройкой темы.
Если продукт поддерживает `auto` или принудительную схему, согласуй скрипт, Provider и правила первого отображения.
`mantineHtmlProps` покрывает предусмотренное библиотекой изменение атрибута темы, а не произвольные ошибки гидратации.

Для CSP передай nonce скрипту и согласуй его с политикой проекта. Не вводи CSP и дополнительные клиентские
провайдеры только ради подключения библиотеки.

## Использование из Server Components

Mantine уже отмечает свои клиентские точки входа. Серверная страница может выводить `<Button>` или `<TextInput>`
с подходящими сериализуемыми свойствами, сохраняя собственное серверное выполнение.

Используй именованные `AppShellMain`, `PopoverTarget` и другие экспорты установленной версии вместо доступа
`Component.Part` в RSC. События, функции рендера и полиморфные свойства вроде `component={Link}` оформляй внутри
узкой клиентской обёртки: функция-компонент не является обычным сериализуемым свойством.

Не добавляй `'use client'` всему `layout.tsx`, не вызывай `createTheme` как клиентскую функцию из RSC и не отключай SSR
библиотеки через `dynamic`. Статическую разметку без потребности в Mantine можно оставить нативными элементами.

## Стили и проверка

CSS расширений подключается после `@mantine/core/styles.css`, проектные общие стили — после библиотечных.
Собственная обработка PostCSS задаётся [профилем](postcss.md); готовый CSS Mantine не требует дублирующего preset.
Оптимизацию импортов подключай по реальному измерению и поддержке установленной версии Next.js.

Проверь тему до гидратации, восстановление сохранённой схемы, формы, порталы, фокус и переход между страницами.
Официальный контракт: [Mantine с Next.js](https://mantine.dev/guides/next/).
