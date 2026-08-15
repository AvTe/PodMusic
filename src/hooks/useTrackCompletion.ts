'use client';

import { useEffect, useState, type RefObject } from 'react';
import { getPlaylistCompletions, saveTrackCompletion, type TrackCompletion } from '@/lib/db';
import type { PlaybackPosition } from './useAudioPlayback';

const SAVE_INTERVAL_MS = 3_000;

interface Options {
  /** Canonical playlist key. Empty string disables all writes. */
  playlistUrl: string;
  trackIndex: number;
  progressRef: RefObject<PlaybackPosition>;
}

/**
 * Per-track watch percentage — the YouTube-style bar under each row.
 *
 * Position comes from `progressRef`, so the save effect depends only on the
 * playlist and track index. It therefore keeps ticking during playback instead
 * of being reset by every `timeupdate`, and its cleanup flushes the outgoing
 * track when the index changes.
 */
export function useTrackCompletion({ playlistUrl, trackIndex, progressRef }: Options) {
  const [trackProgress, setTrackProgress] = useState<Record<number, TrackCompletion>>({});

  // Load stored bars whenever the playlist changes.
  useEffect(() => {
    if (!playlistUrl) return;
    getPlaylistCompletions(playlistUrl)
      .then(setTrackProgress)
      .catch(() => {});
  }, [playlistUrl]);

  useEffect(() => {
    if (!playlistUrl) return;

    const save = () => {
      const { currentTime, duration } = progressRef.current;
      if (!duration || duration < 1) return;

      const percentage = Math.min(100, (currentTime / duration) * 100);
      const entry: TrackCompletion = {
        id:          `${playlistUrl}::${trackIndex}`,
        playlistUrl,
        trackIndex,
        percentage,
        completed:   percentage >= 95,
        savedAt:     Date.now(),
      };
      saveTrackCompletion(entry).catch(() => {});
      setTrackProgress(prev => ({ ...prev, [trackIndex]: entry }));
    };

    const id = setInterval(save, SAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', save);

    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', save);
      // Flush on track switch — this closure still holds the outgoing index.
      save();
    };
  }, [playlistUrl, trackIndex, progressRef]);

  return trackProgress;
}
