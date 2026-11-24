// The release's version file, for live updates (index.html's HOST.live asks for it about once a minute): writes
// version.json at the app's root and stamps the shell's release into index.html (HOST.shell). Run it as the last step of
// a release, after bumping VERSION in sw.js (docs/setup-and-release.md), and commit both files.
// usage (from the repository root): node tools/release.mjs          -> writes version.json (and index.html's stamp, and
//                                                                      sw.js's story files and narrations)
//                                   node tools/release.mjs --check  -> exits 1 if either is not current, or if
//                                                                      whatsnew.json does not name this release
//                                   --root <dir>: another copy of the app (the live test's)
// version.json: { app, version (sw.js VERSION), format (shared.js FORMAT), shell: { n, id }, list, stories: { <key>:
// { fp, needs } } }. The shell is index.html, shared.js, three.min.js, peerjs.min.js, output.js, sfx.js, occlusion.js, ships.js, notes.js, ik.js and
// bodies.js (people's bodies, v164: loaded on demand, as output.js is); its id is their fingerprint
// (index.html without its stamp and its head's title and link-preview lines, which a running page never shows), and n
// the release in which they last changed (VERSION's number: a new shell needs a new VERSION). sw.js is not part of it:
// the service worker updates itself, and adding a story changes its list of files. list: the fingerprint of the list of
// stories (stories/list.js's STORY_LIST), as the page computes it. Each story (and each page in STORY_EXTRA, such as the
// design room, so live updates reach it too): its file's fingerprint and the oldest shell it needs
// (its entry's own needs, else the shell of the release in which its file last changed). A page compares: another shell
// or format, or a story that needs a newer shell, is asked about (Reload now or Later); a new or changed story is taken.
// The fingerprint is index.html's HOST.fingerprint (and relay/server.mjs's), so the three agree.
// The app's own story packages (v185, docs/packages-migration.md: the stories named in packages/order.json that have
// moved into packages/<key>/): packages: { <key>: { fp, needs } }, the index's fp (packages/index.json) and the oldest
// shell it works with, its story.json's needs (which each must have: the release that moved it, at least; the shell
// refuses a package that needs a newer one, HOST.packages). STORY_LIST may shrink as stories move, to nothing once all
// have. --check also runs node tools/packages/scan.mjs --check.
// whatsnew.json (developer mode's box, HOST.dev: { version, date, new, test, untested }, lists of short sentences) is
// written by hand at every release; this script only checks it: a file that does not name sw.js's VERSION (or is not in
// that shape) is a warning, and --check fails on it, so a release does not go out with an old box. Each release's file is
// also kept in whatsnew/ (see below), so developer mode can page back through them.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2), check = args.includes('--check');
const ri = args.indexOf('--root');
const root = ri >= 0 ? path.resolve(args[ri + 1]) : path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/^﻿/, '');
function fingerprint(s) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
}
const fail = msg => { console.log(msg); process.exit(1); };

const version = (/const VERSION = '([^']+)'/.exec(read('sw.js')) || [])[1];
const format = (/const FORMAT = '([^']+)'/.exec(read('shared.js')) || [])[1];
if (!version || !/\d+$/.test(version)) fail('sw.js has no VERSION ending in a number');
if (!format) fail('shared.js has no FORMAT');
const vnum = +/(\d+)$/.exec(version)[1];
const ctx = { self: {} };
vm.runInNewContext(read('stories/list.js'), ctx, { filename: 'stories/list.js' });
const list = ctx.self.STORY_LIST;
// the app's own story packages: those packages/order.json names that are folders of packages/ (their index entries)
const pjson = f => { try { return JSON.parse(read(f)); } catch (e) { return null; } };
const order = ((pjson('packages/order.json') || {}).order || []).filter(k => typeof k === 'string');
const pindex = pjson('packages/index.json') || { packages: [] };
const pkgs = order.filter(k => fs.existsSync(path.join(root, 'packages', k, 'story.json')));
if (!Array.isArray(list) || (!list.length && !pkgs.length)) fail('stories/list.js gives no STORY_LIST, and no story has moved into a package');
const extra = Array.isArray(ctx.self.STORY_EXTRA) ? ctx.self.STORY_EXTRA : [];

