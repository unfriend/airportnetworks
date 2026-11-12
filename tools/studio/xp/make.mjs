// node tools/studio/xp/make.mjs [--check] [--only <part,part>] [--out <folder>] [--sheet <file.png>]
// Makes the Bliss XP room, the studio's first example scene (examples/bliss-xp/; tools/studio/xp/README.md): every
// component of the video "Bliss (Windows XP)" as a model of our own, built in headless Chromium by the generator's page
// (page.html: three.js r128, its own GLTFExporter and GLTFLoader, kit.js and parts/*.js), written as a binary glTF with
// its clips, read back, checked and pictured for the studio's Add pane (previews/<the model's path>.jpg, 256 px); its
// sounds synthesised here (sounds.mjs: mono 16-bit WAV); its layout.json (layout.mjs); then examples/index.json and
// examples/bliss-xp/files.json by tools/studio/scan.mjs. Deterministic: run it again and nothing changes. When a check or
// a budget fails nothing is written (the folder keeps the last good build).
//   --check   builds into a temporary folder and says whether examples/bliss-xp is current (the same files; layout.json
//             and the sounds byte for byte, the models and pictures, made in the browser, within 2 % of their size), then
//             scan.mjs --check; exits 1 when not
//   --only    builds only those parts' models and pictures into the folder (while working on them; no layout, no sounds)
//   --sheet   also writes a contact sheet of every part's picture (for looking at them in one go)
// Budgets (it stops when one is passed): every model under 30,000 triangles and the room under 250,000 as placed, its
// pictures at most 1,024 px, the folder under 6 MB.
// Needs Playwright with a Chromium build (as tools/smoke.mjs; PLAYWRIGHT_MODULE and CHROMIUM_PATH as there).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { layoutText } from '../../../relay/scenes.mjs';
import { makeSounds } from './sounds.mjs';
import { makeLayout } from './layout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');
const SCENE = 'bliss-xp', EXAMPLES = path.join(REPO, 'examples');
const LIMIT = { tris: 30000, room: 250000, tex: 1024, folder: 6 << 20 };
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const check = args.includes('--check'), only = opt('--only') ? opt('--only').split(',') : null, sheet = opt('--sheet');
const out = check ? fs.mkdtempSync(path.join(os.tmpdir(), 'bliss-xp-')) : path.resolve(opt('--out') || path.join(EXAMPLES, SCENE));
const fail = m => { console.log('FAIL ' + m); process.exitCode = 1; };

// ---- the page: served from the repository (only the generator, its libraries and three.js)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=4096'] });
const built = new Map();
let pics = [];
try {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('page error: ' + e.message));
  const ALLOW = [/^tools\/studio\/xp\/[\w./-]+\.(html|js)$/, /^tools\/studio\/vendor\/GLTF(Exporter|Loader)\.js$/, /^three\.min\.js$/];
  await page.route('http://xp.local/**', route => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
    if (!ALLOW.some(r => r.test(p)) || p.includes('..') || !fs.existsSync(path.join(REPO, p))) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ contentType: p.endsWith('.html') ? 'text/html' : 'text/javascript', body: fs.readFileSync(path.join(REPO, p)) });
  });
  await page.goto('http://xp.local/tools/studio/xp/page.html');
  await page.waitForFunction(() => window.XP && XP.ready, null, { timeout: 30000 });
  await page.evaluate(() => XP.ready);
  const list = await page.evaluate(() => XP.list());
  if (only) for (const n of only) if (!list.some(p => p.name === n)) fail(`no part ${n} (the parts: ${list.map(p => p.name).join(', ')})`);
  for (const p of list) {
    if (only && !only.includes(p.name)) continue;
    const t0 = Date.now();
    let r;
    try { r = await page.evaluate(n => XP.make(n), p.name); } catch (e) { fail(`${p.name}: ${String(e.message).split('\n')[0]}`); continue; }
    const glb = Buffer.from(r.glb, 'base64'), pic = Buffer.from(r.pic, 'base64'), I = r.info;
    built.set(p.name, { file: r.file, glb, pic, info: I });
    pics.push([p.name, r.pic]);
    const big = Math.max(0, ...I.tex.flat());
    console.log(`${p.name.padEnd(24)} ${r.file.padEnd(36)} ${String(Math.round(I.tris)).padStart(6)} tris ${String(I.draws).padStart(3)} draws ${(glb.length / 1024).toFixed(0).padStart(5)} KB` +
      `${I.tex.length ? ' tex ' + I.tex.map(t => t.join('x')).join(' ') : ''}${I.clips.length ? ' clips ' + I.clips.map(c => `${c.name} ${c.duration}s`).join(', ') : ''} (${Date.now() - t0} ms)`);
    if (I.tris > LIMIT.tris) fail(`${p.name}: ${Math.round(I.tris)} triangles (at most ${LIMIT.tris})`);
    if (big > LIMIT.tex) fail(`${p.name}: a picture of ${big} px (at most ${LIMIT.tex})`);
    if (pic.length > 200 << 10) fail(`${p.name}: its picture is ${pic.length} bytes (the studio takes at most 200 KB)`);
  }
  if (sheet) {
    const png = await page.evaluate(P => {
      const n = P.length, cols = Math.min(8, n), rows = Math.ceil(n / cols), s = 192, { cv, g } = XP.canvas(cols * s, rows * (s + 18));
      g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
      return Promise.all(P.map(([name, b], i) => new Promise(res => { const im = new Image(); im.onload = () => { const x = (i % cols) * s, y = Math.floor(i / cols) * (s + 18); g.drawImage(im, x, y, s, s); XP.text(g, name, x + 4, y + s + 13, { size: 12, color: '#ddd' }); res(); }; im.src = 'data:image/jpeg;base64,' + b; }))).then(() => cv.toDataURL('image/png').split(',')[1]);
    }, pics);
    fs.mkdirSync(path.dirname(path.resolve(sheet)), { recursive: true });
    fs.writeFileSync(path.resolve(sheet), Buffer.from(png, 'base64'));
    console.log(`wrote the contact sheet ${path.resolve(sheet)}`);
  }
  for (const l of logs) fail('the page said: ' + l.slice(0, 300));
} finally { await browser.close(); }

