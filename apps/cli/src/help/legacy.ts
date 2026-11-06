import { Command } from 'commander'
import * as z from 'zod'
import { entitySchemas, revisionSchemas, sourceSchema, translationSchema } from '@l2ce/database'
import { groupSchema } from '../input/schema.js'
import { groupCollections } from '../commands/addresses.js'
import { FIELD_NAMES, IMMUTABLE_FIELDS, OBJECT_SCHEMA } from '../commands/model.js'
import { fieldDescription } from '../commands/definition.js'
import { createExampleStep, exampleKey, exampleSetup, revisionType } from './examples.js'
import { GLOBAL_OPTION_IDS, helpOption } from './options.js'
import type { CommandSpec, HelpExample, HelpOption } from './help.types.js'
import type { HelpField } from './schema.js'

/** Имена совместимых корневых входов; они отделены от рекомендуемого интерфейса. */
export const LEGACY_ROOTS = [...groupSchema.options, 'search']

/**
 * Предметный ввод совместимого --file с реальными прежними именами полей.
 */
type LegacyInputDocument = {
  /** Поля value/patch/перевода. */
  fields: HelpField[]
  /** Машинная схема старого структурированного ввода. */
  schema?: Record<string, unknown>
}

/** Описание параметров старого контракта; пустое описание не заменяется эвристикой. */
const LEGACY_OPTIONS: Readonly<Record<string, HelpOption>> = {
  file: {
    flags: '--file <path|->',
    description: 'Прежний JSON value/patch или перевод; - читает stdin.',
    valueType: 'json-path',
    defaultDescription: 'Дополнительный ввод отсутствует.',
    rules: [
      'Совместимый update заменяет переданные массивы, включая translations, целиком. translate отдельно сливает выбранный перевод.',
      'Это не публичные values нового batch --input; UUID новых записей/источников можно опустить.'
    ],
    legacy: true
  },
  markdown: {
    flags: '--markdown <path|->',
    description: 'Путь файла полного Markdown; это не буквальный аргумент текста.',
    valueType: 'text-path',
    defaultDescription: 'Документ сохраняется.',
    rules: [
      'UTF-8, до 16 МиБ; - означает stdin. Для буквального аргумента нового интерфейса используйте update --description.'
    ],
    legacy: true
  },
  ifRevision: {
    flags: '--if-revision <sha256>',
    description: 'Ожидаемый SHA-256 полного снимка прежнего API.',
    valueType: 'sha256',
    defaultDescription: 'SHA-256 исходного чтения команды.',
    rules: [
      'Получить SHA-256: <группа> inspect <ключ> --format json, поле data.revision; либо скопировать «Ревизия» из текстового inspect. meta.version нового интерфейса не подходит.',
      '64 строчные hex-цифры. Не смешивайте с новым v1:… version. Dry-run revision описывает расчётный результат, previousRevision — исходный.'
    ],
    legacy: true
  },
  protocols: {
    flags: '--protocols <keys>',
    description: 'Полный новый список применимости редакции или релиза через запятую.',
    valueType: 'protocol-key-list',
    defaultDescription: 'Непереданный список сохраняется.',
    rules: ['Заменяет список целиком; для адресного изменения используйте новый link/unlink.'],
    legacy: true
  },
  query: {
    flags: '--query <text>',
    description: 'Поисковая строка совместимого списка.',
    valueType: 'text',
    defaultDescription: 'Без текстового ограничения.',
    rules: ['Новый find ищет по всему каталогу без обязательного протокола.'],
    legacy: true
  },
  number: {
    flags: '--number <n>',
    description: 'Точный реальный номер протокола, независимо от variant.',
    valueType: 'nonnegative-integer',
    defaultDescription: 'Номер не ограничен.',
    rules: ['152 и 152-rev-1 имеют один number и разные адреса.'],
    legacy: true
  },
  kind: {
    flags: '--kind <kind>',
    description: 'Вид технического знания совместимого поиска.',
    valueType: 'enum',
    choices: ['packet', 'scenario', 'article'],
    defaultDescription: 'Все виды знаний.',
    rules: ['Поиск search требует --protocol; новый find его не требует.'],
    legacy: true
  }
}

/**
 * Возвращает путь зарегистрированного Commander-узла без имени executable.
 */
export function commandPath(command: Command): string[] {
  const path: string[] = []
  let current: Command | null = command
  while (current.parent) {
    path.unshift(current.name())
    current = current.parent
  }
  return path
}

/**
 * Описывает каждый фактически зарегистрированный параметр совместимого действия.
 */
