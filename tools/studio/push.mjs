// node tools/studio/push.mjs <scene folder> <relay> [--as <scene>] [--replace] [--dry]
// One scene folder on this computer sent to a relay that takes uploads (relay/README.md, "Uploading"), exactly as it is:
// nothing converted again (the upload page converts every model it is given; this sends GLBs, sounds and pictures
// already made, for instance by an importer). The scene is made on the relay when it is not there (named after the
// folder, or --as). Exactly the files the relay would list are sent (relay/scenes.mjs's rules: no dot files, no
// temporary files, at most 4 folders deep), each checked by the relay's own upload rules first, then layout.json last,
// so the studio never reads a layout before its files. A file the relay has at the same size is skipped; one that
// differs, and a layout.json the relay already has (perhaps saved in the studio since), is kept there unless
// --replace (the relay copies a replaced layout into the scene's .history/ first). --dry says what it would do and sends
// nothing. Node's own modules only, as the relay.
//
// The password: asked for only when the relay wants one, in this terminal, without showing what is typed (piped
// input: its first line). It goes only into the Authorization header, never into a URL, and is never printed or kept.
// COLLAB_TOKEN in the environment is taken instead of asking (as the relay's own variable), for scripts.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { sceneFiles, uploadPath, newSceneName, LAYOUT } from '../../relay/scenes.mjs';

const argv = process.argv.slice(2), flag = n => argv.includes('--' + n);
const opt = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
const pos = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--as');
const DRY = flag('dry'), REPLACE = flag('replace');
const USAGE = `usage: node tools/studio/push.mjs <scene folder> <relay> [--as <scene>] [--replace] [--dry]
  <relay>     the relay's address, e.g. https://relay.example.org (wss:// works too)
  --as        the scene's name on the relay (default: the folder's name)
  --replace   send files that differ from the relay's, and layout.json over the relay's
  --dry       say what would be sent, send nothing
The password, when the relay wants one, is asked for here (hidden), or taken from COLLAB_TOKEN.`;

const die = msg => { console.error(msg); process.exit(1); };
if (flag('help') || pos.length !== 2) die(USAGE);
const DIR = path.resolve(pos[0]);
const NAME = opt('as') || path.basename(DIR);
let BASE;
try {
  const u = new URL(/^[a-z]+:\/\//i.test(pos[1]) ? pos[1] : 'https://' + pos[1]);
  u.protocol = u.protocol === 'ws:' ? 'http:' : u.protocol === 'wss:' ? 'https:' : u.protocol;
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.search) throw new Error();
  BASE = u.origin + u.pathname.replace(/\/+$/, '');
} catch { die(`not a relay address: ${pos[1]}`); }
if (!fs.statSync(DIR, { throwIfNoEntry: false })?.isDirectory()) die(`no such folder: ${DIR}`);
if (!newSceneName(NAME)) die(`"${NAME}" cannot be a scene's name: letters, digits, spaces, _ . - (up to 64, not starting with a space, . or -, not ending in a space or .)`);

const MB = n => (n / (1 << 20)).toFixed(1) + ' MB';
const enc = encodeURIComponent;
let TOKEN = process.env.COLLAB_TOKEN || '';

function hidden(question) {
  process.stderr.write(question);
  const stdin = process.stdin;
  if (!stdin.isTTY) {   // piped: the first line
    const rl = readline.createInterface({ input: stdin });
    return new Promise(resolve => rl.once('line', l => { rl.close(); process.stderr.write('\n'); resolve(l.trim()); }));
  }
  return new Promise(resolve => {
    let s = '';
    const done = () => { stdin.removeListener('data', on); stdin.setRawMode(false); stdin.pause(); process.stderr.write('\n'); };
    const on = chunk => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') { done(); return resolve(s); }
        if (c === '\u0003') { done(); process.exit(130); }          // Ctrl+C
        if (c === '\u007f' || c === '\b') s = s.slice(0, -1); else if (c >= ' ') s += c;
      }
    };
    stdin.setRawMode(true); stdin.setEncoding('utf8'); stdin.resume(); stdin.on('data', on);
  });
}

// a request to the relay; asks for the password once on the first 401
async function call(method, rel, body, type) {
  for (let tries = 0; ; tries++) {
    const headers = {};
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    if (type) headers['Content-Type'] = type;
    let res;
    try {
      res = await fetch(BASE + rel, { method, headers, body });   // (a Blob or a string: either can be sent again)
    } catch (e) { die(`could not reach ${BASE}: ${e.cause?.code || e.cause?.errors?.[0]?.code || e.cause?.message || e.message}`); }
    if (res.status === 401 && tries === 0) {
      if (TOKEN) die('That is not this relay\'s password (COLLAB_TOKEN).');
      TOKEN = await hidden('This relay needs its password: ');
      if (!TOKEN) die('No password given.');
      continue;
    }
    if (res.status === 401) die('That is not this relay\'s password.');
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  }
}
const why = r => r.json?.error || `${r.status} ${r.text.slice(0, 120)}`;

