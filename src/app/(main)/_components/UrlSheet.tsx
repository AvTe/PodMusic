'use client';

import { Link as LinkIcon, Loader2, X } from 'lucide-react';

interface Props {
  open: boolean;
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  /** False while no playlist is loaded — the sheet cannot be dismissed yet. */
  dismissible: boolean;
  loading: boolean;
  error: string;
  cacheHit: boolean;
}

export function UrlSheet({
  open, url, onUrlChange, onSubmit, onClose, dismissible, loading, error, cacheHit,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/12 bg-[#0b0e26]/90 p-7 shadow-2xl backdrop-blur-2xl sm:p-8">
        {dismissible && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 text-white/40 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <h2 className="mb-1 text-2xl font-semibold text-white">Load a series</h2>
        <p className="mb-6 text-[12px] text-white/45">
          Paste the address of any page with audio on it.
        </p>

        <div className="relative">
          <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="url"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading) onSubmit(); }}
            placeholder="https://…"
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 text-[13px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#f0a33c]/50"
          />
        </div>

        <button
          onClick={onSubmit}
          disabled={loading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-semibold text-black transition-opacity disabled:opacity-50"
          style={{ background: 'linear-gradient(90deg,#f0a33c,#e8581a)' }}
        >
          {loading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning pages…</>
            : 'Load series'}
        </button>

        {loading && (
          <p className="mt-3 animate-pulse text-center text-[11px] text-white/35">
            Reading every page — this may take a moment
          </p>
        )}
        {cacheHit && !loading && (
          <p className="mt-3 text-center text-[11px] text-[#f0a33c]">⚡ Loaded from cache</p>
        )}
        {error && (
          <p className="mt-4 text-center text-[12px] text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
