// Live test: hot reload and live updates (index.html's HOST.live and HOST.swap, tools/release.mjs, the relay's --watch).
// Works on a copy of the app in a temporary folder, changed as a release or an editor would change it:
//  - the live site (served like GitHub Pages: ten-minute browser caching, ETags; a service worker looking after the
//    page): version.json passed through the worker uncached, a story added live (its card appears without a reload),
//    a changed story not on show fetched fresh next time, the story on show swapped in place (explore state and
//    view kept; at a slideshow stop: mode, chapter, time and slideshow kept; a playing chapter waits for its end), a
//    story package needing a newer shell never swapped in (its card says so),
//    another shell asked about first and the place restored after Reload now;
//  - while developing (the relay with --watch --build): a story file touched swaps within about 2 s, a set's source
//    touched builds and swaps its story, the list read again, a station's swap writing nothing to the shared room, a
//    station of a story this device does not know (asked about, kept by Arrange all), a shell file reloading the page
//    with its place.
// Usage: node tools/live.mjs [--port <n>] [--relay-port <n>]   (PLAYWRIGHT_MODULE and CHROMIUM_PATH as in smoke.mjs; two
// free ports unless named, so two runs never collide; --help prints this and runs nothing)
const USAGE = `usage: node tools/live.mjs [--port <n>] [--relay-port <n>]
  A copy of the app in a temporary folder, served as GitHub Pages does (--port) and by the relay with --watch --build
  (--relay-port); free ports unless named. A few minutes. PLAYWRIGHT_MODULE, CHROMIUM_PATH as in tools/smoke.mjs.`;
if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log(USAGE); process.exit(0); }
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stories } from './stories.mjs';
import { serve, freePort, portArg } from './lib/serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
let failed = false;
const report = (what, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${!ok && detail !== undefined ? ': ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); };
function fingerprint(s) {   // (index.html's HOST.fingerprint)
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
}

// ---- a copy of the app (and, for --build, the flock's sources (a package: packages/flock/src/), tools/engine/: the
// shared engine parts and the kit, and tools/packages/ (the index the relay writes again after a package's build))
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'networks-live-'));
for (const f of ['index.html', 'sfx.js', 'occlusion.js', 'ships.js', 'notes.js', 'perfrun.js', 'bench.js', 'shared.js', 'ik.js', 'bodies.js', 'flight.js', 'sw.js', 'manifest.webmanifest', 'three.min.js', 'peerjs.min.js', 'lowpoly.js', 'output.js', 'proteins.html', 'spatial.html']) fs.copyFileSync(path.join(REPO, f), path.join(T, f));
for (const d of ['stories', 'packages', 'icons', 'fonts', 'audio', 'tools/engine', 'tools/packages']) if (fs.existsSync(path.join(REPO, d))) fs.cpSync(path.join(REPO, d), path.join(T, d), { recursive: true });   // (audio/: gone since v190; fonts/: in sw.js SHELL since v213, without it the worker's install fails)
const file = f => path.join(T, f);
const read = f => fs.readFileSync(file(f), 'utf8');
const write = (f, t) => fs.writeFileSync(file(f), t);
const touch = (f, note) => fs.appendFileSync(file(f), `\n// ${note}\n`);
let vnum = 1000;
const setVersion = () => write('sw.js', read('sw.js').replace(/const VERSION = '[^']+'/, `const VERSION = 'networks-v${vnum}'`));
const release = () => execFileSync(process.execPath, [path.join(REPO, 'tools/release.mjs'), '--root', T], { encoding: 'utf8' });
// a story's file in the copy, wherever it is (stories/<key>.js, or packages/<key>/main.js since it moved: then the index
// is written again too, as a change to a package is published)
const scan = () => execFileSync(process.execPath, [path.join(REPO, 'tools/packages/scan.mjs'), '--root', T], { encoding: 'utf8' });
const fileOf = k => stories(T).get(k).file;
const change = (k, note) => { touch(fileOf(k), note); if (stories(T).get(k).pkg) scan(); release(); };
setVersion();
fs.rmSync(file('version.json'), { force: true });
release();

// ---- the live site: a static server like GitHub Pages (max-age 600 and ETags: tools/lib/serve.mjs), on a free port
const pages = await serve(T, { port: portArg(process.argv) || 0, pages: true }), LIVE = pages.url;
const RELAY_PORT = portArg(process.argv, '--relay-port') || await freePort(), DEV = `http://127.0.0.1:${RELAY_PORT}/`;

const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'networks-live-prof-'));
const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROMIUM_PATH || undefined, args: ARGS, viewport: { width: 1100, height: 700 } });
// the sound on, as on a device that turned it on (since v109 it starts off: the story then runs on its own clock, which in
// software rendering crawls, and a playing chapter would not reach its end within the checks' time)
const soundOn = () => { try { if (localStorage.getItem('narrationMuted3') === null) localStorage.setItem('narrationMuted3', '0'); localStorage.setItem('tutorialHold', 'off'); } catch (e) { /* no storage */ } };   // (and the tutorial's narration hold off, as on every test page)
await ctx.addInitScript(soundOn);
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
const watchErrors = (p, tag) => {
  p.on('pageerror', e => errors.push(tag + ': ' + (e.stack || e.message)));
  p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
};
watchErrors(page, 'live');
const until = async (p, fn, arg, ms = 15000) => { try { await p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
const built = (p, key) => until(p, k => typeof HOST !== 'undefined' && HOST.curKey === k && HOST.cur && HOST.cur.collab.scene() && !HOST.busy, key, 30000);
const swapsNow = p => p.evaluate(() => HOST.swaps || 0);
const place = p => p.evaluate(() => { const P = HOST.place(); return P && { mode: P.mode, t: Math.round(P.t * 100) / 100, playing: P.playing, state: JSON.stringify(P.state), view: P.view }; });
const near = (a, b, d = 0.02) => Math.abs(a - b) <= d;
const sameView = (a, b) => JSON.stringify(a) === JSON.stringify(b) || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.05));