const STAMP = /shell: \{ n: \d+, id: '[0-9a-f]*', format: '[^']*' \},/;
const index = read('index.html');
if (!STAMP.test(index)) fail("index.html has no shell stamp (shell: { n: 0, id: '', format: '' }, in HOST)");
// (stories/list.js is loaded as stories/list.js?v=<its fingerprint>, stamped here too: a browser that still holds the
// old list (ten minutes on GitHub Pages, and the memory cache of a page reloaded for a new shell) would otherwise give a
// new page an old list, naming stories that have moved into packages since. Not part of the shell's id.)
const LISTTAG = /<script src="stories\/list\.js(\?v=[0-9a-f]*)?"><\/script>/;
if (!LISTTAG.test(index)) fail('index.html does not load stories/list.js as <script src="stories/list.js?v=0"></script>');
const shellText = [
  index.replace(STAMP, 'shell: {},').replace(LISTTAG, '<script src="stories/list.js"></script>').replace(/^<(title>|meta (name="(description|twitter:[^"]*)"|property="og:[^"]*"))[^\n]*$/gm, ''),
  read('shared.js'), read('three.min.js'), read('peerjs.min.js'), read('output.js'), read('sfx.js'), read('occlusion.js'), read('ships.js'), read('notes.js'),
  read('ik.js'), read('bodies.js'), read('flight.js'),
].join('\n\u0000\n');
const id = fingerprint(shellText);

let prev = null;
try { prev = JSON.parse(read('version.json')); } catch (e) { /* the first release with a version file */ }
let n = vnum;
if (prev && prev.shell && prev.shell.id === id) n = prev.shell.n;
else if (prev && prev.shell && vnum <= prev.shell.n) {
  fail(check ? `version.json is out of date: the shell changed since release ${prev.shell.n} (bump VERSION in sw.js, then run node tools/release.mjs)` :
    `The shell changed since version.json was written (release ${prev.shell.n}): bump VERSION in sw.js first, then run this again.`);
}
const stories = {};
for (const m of list.concat(extra)) {
  const f = `stories/${m.key}.js`;
  if (!fs.existsSync(path.join(root, f))) fail(`${f} is in the list but not there`);
  const fp = fingerprint(read(f)), was = prev && prev.stories && prev.stories[m.key];
  const needs = Number.isInteger(m.needs) ? m.needs : was && was.fp === fp && Number.isInteger(was.needs) ? was.needs : n;
  stories[m.key] = { fp, needs };
}
const packages = {};
for (const k of pkgs) {
  const e = (pindex.packages || []).find(p => p && p.key === k);
  if (!e) fail(`packages/${k} is named in packages/order.json but not in packages/index.json: run node tools/packages/scan.mjs`);
  if (!Number.isInteger(e.needs)) fail(`packages/${k}/story.json has no needs: give it the release that moved it (one of the app's own stories)`);
  packages[k] = { fp: e.fp, needs: e.needs };
}
const out = JSON.stringify({ app: 'networks', version, format, shell: { n, id }, list: fingerprint(JSON.stringify(list)), stories, ...(pkgs.length ? { packages } : {}) }, null, 2) + '\n';

// sw.js's lists, written from what is there (v171): SHELL's story files from stories/list.js (its stories and
// STORY_EXTRA, in that order), AUDIO from the narrations in audio/ (the airports' narration.mp3, then each story's in the
// list's order, its other languages after it). So adding or removing a story is its entry in stories/list.js, and a
// file that is gone never stays in SHELL, where one missing file fails the whole offline install.
const swText = read('sw.js');
const storyFiles = ['./stories/list.js', ...list.concat(extra).map(m => `./stories/${m.key}.js`)].map(f => `'${f}'`).join(', ');
const narrs = (fs.existsSync(path.join(root, 'audio')) ? fs.readdirSync(path.join(root, 'audio')) : []).filter(f => /^narration(-[a-z]+)*\.mp3$/.test(f));
const keyOrder = list.concat(extra).map(m => m.key), narrKey = f => (/^narration-([a-z]+)/.exec(f) || [])[1];
const rank = f => f === 'narration.mp3' ? -1 : keyOrder.includes(narrKey(f)) ? keyOrder.indexOf(narrKey(f)) : keyOrder.length;
narrs.sort((a, b) => rank(a) - rank(b) || a.length - b.length || (a < b ? -1 : 1));
const STORY_RUN = /'\.\/stories\/[^']+\.js'(, '\.\/stories\/[^']+\.js')*/, AUDIO_LIST = /const AUDIO = \[[^\]]*\];/;
if (!STORY_RUN.test(swText) || !AUDIO_LIST.test(swText)) fail("sw.js has no SHELL story files or no AUDIO list for tools/release.mjs to keep");
const swOut = swText.replace(STORY_RUN, () => storyFiles).replace(AUDIO_LIST, () => `const AUDIO = [${narrs.map(f => `'./audio/${f}'`).join(', ')}];`);
const stamped = index.replace(STAMP, `shell: { n: ${n}, id: '${id}', format: '${format}' },`).replace(LISTTAG, `<script src="stories/list.js?v=${fingerprint(read('stories/list.js'))}"></script>`);

