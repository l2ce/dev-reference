import { configMessages } from './config/messages';
import type { SiteConfig } from './types/site-config.type';

/**
 * Проверяет параметры сборки; ошибочный адрес останавливает сборку до экспорта.
 */
export function createSiteConfig(
  basePath = '',
  origin = 'https://l2ce.github.io',
): SiteConfig {
  if (
    basePath !== '' &&
    !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath)
  ) {
    throw new Error(configMessages.basePath);
  }
  const url = new URL(origin);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(configMessages.siteUrl);
  }
  return { basePath, siteUrl: `${url.origin}${basePath}/` };
}

/**
 * Публичный префикс встраивается Next.js при сборке; origin нужен серверным метаданным.
 */
export const siteConfig = createSiteConfig(
  process.env.NEXT_PUBLIC_BASE_PATH,
  process.env.SITE_URL,
);
