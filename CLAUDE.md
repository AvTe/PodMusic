# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm install      # required before anything — node_modules is not checked in
npm run dev      # dev server on :3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint 9 flat config (core-web-vitals + typescript)
```

The `lint` script used to call `next lint`, which Next 16 removed — it failed with `Invalid project directory provided, no such directory: ...\lint`. It now calls `eslint` directly. Do not "restore" `next lint`.

Because that script was broken for a while, **~4 eslint errors and ~9 warnings are already present on a clean checkout** — `setState` inside an effect, unescaped `"` in JSX, unused vars, `react-hooks/refs`. `next build` does not run eslint under Turbopack, so none of them ever blocked a deploy. When judging whether a change is lint-clean, diff the counts against the baseline rather than expecting zero.

No test framework is configured — there is no `test` script and no test files.

The `@AGENTS.md` rule about reading `node_modules/next/dist/docs/` only works after `npm install`. Next 16 + React 19 + Tailwind v4 here; do not assume older API shapes.

## Architecture

The app ("PodMixer" in the UI; `podmusic` in package.json) scrapes an audiobook/podcast page for MP3s, plays them, and layers a YouTube ambient loop underneath.

### Two pages, one feature set

Two independent front-ends over the same backend:

- **`/`** — [src/app/(main)/](src/app/(main)/), the cinematic full-bleed design. This is the live product. Presentation only; it consumes extracted hooks from [src/hooks/](src/hooks/) (`usePlaylistLoader`, `useAudioPlayback`, `useTrackCompletion`, `useSleepTimer`, `useAutoplayCountdown`). `(main)` is a route group — the parentheses keep it out of the URL, so `(main)/page.tsx` serves `/` while its `layout.tsx` supplies the Poppins font and per-page metadata.
- **`/v1`** — [src/app/v1/page.tsx](src/app/v1/page.tsx), the original dark two-column player, superseded but kept for comparison. All its logic is inline. **Do not restyle it.**

