import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

type Track = { id: string; title: string; src: string; duration: string };

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Pattern extrapolation ────────────────────────────────────────────────────
// When the API only returns page 1 but we know the total, detect the sequential
// file-name pattern (e.g. OSHO-Maha_Geeta_01.mp3 → 02 → … → 91) and generate
// ALL track URLs without extra HTTP requests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrapolateFromPattern(listData: any[], total: number, origin: string): Track[] | null {
  if (listData.length < 2 || total <= listData.length) return null;

  const f1: string = listData[0]?.file ?? '';
  const f2: string = listData[1]?.file ?? '';
  const FILE_RE = /^(.*?)(\d+)(\.\w+(?:%\d+\w*)?)$/;
  const m1 = f1.match(FILE_RE);
  const m2 = f2.match(FILE_RE);
  if (!m1 || !m2) return null;
  if (m1[1] !== m2[1] || m1[3] !== m2[3]) return null;   // different prefix/ext

  const filePrefix = m1[1];
  const fileExt    = m1[3];
  const numLen     = m1[2].length;                         // e.g. 2 for "01"
  if (parseInt(m2[2]) - parseInt(m1[2]) !== 1) return null; // not +1 step

  // Detect title prefix (everything before the trailing number)
  const t1 = (listData[0]?.title ?? '').trim();
  const t2 = (listData[1]?.title ?? '').trim();
  const TITLE_RE = /^(.*?)(\d+)\s*$/;
  const tm1 = t1.match(TITLE_RE);
  const tm2 = t2.match(TITLE_RE);
  const titlePrefix = (tm1 && tm2 && tm1[1] === tm2[1]) ? tm1[1] : '';
  const titleNumLen = tm1 ? tm1[2].length : numLen;

  // Build lookup of known items (audio_index → item)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const known = new Map<number, any>(listData.map((it) => [it.audio_index ?? 0, it]));

  const tracks: Track[] = [];
  for (let i = 1; i <= total; i++) {
    const paddedFile  = String(i).padStart(numLen, '0');
    const src = `${origin}${filePrefix}${paddedFile}${fileExt}`;
    const existing = known.get(i);
    const title = existing
      ? (existing.title?.trim() || `Track ${i}`)
      : titlePrefix
        ? `${titlePrefix}${String(i).padStart(titleNumLen, '0')}`
        : `Track ${i}`;
    tracks.push({
      id: `${i - 1}-${Date.now()}`,
      title,
      src,
      duration: existing?.duration ?? '',
    });
  }
  return tracks;
}

