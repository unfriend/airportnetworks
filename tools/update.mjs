// Update test: what a returning visitor gets after a new version is deployed. Installs an
// older version (service worker and offline cache), then serves this one the way GitHub Pages
// does (browsers may keep files for ten minutes) and checks that the page and its story files
// are from the same, new version within the first visit, on the next visit and offline, and
// that the worker answers byte ranges of the cached narration and caches a narration when it is first played (never all
// of them at install).
// Usage: git worktree add /tmp/old <an earlier commit>
//        node tools/update.mjs /tmp/old [.]
// PLAYWRIGHT_MODULE and CHROMIUM_PATH as in smoke.mjs. Uses port 8125.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { stories } from './stories.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [oldDir, newDir = '.'] = process.argv.slice(2);
if (!oldDir) { console.log('usage: node tools/update.mjs <folder with an older version> [folder with this version]'); process.exit(2); }
const wait = ms => new Promise(r => setTimeout(r, ms));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };
// a static server like GitHub Pages: max-age 600 and ETags, byte ranges for the narration
function serve(dir) {
  const srv = http.createServer((req, res) => {
    let f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (f.endsWith(path.sep) || f.endsWith('/')) f = path.join(f, 'index.html');
    fs.readFile(f, (err, body) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const tag = '"' + crypto.createHash('md5').update(body).digest('hex') + '"';
      const h = { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', ETag: tag, 'Accept-Ranges': 'bytes' };
      if (req.headers['if-none-match'] === tag) { res.writeHead(304, h); res.end(); return; }
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (m) {
        const s = m[1] ? +m[1] : 0, e = m[2] ? Math.min(+m[2], body.length - 1) : body.length - 1;
        res.writeHead(206, { ...h, 'Content-Range': `bytes ${s}-${e}/${body.length}` }); res.end(body.subarray(s, e + 1)); return;
      }
      res.writeHead(200, h); res.end(body);
    });
  });
  return new Promise(r => srv.listen(8125, '127.0.0.1', () => r(srv)));
}
const stop = srv => { srv.closeAllConnections(); return new Promise(r => srv.close(r)); };

