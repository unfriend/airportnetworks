// Offline support: the app shell is cached on install, so the installed app
// opens without a network connection. Bump VERSION when you change any file.
const VERSION = 'networks-v121';
const SHELL = ['./', './index.html', './sfx.js', './occlusion.js', './shared.js', './proteins.html', './spatial.html', './stories/list.js', './stories/airports.js', './stories/proteins.js', './stories/spatial.js', './stories/lbi.js', './stories/nmd.js', './stories/endo.js', './stories/pet.js', './stories/micro.js', './stories/ovary.js', './stories/qubits.js', './stories/mutation.js', './stories/topo.js', './stories/soil.js', './stories/pass.js', './stories/flock.js', './stories/robots.js', './stories/design.js', './stories/studio.js', './lowpoly.js', './three.min.js', './peerjs.min.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

const AUDIO = ['./audio/narration.mp3', './audio/narration-proteins.mp3', './audio/narration-spatial.mp3', './audio/narration-lbi.mp3', './audio/narration-nmd.mp3', './audio/narration-endo.mp3', './audio/narration-pet.mp3', './audio/narration-micro.mp3', './audio/narration-ovary.mp3', './audio/narration-qubits.mp3', './audio/narration-mutation.mp3', './audio/narration-topo.mp3', './audio/narration-soil.mp3', './audio/narration-pass.mp3', './audio/narration-pass-de.mp3', './audio/narration-flock.mp3', './audio/narration-robots.mp3'];
// The narrations (about 60 MB together, and seldom changed) keep a cache of their own that outlives the releases. A
// narration goes into it when a story first plays it (the fetch handler below), never all of them at once: ten
// headsets fetching every story's narration at their first visit was 570 MB over one router, while people were already
// in a room. A new worker asks the server only about those this device holds, each with its copy's ETag (or date), and
// fetches only those that changed; a copy in an older release's cache counts too (until v107 they were fetched again
// in full at every release, on every device)
const NARR = 'networks-narration';
async function narrFetch(n, a) {
  const own = await n.match(a), old = own || await caches.match(a), h = {};
  if (!old) return;   // (not held here: fetched when a story first plays it)
  const et = old && old.headers.get('ETag'), lm = old && old.headers.get('Last-Modified');
  if (et) h['If-None-Match'] = et; else if (lm) h['If-Modified-Since'] = lm;
  try {
    const r = await fetch(new Request(a, { cache: 'no-store', headers: h }));
    if (r.status === 304) { if (!own) await n.put(a, old); }
    else if (r.ok) await n.put(a, r);
    else await n.delete(a);   // (taken away, or the server could not say: played from the network next time)
  } catch (e) {
    // (it could not be asked, or its new copy broke off: a copy that may be out of step with the new story's timing is
    // dropped, and the next play fetches it; installing happens online, so this is a hiccup, not being offline)
    await n.delete(a).catch(() => {});
  }
}
// the audio element (the fallback sound engine) asks for byte ranges; answer them from the
// cached file, read once per file while this worker runs
const BYTES = new Map();
async function rangeResponse(req, cached, key) {
  if (!BYTES.has(key)) BYTES.set(key, cached.clone().arrayBuffer());
  const buf = await BYTES.get(key), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
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
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(get)))
    // the narrations this device holds, fetched again only where they changed
    .then(() => caches.open(NARR)).then(n => Promise.all(AUDIO.map(a => narrFetch(n, a))))
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
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== NARR).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // pages: network first, checked with the server; each page is cached under its own name
  // (the bare folder URL is index.html)
  if (req.mode === 'navigate') {
    // (only the app's own pages: another page in this folder, as the peer-to-peer test page p2p/, is left to the
    // browser, so it never takes the place of the app's start page in the offline copy)
    const rest = url.href.startsWith(self.registration.scope) ? url.pathname.slice(new URL(self.registration.scope).pathname.length) : null;
    if (rest === null || !/^(index\.html|proteins\.html|spatial\.html)?$/.test(rest)) return;
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
  // the studio's scenes (the relay's --scenes, or a static folder of them): the owner's own models, sounds and layouts,
  // large and changing while they work, so never kept here; the browser asks the server each time (no-cache, ETags).
  // Before the narration's rule: a scene's own audio/narration.mp3 must never be taken for (and cached as) the app's
  if (url.origin === self.location.origin && /\/scenes\//.test(url.pathname)) return;
  // the narration: from the cache when it is there (as byte ranges), else the network, keeping a copy of a whole file
  // (a story playing it for the first time on this device) for next time and offline
  const narr = url.origin === self.location.origin && /\/audio\/(narration(-[a-z]+)*\.mp3)$/.exec(url.pathname);   // (narration-pass-de.mp3: a story's other language)
  if (narr) {
    const key = './audio/' + narr[1], range = req.headers.has('range');
    e.respondWith(caches.match(key).then(hit => {
      if (hit) return range ? rangeResponse(req, hit, narr[1]) : hit.clone();
      // (past the browser's own cache, which a host may let keep an older copy for minutes after a release)
      return fetch(range ? req : new Request(req, { cache: 'no-cache' })).then(res => {
        if (!range && res.status === 200 && res.type === 'basic') { const copy = res.clone(); e.waitUntil(caches.open(NARR).then(n => n.put(key, copy)).catch(() => {})); }
        return res;
      });
    }));
    return;
  }
  // the shared rooms' relay (when it serves the app): its API is live, never cached
  if (url.origin === self.location.origin && /\/api\//.test(url.pathname)) return;
  // the latest release's version file (tools/release.mjs): always the server's, never kept (HOST.live compares it
  // with what this page runs)
  if (url.origin === self.location.origin && /\/version\.json$/.test(url.pathname)) return;
  // everything else from this app (story files, three.js, icons): network first, checked with the server
  if (url.origin === self.location.origin) {
    e.respondWith(fresh(fetch(req, { cache: 'no-cache' }), url.origin + url.pathname));
  }
});
