import { collectionSchema, revisionCollectionSchema } from '@l2ce/database'
import type { Collection, RevisionCollection } from '@l2ce/database'
import { TYPES } from '../commands/model.js'
import type { ExampleStep, HelpExample } from './help.types.js'

/** Непустой документ с буквальными переносами для примеров и проверки stdin/файлов. */
export const EXAMPLE_DOCUMENT = '# Пример\n\n  Отступы, $ и `код` сохраняются.\n'

/**
 * Возвращает синтетический адрес; числа не являются историческим утверждением.
 */
export function exampleKey(collection: Collection): string {
  if (collection === 'protocols') return 'protocol:1'
  if (collection === 'release-contexts') return 'release-context:example:na'
  if (collection.endsWith('-revisions')) return `${TYPES[collection][0]}:example:rev-1`
  return `${TYPES[collection][0]}:example`
}

/**
 * Даёт реальную команду создания для типа с минимальными явными обязательными полями.
 */
export function createExampleStep(collection: Collection): ExampleStep {
  const key = exampleKey(collection)
  const fields: Readonly<Record<string, string[]>> = {
    sagas: ['--branch', 'branch:example'],
    chronicles: ['--branch', 'branch:example'],
    releases: ['--chronicle', 'chronicle:example'],
    'release-contexts': ['--region', 'region:na'],
    packets: ['--name', 'ExamplePacket', '--server', 'game', '--direction', 'client-to-server']
  }
  return {
    args: [
      'create',
      key,
      ...(fields[collection] ?? []),
      ...(['packets', 'scenarios', 'articles'].includes(collection) ? [] : ['--title', 'Пример'])
    ]
  }
}

/**
 * Создаёт зависимости в явном порядке без ручных UUID и входных JSON-оболочек.
 */
export function exampleSetup(collection: Collection = 'protocols', includeTarget = true): ExampleStep[] {
  const prerequisites: Readonly<Record<string, Collection[]>> = {
    sagas: ['branches'],
    chronicles: ['branches'],
    releases: ['branches', 'chronicles'],
    'release-contexts': ['branches', 'chronicles', 'releases', 'regions'],
    'packet-revisions': ['packets'],
    'scenario-revisions': ['scenarios'],
    'article-revisions': ['articles']
  }
  const steps: ExampleStep[] = [{ args: ['init'] }]
  for (const type of prerequisites[collection] ?? [])
    steps.push(
      type === 'regions' ? { args: ['create', 'region:na', '--title', 'Регион примера'] } : createExampleStep(type)
    )
  if (includeTarget) steps.push(createExampleStep(collection))
  return steps
}

/**
 * Определяет реальный тип новых полей revision add по типу карточки или редакции.
 */
export function revisionType(collection: Collection): RevisionCollection {
  const types: Readonly<Record<string, string>> = {
    packets: 'packet-revisions',
    scenarios: 'scenario-revisions',
    articles: 'article-revisions'
  }
  if (collection.endsWith('-revisions')) return revisionCollectionSchema.parse(collection)
  const type = types[collection]
  if (!type) throw new Error('revision требует тип карточки знания.')
  return revisionCollectionSchema.parse(type)
}

/**
 * Определяет обычный пример для контекста, не подставляя технический текст в карточку.
 */
function ownedType(collection?: Collection): Collection {
  return collection ?? 'protocols'
}

/**
 * Создаёт компактное полное описание исполняемого сценария.
 */
function example(
  id: string,
  title: string,
  setup: ExampleStep[],
  steps: ExampleStep[],
  expected: string[],
  preconditions: string[] = []
): HelpExample {
  return { id, title, setup, steps, expected, preconditions }
}

/**
 * Возвращает проверяемые примеры каждого нового действия и группы; неизвестные не получают заглушку.
 */