const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'networks-update-'));
const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
await ctx.addInitScript(() => { try { localStorage.setItem('tutorialHold', 'off'); } catch (e) { /* storage blocked */ } });   // (the tutorial's narration hold off, as on every test page)
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// which version the page runs: its inline scripts and some airports story functions, compared word
// for word with the files of each version (Function.prototype.toString gives the source text)
const FNS = ['frame', 'init', 'audioInit', 'xrEnterScene', 'xrSetup', 'drawLandHead', 'drawMain'];
const files = dir => ({ shell: fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), story: fs.readFileSync(path.join(dir, stories(dir).get('airports').file), 'utf8') });   // (stories/airports.js, or packages/airports/main.js since v187)
const NEW = files(newDir), OLD = files(oldDir);
const running = () => page.evaluate(FNS => HOST.cur && HOST.curKey === 'airports' && {
  shell: [...document.scripts].map(s => s.textContent).filter(t => t.trim()),
  story: FNS.map(f => { try { return HOST.cur.peek(f + '.toString()'); } catch (e) { return ''; } }).filter(Boolean),
}, FNS);
const isFrom = (r, V) => r.shell.every(t => V.shell.includes(t)) && r.story.length > 0 && r.story.every(t => V.story.includes(t));
const versions = async () => {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await running();
      if (r) { const v = { shell: isFrom({ ...r, story: ['x'] }, { ...NEW, story: 'x' }), story: isFrom({ ...r, shell: [] }, NEW) }; if ((v.shell && v.story) || i === 79) return v; }
    } catch (e) { /* the page is reloading */ }
    await wait(250);
  }
  return null;
};
let failed = false;
const report = (what, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ': ' + detail : ''}`); };

let srv = await serve(oldDir);
// the test only means something when the two versions differ in what it compares
const same = FNS.filter(f => { const m = new RegExp('\\nfunction ' + f + '\\(').exec(OLD.story); return m && NEW.story.includes(OLD.story.slice(m.index + 1, OLD.story.indexOf('\n}\n', m.index) + 2)); });
if (same.length === FNS.length && OLD.shell === NEW.shell) console.log('note: the two versions look the same to this test');
await page.goto('http://127.0.0.1:8125/');
await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.cur, null, { timeout: 30000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await wait(3000);
await page.reload();
await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.cur && navigator.serviceWorker.controller, null, { timeout: 30000 });
await wait(1500);
console.log('older version installed and looking after the page');
// what this device holds of the narrations before the update, in any cache: since v109 a narration is kept only once a
// story has played it (until v108 every one was fetched at install), so two are played here first, through the older worker (two still in audio/: a story moved into a package
// has its narration in its folder)
await page.evaluate(() => Promise.all(['narration-proteins.mp3', 'narration-lbi.mp3'].map(f => fetch('audio/' + f).then(r => r.arrayBuffer()).catch(() => null))));
await wait(1500);
// a device that played narrations before v187 still holds them at their old addresses (audio/narration*.mp3) in the
// narrations' cache, up to about 60 MB: two such copies are put there now where the older version holds none (its
// narrations are in its packages), which the new worker drops at activate unless its release still lists them (sw.js
// AUDIO, the narrations still in audio/: narrPrune)
const planted = await page.evaluate(async names => {
  const c = await caches.open('networks-narration'), out = [];
  for (const f of names) if (!(await caches.match('./audio/' + f))) { await c.put('./audio/' + f, new Response(new Uint8Array(2048), { headers: { 'Content-Type': 'audio/mpeg' } })); out.push(f); }
  return out;
}, ['narration-proteins.mp3', 'narration-lbi.mp3']);
if (planted.length) console.log('old narration copies put in the narrations\' cache: ' + planted.join(', '));
const before = await page.evaluate(async () => {
  const names = new Set();
  for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) { const m = /\/audio\/(narration(-[a-z]+)*\.mp3)$/.exec(r.url); if (m) names.add(m[1]); }
  return [...names].sort();
});
await stop(srv);
srv = await serve(newDir);
for (const visit of ['first visit after the update', 'next visit']) {
  await page.reload();
  const v = await versions();
  // (none: what the page shows instead, to say why)
  const why = v ? '' : ' ' + JSON.stringify(await page.evaluate(() => typeof HOST === 'undefined' ? 'no HOST' : { key: HOST.curKey, cur: !!HOST.cur, list: HOST.list.length, picking: HOST.picking, href: location.href }).catch(e => String(e)));
  report(visit + ': page and stories are new', v && v.shell && v.story, JSON.stringify(v) + why);
}
// the worker answers byte ranges from the cached narration (the app's in audio/ while there was one; since v187 every
// narration is in its package, kept in the packages' cache once fetched whole, and answered from there offline: below)
const rangesOf = u => page.evaluate(async u => {
  // (no-store: the browser's own cache would answer a range it cannot satisfy with the whole file; the worker is asked)
  const get = async h => { const r = await fetch(u, { headers: { Range: h }, cache: 'no-store' }); return [r.status, (await r.arrayBuffer()).byteLength]; };
  return { first: await get('bytes=0-99'), last: await get('bytes=-100'), beyond: await get('bytes=999999999-') };
}, u);
const rangesOk = r => r.first.join() === '206,100' && r.last.join() === '206,100' && r.beyond[0] === 416;
const pkgNarr = !fs.existsSync(path.join(newDir, 'audio', 'narration.mp3'));
let narrUrl = '';
if (!pkgNarr) { const ranges = await rangesOf('audio/narration.mp3'); report('narration byte ranges from the cache', rangesOk(ranges), JSON.stringify(ranges)); }
else {
  narrUrl = await page.evaluate(() => HOST.pkgUrl('airports', 'audio/narration.mp3'));
  await page.evaluate(u => fetch(u).then(r => r.arrayBuffer()), narrUrl);   // (played once, whole: kept for offline)
}
// the narrations keep a cache of their own (networks-narration): the new worker took over those the older version held,
// fetched none that this device never played (the tour's and every other story's), and keeps one a story fetches to play
const held = () => page.evaluate(async () => (await caches.has('networks-narration')) ? (await (await caches.open('networks-narration')).keys()).map(r => r.url.replace(/.*\/audio\//, '')).sort() : null);
const oldHeld = before;   // (what the older version held on this device, not every file it shipped)
const newAll = (fs.existsSync(path.join(newDir, 'audio')) ? fs.readdirSync(path.join(newDir, 'audio')) : []).filter(f => /^narration(-[a-z]+)*\.mp3$/.test(f)).sort();
const fresh = newAll.find(f => !oldHeld.includes(f));
if (fresh) {
  await page.evaluate(f => fetch('audio/' + f).then(r => r.arrayBuffer()), fresh);
  let has = false;
  for (let i = 0; i < 20 && !has; i++) { await wait(250); has = (await held() || []).includes(fresh); }
  report('narrations: one played for the first time is kept for next time', has, JSON.stringify({ fresh, held: await held() }));
} else console.log('note the older version has every narration this one has: the first play\'s copy is not checked here');
// a narration re-recorded since the older version: the device's copy is the new one (the 200 of the conditional request)
const size = async f => page.evaluate(async f => { const r = await (await caches.open('networks-narration')).match('./audio/' + f); return r ? (await r.arrayBuffer()).byteLength : -1; }, f);
const changed = oldHeld.find(f => newAll.includes(f) && !fs.readFileSync(path.join(oldDir, 'audio', f)).equals(fs.readFileSync(path.join(newDir, 'audio', f))));
const unchanged = oldHeld.find(f => newAll.includes(f) && f !== changed && fs.readFileSync(path.join(oldDir, 'audio', f)).equals(fs.readFileSync(path.join(newDir, 'audio', f))));
if (changed) report('narrations: one re-recorded since is held in its new form', await size(changed) === fs.statSync(path.join(newDir, 'audio', changed)).size, JSON.stringify({ changed, held: await size(changed), new: fs.statSync(path.join(newDir, 'audio', changed)).size }));
else console.log('note no narration the older version held was re-recorded since: the refreshed copy is not checked here');
if (unchanged) report('narrations: one unchanged is kept as it was', await size(unchanged) === fs.statSync(path.join(newDir, 'audio', unchanged)).size, JSON.stringify({ unchanged, held: await size(unchanged) }));
// (the new worker installed first: it takes every listed package's main.js, about 13 MB since every story is a package,
// which can outlast the two visits above; offline before it is active would test the older worker's copy)
const NEWV = (/const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(newDir, 'sw.js'), 'utf8')) || [])[1];
// (the browser looks for a new worker as pages load, not always at once: asked here, as a later visit would)
// (its cache is made as its install starts: it is done when nothing is installing or waiting any more)
await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())).catch(() => {});
const settled = v => page.evaluate(async v => { const r = await navigator.serviceWorker.getRegistration(); return !!r && !r.installing && !r.waiting && await caches.has(v); }, v).catch(() => false);
for (let i = 0; i < 360 && !(await settled(NEWV)); i++) await wait(250);
// (the new worker active: its install refreshed the narrations held here that it still lists, fetched no others, and
// its activate dropped the copies whose address is no longer one of its narrations: sw.js narrPrune)
{
  const kept = await held(), cur = oldHeld.filter(f => newAll.includes(f)), old = oldHeld.filter(f => !newAll.includes(f));
  report('narrations: the ones held before that are still narrations are kept, no others fetched at install',
    !!kept && cur.every(f => kept.includes(f)) && kept.every(f => cur.includes(f) || (f === fresh && newAll.includes(f))), JSON.stringify({ held: kept, before: oldHeld, current: newAll }));
  if (old.length) report('narrations: old copies at addresses that are no longer narrations are dropped at activate', !!kept && old.every(f => !kept.includes(f)), JSON.stringify({ held: kept, dropped: old }));
}
await stop(srv);
await page.reload().catch(() => {});
const v = await versions();
report('offline: the app opens from the cache', v && v.shell && v.story, JSON.stringify(v));
if (narrUrl) { const ranges = await rangesOf(narrUrl); report('offline: a package\'s narration played before, answered as byte ranges from the cache', rangesOk(ranges), JSON.stringify(ranges)); }
await page.evaluate(() => HOST.go('lbi'));
await page.waitForFunction(() => HOST.curKey === 'lbi' && HOST.cur, null, { timeout: 30000 }).catch(() => {});
report('offline: another story loads', await page.evaluate(() => HOST.curKey === 'lbi' && !!HOST.cur));
// a story moved into a story package (v185: packages/order.json names it, its folder is there): its main.js was taken at
// the new worker's install (sw.js takeMains), so it opens offline though this page never played it
{
  let moved = '';
  try { moved = (JSON.parse(fs.readFileSync(path.join(newDir, 'packages', 'order.json'), 'utf8')).order || []).find(k => k !== 'airports' && k !== 'lbi' && fs.existsSync(path.join(newDir, 'packages', k, 'main.js'))) || ''; } catch (e) { /* none yet */ }
  if (moved) {
    await page.evaluate(k => HOST.go(k), moved);
    await page.waitForFunction(k => HOST.curKey === k && HOST.cur, moved, { timeout: 30000 }).catch(() => {});
    report(`offline: a story moved into a package (${moved}) loads`, await page.evaluate(k => HOST.curKey === k && !!HOST.cur, moved));
  }
}
if (errors.length) { failed = true; console.log('page errors:\n  ' + errors.join('\n  ')); }
await ctx.close();
fs.rmSync(prof, { recursive: true, force: true });
console.log(failed ? 'update test FAILED' : 'update test: all good');
process.exit(failed ? 1 : 0);
