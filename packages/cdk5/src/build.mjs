// Assembles packages/cdk5/main.js from the tour's kit (tools/engine/kit.js), the data (sets/data.js, written by
// data/gen_data.py from the Menche lab's CDK5_data repository), its decoders (sets/cdata.js), the story's palette
// (sets/look.js), the tissue topology story's look (packages/topo/src/sets/look.js, unchanged), the sets and the engine
// parts in this folder (with the shared engine parts of tools/engine/).
// usage (from the repository root): node packages/cdk5/src/build.mjs        -> writes packages/cdk5/main.js
//                                   node packages/cdk5/src/build.mjs --check -> exits 1 if packages/cdk5/main.js is out of date
// Check the data and its decoders first with node packages/cdk5/src/test-data.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expand } from '../../../tools/engine/parts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../../..');
// (a shared source, '/<path from the repository root>'; this story's own from here)
const src = f => (f.startsWith('/') ? path.join(root, f) : path.join(here, f));
const read = f => fs.readFileSync(src(f), 'utf8');
// the data, its decoders and the looks first, then the sets in the order the story uses them
const SET_FILES = ['sets/data', 'sets/cdata', 'sets/look', '/packages/topo/src/sets/look', 'sets/net', 'sets/core'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('/tools/engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// (the decoders' Node export goes: in the story they are a plain constant inside the closure)
const sets = SET_FILES.map(f => read(`${f}.js`).replace("if (typeof module !== 'undefined') module.exports = CDATA;\n", '').trimEnd() + '\n\n').join('');
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'packages/cdk5/main.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'packages/cdk5/main.js is up to date' : 'packages/cdk5/main.js is out of date: run node packages/cdk5/src/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote packages/cdk5/main.js (${(out.length / 1024).toFixed(0)} KB)`);
