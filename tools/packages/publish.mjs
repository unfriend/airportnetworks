// Publishes a change to one story package to the test site, in one command, for a story's author
// (docs/working-on-a-story.md; docs/agents/packages.md, "Publishing a package's change"). After editing
// packages/<key>/src/ (or the package's other files), from the repository root:
//   node tools/packages/publish.mjs <key> "<what changed, one sentence>" [--test "<what to try>"] [--dry] [--allow-other]
// In order, stopping with a plain sentence at the first problem:
//  1. refuses when not on dev, in the middle of a merge, or when files outside packages/<key>/ are changed (in the working
//     tree, or in commits not yet sent); --allow-other lets them through (and commits them too);
//  2. fetches dev from GitHub (git fetch origin dev);
//  3. builds the package (src/build.mjs), its miniatures if src/minis.js or src/props.json changed (tools/lowpoly/build.mjs
//     --only <key>), the builds that read its sources (as the relay's --build finds them: packages/<key>/src/ named in
//     another build.mjs), runs its own tests (src/test-*.mjs), node --check on the built files, the scan, and the release
//     step a package needs (node tools/release.mjs with the same VERSION: version.json's entry for the package; a change
//     to a package's files needs no new VERSION, docs/agents/packages.md), then the checks (the build's, the scan's and
//     the release's --check) and tools/packages/check.mjs (with --load when Playwright is installed);
//  4. says when the words the voice speaks changed since the recording (the recording then no longer matches);
//  5. commits (<key>: <sentence>), merges GitHub's dev if it moved on (a conflict in a generated file: GitHub's copy, then
//     built again; in a source file: stops, the commit kept here), and pushes (never forced; a rejected push: fetch, merge,
//     build, push once more); prints the test site's address.
// --dry does 1 to 4, then puts back every file it wrote (it never deletes: a new file is named instead). Never deletes,
// never forces, never rewrites history. No dependencies; Windows too.
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'https://stories.lab.lbi-netmed.com/', BRANCH = 'dev';
const USAGE = 'usage: node tools/packages/publish.mjs <key> "<what changed, one sentence>" [--test "<what to try>"] [--dry] [--allow-other]';
const args = process.argv.slice(2), flag = n => args.includes('--' + n);
const ti = args.indexOf('--test'), test = ti >= 0 ? (args[ti + 1] || '').trim() : '';
const pos = args.filter((a, i) => !a.startsWith('--') && !(ti >= 0 && i === ti + 1));
const [key, sentence = ''] = pos, dry = flag('dry'), allowOther = flag('allow-other');

const say = s => console.log(s);
const step = s => console.log('\n== ' + s);
function stop(msg, more) { console.log('\nStopped: ' + msg); if (more) console.log(more); process.exit(1); }
const rel = f => path.relative(root, f).split(path.sep).join('/');
const abs = f => path.join(root, ...f.split('/'));
const exists = f => fs.existsSync(abs(f));
const readBuf = f => { try { return fs.readFileSync(abs(f)); } catch (e) { return null; } };

// ---------------------------------------------------------------- git and node --
function git(a) {
  const r = spawnSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.error) stop('git is not installed, or not on this computer\'s PATH. Install it from https://git-scm.com and try again.');
  return { ok: r.status === 0, out: (r.stdout || '').trim(), raw: r.stdout || '', err: (r.stderr || '').trim() };
}
const merging = () => git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']).ok;
const gitOut = a => { const r = git(a); if (!r.ok) stop(`git ${a[0]} failed: ${(r.err || r.out).split('\n')[0]}`); return r.out; };
// a node script from the repository: true when it exits 0 (its output shown, or kept and returned with show false)
function node(file, a = [], show = true) {
  const r = spawnSync(process.execPath, [abs(file), ...a], { cwd: root, encoding: 'utf8', stdio: show ? 'inherit' : 'pipe', maxBuffer: 64 << 20 });
  return { ok: r.status === 0, out: show ? '' : (r.stdout || '') + (r.stderr || '') };
}
const last = out => out.trim().split('\n').filter(Boolean).slice(-3).join('\n');

