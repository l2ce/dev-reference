# Программный API

Пакет экспортирует CommonJS-модуль и TypeScript-декларации. Его можно подключить через `require` в Node.js или через `import` в TypeScript с подходящей конфигурацией модулей.

```bash
npm install --save-dev @gromlab/template-file-generator
```

Для использования генератора во время работы приложения, а не только разработки, установи его как обычную зависимость.

## Законченный пример генерации

Сохрани скрипт, например, как `generate.cjs`. Предполагается, что шаблон `module` уже находится в `.templates/` рабочего каталога и использует переменные `name` и `author`.

```javascript
const path = require('node:path');
const {
  resolveTemplateContext,
  buildPlan,
  getCollisions,
  getTopLevelDirs,
  getExistingDirs,
  writePlan,
} = require('@gromlab/template-file-generator');

const templatesDir = path.resolve('.templates');
const outDir = path.resolve('src/modules');
const vars = { name: 'user-profile', author: 'Platform' };

const result = resolveTemplateContext(templatesDir, 'module', vars);
if (result.error) {
  throw new Error([result.error.title, ...(result.error.details ?? [])].join('\n'));
}

const { templateDir, files } = result.context;
const plan = buildPlan(templateDir, outDir, vars, files);
const collisions = getCollisions(plan);
const existingDirs = getExistingDirs(outDir, getTopLevelDirs(outDir, plan));

if (collisions.length || existingDirs.length) {
  throw new Error(`Назначение уже существует: ${[...collisions, ...existingDirs].join(', ')}`);
}

console.table(plan);
writePlan(plan, vars, false);
```

Для предварительного просмотра остановись перед `writePlan`: разрешение контекста и построение плана не создают выходные файлы.

Этот пример повторяет консервативное поведение CLI при существующих верхних папках. Если интеграция должна добавлять новые файлы в существующую папку, можно проверять только `getCollisions`, сохранив `overwrite=false`. Это решение принимается на уровне вызывающего кода.

## Функции

| Экспорт | Назначение |
| --- | --- |
| `renderTemplate(input, vars)` | Подставить переменные и модификаторы в строку |
| `collectTemplateVariables(templateDir)` | Получить `Set<string>` переменных из путей и содержимого файлов |
| `listTemplateNames(templatesDir)` | Получить отсортированные имена непосредственных подпапок |
| `findNearestTemplatesDir(startDir)` | Найти ближайшую `.templates/`, поднимаясь от `startDir` до корня файловой системы |
| `readDirRecursive(dir)` | Получить пути обычных файлов рекурсивно |
| `resolveTemplateContext(templatesDir, templateName, vars)` | Проверить каталог, имя шаблона, переменные и наличие файлов |
| `buildPlan(templateDir, outDir, vars, files)` | Получить массив `{ source, target }` без записи |
| `getCollisions(plan)` | Получить уже существующие целевые пути |
| `getTopLevelDirs(outDir, plan)` | Получить относительные имена верхних папок из плана |
| `getExistingDirs(outDir, dirs)` | Отфильтровать существующие папки из этого списка |
| `getRoots(outDir, plan)` | Получить корневые пути результата для отображения |
| `writePlan(plan, vars, overwrite)` | Прочитать исходные файлы, подставить переменные и записать результат |
| `CASE_MODIFIERS` | Словарь функций преобразования регистра |
| `normalizeArgs(parsed)` | Проверить разобранные аргументы CLI и преобразовать позиционное имя в `vars.name` |

Экспортируемые типы: `PlanItem`, `TemplateContext`, `ValidationError`, `ParsedArgs`.

## Важные особенности

- В API `name` передаётся обычным свойством объекта `vars`; обязательность позиционного аргумента относится к CLI.
- `resolveTemplateContext` возвращает `{ context }` или `{ error }`. При ошибке проверяй `title`, `details`, `hint`. Системные ошибки чтения могут выбрасываться как исключения.
- Сам `renderTemplate` не валидирует полноту значений: пропущенную переменную он заменяет пустой строкой. Для генерации файлов сначала вызывай `resolveTemplateContext`.
- `buildPlan` преобразует пути. Содержимое читается и преобразуется во время `writePlan`.
- `writePlan(..., false)` открывает файлы с флагом `wx`, поэтому существующий файл не перезаписывается. Проверка перед записью всё равно полезна для понятной диагностики.
- `writePlan(..., true)` заменяет целевые файлы без объединения содержимого. Посторонние файлы не удаляются.
- Файлы записываются последовательно, без транзакции и автоматического отката при ошибке.
- Для однозначного поведения передавай в API абсолютные пути и явно выбирай область шаблонов. `findNearestTemplatesDir` — вспомогательная функция; CLI не вызывает её для генерации.
