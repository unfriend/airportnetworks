// node tools/studio/r2sync.mjs list
// node tools/studio/r2sync.mjs pull <scene|--all> <folder> [--dry] [--delete] [--history] [--force]
// node tools/studio/r2sync.mjs push <folder> [<scene>|--all] [--dry] [--delete] [--history] [--force]
// The studio's scenes between a Cloudflare R2 bucket and a folder of scenes (relay/README.md, "Scenes in Cloudflare R2"):
// pull them onto a laptop before an event (then node relay/server.mjs --lan --scenes <folder> serves them with no
// internet), push a folder back, or list what the bucket holds. The bucket and its keys come from the environment, as
// for the relay (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET; R2_PREFIX, R2_JURISDICTION,
// R2_ENDPOINT), never from the command line. Exactly the files the relay lists are moved (relay/scenes.mjs's rules, the
// same for a folder and the bucket), and each scene's layout.json; .history/ only with --history. A file is copied only
// when it differs: by size, then by MD5 where the bucket's ETag is one (an object put whole), else by its time (a pulled
// file takes the object's time). A file that differs goes only from the newer side: one newer where it would go (saved
// there since, such as a layout saved by the relay on the laptop or by the one on the server) is kept and said, unless
// --force. A layout.json replaced on either side is first copied into that side's .history/ (the newest 20 kept there),
// as the relay keeps one it saves over. Nothing is deleted unless --delete is given (and then only listed files, and
// .history/ with --history); --dry says what it would do and changes nothing. Node's own modules only, as the relay.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { R2, r2Config, md5File } from '../../relay/r2.mjs';
import { allScenes, scenesOf, sceneDir, sceneFiles, validName, typeOf, LAYOUT, MARKER } from '../../relay/scenes.mjs';

const argv = process.argv.slice(2), flag = n => argv.includes('--' + n), pos = argv.filter(a => !a.startsWith('--'));
const DRY = flag('dry'), DEL = flag('delete'), HIST = flag('history'), ALL = flag('all'), FORCE = flag('force');
const USAGE = `usage: node tools/studio/r2sync.mjs list
       node tools/studio/r2sync.mjs pull <scene|--all> <folder> [--dry] [--delete] [--history] [--force]
       node tools/studio/r2sync.mjs push <folder> [<scene>|--all] [--dry] [--delete] [--history] [--force]
A file newer where it would go is kept there (and said) unless --force; a layout.json replaced is first copied into
that side's .history/.
The bucket from the environment: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (and R2_PREFIX,
R2_JURISDICTION, R2_ENDPOINT), as for the relay's --scenes r2 (relay/README.md, "Scenes in Cloudflare R2").`;
const bad = text => { console.log(text); process.exit(1); };
const known = new Set(['dry', 'delete', 'history', 'all', 'force']);
if (!['list', 'pull', 'push'].includes(pos[0]) || argv.some(a => a.startsWith('--') && !known.has(a.slice(2)))) bad(USAGE);
const cfg = r2Config(process.env);
if (cfg.error) bad('r2sync: ' + cfg.error);
const r2 = new R2(cfg), P = cfg.prefix;
const mb = n => (n < 1e6 ? (n / 1e3).toFixed(1) + ' kB' : (n / 1e6).toFixed(1) + ' MB');
const isMd5 = e => /^[0-9a-f]{32}$/.test(e);
// (the relay's developer notes live under .notes/ beside the scenes: a dot name is never a scene, so scenesOf and allScenes leave
// them out, silently, and a sync never moves them)
const histRel = rel => /^\.history\/layout-[^/]+\.json$/.test(rel);
let did = { get: 0, put: 0, same: 0, del: 0, bytes: 0, kept: 0 };
const HISTORY = 20;   // (as the relay: the newest 20 copies of a layout kept in .history/)
const histName = () => `layout-${new Date().toISOString().replace(/:/g, '-')}.json`;
const when = ms => new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
// a file that differs, newer where it would go (by more than a second): kept there, and said, unless --force
function newerThere(scene, rel, srcAt, dstAt, there) {
  if (FORCE || !(dstAt > srcAt + 1000)) return false;
  console.log(`kept ${scene}/${rel} ${there}: it is newer there (${when(dstAt)}) than the copy it would be replaced by (${when(srcAt)}); --force replaces it`);
  did.kept++;
  return true;
}

