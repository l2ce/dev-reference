/**
 * Диагностики неверной конфигурации публикации.
 */
export const configMessages = {
  basePath: 'NEXT_PUBLIC_BASE_PATH должен быть пустым или путём вида /dev-reference без завершающего слеша.',
  siteUrl: 'SITE_URL должен содержать HTTP(S) origin без пути, параметров и credentials.'
} as const
