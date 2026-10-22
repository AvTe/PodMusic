'use client';

import { useCallback, useState } from 'react';
import { cachePlaylist, getCachedPlaylist } from '@/lib/db';
import type { AudioTrack } from '@/types/audio';

/** The series first-time visitors start on. Must match src/data/default-series.json. */
export const DEFAULT_SERIES_URL = 'https://oshoworld.com/maha-geeta-by-osho-01-91';

export interface LoadedPlaylist {
  tracks: AudioTrack[];
  thumbnail: string | null;
}

/**
 * Loads a playlist for a URL — IndexedDB cache first, then the bundled snapshot
 * for the default series, then `/api/scrape`.
 * On success `playlistUrl` becomes the canonical key every DB write is keyed by.
 */
export function usePlaylistLoader() {
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [cacheHit, setCacheHit]       = useState(false);
  const [pagesScraped, setPagesScraped] = useState(0);
  const [playlistUrl, setPlaylistUrl] = useState('');

  const load = useCallback(async (url: string): Promise<LoadedPlaylist | null> => {
    setLoading(true);
    setError('');
    setCacheHit(false);
    setPagesScraped(0);

    // ── Cache first ──────────────────────────────────────────────────────────
    try {
      const cached = await getCachedPlaylist(url);
      if (cached) {
        setCacheHit(true);
        setPlaylistUrl(url);
        setLoading(false);
        return { tracks: cached.tracks as AudioTrack[], thumbnail: cached.thumbnail };
      }
    } catch { /* fall through to network */ }

    // ── Bundled snapshot of the default series ───────────────────────────────
    // First visits (and expired caches) start instantly instead of waiting
    // ~11 s on a live scrape. Code-split, so only those visits download it.
    if (url.trim().replace(/\/$/, '') === DEFAULT_SERIES_URL) {
      try {
        const { default: snapshot } = await import('@/data/default-series.json');
        setPlaylistUrl(url);
        cachePlaylist({ ...snapshot, url, cachedAt: Date.now() }).catch(() => {});
        setLoading(false);
        return { tracks: snapshot.tracks, thumbnail: snapshot.thumbnail };
      } catch { /* fall through to network */ }
    }

    // ── Network scrape ───────────────────────────────────────────────────────
    try {
      const res = await fetch('/api/scrape', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return null;
      }
      if (!data.tracks?.length) {
        setError('No tracks found on this URL.');
        setLoading(false);
        return null;
      }

      setPagesScraped(data.pagesScraped ?? 1);
      setPlaylistUrl(url);
      // Best-effort — a failed cache write must not fail the load.
      cachePlaylist({
        url,
        tracks:    data.tracks,
        thumbnail: data.thumbnail ?? null,
        cachedAt:  Date.now(),
      }).catch(() => {});

      setLoading(false);
      return { tracks: data.tracks as AudioTrack[], thumbnail: data.thumbnail ?? null };
    } catch {
      setError('Failed to fetch data.');
      setLoading(false);
      return null;
    }
  }, []);

  return { load, loading, error, setError, cacheHit, pagesScraped, playlistUrl };
}
