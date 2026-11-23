// Checks a story package against the rules it keeps (tools/packages/SPEC.md, "The rules a package keeps"): story.json
// field by field, main.js registering its own key, and the story rules of AGENTS.md that can be read off the code (sound
// only through HOST.audio, HOST.makeRenderer, never navigating, HOST.go, never reading A or X, no eval but the engine's
// own peek, nothing fetched from another origin), and the sizes. With --load it also serves the app with this package
// (an index of its own, so the folder may be anywhere and packages/index.json need not be current), opens it headless,
// waits for it to load, plays a moment, opens explore mode and fails on any console error.
// usage (from the repository root): node tools/packages/check.mjs packages/<key> [--build] [--load] [--shots <dir>] [--phone]
// One line per finding (FAIL or warn), then a summary; exits 1 on any failure. --load needs Playwright with Chromium,
// as the smoke test does (PLAYWRIGHT_MODULE, or `playwright` from node_modules).
import fs from 'fs';
import http from 'http';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..', '..');
const ARGS = process.argv.slice(2), opt = n => { const i = ARGS.indexOf(n); return i >= 0 ? ARGS[i + 1] : null; };
const dirArg = ARGS.find((a, i) => !a.startsWith('--') && !['--shots'].includes(ARGS[i - 1]));
if (!dirArg) { console.log('usage: node tools/packages/check.mjs packages/<key> [--build] [--load] [--shots <dir>] [--phone]'); process.exit(1); }
const base = path.resolve(dirArg), name = path.basename(base), rel = path.relative(process.cwd(), base), show = !rel ? '.' : rel.startsWith('..') ? base : rel;
const MB = 1 << 20;
let fails = 0, warns = 0;
const fail = (where, m) => { fails++; console.log(`FAIL ${where}: ${m}`); };
const warn = (where, m) => { warns++; console.log(`warn ${where}: ${m}`); };
if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) { console.log(`FAIL ${show}: no such folder`); process.exit(1); }

// ---------------------------------------------------------------- story.json --
// (the same fields and rules as tools/packages/scan.mjs)
const ctx = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'stories/list.js'), 'utf8'), ctx, { filename: 'stories/list.js' });
const taken = new Set([...(ctx.self.STORY_LIST || []), ...(ctx.self.STORY_EXTRA || [])].map(m => m && m.key));
const words = (/never a word the address already uses \(([^)]*)\)/.exec(fs.readFileSync(path.join(here, 'SPEC.md'), 'utf8')) || [])[1] || '';
const reserved = new Set([...words.matchAll(/`([a-z0-9-]+)`/g)].map(m => m[1]));
const KEY = /^[a-z][a-z0-9-]{1,30}$/, COL = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const str = v => typeof v === 'string', may = f => v => v === undefined || f(v), full = v => str(v) && v.trim().length > 0 && v.length <= 600;
const MINIS = (() => { try { return fs.readFileSync(path.join(root, 'lowpoly.js'), 'utf8'); } catch (e) { return ''; } })();
const mini = v => str(v) && /^[a-z][a-z0-9-]*\.[a-z0-9-]+$/.test(v) && MINIS.includes(`'${v}'`);   // (a miniature of lowpoly.js)
const FIELDS = {
  key: str, api: v => Number.isInteger(v) && v >= 1, version: may(str), title: full, kick: full, col: v => str(v) && COL.test(v), desc: full,
  len: may(str), page: may(full), brand: may(full), sub: may(str), aria: may(full), thing: may(full), loading: may(full),
  authors: may(str), life: may(v => typeof v === 'boolean'), list: may(v => v === 'stories' || v === 'hidden'), needs: may(v => Number.isInteger(v) && v >= 1),
  icon: may(mini), intro: may(v => v === true),
};
const NEED = ['key', 'api', 'title', 'kick', 'col', 'desc'];
const sjf = `${show}/story.json`;
let sj = null;
if (!KEY.test(name)) fail(show, 'the folder\'s name is not a key: a lower-case letter, then 1 to 30 lower-case letters, digits or -');
if (taken.has(name)) fail(show, `${name} is a key of stories/list.js`);
if (reserved.has(name)) fail(show, `${name} is a word the address uses`);
try { sj = JSON.parse(fs.readFileSync(path.join(base, 'story.json'), 'utf8').replace(/^﻿/, '')); }
catch (e) { fail(sjf, fs.existsSync(path.join(base, 'story.json')) ? 'not JSON: ' + e.message : 'missing'); }
if (sj !== null && (typeof sj !== 'object' || Array.isArray(sj))) { fail(sjf, 'not an object'); sj = null; }
if (sj) {
  for (const k of NEED) if (sj[k] === undefined) fail(sjf, `lacks ${k}`);
  for (const k of Object.keys(sj)) {
    if (!FIELDS[k]) fail(sjf, `${k} is not a field`);
    else if (k === 'icon' && !FIELDS.icon(sj.icon)) fail(sjf, `icon ${JSON.stringify(sj.icon).slice(0, 60)} names no miniature of lowpoly.js (a <key>.<set>; icon.png is its card's picture)`);
    else if (sj[k] !== undefined && !FIELDS[k](sj[k])) fail(sjf, `${k} is wrong (${JSON.stringify(sj[k]).slice(0, 60)})`);
  }
  if (sj.key !== undefined && sj.key !== name) fail(sjf, `its key is ${JSON.stringify(sj.key)}, not the folder's name`);
  if (Number.isInteger(sj.api) && sj.api > 1) warn(sjf, `api ${sj.api}: this app's Story API is 1, so it would refuse it`);
}

