/**
 * PodMixer Service Worker
 *
 * This worker deliberately does NOT intercept audio requests.
 *
 * It used to serve them cache-first, which caused two bugs:
 *
 *   1. Playback could not be resumed after a pause. Calling respondWith() on a
 *      media request proxies the whole byte stream through the worker. Browsers
 *      terminate an idle worker after roughly 30 seconds, which killed the
 *      in-flight stream while playback was paused. Pressing play then read from
 *      a dead stream, the element entered an error state, and every later
 *      play() rejected until the page was reloaded.
 *
 *   2. Slow starts, worst on mobile. Every byte was proxied through the worker
 *      instead of going straight to the network, and any full 200 response was
 *      passed to cache.put(response.clone()), which buffers the entire file —
 *      these discourses are ~40MB each.
 *
 * Caching also never actually worked: the host answers range requests with 206,
 * and only status 200 was ever stored.
 *
 * Media caching can come back later, but it has to be an explicit "download for
 * offline" action that fetches the file itself and stores it — never an
 * interception of the element's own streaming requests.
 *
 * There is no fetch handler at all. That is intentional: a worker without one is
 * treated as a no-op for navigation, so nothing sits between the audio element
 * and the network.
 */

self.addEventListener('install', () => {
  // Take over immediately so clients stop using the old caching worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        // Drop every previous audio cache, including partially stored 40MB files.
        keys.filter((key) => key.startsWith('podmixer-audio-')).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});
