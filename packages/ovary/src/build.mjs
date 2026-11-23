// Assembles packages/ovary/main.js from the tour's kit (tools/engine/kit.js), the data and shared look, the tour's body set
// (unchanged), the sets and the engine parts in this folder.
// usage (from the repository root): node packages/ovary/src/build.mjs        -> writes packages/ovary/main.js
//                                   node packages/ovary/src/build.mjs --check -> exits 1 if packages/ovary/main.js is out of date
// After changing the figures' readings or the generator, first run node packages/ovary/src/data/gen_data.mjs (it writes
// sets/data.js).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expand } from '../../../tools/engine/parts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../../..');
// (a shared source, '../<dir>/...', from tools/<dir>/, where shared sources stay; this story's own from here)
const src = f => (f.startsWith('../') ? path.join(here, '../../../tools/ovary', f) : path.join(here, f));
const read = f => fs.readFileSync(src(f), 'utf8');
// the data and the shared look (OVARY_TREND, OVARY_LOOK) first, then the sets in the order the story uses them
const SET_FILES = ['sets/data', 'sets/look', '../../packages/lbi/src/sets/body', 'sets/organ', 'sets/section', 'sets/charts'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
const sets = SET_FILES.map(f => read(`${f}.js`).trimEnd() + '\n\n').join('');
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'packages/ovary/main.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'packages/ovary/main.js is up to date' : 'packages/ovary/main.js is out of date: run node packages/ovary/src/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote packages/ovary/main.js (${(out.length / 1024).toFixed(0)} KB)`);
