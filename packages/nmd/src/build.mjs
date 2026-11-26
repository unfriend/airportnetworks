// Assembles packages/nmd/main.js from the tour's kit (tools/engine/kit.js) and the data, sets and engine parts in this folder.
// usage (from the repository root): node packages/nmd/src/build.mjs        -> writes packages/nmd/main.js
//                                   node packages/nmd/src/build.mjs --check -> exits 1 if packages/nmd/main.js is out of date
// After the authors' files change, first run node packages/nmd/src/data/gen_data.mjs <their folder> (it writes sets/data.js).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expand } from '../../../tools/engine/parts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../../..');
// (a path starting '../' is read from tools/: '../engine/kit.js' the shared kit, '../../packages/<key>/src/...' another
// story's shared set; this story's own from here)
const src = f => (f.startsWith('../') ? path.join(root, 'tools', f.slice(3)) : path.join(here, f));
const read = f => fs.readFileSync(src(f), 'utf8');
// the data first, then the sets in the order the story uses them
const SET_FILES = ['data', 'tower', 'motor', 'hpc'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
const sets = SET_FILES.map(f => read(`sets/${f}.js`).trimEnd() + '\n\n').join('');
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'packages/nmd/main.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'packages/nmd/main.js is up to date' : 'packages/nmd/main.js is out of date: run node packages/nmd/src/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote packages/nmd/main.js (${(out.length / 1024).toFixed(0)} KB)`);
