// Assembles packages/endo/main.js from the tour's kit (tools/engine/kit.js), the muscle story's motor set and the data, sets
// and engine parts in this folder.
// usage (from the repository root): node packages/endo/src/build.mjs        -> writes packages/endo/main.js
//                                   node packages/endo/src/build.mjs --check -> exits 1 if packages/endo/main.js is out of date
// After a new run of the analysis, first run packages/endo/src/data/gen_data.py (it writes sets/data.js).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expand } from '../../../tools/engine/parts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../../..');
// (a shared source, '../<dir>/...', from tools/<dir>/, where shared sources stay; this story's own from here)
const src = f => (f.startsWith('../') ? path.join(here, '../../../tools/endo', f) : path.join(here, f));
const read = f => fs.readFileSync(src(f), 'utf8');
// the data first, then the sets in the order the story uses them (motor: the muscle story's, for the dive in)
const SET_FILES = ['sets/data', '../../packages/nmd/src/sets/motor', 'sets/syn', 'sets/net', 'sets/tree'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// the motor set reads only the muscle story's disease groups (name, short name, colour, site): pass those, not its data
const nmd = new Function(read('../../packages/nmd/src/sets/data.js') + '\nreturn NMD_DATA;')();
const shim = '// the muscle story\'s disease groups, for its motor set\nconst NMD_DATA = ' +
  JSON.stringify({ groups: nmd.groups.map(g => ({ name: g.name, short: g.short, col: g.col, site: g.site })) }) + ';\n\n';
const sets = shim + SET_FILES.map(f => read(`${f}.js`).trimEnd() + '\n\n').join('');
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'packages/endo/main.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'packages/endo/main.js is up to date' : 'packages/endo/main.js is out of date: run node packages/endo/src/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote packages/endo/main.js (${(out.length / 1024).toFixed(0)} KB)`);
