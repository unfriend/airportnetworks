// node tools/studio/tracker-guide/make.mjs [--check] [--sheet <file.png>]
// Makes the tracker guide, an example scene of the studio's (examples/tracker-guide/; tools/studio/tracker-guide/README.md):
// stands you walk round, each with the tutorial's robot worn a way trackers can be worn, moving as the app's own solver
// (ik.js) poses it from a performer's trackers, and its sign; at the end two robots to wear yourself. Its models are built
// in headless Chromium by the generator's page (page.html: three.js r128, its own GLTFExporter and GLTFLoader, the Bliss XP
// room's kit, the studio tour's sign maker, ik.js and bodies.js, all loaded, and parts.js), written as binary glTF with
// their clips, read back, checked and (but for the signs) pictured for the Add pane; the spoken lines, when rendered
// (voice.mjs: voice/NN.mp3), copied in as sounds/voice-NN.mp3; its layout.json (layout.mjs); then examples/index.json and
// examples/tracker-guide/files.json by tools/studio/scan.mjs. Deterministic: run it again and nothing changes. When a check
// or a budget fails nothing is written.
//   --check   builds into a temporary folder and says whether examples/tracker-guide is current (layout.json and the sounds
//             byte for byte; the models and pictures, made in the browser, within 2 % of their size), then scan.mjs
//             --check; exits 1 when not
//   --sheet   also writes a contact sheet of the models' pictures
// Budgets (it stops when one is passed): every model under 10,000 triangles and the scene under 60,000 as placed, its
// pictures at most 1,024 px, the folder under 3 MB (4.5 MB with the spoken lines, v210: 1.3 MB of voice).
// Needs Playwright with a Chromium build (as tools/smoke.mjs; PLAYWRIGHT_MODULE and CHROMIUM_PATH as there).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { layoutText } from '../../../relay/scenes.mjs';
import { makeLayout, signs } from './layout.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..');
const SCENE = 'tracker-guide', EXAMPLES = path.join(REPO, 'examples');
const LIMIT = { tris: 10000, room: 60000, tex: 1024 };
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const check = args.includes('--check'), sheet = opt('--sheet');
const out = check ? fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-guide-')) : path.join(EXAMPLES, SCENE);
const fail = m => { console.log('FAIL ' + m); process.exitCode = 1; };

// ---- the spoken lines, where rendered
const files = new Map();   // (path in the scene -> bytes)
const VOICE = path.join(HERE, 'voice');
for (const f of fs.existsSync(VOICE) ? fs.readdirSync(VOICE).sort() : []) if (/^\d\d\.mp3$/.test(f)) files.set(`sounds/voice-${f}`, fs.readFileSync(path.join(VOICE, f)));
const SIGNS = signs(files.size > 0);

// ---- the page: served from the repository (only the generators, the kit, three.js, ik.js and bodies.js)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const built = new Map();
let about = null;
try {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('page error: ' + e.message));
  const ALLOW = [/^tools\/studio\/(tracker-guide|tour|xp)\/[\w./-]+\.(html|js)$/, /^tools\/studio\/vendor\/GLTF(Exporter|Loader)\.js$/, /^(three\.min|ik|bodies)\.js$/];
  await page.route('http://guide.local/**', route => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
    if (!ALLOW.some(r => r.test(p)) || p.includes('..') || !fs.existsSync(path.join(REPO, p))) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ contentType: p.endsWith('.html') ? 'text/html' : 'text/javascript', body: fs.readFileSync(path.join(REPO, p)) });
  });
  await page.goto('http://guide.local/tools/studio/tracker-guide/page.html');
  await page.waitForFunction(() => window.XP && window.TOUR && window.GUIDE && XP.ready, null, { timeout: 30000 });
  await page.evaluate(() => XP.ready);
  // (the signs' colours: the stands teal, trying amber, the welcome grey)
  await page.evaluate(S => { Object.assign(TOUR.SECTION, { guide: '#178f86', try: '#c0631c' }); return TOUR.signs(S); }, SIGNS);
  const list = SIGNS.map(s => ({ name: s.part, sign: true })).concat(await page.evaluate(() => GUIDE.parts.map(name => ({ name, sign: false }))));
  for (const p of list) {
    let r;
    try { r = await page.evaluate(n => XP.make(n), p.name); } catch (e) { fail(`${p.name}: ${String(e.message).split('\n')[0]}`); continue; }
    const glb = Buffer.from(r.glb, 'base64'), I = r.info;
    built.set(p.name, { file: r.file, info: I, pic: p.sign ? null : r.pic });
    files.set(r.file, glb);
    if (!p.sign) files.set(`previews/${r.file}.jpg`, Buffer.from(r.pic, 'base64'));
    const big = Math.max(0, ...I.tex.flat());
    console.log(`${p.name.padEnd(12)} ${r.file.padEnd(36)} ${String(Math.round(I.tris)).padStart(5)} tris ${String(I.draws).padStart(2)} draws ${(glb.length / 1024).toFixed(0).padStart(4)} KB` +
      `${I.tex.length ? ' tex ' + I.tex.map(t => t.join('x')).join(' ') : ''}${I.clips.length ? ' clips ' + I.clips.map(c => `${c.name} ${c.duration}s`).join(', ') : ''}`);
    if (I.tris > LIMIT.tris) fail(`${p.name}: ${Math.round(I.tris)} triangles (at most ${LIMIT.tris})`);
    if (big > LIMIT.tex) fail(`${p.name}: a picture of ${big} px (at most ${LIMIT.tex})`);
  }
  about = await page.evaluate(() => GUIDE.info());
  console.log(`lined up: the matching's order at the T-pose stand ${about.order.join(', ')} (the character slid to ${about.slid}; a robot fit would move at most ${(about.moved * 100).toFixed(1)} cm, left to the offsets); scales ${Object.entries(about.cal).map(([k, c]) => `${k} ${c.s}`).join(', ')}`);
  if (sheet) {
    const pics = [...built].filter(([, b]) => b.pic).map(([n, b]) => [n, b.pic]);
    const png = await page.evaluate(P => {
      const n = P.length, cols = Math.min(4, n), rows = Math.ceil(n / cols), s = 192, { cv, g } = XP.canvas(cols * s, rows * (s + 18));
      g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
      return Promise.all(P.map(([name, b], i) => new Promise(res => { const im = new Image(); im.onload = () => { const x = (i % cols) * s, y = Math.floor(i / cols) * (s + 18); g.drawImage(im, x, y, s, s); XP.text(g, name, x + 4, y + s + 13, { size: 12, color: '#ddd' }); res(); }; im.src = 'data:image/jpeg;base64,' + b; }))).then(() => cv.toDataURL('image/png').split(',')[1]);
    }, pics);
    fs.mkdirSync(path.dirname(path.resolve(sheet)), { recursive: true });
    fs.writeFileSync(path.resolve(sheet), Buffer.from(png, 'base64'));
    console.log(`wrote the contact sheet ${path.resolve(sheet)}`);
  }
  for (const l of logs) fail('the page said: ' + l.slice(0, 300));
} finally { await browser.close(); }

