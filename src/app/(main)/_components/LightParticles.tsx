'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  radius: number;
  speed: number;   // upward, px per second
  sway: number;    // horizontal drift amplitude
  phase: number;   // keeps each mote's sway out of step with the others
  alpha: number;
  sprite: number;
}

/** Warm tones lifted from the backdrop and the wave below it. */
const SPRITE_COLORS = ['255,214,160', '255,255,255', '255,150,90'];

/** Cursor influence: how far it reaches, and how far motes step aside. */
const POINTER_RADIUS = 200;
const POINTER_PUSH   = 26;
/** How much the whole field leans toward the cursor. Deliberately tiny. */
const PARALLAX = 0.012;

/**
 * Slow-rising points of light, drifting up out of the glow at the bottom.
 *
 * Motes are drawn from three pre-rendered sprites rather than a per-frame
 * radial gradient each — gradients are the expensive part, and at ~70 motes
 * that difference is what keeps this off the main thread's critical path.
 *
 * Movement is intentionally slight: a mote crosses the screen in about a
 * minute, and the cursor only parts them rather than pushing them around.
 */
export function LightParticles() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number | null>(null);
  // Eased pointer, and the raw target it chases.
  const pointerRef = useRef({ x: -9999, y: -9999, tx: -9999, ty: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Sprites ───────────────────────────────────────────────────────────
    const sprites = SPRITE_COLORS.map((rgb) => {
      const size = 64;
      const off  = document.createElement('canvas');
      off.width = off.height = size;
      const octx = off.getContext('2d');
      if (octx) {
        const gradient = octx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0,    `rgba(${rgb},1)`);
        gradient.addColorStop(0.35, `rgba(${rgb},0.45)`);
        gradient.addColorStop(1,    `rgba(${rgb},0)`);
        octx.fillStyle = gradient;
        octx.fillRect(0, 0, size, size);
      }
      return off;
    });

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];

    const spawn = (initial: boolean): Particle => ({
      x:      Math.random() * width,
      // Start spread out on first fill, then always from just below the fold.
      y:      initial ? Math.random() * height : height + Math.random() * 60,
      radius: 1.2 + Math.random() * 3.4,
      speed:  6 + Math.random() * 14,
      sway:   8 + Math.random() * 26,
      phase:  Math.random() * Math.PI * 2,
      alpha:  0.12 + Math.random() * 0.4,
      sprite: Math.floor(Math.random() * sprites.length),
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width  = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width  = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Scale the count to the viewport so phones do far less work.
      const target = Math.min(70, Math.round((width * height) / 26000));
      if (particles.length === 0) {
        particles = Array.from({ length: target }, () => spawn(true));
      } else if (target > particles.length) {
        particles.push(...Array.from({ length: target - particles.length }, () => spawn(true)));
      } else {
        particles.length = target;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.tx = e.clientX;
      pointerRef.current.ty = e.clientY;
    };
    const onPointerLeave = () => {
      pointerRef.current.tx = -9999;
      pointerRef.current.ty = -9999;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);

    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const pointer = pointerRef.current;
      // Ease toward the cursor so the field never snaps.
      pointer.x += (pointer.tx - pointer.x) * Math.min(dt * 4, 1);
      pointer.y += (pointer.ty - pointer.y) * Math.min(dt * 4, 1);

      const leanX = pointer.tx > -9998 ? (pointer.x - width / 2) * PARALLAX : 0;
      const leanY = pointer.ty > -9998 ? (pointer.y - height / 2) * PARALLAX : 0;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (const p of particles) {
        if (!reduceMotion) {
          p.y -= p.speed * dt;
          p.phase += dt * 0.35;
          if (p.y < -30) Object.assign(p, spawn(false));
        }

        const swayX = Math.sin(p.phase) * p.sway;
        let x = p.x + swayX - leanX;
        let y = p.y - leanY;

        // Part gently around the cursor rather than fleeing it.
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < POINTER_RADIUS && distance > 0.01) {
          const push = (1 - distance / POINTER_RADIUS) * POINTER_PUSH;
          x += (dx / distance) * push;
          y += (dy / distance) * push;
        }

        // Fade out over the top third so nothing pops out of existence.
        const fade = y < height * 0.35 ? Math.max(0, y / (height * 0.35)) : 1;

        ctx.globalAlpha = p.alpha * fade;
        const size = p.radius * 2;
        ctx.drawImage(sprites[p.sprite], x - p.radius, y - p.radius, size, size);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(draw);
    };

    const start = () => {
      if (rafRef.current === null) {
        last = performance.now();
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    const stop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    // Don't burn battery animating a tab nobody is looking at.
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
