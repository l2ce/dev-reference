/**
 * Сбой соединения с GitHub, включая истечение тайм-аута.
 */
export class GitHubConnectionError extends Error {
  /** Сохраняет техническую причину для серверной диагностики. */
  constructor(cause: unknown) {
    super('GitHub connection failed', { cause })
    this.name = 'GitHubConnectionError'
  }
}
