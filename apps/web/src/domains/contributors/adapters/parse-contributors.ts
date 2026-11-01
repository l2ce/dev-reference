import { hasOwn, isArrayOf, isRecord, isString, isNumber } from 'shared/lib/value-predicates'
import type { Contributor } from '../types/contributor.type'

/**
 * Проверяет внешний список и извлекает профили людей; боты не входят в благодарности.
 */
export const parseContributors = (response: unknown): Contributor[] => {
  if (!isArrayOf(response, isRecord)) {
    throw new Error('Invalid GitHub contributors response: expected an array of records')
  }

  const contributors: Contributor[] = []
  for (const record of response) {
    if (!hasOwn(record, 'type') || !isString(record.type)) {
      throw new Error('Invalid GitHub contributor type')
    }
    if (record.type !== 'User') {
      continue
    }
    if (
      !hasOwn(record, 'id') ||
      !isNumber(record.id) ||
      !Number.isSafeInteger(record.id) ||
      record.id <= 0 ||
      !hasOwn(record, 'login') ||
      !isString(record.login) ||
      !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(record.login)
    ) {
      throw new Error('Invalid GitHub contributor profile')
    }
    contributors.push({
      id: record.id,
      login: record.login,
      profileUrl: `https://github.com/${record.login}`,
      avatarUrl: `https://avatars.githubusercontent.com/u/${record.id}?s=80`
    })
  }
  return contributors
}
