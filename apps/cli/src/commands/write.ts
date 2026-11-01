import { randomUUID } from 'node:crypto';
import * as z from 'zod';
import {
  DatabaseError,
  parseEntry,
  addressSchema,
  sourceSchema,
  translationSchema,
  idSchema,
  collectionSchema,
  keySchema,
} from '@l2ce/database';
import type {
  DatabaseOperation,
  DatabaseSnapshot,
  RecordAddress,
  Translation,
} from '@l2ce/database';
import { referenceKey, protocolReferenceSchema } from '@l2ce/core/reference';
import { readInputJson, readInputText } from '../input/json.js';
import { cliMessages as messages } from '../locales/ru.js';
import { commandAddress, groupKinds } from './addresses.js';
import type { CliArguments } from '../input/arguments.types.js';
import type { PreparedBatch } from './write.types.js';

const sourceInput = sourceSchema.extend({ id: idSchema.default(randomUUID) });
const translationInput = translationSchema.extend({
  source: z.array(sourceInput).default([]),
});
const objectInput = z.record(z.string(), z.unknown());

/**
 * Проверяет системные поля входа, чтобы флаги маршрута не скрывали несовпадение идентичности.
 */
function withIdentity(
  input: Readonly<Record<string, unknown>>,
  identity: Readonly<Record<string, string | number>>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(identity)) {
    if (key in input && input[key] !== value) {
      throw new DatabaseError('INVALID_INPUT', messages.identityMismatch, {
        field: key,
        expected: value,
      });
    }
  }
  return { ...input, ...identity };
}

/**
 * Нормализует читаемые ссылки и источники на внешней границе записи.
 */
function normalizePayload(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result = { ...input };
  for (const [field, kind] of [
    ['branchKey', 'branch'],
    ['chronicleKey', 'chronicle'],
    ['packetKey', 'packet'],
    ['scenarioKey', 'scenario'],
    ['articleKey', 'article'],
  ]) {
    if (field in result) {
      result[field] = referenceKey(kind, z.string().parse(result[field]));
    }
  }
  if ('protocolKeys' in result) {
    result.protocolKeys = z
      .array(protocolReferenceSchema)
      .parse(result.protocolKeys)
      .map((key) => referenceKey('protocol', key));
  }
  if ('translations' in result) {
    result.translations = z.array(translationInput).parse(result.translations);
  }
  return result;
}

/**
 * Обновляет один перевод, сохраняя остальные языки и их источники.
 */
async function updateTranslation(
  args: CliArguments,
  snapshot: DatabaseSnapshot,
  target: RecordAddress,
  input: Readonly<Record<string, unknown>>,
  direct: boolean,
): Promise<readonly Translation[]> {
  const existing = snapshot.entries.find((entry) => entry.key === target.key);
  const base =
    existing && 'translations' in existing.value
      ? existing.value.translations
      : [];
  const translations =
    'translations' in input
      ? z.array(translationInput).parse(input.translations)
      : [...base];
  const locale = args.locale ?? snapshot.defaultLocale;
  const previous = translations.find(
    (translation) => translation.locale === locale,
  );
  const fields = direct ? input : {};
  if ('locale' in fields && fields.locale !== locale) {
    throw new DatabaseError('INVALID_INPUT', messages.identityMismatch, {
      field: 'locale',
    });
  }
  const description = args.markdown
    ? await readInputText(args.markdown)
    : undefined;
  const translation = translationInput.parse({
    title: target.key,
    summary: '',
    description: '',
    ...previous,
    ...fields,
    locale,
    ...(args.title !== undefined ? { title: args.title } : {}),
    ...(args.summary !== undefined ? { summary: args.summary } : {}),
    ...(description !== undefined ? { description } : {}),
  });
  return [
    ...translations.filter((value) => value.locale !== locale),
    translation,
  ];
}

/**
 * Создаёт одну типизированную операцию из команды; UUID назначаются только новым записям.
 */