function primaryExamples(operation: string, collection?: Collection): HelpExample[] {
  const type = ownedType(collection)
  const key = exampleKey(type)
  const setup = exampleSetup(type)
  if (operation === 'help')
    return [
      example(
        'discover',
        'Изучить точное вложенное действие без базы',
        [],
        [{ args: ['help', 'source', 'add', '--type', 'releases'] }],
        ['Показаны правила добавления источника релизу, включая url/title, язык и примеры.']
      )
    ]
  if (operation === 'types')
    return [
      example(
        'types',
        'Узнать пространства адресов до init',
        [],
        [{ args: ['types'] }],
        ['Перечислены типы, поля, отношения и применимые операции. SQLite не создаётся.']
      )
    ]
  if (operation === 'schema')
    return [
      example(
        'schema',
        'Получить схему создания релиза без UUID',
        [],
        [{ args: ['schema', 'create', '--type', 'releases'] }],
        ['chronicle обязателен; поля перевода необязательны; UUID и code назначаются из команды.']
      ),
      example(
        'batch-schema',
        'Узнать зависимые поля батча',
        [],
        [{ args: ['schema', 'batch'] }],
        ['Описаны операции, values, files и их зависимость от типа адреса.']
      )
    ]
  if (operation === 'status')
    return [
      example(
        'status',
        'Проверить созданную базу',
        exampleSetup(),
        [{ args: ['status', '--with-version'] }],
        ['Текущая схема, языки, счётчики и полный version. База не меняется.']
      )
    ]
  if (operation === 'init')
    return [
      example(
        'empty',
        'Создать пустую базу с явными языками',
        [],
        [{ args: ['init', '--locales', 'ru,en', '--default-locale', 'en'] }, { args: ['locale', 'list'] }],
        ['Пустая база, основной язык en; повтор init запрещён.']
      )
    ]
  if (operation === 'create')
    return [
      example(
        'create',
        'Создать запись с минимальными обязательными полями',
        exampleSetup(type, false),
        [createExampleStep(type), { args: ['read', key, '--view', 'edit'] }],
        ['Создан один адрес, UUID назначен автоматически; непереданные факты не выдуманы.']
      )
    ]
  if (operation === 'read') {
    const reads = [
      example(
        'read',
        'Прочитать точный адрес и все исходные переводы',
        setup,
        [{ args: ['read', key, '--view', 'edit', '--with-version'] }],
        ['Полная исходная запись и полный токен; соседние записи не разворачиваются.']
      )
    ]
    if (!['packets', 'scenarios', 'articles'].includes(type))
      reads.push(
        example(
          'content',
          'Получить только буквальный документ',
          setup,
          [
            { args: ['update', key, '--set-stdin', 'description'], stdin: EXAMPLE_DOCUMENT },
            { args: ['read', key, '--locale', 'ru', '--content', 'description'], content: EXAMPLE_DOCUMENT }
          ],
          ['stdout содержит ровно исходный документ; завершающий перевод строки сохраняется.']
        )
      )
    else
      reads.push(
        example(
          'applicable',
          'Выбрать только назначенную редакцию',
          exampleSetup(revisionType(type)).concat([
            { args: ['create', 'protocol:1'] },
            { args: ['link', `${key}:rev-1`, 'protocols', 'protocol:1'] }
          ]),
          [{ args: ['read', key, '--protocol', 'protocol:1', '--view', 'full'] }],
          ['Карточка и точный адрес выбранной редакции различаются; другие протоколы не используются.']
        )
      )
    return reads
  }
  if (operation === 'list' || operation === 'find')
    return [
      example(
        'selection',
        'Получить целые записи и сохранить именно показанный набор',
        operation === 'find' && ['packets', 'scenarios', 'articles'].includes(type)
          ? exampleSetup(revisionType(type))
          : setup,
        [
          {
            args:
              operation === 'list'
                ? ['list', '--type', type, '--all', '--save-selection', './selected.json']
                : ['find', key, '--type', type, '--all', '--save-selection', './selected.json']
          },
          { args: ['read', '--selection', './selected.json', '--view', 'edit'] }
        ],
        ['Выборка содержит только показанные адреса и версию; перечитывается без повторения поиска.']
      )
    ]
  if (operation === 'stats')
    return [
      example(
        'stats',
        'Отдельно посчитать записи и источники',
        exampleSetup(),
        [
          {
            args: [
              'source',
              'add',
              'protocol:1',
              '--url',
              'https://example.invalid/source',
              '--title',
              'Источник примера'
            ]
          },
          { args: ['stats', '--type', 'protocols', '--by', 'type,locale', '--all-locales'] }
        ],
        ['Объекты источников и уникальные URL имеют отдельные счётчики; status из них не вычисляется.']
      )
    ]
  if (operation === 'tree')
    return [
      example(
        'tree',
        'Посмотреть классификацию релиза',
        exampleSetup('releases'),
        [{ args: ['tree', 'branch:example', '--depth', '4'] }],
        ['Полные адреса ветки, хроники и самостоятельного релиза; база не меняется.']
      )
    ]
  if (operation === 'relations')
    return [
      example(
        'relations',
        'Посмотреть точные роли связей',
        setup,
        [{ args: ['relations', key] }],
        ['Связи перечислены с обеими сторонами; их отсутствие показано явно.']
      )
    ]
  if (operation === 'update') {
    if (['packets', 'scenarios', 'articles'].includes(type))
      return [
        example(
          'scalar',
          'Изменить только собственное техническое поле',
          setup,
          [
            {
              args: [
                'update',
                key,
                ...(type === 'packets' ? ['--name', 'RenamedPacket'] : ['--add', 'servers=game']),
                '--dry-run'
              ]
            },
            {
              args: ['update', key, ...(type === 'packets' ? ['--name', 'RenamedPacket'] : ['--add', 'servers=game'])]
            },
            { args: ['read', key, '--view', 'edit'] }
          ],
          ['Предпросмотр не пишет; применение сохраняет остальные поля и редакции.']
        )
      ]
    return [
      example(
        'text',
        'Изменить только русский документ через stdin',
        setup,
        [
          {
            args: ['update', key, '--locale', 'ru', '--set-stdin', 'description', '--dry-run'],
            stdin: EXAMPLE_DOCUMENT
          },
          { args: ['update', key, '--locale', 'ru', '--set-stdin', 'description'], stdin: EXAMPLE_DOCUMENT },
          { args: ['read', key, '--locale', 'ru', '--content', 'description'], content: EXAMPLE_DOCUMENT }
        ],
        ['Предпросмотр не пишет. Применение меняет ровно description.ru, сохраняя остальные языки и связи.']
      ),
      {
        ...example(
          'file',
          'Использовать уже существующий UTF-8 черновик',
          setup,
          [
            { args: ['update', key, '--set-file', 'description=./draft.md'] },
            { args: ['read', key, '--content', 'description'], content: EXAMPLE_DOCUMENT }
          ],
          ['Содержимое существующего файла переносится буквально.']
        ),
        files: { './draft.md': EXAMPLE_DOCUMENT }
      }
    ]
  }
  if (operation === 'replace') {
    const fields: Record<string, unknown> =
      type === 'releases'
        ? { chronicle: 'chronicle:example' }
        : type === 'sagas' || type === 'chronicles'
          ? { branch: 'branch:example' }
          : type === 'packets'
            ? { name: 'ReplacementPacket', server: 'game', direction: 'client-to-server' }
            : {}
    if (type === 'release-contexts') fields.region = 'region:na'
    if (!['packets', 'scenarios', 'articles'].includes(type))
      fields.translations = [
        {
          locale: 'ru',
          title: 'Заменено',
          summary: '',
          description: EXAMPLE_DOCUMENT,
          sources: [],
          questions: [],
          translationStatus: 'ready'
        }
      ]
    return [
      example(
        'replace',
        'Полностью заменить edit-запись с явной версией',
        setup,
        [
          { args: ['read', key, '--view', 'edit', '--with-version'], captureVersion: true },
          {
            args: ['replace', key, '--if-version', '<version>', '--input', '-', '--dry-run'],
            stdin: JSON.stringify(fields, null, 2)
          },
          {
            args: ['replace', key, '--if-version', '<version>', '--input', '-'],
            stdin: JSON.stringify(fields, null, 2)
          },
          { args: ['read', key, '--view', 'edit'] }
        ],
        ['Непереданные переводы/списки удаляются или становятся умолчаниями; это не patch. Идентичность сохранена.'],
        ['<version> замените полным токеном из предыдущего read; dry-run не меняет его.']
      )
    ]
  }
  if (operation === 'delete')
    return [
      example(
        'delete',
        'Проверить и удалить самостоятельную запись',
        setup,
        [
          {
            args: [
              'delete',
              key,
              ...(['packets', 'scenarios', 'articles'].includes(type) ? ['--cascade-owned'] : []),
              '--dry-run'
            ]
          },
          {
            args: ['delete', key, ...(['packets', 'scenarios', 'articles'].includes(type) ? ['--cascade-owned'] : [])]
          },
          { args: ['read', key, '--allow-missing', '--view', 'brief'] }
        ],
        ['Удаляется точный адрес; отсутствующая запись показана явно, связанные самостоятельные записи не удаляются.']
      )
    ]
  if (operation === 'link' || operation === 'unlink') {
    const relationType = collection ?? 'packet-revisions'
    const owner = exampleKey(relationType)
    const prerequisites = exampleSetup(relationType)
    let relation = 'protocols'
    let target = 'protocol:1'
    let flags: string[] = relationType === 'releases' ? ['--unscoped'] : []
    if (relationType === 'chronicles') {
      relation = 'saga'
      target = 'saga:example'
      prerequisites.push({ args: ['create', target, '--branch', 'branch:example'] })
    } else if (relationType === 'sagas') {
      relation = 'branch'
      target = 'branch:other'
      flags = ['--replace']
      prerequisites.push({ args: ['create', target] })
    } else prerequisites.push({ args: ['create', target] })
    if (operation === 'unlink') prerequisites.push({ args: ['link', owner, relation, target, ...flags] })
    return [
      example(
        'link',
        'Изменить одну связь, сохранив владельца и соседние факты',
        prerequisites,
        [
          { args: [operation, owner, relation, target, ...(operation === 'link' ? flags : []), '--dry-run'] },
          { args: [operation, owner, relation, target, ...(operation === 'link' ? flags : [])] },
          { args: ['relations', owner, '--out'] }
        ],
        ['Меняется только указанная связь; сами связанные записи сохраняются.']
      )
    ]
  }
  if (operation === 'translation')
    return [
      example(
        'translation',
        'Узнать отдельные действия перевода',
        [],
        [{ args: ['help', 'translation', 'set', '--type', 'protocols'] }],
        ['Описание точечного слияния и все текстовые способы ввода, без чужих технических флагов.']
      )
    ]
  if (operation === 'translation.list')
    return [
      example(
        'languages',
        'Проверить сохранённые переводы',
        setup,
        [{ args: ['translation', 'list', key] }],
        ['Показаны реальные языки и их translationStatus, без автоматических копий.']
      )
    ]
  if (operation === 'translation.set')
    return [
      example(
        'translate',
        'Добавить английский перевод, сохранив русский',
        setup,
        [
          {
            args: [
              'translation',
              'set',
              key,
              '--locale',
              'en',
              '--title',
              'Example',
              '--set-stdin',
              'description',
              '--dry-run'
            ],
            stdin: '# English\n'
          },
          {
            args: ['translation', 'set', key, '--locale', 'en', '--title', 'Example', '--set-stdin', 'description'],
            stdin: '# English\n'
          },
          { args: ['read', key, '--view', 'edit'] }
        ],
        ['Новый en добавлен без копирования ru; остальные языки и предметные поля сохранены.']
      )
    ]
  if (operation === 'translation.delete')
    return [
      example(
        'remove-language',
        'Удалить только отдельный перевод',
        setup.concat([{ args: ['translation', 'set', key, '--locale', 'en', '--title', 'Example'] }]),
        [
          { args: ['translation', 'delete', key, '--locale', 'en', '--dry-run'] },
          { args: ['translation', 'delete', key, '--locale', 'en'] },
          { args: ['translation', 'list', key] }
        ],
        ['Удалён только en и его вложенные объекты; владелец и ru сохраняются.']
      )
    ]
  if (operation === 'revision')
    return [
      example(
        'revision',
        'Узнать работу с редакциями',
        [],
        [{ args: ['help', 'revision', 'add', '--type', 'packets'] }],
        ['Номер следующей редакции, копирование и отсутствие автоматической применимости описаны явно.']
      )
    ]
  if (operation === 'revision.list' || operation === 'revision.add') {
    const revision = revisionType(collection ?? 'packets')
    const card = collectionSchema.parse(revision.replace('-revisions', 's'))
    const cardKey = exampleKey(card)
    return [
      example(
        'revision',
        operation === 'revision.add'
          ? 'Создать новую редакцию с автоматическим номером'
          : 'Посмотреть редакции карточки',
        exampleSetup(card),
        [
          { args: ['revision', 'add', cardKey, '--title', 'Редакция примера'] },
          { args: ['revision', 'list', cardKey] }
        ],
        ['Адрес :rev-1 назначен, protocols остаётся пустым до явного link.']
      )
    ]
  }
  if (operation === 'source')
    return [
      example(
        'source',
        'Узнать различие адресного удаления и полной очистки',
        [],
        [{ args: ['help', 'source', 'remove', '--type', 'protocols'] }],
        ['Есть точный критерий, явный охват нескольких совпадений и языковая область.']
      )
    ]
  const sourceStep: ExampleStep = {
    args: [
      'source',
      'add',
      key,
      '--locale',
      'ru',
      '--url',
      'https://example.invalid/source',
      '--title',
      'Источник примера'
    ]
  }
  if (operation === 'source.add')
    return [
      example(
        'source-add',
        'Добавить источник без ручного ID',
        setup,
        [sourceStep, { args: ['source', 'list', key] }],
        ['Новый UUID назначен; URL и язык видны, другие источники не заменены.']
      )
    ]
  if (operation === 'source.list')
    return [
      example(
        'source-list',
        'Получить ID и URL источника',
        setup.concat([sourceStep]),
        [{ args: ['source', 'list', key, '--locale', 'ru'] }],
        ['Полные URL, ID и язык доступны для точечной следующей операции.']
      )
    ]
  if (operation === 'source.update')
    return [
      example(
        'source-update',
        'Изменить пояснение по точному старому URL',
        setup.concat([sourceStep]),
        [
          {
            args: [
              'source',
              'update',
              key,
              '--match-url',
              'https://example.invalid/source',
              '--summary',
              'Уточнение',
              '--dry-run'
            ]
          },
          {
            args: ['source', 'update', key, '--match-url', 'https://example.invalid/source', '--summary', 'Уточнение']
          },
          { args: ['source', 'list', key] }
        ],
        ['ID и URL сохраняются, меняется только summary выбранного источника.']
      )
    ]
  if (operation === 'source.remove' || operation === 'source.clear')
    return [
      example(
        'source-clean',
        'Предварительно проверить явную область удаления источников',
        setup.concat([sourceStep]),
        [
          {
            args: [
              'source',
              operation.split('.')[1],
              key,
              '--locale',
              'ru',
              ...(operation === 'source.remove' ? ['--match-host', 'example.invalid', '--all-matches'] : []),
              '--dry-run'
            ]
          },
          {
            args: [
              'source',
              operation.split('.')[1],
              key,
              '--locale',
              'ru',
              ...(operation === 'source.remove' ? ['--match-host', 'example.invalid', '--all-matches'] : [])
            ]
          },
          { args: ['source', 'list', key] }
        ],
        ['Сначала показаны удаляемые URL; после применения выбранные источники отсутствуют, владелец сохранён.']
      )
    ]
  if (operation === 'question')
    return [
      example(
        'question',
        'Узнать адресные операции над вопросами',
        [],
        [{ args: ['help', 'question', 'add', '--type', 'protocols'] }],
        ['Вопрос принадлежит переводу и идентифицируется точным текстом, а не номером строки.']
      )
    ]
  if (operation.startsWith('question.')) {
    const add: ExampleStep = { args: ['question', 'add', key, '--locale', 'ru', '--text', 'Что ещё нужно проверить?'] }
    return [
      example(
        'question',
        'Добавить, прочитать или адресно удалить открытый вопрос',
        setup.concat(operation === 'question.add' ? [] : [add]),
        [
          {
            args:
              operation === 'question.add'
                ? add.args
                : [
                    'question',
                    operation.split('.')[1],
                    key,
                    '--locale',
                    'ru',
                    ...(operation === 'question.remove' ? ['--text', 'Что ещё нужно проверить?'] : [])
                  ]
          },
          { args: ['question', 'list', key, '--locale', 'ru'] }
        ],
        ['Операция касается только вопросов выбранного языка; текст, источники и применимость сохраняются.']
      )
    ]
  }
  if (operation === 'locale')
    return [
      example(
        'locale',
        'Узнать ограничения реестра языков',
        [],
        [{ args: ['help', 'locale', 'delete'] }],
        ['Основной или используемый язык не удаляется вместе с переводами скрыто.']
      )
    ]
  if (operation === 'locale.list')
    return [
      example(
        'locale-list',
        'Посмотреть языки новой базы',
        [{ args: ['init'] }],
        [{ args: ['locale', 'list'] }],
        ['Порядок ru,en и основной ru показаны явно.']
      )
    ]
  if (operation === 'locale.add')
    return [
      example(
        'locale-add',
        'Добавить язык без пустых переводов',
        exampleSetup(),
        [
          { args: ['locale', 'add', 'de', '--dry-run'] },
          { args: ['locale', 'add', 'de'] },
          { args: ['locale', 'list'] }
        ],
        ['de зарегистрирован; переводы не создаются автоматически.']
      )
    ]
  if (operation === 'locale.set-default')
    return [
      example(
        'locale-default',
        'Выбрать зарегистрированный основной язык',
        exampleSetup(),
        [
          { args: ['locale', 'set-default', 'en', '--dry-run'] },
          { args: ['locale', 'set-default', 'en'] },
          { args: ['locale', 'list'] }
        ],
        ['Основной en, тексты ru сохранены.']
      )
    ]
  if (operation === 'locale.delete')
    return [
      example(
        'locale-delete',
        'Удалить неиспользуемый неосновной язык',
        exampleSetup(),
        [
          { args: ['locale', 'delete', 'en', '--dry-run'] },
          { args: ['locale', 'delete', 'en'] },
          { args: ['locale', 'list'] }
        ],
        ['Удаляется только запись реестра en; используемый ru сохранён.']
      )
    ]
  if (operation === 'batch')
    return [
      {
        ...example(
          'batch',
          'Создать связанные записи и изменить перевод одним пакетом',
          [{ args: ['init'] }],
          [
            {
              args: ['batch', '--input', '-', '--dry-run'],
              stdin: JSON.stringify(
                {
                  formatVersion: 1,
                  operations: [
                    { op: 'create', key: 'chronicle:example', values: { branch: 'branch:example' } },
                    { op: 'create', key: 'branch:example', values: { title: 'Пример' } },
                    {
                      op: 'create',
                      key: 'release:example',
                      values: { chronicle: 'chronicle:example' },
                      files: { description: './draft.md' }
                    },
                    { op: 'translation.set', key: 'release:example', locale: 'en', values: { title: 'Example' } }
                  ]
                },
                null,
                2
              )
            }
          ],
          [
            'Ссылки проверены по конечному графу; пути files отсчитываются от cwd для stdin. Dry-run ничего не сохраняет.'
          ]
        ),
        files: { './draft.md': EXAMPLE_DOCUMENT }
      }
    ]
  if (operation === 'validate')
    return [
      example(
        'validate',
        'Проверить конкретную запись и её зависимости',
        setup,
        [{ args: ['validate', key, '--strict-links'] }],
        ['Область — указанный адрес и зависимости; проверка не заявляет исторической достоверности.']
      )
    ]
  if (operation === 'export')
    return [
      example(
        'export',
        'Проверить и явно опубликовать отдельный снимок',
        exampleSetup(),
        [{ args: ['export', '--output', './snapshot', '--dry-run'] }, { args: ['export', '--output', './snapshot'] }],
        ['Полный снимок записан только явно; SQLite и Git-коммиты не меняются.']
      )
    ]
  if (operation === 'import')
    return [
      example(
        'import',
        'Предварительно проверить полную замену',
        exampleSetup().concat([
          { args: ['export', '--output', './snapshot'] },
          { args: ['create', 'protocol:2', '--title', 'Поздняя запись'] }
        ]),
        [
          { args: ['import', '--input', './snapshot', '--replace', '--dry-run'] },
          { args: ['import', '--input', './snapshot', '--replace'] },
          { args: ['read', 'protocol:2', '--allow-missing', '--view', 'brief'] }
        ],
        ['После применения восстановлен исходный полный снимок; поздняя запись отсутствует.']
      )
    ]
  throw new Error(`Нет исполняемых примеров для ${operation}.`)
}

