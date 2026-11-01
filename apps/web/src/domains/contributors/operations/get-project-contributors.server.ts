import 'server-only'
import { unstable_cache } from 'next/cache'
import { getContributorPage, GitHubApiError, GitHubConnectionError, GITHUB_PAGE_SIZE } from 'infra/github-api/server'
import { isArray } from 'shared/lib/value-predicates'
import { parseContributors } from '../adapters/parse-contributors'
import type { Contributor } from '../types/contributor.type'

/**
 * Читает все страницы GitHub. null обозначает недоступность источника, а не пустой список.
 */
const loadProjectContributors = async (): Promise<Contributor[] | null> => {
  const contributorsById = new Map<number, Contributor>()
  let page = 1

  while (true) {
    let response: unknown
    try {
      response = await getContributorPage(page)
    } catch (error) {
      const isUnavailable =
        error instanceof GitHubConnectionError ||
        (error instanceof GitHubApiError &&
          (error.status === 403 || error.status === 404 || error.status === 429 || error.status >= 500))
      if (!isUnavailable) {
        throw error
      }
      console.warn('[contributors] GitHub is unavailable:', error instanceof Error ? error.message : error)
      return null
    }

    const contributors = parseContributors(response)
    for (const contributor of contributors) {
      contributorsById.set(contributor.id, contributor)
    }
    if (!isArray(response) || response.length < GITHUB_PAGE_SIZE) {
      break
    }
    page += 1
  }

  return [...contributorsById.values()].sort((first, second) => first.login.localeCompare(second.login, 'en'))
}

/**
 * Кеширует публичный список на час; статический сайт получает обновление при следующей сборке.
 */
export const getProjectContributors = unstable_cache(loadProjectContributors, ['project-contributors-v1'], {
  revalidate: 3600
})
