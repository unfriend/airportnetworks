// Assembles stories/tutorial.js from the tour's kit (tools/engine/kit.js) and the script, the set and the engine parts in this folder.
// usage (from the repository root): node tools/tutorial/build.mjs        -> writes stories/tutorial.js
//                                   node tools/tutorial/build.mjs --check -> exits 1 if stories/tutorial.js is out of date
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expand } from '../engine/parts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
const SET_FILES = ['script', 'guide'];   // (the script first: the set uses it)
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
const sets = SET_FILES.map(f => read(`sets/${f}.js`).replace(/^if \(typeof module !== 'undefined'\) module.exports = .*\n/m, '').trimEnd() + '\n\n').join('');   // (the script's line for Node goes)
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'stories/tutorial.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/tutorial.js is up to date' : 'stories/tutorial.js is out of date: run node tools/tutorial/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/tutorial.js (${(out.length / 1024).toFixed(0)} KB)`);