// ---------------------------------------------------------------- 1. what may be published --
if (!key || key.startsWith('-')) stop('give the story\'s key first (the name of its folder in packages/).', USAGE);
const keys = fs.readdirSync(abs('packages')).filter(k => fs.existsSync(path.join(abs('packages'), k, 'story.json')));
if (!/^[a-z][a-z0-9-]{1,30}$/.test(key) || !keys.includes(key)) stop(`there is no story package called "${key}" (packages/${key}/story.json).`, 'The packages are: ' + keys.join(', ') + '.');
if (!sentence.trim() && !dry) stop('say in one sentence what changed, in quotes after the key.', USAGE);
if (/[\r\n]/.test(sentence) || sentence.length > 300) stop('keep the sentence to one line (300 characters at most).');
if (ti >= 0 && !test) stop('--test needs a sentence in quotes after it: what to try on the test site.');
const P = `packages/${key}/`, story = JSON.parse(fs.readFileSync(abs(P + 'story.json'), 'utf8'));
const title = story.title || key;

if (rel(gitOut(['rev-parse', '--show-toplevel'])) !== '') stop('run this from the repository\'s own folder (the one with index.html).');
const branch = gitOut(['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== BRANCH) stop(`you are on the branch "${branch}", not ${BRANCH}. Switch with: git switch ${BRANCH}`);
if (merging()) stop('a merge is not finished. Ask the maintainer, or finish it (git commit) or give it up (git merge --abort), then run this again.');

// the builds that read this package's sources (as the relay's --build finds them) and the files they write
const readers = [];
for (const k of fs.readdirSync(abs('tools'))) if (exists(`tools/${k}/build.mjs`)) readers.push({ build: `tools/${k}/build.mjs`, out: `stories/${k}.js` });
for (const k of keys) if (k !== key && exists(`packages/${k}/src/build.mjs`)) readers.push({ build: `packages/${k}/src/build.mjs`, out: `packages/${k}/main.js`, pkg: k });
const readerList = readers.filter(r => fs.readFileSync(abs(r.build), 'utf8').includes(`packages/${key}/src/`));
// files this command writes besides the package's own (allowed to be changed already: a dry run's, say)
const GEN = new Set(['packages/index.json', 'version.json', ...readerList.map(r => r.out)]);
const mine = f => f.startsWith(P) || GEN.has(f);

function status() {
  const out = git(['status', '--porcelain=v1', '-z', '--untracked-files=all']).raw, parts = out.split('\0'), files = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (!e) continue;
    files.push({ xy: e.slice(0, 2), f: e.slice(3) });
    if (/^[RC]/.test(e)) i++;   // (a rename: its old name follows)
  }
  return files;
}
const before = status();
const others = before.filter(x => !mine(x.f) && x.xy !== '??');
if (others.length && !allowOther) {
  stop(`files outside ${P} are changed, and this command publishes only your story:\n  ${others.map(x => x.f).join('\n  ')}`,
    'If you did not mean to change them, ask the maintainer. If they must go with your change, run it again with --allow-other.');
}
const strays = before.filter(x => !mine(x.f) && x.xy === '??');
if (strays.length) say(`(${strays.length} new file(s) outside ${P} are left alone and not published: ${strays.slice(0, 3).map(x => x.f).join(', ')}${strays.length > 3 ? ' ...' : ''})`);

// ---------------------------------------------------------------- 2. GitHub's dev --
step('Asking GitHub for the latest dev');
const fetched = git(['fetch', 'origin', BRANCH]);
if (!fetched.ok) {
  if (!dry) stop('could not reach GitHub: ' + (fetched.err.split('\n')[0] || 'no answer') + '.', 'Check the internet connection, and that you can sign in to GitHub from git on this computer (git push asks once).');
  say('Could not reach GitHub (a dry run goes on without it).');
}
const remote = `origin/${BRANCH}`, haveRemote = git(['rev-parse', '--verify', '-q', remote]).ok;
const behind = haveRemote ? +gitOut(['rev-list', '--count', `HEAD..${remote}`]) : 0;
const ahead = haveRemote ? +gitOut(['rev-list', '--count', `${remote}..HEAD`]) : 0;
// files changed in commits made here and not yet sent
const unsent = haveRemote && ahead ? gitOut(['diff', '--name-only', `${remote}...HEAD`]).split('\n').filter(Boolean) : [];
const unsentOthers = unsent.filter(f => !mine(f));
if (unsentOthers.length && !allowOther) {
  stop(`commits on this computer that are not on GitHub yet change files outside ${P}:\n  ${unsentOthers.join('\n  ')}`, 'Ask the maintainer, or run it again with --allow-other if they must go with your change.');
}
say(behind ? `GitHub's dev has ${behind} commit(s) this computer does not have yet: they are merged after your change is committed.` : 'This computer has everything GitHub\'s dev has.');

// ---------------------------------------------------------------- 3. build and check --
const changedHere = () => new Set(status().map(x => x.f).concat(unsent));
const touched = f => changedHere().has(f);
const saved = new Map();   // (for --dry: every file this command may write, as it was)
for (const f of [P + 'main.js', P + 'minis.js', ...GEN]) saved.set(f, readBuf(f));
const VERSION = () => (/const VERSION = '([^']+)'/.exec(fs.readFileSync(abs('sw.js'), 'utf8')) || [])[1] || '';

