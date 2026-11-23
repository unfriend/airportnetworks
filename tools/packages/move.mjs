// Moves one of the app's built stories into a story package (docs/packages-migration.md, "Decided route"; the robots
// were the pilot): the same story, the same key and hooks, its sources and narration in its folder.
// usage (from the repository root, on a clean tree): node tools/packages/move.mjs <key> [--needs <n>] [--dry]
//   --needs: the oldest shell the package works with (default: the shell's release now, index.html's HOST.shell n: a
//            moved story needs nothing newer; HOST.shell n moves only when a release changes the shell, so VERSION + 1
//            would refuse the story on a shell that did not change)
//   --dry:   says what it would do, changes nothing
// What it does, each step with git mv where a file moves (history kept; nothing is deleted):
//   1. tools/<key>/ -> packages/<key>/src/; stories/<key>.js -> packages/<key>/main.js (the built file stays built)
//   2. src/build.mjs patched: the parts from tools/engine/ (../../../tools/engine/parts.mjs), a shared source named as
//      '../<dir>/...' read from tools/<dir>/ (shared sources stay where they are), the target packages/<key>/main.js;
//      the other sources' paths (tools/<key>/ -> packages/<key>/src/, the harness's ../ addresses)
//   3. the narration: audio/narration-<key>[-<lang>].mp3 -> packages/<key>/audio/narration[-<lang>].mp3, and the
//      engine's narrationFile() through HOST.pkgUrl (an address the index fingerprints)
//   4. story.json from its stories/list.js entry (icon, intro, life, needs), a README.md, its entry out of
//      stories/list.js (packages/order.json keeps its place), .gitignore's and tools/design/props.json's paths
//   5. the build run, and its main.js compared with the old built file: only the lines the move changes may differ
//   6. node tools/packages/scan.mjs, node tools/design/build.mjs
// Then by hand: node tools/release.mjs (after the VERSION bump), node tools/narration.mjs <url>, the story's docs
// (docs/agents/stories.md -> its entry says where it is now, layout.md, AGENTS.md's table), and the checks below.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2), dry = args.includes('--dry'), ni = args.indexOf('--needs');
const key = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--needs');
const at = (...p) => path.join(root, ...p), has = (...p) => fs.existsSync(at(...p));
const fail = m => { console.log('move: ' + m); process.exit(1); };
const say = m => console.log((dry ? '(dry) ' : '') + m);
const git = (...a) => { say('git ' + a.join(' ')); if (!dry) execFileSync('git', a, { cwd: root, stdio: 'inherit' }); };
const edit = (f, fn) => { const p = at(f), t = fs.readFileSync(p, 'utf8'), n = fn(t); if (n !== t) { say('patched ' + f); if (!dry) fs.writeFileSync(p, n); } return n; };

