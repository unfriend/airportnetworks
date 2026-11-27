// Assembles stories/studio.js (the studio: your own scenes, a page that is not a story) from the tour's kit
// (tools/engine/kit.js), three.js r128's own add-ons vendored in vendor/ (pasted with their licence lines, each wrapped so
// nothing of them shows outside the story but THREE.*: fflate's UMD sees no module, exports, define or global self), and
// two of three.js r133's, KTX2Loader.js and WorkerPool.js (the last plain-script KTX2Loader that needs nothing r128 lacks:
// the scene's KTX2 textures transcoded to what the GPU keeps compressed; vendor/README.md),
// meshoptimizer's simplifier (vendor/), the sets and the engine parts in this folder.
// Since v226 the built files carry no comments (the sources keep theirs; a comment that names a licence stays: strip
// below), and what only converting or editing needs is in parts of their own, loaded on demand (PARTS, partLoad in the
// built file): stories/studio-convert.js (the loaders of FBX, OBJ, PLY, STL and TGA, the GLTFExporter, meshoptimizer's
// simplifier) the first time a model of those kinds is read, converted or made lighter; stories/studio-edit.js (the
// page's arrows, TransformControls) while the studio loads, never with &visit. Both are in sw.js's SHELL.
// usage (from the repository root): node tools/studio/build.mjs        -> writes stories/studio.js and its parts
//                                   node tools/studio/build.mjs --check -> exits 1 if any of them is out of date
//                                   node tools/studio/build.mjs --raw <dir> -> also writes them with their comments to
//                                   <dir> (to compare: the same tokens; docs/agents/studio.md)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
const SET_FILES = ['stage', 'looks'];
// (images: the pictures the browser cannot show, and texture names; ktx2: compressed textures, KTX2 written in workers and
// read back; convert: the converter; modules that tools/studio/convert.mjs loads in its headless page too)
const ENGINE = ['e2_scene', 'e3_story', 'e4_files', 'images', 'ktx2', 'convert', 'ik', 'e5_models', 'e6_items', 'e6b_cuts', 'e6c_groups', 'e6d_shapes', 'e6e_motion', 'e6f_path', 'e6g_behave', 'e6h_ghost', 'e6i_tex', 'e6j_voice', 'e6k_trk', 'e6l_puppet', 'e6m_anim', 'e6n_plays', 'e6o_walls', 'e6p_scan', 'e6q_screens', 'e6r_paint', 'e6s_seq', 'e6t_press', 'e6u_send', 'e6v_stream', 'e6w_loops', 'e6x_trails', 'e6y_walks', 'e6z_goggles', 'e7_explore', 'e7b_upload', 'e7c_direct', 'e7d_lite', 'e7e_pics', 'e7f_viewer', 'e7g_examples', 'e7h_colour', 'e7h_seqview', 'e8_xr', 'e9_panels', 'e10_app'];
// (e6e_motion: simple motions, and the pipeline that draws an item's pose; e6f_path: recorded paths, the recorder;
// e6g_behave: behaviours, shared from the headset they react to; e6m_anim: a selected model's timeline while editing; e6n_plays: trigger cubes that start things (a clip, a sound, a recorded path, a motion) as you walk in or out; e6o_walls: things on the room's walls (a behaviour's kind 'wall', on the walls this headset's room scan finds); e6p_scan: the headset's room scan saved as a model of the scene; e6q_screens: screens, video and audio players with a playlist, shared or each person's own (kind v); e6r_paint: paintings, strokes drawn in the air with a ribbon, a tube, a glow pen or a spray can (kind d); e6h_ghost: the ghost where a moving item is placed, the
// page's arrows on it, and Pause; e6i_tex: trigger cubes that change pictures on objects; e6j_voice: recordings past 2
// minutes kept as files of the scene, and a voice recorded with the movement; ik: the trackers' solver, a module as convert is
// (tools/studio/test-ik.mjs runs it in Node); e6k_trk: props that follow one of the PC's Vive trackers; e6l_puppet: a Mixamo
// character worn with trackers, lined up with its performer, and its takes. e7c_direct: a relay that keeps its scenes in R2, signed
// links and uploads straight into the bucket; after the Upload pane, whose uploads it takes over. e7d_lite: an object's
// Fewer triangles and Change texture, and the Upload pane's share and preview per model. e7e_pics: the Add pane's
// pictures of the models, made with every GLB and by Make pictures. e7f_viewer: a model looked at over the whole window,
// from an Upload row's Preview, Fewer triangles' Look closer and an Add card's Look. e7g_examples: the scenes that ship with
// the app, opened read only or copied to the relay; e7h_colour: the shared colour picker, page popover and headset block; e6s_seq: sequences, timelines of events on items, kind q; e7h_seqview: a sequence's lane view on a page; e6x_trails: trails of light behind items and people's hands, v158; e6y_walks: an object's clip played by the distance it covers, As it moves, v164; e6u_send: sends to the output page (MIDI and OSC: a cube's, a press's and a sequence's send entries, the effect 'send', the room's sw and bt, HOST.cur.out))
// the app's add-ons, in the order they need each other (WorkerPool and KTX2Loader are r133's, not r128's: the KTX2Loader
// needs the pool, and nothing else of r133). VENDOR: in stories/studio.js, what showing a scene needs; PARTS: the parts
// loaded on demand, each add-on in the order they need each other (the NURBS curve before the FBX loader that asks for it)
const VENDOR = ['GLTFLoader', 'WorkerPool', 'KTX2Loader', 'SkeletonUtils'];
const PARTS = {
  convert: { say: 'the converter\'s: the loaders of FBX, OBJ, PLY, STL and TGA, the GLTFExporter and meshoptimizer\'s simplifier', vendor: ['NURBSUtils', 'NURBSCurve', 'TGALoader', 'FBXLoader', 'OBJLoader', 'MTLLoader', 'PLYLoader', 'STLLoader', 'GLTFExporter'], meshopt: true },
  edit: { say: 'the page\'s arrows (TransformControls)', vendor: ['TransformControls'] },
};