async function playwright() {
  try {
    const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
    const ch = pw.chromium || (pw.default && pw.default.chromium);
    const exe = process.env.CHROMIUM_PATH || ch.executablePath();
    return exe && fs.existsSync(exe) ? ch : null;
  } catch (e) { return null; }
}

async function buildAndCheck(full, rebuild = []) {
  step(`Building ${P}`);
  const minisSrc = [P + 'src/minis.js', P + 'src/props.json'];
  if (exists(P + 'src/build.mjs')) {
    if (!node(P + 'src/build.mjs').ok) stop(`the story's build failed (${P}src/build.mjs): the lines above say where. Fix it, try it in the preview, and run this again.`);
  } else say(`(no ${P}src/build.mjs: ${P}main.js is written by hand)`);
  if (exists(P + 'src/minis.js') && (minisSrc.some(touched) || !exists(P + (story.minis || 'minis.js')))) {
    if (!node('tools/lowpoly/build.mjs', ['--only', key]).ok) stop('the miniatures\' build failed (tools/lowpoly/build.mjs --only ' + key + '): the lines above say which one (each must stay under 1,200 triangles, with its count right).');
  }
  for (const b of rebuild) if (exists(b) && !node(b).ok) stop(`${b} failed after the merge: ask the maintainer.`);
  for (const r of readerList) {
    say(`(${r.build} reads this story's sources: built again)`);
    if (!node(r.build).ok) stop(`${r.build}, which reads this story's sources, failed: the lines above say where. A shared part of your story is used by another story; ask the maintainer.`);
  }
  for (const t of exists(P + 'src') ? fs.readdirSync(abs(P + 'src')).filter(f => /^test-.*\.mjs$/.test(f)).sort() : []) {
    step(`The story's own test: ${P}src/${t}`);
    if (!node(P + 'src/' + t).ok) stop(`the story's own test failed (${P}src/${t}): the lines above say what. Fix it and run this again.`);
  }
  for (const f of [P + 'main.js', ...readerList.map(r => r.out), ...(story.minis ? [P + story.minis] : [])]) {
    if (exists(f) && spawnSync(process.execPath, ['--check', abs(f)], { stdio: 'inherit' }).status !== 0) stop(`${f} is not valid JavaScript (above).`);
  }
  step('The index of packages and the release file');
  const sc = node('tools/packages/scan.mjs', [], false);
  process.stdout.write(sc.out);
  if (!sc.ok || new RegExp(`\\b${key}\\b[^\\n]*(left out|skipped)`).test(sc.out)) stop(`the scan left your story out or failed (above): usually story.json. Check it, or ask the maintainer.`);
  // (a package's change needs only version.json's entry for it: anything else the release step would write means the app
  // has changes of the maintainer's not yet released, which are not this command's to publish; put back, and stop)
  const keep = ['index.html', 'sw.js', 'whatsnew/index.json'].map(f => [f, readBuf(f)]), dirty0 = new Set(status().map(x => x.f));
  const rl = node('tools/release.mjs', [], false);
  process.stdout.write(rl.out);
  if (!rl.ok) stop('tools/release.mjs refused (above). This is about the app itself, not your story: ask the maintainer.');
  const extra = status().map(x => x.f).filter(f => !dirty0.has(f) && !mine(f));
  if (extra.length) {
    for (const [f, buf] of keep) if (buf && extra.includes(f)) fs.writeFileSync(abs(f), buf);
    stop(`the release step also wanted to change ${extra.join(', ')}: the app itself has changes that are not released yet. Ask the maintainer.`);
  }
  step('Checks');
  if (exists(P + 'src/build.mjs') && !node(P + 'src/build.mjs', ['--check']).ok) stop(`${P}main.js is not what its sources build: run this again; if it says so twice, ask the maintainer.`);
  const rc = node('tools/release.mjs', ['--check'], false);
  process.stdout.write(rc.out);
  if (!rc.ok) stop('the release check failed (above). If it names whatsnew.json or the shell, the app has changes of the maintainer\'s that are not released yet: ask the maintainer.');
  if (full) {
    const pw = await playwright();
    if (!pw) say('(Playwright with Chromium is not installed here: the story is not opened headless; the rules are checked without it.)');
    if (!node('tools/packages/check.mjs', [P, ...(pw ? ['--load'] : [])]).ok) stop(`tools/packages/check.mjs found a problem with your story (the FAIL lines above).`);
  }
}

