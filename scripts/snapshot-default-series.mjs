/**
 * Regenerates src/data/default-series.json — the bundled copy of the default
 * series that first-time visitors start on, so they never wait on a live scrape.
 *
 * Usage (against a running server — dev, `npm run start`, or the deployment):
 *   node scripts/snapshot-default-series.mjs [baseUrl]
 *
 * baseUrl defaults to http://localhost:3000. Re-run whenever the source site
 * changes its file names or adds tracks, then commit the JSON.
 */
import { writeFile } from 'node:fs/promises';

const SERIES_URL = 'https://oshoworld.com/maha-geeta-by-osho-01-91';
const OUT        = new URL('../src/data/default-series.json', import.meta.url);
const base       = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

const res  = await fetch(`${base}/api/scrape`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({ url: SERIES_URL }),
});
const data = await res.json();

if (!res.ok || data.error || !data.tracks?.length) {
  console.error('Snapshot failed, file left unchanged:', data.error ?? res.status);
  process.exit(1);
}

const snapshot = {
  url:       SERIES_URL,
  thumbnail: data.thumbnail ?? null,
  // Scraped ids embed Date.now(); index ids keep the committed file diffable.
  tracks:    data.tracks.map((t, i) => ({ id: String(i), title: t.title, src: t.src, duration: t.duration ?? '' })),
};

await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Wrote ${snapshot.tracks.length} tracks to ${OUT.pathname}`);
