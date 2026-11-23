// The miniatures' build parts (tools/packages/SPEC.md, "Miniatures"), shared by tools/lowpoly/build.mjs (it writes
// lowpoly.js and every package's minis.js), tools/packages/check.mjs (a package's rules) and tools/design/build.mjs (the
// shell's own cards). No three.js is needed to list a file's miniatures (their build runs only when asked); measure()
// loads the app's three.min.js into a sandbox and builds each one to count its triangles.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
export const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(here, '../..');
export const MAX_TRIS = 1200;

// a source's kit: its line "// kit: a" or "// kit: b" (tools/lowpoly/kit-<x>.js)
export const kitOf = text => (/^\/\/ kit: ([a-z0-9-]+)\s*$/m.exec(text) || [])[1] || '';
const kitText = k => fs.readFileSync(path.join(here, `kit-${k}.js`), 'utf8');
// a source pasted after its kit inside one function: the text a page loads (a classic script that adds to the global
// LOWPOLY_MODELS); tail: code run after the source inside the same function (the cards and the icon)
export function assemble(head, src, tail) {
  const kit = kitOf(src);
  if (!kit || !fs.existsSync(path.join(here, `kit-${kit}.js`))) throw new Error('no "// kit: <a|b>" line naming a kit of tools/lowpoly/');
  return head + 'var LOWPOLY_MODELS = LOWPOLY_MODELS || {};\n(function () {\n' + kitText(kit).replace(/^(\/\/.*\n)+/, '').trimEnd() + '\n\n' +
    src.replace(/^(\/\/.*\n)+/, '').trimEnd() + '\n' + (tail || '') + '})();\n';
}
// the miniatures a built text registers, without three.js: key -> entry
export function list(text, file) {
  const ctx = {};
  vm.runInNewContext(text + '\nthis.LOWPOLY_MODELS = LOWPOLY_MODELS;', ctx, { filename: file || 'minis.js', timeout: 5000 });
  return ctx.LOWPOLY_MODELS || {};
}
// each miniature built with three.js r128 (the app's three.min.js): key -> its triangles (an error's message for one
// that throws)
export function measure(text, file) {
  const ctx = { self: {}, console: { log() {}, warn() {}, error() {} } };
  ctx.window = ctx.self;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'three.min.js'), 'utf8'), ctx, { filename: 'three.min.js' });
  vm.runInContext(text + '\nthis.LOWPOLY_MODELS = LOWPOLY_MODELS;', ctx, { filename: file || 'minis.js', timeout: 20000 });
  const THREE = ctx.THREE || ctx.self.THREE, M = ctx.LOWPOLY_MODELS || {}, out = {};
  for (const k of Object.keys(M)) {
    try {
      let n = 0;
      M[k].build(THREE).traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
      out[k] = n;
    } catch (e) { out[k] = String(e && e.message || e); }
  }
  return out;
}
// what is wrong with a file's entries (prefix: the key they must start with, '<key>.'; empty for the shell's)
export function problems(M, prefix) {
  const out = [], keys = Object.keys(M);
  if (!keys.length) out.push('it registers no miniature');
  for (const k of keys) {
    const m = M[k];
    if (prefix && !k.startsWith(prefix)) out.push(`${k}: a package's miniature is named ${prefix}<set>`);
    if (!(m.story && m.set && k === m.story + '.' + m.set)) out.push(`${k}: story and set do not make its key`);
    if (!m.name || !m.shows) out.push(`${k}: no name or shows`);
    if (!(Number.isInteger(m.tris) && m.tris > 0 && m.tris <= MAX_TRIS)) out.push(`${k}: tris ${m.tris} (a whole number, at most ${MAX_TRIS})`);
    if (typeof m.build !== 'function') out.push(`${k}: no build(THREE)`);
  }
  return out;
}

// ---------------------------------------------------------------- the cards --
// What the design room's card of a miniature shows (tools/design/SPEC.md), from the catalogue (props.json: the shell's
// tools/design/props.json, a package's src/props.json): its set's entry, or a hand-written story's; a miniature with
// neither gets a short card of its own name and shows.
const one = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
// at most n characters, cut at a word
const cut = (s, n) => { s = one(s); if (s.length <= n) return s; const t = s.slice(0, n - 1); return t.slice(0, Math.max(t.lastIndexOf(' '), Math.round(n * 0.6))).replace(/[,;:(]+$/, '') + '…'; };
// a param's meaning up to its first aside (a semicolon, a bracket or a full stop), when that leaves enough
const first = s => { s = one(s); const m = /^(.{14,}?)(?:; | \(|\. |: )/.exec(s); return m ? m[1] : s; };
// cat: { sets: [...], handwritten: [...] } of every catalogue (a hand-written story's reusedBy looks through all of them)
export function card(key, m, cat) {
  const s = cat.sets.find(x => x.story === m.story && x.key === m.set), hw = cat.handwritten.find(x => x.story === m.story);
  if (s) {
    const twins = cat.sets.filter(x => x !== s && x.file === s.file).map(x => x.story + '/' + x.key);
    return {
      story: m.story, set: m.set, name: m.name, tris: m.tris, id: s.id, shows: cut(s.shows, 460), size: cut(s.size, 100), frame: cut(s.frame, 170),
      params: s.params.map(p => [p.name, cut(p.range, 40), cut(first(p.meaning), 110), p.eased === false ? 1 : 0]),
      views: s.views.map(v => [v.name, cut(first(v.frames), 80)]),
      reusedBy: s.reusedBy.map(one), reuses: s.reuses.map(one), file: s.file, manifest: s.manifest || '',
      note: s.cardNote || (twins.length ? `One of ${twins.length + 1} sets in one file, with ${twins.join(', ')}.` : ''),
    };
  }
  if (hw) {
    return {
      story: m.story, set: m.set, name: m.name, tris: m.tris, id: m.story, shows: cut(hw.scenes, 460), size: '', frame: '', params: [], views: [],
      reusedBy: cat.sets.filter(x => x.reuses.some(r => r.startsWith(hw.file))).map(x => x.id), reuses: [], file: hw.file, manifest: '',
      note: 'A hand-written story: its scene is code in the story itself, not a set, so it has no params or named views to list.',
    };
  }
  return { story: m.story, set: m.set, name: m.name, tris: m.tris, id: m.story + '/' + m.set, shows: cut(m.shows, 460), size: '', frame: '', params: [], views: [],
    reusedBy: [], reuses: [], file: '', manifest: '', note: 'Not in a catalogue: its package has no entry for this set in src/props.json.' };
}
// every catalogue: the shell's and each package's src/props.json
export function catalogue(root) {
  const cat = { sets: [], handwritten: [] }, add = (o, f) => {
    if (!o) return;
    if (Array.isArray(o.sets)) cat.sets.push(...o.sets);
    if (Array.isArray(o.handwrittenStories)) cat.handwritten.push(...o.handwrittenStories);
    if (o.handwritten) cat.handwritten.push(o.handwritten);
  };
  const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { if (fs.existsSync(f)) throw new Error(`${path.relative(root, f)} is not JSON: ${e.message}`); return null; } };
  add(read(path.join(root, 'tools/design/props.json')));
  for (const k of packageKeys(root)) add(read(path.join(root, 'packages', k, 'src/props.json')));
  return cat;
}
export const packageKeys = root => {
  const d = path.join(root, 'packages');
  return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name).sort() : [];
};
