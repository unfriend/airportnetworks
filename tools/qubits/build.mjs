// Assembles stories/qubits.js from the tour's kit (tools/lbi/kit.js), the maths (sets/qmath.js), the real run's numbers
// (sets/data.js), the shared look (sets/look.js), the sets and the engine parts in this folder.
// usage (from the repository root): node tools/qubits/build.mjs        -> writes stories/qubits.js
//                                   node tools/qubits/build.mjs --check -> exits 1 if stories/qubits.js is out of date
// Check the maths first with node tools/qubits/test-qmath.mjs.
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
// the maths, the data and the look first, then the sets in the order the story uses them
const SET_FILES = ['sets/qmath', 'sets/data', 'sets/look', 'sets/pairs', 'sets/cube', 'sets/chart'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../lbi/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// (the maths module's Node export goes: in the story it is a plain constant inside the closure)
const sets = SET_FILES.map(f => read(`${f}.js`).replace("if (typeof module !== 'undefined') module.exports = QMATH;\n", '').trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += read(`engine/${f}.js`);
const target = path.join(root, 'stories/qubits.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/qubits.js is up to date' : 'stories/qubits.js is out of date: run node tools/qubits/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/qubits.js (${(out.length / 1024).toFixed(0)} KB)`);
