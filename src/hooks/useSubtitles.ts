'use client';

import { useEffect, useState } from 'react';
import { getSeriesSlug, getSubtitleUrl } from '@/lib/series';
import { parseVtt, type Cue } from '@/lib/vtt';

interface Options {
  playlistUrl: string;
  trackIndex: number;
  /** When false, nothing is fetched and no cues are returned. */
  enabled?: boolean;
}

/**
 * Loads the static VTT for the current track, if one has been generated.
 *
 * Subtitles are produced offline (see docs/subtitles-colab.md) and served from
 * public/subtitles/<slug>/NN.vtt, so a track without a file simply yields no
 * cues and the UI hides itself.
 */
export function useSubtitles({ playlistUrl, trackIndex, enabled = true }: Options) {
  const [cues, setCues] = useState<Cue[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const slug = playlistUrl ? getSeriesSlug(playlistUrl) : null;
    if (!slug) return;

    let cancelled = false;

    fetch(getSubtitleUrl(slug, trackIndex))
      .then(res => (res.ok ? res.text() : null))
      .then(text => {
        if (cancelled) return;
        // A dev-server 404 returns an HTML page, so require the VTT header.
        setCues(text && text.trimStart().startsWith('WEBVTT') ? parseVtt(text) : []);
      })
      .catch(() => { if (!cancelled) setCues([]); });

    return () => { cancelled = true; };
  }, [playlistUrl, trackIndex, enabled]);

  return { cues, available: enabled && cues.length > 0 };
}