`/osho` (the redesign's address while it was being built) 307-redirects to `/` via `redirects()` in [next.config.ts](next.config.ts).

Both pages mount the same Zustand store, so playback state carries across navigation. **The same behavior is implemented twice** — `/v1` inline, `/` via hooks. A bugfix in one does not reach the other. Deleting `/v1` removes the duplication whenever it stops being useful.

### Everything lives in one client component (`/v1` only)

[src/app/v1/page.tsx](src/app/v1/page.tsx) is that page's whole UI — playlist, player, mixer, sleep timer, autoplay toast, seek bar — with local sub-components (e.g. `YTAmbientPlayer`) declared inline. The main page at `/` does not work this way: it is decomposed into [src/app/(main)/_components/](src/app/(main)/_components/).

### Two independent audio engines

1. **Foreground track** — a plain `<audio ref={audioRef}>` element. Volume, `playbackRate`, seeking and `timeupdate` are driven imperatively off the ref, not React state.
2. **Ambient bed** — `YTAmbientPlayer`, a 2×2px invisible `<iframe>` pointed at `youtube.com/embed/{id}?enablejsapi=1`, commanded with `postMessage({event:'command', func:'playVideo'|'pauseVideo'|'setVolume'})`.

The two are **fully independent** — separate volumes, separate transports, and `isBackgroundPlaying` is toggled only by the Ambient Status tile. Pausing the narration does not pause the ambient loop; there is no sync logic between them.

**`react-player` is in `package.json` but is intentionally unused.** It falls back to a `<video>` element in production Turbopack builds because its YouTube sub-module dynamic import never resolves. Do not "fix" the raw iframe by reintroducing react-player — that regression was already shipped and reverted (commits `c15ef40`, `dce8002`). The iframe's `readyRef`/`latestRef` pattern exists because commands sent before `onLoad` are dropped.

### State

[src/store/usePlayerStore.ts](src/store/usePlayerStore.ts) — Zustand, **not persisted**; durability comes from IndexedDB instead. Inside `setInterval`/`setTimeout` callbacks read fresh state via `usePlayerStore.getState()` rather than closed-over values (the autoplay countdown does this deliberately).

Two different URL states exist and must not be conflated: `url` is the search-box input; `playlistUrl` is the canonical IndexedDB key, set only after a load succeeds. Every DB write is a no-op while `playlistUrl` is empty.

### Scraping — [src/app/api/scrape/route.ts](src/app/api/scrape/route.ts)

`POST /api/scrape` with `{ url }`, strips any `?page=`, then tries two strategies in order:

**Strategy 1 — `__NEXT_DATA__`** (for Next.js-built sites like oshoworld.com). Parses `props.pageProps.data.pageData.{listData,total}`. `extrapolateFromPattern` then detects the sequential filename pattern from the first two items (`…_01.mp3` → `…_02.mp3`) and **generates all N track URLs with zero extra HTTP requests**, only backfilling durations page by page. Duration backfill tries three URL shapes in sequence per page because the target site's pagination endpoint varies: `/_next/data/{buildId}/{slug}/{page}.json`, `/api/{apiPath}/{slug}?page=N`, then `/_next/data/{buildId}/{slug}.json?page=N`. If the pattern doesn't hold, it falls back to walking the internal API page by page.

**Strategy 2 — Cheerio.** Selects `a[href$=".mp3"]`, then walks `prevAll('a')` backwards: nearest time-shaped text is the duration, nearest non-time text is the title, with a `.row/tr/li` ancestor as fallback. Loops `?page=N` and stops when a page adds no new `src`.

Both paths cap at **20 pages** and sleep 300–800 ms between requests. These limits are deliberate politeness throttling — keep them when editing.

Note the type asymmetry: this route defines its own local `Track` type and returns unvalidated JSON; the Zod `audioTrackSchema` in [src/types/audio.ts](src/types/audio.ts) is only used for the client-side `AudioTrack` type.

### Three persistence layers

1. **IndexedDB** — [src/lib/db.ts](src/lib/db.ts), `podmixer-db` v2, hand-rolled on the raw `indexedDB.open()` API with manual Promise wrapping. **The `idb` package is not a dependency** — do not `import { openDB } from 'idb'`. Stores: `playlists` (scrape cache keyed by URL, 7-day TTL enforced on read, not eviction), `progress` (resume position keyed by URL), `trackCompletion` (keyed `${playlistUrl}::${trackIndex}`, with a `byPlaylist` index driving the YouTube-style red bars). Adding a store means bumping `DB_VERSION` **and** adding a `contains()`-guarded `createObjectStore` in `onupgradeneeded` — existing guards must stay so old clients upgrade cleanly.
2. **Service worker** — [public/sw.js](public/sw.js), registered on mount. Cache-first for `mp3|ogg|m4a|wav|aac|flac|opus` only; every other request passes straight through. Bump `CACHE_VERSION` to invalidate on deploy.
3. **[usePlaybackPersistence](src/hooks/usePlaybackPersistence.ts)** — restores position when `playlistUrl` changes, saves every 5 s and on `beforeunload`. Track-completion writes are separately debounced at 3 s in `page.tsx`.

Cache-before-network is the load order: `fetchTracks` checks `getCachedPlaylist(url)` first and only hits `/api/scrape` on a miss.

### Styling

Tailwind v4 via `@tailwindcss/postcss` — no `tailwind.config.js`. Fixed dark palette hardcoded in class names (`#09090b` page, `#121214` panels, `#818CF8` primary, `#2dd4bf` ambient); there is no theme system or light mode.

[src/app/globals.css](src/app/globals.css) is still untouched create-next-app boilerplate and is effectively dead: its `--background`/`--foreground` light/dark tokens and `body { font-family: Arial }` are both overridden by `page.tsx`, which paints the full viewport with `bg-[#09090b] font-sans`. Changing globals.css will not change the app's appearance — edit the class names instead.

Deploys to Vercel: https://podmusic-vert.vercel.app/
