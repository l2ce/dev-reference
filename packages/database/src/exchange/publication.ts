import { randomUUID } from 'node:crypto'
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { DatabaseError, hasErrorCode } from '../errors.js'
import { orderDatabaseJson } from './serializer.js'
import { inspectDirectory } from './directory.js'
import { inspectTableDirectory, isTableDirectory } from './table-directory.js'
import { tableFileAddress, validateTableFileNames } from './table-codec.js'
import { exchangeMessages as messages } from './messages.js'
import type { TableSnapshot } from './table.types.js'
import type { ProgressReporter } from './exchange.types.js'

/**
 * Проверяет существующее назначение: пустой каталог либо ранее созданный экспорт.
 */
async function destinationExists(path: string): Promise<boolean> {
  try {
    const stat = await lstat(path)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new DatabaseError('INVALID_DESTINATION', messages.destination, {
        path
      })
    }
    if ((await readdir(path)).length > 0) {
      if (await isTableDirectory(path)) {
        await inspectTableDirectory(path)
      } else {
        await inspectDirectory(path)
      }
    }
    return true
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return false
    }
    throw error
  }
}

/**
 * Создаёт весь JSON-снимок во временном каталоге, сохраняя порядок массивов и строки.
 */
async function writeStaging(stage: string, snapshot: TableSnapshot, progress: ProgressReporter): Promise<void> {
  await writeFile(join(stage, 'manifest.json'), JSON.stringify(orderDatabaseJson(snapshot.manifest), null, 2) + '\n')
  for (const table of snapshot.manifest.tables) {
    await mkdir(join(stage, table.name))
    for (const row of snapshot.rows.get(table.name) ?? []) {
      const file = tableFileAddress(table, row)
      progress.startRecord('write', file)
      await writeFile(join(stage, file.path), JSON.stringify(row, null, 2) + '\n', { flag: 'wx' })
      progress.finishRecord()
    }
  }
}

/**
 * Устанавливает готовый каталог, восстанавливая предыдущий при обычной ошибке rename.
 * При аварийном завершении между rename предыдущие данные остаются в backup.
 */
async function replaceDirectory(stage: string, output: string, existed: boolean): Promise<void> {
  const backup = join(dirname(output), `.${basename(output)}.backup-${randomUUID()}`)
  if (existed) {
    await rename(output, backup)
  }
  try {
    await rename(stage, output)
  } catch (error) {
    if (existed) {
      try {
        await rename(backup, output)
      } catch (recoveryError) {
        throw new DatabaseError(
          'EXPORT_RECOVERY_REQUIRED',
          messages.recovery,
          { output, backup },
          new AggregateError([error, recoveryError])
        )
      }
    }
    throw new DatabaseError('EXPORT_PUBLICATION_FAILED', messages.publication, { output }, error)
  }
  if (existed) {
    try {
      await rm(backup, { recursive: true })
    } catch (error) {
      throw new DatabaseError('EXPORT_CLEANUP_FAILED', messages.cleanup, { output, backup, committed: true }, error)
    }
  }
}

/**
 * Публикует полный экспорт под эксклюзивной файловой блокировкой назначения.
 * SQLite-файл внутри назначения запрещён; неполный staging не подменяет старые данные.
 * Проверка вложенности учитывает разделитель путей текущей платформы.
 * Коллизии коротких имён проверяются до создания каталога, блокировки и staging-файлов.
 */
export async function publishDirectory(
  output: string,
  database: string,
  snapshot: TableSnapshot,
  progress: ProgressReporter
): Promise<void> {
  validateTableFileNames(snapshot)
  await mkdir(dirname(output), { recursive: true })
  const canonicalOutput = join(await realpath(dirname(output)), basename(output))
  const databaseRelative = relative(canonicalOutput, await realpath(database))
  if (
    databaseRelative === '' ||
    (!databaseRelative.startsWith('..' + sep) && databaseRelative !== '..' && !isAbsolute(databaseRelative))
  ) {
    throw new DatabaseError('INVALID_DESTINATION', messages.databaseInsideOutput, { output })
  }
  const lockPath = `${canonicalOutput}.export.lock`
  const lock = await open(lockPath, 'wx').catch((error: unknown) => {
    if (hasErrorCode(error, 'EEXIST')) {
      throw new DatabaseError('EXPORT_BUSY', messages.locked, { path: lockPath }, error)
    }
    throw error
  })
  let stage: string | undefined
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, output: resolve(output) }))
    const existed = await destinationExists(output)
    stage = await mkdtemp(join(dirname(output), `.${basename(output)}.export-`))
    await writeStaging(stage, snapshot, progress)
    const total = snapshot.manifest.tables.reduce((sum, table) => sum + table.rows, 0)
    progress.stage('commit', total, total)
    await replaceDirectory(stage, output, existed)
    stage = undefined
  } finally {
    try {
      if (stage) {
        await rm(stage, { recursive: true, force: true })
      }
    } finally {
      await lock.close()
      await rm(lockPath)
    }
  }
}
