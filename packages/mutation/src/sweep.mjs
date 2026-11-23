// Screenshots of the whole mutation story at given story times (as in CH: not the timeline, see NARRATION_SYNC), from one page load. Serve the repository root on port 8123 first.
// usage (from tools/mutation): node sweep.mjs <prefix> "t1,t2,..." [width height]   -> shots/<prefix>-<t>.png
import fs from 'fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [,, prefix, times, W, H] = process.argv;
const DIR = process.env.SHOTS || 'shots', PORT = process.env.PORT || 8123;   // (where shots go, and the server's port)
fs.mkdirSync(DIR, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: +(W || 1280), height: +(H || 760) } });
const errs = [];
pg.on('pageerror', e => errs.push(e.stack || e.message));
pg.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/404|Failed to load resource/.test(m.text())) errs.push(m.type() + ': ' + m.text()); });
const t0 = Date.now();
await pg.goto(`http://127.0.0.1:${PORT}/index.html#mutation&t=0.5`);
await pg.waitForFunction(() => typeof HOST !== 'undefined' && HOST.cur && HOST.cur.peek('typeof ST !== "undefined" && ST.items.length > 0') && window.__frames > 2, null, { timeout: 120000 });
await pg.evaluate(() => HOST.cur.peek('for (const k in GL.sets) if (GL.sets[k].finish) GL.sets[k].finish();'));   // sets that build in slices
console.log('ready in', Date.now() - t0, 'ms');
for (const t of times.split(',')) {
  await pg.evaluate(t => HOST.cur.peek(`APP.seek(narrT(${t})); APP.playing = false;`), +t);
  const f0 = await pg.evaluate(() => window.__frames);
  await pg.waitForFunction(f => window.__frames > f + 2, f0, { timeout: 60000 });
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${DIR}/${prefix}-${t}.png` });
}
console.log('errors:', JSON.stringify(errs));
await b.close();
