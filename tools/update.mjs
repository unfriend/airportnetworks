// Update test: what a returning visitor gets after a new version is deployed. Installs an
// older version (service worker and offline cache), then serves this one the way GitHub Pages
// does (browsers may keep files for ten minutes) and checks that the page and its story files
// are from the same, new version within the first visit, on the next visit and offline.
// Usage: git worktree add /tmp/old <an earlier commit>
//        node tools/update.mjs /tmp/old [.]
// PLAYWRIGHT_MODULE and CHROMIUM_PATH as in smoke.mjs. Uses port 8125.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// the version of the page and of the story it runs: both new when the shell has HOST.ended and the story calls it
const versions = async () => {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await page.evaluate(() => HOST.cur && { shell: typeof HOST.ended === 'function', story: HOST.cur.peek('String(frame)').includes('HOST.ended') });
      if (r && ((r.shell && r.story) || i === 79)) return r;
    } catch (e) { /* the page is reloading */ }
    await wait(250);
  }
  return null;
};
let failed = false;
const report = (what, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ': ' + detail : ''}`); };

let srv = await serve(oldDir);
await page.goto('http://127.0.0.1:8125/');
await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.cur, null, { timeout: 30000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await wait(3000);
await page.reload();
await page.waitForFunction(() => typeof HOST !== 'undefined' && HOST.cur && navigator.serviceWorker.controller, null, { timeout: 30000 });
await wait(1500);
console.log('older version installed and looking after the page');
await stop(srv);
srv = await serve(newDir);
for (const visit of ['first visit after the update', 'next visit']) {
  await page.reload();
  const v = await versions();
  report(visit + ': page and stories are new', v && v.shell && v.story, JSON.stringify(v));
}
await stop(srv);
await page.reload().catch(() => {});
const v = await versions();
report('offline: the app opens from the cache', v && v.shell && v.story, JSON.stringify(v));
await page.evaluate(() => HOST.go('lbi'));
await page.waitForFunction(() => HOST.curKey === 'lbi' && HOST.cur, null, { timeout: 30000 }).catch(() => {});
report('offline: another story loads', await page.evaluate(() => HOST.curKey === 'lbi' && !!HOST.cur));
if (errors.length) { failed = true; console.log('page errors:\n  ' + errors.join('\n  ')); }
await ctx.close();
fs.rmSync(prof, { recursive: true, force: true });
console.log(failed ? 'update test FAILED' : 'update test: all good');
process.exit(failed ? 1 : 0);
