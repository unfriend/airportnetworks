// Offline support: the app shell is cached on install, so the installed app
// opens without a network connection. Bump VERSION when you change any file.
const VERSION = 'networks-v29';
const SHELL = ['./', './index.html', './proteins.html', './spatial.html', './stories/airports.js', './stories/proteins.js', './stories/spatial.js', './stories/lbi.js', './three.min.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

const AUDIO = ['./audio/narration.mp3', './audio/narration-proteins.mp3', './audio/narration-spatial.mp3', './audio/narration-lbi.mp3'];
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

// The page and the story files must come from the same version: a new page running an old story
// file breaks (a story that ends opens explore mode although Repeat is on). So they are fetched
// from the network first, checked with the server each time (hosts such as GitHub Pages let the
// browser keep files for ten minutes), and the cache is only the copy for offline use.
self.addEventListener('install', e => {
  // straight from the server, not from the browser's HTTP cache, which may still hold the old version
  const get = u => new Request(u, { cache: 'reload' });
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(get)).then(() =>
    // the narrations are optional: cache those that exist
    Promise.all(AUDIO.map(a => fetch(get(a)).then(r => (r.ok ? c.put(a, r) : null)).catch(() => null)))))
    .then(() => self.skipWaiting()));
});
// the network's answer (and a fresh copy in the cache); the cached copy when the network fails,
// or when it has not answered within a few seconds and a copy exists
function fresh(net, key) {
  const cached = () => caches.match(key, { ignoreSearch: true });
  net = net.then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
    return res;
  });
  const safe = net.catch(() => cached().then(hit => hit || Response.error()));
  const slow = new Promise(r => setTimeout(r, 4000)).then(cached).then(hit => hit || safe);
  return Promise.race([safe, slow]);
}
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // pages: network first, checked with the server; each page is cached under its own name
  // (the bare folder URL is index.html)
  if (req.mode === 'navigate') {
    const m = /\/(proteins|spatial)\.html$/.exec(url.pathname), page = m ? './' + m[1] + '.html' : './index.html';
    e.respondWith(fresh(fetch(req, { cache: 'no-cache' }), page));
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
  const narr = url.origin === self.location.origin && /\/audio\/(narration(-proteins|-spatial|-lbi)?\.mp3)$/.exec(url.pathname);
  if (narr) {
    e.respondWith(caches.match('./audio/' + narr[1]).then(hit => {
      if (!hit) return fetch(req);
      return req.headers.has('range') ? rangeResponse(req, hit) : hit.clone();
    }));
    return;
  }
  // everything else from this app (story files, three.js, icons): network first, checked with the server
  if (url.origin === self.location.origin) {
    e.respondWith(fresh(fetch(req, { cache: 'no-cache' }), url.origin + url.pathname));
  }
});
