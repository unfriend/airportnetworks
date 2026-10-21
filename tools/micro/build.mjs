// Assembles stories/micro.js from the tour's kit (tools/lbi/kit.js), the tour's body and tissue sets, the PET story's
// organ icons and the data, sets and engine parts in this folder.
// usage (from the repository root): node tools/micro/build.mjs        -> writes stories/micro.js
//                                   node tools/micro/build.mjs --check -> exits 1 if stories/micro.js is out of date
// After changing the figures' readings or the generator, first run node tools/micro/data/gen_data.mjs <graphml> (it writes
// sets/data.js).
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
// the data (with a shim the PET story's icons read) and the icons first, then the sets in the order the story uses them
const SET_FILES = ['sets/data', '../pet/sets/icons', '../lbi/sets/body', '../lbi/sets/tissue', 'sets/slide', 'sets/atlas', 'sets/hier'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../lbi/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// MICRO_STUBS=1 (while the engine is built before every set exists): a missing set comes from stubs/; the real build
// and --check never do this
const stub = f => process.env.MICRO_STUBS && !process.argv.includes('--check') && !fs.existsSync(path.join(here, `${f}.js`)) ? f.replace('sets/', 'stubs/') : f;
const sets = SET_FILES.map(f => read(`${stub(f)}.js`).trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += read(`engine/${f}.js`);
const target = path.join(root, 'stories/micro.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/micro.js is up to date' : 'stories/micro.js is out of date: run node tools/micro/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/micro.js (${(out.length / 1024).toFixed(0)} KB)`);
