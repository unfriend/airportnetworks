// Assembles stories/soil.js from the tour's kit (tools/lbi/kit.js), the data (sets/data.js, written by
// data/gen_data.py from the authors' field trial), its decoders (sets/sdata.js), the story's palette (sets/look.js), the
// tissue topology story's look (tools/topo/sets/look.js, unchanged), the tour's web set (tools/lbi/sets/web.js,
// unchanged: only its globe is used), the sets and the engine parts in this folder.
// usage (from the repository root): node tools/soil/build.mjs        -> writes stories/soil.js
//                                   node tools/soil/build.mjs --check -> exits 1 if stories/soil.js is out of date
// Check the data and its decoders first with node tools/soil/test-data.mjs.
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
// the data, its decoders and the looks first, then the globe, then the sets in the order the story uses them
const SET_FILES = ['sets/data', 'sets/sdata', 'sets/look', '../topo/sets/look', '../lbi/sets/web', 'sets/soil', 'sets/field', 'sets/net'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../lbi/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// (the decoders' Node export goes: in the story they are a plain constant inside the closure)
const sets = SET_FILES.map(f => read(`${f}.js`).replace("if (typeof module !== 'undefined') module.exports = SDATA;\n", '').trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += read(`engine/${f}.js`);
const target = path.join(root, 'stories/soil.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/soil.js is up to date' : 'stories/soil.js is out of date: run node tools/soil/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/soil.js (${(out.length / 1024).toFixed(0)} KB)`);
