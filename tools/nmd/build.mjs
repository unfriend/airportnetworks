// Assembles stories/nmd.js from the tour's kit (tools/lbi/kit.js) and the data, sets and engine parts in this folder.
// usage (from the repository root): node tools/nmd/build.mjs        -> writes stories/nmd.js
//                                   node tools/nmd/build.mjs --check -> exits 1 if stories/nmd.js is out of date
// After changing ikerdata/, first run node tools/nmd/data/gen_data.mjs (it writes sets/data.js).
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
// the data first, then the sets in the order the story uses them
const SET_FILES = ['data', 'tower', 'motor', 'hpc'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../lbi/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
const sets = SET_FILES.map(f => read(`sets/${f}.js`).trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += read(`engine/${f}.js`);
const target = path.join(root, 'stories/nmd.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/nmd.js is up to date' : 'stories/nmd.js is out of date: run node tools/nmd/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/nmd.js (${(out.length / 1024).toFixed(0)} KB)`);
