import { randomUUID } from 'node:crypto';
import { convertSnapshotV16 } from './format-v16.mjs';

/**
 * Создаёт независимые экземпляры источников для нового владельца, сохраняя содержание.
 */
function copySources(sources) {
  return sources.map((source) => ({ ...source, id: randomUUID() }));
}

/**
 * Формирует оболочку самостоятельного документа с явной локалью и ролью.
 */
function entry(collection, value, kind = 'entity') {
  return { locale: value.locale, collection, key: value.key, kind, value };
}

/**
 * Находит единственную установленную ветку хроники; неоднозначность требует ручного решения.
 */
function familyFor(chronicle, profiles) {
  const families = [
    ...new Set(profiles.map((profile) => profile.value.family)),
  ];
  if (
    families.length !== 1 ||
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(families[0])
  ) {
    throw new Error(
      `Cannot determine one branch for ${chronicle.locale}/${chronicle.key}.`,
    );
  }
  return families[0];
}

/**
 * Создаёт имплементацию из установленного этапа либо недетализированного контекста хроники.
 * UUID и источники этапа переносятся; для новых документов и копий источников назначаются новые ID.
 */
function implementationFor(chronicle, stage, version, profiles) {
  const value = stage ?? chronicle.value;
  const source = [
    ...(stage ? (stage.source ?? []) : copySources(chronicle.value.source)),
    ...copySources(profiles.flatMap((profile) => profile.value.source)),
  ];
  return entry(
    'chronicle-implementations',
    {
      id: stage?.id ?? randomUUID(),
      key: `${chronicle.key}:v${version}`,
      locale: chronicle.locale,
      version,
      chronicleKey: chronicle.key,
      title: value.title,
      summary: value.summary,
      description: stage ? [...stage.description] : [],
      status: source.length ? 'partial' : 'missing',
      source,
      protocolKeys: profiles.map((profile) => profile.key),
    },
    'implementation',
  );
}

/**
 * Переводит формат 15 в 16: выделяет ветки и имплементации хроник, переносит связи профилей.
 * Два профиля с одинаковым number сохраняют свои UUID/key. Неизвестные регионы остаются пустыми.
 * Старая ветка определяется только из связанных профилей; отсутствующие сведения не угадываются.
 */
export function convertSnapshotV15(snapshot) {
  if (snapshot.schemaVersion !== 15) {
    throw new Error('The input must use schemaVersion 15.');
  }
  if (
    snapshot.entries.some((item) =>
      ['branches', 'chronicle-implementations'].includes(item.collection),
    )
  ) {
    throw new Error('Format 15 contains hierarchy from a newer format.');
  }
  const branches = new Map();
  const additions = [];
  const assigned = new Set();
  const entries = snapshot.entries.map((item) => {
    if (item.collection === 'protocols') {
      const { chronicleKey, stageKey, family, variant, region, ...value } =
        item.value;
      if (variant !== null) {
        throw new Error(
          `Resolve legacy variant before conversion: ${item.locale}/${item.key}.`,
        );
      }
      return {
        ...item,
        value: { ...value, regions: region === null ? [] : [region] },
      };
    }
    if (item.collection !== 'chronicles') {
      return structuredClone(item);
    }
    const profiles = snapshot.entries.filter(
      (candidate) =>
        candidate.collection === 'protocols' &&
        candidate.locale === item.locale &&
        candidate.value.chronicleKey === item.key,
    );
    const family = familyFor(item, profiles);
    const branchKey = `branch:${family}`;
    const address = `${item.locale}/${branchKey}`;
    if (!branches.has(address)) {
      branches.set(
        address,
        entry('branches', {
          id: randomUUID(),
          key: branchKey,
          locale: item.locale,
          slug: family,
          title: family === 'main' ? 'Main' : family,
          summary: family,
          description: [],
          source: [],
        }),
      );
    }
    const { stages, ...value } = item.value;
    const keys = new Set(stages.map((stage) => stage.key));
    if (
      keys.size !== stages.length ||
      profiles.some(
        (profile) =>
          profile.value.stageKey !== null && !keys.has(profile.value.stageKey),
      )
    ) {
      throw new Error(`Invalid legacy stages for ${item.locale}/${item.key}.`);
    }
    stages.forEach((stage, index) => {
      additions.push(
        implementationFor(
          item,
          stage,
          index + 1,
          profiles.filter((profile) => profile.value.stageKey === stage.key),
        ),
      );
    });
    const unresolved = profiles.filter(
      (profile) => profile.value.stageKey === null,
    );
    if (!stages.length || unresolved.length) {
      additions.push(
        implementationFor(item, null, stages.length + 1, unresolved),
      );
    }
    profiles.forEach((profile) =>
      assigned.add(`${profile.locale}/${profile.key}`),
    );
    return { ...item, value: { ...value, branchKey } };
  });
  for (const item of snapshot.entries) {
    if (
      item.collection === 'protocols' &&
      !assigned.has(`${item.locale}/${item.key}`)
    ) {
      throw new Error(
        `Missing legacy chronicle for ${item.locale}/${item.key}.`,
      );
    }
  }
  return convertSnapshotV16({
    ...snapshot,
    schemaVersion: 16,
    entries: [...branches.values(), ...entries, ...additions],
  });
}