// ---- the vendored add-ons
const fflate = read('vendor/fflate.min.js').trim();
const iife = f => {
  const src = read(`vendor/${f}.js`).trim();
  if (!/^\( function \(\) \{/.test(src) || !/THREE\.\w+ = \w+;\s*\} \)\(\);$/.test(src)) throw new Error(`vendor/${f}.js is not the IIFE three.js r128 (or r133) ships (it would leak names): check vendor/README.md`);
  return src;
};
const three = VENDOR.map(f => `// ---- ${f}.js\n${iife(f)}\n`).join('\n') + '\n';
// meshoptimizer's simplifier (1.3.0, MIT, its WASM inside the file), unchanged but for its last line, an ES module's export:
// pasted, in the convert part, inside a function the studio calls the first time it makes a model lighter (Fewer
// triangles: meshoptLoad), so its WASM is made only then and nothing of it shows outside that function but what it returns
const meshoptSrc = () => {
  const src = read('vendor/meshopt_simplifier.js').trimEnd(), tail = '\nexport { MeshoptSimplifier };';
  if (!src.endsWith(tail) || !/^\/\/ This file is part of meshoptimizer library and is distributed under the terms of MIT License\.\n/.test(src) || !/\nvar MeshoptSimplifier = \(function \(\) \{/.test(src)) throw new Error('vendor/meshopt_simplifier.js is not the file meshoptimizer 1.3.0 ships (one var and its export at the end): check vendor/README.md');
  return src.slice(0, -tail.length);
};
const meshopt = () => `// ---- meshopt_simplifier.js: defined only when the studio first makes a model lighter (Fewer triangles, the Upload
// pane's share), its WebAssembly made then too (await meshoptLoad().ready)
function meshoptLoad() {
if (meshoptLoad.s) return meshoptLoad.s;
${meshoptSrc()}
return (meshoptLoad.s = MeshoptSimplifier);
}
`;
const vendor = [
  '// three.js r128\'s own add-ons (three@0.128.0, examples/js; MIT, as three.min.js: three.LICENSE.txt), and r133\'s',
  '// KTX2Loader and WorkerPool (three@0.133.0, examples/js: the KTX2 textures; MIT likewise), unchanged, and',
  '// fflate 0.6.9 (MIT, Arjun Barrett, https://github.com/101arrowz/fflate), which the FBX loader needs to unpack',
  '// compressed binary arrays. Each add-on is its own function that sets THREE.<name> only; fflate is kept in this',
  '// story\'s closure (its UMD wrapper finds no module, exports, define or global self).',
  'const fflate = (function () {',
  '  const module = undefined, exports = undefined, define = undefined, self = {};   // (only self.fflate is set)',
  fflate,
  '  return self.fflate;',
  '})();',
  three,
].join('\n');

// ---- the comments taken out of the built files (v226: about a fifth of the studio's bytes). A small scanner that knows
// strings, template literals (and the code inside their ${}), regular expressions and comments; a comment that names a
// licence, or a /*! block, stays. A line that held only a comment goes, line and all; a comment after code goes with the
// spaces before it; a block comment inside a line becomes a space (a newline if it held one, for the semicolons the
// browser inserts); blank lines go too. Checked once against acorn's tokens (the same tokens before and after: --raw).
const KEEP = /licen[cs]e|copyright|\bMIT\b/i;
const KW = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
function strip(src) {
  let i = 0, prev = '';   // prev: the last token's kind ('id', 'kw', 'num', 'str', or the punctuator itself)
  const n = src.length, tpl = [], o = [];   // tpl: for each template literal whose ${} we are in, the braces open inside it
  const put = t => { o.push(t); };          // (o: the output in pieces, so taking spaces off its end never copies all of it)
  const lineHead = () => {   // nothing but spaces before it on its line
    for (let k = o.length - 1; k >= 0; k--) { const m = /\n?([^\n]*)$/.exec(o[k]); if (!/^[ \t]*$/.test(m[1])) return false; if (m[0].startsWith('\n')) return true; }
    return true;
  };
  const trimTail = () => { while (o.length) { const t = o[o.length - 1].replace(/[ \t]+$/, ''); if (t) { o[o.length - 1] = t; return; } o.pop(); } };
  const template = () => {   // from just after a backtick, or a ${}'s closing brace, to the closing backtick or the next ${
    while (i < n) {
      const c = src[i];
      if (c === '\\') { put(src.slice(i, i + 2)); i += 2; continue; }
      if (c === '`') { put(c); i++; prev = 'str'; return; }
      if (c === '$' && src[i + 1] === '{') { put('${'); i += 2; tpl.push(0); prev = '{'; return; }
      put(c); i++;
    }
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') {
      let e = src.indexOf('\n', i); if (e < 0) e = n;
      const text = src.slice(i, e);
      if (KEEP.test(text)) { put(text); i = e; continue; }
      if (lineHead()) { trimTail(); i = e < n ? e + 1 : e; } else { trimTail(); i = e; }
      continue;
    }
    if (c === '/' && d === '*') {
      let e = src.indexOf('*/', i + 2); if (e < 0) throw new Error('an unclosed block comment');
      e += 2;
      const text = src.slice(i, e);
      if (src[i + 2] === '!' || KEEP.test(text)) { put(text); i = e; continue; }
      const after = /^[ \t]*(\n|$)/.exec(src.slice(e, e + 200));
      if (lineHead() && after) { trimTail(); i = e + after[0].length; }
      else { put(text.includes('\n') ? '\n' : ' '); i = e; }
      continue;
    }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; else if (src[j] === '\n') throw new Error('a string that runs past its line at ' + i); j++; }
      put(src.slice(i, j + 1)); i = j + 1; prev = 'str'; continue;
    }
    if (c === '`') { put(c); i++; template(); continue; }
    if (c === '/') {
      const re = prev === '' || prev === 'kw' || (prev !== 'id' && prev !== 'num' && prev !== 'str' && prev !== ')' && prev !== ']');
      if (re) {
        let j = i + 1, cls = false;
        while (j < n) { const x = src[j]; if (x === '\\') { j += 2; continue; } if (x === '\n') throw new Error('a regular expression that runs past its line at ' + i); if (cls) { if (x === ']') cls = false; } else if (x === '[') cls = true; else if (x === '/') break; j++; }
        j++;
        while (j < n && /[a-z]/i.test(src[j])) j++;
        put(src.slice(i, j)); i = j; prev = 'str'; continue;
      }
      put(c); i++; prev = '/'; continue;
    }
    if (/[A-Za-z_$\u0080-\uffff]/.test(c)) {
      let j = i + 1; while (j < n && /[\w$\u0080-\uffff]/.test(src[j])) j++;
      const w = src.slice(i, j); put(w); i = j; prev = KW.has(w) ? 'kw' : 'id'; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(d))) {
      let j = i + 1; while (j < n && /[\w.]/.test(src[j])) j++;
      put(src.slice(i, j)); i = j; prev = 'num'; continue;
    }
    if (c === '\n' && lineHead()) { trimTail(); i++; continue; }   // (a blank line, outside strings: gone)
    if (/\s/.test(c)) { put(c); i++; continue; }
    if (c === '{' && tpl.length) tpl[tpl.length - 1]++;
    if (c === '}' && tpl.length) {
      if (tpl[tpl.length - 1] === 0) { tpl.pop(); put(c); i++; template(); continue; }
      tpl[tpl.length - 1]--;
    }
    put(c); i++; prev = c;
  }
  if (tpl.length) throw new Error('an unclosed template literal');
  return o.join('');
}
const hash = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

