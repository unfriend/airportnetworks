// Offline support: the app shell is cached on install, so the installed app
// opens without a network connection. Bump VERSION when you change any file.
const VERSION = 'airport-networks-v10';
const SHELL = ['./', './index.html', './three.min.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

const AUDIO = './audio/narration.mp3';
// media elements ask for byte ranges; answer them from the cached file
async function rangeResponse(req, cached) {
  const buf = await cached.arrayBuffer(), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : size - 1;
  if (m && !m[1] && m[2]) { start = size - +m[2]; end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
    'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).then(() =>
    // the narration is optional: cache it if it exists
    fetch(AUDIO).then(r => (r.ok ? c.put(AUDIO, r) : null)).catch(() => null)))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // pages: network first (to pick up updates), cached copy when offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // web font (Google Fonts): cache whatever we get, use the cache when offline
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  // the narration: from the cache when it is there (as byte ranges), else the network
  if (url.origin === self.location.origin && url.pathname.endsWith('/audio/narration.mp3')) {
    e.respondWith(caches.match(AUDIO).then(hit => {
      if (!hit) return fetch(req);
      return req.headers.has('range') ? rangeResponse(req, hit) : hit;
    }));
    return;
  }
  // everything else from this app: cache first
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
  }
});
