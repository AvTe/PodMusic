/**
 * Last path segment of a series URL — the key subtitle files are filed under.
 * `https://oshoworld.com/maha-geeta-by-osho-01-91` → `maha-geeta-by-osho-01-91`
 */
export function getSeriesSlug(url: string): string | null {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() ?? null;
  } catch {
    return null;
  }
}

/** Human-readable series name derived from the slug. */
export function getSeriesLabel(url: string): string | undefined {
  const slug = getSeriesSlug(url);
  if (!slug) return undefined;
  return slug.replace(/-/g, ' ').replace(/\d+/g, '').replace(/\s+/g, ' ').trim() || undefined;
}

/** Static path of a track's subtitle file. Track 0 → `01.vtt`. */
export function getSubtitleUrl(slug: string, trackIndex: number): string {
  return `/subtitles/${slug}/${String(trackIndex + 1).padStart(2, '0')}.vtt`;
}
