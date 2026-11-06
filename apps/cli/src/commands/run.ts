import * as z from 'zod'
import {
  DatabaseError,
  databaseStatus,
  defaultDatabasePath,
  openDatabase,
  importDatabase,
  exportDatabase,
  validateSnapshot,
  snapshotRevision,
  entitySchemas,
  revisionSchemas
} from '@l2ce/database'
import type { DatabaseSnapshot, DatabaseOperation } from '@l2ce/database'
import { ReferenceReader, referenceKey } from '@l2ce/core/reference'
import { cliMessages as messages } from '../locales/ru.js'
import { commandAddress, groupCollections, groupKinds, revisionCollection } from './addresses.js'
import { prepareWrite, prepareBatch } from './write.js'
import type { CliArguments } from '../input/arguments.types.js'
import type { WriteChangeSummary } from './write.types.js'

/**
 * Показывает человеку затрагиваемые читаемые ключи и названия полей без длинных тел документов.
 */
function changeSummary(operations: readonly DatabaseOperation[]): readonly WriteChangeSummary[] {
  return operations.map((operation) => ({
    action: operation.op,
    key: 'entry' in operation ? operation.entry.key : operation.target.key,
    fields: operation.op === 'update' ? Object.keys(operation.patch) : []
  }))
}

/**
 * Читает несколько общих записей или редакций из одного снимка; отсутствие явно отмечается.
 */
function inspect(args: CliArguments, snapshot: DatabaseSnapshot): object {
  if (!args.group || args.operands.length < 1 || args.operands.length > 50) {
    throw new DatabaseError('USAGE', messages.emptyKeys)
  }
  const group = args.group
  return {
    revision: snapshotRevision(snapshot),
    items: args.operands.map((key) => {
      const target = commandAddress(group, key, args.rev)
      const entry = snapshot.entries.find((value) => value.collection === target.collection && value.key === target.key)
      return { key: target.key, found: !!entry, value: entry?.value ?? null }
    })
  }
}

/**
 * Выполняет продуктовые чтения по одному согласованному снимку общей базы.
 */
function readCommand(args: CliArguments, snapshot: DatabaseSnapshot): unknown {
  const reader = new ReferenceReader(snapshot)
  const page = { locale: args.locale, limit: args.limit, offset: args.offset }
  if (args.command === 'inspect') {
    return inspect(args, snapshot)
  }
  if (args.command === 'revisions' && args.group) {
    const owner = commandAddress(args.group, args.operands[0]).key
    if (!snapshot.entries.some((entry) => entry.kind === 'entity' && entry.key === owner)) {
      throw new DatabaseError('NOT_FOUND', messages.noRecord, { key: owner })
    }
    return {
      revision: reader.revision,
      items: snapshot.entries
        .filter((entry) => entry.kind === 'implementation' && entry.key.startsWith(`${owner}:rev-`))
        .map((entry) => ({
          key: entry.key,
          ...('rev' in entry.value
            ? {
                rev: entry.value.rev,
                status: entry.value.status,
                protocolKeys: entry.value.protocolKeys,
                locales: entry.value.translations.map((text) => text.locale)
              }
            : {})
        }))
    }
  }
  if (
    args.command === 'search' ||
    (args.command === 'list' &&
      args.protocol &&
      args.group &&
      ['packets', 'scenarios', 'articles'].includes(args.group))
  ) {
    if (!args.protocol) {
      throw new DatabaseError('USAGE', messages.requireProtocol)
    }
    return reader.knowledge({
      ...page,
      protocol: args.protocol,
      query: args.query,
      kind: args.group ? z.enum(['packet', 'scenario', 'article']).parse(groupKinds[args.group]) : args.kind,
      server: args.server,
      direction: args.direction,
      status: args.status
    })
  }
  if (
    args.command === 'read' ||
    (args.command === 'get' && args.group && ['packets', 'scenarios', 'articles'].includes(args.group))
  ) {
    if (!args.protocol) {
      throw new DatabaseError('USAGE', messages.requireProtocol)
    }
    return reader.read({
      protocol: args.protocol,
      locale: args.locale,
      keys: args.operands.map((key) => (args.group ? referenceKey(groupKinds[args.group], key) : key))
    })
  }
  if (args.group === 'protocols') {
    if (args.command === 'list') {
      return reader.protocols({
        ...page,
        query: args.query,
        number: args.number,
        branch: args.branch,
        saga: args.saga,
        chronicle: args.chronicle,
        release: args.release,
        region: args.region
      })
    }
    if (args.operands.length > 50) {
      throw new DatabaseError('USAGE', messages.emptyKeys)
    }
    return {
      revision: reader.revision,
      items: args.operands.map((key) => reader.protocol(key, args.locale))
    }
  }
  if (args.command === 'get' && args.group) {
    const group = args.group
    if (args.operands.length > 50) {
      throw new DatabaseError('USAGE', messages.emptyKeys)
    }
    return {
      revision: reader.revision,
      items: args.operands.map((key) => reader.catalogRecord(commandAddress(group, key).key, args.locale))
    }
  }
  if (
    args.group &&
    ['branches', 'sagas', 'chronicles', 'releases', 'contexts', 'regions', 'countries'].includes(args.group)
  ) {
    return reader.catalog({
      ...page,
      collection: z
        .enum(['branches', 'sagas', 'chronicles', 'releases', 'release-contexts', 'regions', 'countries'])
        .parse(groupCollections[args.group]),
      branch: args.branch,
      saga: args.saga,
      chronicle: args.chronicle,
      query: args.query,
      release: args.release,
      region: args.region
    })
  }
  if (args.group) {
    const group = args.group
    const items = snapshot.entries
      .filter((entry) => entry.collection === groupCollections[group])
      .filter(
        (entry) =>
          !args.server ||
          ('server' in entry.value
            ? entry.value.server === args.server
            : 'servers' in entry.value && entry.value.servers.includes(args.server))
      )
      .filter((entry) => !args.direction || ('direction' in entry.value && entry.value.direction === args.direction))
      .filter(
        (entry) =>
          !args.query ||
          JSON.stringify(entry.value)
            .normalize('NFKC')
            .toLowerCase()
            .includes(args.query.normalize('NFKC').toLowerCase())
      )
    return {
      revision: reader.revision,
      total: items.length,
      items: items.slice(args.offset, args.offset + args.limit).map((entry) => entry.value),
      nextOffset: args.offset + args.limit < items.length ? args.offset + args.limit : null
    }
  }
  throw new DatabaseError('USAGE', messages.invalidArguments)
}

