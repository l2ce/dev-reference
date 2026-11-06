import type { Collection } from '@l2ce/database'
import { relationDefinitions } from '../commands/definition.js'
import { supportsFilter } from '../commands/query.js'
import { FILTER_OPTION_IDS, helpOption } from './options.js'
import type { HelpField } from './schema.js'

/**
 * Единая применимость параметра для контекстного текста, JSON и схемы вызова.
 */
export function optionApplies(id: string, operation: string, collection?: Collection, fields?: HelpField[]): boolean {
  if (
    id === 'locale' &&
    [
      'help',
      'schema',
      'types',
      'status',
      'init',
      'import',
      'export',
      'translation.list',
      'revision.list',
      'locale',
      'locale.list',
      'locale.add',
      'locale.set-default',
      'locale.delete'
    ].includes(operation)
  )
    return false
  if (!collection) return true
  if (
    ['list', 'find', 'stats'].includes(operation) &&
    FILTER_OPTION_IDS.includes(id) &&
    !['type', 'has', 'missing'].includes(id)
  )
    return supportsFilter(collection, ['sourceUrl', 'sourceHost'].includes(id) ? 'sources' : id)
  if (id === 'unscoped' && collection !== 'releases') return false
  if (
    ['before', 'afterTarget'].includes(id) &&
    !Object.values(relationDefinitions(collection)).some((relation) => relation.multiple && !relation.immutable)
  )
    return false
  if (!fields) return true
  const option = helpOption(id)
  if (
    option.field &&
    !['list', 'find', 'stats'].includes(operation) &&
    !fields.some((field) => field.name === option.field)
  )
    return false
  if (['setFile', 'setStdin'].includes(id) && !fields.some((field) => field.file)) return false
  if (
    ['add', 'remove'].includes(id) &&
    !fields.some((field) => ['states', 'servers', 'loginRevisions'].includes(field.name))
  )
    return false
  return true
}
