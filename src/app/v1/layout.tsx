import type { Metadata } from 'next';

/**
 * The superseded player. It renders the same feature set as `/`, so leaving it
 * indexable would put two near-identical pages in the index competing with each
 * other. Crawlable (robots.txt does not block it) but noindex.
 */
export const metadata: Metadata = {
  title:      'PodMixer v1 — original player',
  robots:     { index: false, follow: true },
  alternates: { canonical: '/' },
};

export default function V1Layout({ children }: { children: React.ReactNode }) {
  return children;
}
