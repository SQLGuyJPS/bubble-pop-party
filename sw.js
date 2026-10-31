/* Bubble Pop Party: offline support.
 *
 * The first visit saves every file of the game on the device. After that the game starts from those
 * saved copies, so it works with no internet. When the game changes, CACHE_VERSION changes, the new
 * files are saved, and the old copy is deleted.
 *
 * Do not edit the two marked lines by hand: `node tools/update-sw.mjs` rewrites them.
 */
/* SW_VERSION:begin */
var CACHE_VERSION = 'bubble-pop-party-4d4bcc3c6c';
/* SW_VERSION:end */
/* SW_FILES:begin */
var PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'fonts/Andika-Bold.ttf',
  'audio/prompt-A.m4a'
];
/* SW_FILES:end */

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // 'reload' skips the browser's own short-term copy, so we always save the newest files
      return Promise.all(PRECACHE.map(function (url) {
        return fetch(new Request(url, { cache: 'reload' })).then(function (res) {
          if (!res.ok) throw new Error(url + ' ' + res.status);
          return cache.put(url, res);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE_VERSION; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    // ignoreSearch: "?debug" and the like still find the saved page
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) {
          // Safari asks for audio in byte ranges and stalls or fails if it gets the whole file back
          // as a plain 200. Answer a range request with a proper 206 slice of the saved file.
          var range = req.headers && req.headers.get && req.headers.get('range');
          var m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!m || !hit.arrayBuffer) return hit;
          return hit.arrayBuffer().then(function (buf) {
            var size = buf.byteLength;
            var start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
            var end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
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
        return fetch(req).catch(function () {
          // offline and not saved: opening the game's address still shows the game
          return req.mode === 'navigate' ? cache.match('index.html') : Response.error();
        });
      });
    })
  );
});
