// Screenshots of one set in the harness. Serve the repository root on port 8123 first.
// usage (from tools/mutation): node shot.mjs <set> "<query>|<query>|..." <outprefix> [width height]
//   each query is the rest of the harness URL, e.g. "p=rule_path:1&cam=pyramid"
// writes shots/<outprefix>-<k>.png and prints build/frame stats and page errors
import fs from 'fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [,, set, queries, out, W, H] = process.argv;
const DIR = process.env.SHOTS || 'shots', PORT = process.env.PORT || 8123;   // (where shots go, and the server's port)
fs.mkdirSync(DIR, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: +(W || 1100), height: +(H || 700) } });
const errs = [];
pg.on('pageerror', e => errs.push(e.stack || e.message));
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
let k = 0;
for (const q of (queries || '').split('|')) {
  await pg.goto('about:blank');
  await pg.goto(`http://127.0.0.1:${PORT}/tools/mutation/harness.html?set=${set}&${q}`);
  try { await pg.waitForFunction('window.__ready === true', null, { timeout: 60000 }); } catch (e) { errs.push('timeout waiting for first frame: ' + q); }
  await pg.waitForTimeout(400);
  const st = await pg.evaluate(() => window.__stats);
  const path = `${DIR}/${out}-${k++}.png`;
  await pg.screenshot({ path });
  console.log(path, JSON.stringify(st));
}
console.log('errors:', JSON.stringify(errs));
await b.close();
