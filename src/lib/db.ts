/**
 * PodMixer – IndexedDB layer
 * Stores:
 *   "playlists"       — scrape cache keyed by URL (TTL: 7 days)
 *   "progress"        — per-URL playback position & track index
 *   "trackCompletion" — per-track watch percentage (YouTube-style red bar) [v2]
 */

const DB_NAME    = 'podmixer-db';
const DB_VERSION = 2;                              // ← bumped for new store
const PLAYLIST_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CachedPlaylist {
  url:       string;
  tracks:    unknown[];
  thumbnail: string | null;
  cachedAt:  number;
}

export interface PlaybackProgress {
  url:         string;
  trackIndex:  number;
  currentTime: number;
  savedAt:     number;
}

/** Per-track watch completion — the "red bar" on each row */
export interface TrackCompletion {
  /** Composite key: `${playlistUrl}::${trackIndex}` */
  id:          string;
  playlistUrl: string;
  trackIndex:  number;
  /** 0 – 100 */
  percentage:  number;
  /** true when percentage >= 95 */
  completed:   boolean;
  savedAt:     number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // v1 stores (idempotent)
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'url' });
      }

      // v2: per-track completion
      if (!db.objectStoreNames.contains('trackCompletion')) {
        const store = db.createObjectStore('trackCompletion', { keyPath: 'id' });
        store.createIndex('byPlaylist', 'playlistUrl', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ─── Playlist cache ───────────────────────────────────────────────────────────

export async function cachePlaylist(entry: CachedPlaylist): Promise<void> {
  const db    = await openDB();
  const tx    = db.transaction('playlists', 'readwrite');
  const store = tx.objectStore('playlists');
  store.put(entry);
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

export async function getCachedPlaylist(url: string): Promise<CachedPlaylist | null> {
  const db    = await openDB();
  const tx    = db.transaction('playlists', 'readonly');
  const store = tx.objectStore('playlists');
  const req   = store.get(url);
  return new Promise((res, rej) => {
    req.onsuccess = () => {
      const entry: CachedPlaylist | undefined = req.result;
      if (!entry) return res(null);
      if (Date.now() - entry.cachedAt > PLAYLIST_TTL_MS) return res(null);
      res(entry);
    };
    req.onerror = () => rej(req.error);
  });
}

export async function getAllCachedPlaylists(): Promise<CachedPlaylist[]> {
  const db    = await openDB();
  const tx    = db.transaction('playlists', 'readonly');
  const store = tx.objectStore('playlists');
  const req   = store.getAll();
  return new Promise((res, rej) => {
    req.onsuccess = () => res((req.result ?? []).filter(
      (e: CachedPlaylist) => Date.now() - e.cachedAt <= PLAYLIST_TTL_MS
    ));
    req.onerror = () => rej(req.error);
  });
}

// ─── Playback progress (resume position) ─────────────────────────────────────

export async function saveProgress(entry: PlaybackProgress): Promise<void> {
  const db    = await openDB();
  const tx    = db.transaction('progress', 'readwrite');
  const store = tx.objectStore('progress');
  store.put(entry);
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

export async function getProgress(url: string): Promise<PlaybackProgress | null> {
  const db    = await openDB();
  const tx    = db.transaction('progress', 'readonly');
  const store = tx.objectStore('progress');
  const req   = store.get(url);
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = () => rej(req.error);
  });
}

// ─── Track completion (YouTube-style watch bar) ───────────────────────────────

export async function saveTrackCompletion(entry: TrackCompletion): Promise<void> {
  const db    = await openDB();
  const tx    = db.transaction('trackCompletion', 'readwrite');
  const store = tx.objectStore('trackCompletion');
  store.put(entry);
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}

/**
 * Returns all per-track completion entries for the given playlist URL,
 * as a map of `trackIndex → TrackCompletion`.
 */
export async function getPlaylistCompletions(
  playlistUrl: string
): Promise<Record<number, TrackCompletion>> {
  const db    = await openDB();
  const tx    = db.transaction('trackCompletion', 'readonly');
  const store = tx.objectStore('trackCompletion');
  const index = store.index('byPlaylist');
  const req   = index.getAll(playlistUrl);
  return new Promise((res, rej) => {
    req.onsuccess = () => {
      const map: Record<number, TrackCompletion> = {};
      (req.result as TrackCompletion[]).forEach(c => { map[c.trackIndex] = c; });
      res(map);
    };
    req.onerror = () => rej(req.error);
  });
}