/**
 * Дополняет минимальные примеры каналами ввода, предпросмотром и существенными отказами.
 */
export function commandExamples(operation: string, collection?: Collection): HelpExample[] {
  const examples = primaryExamples(operation, collection)
  const type = ownedType(collection)
  const key = exampleKey(type)
  const ownText = !['packets', 'scenarios', 'articles'].includes(type)
  const mutable = [
    'create',
    'update',
    'replace',
    'delete',
    'link',
    'unlink',
    'translation.set',
    'translation.delete',
    'revision.add',
    'source.add',
    'source.update',
    'source.remove',
    'source.clear',
    'question.add',
    'question.remove',
    'question.clear',
    'locale.add',
    'locale.set-default',
    'locale.delete',
    'import'
  ].includes(operation)
  if (mutable)
    for (const scenario of examples) {
      if (scenario.steps.some((step) => step.args.includes('--dry-run'))) continue
      const index = scenario.steps.findIndex(
        (step) => step.args.slice(0, operation.split('.').length).join('.') === operation
      )
      if (index >= 0) {
        const step = scenario.steps[index]
        scenario.steps.splice(index, 0, { ...step, args: [...step.args, '--dry-run'] })
        scenario.expected.push('Предпросмотр вычисляет тот же план и не меняет базу.')
      }
    }
  if (operation === 'read') {
    examples.push(
      example(
        'keys-stdin',
        'Передать несколько адресов одним stdin, не создавая файл',
        exampleSetup(type),
        [
          {
            args: ['read', '--keys-file', '-', '--view', 'edit'],
            stdin: `${key}\n${key}\n`,
            expect: { 'data.items.length': 2 }
          }
        ],
        ['Два результата сохраняют порядок запроса; stdin не интерпретируется как команды.']
      )
    )
    examples.push({
      ...example(
        'keys-file',
        'Прочитать уже существующий файл адресов',
        exampleSetup(type),
        [{ args: ['read', '--keys-file', './keys.txt', '--view', 'edit'], expect: { 'data.items.length': 1 } }],
        ['Пустые строки разрешены, адрес прочитан одним вызовом.']
      ),
      files: { './keys.txt': `\n${key}\n` }
    })
  }
  if (operation === 'list' || operation === 'find') {
    const actualType = operation === 'find' && !ownText ? revisionType(type) : type
    const initial = exampleSetup(actualType)
    const second = createExampleStep(actualType)
    const original = exampleKey(actualType)
    second.args[1] =
      actualType === 'protocols'
        ? 'protocol:2'
        : actualType.endsWith('-revisions')
          ? original.replace(':rev-1', ':rev-2')
          : actualType === 'release-contexts'
            ? 'release-context:example:other'
            : `${TYPES[actualType][0]}:other`
    const args =
      operation === 'find'
        ? ['find', `${TYPES[actualType][0]}:`, `--type`, type, '--view', 'edit', '--limit', '1']
        : ['list', '--type', type, '--view', 'edit', '--limit', '1']
    examples.push(
      example(
        'cursor',
        'Прочитать целые записи порциями с зафиксированным запросом',
        initial.concat([second]),
        [
          { args, captureCursor: true, expect: { 'meta.page.returned': 1, 'meta.page.remaining': 1 } },
          { args: [...args, '--after', '<cursor>'], expect: { 'meta.page.start': 2, 'meta.page.hasMore': false } }
        ],
        ['Нумерация сквозная; язык, представление и набор запроса не меняются.'],
        ['<cursor> замените точным курсором из команды продолжения.']
      )
    )
  }
  if (operation === 'update' && ownText) {
    examples.push(
      example(
        'arguments',
        'Передать настоящий многострочный текст и два скалярных поля аргументами',
        exampleSetup(type),
        [
          {
            args: [
              'update',
              key,
              '--description',
              EXAMPLE_DOCUMENT,
              '--set',
              'title=Первая\nстрока',
              '--set',
              'summary=Вторая\nстрока'
            ]
          },
          { args: ['read', key, '--content', 'description'], content: EXAMPLE_DOCUMENT }
        ],
        ['= делится только один раз, несколько полей передаются без промежуточных файлов.']
      )
    )
    examples.push(
      example(
        'stale-version',
        'Получить объяснимый конфликт вместо перезаписи устаревших данных',
        exampleSetup(type),
        [
          { args: ['read', key, '--view', 'edit', '--with-version'], captureVersion: true },
          { args: ['update', key, '--description', EXAMPLE_DOCUMENT] },
          { args: ['update', key, '--title', 'Не сохранять', '--if-version', '<version>'], exitCode: 4 },
          { args: ['read', key, '--content', 'description'], content: EXAMPLE_DOCUMENT }
        ],
        ['Устаревшая запись отклонена целиком, автоматического повтора нет.'],
        ['<version> берётся из read до изменения; после него токен намеренно устарел.']
      )
    )
  }
  if (operation === 'source.remove' || operation === 'source.clear') {
    const add: ExampleStep = {
      args: ['source', 'add', key, '--url', 'https://example.invalid/source', '--title', 'Источник примера']
    }
    const cleanup = [
      'source',
      operation.split('.')[1],
      '--selection',
      './sources.json',
      '--all-locales',
      ...(operation === 'source.remove' ? ['--match-host', 'example.invalid', '--all-matches'] : [])
    ]
    examples.push(
      example(
        'fixed-selection',
        'Очистить источники только зафиксированных владельцев и языков',
        exampleSetup(type).concat([add]),
        [
          {
            args: [
              'list',
              '--type',
              type,
              '--has',
              'sources',
              '--all-locales',
              '--all',
              '--save-selection',
              './sources.json'
            ]
          },
          { args: [...cleanup, '--dry-run'] },
          { args: cleanup },
          { args: ['source', 'list', key], expect: { 'data.0.sources.length': 0 } }
        ],
        ['Выборка не повторяет поиск; остальные владельцы и поля не меняются.']
      )
    )
    if (operation === 'source.remove')
      examples.push(
        example(
          'ambiguous',
          'Не выбирать первый из двух совпавших источников',
          exampleSetup(type).concat([add, add]),
          [
            { args: ['source', 'remove', key, '--match-url', 'https://example.invalid/source'], exitCode: 4 },
            { args: ['source', 'list', key], expect: { 'data.0.sources.length': 2 } },
            { args: ['source', 'remove', key, '--match-url', 'https://example.invalid/source', '--all-matches'] }
          ],
          ['Неоднозначная операция не удалила ни одного источника; явный all-matches удаляет оба.']
        )
      )
  }
  if (operation === 'source.clear' || operation === 'question.clear')
    examples.push(
      example(
        'explicit-scope',
        'Не очищать неявный языковой охват',
        exampleSetup(type),
        [{ args: operation === 'source.clear' ? ['source', 'clear', key] : ['question', 'clear', key], exitCode: 2 }],
        ['Без --locale или --all-locales операция отклоняется даже при пустом списке.']
      )
    )
  if (operation === 'batch') {
    const scenario = examples[0]
    const preview = scenario.steps[0]
    scenario.steps.push(
      { ...preview, args: preview.args.filter((argument) => argument !== '--dry-run') },
      { args: ['read', 'release:example', '--content', 'description'], content: EXAMPLE_DOCUMENT }
    )
    examples.push(
      example(
        'rollback',
        'Ошибка второй операции не сохраняет первую',
        exampleSetup(),
        [
          { args: ['read', 'protocol:1', '--view', 'edit', '--with-version'], captureVersion: true },
          {
            args: ['batch', '--input', '-'],
            stdin: JSON.stringify({
              formatVersion: 1,
              operations: [
                { op: 'create', key: 'branch:new', values: { title: 'Не сохранять' } },
                { op: 'update', key: 'release:absent', values: { title: 'Ошибка' } }
              ]
            }),
            exitCode: 3
          },
          {
            args: ['read', 'branch:new', '--allow-missing', '--view', 'brief'],
            expect: { 'data.items.0.availability': 'not-found', 'meta.version': '<version>' }
          }
        ],
        ['Ни первая операция, ни поколение базы не изменены.']
      )
    )
    examples.push(
      example(
        'legacy-format',
        'Распознать отдельный совместимый DTO-формат --file',
        [{ args: ['init'] }],
        [
          {
            args: ['batch', '--file', '-', '--dry-run'],
            stdin: JSON.stringify(
              {
                operations: [
                  {
                    op: 'create',
                    entry: {
                      collection: 'branches',
                      kind: 'entity',
                      key: 'branch:compat',
                      value: { key: 'branch:compat', code: 'compat' }
                    }
                  }
                ]
              },
              null,
              2
            )
          },
          {
            args: ['batch', '--file', '-'],
            stdin: JSON.stringify(
              {
                operations: [
                  {
                    op: 'create',
                    entry: {
                      collection: 'branches',
                      kind: 'entity',
                      key: 'branch:compat',
                      value: { key: 'branch:compat', code: 'compat' }
                    }
                  }
                ]
              },
              null,
              2
            )
          },
          { args: ['read', 'branch:compat', '--view', 'edit'], expect: { 'data.items.0.record.key': 'branch:compat' } }
        ],
        ['UUID назначен; это старый DTO-контракт, не новый публичный formatVersion:1.']
      )
    )
  }
  return examples
}

