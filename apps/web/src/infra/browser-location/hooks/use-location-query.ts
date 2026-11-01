import { useSyncExternalStore } from 'react'

const QUERY_EVENT = 'l2ce:query-change'

/**
 * Подписывается на Back/Forward и изменения локальных фильтров; освобождает оба слушателя.
 */
function subscribeQuery(notify: () => void): () => void {
  window.addEventListener('popstate', notify)
  window.addEventListener(QUERY_EVENT, notify)
  return (): void => {
    window.removeEventListener('popstate', notify)
    window.removeEventListener(QUERY_EVENT, notify)
  }
}

/**
 * Читает строку запроса только в браузерном lifecycle.
 */
function readQuery(): string {
  return window.location.search
}

/**
 * Согласует статический HTML и начальную гидратацию без запроса к серверу.
 */
function serverQuery(): string {
  return ''
}

/**
 * Предоставляет параметры текущего URL для восстановления фильтров после перехода.
 */
export function useLocationQuery(): string {
  return useSyncExternalStore(subscribeQuery, readQuery, serverQuery)
}

/**
 * Заменяет только query текущей страницы, сохраняя basePath и служебное состояние Next.
 * Ввод каждого символа не создаёт новую запись истории.
 */
export function replaceLocationQuery(params: URLSearchParams): void {
  const query = params.toString()
  const suffix = query === '' ? '' : `?${query}`
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${suffix}${window.location.hash}`)
  window.dispatchEvent(new Event(QUERY_EVENT))
}