// ------------------------------------------------------------------- files --
// every file (dot-files left out), and the ones the app serves and loads (src/ and README.md at the top left out, as
// the index does)
const all = [];
(function walk(rel) {
  for (const e of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(r); else if (e.isFile()) all.push(r);
  }
})('');
const served = all.filter(r => !r.startsWith('src/') && r !== 'README.md');
let total = 0;
for (const r of all) {
  const n = fs.statSync(path.join(base, r)).size;
  total += n;
  if (n > 16 * MB) fail(`${show}/${r}`, `${(n / MB).toFixed(1)} MB: a file may be 16 MB at most`);
}
if (total > 64 * MB) fail(show, `${(total / MB).toFixed(1)} MB: a package may be 64 MB at most`);
if (!all.includes('README.md')) warn(show, 'no README.md (who made it, what it shows, its data and the permission to show it)');
for (const r of served) if (r.split('/').length > 5) warn(`${show}/${r}`, 'more than 4 folders deep: not listed in the index, not served');
if (all.includes('icon.png')) {
  const b = fs.readFileSync(path.join(base, 'icon.png')), w = b.length > 24 ? b.readUInt32BE(16) : 0, h = b.length > 24 ? b.readUInt32BE(20) : 0;
  if (b.toString('latin1', 1, 4) !== 'PNG') fail(`${show}/icon.png`, 'not a PNG');
  else if (w !== h || w > 512 || b.length > 200 * 1024) warn(`${show}/icon.png`, `${w} x ${h} px, ${Math.round(b.length / 1024)} KB: it should be square, at most 512 px and 200 KB`);
}

