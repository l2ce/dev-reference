import type { RecordRow, RecordFields } from './storage.types.js';

/**
 * Отделяет SQL FK от полей API. Содержимое и nullable-порядок сохраняются буквально.
 */
export function documentFields(row: RecordRow): RecordFields {
  const {
    ownerId: _ownerId,
    branchId: _branchId,
    chronicleId: _chronicleId,
    ...fields
  } = {
    ownerId: undefined,
    branchId: undefined,
    chronicleId: undefined,
    ...row,
  };
  return fields;
}
