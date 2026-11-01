import type { RepositoryRoute, SourceMetadata } from './source.types.js'

/**
 * Распознаёт публичные маршруты GitHub/GitLab. Незнакомый домен не считается хостингом по догадке.
 */
function repositoryRoute(url: URL, segments: readonly string[]): RepositoryRoute | undefined {
  if (['github.com', 'www.github.com', 'raw.githubusercontent.com'].includes(url.hostname) && segments.length >= 2) {
    const raw = url.hostname === 'raw.githubusercontent.com'
    if (!raw && segments[2] !== 'blob') {
      return undefined
    }
    return {
      provider: 'github',
      repository: segments.slice(0, 2),
      origin: 'https://github.com',
      commitIndex: raw ? 2 : 3
    }
  }
  if (url.hostname === 'gitlab.com') {
    const separator = segments.indexOf('-')
    if (separator >= 2) {
      return {
        provider: 'gitlab',
        repository: segments.slice(0, separator),
        origin: url.origin,
        commitIndex: segments[separator + 1] === 'blob' ? separator + 2 : null
      }
    }
  }
  return undefined
}

/**
 * Разбирает диапазон строк известного хостинга; некорректный или обратный диапазон остаётся неизвестным.
 */
function lineRange(hash: string, provider: RepositoryRoute['provider']): Pick<SourceMetadata, 'lineStart' | 'lineEnd'> {
  const match = (provider === 'github' ? /^#L([1-9]\d*)(?:-L([1-9]\d*))?$/ : /^#L([1-9]\d*)(?:-([1-9]\d*))?$/).exec(
    hash
  )
  const start = Number(match?.[1])
  const end = Number(match?.[2] ?? match?.[1])
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && end >= start
    ? { lineStart: start, lineEnd: end }
    : { lineStart: null, lineEnd: null }
}

/**
 * Вычисляет метаданные источника без I/O. Для невалидного HTTP(S)-URL возвращает null.
 * Обычная страница или неизвестный хостинг дают только host; ветка/tag не подменяются хешем коммита.
 */
export function sourceMetadata(value: string): SourceMetadata | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    return null
  }
  let provider: SourceMetadata['provider'] = null
  if (url.hostname === 'gitlab.com') {
    provider = 'gitlab'
  } else if (['github.com', 'www.github.com', 'raw.githubusercontent.com'].includes(url.hostname)) {
    provider = 'github'
  }
  const empty: SourceMetadata = {
    host: url.hostname,
    provider,
    repository: null,
    project: null,
    repositoryUrl: null,
    commit: null,
    filePath: null,
    fileName: null,
    lineStart: null,
    lineEnd: null
  }
  const segments = url.pathname.slice(1).split('/')
  const route = repositoryRoute(url, segments)
  if (!route || route.repository.some((segment) => !segment)) {
    return empty
  }
  let repository: string[]
  let path: string[]
  try {
    repository = route.repository.map(decodeURIComponent)
    path = route.commitIndex === null ? [] : segments.slice(route.commitIndex + 1).map(decodeURIComponent)
  } catch {
    return empty
  }
  if (repository.some((segment) => segment.includes('/'))) {
    return empty
  }
  const result: SourceMetadata = {
    ...empty,
    provider: route.provider,
    repository: repository.join('/'),
    project: repository.at(-1) ?? null,
    repositoryUrl: `${route.origin}/${route.repository.join('/')}`
  }
  const commit = route.commitIndex === null ? undefined : segments[route.commitIndex]
  if (
    !commit ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commit) ||
    path.length === 0 ||
    path.some((segment) => !segment)
  ) {
    return result
  }
  const filePath = path.join('/')
  return {
    ...result,
    commit,
    filePath,
    fileName: filePath.slice(filePath.lastIndexOf('/') + 1),
    ...lineRange(url.hash, route.provider)
  }
}