// ---- the files
const files = new Map();   // path in the scene -> bytes
for (const [, b] of built) { files.set(b.file, b.glb); files.set(`previews/${b.file}.jpg`, b.pic); }
if (!only) {
  for (const s of makeSounds()) files.set(s.path, s.bytes);
  const info = Object.fromEntries([...built].map(([n, b]) => [n, Object.assign({ file: b.file }, b.info)]));
  const L = makeLayout(info, [...files.keys()]);
  for (const e of L.errors) fail('layout: ' + e);
  files.set('layout.json', Buffer.from(layoutText(L.layout)));
  const room = L.layout.objects.reduce((s, o) => s + ((built.get(L.partOf[o.file]) || {}).info || { tris: 0 }).tris, 0);
  const total = [...files.values()].reduce((s, b) => s + b.length, 0);
  console.log(`the room: ${L.layout.objects.length} objects, ${L.layout.cubes.length} cubes, ${L.layout.sounds.length} sounds, ${(L.layout.groups || []).length} groups; ${Math.round(room).toLocaleString('en-GB')} triangles as placed; ${files.size} files, ${(total / 1048576).toFixed(2)} MB`);
  if (room > LIMIT.room) fail(`the room has ${Math.round(room)} triangles as placed (at most ${LIMIT.room})`);
  if (total > LIMIT.folder) fail(`the folder is ${(total / 1048576).toFixed(2)} MB (at most 6 MB)`);
}
const write = (rel, bytes) => { const f = path.join(out, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, bytes); };
// (a build that failed writes nothing, so a good folder is never overwritten by a bad one; --check writes into its own
// temporary folder and compares)
const failed = !!process.exitCode && !check;
if (failed) console.log(`nothing written to ${out.startsWith(REPO + path.sep) ? path.relative(REPO, out) : out}: the build failed`);
else for (const [rel, b] of files) write(rel, b);
if (!only && !check && !failed) {
  // (files of an earlier build that this one no longer makes go)
  const walk = (d, rel) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + '/') : [rel + e.name]) : [];
  for (const rel of walk(out, '')) if (!files.has(rel) && rel !== 'files.json') { fs.rmSync(path.join(out, ...rel.split('/'))); console.log(`removed ${rel} (no longer made)`); }
}

// ---- --check: the folder against this build
const scan = extra => execFileSync(process.execPath, [path.join(REPO, 'tools/studio/scan.mjs'), EXAMPLES, ...extra], { stdio: 'inherit' });
if (check) {
  const here = path.join(EXAMPLES, SCENE);
  let stale = 0;
  for (const [rel, b] of files) {
    const f = path.join(here, ...rel.split('/'));
    if (!fs.existsSync(f)) { console.log(`MISSING ${rel}`); stale++; continue; }
    const have = fs.readFileSync(f);
    // (what Node makes, the layout and the sounds, byte for byte; the browser's models and pictures within 2 % of their size)
    const near = /\.(glb|jpg)$/.test(rel);
    if (near ? Math.abs(have.length - b.length) > b.length * 0.02 : !have.equals(b)) { console.log(`NOT CURRENT ${rel} (${have.length} bytes, a fresh build ${b.length}${near ? '' : ', not the same bytes'})`); stale++; }
  }
  const walk = (d, rel) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + '/') : [rel + e.name]) : [];
  for (const rel of walk(here, '')) if (!files.has(rel) && rel !== 'files.json') { console.log(`NOT MADE ${rel} (a fresh build has no such file)`); stale++; }
  fs.rmSync(out, { recursive: true, force: true });
  try { scan(['--check']); } catch { stale++; }
  if (stale) { console.log(`examples/${SCENE} is not current: run node tools/studio/xp/make.mjs`); process.exitCode = 1; }
  else console.log(`examples/${SCENE} is current`);
} else if (!only && !process.exitCode) scan([]);
if (process.exitCode) console.log('something failed (above)');
