// Assembles packages/lbi/main.js from the sources in this folder: the kit, the ten sets and the engine parts.
// usage (from the repository root): node packages/lbi/src/build.mjs        -> writes packages/lbi/main.js
//                                   node packages/lbi/src/build.mjs --check -> exits 1 if packages/lbi/main.js is out of date
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expand } from '../../../tools/engine/parts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../../..');
// (a shared source, '../<dir>/...', from tools/<dir>/, where shared sources stay; this story's own from here)
const src = f => (f.startsWith('../') ? path.join(here, '../../../tools/lbi', f) : path.join(here, f));
const read = f => fs.readFileSync(src(f), 'utf8');
// the sets in the order the story uses them (crowd and sankey share sets/clinic.js)
const SET_FILES = ['int', 'mac', 'web', 'dna', 'atp', 'clinic', 'scale', 'body', 'tissue'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets: makeKit(THREE) returns K.\n');
const sets = SET_FILES.map(f => read(`sets/${f}.js`).trimEnd() + '\n\n').join('');
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'packages/lbi/main.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'packages/lbi/main.js is up to date' : 'packages/lbi/main.js is out of date: run node packages/lbi/src/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote packages/lbi/main.js (${(out.length / 1024).toFixed(0)} KB)`);
