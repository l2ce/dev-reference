import { validateSnapshot } from '../dist/index.js';

const collections = {
  'packet-implementations': 'packet-revisions',
  'scenario-implementations': 'scenario-revisions',
  'article-implementations': 'article-revisions',
};

/**
 * Назначает новые адреса из предметных полей без изменения UUID и источников.
 * Коды неоднозначных старых выпусков можно задать явно по адресу locale/key.
 */
function addresses(snapshot, releaseCodes) {
  const result = new Map();
  const counters = new Map();
  const sorted = [...snapshot.entries].sort((a, b) =>
    `${a.locale}/${a.key}`.localeCompare(`${b.locale}/${b.key}`, 'en'),
  );
  for (const entry of sorted) {
    const address = `${entry.locale}/${entry.key}`;
    if (entry.key === 'system:settings') continue;
    if (entry.collection === 'protocols') {
      const group = `${entry.locale}/${entry.value.number}`;
      const rev = (counters.get(group) ?? 0) + 1;
      counters.set(group, rev);
      result.set(address, {
        key: `protocol:${entry.value.number}-rev-${rev}`,
        rev,
      });
    } else if (entry.collection === 'chronicle-releases') {
      const siblings = snapshot.entries.filter(
        (item) =>
          item.locale === entry.locale &&
          item.collection === entry.collection &&
          item.value.chronicleKey === entry.value.chronicleKey,
      );
      const code =
        releaseCodes[address] ??
        (siblings.length === 1 ? 'base' : `release-${entry.value.id}`);
      result.set(address, { key: `${entry.value.chronicleKey}:${code}`, code });
    } else if (entry.kind === 'implementation') {
      const owner =
        entry.value.packetKey ??
        entry.value.scenarioKey ??
        entry.value.articleKey;
      result.set(address, {
        key: `${owner}:rev-${entry.value.version}`,
        rev: entry.value.version,
      });
    } else {
      result.set(address, {
        key: entry.key,
        ...(entry.collection === 'system'
          ? {}
          : { code: entry.key.split(':')[1] }),
      });
    }
  }
  return result;
}

/**
 * Возвращает новый адрес ссылки в той же локали, отклоняя потерю владельца или цели.
 */
function target(index, locale, key) {
  if (key === null || key === undefined) return null;
  const value = index.get(`${locale}/${key}`);
  if (!value)
    throw new Error(`Missing conversion reference: ${locale}/${key}.`);
  return value.key;
}

/**
 * Переносит общие данные с нормализацией отсутствия полей; Markdown становится одним TEXT.
 */
function content(value) {
  return {
    id: value.id,
    locale: value.locale,
    title: value.title,
    summary: value.summary,
    description: value.description.join('\n'),
    source: structuredClone(value.source ?? []),
  };
}

/**
 * Конвертирует формат 17 в SQL-first формат 18 без угадывания официальных частей и регионов.
 * Сценарные источники объединяются с ревизией, статус выбирается консервативно.
 * UUID сохраняются; удаляется только прежняя системная настройка defaultVersion.
 */
export function convertSnapshotV17(snapshot, { releaseCodes = {} } = {}) {
  if (snapshot.schemaVersion !== 17)
    throw new Error('The input must use schemaVersion 17.');
  const index = addresses(snapshot, releaseCodes);
  const entries = snapshot.entries
    .filter((entry) => entry.key !== 'system:settings')
    .map((entry) => {
      const old = entry.value;
      const identity = index.get(`${entry.locale}/${entry.key}`);
      const value = { ...content(old), ...identity };
      const collection = collections[entry.collection] ?? entry.collection;
      const kind =
        entry.collection === 'chronicle-releases' ? 'entity' : entry.kind;
      if (entry.collection === 'system') {
        value.kind = 'catalog';
      } else if (entry.collection === 'protocols') {
        Object.assign(value, {
          number: old.number,
          regions: old.regions,
          loginRevisions: old.loginRevisions,
          status: old.source.length ? 'partial' : 'missing',
        });
      } else if (entry.collection === 'chronicle-releases') {
        if (
          old.previousImplementationKey ||
          old.requires?.length ||
          old.changes?.length
        ) {
          throw new Error(
            `Resolve release-specific revision metadata before conversion: ${entry.locale}/${entry.key}.`,
          );
        }
        Object.assign(value, {
          chronicleKey: target(index, entry.locale, old.chronicleKey),
          protocolKeys: old.protocolKeys.map((key) =>
            target(index, entry.locale, key),
          ),
          status: old.status,
          translationStatus: old.translationStatus,
          openQuestions: old.openQuestions,
        });
      } else if (entry.kind === 'implementation') {
        for (const field of ['packetKey', 'scenarioKey', 'articleKey']) {
          if (field in old)
            value[field] = target(index, entry.locale, old[field]);
        }
        Object.assign(value, {
          status: old.status,
          translationStatus: old.translationStatus,
          openQuestions: old.openQuestions,
          previousRevisionKey: target(
            index,
            entry.locale,
            old.previousImplementationKey,
          ),
          changes: old.changes,
          requires: (old.requires ?? []).map((reference) => ({
            ...reference,
            key: target(index, entry.locale, reference.key),
          })),
        });
        if (entry.collection === 'scenario-implementations') {
          value.protocolKeys = old.bindings.flatMap((binding) =>
            binding.protocolKeys.map((key) => target(index, entry.locale, key)),
          );
          value.source.push(
            ...structuredClone(
              old.bindings.flatMap((binding) => binding.source),
            ),
          );
          const statuses = [
            old.status,
            ...old.bindings.map((binding) => binding.status),
          ];
          value.status = ['missing', 'partial', 'documented'].find((status) =>
            statuses.includes(status),
          );
        } else {
          value.protocolKeys = old.protocolKeys.map((key) =>
            target(index, entry.locale, key),
          );
        }
        if (entry.collection === 'packet-implementations') {
          value.opcode =
            old.opcode?.map((part) => ({
              ...part,
              value: Number(part.value),
            })) ?? null;
          value.states = old.states ?? [];
        }
      } else {
        value.order = old.order ?? null;
        if (entry.collection === 'chronicles')
          value.branchKey = target(index, entry.locale, old.branchKey);
        if (['packets', 'scenarios', 'articles'].includes(entry.collection))
          value.parentKey = target(index, entry.locale, old.parentKey);
        if (entry.collection === 'packets')
          Object.assign(value, {
            name: old.name,
            server: old.server,
            direction: old.direction,
          });
        if (entry.collection === 'scenarios' || entry.collection === 'articles')
          value.servers = old.servers;
        if (entry.collection === 'articles') {
          value.scope = old.scope;
          const settings = snapshot.entries.find(
            (item) =>
              item.locale === entry.locale && item.key === 'system:settings',
          );
          const selected = snapshot.entries.find(
            (item) =>
              item.locale === entry.locale &&
              item.collection === 'article-implementations' &&
              item.value.articleKey === entry.key &&
              item.value.version === settings?.value.defaultVersion,
          );
          value.defaultRevisionKey =
            old.scope === 'general' && selected
              ? target(index, entry.locale, selected.key)
              : null;
        }
      }
      return { locale: entry.locale, collection, kind, key: value.key, value };
    });
  return validateSnapshot({ ...snapshot, schemaVersion: 18, entries });
}
