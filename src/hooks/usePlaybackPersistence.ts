'use client';

import { useEffect, useRef } from 'react';
import { saveProgress, getProgress, PlaybackProgress } from '@/lib/db';

const SAVE_INTERVAL_MS = 5_000; // save position every 5 s

interface Options {
  playlistUrl: string;       // canonical URL used as the DB key
  trackIndex: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onRestore: (progress: PlaybackProgress) => void;
}

/**
 * usePlaybackPersistence
 *
 * 1. On mount (once playlistUrl is set), loads any saved progress and calls
 *    onRestore so the caller can seek to the right track/position.
 * 2. Saves current position to IndexedDB every SAVE_INTERVAL_MS seconds and
 *    also on page unload (beforeunload).
 */
export function usePlaybackPersistence({ playlistUrl, trackIndex, audioRef, onRestore }: Options) {
  const savedUrl   = useRef('');
  const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restore progress when a new URL is loaded ──────────────────────────────
  useEffect(() => {
    if (!playlistUrl || playlistUrl === savedUrl.current) return;
    savedUrl.current = playlistUrl;

    getProgress(playlistUrl)
      .then((p) => { if (p) onRestore(p); })
      .catch(() => {/* best-effort */});
  }, [playlistUrl, onRestore]);

  // ── Periodically persist position ──────────────────────────────────────────
  useEffect(() => {
    if (!playlistUrl) return;

    const save = () => {
      if (!audioRef.current) return;
      saveProgress({
        url:         playlistUrl,
        trackIndex,
        currentTime: audioRef.current.currentTime,
        savedAt:     Date.now(),
      }).catch(() => {/* best-effort */});
    };

    intervalId.current = setInterval(save, SAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', save);

    return () => {
      if (intervalId.current) clearInterval(intervalId.current);
      window.removeEventListener('beforeunload', save);
    };
  }, [playlistUrl, trackIndex, audioRef]);
}