// ─── Strategy 1: __NEXT_DATA__ (Next.js sites like Oshoworld) ────────────────
async function tryNextJsStrategy(
  url: string
): Promise<{ tracks: Track[]; thumbnail: string | null; pagesScraped: number } | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const html = await res.text();

    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextData: any = JSON.parse(match[1]);
    const pageData = nextData?.props?.pageProps?.data?.pageData;
    const pageType = nextData?.props?.pageProps?.data?.pageType;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listData: any[] = pageData?.listData ?? [];
    const total: number   = pageData?.total ?? listData.length;
    const apiPath: string = pageType?.api  ?? '';
    const slug:    string = pageType?.slug ?? '';
    if (!listData.length) return null;

    const origin = new URL(url).origin;
    const $ = cheerio.load(html);
    const thumbnail: string | null =
      $('meta[property="og:image"]').attr('content') ??
      (listData[0]?.imageFile ? `${origin}/${listData[0].imageFile}` : null);

    // ── Try sequential pattern first ────────────────────────────────────────
    const extrapolated = extrapolateFromPattern(listData, total, origin);
    if (extrapolated) {
      // Now try to fill in durations for tracks beyond the first page by
      // fetching each page's data via a few different URL strategies.
      const buildId: string = nextData?.buildId ?? '';
      const perPage  = listData.length;               // 10
      const totalPages = Math.ceil(total / perPage);  // e.g. 10 for 91 tracks

      // Build an index: audio_index → position in extrapolated array
      // The extrapolated array is 0-based (index 0 = audio_index 1)
      const fillDuration = (items: any[]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const item of items) {
          const audioIndex: number = item.audio_index ?? 0;
          if (audioIndex >= 1 && audioIndex <= extrapolated.length) {
            const track = extrapolated[audioIndex - 1];
            if (track && !track.duration && item.duration) {
              track.duration = item.duration;
            }
          }
        }
      };

      for (let page = 2; page <= totalPages && page <= 20; page++) {
        await delay(300);
        let fetched = false;

        // Strategy A — path-based: /_next/data/{buildId}/{slug}/{page}.json
        if (buildId && slug) {
          try {
            const r = await fetch(
              `${origin}/_next/data/${buildId}/${slug}/${page}.json`,
              { headers: { 'User-Agent': UA } }
            );
            if (r.ok) {
              const j = await r.json(); // eslint-disable-line @typescript-eslint/no-explicit-any
              const items = j?.pageProps?.data?.pageData?.listData ?? [];
              if (items.length && items[0]?.audio_index !== listData[0]?.audio_index) {
                fillDuration(items);
                fetched = true;
              }
            }
          } catch { /* continue */ }
        }

        // Strategy B — internal series API
        if (!fetched && apiPath && slug) {
          try {
            const r = await fetch(
              `${origin}/api/${apiPath}/${slug}?page=${page}`,
              { headers: { 'User-Agent': UA } }
            );
            if (r.ok) {
              const j = await r.json(); // eslint-disable-line @typescript-eslint/no-explicit-any
              const items = j?.listData ?? j?.data?.listData ?? [];
              if (items.length && items[0]?.audio_index !== listData[0]?.audio_index) {
                fillDuration(items);
                fetched = true;
              }
            }
          } catch { /* continue */ }
        }

        // Strategy C — _next/data with query param
        if (!fetched && buildId && slug) {
          try {
            const r = await fetch(
              `${origin}/_next/data/${buildId}/${slug}.json?page=${page}`,
              { headers: { 'User-Agent': UA } }
            );
            if (r.ok) {
              const j = await r.json(); // eslint-disable-line @typescript-eslint/no-explicit-any
              const items = j?.pageProps?.data?.pageData?.listData ?? [];
              if (items.length && items[0]?.audio_index !== listData[0]?.audio_index) {
                fillDuration(items);
              }
            }
          } catch { /* continue */ }
        }
      }

      return { tracks: extrapolated, thumbnail, pagesScraped: totalPages };
    }

    // ── Fall back: call internal API for each additional page ───────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapItem = (item: any, idx: number): Track => ({
      id: `${idx}-${Date.now()}`,
      title: item.title?.trim() || `Track ${idx + 1}`,
      src: item.file?.startsWith('/') ? `${origin}${item.file}` : (item.file ?? ''),
      duration: item.duration ?? '',
    });

    const allTracks: Track[] = listData.map(mapItem);
    const seenSrcs = new Set<string>(allTracks.map((t) => t.src));
    let pagesScraped = 1;

    if (total > listData.length && apiPath && slug) {
      const perPage    = listData.length;
      const totalPages = Math.ceil(total / perPage);

      for (let page = 2; page <= totalPages && page <= 20; page++) {
        await delay(600); // be polite — guide recommends a delay
        const apiUrl = `${origin}/api/${apiPath}/${slug}?page=${page}`;
        try {
          const apiRes = await fetch(apiUrl, { headers: { 'User-Agent': UA } });
          if (!apiRes.ok) break;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json: any = await apiRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items: any[] = json?.listData ?? json?.data?.listData ?? json?.data ?? [];
          if (!items.length) break;

          let addedNew = false;
          for (const item of items) {
            const src = item.file?.startsWith('/') ? `${origin}${item.file}` : (item.file ?? '');
            if (src && !seenSrcs.has(src)) {
              seenSrcs.add(src);
              allTracks.push(mapItem(item, allTracks.length));
              addedNew = true;
            }
          }
          if (!addedNew) break; // API not paginating → stop
          pagesScraped = page;
        } catch { break; }
      }
    }

    return { tracks: allTracks, thumbnail, pagesScraped };
  } catch { return null; }
}

