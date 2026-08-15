/** Bundled Osho portrait — backdrop, and artwork of last resort. */
export const FALLBACK_ARTWORK = '/osho-hero.png';

/**
 * Some sources return a placeholder instead of omitting the image. Oshoworld,
 * for example, answers with `…/opengraph?image=…no_image.png` for series that
 * have no artwork, which is a live URL that renders as a blank tile.
 */
const PLACEHOLDER_RE = /no[-_]?image|placeholder|default[-_]?(image|thumb)/i;

/** True when a scraped thumbnail is real artwork rather than a stand-in. */
export function isRealArtwork(thumbnail: string | null | undefined): thumbnail is string {
  return Boolean(thumbnail) && !PLACEHOLDER_RE.test(thumbnail as string);
}

/** Always returns a usable image URL. */
export function resolveArtwork(thumbnail: string | null | undefined): string {
  return isRealArtwork(thumbnail) ? thumbnail : FALLBACK_ARTWORK;
}
