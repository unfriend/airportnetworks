// Screenshots of the robot gang in the harness. Serve the repository root on port 8123 first.
// usage (from tools/robots): node shot.mjs <set> "<query>|<query>|..." <outprefix> [width height]
//   each query is the rest of the harness URL, e.g. "p=robots_rule:2,robots_links:1&sim=20&cam=35,52,8.6,0,0.1,0.15"
// writes shots/<outprefix>-<k>.png and prints build/frame stats and page errors
import fs from 'fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [,, set, queries, out, W, H] = process.argv;
fs.mkdirSync('shots', { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: +(W || 1100), height: +(H || 700) } });
const errs = [];
pg.on('pageerror', e => errs.push(e.stack || e.message));
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
let k = 0;
for (const q of (queries || '').split('|')) {
  await pg.goto('about:blank');
  await pg.goto(`http://127.0.0.1:8123/tools/robots/harness.html?set=${set}&${q}`);
  try { await pg.waitForFunction('window.__ready === true', null, { timeout: 120000 }); } catch (e) { errs.push('timeout waiting for first frame: ' + q); }
  await pg.waitForTimeout(400);
  const st = await pg.evaluate(() => window.__stats);
  const path = `shots/${out}-${k++}.png`;
  await pg.screenshot({ path });
  console.log(path, JSON.stringify(st));
}
console.log('errors:', JSON.stringify(errs));
await b.close();