// ---- the parts loaded on demand: stories/studio-<name>.js, each a function of THREE and fflate registered as
// self.STUDIO_PARTS[name] with this build's hash (v), which stories/studio.js checks (a part of another build is refused,
// never used: the page and its parts always of one release)
const partRaw = {}, partOut = {}, partV = {};
for (const [name, P] of Object.entries(PARTS)) {
  const body = P.vendor.map(f => `// ---- ${f}.js\n${iife(f)}\n`).join('\n') + (P.meshopt ? '\n' + meshopt() : '');
  const wrap = v => [
    `// The studio's ${name} part, ${P.say}: built by tools/studio/build.mjs with stories/studio.js, which loads it on`,
    '// demand (partLoad) and refuses one of another build. Edit the sources in tools/studio/, not this file.',
    '// three.js r128\'s own add-ons (three@0.128.0, examples/js; MIT, as three.min.js: three.LICENSE.txt), unchanged' + (P.meshopt ? ', and' : ''),
    ...(P.meshopt ? ['// meshoptimizer 1.3.0\'s simplifier (MIT, as its first line says), unchanged but for its last line (an ES module\'s export)'] : []),
    `(self.STUDIO_PARTS = self.STUDIO_PARTS || {})[${JSON.stringify(name)}] = { v: '${v}', make: function (THREE, fflate) {`,
    '\'use strict\';',
    body,
    `return {${P.meshopt ? ' meshoptLoad ' : ''}};`,
    '} };',
    '',
  ].join('\n');
  const stripped = strip(wrap('0'));
  partV[name] = hash(stripped);
  partOut[name] = stripped.replace(`v: '0'`, `v: '${partV[name]}'`);
  partRaw[name] = wrap(partV[name]);
}
// what stories/studio.js holds to load them: partLoad(name) -> a promise of what the part's function gave back (made
// once a page, whichever studio asked first); exporterLoad (the GLTFExporter defined) and meshoptLoad (the simplifier)
// as before, but promises now
const loader = `
// ---- the parts loaded on demand (v226, tools/studio/build.mjs): stories/studio-<name>.js of this very build (PART_V)
const PART_V = ${JSON.stringify(partV)};
function partLoad(name) {
  const v = PART_V[name], key = name + '@' + v, W = self.STUDIO_PARTS || (self.STUDIO_PARTS = {});
  if (W[key]) return W[key];
  const p = new Promise((res, rej) => {
    const made = () => { const P = W[name]; if (!P || P.v !== v) return false; try { res(P.out || (P.out = P.make(THREE, fflate))); } catch (e) { rej(e); } return true; };
    if (made()) return;
    const s = document.createElement('script');
    s.src = 'stories/studio-' + name + '.js?v=' + v; s.async = true;
    s.onload = () => { if (!made()) rej(new Error('the studio\\'s ' + name + ' part is of another release: reload the page')); };
    s.onerror = () => rej(new Error('the studio\\'s ' + name + ' part did not load (stories/studio-' + name + '.js): check the connection'));
    document.head.appendChild(s);
  });
  p.catch(() => { if (W[key] === p) delete W[key]; });   // (a failed load is tried again next time)
  return (W[key] = p);
}
function exporterLoad() { return partLoad('convert').then(() => {}); }
function meshoptLoad() { return partLoad('convert').then(P => P.meshoptLoad()); }
`;

