import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * /v1 is deliberately left crawlable — it carries a noindex tag of its own, and
 * a robots.txt block would stop crawlers ever reading that tag.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