// the bucket's scenes (as the relay lists them) and, per scene, every object under it by its path in the scene
async function bucket() {
  let all;
  try { all = await r2.listAll(P, { limit: 200000, skip: P + '.notes/' }); } catch (err) { bad(`r2sync: ${err.message} (check the R2_* settings: relay/README.md, "Scenes in Cloudflare R2")`); }
  const scenes = scenesOf(all.keys, P, n => console.log(`left out ${JSON.stringify(n)}: not a scene's name`)), objs = new Map();
  for (const o of all.keys) {
    const rest = o.key.slice(P.length), i = rest.indexOf('/');
    if (i <= 0) continue;
    const name = rest.slice(0, i);
    if (!objs.has(name)) objs.set(name, new Map());
    objs.get(name).set(rest.slice(i + 1), o);
  }
  return { scenes, objs };
}
// what is moved of a scene on one side: { rel: { size, at, etag? } } (its listed files, layout.json, .history with --history)
function wantedRemote(s, objs) {
  const out = new Map();
  for (const f of s.files) out.set(f.path, objs.get(f.path));
  if (s.layout) out.set(LAYOUT, objs.get(LAYOUT));
  if (HIST) for (const [rel, o] of objs) if (histRel(rel)) out.set(rel, o);
  return out;
}
const histFiles = dir => { try { return fs.readdirSync(path.join(dir, '.history'), { withFileTypes: true }).filter(e => e.isFile() && histRel('.history/' + e.name)).map(e => e.name); } catch { return []; } };
// the same file on both sides? by size, then MD5 (when the ETag is one), else by time (the side it goes to no older:
// to: 'here' for a pull, 'bucket' for a push)
async function same(file, local, remote, to) {
  if (!local || !remote || local.size !== remote.size) return false;
  if (isMd5(remote.etag)) return (await md5File(file)) === remote.etag;
  return Math.abs(local.at - remote.at) < 1000 || (to === 'here' ? local.at >= remote.at : remote.at >= local.at);
}

async function list() {
  const { scenes } = await bucket();
  console.log(`${scenes.length} scene${scenes.length === 1 ? '' : 's'} in the bucket ${cfg.bucket}${P ? ' (under ' + P + ')' : ''}`);
  for (const s of scenes) console.log(`  ${s.name}: ${s.files.length} file${s.files.length === 1 ? '' : 's'}, ${mb(s.files.reduce((n, f) => n + f.bytes, 0))}${s.layout ? ', layout.json' : ''}`);
}

async function pull(which, folder) {
  const root = path.resolve(folder);
  if (!DRY) fs.mkdirSync(root, { recursive: true });
  const { scenes, objs } = await bucket(), pick = ALL ? scenes : scenes.filter(s => s.name === which);
  if (!pick.length) bad(ALL ? 'r2sync: the bucket holds no scenes' : `r2sync: no scene ${JSON.stringify(which)} in the bucket (node tools/studio/r2sync.mjs list)`);
  for (const s of pick) {
    const dir = path.join(root, s.name), want = wantedRemote(s, objs.get(s.name) || new Map()), kept = new Set();
    if (!DRY) fs.mkdirSync(dir, { recursive: true });
    for (const [rel, o] of want) {
      const file = path.join(dir, ...rel.split('/'));
      let local = null;
      try { const st = fs.statSync(file); if (st.isFile()) local = { size: st.size, at: Math.floor(st.mtimeMs) }; } catch { /* none here */ }
      if (await same(file, local, o, 'here')) { did.same++; continue; }
      if (local && newerThere(s.name, rel, o.at, local.at, 'here')) continue;
      console.log(`${DRY ? 'would get' : 'get'} ${s.name}/${rel} (${mb(o.size)})`);
      did.get++; did.bytes += o.size;
      // (the layout here kept first in .history/, as the relay keeps one it saves over)
      if (local && rel === LAYOUT) { console.log(`  ${DRY ? 'would keep' : 'kept'} the old ${s.name}/layout.json here in .history/`); if (!DRY) kept.add(keepHere(dir)); }
      if (DRY) continue;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = path.join(path.dirname(file), `.r2sync-${crypto.randomBytes(5).toString('hex')}.tmp`);
      try {
        const g = await r2.getFile(o.key, tmp);
        if (!g) { console.log(`  (gone from the bucket meanwhile)`); continue; }
        fs.renameSync(tmp, file);
        fs.utimesSync(file, new Date(), (o.at + 0.5) / 1000);   // (the object's time, to the ms: the next pull sees it the same)
      } finally { fs.rmSync(tmp, { force: true }); }
    }
    if (DEL) {
      const here = await localOf(dir);
      for (const rel of here.keys()) if (!want.has(rel) && !kept.has(rel)) {   // (never the copy just kept)
        console.log(`${DRY ? 'would delete' : 'delete'} ${s.name}/${rel} (here; not in the bucket)`);
        did.del++;
        if (!DRY) fs.rmSync(path.join(dir, ...rel.split('/')), { force: true });
      }
    }
  }
}
// a scene's layout.json here copied into its .history/ (never over one there; the newest 20 kept)
function keepHere(dir) {
  const h = path.join(dir, '.history');
  fs.mkdirSync(h, { recursive: true });
  let n;
  for (let i = 0; ; i++) {
    n = i ? histName().replace(/\.json$/, `-${i}.json`) : histName();
    try { fs.copyFileSync(path.join(dir, LAYOUT), path.join(h, n), fs.constants.COPYFILE_EXCL); break; } catch (err) { if (err.code !== 'EEXIST' || i > 50) throw err; }
  }
  const kept = histFiles(dir).sort();
  for (const x of kept.slice(0, Math.max(0, kept.length - HISTORY))) fs.rmSync(path.join(h, x), { force: true });
  return '.history/' + n;
}
// the bucket's layout.json of a scene copied into its .history/ there (the newest 20 kept)
async function keepThere(scene) {
  const base = P + scene + '/', h = base + '.history/' + histName();
  await r2.copy(base + LAYOUT, h);
  const kept = (await r2.listAll(base + '.history/')).keys.map(o => o.key).filter(k => histRel(k.slice(base.length))).sort();
  if (kept.length > HISTORY) await r2.delMany(kept.slice(0, kept.length - HISTORY));
}
// a scene's files on this computer that a sync moves: its listed files, layout.json, .history/ with --history
async function localOf(dir) {
  const s = await sceneFiles(dir), out = new Map();
  for (const f of s.files) out.set(f.path, { size: f.bytes, at: f.at });
  if (s.layout) out.set(LAYOUT, { size: s.layout.size, at: Math.floor(s.layout.mtimeMs) });
  if (HIST) for (const n of histFiles(dir)) { const st = fs.statSync(path.join(dir, '.history', n)); out.set('.history/' + n, { size: st.size, at: Math.floor(st.mtimeMs) }); }
  return out;
}