export function legacyOptions(command: Command): HelpOption[] {
  return command.options.map((option) => {
    const name = option.attributeName()
    const own = LEGACY_OPTIONS[name]
    if (own) return { ...own, flags: option.flags }
    if (name === 'limit')
      return {
        flags: option.flags,
        description: 'Размер совместимой страницы, 1–100 записей.',
        valueType: 'integer',
        defaultDescription: '20',
        rules: ['Для полного результата используйте новый list --all; старый список возвращает nextOffset.'],
        legacy: true
      }
    if (name === 'rev')
      return {
        flags: option.flags,
        description: 'Явный положительный номер технической редакции.',
        valueType: 'positive-integer',
        defaultDescription: option.mandatory ? 'Обязателен.' : 'Общая карточка, не редакция.',
        required: option.mandatory,
        rules: ['Прежний синтаксис <card> --rev N соответствует новому полному адресу <card>:rev-N.'],
        legacy: true
      }
    if (name === 'title')
      return {
        ...helpOption('title'),
        flags: option.flags,
        defaultDescription:
          'Существующий заголовок сохраняется; отсутствующий перевод прежнего интерфейса начинает с адреса владельца, не текста другого языка.',
        legacy: true
      }
    const candidates = [
      ...GLOBAL_OPTION_IDS,
      'title',
      'summary',
      'name',
      'server',
      'direction',
      'status',
      'branch',
      'saga',
      'chronicle',
      'release',
      'region',
      'protocol',
      'offset',
      'dryRun'
    ]
    const id = candidates.find((id) =>
      new RegExp(`(?:^|[ ,])--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}(?:[ =]|$)`).test(
        helpOption(id).flags
      )
    )
    if (!id)
      throw new Error(`Совместимый параметр ${option.flags} команды ${commandPath(command).join(' ')} не описан.`)
    return { ...helpOption(id), flags: option.flags, required: option.mandatory, legacy: true }
  })
}

/**
 * Публикует собственную семантику совместимой команды, не выдавая её за новый update.
 */
export function legacySpec(command: Command): CommandSpec {
  const path = commandPath(command)
  const group = path[0]
  const action = path[1]
  const parsed = groupSchema.safeParse(group)
  const type = parsed.success ? groupCollections[parsed.data] : 'protocols'
  const name = action ?? group
  return {
    id: path.join('.'),
    signature: name,
    purpose: `Совместимость: ${command.description()}`,
    options: [],
    group: command.commands.length > 0,
    arguments: Object.fromEntries(
      command.registeredArguments.map((argument) => [
        argument.name(),
        'Короткий ключ внутри предметной группы либо полный читаемый адрес; порядок сохраняется.'
      ])
    ),
    ruleSets: ['base'],
    rules: [
      {
        id: 'legacy-contract',
        text: `Это прежний интерфейс группы ${group}; рекомендуемый новый интерфейс начинается с операции read/list/create/update. Тип ${type}. Старые get/inspect принимают максимум 50 ключей, list — limit 1–100 и offset.`
      },
      {
        id: 'legacy-write',
        text: 'ВНИМАНИЕ: старый update заменяет массивы patch целиком, включая translations. Старый delete карточки каскадно удаляет редакции без нового --cascade-owned. translate сливает только выбранный язык. Для адресных безопасных изменений используйте новый интерфейс.'
      },
      {
        id: 'legacy-read',
        text: 'get знания требует явный --protocol; inspect читает исходные записи и все переводы, --rev выбирает редакцию. Короткий код не является поиском по названию. Другой язык или профиль не подставляются.'
      },
      {
        id: 'legacy-version',
        text: 'Защита старой записи — ifRevision (семантический SHA-256). Это не новый ifVersion. Dry-run не сохраняет, но возвращаемая revision является расчётной; previousRevision — исходная.'
      }
    ],
    result:
      action === 'schema'
        ? 'Полный прежний предметный JSON Schema и generatedFields, не схема нового values.'
        : 'Предметный результат старого контракта; JSON {ok,data,meta}, записи содержат revision SHA-256.',
    absence:
      'Пустой список — успех. Отсутствующая явная запись — код 3, пробел применимости знания — availability. Не заполняет неизвестные факты или ссылки.',
    related: ['help', 'read', 'list', 'update', 'schema']
  }
}

/**
 * Публикует точные DTO-имена старого --file, не подменяя их новыми публичными aliases.
 */
