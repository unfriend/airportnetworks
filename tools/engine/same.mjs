// Does a refactor of the built stories change what they draw? Serves two copies of the app (before and after: e.g. a
// git worktree of the last commit and this folder), opens each story in both, paused at a few moments of the story
// and in explore mode, on a desktop page and a phone-sized one, and compares the pictures pixel by pixel (in the page,
// on a canvas: no packages). It prints, per story and moment, the share of pixels that differ by more than a little,
// and with --shots <dir> keeps both pictures and a contact sheet of every pair that differs.
// usage: node tools/engine/same.mjs <before dir> [<after dir>] [--keys micro,ovary] [--views desk,phone] [--shots dir]
//                                   [--wait ms]
// (A refactor that means to change nothing shows 0 everywhere; the live simulations, flock, robots and the pass story's
// fish, differ by themselves and are compared only in explore mode at its start. Reads like the smoke test: Playwright
// with Chromium, WebGL in SwiftShader.)
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../..');
const ARGS = process.argv.slice(2), opt = n => { const i = ARGS.indexOf(n); return i >= 0 ? ARGS[i + 1] : null; };
const dirs = ARGS.filter((a, i) => !a.startsWith('--') && !['--keys', '--shots', '--wait', '--views'].includes(ARGS[i - 1]));
if (!dirs.length) { console.log('usage: node tools/engine/same.mjs <before dir> [<after dir>] [--keys a,b] [--views desk,phone] [--shots dir] [--wait ms]'); process.exit(1); }
const A = path.resolve(dirs[0]), B = path.resolve(dirs[1] || root), SHOTS = opt('--shots'), WAIT = +(opt('--wait') || 2500);
const KEYS = (opt('--keys') || 'lbi,nmd,endo,pet,micro,ovary,qubits,mutation,topo,soil,pass,flock,robots,tutorial,design').split(',');
const LIVE = new Set(['flock', 'robots', 'pass']);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const serve = dir => new Promise(res => {
  const s = http.createServer((q, r) => {
    const p = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(r);
  }).listen(0, '127.0.0.1', () => res(s));
});
const sA = await serve(A), sB = await serve(B);
const url = s => `http://127.0.0.1:${s.address().port}/`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const VIEWS_ALL = [['desk', { viewport: { width: 960, height: 600 } }], ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]];
const VIEWS = VIEWS_ALL.filter(v => (opt('--views') || 'desk,phone').split(',').includes(v[0]));
const settle = ms => new Promise(r => setTimeout(r, ms));
async function open(ctx, base, key, errs) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(key + ': ' + (e.stack || e.message).split('\n')[0]));
  p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(key + ': ' + m.text().slice(0, 200)); });
  // a fresh worker-less page: no service worker, no audio
  await p.goto(`${base}index.html?nosw#${key}&t=0`);
  await p.waitForFunction(k => typeof HOST === 'object' && HOST.curKey === k && HOST.cur && HOST.cur.peek('LOAD.done'), key, { timeout: 180000 });
  await settle(WAIT);
  return p;
}
// moments: three in the story (a quarter, half, three quarters of its length) and explore mode
const MOMENTS = [['t25', 0.25], ['t50', 0.5], ['t75', 0.75], ['explore', null]];
async function at(p, m) {
  if (m[1] == null) await p.evaluate(() => HOST.cur.peek('APP.mode === "explore" || APP.enterExplore()'));
  else await p.evaluate(f => HOST.cur.peek(`APP.playing = false; APP.t = T_END * ${f}`), m[1]);
  await settle(WAIT);
  return (await p.screenshot()).toString('base64');
}
const cmpPage = await browser.newPage();
const diff = (a, b) => cmpPage.evaluate(async ([a, b]) => {
  const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return 1;
  const c = new OffscreenCanvas(ia.width, ia.height), g = c.getContext('2d');
  g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data;
  g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
  return n / (da.length / 4);
}, [a, b]);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const errs = [], rows = [], pairs = [];
for (const [vn, vo] of VIEWS) {
  const cA = await browser.newContext({ ...vo, serviceWorkers: 'block' }), cB = await browser.newContext({ ...vo, serviceWorkers: 'block' });
  for (const c of [cA, cB]) await c.addInitScript(() => { try { localStorage.setItem('collabAutoWelcome', 'off'); localStorage.setItem('collabAutoAll', 'off'); localStorage.setItem('tutorialHold', 'off'); } catch (e) { /* blocked */ } });
  for (const key of KEYS) {
    const eA = [], eB = [];
    let pA, pB;
    try { [pA, pB] = await Promise.all([open(cA, url(sA), key, eA), open(cB, url(sB), key, eB)]); }
    catch (e) { rows.push(`${vn.padEnd(6)} ${key.padEnd(9)} did not load: ${e.message.split('\n')[0]}`); console.log(rows[rows.length - 1]); continue; }
    const line = [];
    for (const m of MOMENTS) {
      if (LIVE.has(key) && m[1] != null) continue;
      const [a, b] = await Promise.all([at(pA, m), at(pB, m)]);
      const d = await diff(a, b);
      line.push(`${m[0]} ${(d * 100).toFixed(2)}%`);
      if (SHOTS && d > 0.001) {
        const n = `${vn}-${key}-${m[0]}`;
        fs.writeFileSync(path.join(SHOTS, n + '-before.png'), Buffer.from(a, 'base64'));
        fs.writeFileSync(path.join(SHOTS, n + '-after.png'), Buffer.from(b, 'base64'));
        pairs.push([n, a, b]);
      }
    }
    rows.push(`${vn.padEnd(6)} ${key.padEnd(9)} ${line.join('  ')}`);
    console.log(rows[rows.length - 1]);
    errs.push(...eA.map(e => 'before ' + vn + ' ' + e), ...eB.map(e => 'after  ' + vn + ' ' + e));
    await pA.close(); await pB.close();
  }
  await cA.close(); await cB.close();
}
if (SHOTS && pairs.length) {
  // a contact sheet of the pairs that differ (before left, after right), at most 24 a sheet
  for (let s = 0; s * 24 < pairs.length; s++) {
    const html = `<body style="margin:0;background:#111;color:#ccc;font:12px sans-serif;display:grid;grid-template-columns:repeat(4,1fr);gap:4px">` +
      pairs.slice(s * 24, s * 24 + 24).map(([n, a, b]) => `<div>${n}<br><img src="data:image/png;base64,${a}" style="width:49%"> <img src="data:image/png;base64,${b}" style="width:49%"></div>`).join('') + '</body>';
    const sp = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await sp.setContent(html); await settle(300);
    await sp.screenshot({ path: path.join(SHOTS, `sheet-${s + 1}.png`), fullPage: true });
    await sp.close();
  }
}
console.log(errs.length ? 'console errors:\n  ' + [...new Set(errs)].join('\n  ') : 'no console errors');
await browser.close(); sA.close(); sB.close();
