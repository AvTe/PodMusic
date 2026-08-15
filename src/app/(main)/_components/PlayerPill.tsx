'use client';

import { useEffect, useRef, useState } from 'react';
import { Captions, ListMusic, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { formatTime } from '@/hooks/useAudioPlayback';
import { FALLBACK_ARTWORK, resolveArtwork } from '@/lib/artwork';
import type { AudioTrack } from '@/types/audio';

interface Props {
  track: AudioTrack;
  thumbnail: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  canPrev: boolean;
  canNext: boolean;
  playlistOpen: boolean;
  subtitlesAvailable: boolean;
  subtitlesOn: boolean;
  onToggleSubtitles: () => void;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeekRatio: (ratio: number) => void;
  onTogglePlaylist: () => void;
}

export function PlayerPill({
  track, thumbnail, isPlaying, currentTime, duration,
  canPrev, canNext, playlistOpen,
  subtitlesAvailable, subtitlesOn, onToggleSubtitles,
  onToggle, onPrev, onNext, onSeekRatio, onTogglePlaylist,
}: Props) {
  const barRef      = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX]       = useState(0);

  const ratioFromEvent = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      onSeekRatio(ratioFromEvent(e.clientX));
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onSeekRatio]);

  const played = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="pointer-events-auto w-[min(680px,calc(100vw-2rem))] rounded-full border border-white/12 bg-black/45 px-3 py-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:px-4">
      <div className="flex items-center gap-3 sm:gap-4">

        {/* Artwork — the bundled portrait is layered underneath, so a scraped
            image that 404s falls through to it with no JS involved. */}
        <div
          className="h-12 w-12 shrink-0 rounded-full border border-white/15 bg-cover bg-center sm:h-14 sm:w-14"
          style={{
            backgroundImage: `url(${resolveArtwork(thumbnail)}), url(${FALLBACK_ARTWORK})`,
            backgroundSize:     'cover, cover',
            backgroundPosition: 'center 30%, center 30%',
          }}
        />

        {/* Title + seek */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white sm:text-sm">
            {track.title}
          </p>

          <div
            ref={barRef}
            className="group relative mt-2 cursor-pointer select-none py-1"
            onMouseDown={(e) => { draggingRef.current = true; onSeekRatio(ratioFromEvent(e.clientX)); }}
            onMouseMove={(e) => {
              if (!duration || !barRef.current) return;
              setHoverTime(ratioFromEvent(e.clientX) * duration);
              setHoverX(e.clientX - barRef.current.getBoundingClientRect().left);
            }}
            onMouseLeave={() => setHoverTime(null)}
          >
            <div className="relative h-[3px] w-full rounded-full bg-white/15 transition-all group-hover:h-[6px]">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${played}%`, background: 'linear-gradient(90deg,#f0a33c,#e8581a)' }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                style={{ left: `${played}%` }}
              />
            </div>

            {hoverTime !== null && (
              <span
                className="pointer-events-none absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/80 px-2 py-0.5 font-mono text-[10px] text-white"
                style={{ left: hoverX }}
              >
                {formatTime(hoverTime)}
              </span>
            )}
          </div>

          <p className="mt-1 font-mono text-[10px] tabular-nums text-white/40">
            {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </div>

        {/* Transport */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2" data-tour="transport">
          <button
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Previous discourse"
            className="p-2 text-white/60 transition-colors hover:text-white disabled:opacity-25"
          >
            <SkipBack className="h-4 w-4 fill-current" />
          </button>

          <button
            onClick={onToggle}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
          </button>

          <button
            onClick={onNext}
            disabled={!canNext}
            aria-label="Next discourse"
            className="p-2 text-white/60 transition-colors hover:text-white disabled:opacity-25"
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </button>

          {subtitlesAvailable && (
            <button
              onClick={onToggleSubtitles}
              aria-label={subtitlesOn ? 'Hide subtitles' : 'Show subtitles'}
              aria-pressed={subtitlesOn}
              data-tour="subtitles"
              className={`rounded-full p-2 transition-colors ${subtitlesOn ? 'text-[#f0a33c]' : 'text-white/45 hover:text-white'}`}
            >
              <Captions className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={onTogglePlaylist}
            aria-label="Playlist"
            data-tour="playlist"
            className={`ml-1 rounded-full p-2 transition-colors ${playlistOpen ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'}`}
          >
            <ListMusic className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
