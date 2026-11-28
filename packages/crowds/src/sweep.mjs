// The sweep: loads Protein crowds headless and measures, for each number of balls, each way of drawing and each view,
// the balls drawn, the draws, the frame time and the culling pass's own time on the CPU with every culling switch off,
// each one alone, and all on; then whether the impostors' true depth (gl_FragDepth) costs anything against the flat
// ones with front-to-back order; then checks that leaving out cells (out of view, hidden) changes no pixel. Headless
// Chromium draws in software (SwiftShader), so its frame times only compare the cases with each other: a headset's
// graphics card is another matter.
// A frame: the story's whole frame (its sets' update, the culling and the render) run in the page and waited for (a
// pixel read back), after one to warm up; a case's time is the median of as many as come in --frames frames or --secs
// seconds, whichever ends first (so a slow case has fewer: each row says how many). The culling's time is the mean of
// the same frames.
// usage: node packages/crowds/src/sweep.mjs [--counts 10000,100000,300000,1000000] [--views default,inside] [--draws 0,1]
//          [--what 1] [--size 1] [--frames 24] [--secs 8] [--max-tris 30000000] [--parts main,depth,holes]
//          [--cases none,"hidden cells",...] [--depth-counts 100000,1000000] [--shots <dir>] [--port <n>]
//   (prints Markdown tables, each row as it is measured; views: default (outside), inside, close, far; draws: 0
//   impostors, 1 meshes; what: 1 packed proteins, 0 the cloud; size: the Size control)
// A meshes case with more triangles than --max-tris is not measured (a single frame of it takes minutes in software),
// and a meshes page whose balls with every switch off would pass twice that (a million balls: 80 million triangles) is
// not opened at all: its first frames, drawn while it loads, took the browser down in every run that tried.
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..', '..', '..');
const require = createRequire(import.meta.url);
const { serve, portArg } = await import('../../../tools/lib/serve.mjs');
const ARGS = process.argv.slice(2), opt = (n, d) => { const i = ARGS.indexOf(n); return i >= 0 ? ARGS[i + 1] : d; };
const COUNTS = opt('--counts', '10000,100000,300000,1000000').split(',').map(Number), VIEWS = opt('--views', 'default,inside').split(',');
const FRAMES = +opt('--frames', 24), SECS = +opt('--secs', 8), SHOTS = opt('--shots', null), MAXT = +opt('--max-tris', 3e7), PARTS = opt('--parts', 'main,depth,holes').split(','), ONLY = opt('--cases', null);
const DRAWS = opt('--draws', '0,1').split(',').map(Number), WHAT = +opt('--what', 1), SIZE = opt('--size', '1'), DEPTH = opt('--depth-counts', '100000,1000000').split(',').map(Number);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = await import('playwright')); }
const srv = await serve(root, { port: portArg(ARGS) || 0 });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { localStorage.setItem('collabAutoWelcome', 'off'); localStorage.setItem('collabMenus', 'full'); localStorage.setItem('collabAutoAll', 'off'); localStorage.setItem('collabAskDefault', 'walk'); localStorage.setItem('tutorialHold', 'off'); } catch (e) { /* blocked */ } });
const peek = (p, s) => p.evaluate(src => HOST.cur.peek(src), s);
const SW = ['grid', 'lod', 'order', 'hide'];
const CASES = [['none', {}], ['cells out of view', { grid: 1 }], ['detail', { lod: 1 }], ['front to back', { order: 1 }], ['hidden cells', { hide: 1 }], ['all four', { grid: 1, lod: 1, order: 1, hide: 1 }]];
// the frames' times: the story's whole frame (its sets' update, the culling and the render), run straight after one
// another and waited for (a pixel read back, so the software renderer has finished), at most FRAMES frames or SECS
// seconds after one to warm up: the median and the mean, ms (the page's own clock, not the compositor's)
const frames = p => p.evaluate(([n, secs]) => HOST.cur.peek(`(() => {
  const gl = GL.renderer.getContext(), px = new Uint8Array(4), one = () => { frame(performance.now()); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  one();
  api('crowds').cullTime();
  const d = [], t0 = performance.now();
  while (d.length < ${n} && performance.now() - t0 < ${secs} * 1000) { const t = performance.now(); one(); d.push(performance.now() - t); }
  d.sort((a, b) => a - b);
  return { n: d.length, mean: d.reduce((a, b) => a + b, 0) / d.length, med: d[d.length >> 1], cull: api('crowds').cullTime() };
})()`), [FRAMES, SECS]);
async function settle(p, n = 4) { await p.evaluate(n2 => new Promise(r => { let k = 0; const f = () => (++k >= n2 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n); }
async function open(n, draw, view) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`${srv.url}index.html?nosw#crowds&explore&now&n=${n}&draw=${draw}&view=${view}&what=${WHAT}&size=${SIZE}`);
  await p.waitForFunction(() => { try { return HOST.cur && HOST.cur.peek('LOAD.done && api("crowds").ready()'); } catch (e) { return false; } }, null, { timeout: 300000, polling: 500 });
  await peek(p, 'setTurn("off"), api("crowds").freeze(0), 1');
  return { p, errs };
}
const setSw = (p, on) => peek(p, `(${JSON.stringify(SW)}).forEach(k => setCtl("crowds", k, ${JSON.stringify(on)}[k] ? "1" : "0")), 1`);
const stats = async p => JSON.parse(await peek(p, 'JSON.stringify((({ n, drawn, draws, tris, cellsDrawn, cells, out, hidden, thinOut, near }) => ({ n, drawn, draws, tris, cellsDrawn, cells, out, hidden, thinOut, near }))(GL.sets.crowds.stats()))'));
const fmt = v => Math.round(v).toLocaleString('en-GB'), big = v => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? Math.round(v / 1000) + 'k' : fmt(v));
const t0 = Date.now(), say = s => console.log(s), when = () => `${((Date.now() - t0) / 1000).toFixed(0)} s in`;
if (PARTS.includes('main')) {
  say('| View | Balls | Drawn as | Culling | Drawn | Draws | Triangles | Frame (ms) | Frames | Culling (ms) |'); say('| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const view of VIEWS) for (const n of COUNTS) for (const draw of DRAWS) {
    if (draw && n * 80 > 2 * MAXT) { say(`| ${view === 'default' ? 'outside' : view} | ${big(n)} | meshes | (every case) | | | ${big(n * 80)} with none | not run | | |`); continue; }
    const { p, errs } = await open(n, draw, view);
    for (const [name, on] of CASES) {
      if (ONLY && !ONLY.split(',').includes(name)) continue;
      await setSw(p, on); await settle(p, 1);   // (one frame: the culling has run, the counts are known)
      const s = await stats(p), slow = draw && s.tris > MAXT, f = slow ? null : await frames(p);
      say(`| ${view === 'default' ? 'outside' : view} | ${big(s.n)} | ${draw ? 'meshes' : 'impostors'} | ${name} | ${big(s.drawn)} | ${s.draws} | ${draw ? big(s.tris) : '-'} | ${slow ? 'not run' : fmt(f.med)} | ${slow ? '' : f.n} | ${slow ? '' : f.cull.mean.toFixed(2)} |`);
      console.error(`${view} ${big(s.n)} ${draw ? 'meshes' : 'impostors'} ${name}: ${slow ? 'not run' : `${f.med.toFixed(0)} ms, ${f.n} frames`} (${when()})`);
    }
    if (errs.length) console.error('page errors:', errs.slice(0, 3).join(' | '));
    await p.close();
  }
}
// gl_FragDepth and early depth rejection: every impostor with its true depth, or every one flat (its front's depth, no
// gl_FragDepth), front to back or not, the other switches off, inside the cube where most pixels are drawn over
if (PARTS.includes('depth')) {
  say(''); say('| Balls (inside) | Impostors | Front to back | Draws | Frame (ms) | Frames |'); say('| ---: | --- | --- | ---: | ---: | ---: |');
  for (const n of DEPTH) {
    const { p } = await open(n, 0, 'inside');
    for (const L of [0, 1]) for (const order of [0, 1]) {
      await setSw(p, { order }); await peek(p, `api("crowds").force(${L}), 1`); await settle(p);
      const f = await frames(p), s = await stats(p);
      say(`| ${big(s.n)} | ${L ? 'flat (no gl_FragDepth)' : 'true depth (gl_FragDepth)'} | ${order ? 'on' : 'off'} | ${s.draws} | ${fmt(f.med)} | ${f.n} |`);
    }
    await p.close();
  }
}
// no hole: cells out of view and hidden cells left out change no pixel (the jiggle stopped, the view still); the
// share of pixels that differ by more than a little between switch off and on
if (PARTS.includes('holes')) {
  say(''); say('| View | Balls | Switch | Cells left out | Pixels that differ |'); say('| --- | ---: | --- | ---: | ---: |');
  for (const view of VIEWS) {
    const n = COUNTS[COUNTS.length - 1], { p } = await open(n, 0, view);
    const shot = async () => { await settle(p, 3); return (await p.screenshot({ clip: { x: 530, y: 80, width: 740, height: 660 }, timeout: 180000 })).toString('base64'); };
    for (const k of ['grid', 'hide']) {
      await setSw(p, {}); const a = await shot();
      await setSw(p, { [k]: 1 }); const b = await shot(), s = await stats(p);
      const diff = await p.evaluate(async ([a2, b2]) => {
        const img = async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
        const A = await img(a2), B = await img(b2);
        let d = 0;
        for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 24) d++;
        return d / (A.length / 4);
      }, [a, b]);
      if (SHOTS) { const fs = await import('fs'); fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, `nohole-${view}-${k}-off.png`), Buffer.from(a, 'base64')); fs.writeFileSync(path.join(SHOTS, `nohole-${view}-${k}-on.png`), Buffer.from(b, 'base64')); }
      say(`| ${view === 'default' ? 'outside' : view} | ${big(s.n)} | ${k === 'grid' ? 'cells out of view' : 'hidden cells'} | ${k === 'grid' ? s.out : s.hidden} of ${s.cells} | ${(100 * diff).toFixed(3)} % |`);
    }
    await p.close();
  }
}
await browser.close(); await srv.close();