const local = await sceneFiles(DIR);
const files = [], refused = [];
for (const f of local.files) {
  const u = uploadPath(f.path);
  if (u.error) refused.push(`${f.path}: ${u.error}`); else files.push(f);
}
const layoutFile = local.layout ? path.join(DIR, LAYOUT) : null;

const list = await call('GET', '/api/scenes');
if (list.status !== 200 || !list.json) die(`${BASE} answered ${why(list)} for its scenes: is it a relay with --scenes?`);
if (!list.json.upload) die(`${BASE} takes no uploads (--scenes-readonly).`);
const maxUpload = list.json.maxUpload || Infinity;
const there = (list.json.scenes || []).find(s => s.name === NAME);

let remote = new Map(), remoteLayout = false;
if (there) {
  const r = await call('GET', `/api/scenes/${enc(NAME)}`);
  if (r.status !== 200) die(`could not list ${NAME} there: ${why(r)}`);
  for (const f of r.json.files || []) remote.set(f.path, f.bytes);
  remoteLayout = r.json.layoutAt != null;
}

const send = [], same = [], differ = [], big = [];
for (const f of files) {
  if (f.bytes > maxUpload) big.push(f);
  else if (!remote.has(f.path)) send.push(f);
  else if (remote.get(f.path) === f.bytes) same.push(f);
  else if (REPLACE) send.push({ ...f, replace: true });
  else differ.push(f);
}
const layoutGo = layoutFile && (!remoteLayout || REPLACE);

console.log(`${DIR} -> ${BASE}, scene "${NAME}" (${there ? 'there already' : 'new'})`);
console.log(`  ${send.length} to send (${MB(send.reduce((n, f) => n + f.bytes, 0))}), ${same.length} the same there, ` +
  `${differ.length} different there (kept${differ.length ? '; --replace sends them' : ''})` +
  (layoutFile ? `, layout.json ${layoutGo ? (remoteLayout ? 'replaces the relay\'s' : 'sent last') : 'kept: the relay has one (--replace sends yours)'}` : ', no layout.json'));
for (const f of differ) console.log(`  different there, kept: ${f.path}`);
for (const f of big) console.log(`  too big for this relay (${MB(f.bytes)}, at most ${MB(maxUpload)}): ${f.path}`);
for (const r of refused) console.log(`  not sent, the relay would refuse it: ${r}`);
if (DRY) { for (const f of send) console.log(`  would send ${f.path} (${MB(f.bytes)})${f.replace ? ', replacing' : ''}`); process.exit(0); }

if (!there) {
  const r = await call('POST', '/api/scenes', JSON.stringify({ name: NAME }), 'application/json');
  if (r.status !== 201) die(`could not make the scene ${NAME}: ${why(r)}`);
  console.log(`  made the scene ${NAME}`);
}

let failed = 0, n = 0;
for (const f of send) {
  n++;
  const t0 = Date.now();
  const label = `  ${n}/${send.length} ${f.path} (${MB(f.bytes)})`;
  const body = fs.openAsBlob ? await fs.openAsBlob(path.join(DIR, ...f.path.split('/'))) : fs.readFileSync(path.join(DIR, ...f.path.split('/')));
  const r = await call('POST', `/api/scenes/${enc(NAME)}/file?path=${enc(f.path)}${f.replace ? '&replace=1' : ''}`, body, 'application/octet-stream');
  if (r.status === 200) console.log(`${label} sent in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  else { failed++; console.log(`${label} FAILED: ${why(r)}`); if (r.status === 507) die('The relay is full (507); stopped.'); }
}

if (layoutGo && !failed) {
  const r = await call('POST', `/api/scenes/${enc(NAME)}/layout`, fs.readFileSync(layoutFile, 'utf8'), 'application/json');
  if (r.status === 200) console.log(`  layout.json sent${remoteLayout ? ' (the relay kept its old one in .history/)' : ''}`);
  else { failed++; console.log(`  layout.json FAILED: ${why(r)}`); }
} else if (layoutGo) console.log('  layout.json not sent, since files failed: run it again to send what is missing');

console.log(failed ? `${failed} failed` : `done: open the studio there and pick "${NAME}"`);
process.exit(failed ? 1 : 0);
