// Offline support: the app shell is cached on install, so the installed app opens without a network connection; each
// story package's files are cached as it is first opened (PKG). Bump VERSION when you change any shell file (a change
// to one package's files alone needs none: its fingerprint in packages/index.json reaches the pages, v193). Every listed
// story's main.js and miniatures are taken at install too (takeMains), its other files as it is first opened.
const VERSION = 'networks-v227';
// (the studio's two parts loaded on demand, stories/studio-convert.js and studio-edit.js, v226: tools/studio/build.mjs, stand
// apart from the run of story files that tools/release.mjs writes, after output.js, so it leaves them as they are)
const SHELL = ['./', './index.html', './sfx.js', './occlusion.js', './ships.js', './notes.js', './perfrun.js', './shared.js', './ik.js', './bodies.js', './flight.js', './proteins.html', './spatial.html', './stories/list.js', './stories/studio.js', './lowpoly.js', './three.min.js', './peerjs.min.js', './output.js', './stories/studio-convert.js', './stories/studio-edit.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
  './fonts/B612-Regular.woff2', './fonts/B612-Bold.woff2', './fonts/B612-Italic.woff2'];

// Until v190 the narrations lived in audio/ and kept a cache of their own (NARR) that outlived the releases; since then
// every story's narration is its package's (PKG), so that cache is only cleared, at activate, on a device that kept one
const NARR = 'networks-narration';
// Story packages (packages/<key>/, tools/packages/SPEC.md) keep a cache of their own that outlives the releases too: a
// package changes without a release (its files' addresses carry their fingerprints, HOST.pkgUrl), and one opened once
// works offline
const PKG = 'networks-packages';
// a package file's address as the app asks for it: main.js with the package's fingerprint (HOST.load), any other file
// with its own (HOST.pkgUrl); the cache keeps one version of each file (storing one drops the others)
const pkgAddr = (m, f) => new URL(`packages/${m.key}/${f}?v=${f === 'main.js' ? m.fp : m.files[f]}`, self.registration.scope).href;
const listedPkgs = (j, hidden) => (j && Array.isArray(j.packages) ? j.packages : []).filter(m => m && typeof m.key === 'string' && m.files && typeof m.files === 'object' && (hidden || m.list !== 'hidden'));
async function pkgPut(c, url, res) {
  await c.delete(url, { ignoreSearch: true });   // (every version of that file: the cache keeps one)
  await c.put(url, res);
}
// (v220: a worker still installing keeps the older versions too, so a page of the release still running keeps its own
// copies; activate drops them, pkgPrune)
const pkgAdd = (c, url, res, keep) => (keep ? c.put(url, res) : pkgPut(c, url, res));
// the text files, as tools/packages/scan.mjs fingerprints them (the text; any other file byte for byte)
const TEXT = /\.(js|mjs|json|md|txt|css|html|svg|csv|tsv|xml|gltf|obj|mtl|glsl|vert|frag|ya?ml)$/i;
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
// a file's fingerprint, as tools/packages/scan.mjs computes it for the index (index.html's HOST.fingerprint of the text)
function fingerprint(s) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
}
// whether a text file fetched is the one the index names (v220): a deploy that puts the new index up a moment before the
// new main.js gives the old file under the new address, and a cache that kept it would answer that address with it for
// ever (HOST.loadSrc takes the index's fingerprint for it, so no live update would notice). Such a body is used once
// and not kept; the next ask fetches again. No fingerprint to compare with: kept
async function pkgTrue(res, want) {
  if (!want) return true;
  try { return fingerprint((await res.clone().text()).replace(/^\uFEFF/, '')) === want; } catch (e) { return false; }
}
const IDX = () => new URL('packages/index.json', self.registration.scope).href;
const cachedIndex = c => c.match(IDX()).then(h => (h ? h.json() : null)).catch(() => null);
// a package file fetched on a miss (the fetch handler): a story's main.js kept only when its text is what the cached
// index names for that address (the page read that index just before; an address the index does not name: below), any
// other text file only when its text is its address's own fingerprint (?v=, HOST.pkgUrl). A main.js at an address the
// index does not name is kept as before, unless the cache already holds a newer one (a page of an older release while
// a new worker installs: its old address must not take the new release's file, v220)
async function pkgKeep(u, res) {
  const c = await caches.open(PKG), a = new URL(u), k = /\/packages\/([^/]+)\/main\.js$/.exec(a.pathname), v = a.searchParams.get('v');
  if (k && v) {
    const m = listedPkgs(await cachedIndex(c), true).find(x => x.key === k[1]);
    if (m && m.fp === v && !(await pkgTrue(res, m.files['main.js']))) return;
    if (m && m.fp !== v && await pkgTrue(res, m.files['main.js'])) return;   // (the index's file under another address)
  } else if (v && /^[0-9a-f]{16}$/.test(v) && TEXT.test(a.pathname) && !(await pkgTrue(res, v))) return;
  await pkgPut(c, u, res);
}
// at activate (v220): each package file's older versions a worker kept while it installed (pkgAdd), once the version
// the index names is held
async function pkgPrune() {
  const c = await caches.open(PKG), j = await cachedIndex(c);
  for (const m of listedPkgs(j, true)) for (const f of ['main.js', m.minis]) {
    if (typeof f !== 'string' || !m.files[f]) continue;
    const u = pkgAddr(m, f);
    if (!(await c.match(u))) continue;
    for (const r of await c.keys(u, { ignoreSearch: true })) if (r.url !== u) await c.delete(r);
  }
}
// Every listed package's main.js (the story itself) and its miniatures' file (story.json's minis: its stations' icon),
// at install (as before v219; the owner, 26 November 2026: "just fetch all stories at install"), so an installed copy
// opens every story offline (silent until its narration is taken) and its rooms show every station's icon. Only what
// is missing or changed is fetched (v219's gain kept): an address carries its version, so a file held is passed by,
// and a main.js whose text is the same as before (another file of its package changed, so its address did) is the copy
// held, moved to its new address (whatever address it is held at: its text is checked, v220). Four at a time; a body
// that is not the one the index names, a failure, or a file not in within 30 s is left to be taken when the story is
// first opened; never fails the install. Also asked for by the page (HOST.offline.again: at its first index read and when
// a package changed while it ran) and by a v219 page ({ type: 'mains' }). While installing (keep) the older versions stay
// until activate, for a page of the release still running
let MAINS = null;
function takeMains(keep) {
  if (MAINS) return MAINS;
  return (MAINS = (async () => {
    const c = await caches.open(PKG), j = await pkgIndex(), want = [];
    for (const m of listedPkgs(j)) for (const f of ['main.js', m.minis]) if (typeof f === 'string' && m.files[f]) want.push({ m, f, u: pkgAddr(m, f) });
    let i = 0;
    const lane = async () => {
      while (i < want.length) {
        const { m, f, u } = want[i++];
        // (a stalled connection would hold the install for ever: each file has 30 s, its body included)
        const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 30000);
        try {
          // (a copy held is checked too: one a v219 worker kept from a deploy half done is fetched again)
          const held = await c.match(u);
          if (held && await pkgTrue(held, m.files[f])) continue;
          const h = held ? null : await c.match(u, { ignoreSearch: true });
          if (h && await pkgTrue(h, m.files[f])) { const b = await h.blob(); await pkgAdd(c, u, new Response(b, { status: 200, headers: h.headers }), keep); continue; }
          const r = await fetch(u, { cache: 'no-cache', signal: ac.signal });
          if (r.ok && await pkgTrue(r, m.files[f])) await pkgAdd(c, u, r, keep);
        } catch (e) { /* taken when first asked for */ } finally { clearTimeout(tm); }
      }
    };
    await Promise.all([lane(), lane(), lane(), lane()]);
  })().catch(() => {}).finally(() => { MAINS = null; }));
}
// Take all stories (v185, docs/agents/packages.md "The service worker", "Take all stories"): every file of every listed package (main.js,
// models, data, its narration) into PKG, two at a time, whole
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
    const pc = await caches.open(PKG), want = [];
    // what is missing, in bytes: the index's (each file's share is not listed: the package's bytes spread by its files'
    // count is close enough)
    for (const m of listedPkgs(j, hidden)) {
      const size = (+m.bytes || 0) / Math.max(1, Object.keys(m.files).length);
      for (const f of Object.keys(m.files)) { const u = pkgAddr(m, f); if (!(await pc.match(u))) want.push({ u, c: pc, size, f, want: m.files[f] }); }
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
          // (a text file whose body is not the one the index names: a deploy half done; not kept, counted as failed)
          if (r.status === 200 && await pkgTrue(r, TEXT.test(w.f) ? w.want : '')) {
            // (counted from the index's share, not by reading the whole file into memory again)
            await pkgPut(w.c, w.u, r);
            bytes += w.size;
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
  else if (d.type === 'mains') e.waitUntil(takeMains());
  else if (d.type === 'take?') e.waitUntil(TAKE.run ? tell(TAKE.msg) : tell(Object.assign({}, TAKE.msg)));
});
// the audio element (the fallback sound engine) asks for byte ranges offline; answer them from the cached file, read
// once per file while this worker runs, the last two files only (a narration is up to 7 MB)
const BYTES = new Map();
async function rangeResponse(req, cached, key) {
  if (BYTES.has(key)) { const b = BYTES.get(key); BYTES.delete(key); BYTES.set(key, b); }   // (the latest last)
  else { BYTES.set(key, cached.clone().arrayBuffer()); while (BYTES.size > 2) BYTES.delete(BYTES.keys().next().value); }
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
// At install each shell file is asked of the server past the browser's HTTP cache (which may still hold the old
// version); a copy an older release's cache holds goes with its ETag, and an unchanged file (304) is that copy again, so a
// release no longer downloads the whole shell (5.5 MB) whatever changed (v219). A copy with only a date is fetched whole
// (v220: If-Modified-Since let a redeploy of an older file answer 304 and keep the newer copy). A file the server cannot
// give fails the install, as before
async function shellTake(c, u) {
  const a = new URL(u, self.registration.scope).href, old = await caches.match(a), h = {};
  const et = old && old.headers.get('ETag');
  if (et) h['If-None-Match'] = et;
  const r = await fetch(new Request(a, { cache: 'no-store', headers: h }));
  if (r.status === 304 && old) return c.put(a, old);
  if (!r.ok) throw new Error(a + ': ' + r.status);
  return c.put(a, r);
}
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => shellTake(c, u))))
    // every listed story's main.js and miniatures, only those missing or changed (takeMains), never failing it: so an
    // upgrade from any release (a v219 worker took them only when its page asked) ends with them on the device. At most
    // 90 s: the release is not held back by a slow network (the rest is taken as the stories are opened, or as the page
    // asks: HOST.offline)
    .then(() => Promise.race([takeMains(true), new Promise(r => setTimeout(r, 90000))]))
    .then(() => self.skipWaiting()));
});
// the network's answer (and a fresh copy in the cache: this release's, or the one named); the cached copy when the
// network fails, or when it has not answered within a few seconds and a copy exists
// (v219: kept only when it differs from the copy held, by its ETag or else its date; with neither, kept as before)
const sameCopy = (a, b) => { const e = a.headers.get('ETag'); if (e) return e === b.headers.get('ETag'); const m = a.headers.get('Last-Modified'); return !!m && m === b.headers.get('Last-Modified'); };
function fresh(net, key, cache) {
  const cached = () => caches.match(key, { ignoreSearch: true });
  net = net.then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(cache || VERSION).then(c => c.match(key).then(old => (old && sameCopy(copy, old) ? null : c.put(key, copy)))).catch(() => {}); }
    return res;
  });
  const safe = net.catch(() => cached().then(hit => hit || Response.error()));
  const slow = new Promise(r => setTimeout(r, 4000)).then(cached).then(hit => hit || safe);
  return Promise.race([safe, slow]);
}
// The narrations' old cache (NARR: up to about 60 MB on a device that played them before v187) is emptied at activate
async function narrPrune() {
  const n = await caches.open(NARR);
  for (const k of await n.keys()) await n.delete(k);
}
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== NARR && k !== PKG).map(k => caches.delete(k))))
    .then(() => narrPrune().catch(() => {}))
    .then(() => pkgPrune().catch(() => {}))
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
  // The example scenes that ship with the app (examples/, v137) likewise: big models and streamed sounds, opened read only
  if (url.origin === self.location.origin && /\/(scenes|examples)\//.test(url.pathname)) return;
  // the developer notebook (v142): its notes page (notes/) is live like the relay's /api/notes it reads, never kept
  if (url.origin === self.location.origin && /\/notes(\/|$)/.test(url.pathname)) return;
  // story packages, kept in their own cache (PKG): a file at an address with its version (?v=<fp>) from the cache when it
  // is there (v219), else from the network, checked with the server. Their index (packages/index.json) is the server's
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
        .then(hit => (hit ? rangeResponse(req, hit, hit.url || key) : Response.error()))));
    } else {
      // kept under its whole address: the version (?v=<fp>) is part of it, so a slow network never gets an older file
      // for a newer address; storing a version drops that file's others. A fresh fetch (HOST.load's &fresh=<time>: a
      // package changed while the page ran) is kept without its fresh, at the address an offline start asks for (v193:
      // it was kept under its one-off address, and the package then had no copy offline), and is never answered from
      // the cache while the network is slow. A main.js not the one the index names is used but not kept (pkgKeep, v220)
      const bare = new URL(url.href), fresh = bare.searchParams.has('fresh');
      bare.searchParams.delete('fresh');
      const vkey = url.origin + url.pathname + bare.search, hit = () => caches.open(PKG).then(c => c.match(vkey));
      const go = () => {
        const net = fetch(req, { cache: 'no-cache' }).then(res => {
          if (res.ok) { const copy = res.clone(); e.waitUntil(pkgKeep(vkey, copy).catch(() => {})); }
          return res;
        });
        const safe = net.catch(() => hit().then(h => h || Response.error()));
        return fresh ? safe : Promise.race([safe, new Promise(r => setTimeout(r, 4000)).then(hit).then(h => h || safe)]);
      };
      // (v219: an address with its version, ?v=<fp>, never changes what it holds: a copy kept is the answer at once, with no
      // trip to the network; a new version is a new address. A fresh fetch, and an address without a version, ask the network)
      e.respondWith(!fresh && bare.searchParams.has('v') ? hit().then(h => h || go(), go) : go());
    }
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