export function legacyInput(command: Command): LegacyInputDocument {
  const [group, action] = commandPath(command)
  const parsed = groupSchema.safeParse(group)
  if (!parsed.success || !['create', 'update', 'translate', 'add-revision', 'update-revision'].includes(action))
    return { fields: [] }
  const collection = groupCollections[parsed.data]
  const isRevision =
    ['add-revision', 'update-revision'].includes(action) ||
    (action === 'translate' && ['packets', 'scenarios', 'articles'].includes(collection))
  const schema = isRevision ? revisionSchemas[revisionType(collection)] : entitySchemas[collection]
  const shape: Record<string, z.ZodType> = action === 'translate' ? { ...translationSchema.shape } : { ...schema.shape }
  const translation = translationSchema.extend({
    source: z.array(sourceSchema.extend({ id: sourceSchema.shape.id.optional() })).default([])
  })
  if (action === 'translate') shape.source = translation.shape.source
  else if ('translations' in shape) shape.translations = z.array(translation).default([])
  for (const [name, field] of Object.entries(shape))
    if (IMMUTABLE_FIELDS.includes(name) || ['update', 'update-revision', 'translate'].includes(action))
      shape[name] = field.optional()
  const input = z.strictObject(shape)
  const fields = Object.entries(shape).map(([name, field]): HelpField => {
    const publicName = Object.keys(FIELD_NAMES).find((key) => FIELD_NAMES[key] === name) ?? name
    const meaning =
      name === 'locale' ? 'Язык выбранного перевода; должен совпадать с --locale.' : fieldDescription(publicName)
    return {
      name,
      meaning,
      schema: OBJECT_SCHEMA.parse(z.toJSONSchema(field, { io: 'input' })),
      required: !field.safeParse(undefined).success,
      nullable: field.safeParse(null).success,
      scope: action === 'translate' ? 'translation' : 'record',
      format: name === 'description' ? 'markdown' : 'plain',
      file: false,
      content: false,
      search: false,
      clear: IMMUTABLE_FIELDS.includes(name)
        ? 'Идентичность из команды, не изменяется.'
        : 'В старом patch переданный массив заменяется целиком; непереданное поле сохраняется.'
    }
  })
  return { fields, schema: OBJECT_SCHEMA.parse(z.toJSONSchema(input, { io: 'input' })) }
}

/**
 * Даёт реальный проверяемый пример каждого совместимого маршрута.
 */
export function legacyExamples(command: Command): HelpExample[] {
  const [group, action] = commandPath(command)
  if (!action && group !== 'search')
    return [
      {
        id: 'legacy-group',
        title: 'Посмотреть действия совместимой группы',
        preconditions: [],
        setup: [],
        steps: [{ args: [group, '--help'] }],
        expected: ['Старая семантика и новые рекомендуемые команды показаны явно.']
      }
    ]
  if (group === 'search')
    return [
      {
        id: 'legacy-search',
        title: 'Поиск старого интерфейса в явном протоколе',
        preconditions: [],
        setup: exampleSetup('packet-revisions').concat([
          { args: ['create', 'protocol:1'] },
          { args: ['link', 'packet:example:rev-1', 'protocols', 'protocol:1'] }
        ]),
        steps: [{ args: ['search', '--protocol', '1', '--query', 'Пример'] }],
        expected: ['Выбранные знания только protocol:1; новый find доступен без протокола.']
      }
    ]
  const parsed = groupSchema.parse(group)
  const type = groupCollections[parsed]
  const knowledge = ['packets', 'scenarios', 'articles'].includes(type)
  const key = exampleKey(type).slice(exampleKey(type).indexOf(':') + 1)
  const needsRevision = knowledge && ['get', 'translate', 'revisions', 'update-revision'].includes(action)
  let setup = exampleSetup(needsRevision ? revisionType(type) : type, action !== 'create')
  let args: string[]
  let stdin: string | undefined
  if (action === 'create') args = [group, 'create', key, ...createExampleStep(type).args.slice(2)]
  else if (action === 'get') {
    args = [group, 'get', key, ...(knowledge ? ['--protocol', '1'] : [])]
    if (knowledge)
      setup = setup.concat([
        { args: ['create', 'protocol:1'] },
        { args: ['link', `${exampleKey(type)}:rev-1`, 'protocols', 'protocol:1'] }
      ])
  } else if (action === 'inspect') args = [group, 'inspect', key]
  else if (action === 'list' || action === 'schema') args = [group, action]
  else if (action === 'revisions') args = [group, 'revisions', key]
  else if (action === 'delete') args = [group, 'delete', key]
  else if (action === 'translate')
    args = [group, 'translate', key, ...(knowledge ? ['--rev', '1'] : []), '--locale', 'en', '--title', 'Example']
  else if (action === 'add-revision') args = [group, 'add-revision', key, '--rev', '1', '--title', 'Редакция примера']
  else if (action === 'update-revision')
    args = [group, 'update-revision', key, '--rev', '1', '--title', 'Обновлённая редакция']
  else if (action === 'update') {
    args = [
      group,
      'update',
      key,
      ...(type === 'packets' ? ['--name', 'RenamedPacket'] : knowledge ? ['--file', '-'] : ['--title', 'Обновлено'])
    ]
    if (knowledge && type !== 'packets') stdin = JSON.stringify({ servers: ['game'] }, null, 2)
  } else throw new Error(`Совместимый маршрут ${group}.${action} не имеет примера.`)
  return [
    {
      id: 'legacy-action',
      title: 'Выполнить прежний синтаксис в отдельной базе',
      preconditions: [
        'Пример относится к совместимости; семантика массивов и каскада отличается от нового интерфейса.'
      ],
      setup: action === 'schema' ? [] : setup,
      steps: [{ args, stdin }],
      expected: ['Вызов использует реально зарегистрированные старые флаги и завершается успешно.']
    }
  ]
}
