import { parseEntry, validateSnapshot } from '../../dist/index.js';

/**
 * Создаёт синтетический набор для проверок структуры; значения не являются историческими фактами.
 */
export function sharedFixture() {
  let serial = 0;
  const entries = [];
  /**
   * Выдаёт воспроизводимый UUID внутри тестового снимка.
   */
  function id() {
    return `00000000-0000-4000-8000-${(++serial).toString(16).padStart(12, '0')}`;
  }
  /**
   * Создаёт два независимых языковых текста одного технического основания.
   */
  function translations(title) {
    return ['en', 'ru'].map((locale) => ({
      locale,
      title: locale === 'ru' ? `Тест: ${title}` : `Test: ${title}`,
      summary: 'Synthetic fixture',
      description: `# ${title}\n\n{{link packet:unknown}}\n`,
      source: [
        {
          id: id(),
          url: 'https://example.org/fixture',
          title: 'Synthetic source',
        },
      ],
    }));
  }
  /**
   * Проверяет запись и добавляет её к общему снимку.
   */
  function add(collection, key, value) {
    const entry = parseEntry({
      collection,
      key,
      kind: collection.endsWith('-revisions') ? 'implementation' : 'entity',
      value: { id: id(), key, ...value },
    });
    entries.push(entry);
    return entry;
  }
  add('branches', 'branch:main', {
    code: 'main',
    translations: translations('Main'),
  });
  for (const code of ['high-five', 'c4']) {
    add('chronicles', `chronicle:${code}`, {
      code,
      branchKey: 'branch:main',
      translations: translations(code),
    });
    add('chronicle-releases', `chronicle:${code}:base`, {
      code: 'base',
      chronicleKey: `chronicle:${code}`,
      protocolKeys: [code === 'c4' ? 'protocol:656' : 'protocol:273'],
      translations: translations(code),
    });
  }
  for (const [number, variant] of [
    [273, 0],
    [656, 0],
    [152, 0],
    [152, 1],
  ]) {
    add('protocols', `protocol:${number}${variant ? `-rev-${variant}` : ''}`, {
      number,
      variant,
      translations: translations(`${number}/${variant}`),
    });
  }
  for (const [index, code] of [
    'key-packet',
    'protocol-version',
    'request-server-list',
    'server-list',
  ].entries()) {
    add('packets', `packet:${code}`, {
      code,
      name: code,
      server: index < 2 ? 'game' : 'login',
      direction: index % 2 ? 'client-to-server' : 'server-to-client',
    });
    add('packet-revisions', `packet:${code}:rev-1`, {
      packetKey: `packet:${code}`,
      rev: 1,
      protocolKeys: ['protocol:273', 'protocol:656'],
      opcode: [{ type: 'u8', value: index }],
      translations: translations(code),
    });
  }
  for (const code of ['game-connection', 'server-selection']) {
    add('scenarios', `scenario:${code}`, { code, servers: ['login', 'game'] });
    add('scenario-revisions', `scenario:${code}:rev-1`, {
      scenarioKey: `scenario:${code}`,
      rev: 1,
      protocolKeys: ['protocol:273'],
      translations: translations(code),
    });
  }
  add('articles', 'article:game-framing', {
    code: 'game-framing',
    servers: ['game'],
  });
  add('article-revisions', 'article:game-framing:rev-1', {
    articleKey: 'article:game-framing',
    rev: 1,
    protocolKeys: ['protocol:273', 'protocol:656'],
    translations: translations('Framing'),
  });
  return validateSnapshot({
    schemaVersion: 19,
    dataVersion: 'test',
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    entries,
  });
}
