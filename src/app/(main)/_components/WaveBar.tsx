'use client';

import { useEffect, useRef } from 'react';

interface Props {
  playing: boolean;
  playbackRate: number;
}

/**
 * Stacked wave layers. Each has its own spatial frequency, scroll direction and
 * amplitude so the crests never line up into an obvious repeat.
 */
const LAYERS = [
  { freq: 0.8, speed:  0.55, amp: 1.00, alpha: 0.62, baseline: 0.52 },
  { freq: 1.3, speed: -0.38, amp: 0.74, alpha: 0.44, baseline: 0.64 },
  { freq: 2.0, speed:  0.24, amp: 0.50, alpha: 0.30, baseline: 0.76 },
];

/**
 * Red wave field along the bottom edge, picking up the colour of the backdrop
 * photograph.
 *
 * NOT an audio analyser. The tracks are served cross-origin without CORS
 * headers, and routing such an element through a MediaElementAudioSourceNode
 * makes it output silence — so real amplitude data is unavailable. Motion is
 * driven by playback state instead: it swells while playing, settles to a slow
 * idle when paused, and scrolls in proportion to `playbackRate`.
 */
export function WaveBar({ playing, playbackRate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number | null>(null);
  const timeRef   = useRef(0);
  const energyRef = useRef(0.18);
  const stateRef  = useRef({ playing, playbackRate });

  useEffect(() => { stateRef.current = { playing, playbackRate }; }, [playing, playbackRate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;

    // The output is blurred to haze, so it is drawn at a fraction of screen
    // resolution and upscaled. Cuts per-frame pixel work ~16x against DPR 2
    // with no visible difference through a 38px blur.
    const SCALE = 0.5;

    const resize = () => {
      width  = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width  = Math.max(1, Math.floor(width * SCALE));
      canvas.height = Math.max(1, Math.floor(height * SCALE));
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    // Drifting smoke does not need 60fps; halving the rate halves the blur cost.
    const FRAME_MS = 1000 / 30;

    const draw = (now: number) => {
      if (now - last < FRAME_MS) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      const { playing: isPlaying, playbackRate: rate } = stateRef.current;

      // Ease toward full energy while playing, toward a resting swell when not.
      const target = isPlaying ? 1 : 0.18;
      energyRef.current += (target - energyRef.current) * Math.min(dt * 2.5, 1);

      if (!reduceMotion) timeRef.current += dt * (isPlaying ? rate : 0.22);
      const t = timeRef.current;

      // Incommensurate sines — reads as musical dynamics without looping audibly.
      const swell =
        0.55 +
        0.45 * (0.50 * Math.sin(t * 1.70) +
                0.30 * Math.sin(t * 0.61 + 1.3) +
                0.20 * Math.sin(t * 2.90 + 0.4));
      const energy = energyRef.current * swell;

      ctx.clearRect(0, 0, width, height);

      for (const layer of LAYERS) {
        const baseY = height * layer.baseline;
        const amp   = height * 0.13 * layer.amp * energy;

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, baseY);

        for (let x = 0; x <= width; x += 6) {
          const p = x / width;
          const y =
            baseY -
            Math.sin(p * Math.PI * 2 * layer.freq + t * layer.speed * 2.2) * amp -
            Math.sin(p * Math.PI * 2 * layer.freq * 2.3 + t * layer.speed * 1.1) * amp * 0.35;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        // Matched to the red smoke in the photograph: a hot orange-red high up
        // that deepens to saturated crimson at the floor. Long, even falloff —
        // the CSS blur turns these bands into haze rather than defined shapes.
        const gradient = ctx.createLinearGradient(0, baseY - height * 0.34, 0, height);
        gradient.addColorStop(0,    'rgba(255,110,50,0)');
        gradient.addColorStop(0.22, `rgba(240,70,30,${layer.alpha * 0.22})`);
        gradient.addColorStop(0.55, `rgba(226,40,18,${layer.alpha * 0.62})`);
        gradient.addColorStop(1,    `rgba(206,22,10,${layer.alpha})`);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed z-0"
      style={{
        // Overhangs the viewport on three sides so the blur's soft edges fall
        // outside the visible area — otherwise the haze would visibly fade out
        // at the left, right and bottom of the screen.
        left:   '-8%',
        width:  '116%',
        bottom: '-10%',
        height: 'min(64vh, 540px)',

        // The blur is what turns three sine bands into drifting smoke.
        filter: 'blur(38px)',

        // `screen` adds red light onto the photograph rather than covering it.
        mixBlendMode: 'screen',

        // Long, eased fade upward — no hard edge anywhere.
        maskImage:
          'linear-gradient(to top, rgba(0,0,0,1) 20%, rgba(0,0,0,0.78) 42%, rgba(0,0,0,0.35) 66%, rgba(0,0,0,0.1) 84%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage:
          'linear-gradient(to top, rgba(0,0,0,1) 20%, rgba(0,0,0,0.78) 42%, rgba(0,0,0,0.35) 66%, rgba(0,0,0,0.1) 84%, rgba(0,0,0,0) 100%)',
      }}
    />
  );
}