// -------------------------------------------------------------------- code --
// The code without its comments (strings, template literals with their ${...} and regular expressions kept; each
// comment's newlines kept, so line numbers stay), and every string's text with the line it starts on.
function strip(src) {
  let out = '', i = 0, prev = '';
  const strs = [], stack = [];   // stack: brace depths of the ${...} we are in
  let depth = 0;
  const line = at => src.slice(0, at).split('\n').length;
  const regexOk = () => /^$|[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(return|typeof|case|in|of|void|delete|new|instanceof|do|else|yield|await)$/.test(out.trimEnd());
  // a template literal's text from i (just after its backtick) to its closing backtick or a ${
  function template() {
    let s = '', at = i;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { s += src.slice(i, i + 2); out += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { out += c; i++; strs.push([s, line(at)]); return 'end'; }
      if (c === '$' && src[i + 1] === '{') { out += '${'; i += 2; strs.push([s, line(at)]); stack.push(depth); depth = 0; return 'code'; }
      s += c; out += c; i++;
    }
    return 'end';
  }
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2), stop = e < 0 ? src.length : e + 2; out += src.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue; }
    if (c === '\'' || c === '"') {
      let s = '', j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') { s += src.slice(j, j + 2); j += 2; } else s += src[j++]; }
      strs.push([s, line(i)]); out += src.slice(i, j + 1); i = j + 1; prev = c; continue;
    }
    if (c === '`') { out += c; i++; template(); prev = '`'; continue; }
    if (c === '{') depth++;
    if (c === '}') {
      if (!depth && stack.length) { out += c; i++; depth = stack.pop(); template(); prev = '`'; continue; }
      depth--;
    }
    if (c === '/' && regexOk()) {
      let j = i + 1, cls = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break;
        j++;
      }
      while (/[a-z]/i.test(src[j + 1] || '')) j++;
      out += src.slice(i, j + 1); i = j + 1; prev = '/'; continue;
    }
    out += c; i++;
    if (!/\s/.test(c)) prev = c;
  }
  return { code: out, strs };
}
// what the code may not do (SPEC.md): [pattern, why]
const RULES = [
  [/\bnew\s+(?:window\.|self\.)?AudioContext\b|\bwebkitAudioContext\b/, 'creates an AudioContext: sound is the shell\'s (HOST.audio)'],
  [/\bnew\s+THREE\.WebGLRenderer\b/, 'new THREE.WebGLRenderer: the renderer is made with HOST.makeRenderer'],
  [/\blocation\.href\s*=(?!=)|\blocation\.(?:assign|replace)\s*\(|\bhistory\.pushState\s*\(/, 'navigates the page: a story never does (HOST.go to change story)'],
  [/\bHOST\.start\s*\(/, 'HOST.start: from inside a story, HOST.go(key)'],
  [/\bbuttons\s*\[\s*4\s*\]/, 'reads buttons[4] (A or X): the spaceship\'s boost'],
  [/\beval\s*\(|\bnew\s+Function\s*\(/, 'eval or new Function outside the engine\'s own peek'],
];
const PEEK = /peek:\s*src\s*=>\s*eval\(src\)/g;
const W3 = /^https?:\/\/www\.w3\.org$/i;   // (XML namespaces, never fetched)
for (const r of served.filter(r => /\.m?js$/i.test(r))) {
  const where = `${show}/${r}`, src = fs.readFileSync(path.join(base, r), 'utf8').replace(/^﻿/, '');
  const { code, strs } = strip(src);
  const lines = code.replace(PEEK, m => ' '.repeat(m.length)).split('\n');
  lines.forEach((l, i) => { for (const [re, why] of RULES) if (re.test(l)) fail(`${where}:${i + 1}`, why); });
  for (const [s, ln] of strs) {
    const m = /\b(?:https?|wss?):\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.exec(s) || /^\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.exec(s);
    if (m && !W3.test(m[0])) fail(`${where}:${ln}`, `an address on another origin (${m[0]}): a package loads only its own files (HOST.pkgUrl)`);
  }
  if (r === 'main.js') {
    const regs = [...code.matchAll(/\bHOST\.register\s*\(\s*(['"])([^'"]*)\1/g)].map(m => m[2]);
    if (!regs.length) fail(where, `does not call HOST.register('${name}', ...)`);
    for (const k of regs) if (k !== name) fail(where, `registers ${JSON.stringify(k)}, not its own key ${name}`);
    if (src.length > 4 * MB) warn(where, `${(src.length / MB).toFixed(1)} MB: over 4 MB loads slowly in a headset`);
  }
}
if (!all.includes('main.js')) fail(show, 'no main.js');
// a package built from src/ (the template's build.mjs): is main.js current? Only with --build: that runs the author's own
// build script, so not before someone has read it (a pull request's code is not run by a check of it); --load runs the
// package in a page, the same caveat
if (ARGS.includes('--build') && fs.existsSync(path.join(base, 'src', 'build.mjs')) && all.includes('main.js')) {
  try { execFileSync(process.execPath, [path.join(base, 'src', 'build.mjs'), '--check', '--root', root], { stdio: 'pipe' }); }
  catch (e) { warn(`${show}/main.js`, `not what src/build.mjs makes: build it again (${String(e.stdout || e.message).trim().split('\n').pop()})`); }
}

// -------------------------------------------------------------------- load --
if (ARGS.includes('--load') && !fails) await load();
console.log(`${show}: ${fails ? `${fails} failure${fails > 1 ? 's' : ''}` : 'ok'}${warns ? `, ${warns} warning${warns > 1 ? 's' : ''}` : ''}`);
process.exit(fails ? 1 : 0);

async function load() {
  // the index of this package alone, fingerprinted as tools/packages/scan.mjs does
  function fingerprint(s) {
    let a = 0xdeadbeef, b = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
    b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
    return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
  }
  const TEXT = /\.(js|mjs|json|md|txt|css|html|svg|csv|tsv|xml|gltf|obj|mtl|glsl|vert|frag|ya?ml)$/i;
  const files = {};
  for (const r of served.filter(r => r.split('/').length <= 5).sort()) { const b = fs.readFileSync(path.join(base, r)); files[r] = fingerprint(TEXT.test(r) ? b.toString('utf8').replace(/^﻿/, '') : b.toString('latin1')); }
  const fp = fingerprint(Object.entries(files).map(([p, v]) => p + ' ' + v).join('\n'));
  const index = JSON.stringify({ api: 1, packages: [{ ...sj, fp, files }] });
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm',
    '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.ktx2': 'image/ktx2' };
  const server = await new Promise(res => {
    const s = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      if (u === '/packages/index.json') { r.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); r.end(index); return; }
      const pre = `/packages/${name}/`, dir = u.startsWith(pre) ? base : root;
      const p = path.join(dir, (u.startsWith(pre) ? u.slice(pre.length) : u).replace(/\/$/, '/index.html'));
      if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(r);
    }).listen(0, '127.0.0.1', () => res(s));
  });
  const url = `http://127.0.0.1:${server.address().port}/`, SHOTS = opt('--shots'), where = `${show} (loaded)`;
  let browser;
  try {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  } catch (e) { fail(where, `could not start Chromium through Playwright: ${e.message.split('\n')[0]}`); server.close(); return; }
  const views = [['desktop', { viewport: { width: 960, height: 600 } }]];
  if (ARGS.includes('--phone')) views.push(['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]);
  const settle = ms => new Promise(r => setTimeout(r, ms));
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  for (const [vn, vo] of views) {
    const c = await browser.newContext({ ...vo, serviceWorkers: 'block' });
    // (as every test page: no automatic welcome or All stories in a room)
    await c.addInitScript(() => { try { localStorage.setItem('collabAutoWelcome', 'off'); localStorage.setItem('collabAutoAll', 'off'); localStorage.setItem('collabAskDefault', 'walk'); localStorage.setItem('tutorialHold', 'off'); } catch (e) { /* blocked */ } });
    const p = await c.newPage(), errs = [];
    p.on('pageerror', e => errs.push((e.stack || e.message).split('\n').slice(0, 2).join(' ')));
    // (a missing file shows as a response: one of the package's own fails it; the shell's own asks a plain server cannot
    // answer, such as a relay's api/ping, do not)
    p.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    p.on('response', r => { const u = r.url().replace(url, ''); if (r.status() >= 400 && u.startsWith(`packages/${name}/`)) errs.push(`${r.status()} for ${u}`); });
    const at = `${where} ${vn}`;
    try {
      await p.goto(`${url}index.html?nosw#${name}&t=0`);
      await p.waitForFunction(k => typeof HOST === 'object' && HOST.curKey === k && HOST.cur && HOST.cur.peek('LOAD.done'), name, { timeout: 180000 });
      const T = await p.evaluate(() => HOST.cur.peek('T_END'));
      // a moment of the story, playing
      await p.evaluate(() => HOST.cur.peek('APP.t = 0.5; APP.playing = true'));
      await settle(3000);
      const t1 = await p.evaluate(() => HOST.cur.peek('APP.t'));
      if (!(t1 > 0.6)) fail(at, `the story does not play (its clock at ${t1} after 3 s)`);
      await p.evaluate(f => HOST.cur.peek(`APP.playing = false; APP.t = ${f}`), T * 0.5);
      await settle(1500);
      if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${name}-${vn}-story.png`) });
      // explore mode, and its shared state given back unchanged (apply(state()) is state())
      await p.evaluate(() => HOST.cur.peek('APP.enterExplore()'));
      await settle(2500);
      if (await p.evaluate(() => HOST.cur.peek('APP.mode')) !== 'explore') fail(at, 'explore mode does not open');
      const same = await p.evaluate(() => { const c = HOST.cur.collab, a = JSON.stringify(c.state()); c.apply(JSON.parse(a)); return a === JSON.stringify(c.state()) ? '' : a; });
      if (same) fail(at, `collab.apply(collab.state()) changes the state (${same.slice(0, 120)})`);
      if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${name}-${vn}-explore.png`) });
      // and back to the story's start
      await p.evaluate(() => HOST.cur.peek('APP.enterStory(0)'));
      await settle(800);
      console.log(`loaded ${name} on a ${vn} page: ${Math.round(T)} s of story, played, explored`);
    } catch (e) { fail(at, e.message.split('\n')[0]); }
    for (const e of [...new Set(errs)]) fail(at, 'console: ' + e);
    await c.close();
  }
  await browser.close();
  server.close();
}
