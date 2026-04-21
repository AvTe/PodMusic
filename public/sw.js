/**
 * PodMixer Service Worker
 * Strategy:
 *   - Audio files (.mp3, .ogg, .m4a, .wav, .aac) → Cache-first (offline-capable)
 *   - Anything else → Network-only (pass-through)
 *
 * Cache versioning: bump CACHE_VERSION to force full cache refresh on deploy.
 */

const CACHE_VERSION = 'v1';
const AUDIO_CACHE   = `podmixer-audio-${CACHE_VERSION}`;

// Audio file extensions we cache
const AUDIO_RE = /\.(mp3|ogg|m4a|wav|aac|flac|opus)(\?.*)?$/i;

self.addEventListener('install', (event) => {
  // Activate immediately — don't wait for old SW to die
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete stale caches from previous versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('podmixer-audio-') && k !== AUDIO_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only cache GET requests for audio files
  if (event.request.method !== 'GET' || !AUDIO_RE.test(url.pathname)) return;

  event.respondWith(
    caches.open(AUDIO_CACHE).then(async (cache) => {
      // Try cache first
      const cached = await cache.match(event.request);
      if (cached) return cached;

      // Not cached — fetch from network and store a copy
      try {
        const response = await fetch(event.request);
        // Only cache successful, non-opaque responses to avoid storing errors
        if (response.ok && response.status === 200) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        // Offline with no cache → browser will show its own error
        return new Response('Audio not cached', { status: 503 });
      }
    })
  );
});
