import 'server-only'
import { GITHUB_API_CONFIG, GITHUB_PAGE_SIZE } from './config/github-api.config'
import { GitHubConnectionError } from './errors/github-connection.error'
import { HttpClient } from './generated/http-client'
import { reposListContributors } from './generated/operations/repos-list-contributors'

/**
 * Отделяет сетевой сбой от ошибок разбора ответа и программных дефектов.
 */
const fetchGitHub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(input, init)
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new GitHubConnectionError(error)
    }
    throw error
  }
}

/**
 * Пустой репозиторий возвращает 204 без JSON; остальные ответы читаются как JSON.
 */
const parseGitHubResponse = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return []
  }
  return response.json()
}

const httpClient = new HttpClient({
  baseUrl: GITHUB_API_CONFIG.baseUrl,
  timeout: GITHUB_API_CONFIG.timeout,
  credentials: 'omit',
  cache: 'no-store',
  headers: {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'l2ce-dev-reference'
  },
  customFetch: fetchGitHub,
  responseParser: parseGitHubResponse
})

/**
 * Возвращает одну непроверенную страницу участников публичного репозитория.
 */
export const getContributorPage = (page: number): Promise<unknown> =>
  reposListContributors(httpClient, {
    owner: GITHUB_API_CONFIG.owner,
    repo: GITHUB_API_CONFIG.repo,
    per_page: GITHUB_PAGE_SIZE,
    page
  })
