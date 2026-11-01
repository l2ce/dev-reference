/**
 * Диагностики переносимых контрактов и связей базы.
 */
export const modelMessages = {
  invalid: 'Data does not match the database schema.',
  duplicate: 'Duplicate record address or reference.',
  duplicateId: 'Document and embedded object IDs must be globally unique.',
  immutableId: 'The document ID cannot be changed.',
  address: 'The record address does not match its content.',
  locale: 'The locale is not declared in the manifest.',
  missingOwner: 'The document has no matching owner entity.',
  reference: 'A reference points to a missing or incompatible record.',
  sources: 'Researched data must have sources.',
  content: 'A documented record requires a non-empty description.',
  binding: 'Entity revisions have overlapping protocol applicability.',
  opcode: 'The opcode exceeds its width or conflicts within this profile.'
} as const
