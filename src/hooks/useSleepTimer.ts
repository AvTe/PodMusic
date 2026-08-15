'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SleepOption = 'off' | '15' | '30' | '60' | 'end';

export const SLEEP_OPTIONS: { value: SleepOption; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: '15',  label: '15 minutes' },
  { value: '30',  label: '30 minutes' },
  { value: '60',  label: '1 hour' },
  { value: 'end', label: 'End of discourse' },
];

/**
 * Countdown that pauses playback when it expires.
 *
 * `'end'` schedules nothing — the caller checks for it when a track finishes.
 */
export function useSleepTimer(onExpire: () => void) {
  const [sleepTimer, setSleepTimerState] = useState<SleepOption>('off');
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExpireRef = useRef(onExpire);

  // Keep the latest callback without re-creating setSleepTimer.
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  const setSleepTimer = useCallback((option: SleepOption) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSleepTimerState(option);
    if (option === 'off' || option === 'end') return;

    timerRef.current = setTimeout(() => {
      onExpireRef.current();
      setSleepTimerState('off');
    }, parseInt(option, 10) * 60_000);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { sleepTimer, setSleepTimer };
}
