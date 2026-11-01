import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createKnowledgeApi,
  validateDataset,
  validateKnowledge,
  validateKnowledgeRendering,
  toDocumentationDataset,
} from '../dist/index.js';

import { knowledgeFixture } from './knowledge-fixture.mjs';
const snapshot = await knowledgeFixture();
const agentLink = (target) =>
  `\`${target.kind}:${target.id}\` (${target.protocolId}/${target.server}/${target.locale})`;
const api = (input = snapshot, options = {}) =>
  createKnowledgeApi(input, { renderLink: agentLink, ...options });
const selected = (database, server = 'game', locale = 'ru', id = '273') =>
  database.forProtocol({ id, locale }).forServer(server);
const document = (input, id) => input.documents.find((item) => item.id === id);
const entity = (input, id) => input.entities.find((item) => item.id === id);
const profile = (input, id = '273') =>
  input.protocols.find((item) => item.id === id);

test('контракты содержат id, title, summary и построчное description', () => {
  for (const record of [
    ...snapshot.protocols,
    ...snapshot.entities,
    ...snapshot.documents,
    ...snapshot.chronicles,
  ]) {
    assert.equal(typeof record.id, 'string');
    assert.ok(record.title.trim());
    assert.ok(record.summary.trim());
    assert.ok(Array.isArray(record.description));
    assert.ok(
      record.description.every(
        (line) => typeof line === 'string' && !/[\r\n]/.test(line),
      ),
    );
    assert.equal('markdown' in record, false);
  }
  const result = api().forProtocol({ id: '273' }).getOverview();
  assert.equal(result.meta.id, '273');
  assert.equal(result.meta.number, 273);
  assert.equal(result.meta.variant, null);
  assert.deepEqual(result.meta.loginRevisions, []);
  assert.equal(result.meta.chronicle, 'high-five');
  assert.match(result.description, /Lineage2TS/);
  assert.equal('gameRevision' in result.meta, false);
  assert.equal('markdown' in result, false);
  assert.equal(result.context.locale, 'ru');
});

test('сначала протокол, затем сервер: направления и сведения разделены', () => {
  const database = api();
  assert.deepEqual(
    database.listProtocols({ locale: 'ru' }).items.map((item) => item.id),
    ['273', '656'],
  );
  const game = selected(database);
  const login = selected(database, 'login');
  assert.deepEqual(
    game
      .listPackets({ direction: 'client-to-server' })
      .items.map((item) => item.id),
    ['protocol-version'],
  );
  assert.deepEqual(
    login
      .listPackets({ direction: 'server-to-client' })
      .items.map((item) => item.id),
    ['server-list'],
  );
  assert.deepEqual(
    game.listScenarios().items.map((item) => item.id),
    ['game-connection'],
  );
  assert.ok(
    game.listArticles().items.some((item) => item.id === 'game-framing'),
  );
  assert.equal(
    login.getPacket('protocol-version').meta.resolution,
    'wrong-server',
  );
  assert.equal(login.getPacket('protocol-version').meta.opcode, null);
  assert.equal(selected(database, 'game', 'ru', '656').listPackets().total, 0);
  assert.equal(
    selected(database, 'game', 'ru', '656').getPacket('protocol-version').meta
      .resolution,
    'unmapped',
  );
  assert.throws(() => game.getPacket('unknown'), /Unknown entity/);
  assert.throws(() => database.forProtocol({ id: '999' }), /Unknown protocol/);
  assert.throws(() => database.forProtocol({ id: '273', locale: 'de' }));
  assert.throws(() => database.forProtocol({ id: '273' }).forServer('other'));
  assert.equal('search' in database, false);
});

