// Assembles packages/qubits/main.js from the tour's kit (tools/engine/kit.js), the maths (sets/qmath.js), the real run's numbers
// (sets/data.js), the shared look (sets/look.js), the sets and the engine parts in this folder.
// usage (from the repository root): node packages/qubits/src/build.mjs        -> writes packages/qubits/main.js
//                                   node packages/qubits/src/build.mjs --check -> exits 1 if packages/qubits/main.js is out of date
// Check the maths first with node packages/qubits/src/test-qmath.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
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
// The two layouts the story makes at load (sets/pairs.js's map, sets/cube.js's default network), worked out here with the
// same calls and stored by their key (QMATH's layout() uses one only while its key, everything it depends on, matches;
// otherwise it works the layout out live as before, so a change to those calls costs time, never a wrong picture).
const Q = createRequire(import.meta.url)('./sets/qmath.js');
const QLAY = {};
{
  const store = (net, o) => { const P = Q.layout(net, o); QLAY[Q.layoutKey(net, o)] = Buffer.from(P.buffer, P.byteOffset, P.byteLength).toString('base64'); };
  // pairs.js: the map, started from each gene's hood on the ring of cells
  const code = Q.analyze(Q.DEFAULT, { L: 3 }).code, GRAY = [0, 1, 3, 2, 6, 7, 5, 4], PI = Math.PI;
  const hood = c => { const a = GRAY.indexOf(c) / 8 * 2 * PI + PI / 8; return [0.66 * Math.cos(a), 0.66 * Math.sin(a)]; };
  store(Q.network(Q.DEFAULT), { dim: 2, iters: 50, seed: 9, init: g => { const h = hood(code[g]); return [h[0] * 0.8, h[1] * 0.8, 0]; } });
  // cube.js: buildNet(DEF)
  const DEF = Math.max(0, Q.NETS.findIndex(s => s.key === Q.DEFAULT));
  store(Q.network(Q.NETS[DEF].key), { dim: 3, iters: 45, seed: 7 + DEF });
}
const stored = `// the load's two layouts, worked out by src/build.mjs (QMATH's layout() checks each key)\nconst QLAY_STORED = ${JSON.stringify(QLAY)};\n\n`;
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => stored + sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'packages/qubits/main.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'packages/qubits/main.js is up to date' : 'packages/qubits/main.js is out of date: run node packages/qubits/src/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote packages/qubits/main.js (${(out.length / 1024).toFixed(0)} KB)`);
