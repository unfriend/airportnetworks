// Assembles packages/qubits/main.js from the tour's kit (tools/engine/kit.js), the maths (sets/qmath.js), the real run's numbers
// (sets/data.js), the shared look (sets/look.js), the sets and the engine parts in this folder.
// usage (from the repository root): node packages/qubits/src/build.mjs        -> writes packages/qubits/main.js
//                                   node packages/qubits/src/build.mjs --check -> exits 1 if packages/qubits/main.js is out of date
// Check the maths first with node packages/qubits/src/test-qmath.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expand } from '../../../tools/engine/parts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../../..');
// (a path starting '../' is read from tools/: '../engine/kit.js' the shared kit, '../../packages/<key>/src/...' another
// story's shared set; this story's own from here)
const src = f => (f.startsWith('../') ? path.join(root, 'tools', f.slice(3)) : path.join(here, f));
const read = f => fs.readFileSync(src(f), 'utf8');
// the maths, the data and the look first, then the sets in the order the story uses them
const SET_FILES = ['sets/qmath', 'sets/data', 'sets/look', 'sets/pairs', 'sets/cube', 'sets/chart'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// (the maths module's Node export goes: in the story it is a plain constant inside the closure)
const sets = SET_FILES.map(f => read(`${f}.js`).replace("if (typeof module !== 'undefined') module.exports = QMATH;\n", '').trimEnd() + '\n\n').join('');
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'packages/qubits/main.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'packages/qubits/main.js is up to date' : 'packages/qubits/main.js is out of date: run node packages/qubits/src/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote packages/qubits/main.js (${(out.length / 1024).toFixed(0)} KB)`);