// ---- the story
const kit = read('../engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
const sets = SET_FILES.map(f => read(`sets/${f}.js`).trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@VENDOR@@\n', () => vendor + loader).replace('//@@SETS@@\n', () => sets);
// (ik: the solver is an app file at the repository's root since v164, as people's bodies pose by it too: bodies.js)
for (const f of ENGINE) out += f === 'ik' ? fs.readFileSync(path.join(root, 'ik.js'), 'utf8') : read(`engine/${f}.js`);
const files = { 'studio.js': [out, strip(out)] };
for (const name of Object.keys(PARTS)) files[`studio-${name}.js`] = [partRaw[name], partOut[name]];
if (process.argv.includes('--check')) {
  const stale = Object.entries(files).filter(([f, [, t]]) => { const p = path.join(root, 'stories', f); return !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== t; }).map(([f]) => 'stories/' + f);
  console.log(stale.length ? `${stale.join(', ')} out of date: run node tools/studio/build.mjs` : `stories/studio.js and its parts are up to date`);
  process.exit(stale.length ? 1 : 0);
}
const rawAt = process.argv.indexOf('--raw'), rawDir = rawAt > 0 ? process.argv[rawAt + 1] : '';
for (const [f, [raw, t]] of Object.entries(files)) {
  fs.writeFileSync(path.join(root, 'stories', f), t);
  if (rawDir) fs.writeFileSync(path.join(rawDir, f), raw);
  console.log(`wrote stories/${f} (${(t.length / 1024).toFixed(0)} KB${rawDir ? `; with its comments ${(raw.length / 1024).toFixed(0)} KB, in ${rawDir}` : ''})`);
}