test('описание раскрывает вставки и сохраняет метаданные, источники и зависимости', () => {
  const result = selected(api()).getPacket('protocol-version');
  assert.equal(result.meta.opcode[0].value, '0x0E');
  assert.equal(result.meta.documentVersionId, 'packet.protocol-version.v1');
  assert.equal(result.meta.researchStatus, 'partial');
  assert.equal(result.meta.translationStatus, 'ready');
  assert.ok(result.meta.summary);
  assert.match(result.description, /Границы игрового кадра/);
  assert.match(result.description, /Начало защищённого обмена/);
  assert.match(result.description, /packet:key-packet/);
  assert.doesNotMatch(result.description, /\{\{/);
  const writerSource = snapshot.sources.find((source) =>
    source.url.includes('/DeclaredServerPacket.ts'),
  );
  assert.ok(result.sources.some((source) => source.id === writerSource.id));
  assert.ok(
    result.references.some(
      (reference) =>
        reference.id === 'key-packet' && reference.protocolId === '273',
    ),
  );
  assert.equal(result.requires[0].id, 'game-framing');
  assert.ok(result.gaps.some((gap) => gap.code === 'research-partial'));
  assert.ok(result.openQuestions.length);
});

test('оформление ссылок принадлежит приложению; взаимные ссылки допустимы', () => {
  const targets = [];
  const web = api(snapshot, {
    renderLink: (target) => {
      targets.push(target);
      return `[${target.title}](/docs/${target.locale}/${target.protocolId}/${target.server}/${target.kind}/${target.id}/)`;
    },
  });
  assert.match(
    selected(web).getPacket('protocol-version').description,
    /\/docs\/ru\/273\/game\/packet\/key-packet\//,
  );
  assert.doesNotMatch(
    selected(api()).getPacket('protocol-version').description,
    /\/docs\//,
  );
  assert.ok(
    targets.some(
      (target) => target.documentVersionId === 'packet.key-packet.v1',
    ),
  );
  assert.match(
    selected(api()).getPacket('key-packet').description,
    /packet:protocol-version/,
  );
  assert.throws(
    () => selected(createKnowledgeApi(snapshot)).getPacket('protocol-version'),
    /renderLink adapter/,
  );
  assert.throws(
    () =>
      selected(api(snapshot, { renderLink: () => '# Heading' })).getPacket(
        'protocol-version',
      ),
    /inline Markdown/,
  );
});

test('описание протокола использует тот же рендерер и явный контекст ссылок', () => {
  const input = structuredClone(snapshot);
  profile(input).description = [
    '{{include article:game-framing}}',
    '',
    '{{link packet:request-server-list}}',
  ];
  const result = api(input).forProtocol({ id: '273' }).getOverview();
  assert.match(result.description, /Границы игрового кадра/);
  assert.ok(
    result.references.some(
      (reference) =>
        reference.id === 'request-server-list' && reference.server === 'login',
    ),
  );
  const framing = entity(input, 'game-framing');
  framing.servers = ['login', 'game'];
  assert.throws(() => validateKnowledgeRendering(input), /explicit server/);
  profile(input).description[0] =
    '{{include article:game-framing server=game}}';
  assert.doesNotThrow(() => validateKnowledgeRendering(input));
});

test('description сохраняет исходные строки, разметку и примеры кода', () => {
  const input = structuredClone(snapshot);
  const lines = [
    '# Заголовок',
    '',
    'Два пробела в конце.  ',
    'Следующая строка.',
    '',
    '| Имя | Тип |',
    '| --- | --- |',
    '| revision | int32 LE |',
    '',
    '```text',
    '{{link packet:not-a-real-id}}',
    '  сохраняются отступы',
    '```',
    '',
    '`{{include article:not-a-real-id}}`',
    '',
    '\\{{literal}}',
    '',
  ];
  document(input, 'article.game-framing.v1').description = lines;
  assert.equal(
    selected(api(input)).getArticle('game-framing').description,
    lines.join('\n'),
  );
  for (const line of ['first\nsecond', 'first\r\nsecond', 'line\n']) {
    const invalid = structuredClone(input);
    document(invalid, 'article.game-framing.v1').description = [line];
    assert.throws(() => api(invalid), /one line/);
  }
});

test('отсутствующий перевод точной версии не подменяется другим языком или старой версией', () => {
  const result = selected(api(), 'game', 'en').getPacket('protocol-version');
  assert.equal(result.description, null);
  assert.equal(result.meta.opcode[0].value, '0x0E');
  assert.equal(result.meta.translationStatus, 'missing');
  assert.ok(result.gaps.some((gap) => gap.code === 'translation-missing'));
  const input = structuredClone(snapshot);
  const previous = structuredClone(
    document(input, 'packet.protocol-version.v1'),
  );
  previous.id = 'packet.protocol-version.old';
  input.documents.push(previous);
  input.translations
    .find((base) => base.locale === 'en')
    .documents.push({
      id: previous.id,
      title: 'Old',
      summary: 'Old translation',
      description: ['Old translated contents'],
    });
  assert.equal(
    selected(api(input), 'game', 'en').getPacket('protocol-version')
      .description,
    null,
  );
});

test('протоколы с одинаковым number имеют разные ID, привязки и страницы', () => {
  const input = structuredClone(snapshot);
  input.protocols.push({
    ...structuredClone(profile(input)),
    id: '273-a',
    variant: 'a',
    title: 'Проверка варианта',
  });
  const version = structuredClone(
    document(input, 'packet.protocol-version.v1'),
  );
  version.id = 'packet.protocol-version.test-variant';
  version.previousVersionId = 'packet.protocol-version.v1';
  version.description = ['Другой вариант для проверки разрешения.'];
  input.documents.push(version);
  entity(input, 'protocol-version').bindings.push({
    ...structuredClone(entity(input, 'protocol-version').bindings[0]),
    protocolIds: ['273-a'],
    documentVersionId: version.id,
    opcode: [{ type: 'u8', value: '0x09' }],
  });
  // Test mutations are not published claims about real clients.
  const database = api(input);
  assert.equal(
    selected(database, 'game', 'ru', '273-a').getPacket('protocol-version')
      .description,
    version.description.join('\n'),
  );
  assert.equal(
    selected(database).getPacket('protocol-version').meta.opcode[0].value,
    '0x0E',
  );
  assert.equal(
    selected(database, 'game', 'ru', '273-a').getPacket('protocol-version').meta
      .opcode[0].value,
    '0x09',
  );
  const docs = toDocumentationDataset(input, { renderLink: agentLink });
  const ids = docs.bases
    .find((base) => base.locale === 'ru')
    .protocols.map((item) => item.id);
  assert.ok(ids.includes('273'));
  assert.ok(ids.includes('273-a'));
  assert.doesNotThrow(() => validateDataset(docs));
  assert.equal(
    docs.bases
      .find((base) => base.locale === 'ru')
      .protocols.filter((item) => item.number === 273).length,
    2,
  );
});

test('один документ переиспользуется с другим опкодом без переноса неизвестной применимости', () => {
  const input = structuredClone(snapshot);
  const packet = entity(input, 'protocol-version');
  packet.bindings.push({
    ...structuredClone(packet.bindings[0]),
    protocolIds: ['656'],
    opcode: [{ type: 'u8', value: '0x00' }],
  });
  const database = api(input);
  const first = selected(database).getPacket(packet.id);
  const second = selected(database, 'game', 'ru', '656').getPacket(packet.id);
  assert.equal(first.meta.documentVersionId, second.meta.documentVersionId);
  assert.match(second.description, /профиля: 0x00/);
  assert.ok(
    second.gaps.some(
      (gap) => gap.code === 'unmapped' && gap.id === 'game-framing',
    ),
  );
});

test('контексты и курсоры закреплены за неизменяемым снимком', () => {
  const input = structuredClone(snapshot);
  const database = api(input);
  const game = selected(database);
  const first = game.listPackets({ limit: 1 });
  const second = game.listPackets({ limit: 1, cursor: first.nextCursor });
  assert.notEqual(first.items[0].id, second.items[0].id);
  assert.equal(second.nextCursor, null);
  assert.throws(
    () =>
      selected(database, 'login').listPackets({
        limit: 1,
        cursor: first.nextCursor,
      }),
    /Cursor/,
  );
  assert.throws(
    () =>
      selected(database, 'game', 'en').listPackets({
        limit: 1,
        cursor: first.nextCursor,
      }),
    /Cursor/,
  );
  assert.throws(
    () => game.listPackets({ limit: 2, cursor: first.nextCursor }),
    /Cursor/,
  );
  assert.throws(
    () =>
      game.listPackets({
        limit: 1,
        direction: 'client-to-server',
        cursor: first.nextCursor,
      }),
    /Cursor/,
  );
  assert.throws(() => game.listPackets({ limit: 101 }), /Limit/);
  input.dataVersion = 'next';
  entity(input, 'protocol-version').bindings[0].opcode[0].value = '0x09';
  assert.equal(game.getPacket('protocol-version').meta.opcode[0].value, '0x0E');
  assert.throws(
    () =>
      selected(api(input)).listPackets({ limit: 1, cursor: first.nextCursor }),
    /Cursor/,
  );
  assert.throws(() => {
    database.snapshot.protocols[0].id = 'changed';
  }, TypeError);
  assert.throws(() => {
    game.context.server = 'login';
  }, TypeError);
});

test('валидатор проверяет ID, number, variant, обязательные описания и ссылки', () => {
  const changes = [
    (input) => {
      input.schemaVersion = 5;
    },
    (input) => {
      input.defaultLocale = 'de';
    },
    (input) => {
      input.translations.pop();
    },
    (input) => {
      input.sources = [];
    },
    (input) => {
      profile(input).variant = 'a';
    },
    (input) => {
      profile(input).number = 152;
    },
    (input) => {
      profile(input).id = 'high-five-273';
    },
    (input) => {
      profile(input).gameRevision = 273;
    },
    (input) => {
      profile(input).loginRevisions = [30810, 30810];
    },
    (input) => {
      profile(input).chronicle = 'unknown';
    },
    (input) => {
      profile(input).stage = 'unknown';
    },
    (input) => {
      delete entity(input, 'protocol-version').summary;
    },
    (input) => {
      document(input, 'packet.protocol-version.v1').title = '';
    },
    (input) => {
      document(input, 'packet.protocol-version.v1').markdown = [];
    },
    (input) => {
      document(input, 'packet.protocol-version.v1').blocks = [];
    },
    (input) => {
      entity(input, 'protocol-version').bindings.push(
        structuredClone(entity(input, 'protocol-version').bindings[0]),
      );
    },
    (input) => {
      entity(input, 'protocol-version').bindings[0].protocolIds = ['999'];
    },
    (input) => {
      entity(input, 'protocol-version').bindings[0].documentVersionId =
        'packet.key-packet.v1';
    },
    (input) => {
      entity(input, 'protocol-version').bindings[0].opcode[0].value = '0x100';
    },
    (input) => {
      document(input, 'packet.protocol-version.v1').description = [
        '{{link packet:unknown}}',
      ];
    },
    (input) => {
      document(input, 'packet.protocol-version.v1').description = [
        '{{value article:game-framing field=opcode}}',
      ];
    },
    (input) => {
      document(input, 'packet.protocol-version.v1').description = [
        '{{include article:game-framing block=frame}}',
      ];
    },
    (input) => {
      document(input, 'packet.protocol-version.v1').description = [
        '{{link packet:key-packet',
      ];
    },
    (input) => {
      document(input, 'packet.protocol-version.v1').description = [
        'inline {{include article:game-framing}}',
      ];
    },
  ];
  for (const change of changes) {
    const input = structuredClone(snapshot);
    change(input);
    assert.throws(() => validateKnowledge(input));
  }
});

test('составной опкод и коллизии учитывают направление и состояние', () => {
  const input = structuredClone(snapshot);
  const packet = entity(input, 'protocol-version');
  packet.bindings[0].opcode = [
    { type: 'u8', value: '0xD0' },
    { type: 'u16le', value: '0x0051' },
    { type: 'u32le', value: '0x00000000' },
  ];
  const other = structuredClone(packet);
  other.id = 'protocol-version-alias-test';
  other.bindings = [];
  input.entities.push(other);
  const version = structuredClone(
    document(input, 'packet.protocol-version.v1'),
  );
  version.id = 'packet.protocol-version-alias-test.v1';
  version.entity.id = other.id;
  input.documents.push(version);
  other.bindings.push({
    ...structuredClone(packet.bindings[0]),
    documentVersionId: version.id,
  });
  assert.throws(() => validateKnowledge(input), /Opcode collision/);
  other.bindings[0].states = ['AUTHED'];
  assert.doesNotThrow(() => validateKnowledge(input));
  packet.bindings[0].opcode[2].value = '0x100000000';
  assert.throws(() => validateKnowledge(input), /Opcode exceeds/);
});

test('неполные описания и общие статьи остаются доступными с явными статусами', () => {
  const input = structuredClone(snapshot);
  const packet = entity(input, 'protocol-version');
  packet.bindings[0].opcode = null;
  const version = document(input, 'packet.protocol-version.v1');
  version.status = 'missing';
  version.description = [];
  const article = entity(input, 'game-framing');
  article.scope = 'general';
  article.servers = ['login', 'game'];
  article.documentVersionId = article.bindings[0].documentVersionId;
  article.bindings = [];
  const database = api(input);
  const result = selected(database).getPacket(packet.id);
  assert.equal(result.description, null);
  assert.equal(result.meta.opcode, null);
  assert.equal(result.meta.translationStatus, 'ready');
  assert.ok(result.gaps.some((gap) => gap.code === 'research-missing'));
  assert.equal(
    selected(database, 'login', 'ru', '656').getArticle(article.id).meta.scope,
    'general',
  );
  assert.ok(
    selected(database, 'login')
      .listArticles()
      .items.some((item) => item.id === article.id),
  );
});

test('циклы вставок и лимиты раскрытия проверяются до публикации', () => {
  const input = structuredClone(snapshot);
  document(input, 'article.game-framing.v1').description = [
    '{{include packet:protocol-version}}',
  ];
  assert.throws(() => validateKnowledgeRendering(input), /Include cycle/);
  assert.throws(
    () =>
      selected(api(snapshot, { maxIncludeDepth: 1 })).getPacket(
        'protocol-version',
      ),
    /include depth/,
  );
  assert.throws(
    () =>
      selected(api(snapshot, { maxDescriptionBytes: 32 })).getPacket(
        'protocol-version',
      ),
    /description size/,
  );
});

test('проекция страниц использует description и явно показывает отсутствие перевода', () => {
  const docs = toDocumentationDataset(snapshot, {
    renderLink: (target) => `[${target.title}](${target.id}.md)`,
  });
  const ru = docs.bases
    .find((base) => base.locale === 'ru')
    .protocols.find((item) => item.id === '273');
  assert.equal(ru.sections[0].id, 'overview');
  assert.ok(
    ru.sections.some((section) => section.id === 'packet.protocol-version'),
  );
  assert.match(
    ru.documents.find((item) => item.file === 'game-connection.md').body,
    /key-packet\.md/,
  );
  const en = docs.bases
    .find((base) => base.locale === 'en')
    .protocols.find((item) => item.id === '273');
  const untranslated = en.sections.find(
    (section) => section.id === 'game-connection',
  );
  assert.equal(untranslated.translationStatus, 'missing');
  assert.equal(untranslated.status, 'partial');
  assert.equal(untranslated.file, null);
  const packet = en.sections.find(
    (section) => section.id === 'packet.key-packet',
  );
  assert.equal(packet.title, 'KeyPacket');
  assert.equal(packet.translationStatus, 'missing');
  assert.equal(packet.file, null);
});
