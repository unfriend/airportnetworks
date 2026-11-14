// The release's version file, for live updates (index.html's HOST.live asks for it about once a minute): writes
// version.json at the app's root and stamps the shell's release into index.html (HOST.shell). Run it as the last step of
// a release, after bumping VERSION in sw.js (docs/setup-and-release.md), and commit both files.
// usage (from the repository root): node tools/release.mjs          -> writes version.json (and index.html's stamp)
//                                   node tools/release.mjs --check  -> exits 1 if either is not current, or if
//                                                                      whatsnew.json does not name this release
//                                   --root <dir>: another copy of the app (the live test's)
// version.json: { app, version (sw.js VERSION), format (shared.js FORMAT), shell: { n, id }, list, stories: { <key>:
// { fp, needs } } }. The shell is index.html, shared.js, three.min.js, peerjs.min.js, sfx.js, occlusion.js, ships.js and notes.js; its id is their fingerprint
// (index.html without its stamp and its head's title and link-preview lines, which a running page never shows), and n
// the release in which they last changed (VERSION's number: a new shell needs a new VERSION). sw.js is not part of it:
// the service worker updates itself, and adding a story changes its list of files. list: the fingerprint of the list of
// stories (stories/list.js's STORY_LIST), as the page computes it. Each story (and each page in STORY_EXTRA, such as the
// design room, so live updates reach it too): its file's fingerprint and the oldest shell it needs
// (its entry's own needs, else the shell of the release in which its file last changed). A page compares: another shell
// or format, or a story that needs a newer shell, is asked about (Reload now or Later); a new or changed story is taken.
// The fingerprint is index.html's HOST.fingerprint (and relay/server.mjs's), so the three agree.
// whatsnew.json (developer mode's box, HOST.dev: { version, date, new, test, untested }, lists of short sentences) is
// written by hand at every release; this script only checks it: a file that does not name sw.js's VERSION (or is not in
// that shape) is a warning, and --check fails on it, so a release does not go out with an old box. Each release's file is
// also kept in whatsnew/ (see below), so developer mode can page back through them.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const args = process.argv.slice(2), check = args.includes('--check');
const ri = args.indexOf('--root');
const root = ri >= 0 ? path.resolve(args[ri + 1]) : path.join(path.dirname(new URL(import.meta.url).pathname), '..');
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
if (!Array.isArray(list) || !list.length) fail('stories/list.js gives no STORY_LIST');
const extra = Array.isArray(ctx.self.STORY_EXTRA) ? ctx.self.STORY_EXTRA : [];

const STAMP = /shell: \{ n: \d+, id: '[0-9a-f]*', format: '[^']*' \},/;
const index = read('index.html');
if (!STAMP.test(index)) fail("index.html has no shell stamp (shell: { n: 0, id: '', format: '' }, in HOST)");
const shellText = [
  index.replace(STAMP, 'shell: {},').replace(/^<(title>|meta (name="(description|twitter:[^"]*)"|property="og:[^"]*"))[^\n]*$/gm, ''),
  read('shared.js'), read('three.min.js'), read('peerjs.min.js'), read('sfx.js'), read('occlusion.js'), read('ships.js'), read('notes.js'),
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
const out = JSON.stringify({ app: 'networks', version, format, shell: { n, id }, list: fingerprint(JSON.stringify(list)), stories }, null, 2) + '\n';
const stamped = index.replace(STAMP, `shell: { n: ${n}, id: '${id}', format: '${format}' },`);

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
  const ok = hadOut === out && stamped === index, ws = wstale();
  console.log(ok ? `version.json and index.html's stamp are current (${version}, shell ${n})` :
    `${hadOut !== out ? 'version.json' : "index.html's stamp"} is out of date: run node tools/release.mjs`);
  console.log(ws.length ? `whatsnew/ is out of date (${ws.join(', ')}): run node tools/release.mjs` : `whatsnew/ is current (${wlist.length} releases)`);
  warn();
  process.exit(ok && !news && !ws.length ? 0 : 1);
}
if (stamped !== index) fs.writeFileSync(path.join(root, 'index.html'), stamped);
if (hadOut !== out) fs.writeFileSync(path.join(root, 'version.json'), out);
if (wstale().length) {
  fs.mkdirSync(wdir, { recursive: true });
  if (wnow) fs.writeFileSync(path.join(wdir, version + '.json'), wnow);
  fs.writeFileSync(path.join(wdir, 'index.json'), windex);
  console.log(`wrote whatsnew/ (${wlist.length} releases, newest ${wlist.length ? wlist[0].replace(/\.json$/, '') : 'none'})`);
}
console.log(`wrote version.json (${version}, format ${format}, shell ${n} ${id}, ${list.length} stories)` + (stamped !== index ? " and index.html's stamp" : ''));
warn();