// ---------------------------------------------------------------- 4. the spoken words --
// the voice's lines as the page has them (each cue's data-say, else its text; small print with data-say="" left out),
// from a story file served in place of the package's main.js
async function spoken(pw, files) {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
  let swap = null;
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    if (u === P + 'main.js' && swap) { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); res.end(swap); return; }
    if (u === 'sw.js') { res.writeHead(404); res.end(); return; }   // (no service worker: nothing kept between the two)
    const f = path.join(root, ...u.split('/'));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await pw.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = [];
  try {
    for (const text of files) {
      swap = text;
      const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
      await page.addInitScript(() => { try { localStorage.setItem('tutorialHold', 'off'); localStorage.setItem('collabAutoWelcome', 'off'); } catch (e) { /* storage blocked */ } });
      await page.goto(`http://127.0.0.1:${srv.address().port}/index.html#${key}`);
      await page.waitForFunction(k => typeof HOST !== 'undefined' && HOST.curKey === k && HOST.cur && !HOST.busy && document.querySelector('section.ch'), key, { timeout: 120000 });
      out.push(await page.evaluate(() => {
        const lines = [];
        for (const sec of document.querySelectorAll('section.ch')) for (const el of sec.querySelectorAll('[data-at]')) {
          if (el.closest('.credits')) continue;
          const s = (el.hasAttribute('data-say') ? el.getAttribute('data-say') : el.textContent).replace(/\s+/g, ' ').trim();
          if (s) lines.push(s);
        }
        return lines;
      }));
      await page.close();
    }
  } finally { await browser.close(); srv.close(); }
  return out;
}
async function voiceCheck() {
  const audio = exists(P + 'audio') ? fs.readdirSync(abs(P + 'audio')).filter(f => /^narration.*\.mp3$/.test(f)) : [];
  if (!audio.length) return;
  step('The spoken words');
  const textSrc = exists(P + 'src/engine/e3_story.js') ? P + 'src/engine/e3_story.js' : P + 'main.js';
  if (!touched(textSrc)) { say(`Not touched (${textSrc} did not change): the recording still matches.`); return; }
  const rec = git(['log', '-1', '--format=%H', '--', P + 'audio']).out;
  const was = rec ? git(['show', `${rec}:${P}main.js`]).out : '';
  const tell = what => say(`${what}\nThe recording (${P}audio/) then no longer matches the story: the voice says the old words, at the old times.\n` +
    `It is made again with the synthetic voice, on a computer with Kokoro set up (tools/voice/README.md):\n  node tools/voice/narrate.mjs ${key}   (with the folder served), then  node tools/voice/check.mjs ${key} --quick\n` +
    'Or ask the maintainer to do it. Publishing goes on: the test site shows your new text with the old recording.');
  const pw = was ? await playwright() : null;
  if (!pw) { tell(`${textSrc} changed. If you changed what the voice says (a data-say, a key point, a heading), read on.`); return; }
  let lines;
  try { lines = await spoken(pw, [Buffer.from(was), fs.readFileSync(abs(P + 'main.js'))]); }
  catch (e) { tell(`The words could not be compared (${String(e.message || e).split('\n')[0]}). If you changed what the voice says, read on.`); return; }
  const [a, b] = lines, A = new Set(a), B = new Set(b);
  const gone = a.filter(s => !B.has(s)), added = b.filter(s => !A.has(s));
  if (!gone.length && !added.length && a.length === b.length) { say(`The voice's ${b.length} lines are the same as at the recording (${rec.slice(0, 7)}): it still matches.`); return; }
  const cut = s => (s.length > 110 ? s.slice(0, 107) + '...' : s);
  tell(`The spoken words changed since the recording (${rec.slice(0, 7)}): ${added.length} line(s) new or changed, ${gone.length} gone.` +
    added.slice(0, 2).map(s => '\n  now: ' + cut(s)).join('') + gone.slice(0, 2).map(s => '\n  was: ' + cut(s)).join(''));
}

