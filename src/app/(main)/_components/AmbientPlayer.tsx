'use client';

import { useEffect, useRef } from 'react';

interface Props {
  videoId: string;
  playing: boolean;
  volume: number;
}

/**
 * Ambient bed — a 2×2px YouTube iframe driven by the IFrame API over postMessage.
 *
 * Deliberately NOT react-player: it falls back to a <video> element in
 * production Turbopack builds because its YouTube sub-module dynamic import
 * never resolves. Commands sent before `onLoad` are silently dropped, hence
 * `readyRef` and the initial replay of state inside `handleLoad`.
 */
/** Ramp length when the bed dips under speech, in ms. Slow enough to read as
 *  the room breathing rather than someone yanking a fader. */
const RAMP_MS    = 700;
const RAMP_STEPS = 14;

export function AmbientPlayer({ videoId, playing, volume }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef  = useRef(false);
  const latestRef = useRef({ playing, volume });
  /** Where the ramp is right now, so a retarget mid-fade starts from here. */
  const actualRef = useRef(volume);
  const rampRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { latestRef.current = { playing, volume }; }, [playing, volume]);

  const post = (func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*',
    );
  };

  /**
   * Ease toward a new level instead of jumping. Ducking fires on every
   * play/pause, and an instant level change on a sustained pad is far more
   * distracting than the masking it is there to fix.
   */
  const rampTo = (target: number) => {
    if (rampRef.current) clearInterval(rampRef.current);
    const from = actualRef.current;
    if (Math.abs(target - from) < 0.005) {
      actualRef.current = target;
      post('setVolume', [Math.round(target * 100)]);
      return;
    }

    let step = 0;
    rampRef.current = setInterval(() => {
      step += 1;
      const t = step / RAMP_STEPS;
      // Cosine ease — no audible corner at either end of the fade.
      const eased = from + (target - from) * (1 - Math.cos(Math.PI * t)) / 2;
      actualRef.current = eased;
      post('setVolume', [Math.round(eased * 100)]);
      if (step >= RAMP_STEPS && rampRef.current) {
        clearInterval(rampRef.current);
        rampRef.current = null;
        actualRef.current = target;
      }
    }, RAMP_MS / RAMP_STEPS);
  };

  useEffect(() => () => { if (rampRef.current) clearInterval(rampRef.current); }, []);

  const handleLoad = () => {
    readyRef.current = true;
    actualRef.current = latestRef.current.volume;
    post('setVolume', [Math.round(latestRef.current.volume * 100)]);
    if (latestRef.current.playing) post('playVideo');
  };

  useEffect(() => {
    if (!readyRef.current) return;
    if (playing) post('playVideo');
    else post('pauseVideo');
  }, [playing]);

  useEffect(() => {
    if (!readyRef.current) return;
    rampTo(volume);
    // rampTo closes over refs only, so it is stable in every way that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  if (!videoId) return null;

  return (
    <iframe
      key={videoId}
      ref={iframeRef}
      src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&controls=0&loop=1&playlist=${videoId}&mute=0`}
      allow="autoplay; encrypted-media"
      onLoad={handleLoad}
      title="Ambient sound"
      style={{
        position: 'fixed', bottom: '-2px', left: '-2px',
        width: '2px', height: '2px',
        opacity: 0, border: 'none', pointerEvents: 'none',
      }}
    />
  );
}
