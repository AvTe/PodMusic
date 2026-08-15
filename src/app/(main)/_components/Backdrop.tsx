'use client';

import Image from 'next/image';
import { FALLBACK_ARTWORK } from '@/lib/artwork';

/** Film-grain tile, inlined so nothing is fetched over the network. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Full-bleed portrait backdrop.
 *
 * The photograph is shown at full colour — no blur, no blend mode. Legibility
 * comes from scrims at the top and bottom edges only, so the middle of the
 * frame stays sharp. `next/image` re-encodes the 2.6MB PNG to WebP/AVIF.
 */
export function Backdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ background: '#06081a' }}>
      <Image
        src={FALLBACK_ARTWORK}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: 'center 42%' }}
      />

      {/* Top scrim — keeps the header chrome readable */}
      <div
        className="absolute inset-x-0 top-0 h-[32vh]"
        style={{ background: 'linear-gradient(180deg, rgba(4,6,20,0.72) 0%, rgba(4,6,20,0.25) 45%, rgba(4,6,20,0) 100%)' }}
      />

      {/* Bottom scrim — light touch only. The pill carries its own backdrop
          blur, so this just grounds the very bottom edge without dulling the
          red haze that sits on top of it. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[45vh]"
        style={{
          background:
            'linear-gradient(0deg, rgba(10,4,10,0.62) 0%, rgba(10,4,10,0.3) 20%, rgba(10,4,10,0.1) 48%, rgba(10,4,10,0) 100%)',
        }}
      />

      {/* Edge vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(115% 80% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)' }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: GRAIN, opacity: 0.1, mixBlendMode: 'overlay' }}
      />
    </div>
  );
}
