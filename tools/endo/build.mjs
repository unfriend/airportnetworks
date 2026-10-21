// Assembles stories/endo.js from the tour's kit (tools/lbi/kit.js), the muscle story's motor set and the data, sets
// and engine parts in this folder.
// usage (from the repository root): node tools/endo/build.mjs        -> writes stories/endo.js
//                                   node tools/endo/build.mjs --check -> exits 1 if stories/endo.js is out of date
// After a new run of the analysis, first run tools/endo/data/gen_data.py (it writes sets/data.js).
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
// the data first, then the sets in the order the story uses them (motor: the muscle story's, for the dive in)
const SET_FILES = ['sets/data', '../nmd/sets/motor', 'sets/syn', 'sets/net', 'sets/tree'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../lbi/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// the motor set reads only the muscle story's disease groups (name, short name, colour, site): pass those, not its data
const nmd = new Function(read('../nmd/sets/data.js') + '\nreturn NMD_DATA;')();
const shim = '// the muscle story\'s disease groups, for its motor set\nconst NMD_DATA = ' +
  JSON.stringify({ groups: nmd.groups.map(g => ({ name: g.name, short: g.short, col: g.col, site: g.site })) }) + ';\n\n';
const sets = shim + SET_FILES.map(f => read(`${f}.js`).trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += read(`engine/${f}.js`);
const target = path.join(root, 'stories/endo.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/endo.js is up to date' : 'stories/endo.js is out of date: run node tools/endo/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/endo.js (${(out.length / 1024).toFixed(0)} KB)`);