// ─── Strategy 2: Generic Cheerio scraping ────────────────────────────────────
async function scrapeWithCheerio(
  pageUrl: string,
  globalIndex: number
): Promise<{ tracks: Track[]; thumbnail: string | null }> {
  const res = await fetch(pageUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return { tracks: [], thumbnail: null };

  const html = await res.text();
  const $ = cheerio.load(html);
  const tracks: Track[] = [];

  let thumbnail: string | null = $('meta[property="og:image"]').attr('content') ?? null;
  if (!thumbnail) thumbnail = $('img').first().attr('src') ?? null;
  if (thumbnail?.startsWith('/')) thumbnail = new URL(thumbnail, pageUrl).toString();
  if (!thumbnail)
    thumbnail = 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?q=80&w=600&auto=format&fit=crop';

  const TIME_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;

  $('a[href$=".mp3"]').each((i, element) => {
    let src = $(element).attr('href') ?? '';
    if (!src) return;
    if (src.startsWith('/')) src = new URL(src, pageUrl).toString();

    let title = '';
    let duration = '';

    // Walk backwards through sibling <a> tags: closest time-pattern = duration,
    // closest non-time = title
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $(element).prevAll('a').each((_: number, el: any) => {
      if (title && duration) return false;
      const text = $(el).text().trim();
      if (!text) return;
      if (!duration && TIME_RE.test(text)) {
        duration = text;
      } else if (!title && !TIME_RE.test(text)) {
        const cleaned = text.replace(/share|download/gi, '').replace(/\s+/g, ' ').trim();
        if (cleaned.length >= 3) title = cleaned;
      }
    });

    if (!title) {
      const parentRow = $(element).closest('.row, tr, li, .wp-block-columns');
      let rawText = parentRow.text() || '';
      const dm = rawText.match(/\d{1,2}:\d{2}(:\d{2})?/);
      if (dm) { if (!duration) duration = dm[0]; rawText = rawText.replace(dm[0], ''); }
      title = rawText
        .replace(/share|download/gi, '')
        .replace(/[\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^\d+\.?\s+/, '')
        .trim();
    }

    if (!title || title.length < 3) title = `Track ${globalIndex + i + 1}`;
    if (!tracks.some((t) => t.src === src)) {
      tracks.push({ id: `${globalIndex + i}-${Date.now()}`, title, src, duration });
    }
  });

  return { tracks, thumbnail };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    const parsed = new URL(url);
    parsed.searchParams.delete('page');
    const baseUrl = parsed.toString();

    // Strategy 1 — Next.js __NEXT_DATA__
    const nextResult = await tryNextJsStrategy(baseUrl);
    if (nextResult && nextResult.tracks.length > 0) {
      return NextResponse.json({
        tracks:      nextResult.tracks,
        thumbnail:   nextResult.thumbnail,
        pagesScraped: nextResult.pagesScraped,
      });
    }

    // Strategy 2 — Cheerio HTML loop with delay
    const allTracks: Track[] = [];
    const seenSrcs = new Set<string>();
    let thumbnail: string | null = null;
    let pagesScraped = 0;

    for (let page = 1; page <= 20; page++) {
      if (page > 1) await delay(800); // guide recommends throttling

      const pageUrl = page === 1
        ? baseUrl
        : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page}`;

      const { tracks, thumbnail: thumb } = await scrapeWithCheerio(pageUrl, allTracks.length);
      if (!thumbnail && thumb) thumbnail = thumb;
      if (!tracks.length) break;

      let addedNew = false;
      for (const track of tracks) {
        if (!seenSrcs.has(track.src)) {
          seenSrcs.add(track.src);
          allTracks.push(track);
          addedNew = true;
        }
      }
      if (!addedNew) break;
      pagesScraped = page;
    }

    if (!allTracks.length)
      return NextResponse.json({ error: 'No audio tracks found on this URL.' });

    return NextResponse.json({ tracks: allTracks, thumbnail, pagesScraped });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Failed to scrape the URL.' }, { status: 500 });
  }
}
