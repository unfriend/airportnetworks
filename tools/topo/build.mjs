// Assembles stories/topo.js from the tour's kit (tools/lbi/kit.js), the data (sets/data.js, written by
// data/gen_data.py from the authors' topocyte run), its decoders (sets/tdata.js), the shared look (sets/look.js), the
// tour's body set, the microanatomy story's organ models, the sets and the engine parts in this folder.
// usage (from the repository root): node tools/topo/build.mjs        -> writes stories/topo.js
//                                   node tools/topo/build.mjs --check -> exits 1 if stories/topo.js is out of date
// Check the data and its decoders first with node tools/topo/test-data.mjs.
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
// the data, its decoders and the look first, then the body and the organ models, then the sets in the order the story uses them
const SET_FILES = ['sets/data', 'sets/tdata', 'sets/look', '../lbi/sets/body', '../micro/sets/organs', 'sets/slide', 'sets/map', 'sets/tower', 'sets/cohort'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../lbi/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// (the decoders' Node export goes: in the story they are a plain constant inside the closure)
const sets = SET_FILES.map(f => read(`${f}.js`).replace("if (typeof module !== 'undefined') module.exports = TDATA;\n", '').trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += read(`engine/${f}.js`);
const target = path.join(root, 'stories/topo.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/topo.js is up to date' : 'stories/topo.js is out of date: run node tools/topo/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/topo.js (${(out.length / 1024).toFixed(0)} KB)`);
