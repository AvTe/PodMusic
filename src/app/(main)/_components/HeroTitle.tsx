'use client';

interface Props {
  /** Line shown under the wordmark. */
  quote: string;
  /** Series name, shown small above the wordmark once a playlist is loaded. */
  series?: string;
}

export function HeroTitle({ quote, series }: Props) {
  return (
    <div className="flex select-none flex-col items-center text-center">
      {series && (
        <p className="mb-5 max-w-xl truncate px-4 text-[11px] font-medium uppercase tracking-[0.42em] text-white/45">
          {series}
        </p>
      )}

      <h1
        className="text-[16vw] leading-[0.9] text-white sm:text-[11vw] lg:text-[8vw]"
        style={{
          fontWeight:    600,
          letterSpacing: '0.02em',
          textShadow:    '0 8px 60px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        OSHO
        {/* The wordmark alone is the whole visible heading, which tells a
            crawler nothing. This states what the page actually is — read by
            screen readers too. */}
        <span className="sr-only"> discourses — listen to full audio series online with ambient sound</span>
      </h1>

      <p className="mt-6 max-w-2xl text-balance px-6 text-base font-light text-white/70 sm:text-lg">
        {quote}
      </p>
    </div>
  );
}