/**
 * Выполняет команду; запись защищена ревизией исходного чтения и завершается явным отчётом.
 */
export async function runCommand(args: CliArguments): Promise<unknown> {
  const path = args.database ?? defaultDatabasePath
  if (args.command === 'schema' && args.group) {
    const schema =
      args.rev === undefined
        ? entitySchemas[groupCollections[args.group]]
        : revisionSchemas[revisionCollection(args.group)]
    const generatedFields = ['id', 'key']
    if (args.rev !== undefined) {
      generatedFields.push('rev', `${groupKinds[args.group]}Key`)
    } else if (args.group === 'protocols') {
      generatedFields.push('number', 'variant')
    } else if (args.group === 'contexts') {
      generatedFields.push('code', 'releaseKey')
    } else {
      generatedFields.push('code')
    }
    return {
      generatedFields,
      generatedSourceFields: ['translations[].source[].id'],
      schema: z.toJSONSchema(schema, { io: 'input' })
    }
  }
  if (args.command === 'import') {
    return importDatabase({ database: path, input: args.input })
  }
  if (args.command === 'export') {
    return exportDatabase({ database: path, output: args.output })
  }
  const status = databaseStatus({ database: path })
  if (args.command === 'status' && (!status.exists || status.schema !== 'current' || !status.manifest)) {
    return status
  }
  if (!status.exists && args.command !== 'init') {
    throw new DatabaseError('DATABASE_NOT_FOUND', messages.missingDatabase, {
      database: path
    })
  }
  const writing = [
    'create',
    'update',
    'delete',
    'add-revision',
    'update-revision',
    'translate',
    'batch',
    'init'
  ].includes(args.command)
  const database = openDatabase({ database: path, readOnly: !writing })
  try {
    if (args.command === 'init') {
      if (database.manifest()) {
        throw new DatabaseError('ALREADY_EXISTS', messages.alreadyInitialized)
      }
      database.replaceSnapshot({
        schemaVersion: 21,
        dataVersion: '1.0.0',
        defaultLocale: 'ru',
        locales: ['ru', 'en'],
        entries: []
      })
      return {
        action: 'init',
        database: path,
        manifest: database.manifest(),
        revision: database.revision()
      }
    }
    const snapshot = database.snapshot()
    if (args.locale && !snapshot.locales.includes(args.locale)) {
      throw new DatabaseError('INVALID_QUERY', messages.unknownLocale, {
        locale: args.locale
      })
    }
    const previousRevision = snapshotRevision(snapshot)
    if (args.command === 'status') {
      return { ...status, revision: previousRevision }
    }
    if (args.command === 'validate') {
      validateSnapshot(snapshot)
      return {
        valid: true,
        revision: previousRevision,
        records: snapshot.entries.length
      }
    }
    if (writing) {
      const batch =
        args.command === 'batch'
          ? await prepareBatch(args)
          : {
              operations: [await prepareWrite(args, snapshot)],
              ifRevision: args.ifRevision
            }
      const result = database.applyChanges(batch.operations, {
        ifRevision: batch.ifRevision ?? previousRevision,
        dryRun: args.dryRun
      })
      return {
        action: args.command,
        dryRun: args.dryRun,
        ...result,
        previousRevision,
        changes: changeSummary(batch.operations)
      }
    }
    return readCommand(args, snapshot)
  } finally {
    database.close()
  }
}