try {
  await page.goto(LIVE + '#airports');
  await built(page, 'airports');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await until(page, () => typeof HOST !== 'undefined' && HOST.cur && navigator.serviceWorker.controller, null, 30000);
  await built(page, 'airports');
  await page.evaluate(() => { window.__mark = 1; });
  report('the shell knows its release (stamped by tools/release.mjs)', await page.evaluate(v => HOST.shell.id === v.shell.id && HOST.shell.n === v.shell.n && HOST.shell.format === v.format, JSON.parse(read('version.json'))));

  // version.json: always the server's, though the host says ten minutes and a worker looks after the page
  {
    const v1 = await page.evaluate(() => HOST.live.check('test').then(v => v && v.version));
    setVersion(vnum = 1001); release();
    const v2 = await page.evaluate(() => HOST.live.check('test').then(v => v && v.version));
    const kept = await page.evaluate(async () => { for (const k of await caches.keys()) if (await (await caches.open(k)).match('version.json', { ignoreSearch: true })) return true; return false; });
    report('version.json passes the service worker uncached', v1 === 'networks-v1000' && v2 === 'networks-v1001' && !kept && await page.evaluate(() => !!navigator.serviceWorker.controller), { v1, v2, kept });
  }

  // a story added in a release: its card, without a reload
  {
    if (/\{ key: /.test(read('stories/list.js').split('self.STORY_EXTRA')[0])) {
      write('stories/flock2.js', read('packages/flock/main.js').replace("HOST.register('flock',", "HOST.register('flock2',").replace("const XR_HERE = 'flock';", "const XR_HERE = 'flock2';"));
      write('stories/list.js', read('stories/list.js').replace(/\}\s*,?\s*\n\];/, `},\n  { key: 'flock2', kick: 'Live test', title: 'Second flock', col: '#ffffff', desc: 'A story added while the app runs.', page: 'Second flock',
      brand: 'Second flock', sub: 'added live', aria: 'A second flock', thing: 'flock', loading: 'Gathering', len: 'Story 1:57', life: true },\n];`));   // (at STORY_LIST's end: STORY_EXTRA follows)
    } else {
      // (every story a package: the new one is a package too, a copy of the flock's, added to the index)
      fs.mkdirSync(file('packages/flock2'), { recursive: true });
      write('packages/flock2/main.js', read('packages/flock/main.js').replace("HOST.register('flock',", "HOST.register('flock2',").replace("const XR_HERE = 'flock';", "const XR_HERE = 'flock2';").split("HOST.pkgUrl('flock', ").join("HOST.pkgUrl('flock2', "));
      write('packages/flock2/story.json', JSON.stringify({ ...JSON.parse(read('packages/flock/story.json')), minis: undefined, key: 'flock2', kick: 'Live test', title: 'Second flock', col: '#ffffff', desc: 'A story added while the app runs.', page: 'Second flock', brand: 'Second flock', sub: 'added live', len: 'Story 1:57', list: 'stories' }, null, 2));   // (the main set: the flock's own is an experiment, v188)
      scan();
    }
    release();
    const [rev0, n0] = await page.evaluate(() => [HOST.listRev, HOST.list.length]);   // (the stories before, whatever their number)
    await page.evaluate(() => HOST.live.check('test'));
    const card = await until(page, n => !!document.querySelector('#picker [data-story="flock2"]') && HOST.list.length === n, n0 + 1, 8000);
    const r = await page.evaluate(() => ({ mark: window.__mark, rev: HOST.listRev, title: document.getElementById('pickTitle').textContent, cards: HOST.cur.peek('xrLandingCards(), XR.land.length'), want: HOST.menu.cards().length + 1 }));
    report('a story added live: its card appears without a reload (page and headset Stories screens)', card && r.mark === 1 && r.rev > rev0 && r.title === 'Network stories' && r.cards === r.want, r);   // (no count of stories in the title since v188)
    await page.evaluate(() => HOST.start('flock2'));
    report('... and it starts', await built(page, 'flock2'));
  }

  // a changed story not on show: fetched fresh the next time it starts
  {
    await page.evaluate(() => HOST.start('proteins')); await built(page, 'proteins');
    await page.evaluate(() => HOST.start('airports')); await built(page, 'airports');
    change('proteins', 'changed while not on show');
    const fp = fingerprint(read(fileOf('proteins')));
    await page.evaluate(() => HOST.live.check('test'));
    const stale = await page.evaluate(() => HOST.live.state().stale.has('proteins'));
    await page.evaluate(() => HOST.start('proteins')); await built(page, 'proteins');
    report('a changed story not on show: fetched fresh next time it starts', stale && await page.evaluate(f => HOST.fp.proteins === f, fp));
  }

  // the story on show, swapped in place: explore mode (its state and view kept)
  {
    await page.evaluate(() => { const c = HOST.cur.collab; c.APP.enterExplore(); const s = c.state(); s.sel = 'TP53'; c.apply(s); });
    await until(page, () => HOST.cur.collab.view() != null, null, 10000);   // (null while the camera flies)
    const before = await place(page);
    const n0 = await swapsNow(page), cur0 = await page.evaluateHandle(() => HOST.cur);
    change('proteins', 'changed on show');
    await page.evaluate(() => HOST.live.check('test'));
    const swapped = await until(page, n => (HOST.swaps || 0) > n && HOST.cur && HOST.cur.collab.scene(), n0, 10000);
    await until(page, () => HOST.cur.collab.view() != null, null, 10000);
    await wait(500);
    const after = await place(page), fresh = await page.evaluate(c => HOST.cur !== c, cur0);
    report('the story on show, swapped in place: explore mode, its state and view kept', swapped && fresh && /TP53/.test(before.state) && after.mode === 'explore' && after.state === before.state && sameView(after.view, before.view), { before, after });
    report('... with no reload', await page.evaluate(() => window.__mark === 1));
  }

  // a story package that needs a newer shell than the page's (its story.json's needs, v190): never swapped in, the story
  // on show stays as it was and its card says it needs a newer version (then needs is put back)
  {
    const n0 = await swapsNow(page), cur0 = await page.evaluateHandle(() => HOST.cur), sjf = 'packages/proteins/story.json';
    const sj = JSON.parse(read(sjf)), was = sj.needs, n = await page.evaluate(() => HOST.shell.n);
    write(sjf, JSON.stringify(Object.assign({}, sj, { needs: n + 1 }), null, 2) + '\n'); touch(fileOf('proteins'), 'needs a newer shell'); scan(); release();
    await page.evaluate(() => HOST.live.check('test'));
    await wait(3000);
    const r = await page.evaluate(c => { const m = HOST.meta('proteins') || {}; const b = document.getElementById('livebar'); return { same: HOST.cur === c, key: HOST.curKey, swaps: HOST.swaps || 0, refused: !!m.refused, len: m.len, pending: HOST.live.pending, bar: b.hidden ? '' : b.textContent }; }, cur0);
    report('a package needing a newer shell: not swapped in (the story on show stays), its card says it needs a newer version', r.same && r.key === 'proteins' && r.swaps === n0 && r.refused && /newer version/.test(r.len || ''), r);
    write(sjf, JSON.stringify(Object.assign({}, sj, { needs: was }), null, 2) + '\n'); touch(fileOf('proteins'), 'its needs back'); scan(); release();
    await page.evaluate(() => HOST.live.check('test'));
    await wait(1000);
    // (its note on the bar, if any, put away: Later)
    await page.evaluate(() => { const b = document.getElementById('livebar'); if (!b.hidden) b.querySelector('[data-live="later"]').click(); });
  }

  // ... at a slideshow stop: mode, chapter, time and the slideshow kept
  {
    await page.evaluate(() => HOST.start('airports')); await built(page, 'airports');
    await page.evaluate(() => { HOST.slides.set('airports', true); const A = HOST.cur.collab.APP, s = HOST.cur.peek('slideStop(1)'); A.enterStory(s); A.playing = false; });
    await until(page, () => HOST.cur.peek('SLIDE.at') === 1, null, 5000);
    const before = await place(page), n0 = await swapsNow(page);
    change('airports', 'changed at a stop');
    await page.evaluate(() => HOST.live.check('test'));
    const swapped = await until(page, n => (HOST.swaps || 0) > n && HOST.cur && HOST.cur.collab.scene(), n0, 10000);
    await until(page, () => HOST.cur.peek('SLIDE.at') === 1, null, 5000);
    const after = await place(page), at = await page.evaluate(() => ({ stop: HOST.cur.peek('SLIDE.at'), slides: HOST.slides.on('airports') }));
    report('swapped at a slideshow stop: story mode, chapter, time and slideshow kept', swapped && after.mode === 'story' && !after.playing && near(after.t, before.t) && at.stop === 1 && at.slides, { before, after, at });
    await page.evaluate(() => HOST.slides.set('airports', false));
  }

  // ... while a chapter plays: not in the middle of it, only at its end (or a pause)
  {
    const ends = await page.evaluate(() => HOST.cur.peek('CH.map(c => narrT(c.b))'));
    const i = ends.findIndex((e, k) => k > 0 && e - ends[k - 1] > 14);
    await page.evaluate(t => { const A = HOST.cur.collab.APP; A.enterStory(t); A.playing = true; }, ends[i] - 7);
    const n0 = await swapsNow(page);
    change('airports', 'changed while playing');
    await page.evaluate(() => HOST.live.check('test'));
    await wait(2500);
    const mid = await page.evaluate(() => ({ swaps: HOST.swaps || 0, pending: HOST.live.pending, t: HOST.cur.collab.APP.t, playing: HOST.cur.collab.APP.playing }));
    const swapped = await until(page, n => (HOST.swaps || 0) > n && HOST.cur && HOST.cur.collab.scene(), n0, 15000);
    await wait(500);
    const after = await place(page);
    report('a playing chapter is not swapped in the middle, only at its end', mid.swaps === n0 && mid.pending === 'airports' && mid.playing && swapped &&
      after.mode === 'story' && after.playing && after.t >= ends[i] - 0.3 && after.t < ends[i] + 3, { mid, after, end: ends[i] });
  }

  // another shell: asked first; Reload now keeps the place
  {
    await page.evaluate(() => { const c = HOST.cur.collab; c.APP.enterExplore(); const s = c.state(); s.sel = 'LHR'; c.apply(s); });
    await wait(1500);
    const before = await place(page);
    touch('shared.js', 'another shell'); setVersion(vnum = 1002); release();
    await page.evaluate(() => HOST.live.check('test'));
    const asked = await until(page, () => !document.getElementById('livebar').hidden && /new version of the app/.test(document.querySelector('#livebar span').textContent), null, 8000);
    const stayed = await page.evaluate(() => window.__mark === 1 && HOST.curKey === 'airports');
    report('another shell: asked first (Reload now or Later), nothing reloaded by itself', asked && stayed);
    // the headset's panel for the question (drawn by the shell; no headset here: its test switch), pointed at and
    // pressed through the shell's pointer hooks (HOST.collab.ray and press, which every story calls): Later
    const xq = await page.evaluate(() => {
      const X = HOST.live.xr();
      X.test = true; HOST.live.xrTick(); HOST.live.xrTick();
      const m = X.mesh, v = new THREE.Vector3(0.171, -0.0815, 0), n = new THREE.Vector3(0, 0, 1);   // (the middle of Later)
      if (!m || !m.visible || !m.parent) return { shown: false };
      m.updateMatrixWorld(true);
      m.localToWorld(v); n.transformDirection(m.matrixWorld);
      const o = v.clone().addScaledVector(n, 0.6), d = n.clone().negate();
      const h = HOST.collab.ray(0, o, d, Infinity);
      HOST.collab.press(0);
      X.test = false; HOST.live.xrTick();
      return { shown: true, hit: h && h.kind, near: h ? Math.abs(h.dist - 0.6) < 0.01 : false, after: HOST.live.question, bar: document.getElementById('livebar').hidden, gone: !m.visible };
    });
    report('... the headset\'s panel: in front, pointed at and pressed (Later) through the shell\'s pointer hooks', xq.shown && xq.hit === 'shell' && xq.near && xq.after === '' && xq.bar && xq.gone, xq);
    await page.evaluate(() => HOST.live.ask('shell'));
    await page.click('#livebar [data-live="reload"]');
    const back = await until(page, () => typeof HOST !== 'undefined' && !window.__mark && HOST.curKey === 'airports' && HOST.cur && HOST.cur.collab.scene() && HOST.cur.collab.APP.mode === 'explore', null, 30000);
    await wait(2000);
    const after = await place(page);
    report('... Reload now: the page reloads with its place (story, mode, explore state)', back && after.state === before.state && /LHR/.test(after.state), { before, after });
    await wait(3500);
    report('... and then nothing more to ask (the new shell runs)', await page.evaluate(v => HOST.shell.id === v && document.getElementById('livebar').hidden, JSON.parse(read('version.json')).shell.id));
  }
} catch (err) { failed = true; console.log('FAIL the live site:', err.stack || err); }
await ctx.close();
pages.close();

