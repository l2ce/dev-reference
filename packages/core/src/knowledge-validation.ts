import {
  knowledgeSnapshotSchema,
  entityKey,
  entityServers,
  protocolRecordId,
  type KnowledgeSnapshot,
} from './knowledge-schema.js';
import { markdownDirectives } from './markdown.js';

/**
 * Проверяет предметный снимок рендерера и его связи без изменения входа.
 * Источники проверяются общей схемой базы; их summary является обычным текстом, без Markdown-директив.
 */
export function validateKnowledge(input: unknown): KnowledgeSnapshot {
  const data = knowledgeSnapshotSchema.parse(input);
  const unique = (values: string[], name: string) => {
    if (new Set(values).size !== values.length)
      throw new Error(`Duplicate ${name}`);
  };
  const requireValue = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };
  unique(data.locales, 'locale');
  requireValue(
    data.locales.includes(data.defaultLocale),
    'Default locale must be declared',
  );
  unique(
    data.sources.map((source) => source.id),
    'source',
  );
  unique(
    data.protocols.map((profile) => profile.id),
    'protocol ID',
  );
  unique(data.entities.map(entityKey), 'entity');
  unique(
    data.chronicles.map((chronicle) => chronicle.id),
    'chronicle',
  );
  unique(
    data.documents.map((document) => document.id),
    'document version',
  );
  unique(
    data.translations.map((translation) => translation.locale),
    'translation base',
  );
  requireValue(
    data.translations.length === data.locales.length &&
      data.translations.every((translation) =>
        data.locales.includes(translation.locale),
      ),
    'Translation bases must match declared locales',
  );
  const sources = new Set(data.sources.map((source) => source.id));
  const protocols = new Set(data.protocols.map((profile) => profile.id));
  const entities = new Map(
    data.entities.map((entity) => [entityKey(entity), entity]),
  );
  const documents = new Map(
    data.documents.map((document) => [document.id, document]),
  );
  const chronicles = new Map(
    data.chronicles.map((chronicle) => [chronicle.id, chronicle]),
  );
  const checkSources = (ids: string[], name: string) => {
    unique(ids, `source reference in ${name}`);
    for (const id of ids)
      requireValue(sources.has(id), `Unknown source ${id} in ${name}`);
  };
  const checkDocument = (id: string, key: string) => {
    const document = documents.get(id);
    requireValue(
      document && entityKey(document.entity) === key,
      `Invalid document binding ${id} for ${key}`,
    );
  };
  const checkDescription = (description: string[], owner: string) => {
    for (const directive of markdownDirectives(description.join('\n'))) {
      const target = entities.get(entityKey(directive));
      requireValue(
        target,
        `Unknown description reference ${entityKey(directive)} in ${owner}`,
      );
      if (target && directive.server)
        requireValue(
          entityServers(target).includes(directive.server),
          `Wrong reference server: ${entityKey(directive)}`,
        );
      if (directive.field === 'opcode' || directive.field === 'name')
        requireValue(
          target?.kind === 'packet',
          `${directive.field} is a packet field`,
        );
    }
  };
  for (const chronicle of data.chronicles) {
    unique(
      chronicle.stages.map((stage) => stage.id),
      `stage in ${chronicle.id}`,
    );
    checkSources(chronicle.sourceIds, chronicle.id);
    checkDescription(chronicle.description, chronicle.id);
    for (const stage of chronicle.stages)
      checkDescription(stage.description, `${chronicle.id}/${stage.id}`);
  }
  for (const profile of data.protocols) {
    requireValue(
      profile.id === protocolRecordId(profile),
      `Protocol ID must match number and variant: ${profile.id}`,
    );
    unique(
      profile.loginRevisions.map(String),
      `login revision in ${profile.id}`,
    );
    const chronicle = chronicles.get(profile.chronicle);
    requireValue(chronicle, `Unknown chronicle: ${profile.chronicle}`);
    if (profile.stage)
      requireValue(
        chronicle?.stages.some((stage) => stage.id === profile.stage),
        `Unknown stage: ${profile.chronicle}/${profile.stage}`,
      );
    checkSources(profile.sourceIds, profile.id);
    checkDescription(profile.description, profile.id);
  }
  for (const entity of data.entities) {
    const key = entityKey(entity);
    checkDescription(entity.description, key);
    unique(entityServers(entity), `server in ${key}`);
    if (entity.parentId)
      requireValue(
        entities.has(`${entity.kind}:${entity.parentId}`),
        `Unknown parent of ${key}`,
      );
    const visited = new Set<string>([entity.id]);
    let parent = entity.parentId;
    while (parent) {
      requireValue(!visited.has(parent), `Navigation cycle at ${key}`);
      visited.add(parent);
      parent = entities.get(`${entity.kind}:${parent}`)?.parentId ?? null;
    }
    if (entity.kind === 'article') {
      requireValue(
        entity.scope === 'general'
          ? entity.documentVersionId && entity.bindings.length === 0
          : !entity.documentVersionId,
        `Invalid article scope: ${key}`,
      );
      if (entity.documentVersionId)
        checkDocument(entity.documentVersionId, key);
    }
    const bound = new Set<string>();
    for (const binding of entity.bindings) {
      unique(binding.protocolIds, `protocol binding in ${key}`);
      for (const id of binding.protocolIds) {
        requireValue(protocols.has(id), `Unknown protocol ${id} in ${key}`);
        requireValue(!bound.has(id), `Overlapping bindings for ${key}/${id}`);
        bound.add(id);
      }
      checkDocument(binding.documentVersionId, key);
      checkSources(binding.sourceIds, key);
      if (binding.status !== 'missing')
        requireValue(
          binding.sourceIds.length,
          `Researched binding needs sources: ${key}`,
        );
      if ('opcode' in binding) {
        if (binding.status === 'documented')
          requireValue(
            binding.opcode,
            `Documented packet needs an opcode: ${key}`,
          );
        for (const part of binding.opcode ?? []) {
          const bits = { u8: 8, u16le: 16, u32le: 32 }[part.type];
          requireValue(
            BigInt(part.value) < 2n ** BigInt(bits),
            `Opcode exceeds ${part.type} in ${key}`,
          );
        }
        unique(binding.states, `state in ${key}`);
      }
    }
  }
  for (const document of data.documents) {
    checkDescription(document.description, document.id);
    requireValue(
      entities.has(entityKey(document.entity)),
      `Unknown document owner: ${document.id}`,
    );
    checkSources(document.sourceIds, document.id);
    if (document.status !== 'missing')
      requireValue(
        document.sourceIds.length,
        `Researched document needs sources: ${document.id}`,
      );
    if (document.status === 'documented')
      requireValue(
        document.description.join('\n').trim(),
        `Documented version needs content: ${document.id}`,
      );
    if (document.previousVersionId)
      checkDocument(document.previousVersionId, entityKey(document.entity));
    const previous = new Set<string>([document.id]);
    let id = document.previousVersionId;
    while (id) {
      requireValue(!previous.has(id), `Version cycle at ${document.id}`);
      previous.add(id);
      id = documents.get(id)?.previousVersionId ?? null;
    }
    for (const reference of document.requires) {
      const target = entities.get(entityKey(reference));
      requireValue(target, `Unknown dependency ${entityKey(reference)}`);
      if (target && reference.server)
        requireValue(
          entityServers(target).includes(reference.server),
          `Wrong dependency server: ${entityKey(reference)}`,
        );
    }
  }
  for (const translation of data.translations) {
    checkDescription(translation.description, translation.locale);
    if (translation.locale === data.defaultLocale)
      requireValue(
        translation.entities.length === 0 && translation.documents.length === 0,
        'Default locale content belongs in shared records',
      );
    unique(
      translation.entities.map(entityKey),
      `entity translation in ${translation.locale}`,
    );
    unique(
      translation.documents.map((document) => document.id),
      `document translation in ${translation.locale}`,
    );
    for (const entity of translation.entities) {
      requireValue(
        entity.kind === 'protocol'
          ? protocols.has(entity.id)
          : entity.kind === 'chronicle'
            ? chronicles.has(entity.id)
            : entities.has(entityKey(entity)),
        `Unknown translated entity: ${entityKey(entity)}`,
      );
      checkDescription(entity.description, entityKey(entity));
    }
    for (const document of translation.documents) {
      const version = documents.get(document.id);
      requireValue(version, `Unknown translated version: ${document.id}`);
      if (version?.status === 'documented')
        requireValue(
          document.description.join('\n').trim(),
          `Documented version needs content: ${version.id}`,
        );
      checkDescription(document.description, document.id);
    }
  }
  // A numeric selector is only unique within a profile, server, direction and state.
  for (const profile of data.protocols) {
    const selectors = new Map<string, { states: string[]; id: string }[]>();
    for (const entity of data.entities) {
      if (entity.kind !== 'packet') continue;
      const binding = entity.bindings.find((item) =>
        item.protocolIds.includes(profile.id),
      );
      if (!binding?.opcode) continue;
      const key = JSON.stringify([
        entity.server,
        entity.direction,
        binding.opcode.map((part) => [part.type, Number(part.value)]),
      ]);
      const previous = selectors.get(key) ?? [];
      requireValue(
        !previous.some(
          (item) =>
            !item.states.length ||
            !binding.states.length ||
            item.states.some((state) => binding.states.includes(state)),
        ),
        `Opcode collision in ${profile.id}: ${entity.id}`,
      );
      previous.push({ states: binding.states, id: entity.id });
      selectors.set(key, previous);
    }
  }
  return data;
}
