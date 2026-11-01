/**
 * Публичный read-only API GitHub; авторизация для открытого репозитория не требуется.
 */
export const GITHUB_API_CONFIG = {
  baseUrl: 'https://api.github.com',
  timeout: 8_000,
  owner: 'l2ce',
  repo: 'dev-reference'
}

/**
 * Максимальный размер страницы публичного GitHub REST API.
 */
export const GITHUB_PAGE_SIZE = 100
