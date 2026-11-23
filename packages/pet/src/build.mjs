// Assembles packages/pet/main.js from the tour's kit (tools/engine/kit.js), the tour's PET body set, the microanatomy story's
// 3D organs (tools/micro/sets/organs.js) and the data, organ icons, sets and engine parts in this folder.
// usage (from the repository root): node packages/pet/src/build.mjs        -> writes packages/pet/main.js
//                                   node packages/pet/src/build.mjs --check -> exits 1 if packages/pet/main.js is out of date
// After changing the figures' readings or the generator, first run node packages/pet/src/data/gen_data.mjs (it writes sets/data.js).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expand } from '../../../tools/engine/parts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '../../..');
// (a shared source, '../<dir>/...', from tools/<dir>/, where shared sources stay; this story's own from here)
const src = f => (f.startsWith('../') ? path.join(here, '../../../tools/pet', f) : path.join(here, f));
const read = f => fs.readFileSync(src(f), 'utf8');
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
let kit = read('../engine/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
const sets = SET_FILES.map(f => cutGallery(f, read(`${f}.js`)).trimEnd() + '\n\n').join('');
let out = expand(read('engine/e1_head.js'), 'e1_head').replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(root, 'packages/pet/main.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'packages/pet/main.js is up to date' : 'packages/pet/main.js is out of date: run node packages/pet/src/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote packages/pet/main.js (${(out.length / 1024).toFixed(0)} KB)`);
