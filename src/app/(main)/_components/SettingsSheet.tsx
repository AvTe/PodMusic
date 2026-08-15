'use client';

import { Compass, Gauge, Moon, Volume2, X } from 'lucide-react';
import { SLEEP_OPTIONS, type SleepOption } from '@/hooks/useSleepTimer';

interface Props {
  open: boolean;
  onClose: () => void;
  volume: number;
  onVolume: (volume: number) => void;
  playbackRate: number;
  onPlaybackRate: (rate: number) => void;
  sleepTimer: SleepOption;
  onSleepTimer: (option: SleepOption) => void;
  onRestartTour: () => void;
}

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['← →',   'Back / forward 10s'],
  ['N / P', 'Next / previous'],
  ['M',     'Mute'],
  ['Esc',   'Close panels'],
];

export function SettingsSheet({
  open, onClose, volume, onVolume, playbackRate, onPlaybackRate, sleepTimer, onSleepTimer, onRestartTour,
}: Props) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(360px,100vw)] flex-col border-l border-white/12 bg-[#0b0e26]/90 backdrop-blur-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pb-4 pt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">Settings</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-7 overflow-y-auto px-6 pb-8">

          {/* Narration volume */}
          <section>
            <header className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
                <Volume2 className="h-3.5 w-3.5" /> Narration
              </span>
              <span className="font-mono text-[11px] text-white">{Math.round(volume * 100)}%</span>
            </header>
            <input
              type="range" min="0" max="1" step="0.01" value={volume}
              onChange={(e) => onVolume(parseFloat(e.target.value))}
              aria-label="Narration volume"
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#f0a33c]"
            />
          </section>

          {/* Speed */}
          <section>
            <header className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
                <Gauge className="h-3.5 w-3.5" /> Speed
              </span>
              <span className="font-mono text-[11px] text-white">{playbackRate.toFixed(1)}x</span>
            </header>
            <input
              type="range" min="0.5" max="2" step="0.1" value={playbackRate}
              onChange={(e) => onPlaybackRate(parseFloat(e.target.value))}
              aria-label="Playback speed"
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#e8581a]"
            />
            <div className="mt-2 flex justify-between font-mono text-[9px] text-white/25">
              <span>0.5x</span><span>1x</span><span>2x</span>
            </div>
          </section>

          {/* Sleep timer */}
          <section>
            <header className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
              <Moon className="h-3.5 w-3.5" /> Sleep timer
              {sleepTimer !== 'off' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f0a33c]" />}
            </header>
            <div className="flex flex-col gap-1.5">
              {SLEEP_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onSleepTimer(value)}
                  className={`rounded-xl px-4 py-2.5 text-left text-[13px] transition-colors ${
                    sleepTimer === value
                      ? 'bg-[#f0a33c]/15 text-[#f0a33c]'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Walkthrough */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
              <Compass className="h-3.5 w-3.5" /> Walkthrough
            </h3>
            <button
              onClick={onRestartTour}
              className="w-full rounded-xl border border-white/12 px-4 py-2.5 text-left text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              Replay the tour
            </button>
          </section>

          {/* Shortcuts */}
          <section>
            <h3 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-white/45">Shortcuts</h3>
            <dl className="flex flex-col gap-1.5 text-[11px] text-white/40">
              {SHORTCUTS.map(([key, meaning]) => (
                <div key={key} className="flex items-center justify-between">
                  <dt className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
                    {key}
                  </dt>
                  <dd>{meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </aside>
    </>
  );
}