// ---- the layout
const info = Object.fromEntries([...built].map(([n, b]) => [n, Object.assign({ file: b.file }, b.info)]));
const L = makeLayout(info, [...files.keys()], about || { cal: {} });
for (const e of L.errors) fail('layout: ' + e);
files.set('layout.json', Buffer.from(layoutText(L.layout)));
const of = o => (built.get(L.partOf[o.file]) || {}).info || { tris: 0, draws: 0 };
const room = L.layout.objects.reduce((s, o) => s + of(o).tris, 0), draws = L.layout.objects.reduce((s, o) => s + of(o).draws, 0);
const total = [...files.values()].reduce((s, b) => s + b.length, 0), kinds = k => [...files].filter(([p]) => k.test(p)).reduce((s, [, b]) => s + b.length, 0);
const n = k => (L.layout[k] || []).length;
console.log(`the scene: ${n('objects')} objects (${Math.round(room).toLocaleString('en-GB')} triangles and ${draws} draws as placed), ${n('shapes')} shapes, ${n('cubes')} cubes, ${n('sounds')} sounds, ${n('groups')} group`);
console.log(`${files.size} files, ${(total / 1048576).toFixed(2)} MB: models ${(kinds(/^models\//) / 1024).toFixed(0)} KB, signs ${(kinds(/^signs\//) / 1024).toFixed(0)} KB, sounds ${(kinds(/^sounds\//) / 1024).toFixed(0)} KB, pictures ${(kinds(/^previews\//) / 1024).toFixed(0)} KB`);
if (room > LIMIT.room) fail(`the scene has ${Math.round(room)} triangles as placed (at most ${LIMIT.room})`);
const cap = [...files.keys()].some(f => /^sounds\/voice-/.test(f)) ? 4.5 : 3;   // (the voice is 1.3 MB)
if (total > cap * 1048576) fail(`the folder is ${(total / 1048576).toFixed(2)} MB (at most ${cap} MB)`);

// ---- writing (a build that failed writes nothing; --check writes into its own temporary folder and compares)
const walk = (d, rel) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + '/') : [rel + e.name]) : [];
const write = (rel, bytes) => { const f = path.join(out, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, bytes); };
const failed = !!process.exitCode;
if (failed) console.log(`nothing written: the build failed`);
else for (const [rel, b] of files) write(rel, b);
const scan = extra => execFileSync(process.execPath, [path.join(REPO, 'tools/studio/scan.mjs'), EXAMPLES, ...extra], { stdio: 'inherit' });
if (check) {
  const here = path.join(EXAMPLES, SCENE);
  let stale = 0;
  for (const [rel, b] of files) {
    const f = path.join(here, ...rel.split('/'));
    if (!fs.existsSync(f)) { console.log(`MISSING ${rel}`); stale++; continue; }
    const have = fs.readFileSync(f), near = /\.(glb|jpg)$/.test(rel);
    if (near ? Math.abs(have.length - b.length) > b.length * 0.02 : !have.equals(b)) { console.log(`NOT CURRENT ${rel} (${have.length} bytes, a fresh build ${b.length}${near ? '' : ', not the same bytes'})`); stale++; }
  }
  for (const rel of walk(here, '')) if (!files.has(rel) && rel !== 'files.json') { console.log(`NOT MADE ${rel} (a fresh build has no such file)`); stale++; }
  fs.rmSync(out, { recursive: true, force: true });
  try { scan(['--check']); } catch { stale++; }
  if (stale || failed) { console.log(`examples/${SCENE} is not current: run node tools/studio/tracker-guide/make.mjs`); process.exitCode = 1; }
  else console.log(`examples/${SCENE} is current`);
} else if (!failed) {
  // (files of an earlier build that this one no longer makes go)
  for (const rel of walk(out, '')) if (!files.has(rel) && rel !== 'files.json') { fs.rmSync(path.join(out, ...rel.split('/'))); console.log(`removed ${rel} (no longer made)`); }
  scan([]);
}
if (process.exitCode) console.log('something failed (above)');
