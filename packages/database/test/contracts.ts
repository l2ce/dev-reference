import type {
  Database,
  EntityValue,
  RevisionValue,
  Source,
  Translation,
} from '../src/index.js';

declare const database: Database;
const packet: EntityValue<'packets'> | undefined = database.get({
  collection: 'packets',
  key: 'packet:example',
});
const revision: RevisionValue<'packet-revisions'> | undefined =
  database.getRevision({
    collection: 'packet-revisions',
    key: 'packet:example:rev-1',
  });
const translation: Translation | undefined = revision?.translations[0];
const source: Source | undefined = translation?.source[0];
source?.summary;
revision?.protocolKeys;
revision?.opcode;
packet?.server;
// @ts-expect-error Предметная карточка не принадлежит языку.
packet?.locale;
// @ts-expect-error Текст принадлежит переводу редакции.
packet?.description;
// @ts-expect-error Протокол использует variant, а не технический rev знания.
database.get({ collection: 'protocols', key: 'protocol:152' })?.rev;
database.get({ collection: 'protocols', key: 'protocol:152' })?.variant;
// @ts-expect-error Опкод принадлежит только технической редакции пакета.
packet?.opcode;
// @ts-expect-error Источники встроены в переводы, отдельной коллекции нет.
database.list({ collection: 'sources' });
database.update({
  target: { collection: 'packets', kind: 'entity', key: 'packet:example' },
  patch: { name: 'ExamplePacket' },
});
database.update({
  target: { collection: 'protocols', kind: 'entity', key: 'protocol:152' },
  // @ts-expect-error Составляющие адреса неизменяемы обычным update.
  patch: { variant: 1 },
});
database.update({
  target: {
    collection: 'packet-revisions',
    kind: 'implementation',
    key: 'packet:example:rev-1',
  },
  // @ts-expect-error Владелец редакции неизменяем.
  patch: { packetKey: 'packet:other' },
});
// @ts-expect-error Для редакции используется getRevision.
database.get({ collection: 'packet-revisions', key: 'packet:example:rev-1' });
// @ts-expect-error Язык не является адресом общей записи.
database.get({ collection: 'packets', key: 'packet:example', locale: 'ru' });
