import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Записывает тестовый снимок в историческую раскладку независимо от текущего экспортёра.
 */
export async function writeLegacySnapshot(
  directory,
  snapshot,
  layout = 'separate',
) {
  await mkdir(directory, { recursive: true });
  const { entries, ...manifest } = snapshot;
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
  for (const entry of entries) {
    let relative;
    if (entry.collection === 'system') {
      relative = `${entry.locale}/system/${entry.value.kind}.json`;
    } else if (entry.kind === 'entity') {
      const slug = entry.value.slug;
      relative =
        layout === 'separate'
          ? `${entry.locale}/${entry.collection}/${slug}.json`
          : `${entry.locale}/${entry.collection}/${slug}/${slug}.json`;
    } else {
      const ownerKey =
        entry.value.packetKey ??
        entry.value.scenarioKey ??
        entry.value.articleKey ??
        entry.value.chronicleKey;
      const owner = entries.find(
        (item) => item.locale === entry.locale && item.key === ownerKey,
      );
      const slug = owner.value.slug;
      relative = `${entry.locale}/${entry.collection}/${slug}/${slug}.v${entry.value.version}.json`;
    }
    const path = join(directory, relative);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(entry.value));
  }
}

/**
 * Формирует настоящий снимок формата 17 из однозначных тестовых записей текущей модели.
 * Используется только регрессионными тестами конвертеров, не прикладным импортом.
 */
export function asV17(snapshot) {
  const keyMap = new Map();
  const versions = new Map();
  const releases = snapshot.entries.filter(
    (entry) => entry.collection === 'chronicle-releases',
  );
  for (const entry of snapshot.entries) {
    let key = entry.key;
    if (entry.collection === 'protocols') {
      key = `protocol:${entry.value.number}${entry.value.rev === 1 ? '' : `-rev-${entry.value.rev - 1}`}`;
    } else if (entry.collection === 'chronicle-releases') {
      const siblings = releases.filter(
        (item) =>
          item.locale === entry.locale &&
          item.value.chronicleKey === entry.value.chronicleKey,
      );
      const version = siblings.indexOf(entry) + 1;
      versions.set(entry.value.id, version);
      key = `${entry.value.chronicleKey}:v${version}`;
    } else if (entry.kind === 'implementation') {
      key = entry.key.replace(/:rev-(\d+)$/, ':v$1');
    }
    keyMap.set(`${entry.locale}/${entry.key}`, key);
  }
  const entries = snapshot.entries.map((entry) => {
    const { code, rev, previousRevisionKey, defaultRevisionKey, ...rest } =
      structuredClone(entry.value);
    const value = {
      ...rest,
      key: keyMap.get(`${entry.locale}/${entry.key}`),
      description: rest.description ? rest.description.split('\n') : [],
    };
    if (value.order === null) delete value.order;
    if ('protocolKeys' in value)
      value.protocolKeys = value.protocolKeys.map((key) =>
        keyMap.get(`${entry.locale}/${key}`),
      );
    let collection = entry.collection;
    let kind = entry.kind;
    if (entry.collection === 'chronicle-releases') {
      value.version = versions.get(value.id);
      kind = 'implementation';
    } else if (entry.kind === 'implementation') {
      collection = collection.replace('-revisions', '-implementations');
      value.version = rev;
      value.previousImplementationKey = previousRevisionKey
        ? keyMap.get(`${entry.locale}/${previousRevisionKey}`)
        : null;
      if (entry.collection === 'packet-revisions')
        value.opcode =
          value.opcode?.map((part) => ({
            ...part,
            value: `0x${part.value.toString(16)}`,
          })) ?? null;
      if (entry.collection === 'scenario-revisions') {
        value.bindings = [
          {
            id: randomUUID(),
            protocolKeys: value.protocolKeys,
            status: value.status,
            source: [],
          },
        ];
        delete value.protocolKeys;
      }
    } else if (entry.collection === 'protocols') {
      value.slug = value.key.slice('protocol:'.length);
      delete value.status;
      delete value.translationStatus;
      delete value.openQuestions;
    } else if (entry.collection !== 'system') {
      value.slug = code;
    }
    return { ...entry, collection, kind, key: value.key, value };
  });
  for (const locale of snapshot.locales) {
    entries.push({
      locale,
      collection: 'system',
      kind: 'entity',
      key: 'system:settings',
      value: {
        id: randomUUID(),
        key: 'system:settings',
        locale,
        kind: 'settings',
        defaultVersion: 1,
        title: 'Fixture settings',
        summary: 'Fixture',
        description: [],
        source: [],
      },
    });
  }
  return { ...snapshot, schemaVersion: 17, entries };
}

/**
 * Восстанавливает прежнюю иерархию для проверки конвертеров 14/15 на однозначных моках.
 */
export function withLegacyHierarchy(snapshot) {
  const legacy = asV17(snapshot);
  const releases = legacy.entries.filter(
    (entry) => entry.collection === 'chronicle-releases',
  );
  return {
    ...legacy,
    entries: legacy.entries
      .filter(
        (entry) =>
          !['branches', 'chronicle-releases'].includes(entry.collection),
      )
      .map((entry) => {
        if (entry.collection === 'chronicles') {
          const { branchKey, ...value } = entry.value;
          return { ...entry, value: { ...value, stages: [] } };
        }
        if (entry.collection !== 'protocols') return entry;
        const related = releases.filter(
          (release) =>
            release.locale === entry.locale &&
            release.value.protocolKeys.includes(entry.key),
        );
        if (related.length !== 1 || entry.value.regions.length > 1)
          throw new Error(
            'Legacy fixture requires one release and at most one region.',
          );
        const chronicleKey = related[0].value.chronicleKey;
        const chronicle = legacy.entries.find(
          (item) => item.locale === entry.locale && item.key === chronicleKey,
        );
        const branch = legacy.entries.find(
          (item) =>
            item.locale === entry.locale &&
            item.key === chronicle.value.branchKey,
        );
        const { regions, ...value } = entry.value;
        return {
          ...entry,
          value: {
            ...value,
            chronicleKey,
            stageKey: null,
            family: branch.value.slug,
            variant: null,
            region: regions[0] ?? null,
          },
        };
      }),
  };
}