// ---- while developing: the relay with --watch --build serving the copy
const relay = spawn(process.execPath, [path.join(REPO, 'relay/server.mjs'), '--static', T, '--watch', '--build', '--port', String(RELAY_PORT), '--host', '127.0.0.1', '--no-peer'], { stdio: ['ignore', 'pipe', 'pipe'] });
let relayOut = '';
relay.stdout.on('data', d => { relayOut += d; }); relay.stderr.on('data', d => { relayOut += d; });
for (let i = 0; i < 50 && !/listening/.test(relayOut); i++) await wait(100);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ARGS });
const dev = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await dev.addInitScript(soundOn);
watchErrors(dev, 'dev');
try {
  await dev.goto(DEV + '#airports');
  await built(dev, 'airports');
  report('the page learns that the relay watches (api/ping)', await until(dev, () => HOST.live.watching, null, 8000));
  await wait(500);
  await built(dev, 'airports');   // (the story's APP is the shell's to call only once it is built: see below)
  await dev.evaluate(() => { window.__mark = 1; const A = HOST.cur.collab.APP; A.enterStory(60); A.playing = false; });
  // a story file touched: swapped within about 2 s
  {
    const n0 = await swapsNow(dev), t0 = Date.now();
    touch(fileOf('airports'), 'touched while developing');
    // (the swap within about 2 s: the new file fetched and run; its build then takes as long as any load of the story,
    // its shaders compiled before the scene shows since the loading bar, seconds in software WebGL on a busy machine)
    const swapped = await until(dev, n => (HOST.swaps || 0) > n, n0, 8000), ms = Date.now() - t0;
    const ready = swapped && await until(dev, () => HOST.cur && HOST.cur.collab.scene(), null, 20000), ms2 = Date.now() - t0;
    const after = await place(dev);
    report(`a story file touched: swapped in place within about 2 s (${ms} ms; built at ${ms2} ms)`, swapped && ready && ms < 3000 && after.mode === 'story' && near(after.t, 60) && !after.playing && await dev.evaluate(() => window.__mark === 1), after);
  }
  // --build: a set's source touched builds the story, which then swaps
  {
    await dev.evaluate(() => HOST.start('flock')); await built(dev, 'flock');
    const n0 = await swapsNow(dev), fp0 = await dev.evaluate(() => HOST.fp.flock);
    touch('packages/flock/src/engine/e7_app.js', 'a source touched while developing');
    const swapped = await until(dev, n => (HOST.swaps || 0) > n && HOST.cur && HOST.cur.collab.scene(), n0, 20000);
    report('--build: a set\'s source touched builds its story, which swaps', swapped && await dev.evaluate(f => HOST.fp.flock !== f && HOST.curKey === 'flock', fp0) && /build: (pkg:)?flock done/.test(relayOut));
  }
  // the list read again (a card's title changed)
  {
    // (a story still in stories/list.js: the flock's card comes from its package's story.json since v186)
    if (/title: 'Airports'/.test(read('stories/list.js'))) write('stories/list.js', read('stories/list.js').replace("title: 'Airports'", "title: 'Airports, changed'"));
    else { write('packages/airports/story.json', read('packages/airports/story.json').replace('"title": "Airports"', '"title": "Airports, changed"')); scan(); }   // (a package: its story.json, the index again)
    await dev.evaluate(() => HOST.menu.open('main'));   // (the flock is an Experiment since v188: its set of cards was on show)
    report('the list touched: read again, the card changed without a reload', await until(dev, () => /Airports, changed/.test((document.querySelector('#picker [data-story="airports"]') || {}).textContent || '') && window.__mark === 1, null, 8000));
  }
  // a station in a shared room: the swap writes nothing to the room
  {
    await dev.evaluate(() => HOST.start('airports')); await built(dev, 'airports');
    await dev.evaluate(() => { HOST.collab.autoAll(false); HOST.collab.create(); });   // (no arc of its own: one station only)
    await until(dev, () => HOST.collab.code && HOST.collab.status === 'open', null, 15000);
    const id = await dev.evaluate(() => HOST.collab.add('airports'));
    await dev.evaluate(i => HOST.collab.follow(i), id);
    const live = await until(dev, i => HOST.collab.live() && HOST.collab.live().id === i && !HOST.collab.internals().pending.size, id, 10000);
    await wait(2500);
    const seq = () => dev.evaluate(() => fetch('/api/rooms/' + HOST.collab.code).then(r => r.json()).then(j => j.seq));
    const s0 = await seq(), n0 = await swapsNow(dev);
    touch(fileOf('airports'), 'touched at a station');
    const swapped = await until(dev, n => (HOST.swaps || 0) > n && HOST.cur && HOST.cur.collab.scene(), n0, 8000);
    await wait(3000);
    const s1 = await seq(), still = await dev.evaluate(i => HOST.collab.live() && HOST.collab.live().id === i, id);
    report('at a station in a shared room: swapped, still following, nothing written to the room', live && swapped && still && s0 === s1, { live, swapped, still, s0, s1 });
    // a station of a story this device does not know: its card says so, the update is offered, Arrange all keeps it
    await dev.evaluate(() => HOST.collab.publish([['st.zz1', { story: 'newstory', x: 6, z: -3, yaw: 0 }]]));
    const asked = await until(dev, () => /newstory/.test(HOST.live.question) && HOST.collab.station('zz1') && HOST.collab.station('zz1').story === 'newstory', null, 8000);
    await dev.evaluate(() => HOST.collab.dialog(true));
    const card = await until(dev, () => /Another story/.test(document.querySelector('#shared .sh-stations').textContent), null, 3000);
    await dev.evaluate(() => HOST.collab.dialog(false));
    await dev.evaluate(() => HOST.collab.arrange());
    await wait(1500);
    const kept = await dev.evaluate(() => !!HOST.collab.station('zz1') && HOST.collab.stations().length === HOST.list.length + 1);
    report('a station of a story this device does not know: shown ("Another story", Not on this device), the update offered, kept by Arrange all', asked && card && kept, { asked, card, kept });
    await dev.evaluate(() => { HOST.live.later(); HOST.collab.leave(); });
    await wait(500);
  }
  // in a shared room (v136): a new FORMAT asked about on a page outside a headset: the bar's third button, Reload every
  // device (Update the room's two presses), and a countdown (20 s; 4 s here) to taking it by itself; Not now holds it off
  // (5 minutes; 3 s here), then it asks again and counts down; by itself it reloads with its place, back in the room
  {
    await dev.evaluate(() => HOST.collab.create());
    await until(dev, () => HOST.collab.code && HOST.collab.status === 'open', null, 15000);
    const code = await dev.evaluate(() => HOST.collab.code);
    await dev.evaluate(() => { window.__mark = 1; HOST.live.times({ countdown: 4000, hold: 3000 }); HOST.live.ask('format'); });
    const bar = () => dev.evaluate(() => { const b = document.getElementById('livebar'), q = s => b.querySelector(s), r = q('[data-live="room"]');
      return { shown: !b.hidden, text: q('span').textContent, room: r.hidden ? '' : r.textContent, later: q('[data-live="later"]').textContent }; });
    await until(dev, () => /Reloading by itself in/.test(document.querySelector('#livebar span').textContent), null, 3000);   // (counted from the next tick)
    const b0 = await bar();
    await dev.click('#livebar [data-live="room"]');
    const b1 = await bar(), armed = await dev.evaluate(() => HOST.collab.roomReload.armed());
    report('in a shared room, a new FORMAT asked about: the bar\'s third button Reload every device (the first press arms it), a countdown to taking it by itself, Not now',
      b0.shown && b0.room === 'Reload every device' && /Reloading by itself in [34] s\./.test(b0.text) && b0.later === 'Not now' && b1.room === 'Reload every device? Press again' && armed, { b0, b1, armed });
    await dev.click('#livebar [data-live="later"]');
    const b2 = await bar();
    await wait(1500);
    const b3 = await bar();
    const again = await until(dev, () => !document.getElementById('livebar').hidden && /Reloading by itself in/.test(document.querySelector('#livebar span').textContent), null, 6000);
    report('... Not now holds it off (3 s here, 5 minutes in the app), then it asks again, counting down', !b2.shown && !b3.shown && again && await dev.evaluate(() => window.__mark === 1), { b2, b3, again });
    const back = await until(dev, c => typeof HOST !== 'undefined' && !window.__mark && HOST.curKey === 'airports' && HOST.cur && HOST.cur.collab.scene() && HOST.collab.code === c && HOST.collab.status === 'open', code, 30000);
    report('... and the page takes it by itself (nothing pressed), reloading back into the room with its place', back, await dev.evaluate(() => typeof HOST !== 'undefined' && { mark: window.__mark, key: HOST.curKey, code: HOST.collab.code, status: HOST.collab.status }));
    await dev.evaluate(() => { HOST.collab.leave(); window.__mark = 1; });
    await wait(500);
  }
  // a shell file touched: the page reloads with its place
  {
    await dev.evaluate(() => { const c = HOST.cur.collab; c.APP.enterExplore(); const s = c.state(); s.sel = 'JFK'; c.apply(s); window.__mark = 1; });
    await wait(1500);
    const before = await place(dev);
    write('index.html', read('index.html') + '\n<!-- touched while developing -->\n');
    const back = await until(dev, () => typeof HOST !== 'undefined' && !window.__mark && HOST.curKey === 'airports' && HOST.cur && HOST.cur.collab.scene() && HOST.cur.collab.APP.mode === 'explore', null, 30000);
    await wait(1500);
    const after = await place(dev);
    report('a shell file touched: the page reloads with its place', back && after.state === before.state && /JFK/.test(after.state), { before, after });
  }
  // a reload that ended a headset session: one button to go back in, the story waiting
  {
    // (the story built first: the shell file's step can leave the page reloading once more as the relay sees its last
    // write, and a story's APP called before its build (HOST.cur set, the scene not) throws: it was this test's
    // "TypeError reading 'aXrm'" from airports' setClosedAttributes; the app calls APP only once the story is built,
    // HOST.putPlace on its frame loop, shared.js after collab.scene())
    // (and the page settled: no reload for 2.5 s. Seen 27 November 2026: one write of index.html above reloaded the page
    // twice, the second after the step had passed, so a place set here went with it. A relay matter while developing, not
    // what this step checks; the place is set and saved in one go on a settled page)
    for (let k = 0; k < 8; k++) { await built(dev, 'airports'); await dev.evaluate(() => { window.__settle = 1; }); await wait(2500); if (await dev.evaluate(() => window.__settle === 1).catch(() => false)) break; }
    await dev.evaluate(() => { const A = HOST.cur.collab.APP; A.enterStory(30); A.playing = true; const P = HOST.place(); P.xr = 'immersive-vr'; P.at = Date.now(); sessionStorage.setItem('livePlace', JSON.stringify(P)); location.reload(); });
    const back = await until(dev, () => typeof HOST !== 'undefined' && HOST.curKey === 'airports' && HOST.cur && HOST.cur.collab.scene() && !document.getElementById('xrgo').hidden, null, 30000);
    await wait(1000);
    const r = await dev.evaluate(() => ({ text: document.getElementById('xrgo').textContent, mode: HOST.cur.collab.APP.mode, t: HOST.cur.collab.APP.t, playing: HOST.cur.collab.APP.playing }));
    report('after a reload that ended a headset session: "Enter VR to continue", the story waiting where it was', back && r.text === 'Enter VR to continue' && r.mode === 'story' && !r.playing && near(r.t, 30, 0.5), r);
  }
} catch (err) { failed = true; console.log('FAIL while developing:', err.stack || err); }
await browser.close();
relay.kill();
if (errors.length) { failed = true; console.log('page errors:\n  ' + errors.join('\n  ')); }
fs.rmSync(T, { recursive: true, force: true });
fs.rmSync(prof, { recursive: true, force: true });
console.log(failed ? 'live test FAILED' : 'live test: all good');
process.exit(failed ? 1 : 0);
