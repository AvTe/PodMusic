/**
 * Single source of truth for the canonical origin and the shared copy that
 * feeds metadata, the sitemap, the manifest and the JSON-LD block.
 *
 * Everything is keyed off SITE_URL — change it in one place if the app ever
 * moves off the vercel.app subdomain.
 */
export const SITE_URL = 'https://podmusic-vert.vercel.app';

export const SITE_NAME = 'OSHO · Discourses';

/** <title> for the player page. Keyword-shaped, kept under ~60 characters. */
export const SITE_TITLE = 'Osho Discourses Online — Full Audio Series Player';

/** Meta description. English first, with the Hindi terms people actually search. */
export const SITE_DESCRIPTION =
  'Listen to complete Osho discourse series as continuous audio — Maha Geeta, ' +
  'Ashtavakra Gita and more — with an ambient soundscape underneath. Resumes where ' +
  'you left off. ओशो प्रवचन ऑडियो ऑनलाइन।';

/**
 * Meta keywords carry little weight with Google and some with other engines.
 * Included because they cost nothing; the terms mirror the queries the page is
 * genuinely about, in both scripts.
 */
export const SITE_KEYWORDS = [
  'osho discourses',
  'osho audio discourse',
  'osho pravachan audio',
  'osho discourses in hindi',
  'maha geeta osho audio',
  'ashtavakra gita osho audio',
  'osho audiobook online',
  'listen osho online',
  'osho discourse player',
  'osho with ambient music',
  'ओशो प्रवचन',
  'ओशो प्रवचन ऑडियो',
  'ओशो हिंदी प्रवचन ऑनलाइन',
  'महागीता ओशो',
  'अष्टावक्र गीता ओशो',
];
