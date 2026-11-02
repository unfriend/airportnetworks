// Assembles stories/pet.js from the tour's kit (tools/lbi/kit.js), the tour's PET body set, the microanatomy story's
// 3D organs (tools/micro/sets/organs.js) and the data, organ icons, sets and engine parts in this folder.
// usage (from the repository root): node tools/pet/build.mjs        -> writes stories/pet.js
//                                   node tools/pet/build.mjs --check -> exits 1 if stories/pet.js is out of date
// After changing the figures' readings or the generator, first run node tools/pet/data/gen_data.mjs (it writes sets/data.js).
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
// the data, the organ icons and the microanatomy story's 3D organs (ORGAN3D, for the vision row's network; without its
// harness gallery, which would be a second SETS.organs) first, then the sets in the order the story uses them (body:
// the tour's PET scan)
const SET_FILES = ['sets/data', 'sets/icons', '../micro/sets/organs', 'sets/scan', '../lbi/sets/body', 'sets/organs', 'sets/liver'];
const GALLERY = "\n// the harness's gallery of the models";
const cutGallery = (f, t) => {
  if (f !== '../micro/sets/organs') return t;
  const i = t.indexOf(GALLERY);
  if (i < 0) throw new Error('tools/micro/sets/organs.js: the gallery\'s marker moved');
  return t.slice(0, i + 1);
};
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
let kit = read('../lbi/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
const sets = SET_FILES.map(f => cutGallery(f, read(`${f}.js`)).trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += read(`engine/${f}.js`);
const target = path.join(root, 'stories/pet.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/pet.js is up to date' : 'stories/pet.js is out of date: run node tools/pet/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/pet.js (${(out.length / 1024).toFixed(0)} KB)`);
