'use client';

import { ExternalLink, X } from 'lucide-react';

const GITHUB_URL = 'https://github.com/Avte';
const ISSUES_URL = 'https://github.com/AvTe/PodMusic/issues';

interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Attribution and legal notice. Typographic quotes and apostrophes are used
 * throughout so the copy does not trip react/no-unescaped-entities.
 */
const NOTICES: { heading: string; body: string }[] = [
  {
    heading: 'Independent project',
    body:
      'This is an independent, non-commercial personal project. It is not affiliated with, ' +
      'authorised by, endorsed by, sponsored by or connected to Osho International Foundation, ' +
      'OSHO International, oshoworld.com, or any other rights holder.',
  },
  {
    heading: 'Trademarks',
    body:
      'OSHO is a registered trademark of Osho International Foundation. The name is used here ' +
      'only to identify the recordings being played — nominative use — and implies no association, ' +
      'endorsement or licence.',
  },
  {
    heading: 'Content and copyright',
    body:
      'No audio is hosted, uploaded, sold or redistributed by this site. Recordings are streamed ' +
      'directly from the third-party address you enter, and ambient sound is played through YouTube’s ' +
      'embedded player under YouTube’s Terms of Service. Copyright in the discourses, recordings, ' +
      'translations and artwork remains entirely with their respective owners.',
  },
  {
    heading: 'Stored on your device only',
    body:
      'For resuming and offline listening, your own browser caches playback position and parts of ' +
      'the audio locally. This project runs no media server and keeps no copy of any recording.',
  },
  {
    heading: 'Your responsibility',
    body:
      'You are responsible for ensuring that your access to any third-party material through this ' +
      'player complies with that source’s terms and with the law that applies to you. Personal, ' +
      'non-commercial listening only.',
  },
  {
    heading: 'Rights holders',
    body:
      'If you hold rights in material reachable through this site and want it removed, please open ' +
      'an issue on the repository below. Any valid request will be acted on promptly.',
  },
  {
    heading: 'No warranty',
    body:
      'The site is provided “as is”, without warranty of any kind, express or implied, to the fullest ' +
      'extent permitted by law. Nothing here is legal, medical or therapeutic advice.',
  },
];

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function ColophonTab({ open, onOpen, onClose }: Props) {
  return (
    <>
      {/* ── Edge tab ──────────────────────────────────────────────────────── */}
      <button
        onClick={onOpen}
        aria-label="About this site — credits and disclaimer"
        aria-expanded={open}
        className={`fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2 rounded-l-xl border border-r-0 border-white/12 bg-black/45 py-4 pl-2.5 pr-2 text-[10px] uppercase tracking-[0.25em] text-white/45 backdrop-blur-xl transition-colors hover:bg-black/70 hover:text-white ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        style={{ writingMode: 'vertical-rl' }}
      >
        <GithubMark className="h-3.5 w-3.5 rotate-90" />
        Made by Amit
      </button>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        aria-label="Credits and disclaimer"
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(400px,100vw)] flex-col border-l border-white/12 bg-[#0b0e26]/90 backdrop-blur-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pb-4 pt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">About</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-7 overflow-y-auto px-6 pb-10">

          {/* Credit */}
          <section>
            <h3 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-white/45">Made by</h3>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-white/12 px-4 py-3 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <GithubMark className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">Amit</span>
                <span className="block truncate text-[11px] text-white/40">github.com/Avte</span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/30" />
            </a>
          </section>

          {/* Disclaimer */}
          <section>
            <h3 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-white/45">Disclaimer</h3>
            <div className="flex flex-col gap-4">
              {NOTICES.map(({ heading, body }) => (
                <div key={heading}>
                  <p className="mb-1 text-[12px] font-semibold text-white/75">{heading}</p>
                  <p className="text-[12px] leading-relaxed text-white/45">{body}</p>
                </div>
              ))}
            </div>

            <a
              href={ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex items-center justify-between rounded-xl border border-white/12 px-4 py-2.5 text-[12px] text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              Report a rights issue
              <ExternalLink className="h-3.5 w-3.5 text-white/30" />
            </a>
          </section>
        </div>
      </aside>
    </>
  );
}
