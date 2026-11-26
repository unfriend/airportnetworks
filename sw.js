// Offline support: the app shell is cached on install, so the installed app
// opens without a network connection. Bump VERSION when you change any file.
const VERSION = 'networks-v216';
const SHELL = ['./', './index.html', './sfx.js', './occlusion.js', './ships.js', './notes.js', './shared.js', './ik.js', './bodies.js', './flight.js', './proteins.html', './spatial.html', './stories/list.js', './stories/design.js', './stories/studio.js', './lowpoly.js', './three.min.js', './peerjs.min.js', './output.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
  './fonts/B612-Regular.woff2', './fonts/B612-Bold.woff2', './fonts/B612-Italic.woff2'];

const AUDIO = [];
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
// Story packages (packages/<key>/, tools/packages/SPEC.md) keep a cache of their own that outlives the releases too: a
// package changes without a release (its files' addresses carry their fingerprints, HOST.pkgUrl), and one opened once
// works offline
const PKG = 'networks-packages';
// a package file's address as the app asks for it: main.js with the package's fingerprint (HOST.load), any other file
// with its own (HOST.pkgUrl); the cache keeps one version of each file (storing one drops the others)
const pkgAddr = (m, f) => new URL(`packages/${m.key}/${f}?v=${f === 'main.js' ? m.fp : m.files[f]}`, self.registration.scope).href;
const listedPkgs = (j, hidden) => (j && Array.isArray(j.packages) ? j.packages : []).filter(m => m && typeof m.key === 'string' && m.files && typeof m.files === 'object' && (hidden || m.list !== 'hidden'));
async function pkgPut(c, url, res) {
  const bare = url.split('?')[0];
  for (const k of await c.keys()) if (k.url !== url && k.url.split('?')[0] === bare) await c.delete(k);
  await c.put(url, res);
}
// the packages' index: the server's, else the copy kept (offline)
async function pkgIndex() {
  const u = new URL('packages/index.json', self.registration.scope).href;
  try {
    const r = await fetch(u, { cache: 'no-store' });
    if (r.status === 200) { const j = await r.clone().json(); await caches.open(PKG).then(c => c.put(u, r)); return j; }
  } catch (e) { /* offline */ }
  const hit = await caches.open(PKG).then(c => c.match(u));
  return hit ? hit.json().catch(() => null) : null;
}
// At install, every listed package's main.js (the story itself, as SHELL takes each stories/<key>.js) and its
// miniatures' file (story.json's minis: its stations' icon and its props on the design room's table), so an installed
// copy opens every story offline, moved into a package or not (silent until its narration is taken), and its rooms show
// every station's icon; never fails the install
async function takeMains() {
  const j = await pkgIndex(), c = await caches.open(PKG);
  const want = [];
  for (const m of listedPkgs(j)) for (const f of ['main.js', m.minis]) if (typeof f === 'string' && m.files[f]) want.push(pkgAddr(m, f));
  await Promise.all(want.map(async u => {
    if (await c.match(u)) return;
    try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) await pkgPut(c, u, r); } catch (e) { /* taken when first asked for */ }
  }));
}
// Take all stories (v185, docs/packages-migration.md "Decided route"): every file of every listed package (main.js,
// models, data, its narration) into PKG and every narration still in audio/ (AUDIO) into NARR, two at a time, whole
// files at the addresses the app asks for; a file already held is passed by, so a broken-off take carries on where it
// was (the page asks again at its next start: HOST.offline) and a changed package takes only its changed files. The
// storage is checked first (free space for what is missing, and a fifth more); a file that fails is tried once more,
// the rest go on. Progress goes to every page: { type: 'take', state: 'run'|'done'|'full'|'off', done, total, bytes,
// need, failed }.
const TAKE = { run: null, msg: { type: 'take', state: 'idle', done: 0, total: 0, bytes: 0, need: 0, failed: 0 } };
const tell = o => { TAKE.msg = Object.assign({ type: 'take' }, o); return self.clients.matchAll({ includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage(TAKE.msg))); };
function takeAll(hidden) {
  if (TAKE.run) { tell(TAKE.msg); return TAKE.run; }
  return (TAKE.run = (async () => {
    const j = await pkgIndex();
    if (!j) return tell({ state: 'off', done: 0, total: 0, bytes: 0, need: 0, failed: 0 });
    const pc = await caches.open(PKG), nc = await caches.open(NARR), want = [];
    for (const m of listedPkgs(j, hidden)) for (const f of Object.keys(m.files)) {
      const u = pkgAddr(m, f);
      if (!(await pc.match(u))) want.push({ u, c: pc, pkg: true, size: 0 });
    }
    for (const a of AUDIO) if (!(await nc.match(a))) want.push({ u: a, c: nc, pkg: false, size: 0 });
    // what is missing, in bytes: the index's for packages (each file's share is not listed: the package's bytes spread
    // by its files' count is close enough), the server's Content-Length for a narration
    const per = {};
    for (const m of listedPkgs(j, hidden)) per[m.key] = (+m.bytes || 0) / Math.max(1, Object.keys(m.files).length);
    for (const w of want) {
      if (w.pkg) w.size = per[(/\/packages\/([^/]+)\//.exec(w.u) || [])[1]] || 0;
      else try { const h = await fetch(w.u, { method: 'HEAD', cache: 'no-store' }); w.size = +h.headers.get('Content-Length') || 0; } catch (e) { /* offline: tried below */ }
    }
    const need = want.reduce((n, w) => n + w.size, 0), total = want.length;
    try {
      const est = self.navigator.storage && self.navigator.storage.estimate ? await self.navigator.storage.estimate() : null;
      if (est && est.quota && est.quota - (est.usage || 0) < need * 1.2) return tell({ state: 'full', done: 0, total, bytes: 0, need, failed: 0 });
    } catch (e) { /* no estimate: try */ }
    let done = 0, bytes = 0, failed = 0, i = 0;
    tell({ state: 'run', done, total, bytes, need, failed });
    async function one(w) {
      for (let k = 0; k < 2; k++) {
        try {
          const r = await fetch(w.u, { cache: 'no-cache' });
          if (r.status === 200) {
            const b = await r.clone().arrayBuffer();
            if (w.pkg) await pkgPut(w.c, w.u, r); else await w.c.put(w.u, r);
            bytes += b.byteLength;
            return true;
          }
        } catch (e) { /* once more */ }
      }
      return false;
    }
    const lane = async () => { while (i < want.length) { const w = want[i++]; if (!(await one(w))) failed++; done++; tell({ state: 'run', done, total, bytes, need, failed }); } };
    await Promise.all([lane(), lane()]);
    return tell({ state: 'done', done, total, bytes, need, failed });
  })().finally(() => { TAKE.run = null; }));
}
self.addEventListener('message', e => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'take') e.waitUntil(takeAll(!!d.hidden));
  else if (d.type === 'take?') e.waitUntil(TAKE.run ? tell(TAKE.msg) : tell(Object.assign({}, TAKE.msg)));
});
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
    // every listed story package's main.js (the stories moved into packages: offline as the others), never failing it
    .then(() => takeMains().catch(() => {}))
    .then(() => self.skipWaiting()));
});
// the network's answer (and a fresh copy in the cache: this release's, or the one named); the cached copy when the
// network fails, or when it has not answered within a few seconds and a copy exists
function fresh(net, key, cache) {
  const cached = () => caches.match(key, { ignoreSearch: true });
  net = net.then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(cache || VERSION).then(c => c.put(key, copy)); }
    return res;
  });
  const safe = net.catch(() => cached().then(hit => hit || Response.error()));
  const slow = new Promise(r => setTimeout(r, 4000)).then(cached).then(hit => hit || safe);
  return Promise.race([safe, slow]);
}
// The narrations' own cache (NARR) holds only those still in audio/ (AUDIO): since v187 each story's narration is its
// package's (PKG), so a copy of an old address (audio/narration*.mp3, up to about 60 MB on a device that played them
// before v187) is dropped at activate; a current one is never touched
async function narrPrune() {
  const n = await caches.open(NARR), keep = new Set(AUDIO.map(a => new URL(a, self.registration.scope).href));
  for (const k of await n.keys()) if (!keep.has(new URL(k.url, self.registration.scope).href)) await n.delete(k);
}
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== NARR && k !== PKG).map(k => caches.delete(k))))
    .then(() => narrPrune().catch(() => {}))
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
  // the studio's scenes (the relay's --scenes, or a static folder of them): the owner's own models, sounds and layouts,
  // large and changing while they work, so never kept here; the browser asks the server each time (no-cache, ETags).
  // Before the narration's rule: a scene's own audio/narration.mp3 must never be taken for (and cached as) the app's.
  // The example scenes that ship with the app (examples/, v137) likewise: big models and streamed sounds, opened read only
  if (url.origin === self.location.origin && /\/(scenes|examples)\//.test(url.pathname)) return;
  // the developer notebook (v142): its notes page (notes/) is live like the relay's /api/notes it reads, never kept
  if (url.origin === self.location.origin && /\/notes(\/|$)/.test(url.pathname)) return;
  // story packages: network first, checked with the server, kept in their own cache (PKG); before the narration's rule,
  // so a package's audio/narration.mp3 is never taken for the app's. Their index (packages/index.json) is the server's
  // whenever it answers, however slowly (the cached copy only offline); a byte range (the audio element) from the
  // network, or offline from the cached whole file
  if (url.origin === self.location.origin && /\/packages\//.test(url.pathname)) {
    const key = url.origin + url.pathname, cached = () => caches.open(PKG).then(c => c.match(key));
    if (/\/packages\/index\.json$/.test(url.pathname)) {
      e.respondWith(fetch(req, { cache: 'no-store' }).then(res => {
        if (res.status === 200) { const copy = res.clone(); e.waitUntil(caches.open(PKG).then(c => c.put(key, copy)).catch(() => {})); }
        return res;
      }, () => cached().then(hit => hit || Response.error())));
    } else if (req.headers.has('range')) {
      e.respondWith(fetch(req).catch(() => caches.open(PKG).then(c => c.match(key, { ignoreSearch: true }))
        .then(hit => (hit ? rangeResponse(req, hit, key) : Response.error()))));
    } else {
      // kept under its whole address: the version (?v=<fp>) is part of it, so a slow network never gets an older file
      // for a newer address; storing a version drops that file's others. A fresh fetch (HOST.load's &fresh=<time>: a
      // package changed while the page ran) is kept without its fresh, at the address an offline start asks for (v193:
      // it was kept under its one-off address, and the package then had no copy offline), and is never answered from
      // the cache while the network is slow
      const bare = new URL(url.href), fresh = bare.searchParams.has('fresh');
      bare.searchParams.delete('fresh');
      const vkey = url.origin + url.pathname + bare.search, hit = () => caches.open(PKG).then(c => c.match(vkey));
      const net = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(PKG).then(async c => {
            for (const k of await c.keys()) if (k.url !== vkey && k.url.split('?')[0] === key) await c.delete(k);
            await c.put(vkey, copy);
          }).catch(() => {}));
        }
        return res;
      });
      const safe = net.catch(() => hit().then(h => h || Response.error()));
      e.respondWith(fresh ? safe : Promise.race([safe, new Promise(r => setTimeout(r, 4000)).then(hit).then(h => h || safe)]));
    }
    return;
  }
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
  // with what this page runs); and what is new in it (whatsnew.json, developer mode's box: HOST.dev, and the history of
  // earlier releases in whatsnew/), likewise
  if (url.origin === self.location.origin && /\/(version\.json|whatsnew\.json|whatsnew\/[^/]+\.json)$/.test(url.pathname)) return;
  // everything else from this app (story files, three.js, icons): network first, checked with the server
  if (url.origin === self.location.origin) {
    e.respondWith(fresh(fetch(req, { cache: 'no-cache' }), url.origin + url.pathname));
  }
});