export async function prepareWrite(
  args: CliArguments,
  snapshot: DatabaseSnapshot,
): Promise<DatabaseOperation> {
  if (!args.group) {
    throw new DatabaseError('USAGE', messages.invalidGroup);
  }
  let value = args.operands[0];
  if (args.group === 'releases' && args.chronicle && !value.includes(':')) {
    value = `${args.chronicle.replace(/^chronicle:/, '')}:${value}`;
  }
  const target = commandAddress(args.group, value, args.rev);
  if (args.command === 'delete') {
    return { op: 'delete', target };
  }
  const input = args.file
    ? objectInput.parse(await readInputJson(args.file))
    : {};
  if (args.command === 'translate') {
    const translations = await updateTranslation(
      args,
      snapshot,
      target,
      input,
      true,
    );
    // parseEntry внутри транзакции проверяет соответствие patch конкретной коллекции.
    return {
      op: 'update',
      target,
      patch: { translations },
    } as DatabaseOperation;
  }
  let payload = normalizePayload(input);
  if (args.protocols !== undefined) {
    payload.protocolKeys = args.protocols
      .split(',')
      .map((key) =>
        referenceKey('protocol', protocolReferenceSchema.parse(key.trim())),
      );
  }
  if (args.branch !== undefined) {
    payload.branchKey = referenceKey('branch', args.branch);
  }
  if (args.chronicle !== undefined) {
    payload.chronicleKey = referenceKey('chronicle', args.chronicle);
  }
  for (const field of ['name', 'server', 'direction', 'status'] as const) {
    if (args[field] !== undefined) {
      payload[field] = args[field];
    }
  }
  if (
    args.title !== undefined ||
    args.summary !== undefined ||
    args.markdown !== undefined
  ) {
    payload.translations = await updateTranslation(
      args,
      snapshot,
      target,
      payload,
      false,
    );
  }
  if (args.command === 'update' || args.command === 'update-revision') {
    // Динамический patch проверяется схемой конечной записи в API базы.
    return { op: 'update', target, patch: payload } as DatabaseOperation;
  }
  if (target.kind === 'implementation') {
    payload = withIdentity(payload, {
      key: target.key,
      rev: args.rev ?? 1,
      [`${groupKinds[args.group]}Key`]: commandAddress(args.group, value).key,
    });
  } else if (args.group === 'protocols') {
    const [number, variant] = target.key
      .slice('protocol:'.length)
      .split('-rev-');
    payload = withIdentity(payload, {
      key: target.key,
      number: Number(number),
      variant: Number(variant ?? 0),
    });
  } else if (args.group === 'releases') {
    const parts = target.key.split(':');
    if (parts.length !== 3) {
      throw new DatabaseError('USAGE', messages.identityMismatch);
    }
    payload = withIdentity(payload, {
      key: target.key,
      code: parts[2],
      chronicleKey: `${parts[0]}:${parts[1]}`,
    });
  } else {
    payload = withIdentity(payload, {
      key: target.key,
      code: target.key.split(':')[1],
    });
  }
  return {
    op: 'create',
    entry: parseEntry({ ...target, value: { id: randomUUID(), ...payload } }),
  };
}

const batchSchema = z.strictObject({
  ifRevision: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  operations: z.array(
    z.discriminatedUnion('op', [
      z.strictObject({
        op: z.enum(['create', 'put']),
        entry: z.strictObject({
          collection: collectionSchema,
          key: keySchema,
          kind: z.enum(['entity', 'implementation']),
          value: z.unknown(),
        }),
      }),
      z.strictObject({ op: z.literal('delete'), target: addressSchema }),
      z.strictObject({
        op: z.literal('update'),
        target: addressSchema,
        patch: objectInput,
      }),
    ]),
  ),
});

/**
 * Проверяет агентский пакет; новые UUID и UUID источников можно опустить в create.
 */
export async function prepareBatch(args: CliArguments): Promise<PreparedBatch> {
  const raw = batchSchema.parse(await readInputJson(args.file));
  if (raw.ifRevision && args.ifRevision) {
    throw new DatabaseError('USAGE', messages.duplicateRevision);
  }
  const operations: DatabaseOperation[] = raw.operations.map((operation) => {
    if (operation.op === 'create' || operation.op === 'put') {
      const payload = normalizePayload(
        objectInput.parse(operation.entry.value),
      );
      return {
        op: operation.op,
        entry: parseEntry({
          ...operation.entry,
          value: {
            ...(operation.op === 'create' ? { id: randomUUID() } : {}),
            ...payload,
          },
        }),
      };
    }
    if (operation.op === 'delete') {
      return { op: 'delete', target: addressSchema.parse(operation.target) };
    }
    if (operation.op === 'update') {
      // Конкретная схема patch проверяется по найденному владельцу внутри транзакции.
      return {
        op: 'update',
        target: addressSchema.parse(operation.target),
        patch: normalizePayload(objectInput.parse(operation.patch)),
      } as DatabaseOperation;
    }
    throw new DatabaseError('INVALID_OPERATION', messages.invalidArguments);
  });
  return {
    operations,
    ifRevision:
      raw.ifRevision === undefined
        ? args.ifRevision
        : z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(raw.ifRevision),
  };
}
