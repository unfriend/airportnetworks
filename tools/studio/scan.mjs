// node tools/studio/scan.mjs <folder> [--check]
// The studio's scenes from a plain folder (tests, a web host without the relay; read only: tools/studio/SPEC.md, "From
// a plain folder"). Writes <folder>/index.json, what the relay's GET /api/scenes answers (save: false), and
// <folder>/<name>/files.json, what GET /api/scenes/<name> answers without its layout (the page fetches
// <folder>/<name>/layout.json itself). The listing rules are the relay's own (relay/scenes.mjs: the same names, kinds,
// depth, order and files left out), so a page cannot tell the two apart. A file is written only when what it says has
// changed: run it again and nothing changes. --check writes nothing and exits 1 when a file is not current (the files'
// times aside: a fresh checkout gives every file a new one).
import fs from 'node:fs';
import path from 'node:path';
import { allScenes, summary, fileOut, layoutAt, layoutText, INDEX, LISTING } from '../../relay/scenes.mjs';

const args = process.argv.slice(2), check = args.includes('--check'), dir = args.find(a => !a.startsWith('--'));
if (!dir || args.some(a => a.startsWith('--') && a !== '--check')) {
  console.log('usage: node tools/studio/scan.mjs <folder of scenes> [--check]   (each subfolder one scene)');
  process.exit(1);
}
let root = '';
try { root = fs.realpathSync(path.resolve(dir)); if (!fs.statSync(root).isDirectory()) root = ''; } catch { /* said below */ }
if (!root) { console.log(`no folder ${path.resolve(dir)}`); process.exit(1); }

const left = [];
const all = await allScenes(root, n => left.push(n));
for (const n of left) console.log(`left out the folder ${JSON.stringify(n)} (${n === 'watch' ? 'watch is the relay\'s change stream' : 'a scene\'s name: up to 64 letters, digits, spaces, _ . or -, not starting with a space, . or -'})`);

// (as the relay answers, but laid out a field a line and a file a line, for people and git)
const noTimes = text => text.replace(/"(at|layoutAt)":\s*\d+/g, '"$1":0');
let stale = 0;
function put(file, obj, what) {
  const text = layoutText(obj), rel = file.startsWith(process.cwd() + path.sep) ? path.relative(process.cwd(), file) : file;
  let old = null;
  try { old = fs.readFileSync(file, 'utf8'); } catch { /* none yet */ }
  if (check) {
    const ok = old !== null && noTimes(old) === noTimes(text);
    if (!ok) stale++;
    return console.log(`${ok ? 'current' : 'NOT CURRENT'} ${rel} (${what})`);
  }
  if (old === text) return console.log(`unchanged ${rel} (${what})`);
  fs.writeFileSync(file, text);
  console.log(`wrote ${rel} (${what})`);
}
put(path.join(root, INDEX), { scenes: all.map(summary), save: false }, `${all.length} scene${all.length === 1 ? '' : 's'}`);
for (const s of all) {
  put(path.join(s.dir, LISTING), { name: s.name, files: s.files.map(fileOut), layoutAt: layoutAt(s.layout), save: false },
    `${s.files.length} file${s.files.length === 1 ? '' : 's'}${s.layout ? ' and layout.json' : ', no layout.json'}`);
}
if (check && stale) { console.log(`${stale} not current: run node tools/studio/scan.mjs ${dir}`); process.exit(1); }
