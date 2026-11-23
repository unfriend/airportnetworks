// Story packages' index (tools/packages/SPEC.md, "Discovery"; docs/agents/packages.md): writes packages/index.json from
// the folders in packages/, what the shell reads at start (index.html: HOST.packages) to list and load them.
// usage (from the repository root): node tools/packages/scan.mjs          -> writes packages/index.json when it changed
//                                   node tools/packages/scan.mjs --check  -> writes nothing; exits 1 when it is not
//                                                                            current or a folder is left out
//                                   --root <dir>: another copy of the app (a test's)
// A folder is left out, with a line saying why, when its story.json is missing or wrong, its key is taken (a key of
// stories/list.js) or reserved (a word the address uses: the list in SPEC.md), or it has no main.js. Each package's files
// are fingerprinted as tools/release.mjs does a story's (index.html's HOST.fingerprint of the text; a binary file's bytes
// as one character each), its fp is the fingerprint of that list; src/, README.md and dot-files are left out of it.
// packages/order.json (hand-written, docs/packages-migration.md): { "order": [<key>, ...] }, every one of the app's
// stories in the Stories screen's order, moved into a package or still in stories/list.js. The index carries it
// (order) and lists the packages it names first, in its order, then the others by key; the shell sorts HOST.list by it.
// A key there that is neither a package here nor a story of stories/list.js fails the scan. Each entry also gets bytes
// (the sum of its files' sizes: what taking it for offline use costs).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2), check = args.includes('--check');
const ri = args.indexOf('--root');
const root = ri >= 0 ? path.resolve(args[ri + 1]) : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = path.join(root, 'packages'), out = path.join(dir, 'index.json'), API = 1;
function fingerprint(s) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
}
// (text as the browser reads it, so main.js's fingerprint is the one HOST.load computes; the rest byte for byte)
const TEXT = /\.(js|mjs|json|md|txt|css|html|svg|csv|tsv|xml|gltf|obj|mtl|glsl|vert|frag|ya?ml)$/i;
const fileFp = f => { const b = fs.readFileSync(f); return fingerprint(TEXT.test(f) ? b.toString('utf8').replace(/^﻿/, '') : b.toString('latin1')); };

// the keys taken: the app's own stories and pages (stories/list.js); the words the address uses (SPEC.md's list)
const ctx = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'stories/list.js'), 'utf8'), ctx, { filename: 'stories/list.js' });
const taken = new Set([...(ctx.self.STORY_LIST || []), ...(ctx.self.STORY_EXTRA || [])].map(m => m && m.key));
const spec = fs.readFileSync(path.join(root, 'tools/packages/SPEC.md'), 'utf8');
const words = (/never a word the address already uses \(([^)]*)\)/.exec(spec) || [])[1];
if (!words) { console.log('tools/packages/SPEC.md has no list of the words the address uses'); process.exit(1); }
const reserved = new Set([...words.matchAll(/`([a-z0-9-]+)`/g)].map(m => m[1]));

const KEY = /^[a-z][a-z0-9-]{1,30}$/, COL = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const str = v => typeof v === 'string', opt = f => v => v === undefined || f(v);
const full = v => str(v) && v.trim().length > 0 && v.length <= 600;
// story.json's fields (SPEC.md, "story.json"): what each must be; any other is wrong
// minis: the file of its own miniatures (built from src/minis.js by tools/lowpoly/build.mjs; SPEC.md "Miniatures");
// icon: its stations' miniature in a shared room (<key>.<set>): one of its own, or another package's or the shell's
// (lowpoly.js); intro: an introduction, not one of the stories (the tutorial: skipped by the default start, Repeat all
// and the count)
const MINIFILE = /^[a-z0-9][a-z0-9_-]*\.js$/, MINI = /^[a-z][a-z0-9-]*\.[a-z0-9-]+$/;
const readText = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };
// the file a miniature's name points to (its package's minis file, or lowpoly.js for the shell's): whether it registers it
function miniThere(v) {
  const k = v.split('.')[0];
  let sj2 = null;
  try { sj2 = JSON.parse(readText(path.join(dir, k, 'story.json')).replace(/^\uFEFF/, '')); } catch (e) { /* not a package */ }
  const f = sj2 && MINIFILE.test(sj2.minis || '') ? path.join(dir, k, sj2.minis) : path.join(root, 'lowpoly.js');
  return readText(f).includes(`LOWPOLY_MODELS[${JSON.stringify(v)}]`) || new RegExp(`(?:add|def)\\('${v.replace('.', '\\.')}'`).test(readText(f));
}
const mini = v => str(v) && MINI.test(v);
const FIELDS = {
  key: str, api: v => Number.isInteger(v) && v >= 1, version: opt(str), title: full, kick: full, col: v => str(v) && COL.test(v), desc: full,
  len: opt(str), page: opt(full), brand: opt(full), sub: opt(str), aria: opt(full), thing: opt(full), loading: opt(full),
  authors: opt(str), life: opt(v => typeof v === 'boolean'), list: opt(v => ['stories', 'experiments', 'hidden'].includes(v)), needs: opt(v => Number.isInteger(v) && v >= 1),
  minis: opt(v => str(v) && MINIFILE.test(v)), icon: opt(mini), intro: opt(v => v === true),
};
const NEED = ['key', 'api', 'title', 'kick', 'col', 'desc'];

