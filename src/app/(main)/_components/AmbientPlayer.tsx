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
export function AmbientPlayer({ videoId, playing, volume }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef  = useRef(false);
  const latestRef = useRef({ playing, volume });

  useEffect(() => { latestRef.current = { playing, volume }; }, [playing, volume]);

  const post = (func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*',
    );
  };

  const handleLoad = () => {
    readyRef.current = true;
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
    post('setVolume', [Math.round(volume * 100)]);
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