if (!/^[a-z][a-z0-9-]{1,30}$/.test(key || '')) fail('usage: node tools/packages/move.mjs <key> [--needs <n>] [--dry]');
const ctx = { self: {} };
const listText = fs.readFileSync(at('stories/list.js'), 'utf8');
vm.runInNewContext(listText, ctx);
const meta = (ctx.self.STORY_LIST || []).find(m => m && m.key === key);
if (!meta) fail(`${key} is not a story of stories/list.js (STORY_EXTRA's pages stay in the shell)`);
if (!has('tools', key, 'build.mjs')) fail(`tools/${key}/build.mjs is not there: only a built story moves this way (a hand-written one is wrapped by hand)`);
if (has('packages', key)) fail(`packages/${key} is there already`);
const order = (JSON.parse(fs.readFileSync(at('packages/order.json'), 'utf8')).order || []);
if (!order.includes(key)) fail(`packages/order.json does not name ${key}`);
const shellN = +(/shell: \{ n: (\d+)/.exec(fs.readFileSync(at('index.html'), 'utf8')) || [])[1];
const needs = ni >= 0 ? +args[ni + 1] : shellN;
if (!Number.isInteger(needs) || needs < 1) fail('--needs takes a release number');
const oldBuilt = fs.readFileSync(at('stories', key + '.js'), 'utf8');

// 1. the folders
if (!dry) fs.mkdirSync(at('packages', key), { recursive: true });
git('mv', `tools/${key}`, `packages/${key}/src`);
git('mv', `stories/${key}.js`, `packages/${key}/main.js`);
const S = dry ? `tools/${key}` : `packages/${key}/src`;   // (where the sources are now)

// 2. the build and the other sources' paths
const NARR = `'audio/narration-${key}.mp3'`;
// (the folder named bare, as in "the set in tools/<key>: edit those" or "run it from `tools/<key>`")
const BARE = new RegExp(`(?<![\\w/.-])tools/${key}(?![\\w/-])`, 'g');
edit(`${S}/build.mjs`, t => {
  let n = t.replace(/from '\.\.\/engine\/parts\.mjs'/g, "from '../../../tools/engine/parts.mjs'")
    .replace(/path\.join\(here, '\.\.\/\.\.'\)/g, "path.join(here, '../../..')")
    .replace(/path\.join\(here, f\)/g, 'src(f)')
    .replace(/path\.join\(here, '\.\.\/(?!\.)/g, "path.join(here, '../../../tools/")
    .replace(/(from|require\()\s*'\.\.\/(?!\.)/g, "$1 '../../../tools/")
    .split(`'stories/${key}.js'`).join(`'packages/${key}/main.js'`)
    .split(`stories/${key}.js`).join(`packages/${key}/main.js`)
    .split(`tools/${key}/build.mjs`).join(`packages/${key}/src/build.mjs`)
    .split(`tools/${key}/`).join(`packages/${key}/src/`)
    .replace(BARE, `packages/${key}/src`);
  if (/src\(f\)/.test(n) && !/^const src = f =>/m.test(n)) {
    // (a source named '../<dir>/...' is read where it is, in tools/<dir>/: shared sources stay there)
    n = n.replace(/^(const here = .*\n)/m, `$1// (a shared source, '../<dir>/...', from tools/<dir>/, where shared sources stay; this story's own from here)\nconst src = f => (f.startsWith('../') ? path.join(here, '../../../tools/${key}', f) : path.join(here, f));\n`);
  }
  return n;
});
const walk = d => fs.readdirSync(at(d), { withFileTypes: true }).flatMap(e => (e.isDirectory() ? (/^(shots|gen|node_modules)$/.test(e.name) ? [] : walk(`${d}/${e.name}`)) : [`${d}/${e.name}`]));
for (const f of walk(S).filter(f => /\.(js|mjs|html|md|py|json)$/.test(f) && !f.endsWith('/build.mjs'))) {
  edit(f, t => {
    let n = t.split(`tools/${key}/build.mjs`).join(`packages/${key}/src/build.mjs`)
      .split(`tools/${key}/`).join(`packages/${key}/src/`)
      .split(`stories/${key}.js`).join(`packages/${key}/main.js`)
      .replace(BARE, `packages/${key}/src`);
    if (/\/engine\//.test(f)) n = n.split(NARR).join(`HOST.pkgUrl('${key}', 'audio/narration.mp3')`)
      .replace(new RegExp(`'audio/narration-${key}-([a-z]+)\\.mp3'`, 'g'), `HOST.pkgUrl('${key}', 'audio/narration-$1.mp3')`);
    // (the other languages too: audio/narration-<key>-<lang>.mp3 is the package's audio/narration-<lang>.mp3)
    n = n.split(`audio/narration-${key}.mp3`).join(`packages/${key}/audio/narration.mp3`)
      .replace(new RegExp(`(?<![\\w/])audio/narration-${key}-([a-z]+)\\.mp3`, 'g'), `packages/${key}/audio/narration-$1.mp3`);
    if (f.endsWith('.html')) n = n.replace(/(src|href)="\.\.\/\.\.\//g, '$1="../../../').replace(/(src|href)="\.\.\/(?!\.)/g, '$1="../../../tools/');
    // (a tool's root, two folders up from tools/<key>/, is three up from packages/<key>/src/)
    if (/\.mjs$/.test(f)) n = n.replace(/(from|require\()\s*'\.\.\/(?!\.)/g, "$1 '../../../tools/").replace(/path\.join\(here, '\.\.\/\.\.'\)/g, "path.join(here, '../../..')");
    // (and from a subfolder, tools/<key>/data/: its root three up becomes four, one more per level)
    const depth = f.slice(S.length + 1).split('/').length - 1;
    if (/\.mjs$/.test(f) && depth > 0) { const up = n => Array(n).fill('..').join('/'); n = n.split(`path.join(here, '${up(depth + 2)}')`).join(`path.join(here, '${up(depth + 3)}')`); }
    return n;
  });
}
// 2b. the readers: other stories' sources that read this one's (a build's SET_FILES '../<key>/sets/...', a harness's
// <script src="../<key>/...">, endo's '../nmd/sets/data.js'), in tools/<dir>/ or in a moved package's src/. Their paths
// follow to packages/<key>/src/: '../<key>/' becomes '../../packages/<key>/src/', which resolves from tools/<dir>/ and,
// through a moved build's src() (a shared source from tools/<dir>/..), from packages/<dir>/src/ alike; a moved harness's
// '../../../tools/<key>/' becomes '../../../packages/<key>/src/'; and every file of a reader's folder names the new place
// (its comments end up in its built file: the reader is built again below, its main.js changing only in those lines).
const REL = new RegExp(`(['"\`])\\.\\./${key}/`, 'g'), DEEP = new RegExp(`\\.\\./\\.\\./\\.\\./tools/${key}/`, 'g');
const srcDirs = fs.readdirSync(at('tools'), { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== key && has('tools', e.name, 'build.mjs')).map(e => `tools/${e.name}`)
  .concat(has('packages') ? fs.readdirSync(at('packages'), { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== key && has('packages', e.name, 'src', 'build.mjs')).map(e => `packages/${e.name}/src`) : []);
const reads = new RegExp(`(['"\`])\\.\\./${key}/|\\.\\./\\.\\./\\.\\./tools/${key}/`);
const readers = srcDirs.filter(d => ['build.mjs', 'harness.html'].some(f => has(d, f) && reads.test(fs.readFileSync(at(d, f), 'utf8'))));
for (const d of readers) {
  say(`reader: ${d} reads ${key}'s sources`);
  for (const f of walk(d).filter(f => /\.(js|mjs|html|md|py|json)$/.test(f))) {
    edit(f, t => t.replace(REL, `$1../../packages/${key}/src/`).replace(DEEP, `../../../packages/${key}/src/`)
      .split(`tools/${key}/build.mjs`).join(`packages/${key}/src/build.mjs`)
      .split(`tools/${key}/`).join(`packages/${key}/src/`)
      .split(`stories/${key}.js`).join(`packages/${key}/main.js`)
      .replace(BARE, `packages/${key}/src`));
  }
}
const left = walk(S).filter(f => /\/engine\//.test(f) && new RegExp(`audio/narration-${key}`).test(fs.readFileSync(at(f), 'utf8')));
if (left.length) console.log(`note: ${left.join(', ')} still name audio/narration-${key}...: change those by hand to HOST.pkgUrl('${key}', 'audio/narration[-<lang>].mp3')`);

// 3. the narration(s)
const narrs = (has('audio') ? fs.readdirSync(at('audio')) : []).filter(f => new RegExp(`^narration-${key}(-[a-z]+)?\\.mp3$`).test(f));
if (narrs.length && !dry) fs.mkdirSync(at('packages', key, 'audio'), { recursive: true });
for (const f of narrs) git('mv', `audio/${f}`, `packages/${key}/audio/${f.replace(`narration-${key}`, 'narration')}`);

// 4. story.json, README.md, stories/list.js, .gitignore, props.json
const sj = { key, api: 1, version: '1.0.0' };
for (const k of ['title', 'kick', 'col', 'desc', 'len', 'page', 'brand', 'sub', 'aria', 'thing', 'loading']) if (typeof meta[k] === 'string') sj[k] = meta[k];
sj.authors = "The app's authors"; sj.life = meta.life === true; sj.list = 'stories';
if (meta.icon) sj.icon = meta.icon;
if (meta.intro) sj.intro = true;
sj.needs = Math.max(needs, Number.isInteger(meta.needs) ? meta.needs : 0);
say(`write packages/${key}/story.json (needs ${sj.needs})`);
if (!dry) fs.writeFileSync(at('packages', key, 'story.json'), JSON.stringify(sj, null, 2) + '\n');
say(`write packages/${key}/README.md`);
if (!dry) fs.writeFileSync(at('packages', key, 'README.md'), `# ${meta.kick}: ${meta.title} (\`#${key}\`)\n\n${meta.desc}\n\n` +
  `One of the app's own stories, a story package since it moved here (docs/packages-migration.md). Made by the app's authors;\n` +
  `its sources, its build and its notes are in \`src/\` (\`src/README.md\`, \`src/SPEC.md\` where there is one): \`node packages/${key}/src/build.mjs\`\n` +
  `writes \`main.js\`, then \`node tools/packages/scan.mjs\`. Its data and the permission to show it: \`docs/data-and-permissions.md\`.\n`);
const entry = new RegExp(`\\n  \\{ key: '${key}',[\\s\\S]*?(?=\\n  \\{ key: |\\n\\];)`);
if (!entry.test(listText)) fail(`could not find ${key}'s entry in stories/list.js`);
edit('stories/list.js', t => {
  // (STORY_LIST's last entry ends without a comma: when the one removed was last, the new last one loses its comma)
  const cut = t.indexOf('self.STORY_EXTRA'), head = cut >= 0 ? t.slice(0, cut) : t, rest = cut >= 0 ? t.slice(cut) : '';
  return head.replace(entry, '').replace(/\},(\s*\n\];)/, '}$1') + rest;
});
edit('.gitignore', t => t.split(`tools/${key}/`).join(`packages/${key}/src/`));
edit('tools/design/props.json', t => t.split(`tools/${key}/`).join(`packages/${key}/src/`));
if (dry) process.exit(0);

// 5. build, and compare with the old built file: only the lines naming the narration, the build and the folder differ
execFileSync(process.execPath, [at('packages', key, 'src', 'build.mjs')], { cwd: root, stdio: 'inherit' });
const a = oldBuilt.split('\n'), b = fs.readFileSync(at('packages', key, 'main.js'), 'utf8').split('\n');
const diff = [];
for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diff.push(i + 1);
const expected = i => /narration|packages\/|tools\//.test(b[i - 1] || '') || /narration|stories\/|tools\//.test(a[i - 1] || '');
const odd = diff.filter(i => !expected(i));
console.log(`main.js against the old stories/${key}.js: ${a.length === b.length ? 'the same length' : `${a.length} -> ${b.length} lines`}, ${diff.length} lines differ` +
  (odd.length ? `, ${odd.length} unexpected (first at line ${odd[0]}): look before committing` : ' (each one naming the narration or the folders)'));
for (const i of diff.slice(0, 8)) console.log(`  ${i}: ${(a[i - 1] || '').trim().slice(0, 110)}\n  ${' '.repeat(String(i).length)}  ${(b[i - 1] || '').trim().slice(0, 110)}`);

// (the readers built again: their paths now name packages/<key>/src/, and their built files the comments that moved)
for (const d of readers) execFileSync(process.execPath, [at(d, 'build.mjs')], { cwd: root, stdio: 'inherit' });

// 6. the index and the design room (its cards name the sources' files)
execFileSync(process.execPath, [at('tools/packages/scan.mjs')], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, [at('tools/design/build.mjs')], { cwd: root, stdio: 'inherit' });
console.log(`\nmoved ${key}. Next: git add -A packages/${key} stories tools audio .gitignore; the checks: node packages/${key}/src/build.mjs --check,
node tools/packages/check.mjs packages/${key} --load, node tools/engine/all.mjs --check, node tools/packages/scan.mjs --check;
the release (VERSION, whatsnew.json, node tools/release.mjs), node tools/narration.mjs <url>, the story's docs; then the smoke
test's blocks for it and the suites before main (docs/packages-migration.md).`);
if (odd.length) process.exit(1);