/**
 * Даёт сквозной рабочий путь с полной подготовкой, а не набор несвязанных команд.
 */
export function workflowExamples(name: string): HelpExample[] {
  if (name === 'catalog')
    return [
      example(
        'catalog',
        'От пустой базы до самостоятельного релиза и регионального контекста',
        [{ args: ['init'] }],
        [
          { args: ['create', 'branch:example', '--title', 'Пример'] },
          { args: ['create', 'saga:example', '--branch', 'example', '--title', 'Сага примера'] },
          {
            args: [
              'create',
              'chronicle:example',
              '--branch',
              'example',
              '--saga',
              'example',
              '--title',
              'Хроника примера'
            ]
          },
          { args: ['create', 'release:example', '--chronicle', 'example', '--title', 'Релиз примера'] },
          { args: ['create', 'region:na', '--title', 'Регион примера'] },
          { args: ['create', 'release-context:example:na', '--region', 'na'] },
          { args: ['create', 'protocol:1', '--title', 'Протокол примера'] },
          { args: ['link', 'release-context:example:na', 'protocols', 'protocol:1', '--dry-run'] },
          { args: ['link', 'release-context:example:na', 'protocols', 'protocol:1'] },
          { args: ['tree', 'branch:example', '--depth', '4'] },
          { args: ['validate', '--links'] },
          { args: ['export', '--output', './snapshot'] }
        ],
        [
          'Адреса хроники и релиза различаются; региональная применимость записана только в явном контексте. Экспорт сделан отдельно.'
        ]
      )
    ]
  if (name === 'translate')
    return [
      example(
        'translate',
        'Добавить перевод, сохранив основание и русский документ',
        exampleSetup(),
        [
          { args: ['translation', 'list', 'protocol:1'] },
          {
            args: [
              'translation',
              'set',
              'protocol:1',
              '--locale',
              'en',
              '--title',
              'Example',
              '--set-stdin',
              'description',
              '--dry-run'
            ],
            stdin: '# English\n'
          },
          {
            args: [
              'translation',
              'set',
              'protocol:1',
              '--locale',
              'en',
              '--title',
              'Example',
              '--set-stdin',
              'description'
            ],
            stdin: '# English\n'
          },
          { args: ['read', 'protocol:1', '--view', 'edit', '--with-version'] }
        ],
        ['ru сохранён, en добавлен; источники и предметные признаки не заменены.']
      )
    ]
  if (name === 'research')
    return [
      example(
        'research',
        'Записать исследовательский документ и проверить точную применимость',
        exampleSetup('packet-revisions').concat([
          { args: ['create', 'protocol:1'] },
          { args: ['link', 'packet:example:rev-1', 'protocols', 'protocol:1'] }
        ]),
        [
          { args: ['find', 'example', '--type', 'packet-revisions', '--all'] },
          { args: ['read', 'packet:example:rev-1', '--view', 'edit', '--with-version'], captureVersion: true },
          {
            args: [
              'update',
              'packet:example:rev-1',
              '--if-version',
              '<version>',
              '--set-stdin',
              'description',
              '--dry-run'
            ],
            stdin: EXAMPLE_DOCUMENT
          },
          {
            args: ['update', 'packet:example:rev-1', '--if-version', '<version>', '--set-stdin', 'description'],
            stdin: EXAMPLE_DOCUMENT
          },
          { args: ['read', 'packet:example', '--protocol', 'protocol:1', '--view', 'full'] },
          { args: ['validate', '--links'] },
          { args: ['export', '--output', './snapshot'] }
        ],
        ['Изменена точная редакция, применимость сохранена; проверка не объявляет историческую достоверность.'],
        ['<version> замените полным токеном из read; предпросмотр не меняет его.']
      )
    ]
  throw new Error(`Неизвестный workflow ${name}; доступны catalog, translate, research.`)
}
