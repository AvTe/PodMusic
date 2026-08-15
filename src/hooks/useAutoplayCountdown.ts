'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AutoplayToast {
  title: string;
  secondsLeft: number;
}

interface Options {
  seconds?: number;
  /** Title of the track that would play next, or null if there is none. */
  getNextTitle: () => string | null;
  /** Countdown reached zero — advance and keep playing. */
  onAdvance: () => void;
  /** Countdown dismissed, or there was no next track. */
  onCancel: () => void;
}

/**
 * "Up next" countdown shown when a track ends.
 * Callbacks are held in a ref so `trigger` stays stable across renders.
 */
export function useAutoplayCountdown({ seconds = 5, getNextTitle, onAdvance, onCancel }: Options) {
  const [toast, setToast] = useState<AutoplayToast | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacks   = useRef({ getNextTitle, onAdvance, onCancel });

  useEffect(() => {
    callbacks.current = { getNextTitle, onAdvance, onCancel };
  }, [getNextTitle, onAdvance, onCancel]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setToast(null);
  }, []);

  const cancel = useCallback(() => {
    stop();
    callbacks.current.onCancel();
  }, [stop]);

  const trigger = useCallback(() => {
    const title = callbacks.current.getNextTitle();
    if (!title) {
      callbacks.current.onCancel();
      return;
    }

    let left = seconds;
    setToast({ title, secondsLeft: left });

    intervalRef.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        stop();
        callbacks.current.onAdvance();
      } else {
        setToast({ title, secondsLeft: left });
      }
    }, 1000);
  }, [seconds, stop]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return { toast, trigger, cancel, totalSeconds: seconds };
}