// what is new in this release (whatsnew.json, by hand): it names this release, and its lists are sentences
let news = '';
if (!fs.existsSync(path.join(root, 'whatsnew.json'))) news = `there is no whatsnew.json: write one for ${version} (what is new, what to test, what is untested)`;
else {
  let w = null;
  try { w = JSON.parse(read('whatsnew.json')); } catch (e) { news = 'whatsnew.json is not valid JSON'; }
  if (w && w.version !== version) news = `whatsnew.json is for ${typeof w.version === 'string' && w.version ? w.version : 'no release'}, not ${version}: rewrite it for this release (what is new, what to test, what is untested)`;
  else if (w && !['new', 'test', 'untested'].every(k => Array.isArray(w[k]) && w[k].every(x => typeof x === 'string'))) news = 'whatsnew.json: new, test and untested must each be a list of sentences';
}
const warn = () => { if (news) console.log('Warning: ' + news); };

// the history of what is new (whatsnew/<version>.json, one file a release, and whatsnew/index.json = { versions: [newest
// first], at }: HOST.dev's Older and Newer): this release's whatsnew.json copied in as its own file, the index listing every
// networks-vN file there, `at` the newest's date (so it is the same on every run). Written by a normal run, checked by --check
const wdir = path.join(root, 'whatsnew');
const wnum = f => +/^networks-v(\d+)\.json$/.exec(f)[1];
const wfiles = () => (fs.existsSync(wdir) ? fs.readdirSync(wdir) : []).filter(f => /^networks-v\d+\.json$/.test(f));
let wnow = null;   // (the current release's file as it will be written)
if (!news) wnow = JSON.stringify(JSON.parse(read('whatsnew.json')), null, 2) + '\n';
const wnames = new Set(wfiles()); if (wnow) wnames.add(version + '.json');
const wlist = [...wnames].sort((a, b) => wnum(b) - wnum(a));
const wdate = f => { try { return JSON.parse(f === version + '.json' && wnow ? wnow : fs.readFileSync(path.join(wdir, f), 'utf8')).date || ''; } catch (e) { return ''; } };
const windex = JSON.stringify({ versions: wlist.map(f => f.replace(/\.json$/, '')), at: wlist.length ? wdate(wlist[0]) : '' }, null, 2) + '\n';
const wold = f => { try { return fs.readFileSync(path.join(wdir, f), 'utf8'); } catch (e) { return null; } };
const wstale = () => (wnow && wold(version + '.json') !== wnow ? [version + '.json'] : []).concat(wold('index.json') !== windex ? ['index.json'] : []);

const hadOut = (() => { try { return read('version.json'); } catch (e) { return ''; } })();
if (check) {
  let scanOk = true;
  // (a copy without the packages' scan, a test's, has no index to check)
  if (fs.existsSync(path.join(root, 'tools/packages/scan.mjs'))) try { execFileSync(process.execPath, [path.join(root, 'tools/packages/scan.mjs'), '--check', '--root', root], { stdio: 'inherit' }); } catch (e) { scanOk = false; }
  const ok = hadOut === out && stamped === index && scanOk, ws = wstale(), swOk = swOut === swText;
  console.log(hadOut === out && stamped === index ? `version.json and index.html's stamp are current (${version}, shell ${n})` :
    `${hadOut !== out ? 'version.json' : "index.html's stamp"} is out of date: run node tools/release.mjs`);
  console.log(swOk ? "sw.js's story files and narrations are current" : "sw.js's SHELL story files or AUDIO list are out of date (stories/list.js, audio/): run node tools/release.mjs");
  console.log(ws.length ? `whatsnew/ is out of date (${ws.join(', ')}): run node tools/release.mjs` : `whatsnew/ is current (${wlist.length} releases)`);
  warn();
  process.exit(ok && swOk && !news && !ws.length ? 0 : 1);
}
if (swOut !== swText) { fs.writeFileSync(path.join(root, 'sw.js'), swOut); console.log("wrote sw.js's story files and narrations (from stories/list.js and audio/)"); }
if (stamped !== index) fs.writeFileSync(path.join(root, 'index.html'), stamped);
if (hadOut !== out) fs.writeFileSync(path.join(root, 'version.json'), out);
if (wstale().length) {
  fs.mkdirSync(wdir, { recursive: true });
  if (wnow) fs.writeFileSync(path.join(wdir, version + '.json'), wnow);
  fs.writeFileSync(path.join(wdir, 'index.json'), windex);
  console.log(`wrote whatsnew/ (${wlist.length} releases, newest ${wlist.length ? wlist[0].replace(/\.json$/, '') : 'none'})`);
}
console.log(`wrote version.json (${version}, format ${format}, shell ${n} ${id}, ${list.length} stories${pkgs.length ? `, ${pkgs.length} moved into packages` : ''})` + (stamped !== index ? " and index.html's stamp" : ''));
warn();
