'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';

export interface TourStep {
  /** Value of the `data-tour` attribute to spotlight. null centres the card. */
  target: string | null;
  title: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  open: boolean;
  /** Called on skip, on finish, and on Escape. */
  onClose: () => void;
}

const CARD_WIDTH = 330;
const SPOTLIGHT_PAD = 10;

/**
 * Lightweight guided tour. Spotlights an element by drawing a huge box-shadow
 * outward from its rect, so a single element dims everything around it without
 * needing an SVG mask or four separate panels.
 */
export function Tour({ steps, open, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect]   = useState<DOMRect | null>(null);

  const step    = steps[index];
  const isFirst = index === 0;
  const isLast  = index === steps.length - 1;

  const finish = useCallback(() => {
    setIndex(0);
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    if (isLast) finish();
    else setIndex(i => i + 1);
  }, [isLast, finish]);

  const back = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);

  // Measure the current target. Deferred to the next frame so layout has
  // settled after any transition that preceded the step.
  useEffect(() => {
    if (!open) return;

    const measure = () => {
      const selector = step?.target;
      if (!selector) { setRect(null); return; }
      const el = document.querySelector(`[data-tour="${selector}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };

    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [open, step?.target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     { e.preventDefault(); finish(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, next, back, finish]);

  if (!open || !step) return null;

  // Card sits below the target when there is room, otherwise above it.
  let cardStyle: CSSProperties;
  if (!rect) {
    cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  } else {
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - CARD_WIDTH / 2, 16),
      window.innerWidth - CARD_WIDTH - 16,
    );
    cardStyle = window.innerHeight - rect.bottom > 240
      ? { top: rect.bottom + 18, left }
      : { bottom: window.innerHeight - rect.top + 18, left };
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Click catcher — the tour advances only via its own controls. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl"
          style={{
            top:        rect.top - SPOTLIGHT_PAD,
            left:       rect.left - SPOTLIGHT_PAD,
            width:      rect.width + SPOTLIGHT_PAD * 2,
            height:     rect.height + SPOTLIGHT_PAD * 2,
            boxShadow:  '0 0 0 9999px rgba(3,4,14,0.80)',
            border:     '1px solid rgba(255,255,255,0.28)',
            transition: 'top 280ms cubic-bezier(.4,0,.2,1), left 280ms cubic-bezier(.4,0,.2,1), width 280ms cubic-bezier(.4,0,.2,1), height 280ms cubic-bezier(.4,0,.2,1)',
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0" style={{ background: 'rgba(3,4,14,0.80)' }} />
      )}

      {/* Step card */}
      <div
        className="absolute w-[330px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/12 bg-[#0b0e26]/95 p-5 shadow-2xl backdrop-blur-2xl"
        style={cardStyle}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
            {index + 1} / {steps.length}
          </span>
          <button
            onClick={finish}
            aria-label="Skip walkthrough"
            className="-mr-1 rounded-full p-1 text-white/35 transition-colors hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h3 className="mb-1.5 text-[15px] font-semibold text-white">{step.title}</h3>
        <p className="text-[13px] leading-relaxed text-white/60">{step.body}</p>

        {/* Progress dots */}
        <div className="mt-4 flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: i <= index ? '#f0a33c' : 'rgba(255,255,255,0.12)' }}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={finish}
            className="mr-auto text-[12px] text-white/40 transition-colors hover:text-white"
          >
            Skip
          </button>

          {!isFirst && (
            <button
              onClick={back}
              className="flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-2 text-[12px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}

          <button
            onClick={next}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-black transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(90deg,#f0a33c,#e8581a)' }}
          >
            {isLast
              ? <>Get started <Check className="h-3.5 w-3.5" /></>
              : <>Next <ArrowRight className="h-3.5 w-3.5" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
