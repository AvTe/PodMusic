import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Only the player page is listed. /v1 is noindex and /api is not a document,
 * so neither belongs here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url:             SITE_URL,
      lastModified:    new Date(),
      changeFrequency: 'weekly',
      priority:        1,
    },
  ];
}