async function push(folder, which) {
  const root = path.resolve(folder);
  let real = '';
  try { real = fs.realpathSync(root); if (!fs.statSync(real).isDirectory()) real = ''; } catch { /* said below */ }
  if (!real) bad(`r2sync: there is no folder ${root}`);
  const locals = await allScenes(real, n => console.log(`left out the folder ${JSON.stringify(n)}: not a scene's name`));
  const pick = ALL || !which ? locals : locals.filter(s => s.name === which);
  if (!pick.length) bad(which && !ALL ? `r2sync: no scene ${JSON.stringify(which)} in ${root}` : `r2sync: no scenes in ${root}`);
  const { objs } = await bucket();
  for (const s of pick) {
    const dir = await sceneDir(real, s.name), here = await localOf(dir), there = objs.get(s.name) || new Map();
    for (const [rel, l] of here) {
      const file = path.join(dir, ...rel.split('/'));
      const o = there.get(rel);
      if (await same(file, l, o, 'bucket')) { did.same++; continue; }
      if (o && newerThere(s.name, rel, l.at, o.at, 'in the bucket')) continue;
      if (l.size > 5 * 1024 ** 3) { console.log(`skipped ${s.name}/${rel}: over 5 GB, more than one upload may be`); continue; }
      console.log(`${DRY ? 'would put' : 'put'} ${s.name}/${rel} (${mb(l.size)})`);
      did.put++; did.bytes += l.size;
      // (the bucket's layout kept first in its .history/, as the relay keeps one it saves over)
      if (o && rel === LAYOUT) { console.log(`  ${DRY ? 'would keep' : 'kept'} the bucket's old ${s.name}/layout.json in its .history/`); if (!DRY) await keepThere(s.name); }
      if (!DRY) await r2.put(P + s.name + '/' + rel, { path: file, size: fs.statSync(file).size }, { type: rel === LAYOUT || histRel(rel) ? 'application/json' : typeOf(rel) });
    }
    // (an empty scene keeps a hidden marker in the bucket, as the relay makes one)
    if (!here.size && !there.size) { console.log(`${DRY ? 'would make' : 'make'} the empty scene ${s.name}`); if (!DRY) await r2.put(P + s.name + '/' + MARKER, Buffer.alloc(0)); }
    if (DEL) {
      const listed = new Map([...wantedRemote(scenesOf([...there.values()], P)[0] || { files: [], layout: null }, there)]);
      const gone = [...listed.keys()].filter(rel => !here.has(rel));
      for (const rel of gone) console.log(`${DRY ? 'would delete' : 'delete'} ${s.name}/${rel} (in the bucket; not here)`);
      did.del += gone.length;
      if (!DRY && gone.length) await r2.delMany(gone.map(rel => P + s.name + '/' + rel));
    }
  }
}

try {
  if (pos[0] === 'list') await list();
  else if (pos[0] === 'pull') {
    const which = ALL ? '' : pos[1], folder = ALL ? pos[1] : pos[2];
    if (!folder || (!ALL && !validName(which))) bad(USAGE);
    await pull(which, folder);
  } else {
    const folder = pos[1], which = pos[2] || '';
    if (!folder || (which && !validName(which)) || (!which && !ALL)) bad(USAGE);
    await push(folder, which);
  }
  if (pos[0] !== 'list') console.log(`${DRY ? 'dry run: ' : ''}${pos[0] === 'pull' ? did.get + ' fetched' : did.put + ' put'} (${mb(did.bytes)}), ${did.same} the same${did.del ? `, ${did.del} deleted` : ''}` +
    (did.kept ? `, ${did.kept} kept as ${did.kept === 1 ? 'it is' : 'they are'} (newer where ${did.kept === 1 ? 'it' : 'they'} would go: --force replaces ${did.kept === 1 ? 'it' : 'them'})` : ''));
} catch (err) { bad('r2sync: ' + err.message); }
