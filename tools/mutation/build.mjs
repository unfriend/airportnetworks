// Assembles stories/mutation.js from the tour's kit (tools/engine/kit.js), the maths (sets/mmath.js), the poster's numbers
// (sets/data.js), the shared look (sets/look.js), the sets and the engine parts in this folder.
// usage (from the repository root): node tools/mutation/build.mjs        -> writes stories/mutation.js
//                                   node tools/mutation/build.mjs --check -> exits 1 if stories/mutation.js is out of date
// Check the maths first with node tools/mutation/test-mmath.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expand } from '../engine/parts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
// the maths, the data and the look first, then the sets in the order the story uses them
const SET_FILES = ['sets/mmath', 'sets/data', 'sets/look', 'sets/letters', 'sets/tree', 'sets/rule', 'sets/stem'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// (the maths module's Node export goes: in the story it is a plain constant inside the closure)
const sets = SET_FILES.map(f => read(`${f}.js`).replace("if (typeof module !== 'undefined') module.exports = MMATH;\n", '').trimEnd() + '\n\n').join('');
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'stories/mutation.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/mutation.js is up to date' : 'stories/mutation.js is out of date: run node tools/mutation/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/mutation.js (${(out.length / 1024).toFixed(0)} KB)`);
