'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

export function formatTime(time: number): string {
  if (!time || isNaN(time)) return '0:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export interface PlaybackPosition {
  currentTime: number;
  duration: number;
}

/**
 * Tracks position/duration of an <audio> element.
 *
 * `progressRef` mirrors the same values for timers to read. Anything that saves
 * on an interval MUST read the ref rather than depend on `currentTime` —
 * `timeupdate` fires ~4x/second, so a `currentTime` dependency resets any
 * debounce before it can ever fire.
 */
export function useAudioPlayback(
  audioRef: RefObject<HTMLAudioElement | null>,
  trackSrc?: string,
) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const progressRef                   = useRef<PlaybackPosition>({ currentTime: 0, duration: 0 });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      progressRef.current.currentTime = audio.currentTime;
      setCurrentTime(audio.currentTime);
    };
    const updateDuration = () => {
      progressRef.current.duration = audio.duration;
      setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [audioRef, trackSrc]);

  /** Seek to a 0–1 position along the track. */
  const seekToRatio = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = Math.max(0, Math.min(1, ratio)) * duration;
    audio.currentTime = next;
    progressRef.current.currentTime = next;
    setCurrentTime(next);
  };

  /** Jump forwards/backwards by N seconds. */
  const nudge = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime + seconds);
  };

  return { currentTime, duration, progressRef, seekToRatio, nudge };
}