// ---------------------------------------------------------------- 5. merge, commit, push --
// files git's merge may leave in conflict that are written by tools: GitHub's copy is taken, then built again
const builtBy = f => {
  const m = /^packages\/([^/]+)\/(main|minis)\.js$/.exec(f);
  if (m && m[2] === 'main' && exists(`packages/${m[1]}/src/build.mjs`)) return `packages/${m[1]}/src/build.mjs`;
  if (m && m[2] === 'minis') return 'tools/lowpoly/build.mjs';
  if (/^stories\/(design|studio)\.js$/.test(f)) return `tools/${/^stories\/(\w+)/.exec(f)[1]}/build.mjs`;
  if (f === 'lowpoly.js') return 'tools/lowpoly/build.mjs';
  return null;
};
const stage = (n, f) => { const r = spawnSync('git', ['show', `:${n}:${f}`], { cwd: root, maxBuffer: 256 << 20 }); return r.status === 0 ? r.stdout : null; };
const sameBut = (f, re) => { const a = stage(2, f), b = stage(3, f); return a && b && a.toString('utf8').replace(re, '') === b.toString('utf8').replace(re, ''); };
function generated(f) {
  if (/^(packages\/index\.json|version\.json|whatsnew\.json|whatsnew\/[^/]+\.json)$/.test(f) || builtBy(f)) return true;
  // (sw.js and index.html only when nothing but VERSION, or the release's stamps, differs)
  if (f === 'sw.js') return sameBut(f, /const VERSION = '[^']*';|const SHELL = \[[^\]]*\];|const AUDIO = \[[^\]]*\];/g);
  if (f === 'index.html') return sameBut(f, /shell: \{ n: \d+, id: '[0-9a-f]*', format: '[^']*' \},|<script src="stories\/list\.js(\?v=[0-9a-f]*)?"><\/script>/g);
  return false;
}
async function mergeDev() {
  step(`Merging GitHub's dev (${remote}) into yours`);
  const m = git(['merge', '--no-edit', remote]);
  const rebuild = [];
  if (!m.ok) {
    const conflicted = git(['diff', '--name-only', '--diff-filter=U']).out.split('\n').filter(Boolean);
    if (!conflicted.length) stop('git could not merge GitHub\'s dev: ' + (m.err || m.out).split('\n').slice(0, 3).join(' '), 'Your change is committed on this computer and not lost. Ask the maintainer.');
    const sources = conflicted.filter(f => !generated(f));
    if (sources.length) {
      git(['merge', '--abort']);
      stop(`someone else changed the same lines as you on GitHub, in:\n  ${sources.join('\n  ')}`,
        'Your change is committed on this computer (not lost) but not sent. Ask the maintainer to merge it, then run this again.');
    }
    for (const f of conflicted) {
      const theirs = stage(3, f);
      if (theirs) fs.writeFileSync(abs(f), theirs);
      gitOut(['add', '--', f]);
      const b = builtBy(f);
      if (b && !rebuild.includes(b)) rebuild.push(b);
      say(`(${f}: GitHub's copy taken; it is written again below)`);
    }
  }
  await buildAndCheck(false, rebuild.filter(b => b !== P + 'src/build.mjs'));
  // (everything was committed before the merge: what is changed now was written by the builds above)
  const add = status().filter(x => x.xy !== '??' || x.f.startsWith(P)).map(x => x.f);
  if (add.length) gitOut(['add', '--', ...add]);
  if (merging()) gitOut(['commit', '--no-edit']);
  else if (!git(['diff', '--cached', '--quiet']).ok) gitOut(['commit', '-m', `${key}: built again after merging ${BRANCH}`]);
}

// ---------------------------------------------------------------- run --
await buildAndCheck(true);
await voiceCheck();

const now = status();
const toAdd = now.filter(x => x.f.startsWith(P) || (x.xy !== '??' && (GEN.has(x.f) || allowOther))).map(x => x.f);
const idx = JSON.parse(fs.readFileSync(abs('packages/index.json'), 'utf8')), fp = ((idx.packages || []).find(p => p.key === key) || {}).fp || '';

if (dry) {
  step('Dry run: nothing committed or sent');
  say(toAdd.length ? `A real run would commit:\n  ${toAdd.join('\n  ')}` : 'There is nothing to commit.');
  if (behind) say(`and merge ${behind} commit(s) from GitHub's dev first.`);
  const put = [], made = [];
  for (const [f, buf] of saved) {
    const cur = readBuf(f);
    if (buf === null && cur !== null) made.push(f);
    else if (buf !== null && (cur === null || !buf.equals(cur))) { fs.writeFileSync(abs(f), buf); put.push(f); }
  }
  say(put.length ? `Put back as they were: ${put.join(', ')}.` : 'No file needed putting back.');
  if (made.length) say(`New files this run made (they are not deleted; they go with your change when you publish): ${made.join(', ')}.`);
  say(`Your own edits in ${P} are as you left them.`);
  process.exit(0);
}

if (toAdd.length) gitOut(['add', '--', ...toAdd]);
const staged = !git(['diff', '--cached', '--quiet']).ok;
if (!staged && !ahead && !behind) { say(`\nNothing to publish: nothing changed in ${P}, and nothing is waiting to be sent.`); process.exit(0); }
if (staged) {
  step('Committing');
  const body = `To try: ${test || `Open ${title} and check the change.`}\nUntested: not tried on a headset.\n` +
    `Package ${key} ${fp}: no app release (VERSION stays ${VERSION()}); running pages take it from packages/index.json.`;
  const c = git(['commit', '-m', `${key}: ${sentence.trim()}`, '-m', body]);
  if (!c.ok) {
    if (/user\.(name|email)|identity/i.test(c.err)) stop('git does not know who you are yet. Tell it once:\n  git config --global user.name "Your Name"\n  git config --global user.email "you@example.org"\nthen run this again.');
    stop('git could not commit: ' + (c.err || c.out).split('\n')[0]);
  }
  say(gitOut(['log', '-1', '--format=%h %s']));
}
if (behind) await mergeDev();

step('Sending to GitHub');
let p = git(['push', '-u', 'origin', BRANCH]);
if (!p.ok && /rejected|fetch first|non-fast-forward/i.test(p.err)) {
  say('GitHub\'s dev moved on meanwhile: merging it and sending once more.');
  if (!git(['fetch', 'origin', BRANCH]).ok) stop('could not reach GitHub again. Your change is committed here; run this again later.');
  await mergeDev();
  p = git(['push', '-u', 'origin', BRANCH]);
}
if (!p.ok) {
  stop('GitHub did not take the change: ' + p.err.split('\n').filter(l => !/^To /.test(l))[0],
    /denied|403|authenticat|permission/i.test(p.err) ? 'You may not have the right to push to the repository yet: ask the maintainer. Your change is committed on this computer and not lost.' :
      'Your change is committed on this computer and not lost: run this again in a moment, or ask the maintainer.');
}
say(`\nPublished. The test site takes a minute or two to update; then open\n  ${SITE}#${key}\n` +
  'In a headset, reload the page there (or open the story again from the Stories screen).');
