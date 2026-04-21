/**
 * PodMixer – IndexedDB layer
 * Stores:
 *   "playlists"  — scrape cache keyed by URL (TTL: 7 days)
 *   "progress"   — per-URL playback position & track index
 */

const DB_NAME    = 'podmixer-db';
const DB_VERSION = 1;
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

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'url' });
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
      // Expire if older than TTL
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

// ─── Playback progress ────────────────────────────────────────────────────────

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
