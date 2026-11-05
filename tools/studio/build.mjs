// Assembles stories/studio.js (the studio: your own scenes, a page that is not a story) from the tour's kit
// (tools/lbi/kit.js), three.js r128's own add-ons vendored in vendor/ (pasted with their licence lines, each wrapped so
// nothing of them shows outside the story but THREE.*: fflate's UMD sees no module, exports, define or global self),
// the sets and the engine parts in this folder.
// usage (from the repository root): node tools/studio/build.mjs        -> writes stories/studio.js
//                                   node tools/studio/build.mjs --check -> exits 1 if stories/studio.js is out of date
import fs from 'fs';
import path from 'path';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '../..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
const SET_FILES = ['stage', 'looks'];
// (images: the pictures the browser cannot show, and texture names; convert: the converter; both modules that
// tools/studio/convert.mjs loads in its headless page too)
const ENGINE = ['e2_scene', 'e3_story', 'e4_files', 'images', 'convert', 'e5_models', 'e6_items', 'e6b_cuts', 'e6c_groups', 'e7_explore', 'e7b_upload', 'e7c_direct', 'e8_xr', 'e9_panels', 'e10_app'];
// (e7c_direct: a relay that keeps its scenes in R2, signed links and uploads straight into the bucket; after the Upload
// pane, whose uploads it takes over)
// the app's add-ons, in the order they need each other (the NURBS curve before the FBX loader that asks for it); the
// GLTFExporter last, inside a function the converter calls the first time it converts (exporterLoad)
const VENDOR = ['NURBSUtils', 'NURBSCurve', 'TGALoader', 'FBXLoader', 'GLTFLoader', 'OBJLoader', 'MTLLoader', 'PLYLoader', 'STLLoader', 'SkeletonUtils', 'TransformControls'];
const LATER = ['GLTFExporter'];

// ---- the vendored add-ons
const fflate = read('vendor/fflate.min.js').trim();
const iife = f => {
  const src = read(`vendor/${f}.js`).trim();
  if (!/^\( function \(\) \{/.test(src) || !/THREE\.\w+ = \w+;\s*\} \)\(\);$/.test(src)) throw new Error(`vendor/${f}.js is not the IIFE three.js r128 ships (it would leak names): check vendor/README.md`);
  return src;
};
const three = VENDOR.map(f => `// ---- ${f}.js\n${iife(f)}\n`).join('\n') + '\n' +
  LATER.map(f => `// ---- ${f}.js: defined only when the studio first converts a model (Convert to GLB, the Upload pane)\nfunction exporterLoad() {\nif (THREE.${f}) return;\n${iife(f)}\n}\n`).join('\n');
const vendor = [
  '// three.js r128\'s own add-ons (three@0.128.0, examples/js; MIT, as three.min.js: three.LICENSE.txt), unchanged, and',
  '// fflate 0.6.9 (MIT, Arjun Barrett, https://github.com/101arrowz/fflate), which the FBX loader needs to unpack',
  '// compressed binary arrays. Each add-on is its own function that sets THREE.<name> only; fflate is kept in this',
  '// story\'s closure (its UMD wrapper finds no module, exports, define or global self).',
  'const fflate = (function () {',
  '  const module = undefined, exports = undefined, define = undefined, self = {};   // (only self.fflate is set)',
  fflate,
  '  return self.fflate;',
  '})();',
  three,
].join('\n');

// ---- the story
const kit = read('../lbi/kit.js')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
const sets = SET_FILES.map(f => read(`sets/${f}.js`).trimEnd() + '\n\n').join('');
let out = read('engine/e1_head.js').replace('//@@KIT@@\n', () => kit).replace('//@@VENDOR@@\n', () => vendor).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += read(`engine/${f}.js`);
const target = path.join(root, 'stories/studio.js');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? 'stories/studio.js is up to date' : 'stories/studio.js is out of date: run node tools/studio/build.mjs');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote stories/studio.js (${(out.length / 1024).toFixed(0)} KB)`);
