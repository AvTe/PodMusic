'use client';

import type { CSSProperties } from 'react';
import { findActiveIndex, type Cue } from '@/lib/vtt';

interface Props {
  cues: Cue[];
  currentTime: number;
  visible: boolean;
  /** Seconds to shift the subtitles by. Positive shows each line later. */
  offset: number;
}

/** Lines shown either side of the current one. */
const CONTEXT = 2;

/** Opacity by distance from the active line — index 0 is the active line. */
const FALLOFF = [1, 0.28, 0.09];

/**
 * Uniform row height. Every line occupies exactly one row regardless of its
 * font size, which is what lets the stack scroll by a known distance.
 */
const ROW = 'clamp(34px, 4.6vw, 52px)';

const VERTICAL_FADE =
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 12%, #000 32%, #000 68%, rgba(0,0,0,0.3) 88%, transparent 100%)';

/** Long lines dissolve at the edges instead of being cut off. */
const HORIZONTAL_FADE =
  'linear-gradient(to right, transparent 0%, #000 7%, #000 93%, transparent 100%)';

/**
 * Teleprompter subtitles — one cue per line, never wrapped.
 *
 * Each new cue makes the column rise by exactly one row, so the movement reads
 * as continuous scrolling rather than text swapping in place. No panel and no
 * background fill: a text shadow carries legibility over the photograph.
 */
export function Subtitles({ cues, currentTime, visible, offset }: Props) {
  if (!visible || cues.length === 0) return null;

  const active = findActiveIndex(cues, currentTime - offset);
  if (active < 0) return null;

  const window: (Cue | null)[] = [];
  for (let offset = -CONTEXT; offset <= CONTEXT; offset++) {
    const index = active + offset;
    // Placeholders keep the active line centred at the very start and end.
    window.push(index >= 0 && index < cues.length ? cues[index] : null);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-40 z-20 flex items-center justify-center sm:bottom-28"
      style={{
        ['--row' as string]: ROW,
        height:          `calc(var(--row) * ${CONTEXT * 2 + 1})`,
        maskImage:       VERTICAL_FADE,
        WebkitMaskImage: VERTICAL_FADE,
      } as CSSProperties}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes subtitleRise {
            from { transform: translateY(var(--row)); opacity: 0.4; }
            to   { transform: translateY(0);          opacity: 1; }
          }`,
        }}
      />

      <div
        className="w-full overflow-hidden"
        style={{ maskImage: HORIZONTAL_FADE, WebkitMaskImage: HORIZONTAL_FADE }}
      >
        {/* Remounting on every cue restarts the rise, so the column scrolls
            one row each time the line changes. */}
        <div
          key={active}
          className="flex flex-col items-center"
          style={{ animation: 'subtitleRise 420ms cubic-bezier(0.33, 1, 0.68, 1) both' }}
        >
          {window.map((cue, i) => {
            const distance = Math.abs(i - CONTEXT);
            const isActive = distance === 0;

            return (
              <p
                key={cue ? cue.start : `gap-${i}`}
                className="flex w-full items-center justify-center whitespace-nowrap px-4 text-center text-white"
                style={{
                  height:     'var(--row)',
                  opacity:    cue ? FALLOFF[distance] : 0,
                  fontSize:   isActive ? 'clamp(17px, 2.5vw, 28px)' : 'clamp(13px, 1.9vw, 21px)',
                  fontWeight: isActive ? 500 : 400,
                  textShadow: '0 2px 14px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.95)',
                }}
              >
                {cue?.text ?? ''}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
