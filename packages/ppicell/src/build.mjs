// Builds a story package's main.js (tools/packages/SPEC.md) from the app's kit (tools/engine/kit.js), the shared engine
// parts (tools/engine/) and the sets and engine files in this folder, as the built stories are made
// (docs/agents/stories.md). This folder is the package's src/: packages/<key>/src/build.mjs writes packages/<key>/main.js,
// with the key of packages/<key>/story.json.
// usage: node packages/<key>/src/build.mjs          -> writes packages/<key>/main.js
//        node packages/<key>/src/build.mjs --check  -> exits 1 if main.js is out of date
//        --root <dir>: the app's folder, when this one is not inside it (a copy elsewhere)
// The built main.js holds everything it needs: the app's later changes to the engine reach it only when it is built again.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), pkg = path.join(here, '..');
const args = process.argv.slice(2), check = args.includes('--check'), ri = args.indexOf('--root');
const fail = m => { console.log(m); process.exit(1); };
// the sets, in the order the story uses them (sets/<name>.js; a file of helpers the sets share goes first)
const SET_FILES = ['data', 'pdata', 'structs', 'cell', 'ball', 'crowd', 'walls', 'lens', 'sites', 'next'];
const ENGINE = ['e2_scene', 'e3_story', 'e4_explore', 'e5_xr', 'e6_panels', 'e7_app'];
// the app's folder: --root, or the first folder up from here that holds tools/engine/parts.mjs
let root = ri >= 0 ? path.resolve(args[ri + 1] || '.') : here;
while (!fs.existsSync(path.join(root, 'tools', 'engine', 'parts.mjs'))) {
  const up = path.dirname(root);
  if (ri >= 0 || up === root) fail('No tools/engine/parts.mjs found: build inside the app\'s folder (or give it with --root <dir>).');
  root = up;
}
const { expand } = await import(pathToFileURL(path.join(root, 'tools', 'engine', 'parts.mjs')).href);
// the key: story.json's, beside this folder (tools/packages/template has none: copy it to packages/<key>/src/ first)
let sj;
try { sj = JSON.parse(fs.readFileSync(path.join(pkg, 'story.json'), 'utf8').replace(/^﻿/, '')); }
catch (e) { fail(`No story.json in ${pkg}: copy this folder to packages/<key>/src/ and write packages/<key>/story.json first (tools/packages/SPEC.md).`); }
const KEY = sj && sj.key;
if (!/^[a-z][a-z0-9-]{1,30}$/.test(KEY || '')) fail('story.json\'s key is not a key: a lower-case letter, then 1 to 30 lower-case letters, digits or -.');
if (path.basename(pkg) !== KEY) fail(`story.json's key is ${KEY}, but its folder is ${path.basename(pkg)}.`);
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
const kit = fs.readFileSync(path.join(root, 'tools', 'engine', 'kit.js'), 'utf8')
  .replace("if (typeof module !== 'undefined') module.exports = { makeKit };\n", '')
  .replace(/^(\/\/.*\n)+/, '// Shared helpers for the 3D sets (the tour\'s kit): makeKit(THREE) returns K.\n');
// (a helper's Node export, for testing it with node, goes: in the story it is a plain constant inside the closure)
const sets = SET_FILES.map(f => read(`sets/${f}.js`).replace(/^if \(typeof module !== 'undefined'\) module\.exports = .*\n/m, '').trimEnd() + '\n\n').join('');
let out = expand(read('engine/e1_head.js'), 'e1_head').split('@@KEY@@').join(KEY).replace('//@@KIT@@\n', () => kit).replace('//@@SETS@@\n', () => sets);
for (const f of ENGINE) out += expand(read(`engine/${f}.js`), f);
const target = path.join(pkg, 'main.js'), name = `packages/${KEY}/main.js`;
if (check) {
  const same = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === out;
  console.log(same ? `${name} is up to date` : `${name} is out of date: run node packages/${KEY}/src/build.mjs`);
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(target, out);
console.log(`wrote ${name} (${(out.length / 1024).toFixed(0)} KB); then node tools/packages/scan.mjs`);