// every file a package serves, path inside the folder (with /) -> fingerprint; src/ and README.md at its top and any
// dot-file or dot-folder left out, as are links; at most 4 folders deep (the relay serves no deeper)
function files(base) {
  const all = {}, deep = [];
  (function walk(rel) {
    for (const e of fs.readdirSync(path.join(base, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.name.startsWith('.') || r === 'src' || r === 'README.md' || e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) { if (r.split('/').length > 5) deep.push(r); else all[r] = fileFp(path.join(base, r)); }
    }
  })('');
  return { all, deep };
}

const left = [], entries = [];
const dirs = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name).sort() : [];
for (const name of dirs) {
  const base = path.join(dir, name), why = w => left.push(`left out packages/${name}/: ${w}`);
  if (!KEY.test(name)) { why('a key is a lower-case letter, then 1 to 30 lower-case letters, digits or -'); continue; }
  if (taken.has(name)) { why(`${name} is a key of stories/list.js`); continue; }
  if (reserved.has(name)) { why(`${name} is a word the address uses`); continue; }
  let sj;
  try { sj = JSON.parse(fs.readFileSync(path.join(base, 'story.json'), 'utf8').replace(/^﻿/, '')); } catch (e) { why(fs.existsSync(path.join(base, 'story.json')) ? 'its story.json is not JSON' : 'it has no story.json'); continue; }
  if (!sj || typeof sj !== 'object' || Array.isArray(sj)) { why('its story.json is not an object'); continue; }
  const miss = NEED.filter(k => sj[k] === undefined), bad = Object.keys(sj).filter(k => !FIELDS[k] || !FIELDS[k](sj[k]));
  if (miss.length) { why(`story.json lacks ${miss.join(', ')}`); continue; }
  if (bad.length) { why(`story.json: ${bad.map(k => (k === 'icon' ? 'icon is not a miniature\'s name (<key>.<set>; icon.png is its card\'s picture)' : FIELDS[k] ? `${k} is wrong` : `${k} is not a field`)).join('; ')}`); continue; }
  if (sj.minis !== undefined && !fs.existsSync(path.join(base, sj.minis))) { why(`story.json names minis ${sj.minis}, which is not there (node tools/lowpoly/build.mjs builds it from src/minis.js)`); continue; }
  if (sj.icon !== undefined && !miniThere(sj.icon)) { why(`story.json: icon ${sj.icon} is no miniature of ${sj.icon.split('.')[0] === name ? `its ${sj.minis || 'minis file (story.json names none)'}` : `${sj.icon.split('.')[0]}'s minis file or lowpoly.js`}`); continue; }
  if (sj.key !== name) { why(`story.json's key is ${JSON.stringify(sj.key)}, not the folder's name`); continue; }
  if (!fs.existsSync(path.join(base, 'main.js'))) { why('it has no main.js'); continue; }
  const f = files(base);
  for (const r of f.deep) console.log(`packages/${name}/${r} is not listed: at most 4 folders deep`);
  const fp = fingerprint(Object.entries(f.all).map(([p, v]) => p + ' ' + v).join('\n'));
  const bytes = Object.keys(f.all).reduce((n, r) => n + fs.statSync(path.join(base, r)).size, 0);
  entries.push({ ...sj, fp, bytes, files: f.all });
}
// the order (packages/order.json): its packages first, in its order, then the others by key
let order = [];
if (fs.existsSync(path.join(dir, 'order.json'))) {
  let oj = null;
  try { oj = JSON.parse(fs.readFileSync(path.join(dir, 'order.json'), 'utf8').replace(/^\uFEFF/, '')); } catch (e) { /* below */ }
  if (!oj || !Array.isArray(oj.order) || !oj.order.every(k => typeof k === 'string' && KEY.test(k)) || new Set(oj.order).size !== oj.order.length) left.push('packages/order.json is not { "order": [<key>, ...] } with each key once');
  else {
    order = oj.order;
    const listed = new Set((ctx.self.STORY_LIST || []).map(m => m && m.key));
    for (const k of order) if (!listed.has(k) && !entries.some(e => e.key === k)) left.push(`packages/order.json names ${k}, which is neither a package here nor a story of stories/list.js`);
    for (const k of listed) if (!order.includes(k)) left.push(`packages/order.json leaves out ${k}, a story of stories/list.js: name every story there`);
  }
}
const rank = e => (order.includes(e.key) ? order.indexOf(e.key) : order.length);
entries.sort((a, b) => rank(a) - rank(b) || (a.key < b.key ? -1 : 1));
for (const l of left) console.log(l);
const text = JSON.stringify(order.length ? { api: API, order, packages: entries } : { api: API, packages: entries }, null, 2) + '\n';
const had = (() => { try { return fs.readFileSync(out, 'utf8'); } catch (e) { return null; } })();
const list = entries.map(e => e.key + (e.list === 'hidden' || e.list === 'experiments' ? ` (${e.list})` : '')).join(', ') || 'none';
if (check) {
  console.log(had === text ? `packages/index.json is current (${entries.length} packages: ${list})` : 'packages/index.json is out of date: run node tools/packages/scan.mjs');
  process.exit(had === text && !left.length ? 0 : 1);
}
if (had !== text) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(out, text); }
console.log(`packages/index.json ${had === text ? 'is current' : 'written'} (${entries.length} packages: ${list})`);
process.exit(left.length ? 1 : 0);
