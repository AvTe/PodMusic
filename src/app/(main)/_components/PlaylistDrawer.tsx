'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { TrackCompletion } from '@/lib/db';
import type { AudioTrack } from '@/types/audio';

interface Props {
  open: boolean;
  tracks: AudioTrack[];
  currentIndex: number;
  trackProgress: Record<number, TrackCompletion>;
  currentTime: number;
  duration: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function PlaylistDrawer({
  open, tracks, currentIndex, trackProgress, currentTime, duration, onSelect, onClose,
}: Props) {
  const [filter, setFilter] = useState('');
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, currentIndex]);

  const rows = useMemo(() => {
    const indexed = tracks.map((track, index) => ({ track, index }));
    if (!filter) return indexed;
    const needle = filter.toLowerCase();
    return indexed.filter(({ track }) => track.title.toLowerCase().includes(needle));
  }, [tracks, filter]);

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        className={`fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[68vh] w-[min(760px,100vw)] flex-col rounded-t-[28px] border border-b-0 border-white/12 bg-[#0b0e26]/85 backdrop-blur-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ boxShadow: '0 -30px 80px -20px rgba(0,0,0,0.9)' }}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-5 pt-4 sm:px-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
            Discourses
            <span className="ml-2 font-mono text-[11px] font-normal tracking-normal text-white/35">
              {tracks.length}
            </span>
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter */}
        <div className="relative px-5 pb-3 pt-3 sm:px-6">
          <Search className="pointer-events-none absolute left-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30 sm:left-9" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search discourses…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-8 text-[13px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#f0a33c]/50"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              aria-label="Clear search"
              className="absolute right-8 top-1/2 -translate-y-1/2 text-white/40 hover:text-white sm:right-9"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Rows */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 sm:px-4">
          {rows.map(({ track, index }) => {
            const isActive = index === currentIndex;
            const pct = isActive && duration > 0
              ? Math.min(100, (currentTime / duration) * 100)
              : trackProgress[index]?.percentage ?? 0;

            return (
              <button
                key={track.id}
                ref={isActive ? activeRef : null}
                onClick={() => onSelect(index)}
                className={`relative flex w-full items-center gap-4 overflow-hidden rounded-2xl px-4 py-3.5 text-left transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'
                }`}
              >
                {isActive ? (
                  <span className="flex w-6 shrink-0 justify-center">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#f0a33c]" />
                  </span>
                ) : (
                  <span className="w-6 shrink-0 font-mono text-[11px] text-white/35">{index + 1}</span>
                )}

                <span className="min-w-0 flex-1 truncate text-[14px]">{track.title}</span>

                {track.duration && (
                  <span className="shrink-0 font-mono text-[11px] text-white/35">{track.duration}</span>
                )}

                {pct > 0 && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/5">
                    <span
                      className="absolute inset-y-0 left-0 rounded-r-full transition-all duration-1000"
                      style={{ width: `${pct}%`, background: '#e8581a' }}
                    />
                  </span>
                )}
              </button>
            );
          })}

          {filter && rows.length === 0 && (
            <p className="pt-10 text-center text-sm text-white/35">
              No discourses match &ldquo;{filter}&rdquo;
            </p>
          )}
        </div>
      </div>
    </>
  );
}
