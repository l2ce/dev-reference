import type { MetadataRoute } from 'next';
import { siteConfig } from 'infra/site-config';

export const dynamic = 'force-static';

/**
 * Публикует расположение статической карты сайта.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('sitemap.xml', siteConfig.siteUrl).href,
  };
}
