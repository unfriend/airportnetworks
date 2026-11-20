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
const FIELDS = {
  key: str, api: v => Number.isInteger(v) && v >= 1, version: opt(str), title: full, kick: full, col: v => str(v) && COL.test(v), desc: full,
  len: opt(str), page: opt(full), brand: opt(full), sub: opt(str), aria: opt(full), thing: opt(full), loading: opt(full),
  authors: opt(str), life: opt(v => typeof v === 'boolean'), list: opt(v => v === 'stories' || v === 'hidden'), needs: opt(v => Number.isInteger(v) && v >= 1),
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
  if (bad.length) { why(`story.json: ${bad.map(k => (FIELDS[k] ? `${k} is wrong` : k === 'icon' ? 'no icon field (icon.png is its picture)' : `${k} is not a field`)).join('; ')}`); continue; }
  if (sj.key !== name) { why(`story.json's key is ${JSON.stringify(sj.key)}, not the folder's name`); continue; }
  if (!fs.existsSync(path.join(base, 'main.js'))) { why('it has no main.js'); continue; }
  const f = files(base);
  for (const r of f.deep) console.log(`packages/${name}/${r} is not listed: at most 4 folders deep`);
  const fp = fingerprint(Object.entries(f.all).map(([p, v]) => p + ' ' + v).join('\n'));
  entries.push({ ...sj, fp, files: f.all });
}
for (const l of left) console.log(l);
const text = JSON.stringify({ api: API, packages: entries }, null, 2) + '\n';
const had = (() => { try { return fs.readFileSync(out, 'utf8'); } catch (e) { return null; } })();
const list = entries.map(e => e.key + (e.list === 'hidden' ? ' (hidden)' : '')).join(', ') || 'none';
if (check) {
  console.log(had === text ? `packages/index.json is current (${entries.length} packages: ${list})` : 'packages/index.json is out of date: run node tools/packages/scan.mjs');
  process.exit(had === text && !left.length ? 0 : 1);
}
if (had !== text) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(out, text); }
console.log(`packages/index.json ${had === text ? 'is current' : 'written'} (${entries.length} packages: ${list})`);
process.exit(left.length ? 1 : 0);
