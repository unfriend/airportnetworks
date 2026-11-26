// Does a refactor change the built stories' headset panels? Draws each story's main panel and footer (XR.main, XR.foot:
// drawMain/sigMain, drawFoot/sigFoot) off-headset on their canvases, in two copies of the app, at 24 paused story
// moments, one playing moment (50 ms of real time: it may differ by itself), explore mode, every tab and scene and the
// Stories screen, and compares the change signature, the clickable regions and the pixels exactly. Written for step 1b
// of the packages plan (docs/agents/stories.md, "Shared engine parts").
// usage: node tools/engine/panelsame.mjs <before dir> <after dir> [--keys a,b] [--out dir]
import fs from 'fs'; import http from 'http'; import path from 'path'; import crypto from 'crypto';
const ARGS = process.argv.slice(2), opt = n => { const i = ARGS.indexOf(n); return i >= 0 ? ARGS[i + 1] : null; };
const A = path.resolve(ARGS[0]), B = path.resolve(ARGS[1]);
const KEYS = (opt('--keys') || 'lbi,nmd,endo,pet,micro,ovary,qubits,mutation,topo,soil,pass,flock,robots,tutorial').split(',');   // (the design room's 'design' until v217: parked)
const OUT = opt('--out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const serve = dir => new Promise(res => { const s = http.createServer((q, r) => {
  const p = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(p).pipe(r);
}).listen(0, '127.0.0.1', () => res(s)); });
const sA = await serve(A), sB = await serve(B), url = s => `http://127.0.0.1:${s.address().port}/`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const settle = ms => new Promise(r => setTimeout(r, ms));
// paint both panels as panelTick would, and return what they show
const PAINT = `(() => { const out = {};
  for (const [n, P] of [['main', XR.main], ['foot', XR.foot]]) {
    const ctx = P.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, P.w, P.h);
    ctx.globalAlpha = 1; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; P.regions = [];
    let err = '';
    try { panelPaint(ctx, P); } catch (e) { err = String(e); }
    out[n] = { sig: P.sig(), img: P.cv.toDataURL(), regions: JSON.stringify(P.regions.map(r => [r.id, Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)])), err };
  }
  return JSON.stringify(out); })()`;
const h = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
async function open(ctx, base, key, errs) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push((e.stack || e.message).split('\n')[0]));
  await p.goto(`${base}index.html?nosw#${key}&t=0`);
  await p.waitForFunction(k => typeof HOST === 'object' && HOST.curKey === k && HOST.cur && HOST.cur.peek('LOAD.done'), key, { timeout: 240000 });
  await settle(1500);
  return p;
}
const peek = (p, src) => p.evaluate(s => HOST.cur.peek(s), src);
let bad = 0;
for (const key of KEYS) {
  const cA = await browser.newContext({ viewport: { width: 960, height: 600 }, serviceWorkers: 'block' }), cB = await browser.newContext({ viewport: { width: 960, height: 600 }, serviceWorkers: 'block' });
  const eA = [], eB = [];
  let pA, pB;
  try { [pA, pB] = await Promise.all([open(cA, url(sA), key, eA), open(cB, url(sB), key, eB)]); }
  catch (e) { console.log(key, 'did not load', e.message.split('\n')[0]); bad++; continue; }
  const moments = [];
  for (let i = 0; i < 24; i++) moments.push(['t' + i, `APP.playing = false; APP.t = T_END * ${(i + 0.5) / 24}; 0`]);
  moments.push(['playing', 'APP.t = T_END * 0.3; APP.playing = true; 0']);
  moments.push(['explore', 'APP.playing = false; APP.mode === "explore" || APP.enterExplore(); 0']);
  const tabs = JSON.parse(await peek(pB, 'JSON.stringify(typeof TABS === "undefined" ? [] : TABS.map(t => t[0]))'));
  for (const t of tabs) moments.push(['tab:' + t, `X.tab = ${JSON.stringify(t)}; (typeof pickTab === 'function' ? pickTab : showTab)(${JSON.stringify(t)}); 0`]);
  const scenes = JSON.parse(await peek(pB, 'JSON.stringify(typeof SCENES === "undefined" ? [] : SCENES.map(t => t[0]))'));
  for (const s of scenes) moments.push(['scene:' + s, `X.tab = TABS && TABS.some(t => t[0] === 'scenes') ? 'scenes' : X.tab; typeof showTab === 'function' && showTab(X.tab); openScene(${JSON.stringify(s)}); 0`]);
  moments.push(['stories', 'XR.stories = true; 0']);
  const diffs = [];
  for (const [n, src] of moments) {
    const r = await Promise.all([pA, pB].map(async p => { try { await peek(p, src); } catch (e) { return { e: String(e) }; } await settle(n === 'playing' ? 50 : 400); return JSON.parse(await peek(p, PAINT)); }));
    if (r[0].e || r[1].e) { if (r[0].e !== r[1].e) diffs.push(`${n}: step error ${r[0].e} | ${r[1].e}`); continue; }
    for (const pn of ['main', 'foot']) {
      const a = r[0][pn], b = r[1][pn], d = [];
      if (a.err !== b.err) d.push(`err ${a.err} | ${b.err}`);
      if (a.sig !== b.sig) d.push(`sig ${a.sig.slice(0, 120)} | ${b.sig.slice(0, 120)}`);
      if (a.regions !== b.regions) d.push(`regions ${h(a.regions)} ${h(b.regions)}`);
      if (a.img !== b.img) {
        d.push(`img ${h(a.img)} ${h(b.img)}`);
        if (OUT) { fs.mkdirSync(OUT, { recursive: true }); for (const [w, x] of [['before', a], ['after', b]]) fs.writeFileSync(path.join(OUT, `${key}-${n.replace(/:/g, '_')}-${pn}-${w}.png`), Buffer.from(x.img.split(',')[1], 'base64')); }
      }
      if (d.length) diffs.push(`${n} ${pn}: ${d.join('; ')}`);
    }
  }
  console.log(`${key.padEnd(9)} ${moments.length} moments: ${diffs.length ? diffs.length + ' differ' : 'same'}${eA.length || eB.length ? ` errors before ${eA.length} after ${eB.length}` : ''}`);
  for (const d of diffs.slice(0, 12)) console.log('   ' + d);
  for (const e of [...new Set(eB)].slice(0, 3)) console.log('   after error: ' + e);
  if (diffs.length) bad++;
  await cA.close(); await cB.close();
}
await browser.close(); sA.close(); sB.close();
process.exit(bad ? 1 : 0);
