'use client';

import { useState } from 'react';
import { ChevronDown, Volume2, VolumeX } from 'lucide-react';

interface Props {
  playing: boolean;
  onToggle: () => void;
  url: string;
  onCommitUrl: (url: string) => void;
  volume: number;
  onVolume: (volume: number) => void;
  thumbnail: string | null;
}

/**
 * Bottom-left ambient control. Collapsed it is a single chip; expanded it
 * reveals the YouTube source field and the ambient volume slider.
 */
export function AmbientChip({
  playing, onToggle, url, onCommitUrl, volume, onVolume, thumbnail,
}: Props) {
  const [expanded, setExpanded]   = useState(false);
  const [draft, setDraft]         = useState(url);
  const [syncedUrl, setSyncedUrl] = useState(url);

  // Re-sync the draft when the committed URL changes elsewhere (React's
  // "adjusting state when props change" pattern — cheaper than an effect,
  // which would render twice).
  if (url !== syncedUrl) {
    setSyncedUrl(url);
    setDraft(url);
  }

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2" data-tour="ambient">
      {expanded && (
        <div className="w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-black/55 p-4 backdrop-blur-2xl">
          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-white/40">
            Source · YouTube
          </label>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onCommitUrl(draft); }}
              placeholder="YouTube URL"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white outline-none focus:border-[#f0a33c]/50"
            />
            <button
              onClick={() => onCommitUrl(draft)}
              className="shrink-0 rounded-lg bg-[#f0a33c]/20 px-3 text-[11px] font-semibold text-[#f0a33c] transition-colors hover:bg-[#f0a33c]/35"
            >
              Set
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">Volume</span>
            <span className="font-mono text-[11px] text-white/70">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range" min="0" max="1" step="0.01" value={volume}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            aria-label="Ambient volume"
            className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#f0a33c]"
          />
        </div>
      )}

      <div className="flex items-center gap-1 rounded-full border border-white/12 bg-black/45 p-1.5 pr-1 backdrop-blur-2xl">
        <button
          onClick={onToggle}
          aria-label={playing ? 'Pause ambient sound' : 'Play ambient sound'}
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/5"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cover bg-center"
            style={
              thumbnail
                ? { backgroundImage: `url(${thumbnail})` }
                : { background: 'linear-gradient(140deg,#2b3480,#e8581a)' }
            }
          >
            {playing
              ? <Volume2 className="h-3.5 w-3.5 text-white drop-shadow" />
              : <VolumeX className="h-3.5 w-3.5 text-white/70 drop-shadow" />}
          </span>

          <span className="text-left leading-tight">
            <span className="block text-[12px] font-semibold text-white">Ambient</span>
            <span className={`block text-[9px] uppercase tracking-[0.16em] ${playing ? 'text-[#f0a33c]' : 'text-white/35'}`}>
              {playing ? 'Playing' : 'Paused'}
            </span>
          </span>
        </button>

        <button
          onClick={() => setExpanded(v => !v)}
          aria-label="Ambient settings"
          className="rounded-full p-2 text-white/45 transition-colors hover:text-white"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : 'rotate-180'}`} />
        </button>
      </div>
    </div>
  );
}
