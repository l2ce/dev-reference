import { DatabaseError } from '../errors.js';
import { memoryConnection } from './connection.js';
import { prepareImportSchema } from './bootstrap.js';
import { validateStoredTables } from './table-validation.js';
import { identifier } from './sql-identifiers.js';
import { inspectTables } from './table-snapshot.js';
import { decodeSqlCell, tableFileAddress } from '../exchange/table-codec.js';
import { exchangeMessages as messages } from '../exchange/messages.js';
import type { Connection } from './sqlite.types.js';
import type { DatabaseSnapshot } from '../model/model.types.js';
import type { TableSnapshot } from '../exchange/table.types.js';
import type { ProgressReporter } from '../exchange/exchange.types.js';

/**
 * Сопоставляет динамический манифест с актуальной схемой; входной SQL не исполняется.
 */
function assertTableSchema(
  connection: Connection,
  snapshot: TableSnapshot,
): void {
  const expected = inspectTables(connection.client);
  const actual = snapshot.manifest.tables;
  if (
    expected.length !== actual.length ||
    expected.some((table) => {
      const other = actual.find((candidate) => candidate.name === table.name);
      return (
        !other ||
        JSON.stringify(table.columns) !== JSON.stringify(other.columns) ||
        JSON.stringify(table.primaryKey) !== JSON.stringify(other.primaryKey)
      );
    })
  ) {
    throw new DatabaseError('SCHEMA_MISMATCH', messages.tableSchema);
  }
}

/**
 * Вставляет строки без пересборки связей; владелец держит IMMEDIATE-транзакцию и проверяет FK.
 */
function writeTables(
  connection: Connection,
  snapshot: TableSnapshot,
  progress?: ProgressReporter,
): void {
  for (const table of snapshot.manifest.tables) {
    connection.client.exec(`DELETE FROM ${identifier(table.name)}`);
  }
  for (const table of snapshot.manifest.tables) {
    const statement = connection.client.prepare(
      `INSERT INTO ${identifier(table.name)} (${table.columns.map(identifier).join(', ')}) VALUES (${table.columns.map(() => '?').join(', ')})`,
    );
    for (const row of snapshot.rows.get(table.name) ?? []) {
      const file = tableFileAddress(table, row);
      progress?.startRecord('write', file);
      try {
        statement.run(
          ...table.columns.map((column) => decodeSqlCell(row[column])),
        );
      } catch (error) {
        throw new DatabaseError(
          'INVALID_TABLE_ROW',
          messages.tableRows,
          { path: file.path },
          error,
        );
      }
      progress?.finishRecord();
    }
  }
}

/**
 * Восстанавливает физический снимок и текущую схему одной транзакцией.
 * Ошибка SQL, предметной проверки или наблюдателя до COMMIT откатывает структуру и данные.
 */
export function restoreTableSnapshot(
  connection: Connection,
  snapshot: TableSnapshot,
  progress?: ProgressReporter,
): DatabaseSnapshot {
  connection.client.pragma('foreign_keys = OFF');
  try {
    return connection.client
      .transaction(() => {
        prepareImportSchema(connection);
        assertTableSchema(connection, snapshot);
        writeTables(connection, snapshot, progress);
        const documents = validateStoredTables(connection, snapshot);
        const total = snapshot.manifest.tables.reduce(
          (sum, table) => sum + table.rows,
          0,
        );
        progress?.stage('commit', total, total);
        return documents;
      })
      .immediate();
  } finally {
    connection.client.pragma('foreign_keys = ON');
  }
}

/**
 * Проверяет новый формат на актуальной SQL-схеме в памяти, не создавая целевой файл.
 */
export function validateTableSnapshot(
  snapshot: TableSnapshot,
): DatabaseSnapshot {
  const connection = memoryConnection();
  try {
    return restoreTableSnapshot(connection, snapshot);
  } finally {
    connection.client.close();
  }
}
