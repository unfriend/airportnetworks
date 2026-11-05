// node tools/studio/r2sync.mjs list
// node tools/studio/r2sync.mjs pull <scene|--all> <folder> [--dry] [--delete] [--history]
// node tools/studio/r2sync.mjs push <folder> [<scene>|--all] [--dry] [--delete] [--history]
// The studio's scenes between a Cloudflare R2 bucket and a folder of scenes (relay/README.md, "Scenes in Cloudflare R2"):
// pull them onto a laptop before an event (then node relay/server.mjs --lan --scenes <folder> serves them with no
// internet), push a folder back, or list what the bucket holds. The bucket and its keys come from the environment, as
// for the relay (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET; R2_PREFIX, R2_JURISDICTION,
// R2_ENDPOINT), never from the command line. Exactly the files the relay lists are moved (relay/scenes.mjs's rules, the
// same for a folder and the bucket), and each scene's layout.json; .history/ only with --history. A file is copied only
// when it differs: by size, then by MD5 where the bucket's ETag is one (an object put whole), else by its time (a pulled
// file takes the object's time). Nothing is deleted unless --delete is given (and then only listed files, and .history/
// with --history); --dry says what it would do and changes nothing. Node's own modules only, as the relay.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { R2, r2Config, md5File } from '../../relay/r2.mjs';
import { allScenes, scenesOf, sceneDir, sceneFiles, validName, typeOf, LAYOUT, MARKER } from '../../relay/scenes.mjs';

const argv = process.argv.slice(2), flag = n => argv.includes('--' + n), pos = argv.filter(a => !a.startsWith('--'));
const DRY = flag('dry'), DEL = flag('delete'), HIST = flag('history'), ALL = flag('all');
const USAGE = `usage: node tools/studio/r2sync.mjs list
       node tools/studio/r2sync.mjs pull <scene|--all> <folder> [--dry] [--delete] [--history]
       node tools/studio/r2sync.mjs push <folder> [<scene>|--all] [--dry] [--delete] [--history]
The bucket from the environment: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (and R2_PREFIX,
R2_JURISDICTION, R2_ENDPOINT), as for the relay's --scenes r2 (relay/README.md, "Scenes in Cloudflare R2").`;
const bad = text => { console.log(text); process.exit(1); };
const known = new Set(['dry', 'delete', 'history', 'all']);
if (!['list', 'pull', 'push'].includes(pos[0]) || argv.some(a => a.startsWith('--') && !known.has(a.slice(2)))) bad(USAGE);
const cfg = r2Config(process.env);
if (cfg.error) bad('r2sync: ' + cfg.error);
const r2 = new R2(cfg), P = cfg.prefix;
const mb = n => (n < 1e6 ? (n / 1e3).toFixed(1) + ' kB' : (n / 1e6).toFixed(1) + ' MB');
const isMd5 = e => /^[0-9a-f]{32}$/.test(e);
const histRel = rel => /^\.history\/layout-[^/]+\.json$/.test(rel);
let did = { get: 0, put: 0, same: 0, del: 0, bytes: 0 };

// the bucket's scenes (as the relay lists them) and, per scene, every object under it by its path in the scene
async function bucket() {
  let all;
  try { all = await r2.listAll(P, { limit: 200000 }); } catch (err) { bad(`r2sync: ${err.message} (check the R2_* settings: relay/README.md, "Scenes in Cloudflare R2")`); }
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
    const dir = path.join(root, s.name), want = wantedRemote(s, objs.get(s.name) || new Map());
    if (!DRY) fs.mkdirSync(dir, { recursive: true });
    for (const [rel, o] of want) {
      const file = path.join(dir, ...rel.split('/'));
      let local = null;
      try { const st = fs.statSync(file); if (st.isFile()) local = { size: st.size, at: Math.floor(st.mtimeMs) }; } catch { /* none here */ }
      if (await same(file, local, o, 'here')) { did.same++; continue; }
      console.log(`${DRY ? 'would get' : 'get'} ${s.name}/${rel} (${mb(o.size)})`);
      did.get++; did.bytes += o.size;
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
      for (const rel of here.keys()) if (!want.has(rel)) {
        console.log(`${DRY ? 'would delete' : 'delete'} ${s.name}/${rel} (here; not in the bucket)`);
        did.del++;
        if (!DRY) fs.rmSync(path.join(dir, ...rel.split('/')), { force: true });
      }
    }
  }
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
      if (await same(file, l, there.get(rel), 'bucket')) { did.same++; continue; }
      if (l.size > 5 * 1024 ** 3) { console.log(`skipped ${s.name}/${rel}: over 5 GB, more than one upload may be`); continue; }
      console.log(`${DRY ? 'would put' : 'put'} ${s.name}/${rel} (${mb(l.size)})`);
      did.put++; did.bytes += l.size;
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
  if (pos[0] !== 'list') console.log(`${DRY ? 'dry run: ' : ''}${pos[0] === 'pull' ? did.get + ' fetched' : did.put + ' put'} (${mb(did.bytes)}), ${did.same} the same${did.del ? `, ${did.del} deleted` : ''}`);
} catch (err) { bad('r2sync: ' + err.message); }
