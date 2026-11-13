/* Bubble Pop Party: offline support.
 *
 * The first visit saves every file of the game on the device. After that the game starts from those
 * saved copies, so it works with no internet. When the game changes, CACHE_VERSION changes, the new
 * files are saved, and the old copy is deleted.
 *
 * The build (tools/build.mjs) fills in the file list and the version. This must be served as sw.js at the
 * site root: the iPad only updates an installed offline helper from the same address.
 */
/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope;
declare const __CACHE_VERSION__: string;
declare const __PRECACHE__: string[];

const CACHE_VERSION: string = __CACHE_VERSION__;
const PRECACHE: string[] = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // 'reload' skips the browser's own short-term copy, so we always save the newest files
      Promise.all(PRECACHE.map((url) =>
        fetch(new Request(url, { cache: 'reload' })).then((res) => {
          if (!res.ok) throw new Error(url + ' ' + res.status);
          return cache.put(url, res);
        })
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    // ignoreSearch: "?debug" and the like still find the saved page
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit): Response | Promise<Response> => {
        if (hit) {
          // Safari asks for audio in byte ranges and stalls or fails if it gets the whole file back
          // as a plain 200. Answer a range request with a proper 206 slice of the saved file.
          const range = req.headers && req.headers.get && req.headers.get('range');
          const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
          if (!m || !hit.arrayBuffer) return hit;
          const [, from = '', to = ''] = m;
          return hit.arrayBuffer().then((buf) => {
            const size = buf.byteLength;
            const start = from === '' ? Math.max(0, size - Number(to)) : Number(from);
            const end = from === '' || to === '' ? size - 1 : Math.min(Number(to), size - 1);
            if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
            return new Response(buf.slice(start, end + 1), {
              status: 206,
              headers: {
                'Content-Type': hit.headers.get('Content-Type') || 'audio/mp4',
                'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
                'Content-Length': String(end - start + 1)
              }
            });
          });
        }
        return fetch(req).catch(() =>
          // offline and not saved: opening the game's address still shows the game
          req.mode === 'navigate'
            ? cache.match('index.html').then((page) => page || Response.error())
            : Response.error()
        );
      })
    )
  );
});
