// The relay for shared rooms (docs/shared-space-plan.md, section 3; protocol in relay/README.md).
// Rooms with 3-letter codes, a key -> { v, seq, by } map per room (every stored write gets the
// room's next seq: last writer wins), ephemeral messages that are never stored, and members.
// Node 18 or newer and no packages: its own minimal WebSocket code (RFC 6455). It can serve the
// app as well (--static), so the page and the relay share one address. It is also an introduction server for
// devices that link to each other directly (PeerJS's server protocol, at /peerjs; --no-peer turns it off).
//   node relay/server.mjs [--port 8787] [--host 0.0.0.0] [--cert c.pem --key k.pem] [--static .] [--logs dir] [--proxy [n]]
//   node relay/server.mjs --lan    (for headsets on the same Wi-Fi: HTTPS with a certificate of its own, the app
//                                   served, the headsets' logs kept in relay/logs/)
//   node relay/server.mjs --static . --watch [--build]   (while developing: the pages follow the app's files)
//   node relay/server.mjs --port 8787 --static . --proxy 1 --public   (on a public server behind a reverse proxy, Coolify:
//                                   only the app's pages may connect, no open-room list and no names, limits per address)
//   COLLAB_TOKEN=<word> node relay/server.mjs ...   (or --token <word>: a shared password every client must bring, as
//                                   asdf10k-collab-backend's COLLAB_TOKEN; COLLAB_PORT and COLLAB_HOST as there too)
//   node relay/server.mjs --lan --scenes <dir>   (the studio's scenes: models, textures, sounds and layout.json, one
//                                   subfolder each, served and their layouts saved; tools/studio/SPEC.md; files uploaded
//                                   from the studio's Upload pane, at /upload, long sounds made MP3 by ffmpeg when found)
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... node relay/server.mjs --scenes r2
//                                   (the same, the scenes kept in a Cloudflare R2 bucket: relay/README.md, "Scenes in
//                                   Cloudflare R2"; pages download and upload their files straight from and to it)
//   node relay/server.mjs --lan --trackers   (on the Windows PC with SteamVR: the Vive trackers' poses from
//                                   tools/trackers/bridge.py, on UDP 127.0.0.1:47800, sent to the rooms that use them in
//                                   room coordinates; relay/trackers.mjs, tools/trackers/SPEC.md)
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import os from 'node:os';
import { execFileSync, execFile, spawn } from 'node:child_process';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { allScenes, sceneDir, sceneFiles, fileOut, summary, layoutAt, readLayout, isLayout, layoutText, validName, inside, kindOf, kindAt,
  uploadPath, newSceneName, MAX_DEPTH, MAX_FILES, MAX_LAYOUT, MAX_SCENES, MAX_PATH, LAYOUT, LISTING, SCENE_TYPES, typeOf, listable, scenesOf, MARKER, isRecording } from './scenes.mjs';
import { R2, R2Error, r2Config } from './r2.mjs';
import { makeTrackers, TRK_PORT } from './trackers.mjs';

const PROTO = 1;
const OPT = { port: 8787, host: '0.0.0.0', cert: '', key: '', static: '', timeout: 40, expire: 6 * 3600, ping: 20, quiet: false, lan: false, logs: '', 'no-peer': false, watch: '', build: false, proxy: 0,
  // a public server (--public, or each rule on its own; -1: not given, so --public's default or off)
  public: false, origin: [], 'allow-no-origin': false, unlisted: false, guesses: -1, creates: -1, sockets: -1, store: -1, 'log-token': '',
  token: '',
  // the studio's scenes (--scenes <dir>; --scenes-readonly: never written); uploads to them (MB), the app /upload sends
  // people to when the relay does not serve it, and ffmpeg for long sounds (its path, off, a conversion's limit in s)
  scenes: '', 'scenes-readonly': false, 'max-upload': 512, app: '', ffmpeg: '', 'no-ffmpeg': false, 'ffmpeg-limit': 180,
  // --scenes r2: the bucket's settings from the environment (R2_*); --r2-check: check them, the bucket's CORS and its
  // upload links, then stop
  'r2-check': false,
  // --trackers [port]: the Vive trackers' bridge on UDP 127.0.0.1 (47800 when no port is given; 0 picks a free one);
  // -1: off
  trackers: -1,
  // --keep <file>: every room written there (atomically, every 5 s when changed and as the relay stops) and read back as
  // it starts, so a restart (a deploy) no longer empties the rooms; '' none (as ever: rooms in memory only)
  keep: '' };
// the environment first (asdf10k-collab-backend's names: COLLAB_* only, since shells and conda set PORT and HOST), the
// command's flags and RELAY_ARGS over it
{
  const e = process.env, port = String(e.COLLAB_PORT || '').trim();
  if (port) { if (/^\d+$/.test(port) && +port < 65536) OPT.port = +port; else console.log(`COLLAB_PORT="${port}" is not a port: using ${OPT.port}`); }
  if (String(e.COLLAB_HOST || '').trim()) OPT.host = String(e.COLLAB_HOST).trim();
  OPT.token = String(e.COLLAB_TOKEN || '').trim();
  OPT.scenes = String(e.COLLAB_SCENES || '').trim();
}
const APP_ORIGIN = 'https://stories.lbi-netmed.com';   // where the app lives (GitHub Pages): --public's origin unless --origin says
const HELP = `usage: node relay/server.mjs [options]
  --port <n>       port (8787; 0 picks a free one)       --host <addr>   address (0.0.0.0)
  --cert <file>    with --key: speak HTTPS and WSS       --static <dir>  also serve the app from <dir>
  --timeout <s>    a silent member is dropped (40)       --expire <s>    a room without members goes (21600)
  --ping <s>       WebSocket ping to every member (20)   --quiet         no log lines
  --logs <dir>     keep the logs headsets send (their room alignment, one JSON line per entry) in <dir>
  --no-peer        no introduction server for peer to peer (PeerJS's protocol, at /peerjs: on by default)
  --proxy [<n>]    behind n reverse proxies (1 when no number is given: Coolify's or nginx alone; 2 with a CDN such
                   as Cloudflare in front of it): a client's address is the n-th from the right in X-Forwarded-For
                   (rooms on this network; without it the header is ignored)
  --lan            for headsets on the same Wi-Fi: HTTPS with a self-signed certificate made once with openssl for
                   this machine's addresses (in relay/.lan/), the app served from the repository, and the headsets'
                   logs kept in relay/logs/
  --watch [<dir>]  while developing: watch the app's files (the --static folder, or <dir>, then also served); the
                   pages it serves swap a changed story in place and reload, their place kept, when a shell file changes
  --build          with --watch: run a built story's build (tools/<key>/build.mjs) when its sources change
  --scenes <dir>   the studio's scenes (or COLLAB_SCENES): each subfolder of <dir> is one scene (models, their textures,
                   sounds, layout.json), listed at /api/scenes, its files at /scenes/<name>/<file>, its layout saved
                   there by the studio (the old one kept in its .history/, the newest 20); with a password, they need it
  --scenes r2      the same, kept in a Cloudflare R2 bucket: its settings only from the environment (R2_ACCOUNT_ID,
                   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET; optional R2_PREFIX, R2_JURISDICTION, R2_LINK_TTL,
                   R2_POLL, R2_ENDPOINT); pages download and upload the files straight from and to it by signed links
  --r2-check       with --scenes r2: check the settings, the keys, the bucket's CORS rule and upload links, say what is
                   wrong, and stop
  --scenes-readonly  with --scenes: layouts are never written (the studio offers Download instead), nothing uploaded
  --max-upload <MB>  with --scenes: one uploaded file at most this big (512)
  --ffmpeg <path>  with --scenes: the ffmpeg that makes long sounds MP3 (found on the PATH by itself; --no-ffmpeg: none)
  --ffmpeg-limit <s>  one conversion may take this long (180)
  --app <url>      where /upload sends people when the relay does not serve the app (the --origin, else ${APP_ORIGIN}/)
  --keep <file>    keep the rooms in <file> (written every 5 s when they changed and as the relay stops, read back as it
                   starts): a restart, such as a deploy, no longer empties them (off: rooms live in memory only)
  --trackers [<port>]  the PC's Vive trackers: take tools/trackers/bridge.py's readings on UDP 127.0.0.1:<port> (${TRK_PORT};
                   0 picks a free one), list them at /api/trackers and send them, lined up, to the rooms that use them
On a public server (each is off unless given, and --public turns on all of them with the defaults in brackets):
  --public         --origin ${APP_ORIGIN}, --unlisted, --guesses 30, --creates 10, --sockets 64, --store 64,
                   --logs only with a token, and --scenes only with a password
  --origin <list>  only pages from these origins (comma separated, may be repeated) and the relay's own pages may open
                   a socket or read the API (CORS for them alone; other origins 403)
  --allow-no-origin  with --origin or --public: also sockets that send no Origin (not a browser: tools, scripts)
  --unlisted       no list of open rooms (GET /api/rooms answers []) and no member's name in any answer or log line
  --guesses <n>    per address, at most n lookups a minute of room codes that do not exist (a burst of 2n), then 429
  --creates <n>    per address, at most n new rooms a minute (a burst of 2n), then 429
  --sockets <n>    per address, at most n open sockets (rooms and the introduction server together)
  --store <MB>     all rooms' keys and values together at most this many MB (as JSON); a write past it is refused
  --log-token <t>  POST /api/log needs the header X-Log-Token: <t> (or set RELAY_LOG_TOKEN in the environment rather
                   than putting it in the command; --public with --logs needs one)
A shared password (as asdf10k-collab-backend's COLLAB_TOKEN; off unless given):
  --token <t>      every client must bring it: the API (all but GET /api/health) as Authorization: Bearer <t> or ?token=,
                   the room's socket and /api/watch as ?token=, the introduction server as PeerJS's key. Better set
                   COLLAB_TOKEN in the environment than put it in a command. None or a wrong one: 401 (a socket: close
                   4401); 20 failures a minute from one address (a wrong password, an unknown room code), then 429 (4429)
The environment: RELAY_ARGS adds options after the command's own (RELAY_ARGS="--proxy 1 --public"); COLLAB_TOKEN,
COLLAB_PORT, COLLAB_HOST and COLLAB_SCENES set --token, --port, --host and --scenes (the flags win).`;
// the options: the command's, then RELAY_ARGS's (the environment's: Coolify sets it, so its start command needs no change)
// (quote marks round the whole value or a word are dropped: a shell's habit typed into a settings field, as
// RELAY_ARGS="--proxy 1 --public" read off a page, left the relay printing its usage and stopping, a 502 behind Coolify)
const unquote = s => s.replace(/^(['"])([\s\S]*)\1$/, '$2');
const ARGV = [...process.argv.slice(2), ...unquote(String(process.env.RELAY_ARGS || '').trim()).trim().split(/\s+/).map(unquote).filter(Boolean)];
for (let i = 0; i < ARGV.length; i++) {
  const name = ARGV[i].replace(/^--/, '');
  if (name === 'help' || !(name in OPT) || name === ARGV[i]) { console.log(HELP); process.exit(name === 'help' ? 0 : 1); }
  if (name === 'watch') { const v = ARGV[i + 1]; if (v !== undefined && !v.startsWith('--')) { OPT.watch = v; i++; } else OPT.watch = true; continue; }
  if (name === 'proxy') { const v = ARGV[i + 1]; if (v !== undefined && /^\d+$/.test(v)) { OPT.proxy = +v; i++; } else OPT.proxy = 1; continue; }
  if (name === 'trackers') { const v = ARGV[i + 1]; if (v !== undefined && /^\d+$/.test(v) && +v < 65536) { OPT.trackers = +v; i++; } else OPT.trackers = TRK_PORT; continue; }
  if (name === 'origin') { const v = ARGV[++i]; if (v === undefined) { console.log(HELP); process.exit(1); } OPT.origin.push(...v.split(',')); continue; }
  if (typeof OPT[name] === 'boolean') { OPT[name] = true; continue; }
  const v = ARGV[++i];
  OPT[name] = typeof OPT[name] === 'number' ? Number(v) : v;
  if (v === undefined || (typeof OPT[name] === 'number' && !(OPT[name] >= 0))) { console.log(HELP); process.exit(1); }
}
if (!OPT.cert !== !OPT.key) { console.log('--cert and --key go together'); process.exit(1); }
const TOKEN = String(OPT.token || '').trim();   // '' none: no password asked (as ever)
const PEER = !OPT['no-peer'];
// --trackers: the bridge's readings (relay/trackers.mjs); null: none of it (no socket, no endpoint, no @trk)
const TRK = OPT.trackers >= 0 ? makeTrackers({ port: OPT.trackers, log: (...a) => log(...a) }) : null;

// ---- a public server (--public; each rule also on its own). On a laptop at an event none of this is on: the relay
// behaves as it always has (CORS for every origin, the open rooms listed with their people's names, no limits per address)
const PUB = OPT.public;
const ORIGINS = new Set();   // the pages that may connect (besides the relay's own): origins as the browser sends them
for (const o of OPT.origin.map(s => s.trim()).filter(Boolean)) {
  let u = null;
  try { u = new URL(o); } catch { /* said below */ }
  if (!u || !/^https?:$/.test(u.protocol) || u.pathname !== '/' || u.search || u.hash || u.username || u.password) {
    console.log(`--origin takes origins such as ${APP_ORIGIN} (a scheme, a host and an optional port; no path): not ${JSON.stringify(o)}`);
    process.exit(1);
  }
  ORIGINS.add(u.origin);
}
if (PUB && !ORIGINS.size) ORIGINS.add(APP_ORIGIN);
const ORIGIN_RULE = ORIGINS.size > 0;
const UNLISTED = PUB || OPT.unlisted;
const orPublic = (v, dflt) => (v >= 0 ? v : PUB ? dflt : 0);
const LIM = { guesses: orPublic(OPT.guesses, 30), creates: orPublic(OPT.creates, 10), sockets: orPublic(OPT.sockets, 64) };
const STORE = orPublic(OPT.store, 64) * (1 << 20);   // bytes; 0: no cap besides each room's own
// the logs' token: from Coolify's environment (never from the repository); the command line takes one too
const LOG_TOKEN = String(OPT['log-token'] || process.env.RELAY_LOG_TOKEN || '');
if (LOG_TOKEN && LOG_TOKEN.length < 16) { console.log('the log token (--log-token or RELAY_LOG_TOKEN) needs at least 16 characters'); process.exit(1); }

// This machine's addresses on the local network (what a headset on the same Wi-Fi types in)
const lanAddresses = () => Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
// --lan: headsets need a secure page for WebXR, and a secure page may only open wss://. A certificate of our own
// (self-signed, so each headset asks once whether to trust it) for every address of this machine, made again
// when the addresses change; and the app from the repository unless --static says otherwise.
if (OPT.lan) {
  const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, '.lan');
  if (!OPT.static) OPT.static = path.join(here, '..');
  if (!OPT.logs) OPT.logs = path.join(here, 'logs');
  if (!OPT.cert) {
    const names = ['127.0.0.1', ...lanAddresses()], want = names.join(' ');
    OPT.cert = path.join(dir, 'cert.pem'); OPT.key = path.join(dir, 'key.pem');
    let have = '';
    try { have = fs.readFileSync(path.join(dir, 'names.txt'), 'utf8'); } catch { /* none yet */ }
    if (have !== want || !fs.existsSync(OPT.cert) || !fs.existsSync(OPT.key)) {
      fs.mkdirSync(dir, { recursive: true });
      const conf = path.join(dir, 'openssl.cnf');
      fs.writeFileSync(conf, ['[req]', 'distinguished_name = dn', 'x509_extensions = ext', 'prompt = no', '[dn]', 'CN = Networks relay',
        '[ext]', 'basicConstraints = CA:FALSE', 'keyUsage = digitalSignature, keyEncipherment', 'extendedKeyUsage = serverAuth',
        'subjectAltName = ' + ['DNS:localhost', ...names.map(n => 'IP:' + n)].join(', '), ''].join('\n'));
      try {
        execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825', '-config', conf,
          '-keyout', OPT.key, '-out', OPT.cert], { stdio: 'ignore' });
      } catch (err) {
        console.log('--lan makes its certificate with openssl, which did not run (' + err.message + ').\n' +
          'Install openssl (macOS and Linux have it). On Windows it comes with Git but is not on the PATH: run the relay\n' +
          'from Git Bash, or add C:\\Program Files\\Git\\usr\\bin to PATH. Or pass --cert and --key, or use adb reverse and http://localhost.');
        process.exit(1);
      }
      fs.writeFileSync(path.join(dir, 'names.txt'), want);
    }
  }
}

// --watch without a folder watches the app the relay serves; with one, it serves that folder too (when --static is not given)
if (OPT.watch === true && !OPT.static) { console.log('--watch needs the folder it serves: --static <dir> (or --lan), or --watch <dir>'); process.exit(1); }
if (OPT.watch && OPT.watch !== true && !OPT.static) OPT.static = OPT.watch;
if (OPT.build && !OPT.watch) { console.log('--build goes with --watch'); process.exit(1); }
// on a public server anyone could write files into the logs' folder: only with a token, which the owner sets
if (PUB && OPT.logs && !LOG_TOKEN) {
  console.log('--public with --logs needs a token: set RELAY_LOG_TOKEN in the environment (or pass --log-token), and send it as X-Log-Token');
  process.exit(1);
}
// --scenes: the studio's scenes. They are the owner's own work, not the app's: on a public server only behind the password
if (OPT['scenes-readonly'] && !OPT.scenes) { console.log('--scenes-readonly goes with --scenes <dir>'); process.exit(1); }
// --scenes r2 (a folder named r2 is ./r2): the scenes in a Cloudflare R2 bucket, its settings from the environment alone
const R2MODE = String(OPT.scenes || '').trim().toLowerCase() === 'r2';
if (OPT['r2-check'] && !R2MODE) { console.log('--r2-check goes with --scenes r2'); process.exit(1); }
const SCENES = (() => {
  if (!OPT.scenes || R2MODE) return '';
  const want = path.resolve(String(OPT.scenes));
  let real = '';
  try { real = fs.realpathSync(want); if (!fs.statSync(real).isDirectory()) real = ''; } catch { /* said below */ }
  if (!real) { console.log(`--scenes: there is no folder ${want} (make it, with one subfolder per scene)`); process.exit(1); }
  return real;
})();
const R2C = (() => {
  if (!R2MODE) return null;
  const c = r2Config(process.env);
  if (c.error) { console.log(`--scenes r2: ${c.error}`); process.exit(1); }
  return c;
})();
const SCENES_ON = !!(SCENES || R2C);
if (SCENES_ON && PUB && !TOKEN) {
  console.log('--public with --scenes needs a password: set COLLAB_TOKEN in the environment (or pass --token). The scenes are your own files: nobody else should read them');
  process.exit(1);
}
const SAVE = SCENES_ON && !OPT['scenes-readonly'];
// uploads (the studio's Upload pane, SPEC "The upload page"): one file at most --max-upload MB, counted as it streams in
if (!(OPT['max-upload'] > 0)) { console.log('--max-upload takes a size in MB, more than 0'); process.exit(1); }
const MAX_UPLOAD = Math.floor(OPT['max-upload'] * (1 << 20));
// /upload sends people to the studio's Upload pane: the relay's own app (--static), else the app's public address
const APP_URL = (() => {
  const v = String(OPT.app || '').trim();
  if (!v) return (ORIGINS.size ? [...ORIGINS][0] : APP_ORIGIN) + '/';
  let u = null;
  try { u = new URL(v); } catch { /* said below */ }
  if (!u || !/^https?:$/.test(u.protocol) || u.username || u.password) { console.log(`--app takes the app's address, such as ${APP_ORIGIN}/ (http or https): not ${JSON.stringify(v)}`); process.exit(1); }
  // (a folder's address ends in /: a page that is a file, index.html, stays as it is)
  return u.origin + (/\/$|\.html?$/i.test(u.pathname) ? u.pathname : u.pathname + '/');
})();
// ffmpeg, for long sounds (POST /api/scenes/<name>/sound): looked for once, at the start, and only where uploads are taken.
// The PATH's when none is named (missing: the studio keeps such sounds as they are); a named one that does not run stops
// the start, since it was asked for
if (OPT.ffmpeg && OPT['no-ffmpeg']) { console.log('--ffmpeg and --no-ffmpeg: one or the other'); process.exit(1); }
if (OPT.ffmpeg && !SCENES_ON) { console.log('--ffmpeg goes with --scenes <dir>'); process.exit(1); }
if (!(OPT['ffmpeg-limit'] > 0)) { console.log('--ffmpeg-limit takes seconds, more than 0'); process.exit(1); }
const FFMPEG = (() => {
  if (!SAVE || OPT['no-ffmpeg']) return '';
  const bin = String(OPT.ffmpeg || 'ffmpeg');
  try {
    const out = execFileSync(bin, ['-hide_banner', '-version'], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    if (/ffmpeg version/i.test(out)) return bin;
  } catch { /* said below */ }
  if (OPT.ffmpeg) { console.log(`--ffmpeg ${OPT.ffmpeg}: it does not run as ffmpeg (ffmpeg -version said nothing of the kind)`); process.exit(1); }
  return '';
})();
const FF_MAX = 2;   // conversions at once (each takes a core or two)

const MAX_MSG = 1 << 20;            // one WebSocket message, reassembled
const MAX_VALUE = 256 << 10;        // one stored value, as JSON
const MAX_FX = 64 << 10;            // one ephemeral message
const MAX_ROOM = 4 << 20;           // everything a room stores: keys and values, as JSON
const MAX_KEYS = 5000;              // keys in a room (each one costs every later welcome a few bytes more)
const MAX_ROOMS = 2000, MAX_BATCH = 500, FX_RATE = 60, SET_RATE = 120;   // rates: messages a second per member
const KEY = /^[\w-]+(?:\.[\w:-]+)*$/, ID = /^[\w-]{1,64}$/, CODE = /^[A-Z]{3}$/;
const STATION = /^st\.([\w-]{1,32})(?:\.|$)/;           // st.<id> and its state keys st.<id>.*
const DELETABLE = /^(st|pose)\./;                       // the only keys that may be written as null
const KINDS = ['ar', 'vr', 'desktop', 'cam'];   // (cam: a phone in camera mode, v124: never a headset)
const log = (...a) => { if (!OPT.quiet) console.log(new Date().toISOString(), ...a); };
process.stdout.on('error', () => {});   // a closed log must not stop the relay
const str = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
const EMPTY = Buffer.alloc(0);

// ---- WebSocket (RFC 6455): handshake, frames both ways, fragmentation, ping/pong, close
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const okCode = c => (c >= 1000 && c <= 1003) || (c >= 1007 && c <= 1014) || (c >= 3000 && c <= 4999);
class Ws {
  constructor(socket) {
    Object.assign(this, { socket, buf: EMPTY, parts: null, partLen: 0, closing: false, dead: false, last: Date.now(), pinged: Date.now() });
    this.onmessage = () => {}; this.onclose = () => {};
    socket.setNoDelay(true);
    socket.on('data', d => this.data(d));
    socket.on('end', () => socket.end());
    socket.on('error', () => socket.destroy());
    socket.on('close', () => { clearTimeout(this.kill); this.dead = true; this.onclose(); });
  }
  static frame(op, data) {   // server frames are never masked
    const n = data.length, head = Buffer.alloc(n < 126 ? 2 : n < 65536 ? 4 : 10);
    head[0] = 0x80 | op;
    if (n < 126) head[1] = n;
    else if (n < 65536) { head[1] = 126; head.writeUInt16BE(n, 2); }
    else { head[1] = 127; head.writeUInt32BE(Math.floor(n / 2 ** 32), 2); head.writeUInt32BE(n >>> 0, 6); }
    return Buffer.concat([head, data]);
  }
  write(buf) {
    if (this.socket.destroyed) return;
    if (this.socket.writableLength > 16 * MAX_MSG) return this.socket.destroy();   // a reader that cannot keep up
    this.socket.write(buf);
  }
  send(op, data) { this.write(Ws.frame(op, data)); }
  text(s) { if (!this.closing) this.send(1, Buffer.from(s)); }
  close(code, reason = '') {
    if (this.closing) return;
    this.closing = true;
    const r = Buffer.from(String(reason).slice(0, 120)), p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code); r.copy(p, 2);
    this.send(8, p);
    this.kill = setTimeout(() => this.socket.destroy(), 2000);   // in case the other side never answers
  }
  fail(code, reason) { this.close(code, reason); this.dead = true; this.buf = EMPTY; this.socket.end(); return false; }
  data(chunk) {
    this.last = Date.now();
    if (this.dead) return;
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (!this.dead && this.parse());
  }
  parse() {   // one frame from the buffer, if it is complete
    const b = this.buf;
    if (b.length < 2) return false;
    const fin = b[0] & 0x80, op = b[0] & 0x0f;
    let len = b[1] & 0x7f, at = 2;
    if (len === 126) { if (b.length < 4) return false; len = b.readUInt16BE(2); at = 4; }
    else if (len === 127) { if (b.length < 10) return false; len = b.readUInt32BE(2) * 2 ** 32 + b.readUInt32BE(6); at = 10; }
    if (b[0] & 0x70) return this.fail(1002, 'reserved bits set');
    if (!(b[1] & 0x80)) return this.fail(1002, 'client frames must be masked');
    if (op >= 8 && (!fin || len > 125)) return this.fail(1002, 'bad control frame');
    if (len > MAX_MSG || (op === 0 && this.partLen + len > MAX_MSG)) return this.fail(1009, 'message too big');
    if (b.length < at + 4 + len) return false;
    const mask = b.subarray(at, at + 4), payload = Buffer.from(b.subarray(at + 4, at + 4 + len));
    for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
    this.buf = b.subarray(at + 4 + len);
    this.frame(fin, op, payload);
    return true;
  }
  frame(fin, op, payload) {
    if (op === 8) {   // close: answer it (unless it answers ours), then hang up
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : 0;
      if (payload.length === 1 || (code && !okCode(code))) return this.fail(1002, 'bad close frame');
      if (!this.closing) { this.closing = true; this.send(8, payload.subarray(0, code ? 2 : 0)); }
      this.dead = true;
      return this.socket.end();
    }
    if (op === 9) return this.send(10, payload);   // ping -> pong
    if (op === 10) return;                         // pong: only proves the member is there
    if (op === 0) {
      if (!this.parts) return this.fail(1002, 'continuation without a first frame');
      this.parts.push(payload); this.partLen += payload.length;
      if (!fin) return;
      payload = Buffer.concat(this.parts); op = this.partOp; this.parts = null; this.partLen = 0;
    } else if (op === 1 || op === 2) {
      if (this.parts) return this.fail(1002, 'a new message inside a fragmented one');
      if (!fin) { this.parts = [payload]; this.partOp = op; this.partLen = payload.length; return; }
    } else return this.fail(1002, 'unknown opcode');
    if (op === 2) return this.fail(1003, 'text messages only');
    let text;
    try { text = UTF8.decode(payload); } catch { return this.fail(1007, 'invalid UTF-8'); }
    if (!this.closing) this.onmessage(text);
  }
}

function upgrade(req, socket, head) {
  socket.on('error', () => socket.destroy());
  const deny = (status, extra = '') => socket.end(`HTTP/1.1 ${status} ${http.STATUS_CODES[status]}\r\n${extra}Connection: close\r\nContent-Length: 0\r\n\r\n`);
  const url = parseUrl(req), key = req.headers['sec-websocket-key'];
  const peer = PEER && url && url.pathname === PEER_PATH + 'peerjs';   // (PeerJS asks for {path}peerjs)
  if (!url || (url.pathname !== '/api/ws' && !peer)) return deny(404);
  if (req.method !== 'GET' || !/^websocket$/i.test(req.headers.upgrade || '') || !/^[A-Za-z0-9+/]{22}==$/.test(key || '')) return deny(400);
  if (req.headers['sec-websocket-version'] !== '13') return deny(426, 'Sec-WebSocket-Version: 13\r\n');
  // only the app's pages (and the relay's own): a page elsewhere is refused before it gets a socket, as is a client
  // that sends no Origin at all (not a browser) unless --allow-no-origin
  if (!originOk(req, true)) { tally('sockets refused: origin not allowed'); return deny(403); }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const ws = new Ws(socket), who = LIM.sockets || LIM.guesses ? clientOf(req) : null;
  // refused before anything of a room is sent: told why in the protocol's own error (PeerJS's for the introduction
  // server), then closed (4429 a limit, as asdf10k-collab-backend's; 4401 no or a wrong password)
  const no = (code, type, text, close) => { if (peer) peerOut(ws, type, { msg: text }); else ws.text(JSON.stringify({ t: 'error', code, text })); ws.close(close, code); };
  const fid = TOKEN ? failId(req) : '';
  if (fid && blocked(fid)) { tally('sockets refused: too many failed attempts from one address'); return no('limit', 'ERROR', FAIL_TEXT, 4429); }
  const given = fid && url.searchParams.get(peer ? 'key' : 'token');
  if (fid && !tokenMatches(given)) {
    if (given && given !== PEER_KEY) failed(fid);   // (PeerJS's default key: no password yet, as none at all)
    tally('sockets refused: missing or wrong token');
    return peer ? no('token', 'INVALID-KEY', 'Invalid key provided', 4401) : no('token', 'ERROR', TOKEN_TEXT, 4401);
  }
  if (who && LIM.sockets && who.socks >= LIM.sockets) {   // (told why, as the page logs it; not counted: it closes at once)
    tally('sockets refused: too many from one address');
    return no('busy', 'ERROR', 'too many connections from your network', 4429);
  }
  if (who) { who.socks++; who.at = Date.now(); socket.once('close', () => { who.socks--; who.at = Date.now(); }); }
  if (peer) peerJoin(ws, url.searchParams); else join(ws, url.searchParams, netOf(req), who, fid);
  if (head && head.length) ws.data(head);
}

// ---- rooms and members
const rooms = new Map();
let stored = 0;   // every room's size together (keys and values, as JSON), for --store
function makeRoom(code, app, version) {
  // (nets: the networks of the members it has had, the last few: an empty room stays listed on its network; next: the
  // version a reload order moves it to, until nextUntil, with that order, nextN and nextShell, v136)
  const r = { code, app, version, created: Date.now(), seq: 0, keys: new Map(), size: 0, members: new Map(), empty: Date.now(), nets: new Set(),
    next: '', nextUntil: 0, nextN: '', nextShell: null, reloadAt: 0 };
  rooms.set(code, r);
  keepTouch();
  return r;
}
// A room's version is the shared state's format of the app that made it (shared.js's FORMAT, networks-<n>). Until v136
// it never changed, so after a deploy that bumped it the pages still running the old app (back within a second of the
// relay's restart) made the room again under the old one, and every device that took the update was refused (4006) for
// as long as the room lived (6 hours after it emptied). So a room takes a newer networks-<n> from a newcomer once nobody of
// its own version is connected (or a reload order asked for it: next), and never an older one (a device that missed the
// update, waking in an upgraded room, is refused and reloads). Other versions: only the same one, as ever
const fmtN = v => { const m = /^networks-(\d+)$/.exec(v || ''); return m ? +m[1] : 0; };
const pub = m => ({ id: m.id, name: m.name, color: m.color, kind: m.kind, here: m.here, version: m.version, since: m.since });
const people = r => [...r.members.values()].map(pub);
const stations = r => [...r.keys.keys()].filter(k => /^st\.[^.]+$/.test(k)).length;
const idle = r => (r.members.size ? 0 : Math.round((Date.now() - r.empty) / 1000));
const keysOut = r => Object.fromEntries([...r.keys].map(([k, e]) => [k, { v: e.v, seq: e.seq, by: e.by }]));
function broadcast(room, msg, except) {
  const buf = Ws.frame(1, Buffer.from(JSON.stringify(msg)));
  for (const m of room.members.values()) if (m !== except && !m.ws.closing) m.ws.write(buf);   // nothing after a close frame
}
const send = (m, msg) => m.ws.text(JSON.stringify(msg));
const cut = keys => (keys.length > 12 ? keys.slice(0, 12).join(' ') + ` +${keys.length - 12} more` : keys.join(' '));

// (net: the member's network, a hash: netOf; never its address, which is neither kept nor logged. who: its address's
// limits, clientOf; fid: its address for failed attempts while a password is set, failId)
function join(ws, q, net, who, fid) {
  const code = (q.get('room') || '').toUpperCase(), id = q.get('id') || '';
  const fatal = (c, text, close, quiet) => { if (quiet) tally(quiet); else log(`refused a socket (${text})`); ws.text(JSON.stringify({ t: 'error', code: c, text })); ws.close(close, c); };
  if (!CODE.test(code) || !ID.test(id)) return fatal('bad', 'a room code and a client id are needed', 4000);
  if (q.has('proto') && q.get('proto') !== String(PROTO)) return fatal('proto', `this relay speaks protocol ${PROTO}`, 4005);
  const room = rooms.get(code);
  // guessing codes: past its lookups of unknown codes an address gets no answer about any code (a known one included,
  // or the answer would say which exist) until a minute's worth has passed; a member coming back (its id in the room) is let in
  if (!(room && room.members.has(id)) && !canGuess(who)) return fatal('limit', GUESS_TEXT, 4429, 'sockets refused: too many unknown room codes from one address');
  if (!room) { guessed(who); return fatal('room', `no room ${code}`, 4004); }   // (with a password: not a failed attempt, see authOk)
  let m = room.members.get(id);
  if (m) {   // the same page again (a reconnect while its old socket hangs on): the new socket wins
    const old = m.ws;
    old.onmessage = old.onclose = () => {};
    old.text(JSON.stringify({ t: 'error', code: 'replaced', text: 'connected again elsewhere' }));
    old.close(4008, 'replaced');
    m.ws = ws; m.net = net;
  } else {
    m = { id, ws, net, name: '', color: '', kind: 'desktop', here: false, version: '', since: Date.now(), fx: { n: 0, t0: 0 }, sets: { n: 0, t0: 0 }, fxDropped: 0 };
    room.members.set(id, m);
  }
  if (net) { room.nets.delete(net); room.nets.add(net); if (room.nets.size > 8) room.nets.delete(room.nets.values().next().value); }
  room.empty = 0;
  ws.onmessage = text => {   // a value nested too deeply for JSON.stringify must not stop the relay
    try { message(room, m, text); } catch (err) { refuse(room, m, null, [], `bad message: ${err.message}`, 'bad'); }
  };
  ws.onclose = () => leave(room, m);
  // (the room's own members see each other's names: its people list. --unlisted only keeps them out of what anyone else can ask)
  send(m, { t: 'welcome', you: id, room: code, app: room.app, version: room.version, seq: room.seq, keys: keysOut(room), members: people(room), now: Date.now(), proto: PROTO });
  broadcast(room, { t: 'members', members: people(room) });
  log(`${code} join ${id} (${room.members.size} in the room)`);
}
function leave(room, m, why = 'leave') {
  if (room.members.get(m.id) !== m) return;
  m.ws.onmessage = m.ws.onclose = () => {};
  room.members.delete(m.id);
  if (!room.members.size) { room.empty = Date.now(); keepTouch(); }
  broadcast(room, { t: 'members', members: people(room) });
  log(`${room.code} ${why} ${m.id} (${room.members.size} in the room)`);
}
function kick(room, m, code, text, close) {   // a fatal error: tell the member, close, and drop it at once
  log(`${room.code} refused ${m.id} (${text})`);
  send(m, { t: 'error', code, text });
  m.ws.close(close, code);
  leave(room, m, code === 'timeout' ? 'timeout' : 'leave');
}
function refuse(room, m, cid, keys, text, code = 'refused') {   // a write not stored; the member keeps its socket
  log(`${room.code} refused ${m.id} (${text})${keys.length && !text.includes(keys[0]) ? ': ' + cut(keys) : ''}`);
  send(m, { t: 'error', code, text, cid, keys });
}
function over(r, cap) {   // a fixed one-second window per member
  const now = Date.now();
  if (now - r.t0 >= 1000) { r.t0 = now; r.n = 0; }
  return ++r.n > cap;
}

function message(room, m, text) {
  let msg;
  try { msg = JSON.parse(text); } catch { return refuse(room, m, null, [], 'bad message: not JSON', 'bad'); }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return refuse(room, m, null, [], 'bad message: not an object', 'bad');
  if (msg.t === 'set') return set(room, m, msg);
  if (msg.t === 'fx') {
    if (typeof msg.k !== 'string' || msg.k.length > 128 || !KEY.test(msg.k) || msg.v === undefined) return refuse(room, m, null, [], 'bad fx: k and v needed', 'bad');
    if (text.length > MAX_FX) return refuse(room, m, null, [msg.k], 'bad fx: too big', 'bad');
    if (over(m.fx, FX_RATE)) { m.fxDropped++; return; }   // counted, logged once a tick
    return broadcast(room, { t: 'fx', k: msg.k, v: msg.v, by: m.id }, m);
  }
  if (msg.t === 'ping') return send(m, { t: 'pong', c: Number.isFinite(msg.c) ? msg.c : null, now: Date.now() });
  if (msg.t === 'hello') {
    const version = str(msg.version, 64);
    if (msg.proto !== undefined && msg.proto !== PROTO) return kick(room, m, 'proto', `this relay speaks protocol ${PROTO}`, 4005);
    if (version && room.version && version !== room.version && !takeOver(room, m, version)) return kick(room, m, 'version', `the room runs version ${room.version}`, 4006);
    if (version && !room.version) { room.version = version; keepTouch(); }   // a room made without a version takes the first one
    Object.assign(m, { name: str(msg.name, 32), color: /^#[0-9a-f]{3,8}$/i.test(msg.color) ? msg.color : '',
      kind: KINDS.includes(msg.kind) ? msg.kind : 'desktop', here: msg.here === true, version, obeys: msg.reload === 1 });
    broadcast(room, { t: 'members', members: people(room) });
    return log(`${room.code} hello ${m.id}${UNLISTED ? '' : ` "${m.name}"`} ${m.kind}${m.here ? ' here' : ''} ${version}`);
  }
  refuse(room, m, null, [], `bad message: unknown t ${JSON.stringify(String(msg.t)).slice(0, 40)}`, 'bad');
}

// a newcomer of another version: the room moves to it when it is newer and nobody of the room's own version is connected, or
// when a reload order (POST /api/rooms/<code>/reload) asked for it in the last two minutes; then the members still on the
// old version get the relay's own reload order (they reload by it; an older app ignores it) and are refused afterwards, so
// their own live updates ask them to reload (true: taken). When: an app that obeys reload orders (its hello says reload: 1,
// v136) reloads in its turn, up to 8 s after it got the order (by when it came into the room, so ten devices do not hit
// the router at once; a headset at least 3 s), so it is refused only ORDER_GRACE after it was first told (the order, else
// now), never before its turn: refused earlier, it reloaded at once (a page) or was asked (a headset) mid-countdown, and the
// stagger was lost (review of v136). An older app, which ignores the order, 3 s later as before
const ORDER_GRACE = 12000;
function takeOver(room, m, version) {
  const was = room.version, a = fmtN(was), b = fmtN(version), t = Date.now();
  if (!a || !(b > a)) return false;
  const old = [...room.members.values()].filter(x => x !== m && x.version === was), asked = room.next === version && t < room.nextUntil;
  if (old.length && !asked) return false;
  room.version = version;
  keepTouch();
  log(`${room.code} version ${was} -> ${version}${old.length ? ` (${old.length} on ${was} told to reload)` : ''}`);
  if (old.length) {
    const buf = Ws.frame(1, Buffer.from(JSON.stringify({ t: 'fx', k: 'q.reload', v: { n: room.nextN || crypto.randomBytes(6).toString('base64url'), to: version, shell: room.nextShell, by: '', at: t }, by: '' })));
    for (const x of old) {
      if (!x.ws.closing) x.ws.write(buf);
      const told = x.toldAt && t - x.toldAt < 120000 ? Math.min(x.toldAt, t) : t;
      setTimeout(() => { if (room.members.get(x.id) === x && x.version === was) kick(room, x, 'version', `the room runs version ${version} now`, 4006); },
        x.obeys ? Math.max(3000, told + ORDER_GRACE - t) : 3000);
    }
  }
  return true;
}

function check(k, v) {   // why a [key, value] pair cannot be stored, or ''
  if (typeof k !== 'string' || k.length > 128 || !KEY.test(k)) return 'bad key';
  if (k.startsWith('st.') && !STATION.test(k)) return 'bad station id';
  if (v === undefined) return 'no value';
  if (v === null) return DELETABLE.test(k) ? '' : 'null outside the deletable families';
  if (JSON.stringify(v).length > MAX_VALUE) return 'value too big';
  const s = STATION.exec(k);
  if (s && k === 'st.' + s[1] && !(typeof v === 'object' && !Array.isArray(v) && typeof v.story === 'string' && v.story)) return 'a station needs a story';
  return '';
}
function set(room, m, msg) {
  const cid = typeof msg.cid === 'string' || Number.isFinite(msg.cid) ? msg.cid : null;
  const all = msg.batch;
  if (!Array.isArray(all) || !all.length || all.length > MAX_BATCH) return refuse(room, m, cid, [], `bad batch: 1 to ${MAX_BATCH} [key, value] pairs`, 'bad');
  const named = all.map(p => (Array.isArray(p) ? String(p[0]).slice(0, 128) : '?'));
  if (over(m.sets, SET_RATE)) return refuse(room, m, cid, named, `more than ${SET_RATE} writes a second`, 'rate');
  const bad = [], good = [], st = new Map();   // st: station id -> its value after this batch (null: removed)
  for (const p of all) {
    const [k, v] = Array.isArray(p) && p.length === 2 ? p : [];
    const why = Array.isArray(p) && p.length === 2 ? check(k, v) : 'not a [key, value] pair';
    if (why) { bad.push([typeof k === 'string' ? k.slice(0, 128) : '?', why]); continue; }
    good.push({ k, v, n: v === null ? 0 : k.length + JSON.stringify(v).length });   // a key's size counts too
    const s = STATION.exec(k);
    if (s && k === 'st.' + s[1]) st.set(s[1], v);
  }
  // a station's state keys need the station (as it stands after this batch); a value that names the
  // story it was written for must name the station's story (a late write from before a change is stale)
  const ok = good.filter(({ k, v }) => {
    const s = STATION.exec(k);
    if (!s || k === 'st.' + s[1] || v === null) return true;
    const station = st.has(s[1]) ? st.get(s[1]) : room.keys.get('st.' + s[1])?.v;
    const why = !station ? 'no such station' : v && typeof v === 'object' && typeof v.story === 'string' && v.story !== station.story ? `stale: the station shows ${station.story}` : '';
    if (why) bad.push([k, why]);
    return !why;
  });
  // the epoch rule: a station that shows another story (or goes) loses its state keys, in this seq
  const gone = [];
  for (const [id, v] of st) {
    const old = room.keys.get('st.' + id);
    if (old && v && old.v.story === v.story) continue;
    for (const k of room.keys.keys()) if (k.startsWith(`st.${id}.`)) gone.push(k);
  }
  // the room as it would be after the batch: its size and how many keys
  const after = new Map(gone.map(k => [k, 0]));
  for (const { k, v, n } of ok) after.set(k, v === null ? 0 : n);
  let grow = 0, more = 0;
  for (const [k, n] of after) { const e = room.keys.get(k); grow += n - (e ? e.n : 0); more += (n ? 1 : 0) - (e ? 1 : 0); }
  if (ok.length && room.size + grow > MAX_ROOM) return refuse(room, m, cid, named, 'the room is full');
  if (ok.length && more > 0 && room.keys.size + more > MAX_KEYS) return refuse(room, m, cid, named, `the room is full (${MAX_KEYS} keys)`);
  if (ok.length && STORE && grow > 0 && stored + grow > STORE) return refuse(room, m, cid, named, 'the relay is full');   // (--store: every room together)
  if (ok.length) {
    const seq = ++room.seq, out = [];
    stored -= room.size;
    const drop = k => { const e = room.keys.get(k); if (e) { room.size -= e.n; room.keys.delete(k); } };
    for (const k of gone) { drop(k); out.push([k, null]); }
    for (const { k, v, n } of ok) {
      if (v === null) drop(k);
      else { room.size += n - (room.keys.get(k)?.n || 0); room.keys.set(k, { v, seq, by: m.id, n }); }
      out.push([k, v]);
    }
    stored += room.size;
    keepTouch();
    broadcast(room, { t: 'set', batch: out, seq, by: m.id, cid });
    log(`${room.code} set #${seq} by ${m.id}: ${cut(out.map(([k, v]) => (v === null ? k + '=null' : k)))}`);
  }
  if (bad.length) refuse(room, m, cid, bad.map(b => b[0]), bad.map(([k, w]) => `${k}: ${w}`).join('; ').slice(0, 500));
}

// ---- --keep <file>: the rooms kept across restarts (v136). Until then a restart (every deploy on Coolify) emptied every
// room, and the pages still open made them again within a second, under the old app's version. Every room's code, app,
// version, seq, keys and when it was last occupied (empty: as of writing, for one with members) go to <file> as JSON,
// written to a temporary file beside it and renamed (never half a file), every 5 s when something changed and as the relay
// stops (SIGINT, SIGTERM: a container stop), and read back as it starts (rooms expired meanwhile left out, every key
// checked as a write is). With a rolling update the new relay may read the file before the old one wrote it as it stopped:
// so for 2 minutes after the start the file is looked at every second, and what another relay wrote there is taken (a room
// this relay does not have; one it read and that nobody has changed here since, when the file's is newer: its members
// reconnect to it, 1012)
const KEEP = OPT.keep ? path.resolve(String(OPT.keep)) : '';
const KP = { dirty: false, busy: false, id: crypto.randomBytes(6).toString('hex'), mtime: 0, final: false, start: Date.now() };
function keepTouch() { if (KEEP) KP.dirty = true; }
function keepOut() {
  const now = Date.now();
  return JSON.stringify({ keep: 1, by: KP.id, at: now, rooms: [...rooms.values()].map(r => ({ code: r.code, app: r.app, version: r.version, created: r.created, seq: r.seq,
    empty: r.members.size ? now : r.empty, keys: Object.fromEntries([...r.keys].map(([k, e]) => [k, { v: e.v, seq: e.seq, by: e.by }])) })) });
}
function keepWrite(final) {
  if (!KEEP || KP.final || (KP.busy && !final)) return;
  KP.dirty = false;
  const text = keepOut(), tmp = `${KEEP}.${KP.id}${final ? '-stop' : ''}.tmp`;
  const done = err => {
    KP.busy = false;
    if (err) { KP.dirty = true; log(`--keep: cannot write ${KEEP} (${err.code || err.message})`); return; }
    try { KP.mtime = fs.statSync(KEEP).mtimeMs; } catch { /* gone */ }
  };
  if (final) { KP.final = true; try { fs.writeFileSync(tmp, text); fs.renameSync(tmp, KEEP); done(); } catch (err) { done(err); } return; }
  KP.busy = true;
  fs.promises.writeFile(tmp, text).then(() => (KP.final ? fs.promises.unlink(tmp) : fs.promises.rename(tmp, KEEP))).then(() => done(), done);
}
// the file read back: its rooms, each key checked as a write is (anything else left out); null: none, or not one
function keepRead() {
  let text = '';
  try { text = fs.readFileSync(KEEP, 'utf8'); KP.mtime = fs.statSync(KEEP).mtimeMs; } catch (err) { return err.code === 'ENOENT' ? null : { error: err.code || err.message }; }
  let o;
  try { o = JSON.parse(text); } catch { return { error: 'not JSON' }; }
  if (!o || o.keep !== 1 || !Array.isArray(o.rooms)) return { error: 'not a file of rooms' };
  const now = Date.now(), out = [];
  for (const e of o.rooms) {
    if (!e || typeof e !== 'object' || typeof e.code !== 'string' || !CODE.test(e.code) || !e.keys || typeof e.keys !== 'object') continue;
    const empty = Number.isFinite(e.empty) ? e.empty : +o.at || now;
    if (now - empty > OPT.expire * 1000) continue;   // (expired meanwhile)
    const keys = new Map();
    let size = 0, seq = Number.isInteger(e.seq) && e.seq >= 0 ? e.seq : 0;
    for (const [k, x] of Object.entries(e.keys)) {
      if (!x || typeof x !== 'object' || x.v === undefined || x.v === null || check(k, x.v)) continue;
      const n = k.length + JSON.stringify(x.v).length, q = Number.isInteger(x.seq) && x.seq >= 0 ? x.seq : 0;
      if (keys.size >= MAX_KEYS || size + n > MAX_ROOM) break;
      keys.set(k, { v: x.v, seq: q, by: typeof x.by === 'string' ? x.by.slice(0, 64) : '', n });
      size += n; seq = Math.max(seq, q);
    }
    out.push({ code: e.code, app: str(e.app, 32), version: str(e.version, 64), created: Number.isFinite(e.created) ? e.created : now, seq, empty, keys, size });
  }
  return { by: typeof o.by === 'string' ? o.by : '', rooms: out };
}
function keepLoad(first) {
  const got = keepRead();
  if (!got) { if (first) log(`--keep: no ${KEEP} yet (it is written once there is a room)`); return; }
  if (got.error) {
    log(`--keep: ${KEEP} could not be read (${got.error})${first ? ': starting with no rooms, the file kept as ' + path.basename(KEEP) + '.bad' : ''}`);
    if (first) try { fs.renameSync(KEEP, KEEP + '.bad'); } catch { /* gone */ }
    return;
  }
  if (!first && got.by === KP.id) return;   // (this relay's own)
  let n = 0;
  for (const e of got.rooms) {
    const r = rooms.get(e.code);
    if (r && !(e.seq > r.seq && r.seq === r.keptSeq)) continue;   // (changed here since it was read: ours stands)
    if ((!r && rooms.size >= MAX_ROOMS) || (STORE && stored - (r ? r.size : 0) + e.size > STORE)) continue;
    const x = r || makeRoom(e.code, e.app, e.version);
    stored += e.size - (r ? r.size : 0);
    Object.assign(x, { app: e.app, version: e.version, created: e.created, seq: e.seq, keys: e.keys, size: e.size, keptSeq: e.seq }, r ? {} : { empty: e.empty });
    if (r) for (const m of r.members.values()) m.ws.close(1012, 'room read again');   // (they come back to it as it is now)
    n++;
  }
  if (first) KP.dirty = false;   // (the file has them as they are)
  if (n || first) log(`--keep: ${n} room${n === 1 ? '' : 's'} read ${first ? 'back' : 'again'} from ${KEEP}${first ? '' : ' (written by another relay)'}`);
}
if (KEEP) {
  try { fs.mkdirSync(path.dirname(KEEP), { recursive: true }); } catch { /* said as it is written */ }
  keepLoad(true);
  setInterval(() => { if (KP.dirty) keepWrite(false); }, 5000).unref();
  const look = setInterval(() => {
    if (Date.now() - KP.start > 120000) return clearInterval(look);
    let mt = 0;
    try { mt = fs.statSync(KEEP).mtimeMs; } catch { return; }
    if (mt !== KP.mtime && !KP.busy) keepLoad(false);
  }, 1000);
  look.unref();
}

// ---- an introduction server for peer to peer: what PeerJS 1.5.5's client expects of a PeerServer, at /peerjs
// (so a client passes { host, port, path: '/peerjs', secure } and the default key 'peerjs'). Devices that link to
// each other directly (WebRTC) meet here by id, swap their offers, answers and candidates, and then talk without it.
// For tests, and for an event's own when the public one (0.peerjs.com) is down or not wanted. Nothing is stored:
// an id lives while its socket does (or until it is silent for --timeout), and messages for an id not yet connected
// wait PEER_WAIT, then each sender hears EXPIRE (as from PeerJS's own server).
const PEER_PATH = '/peerjs/', PEER_KEY = 'peerjs', PEER_ID = /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/;   // (PeerJS's own id rule)
const PEER_MAX = 5000, PEER_WAIT = 5000, PEER_RATE = 200, PEER_MSG = 64 << 10, PEER_HELD = 128 << 10, PEER_QUEUES = 500;
const PEER_PASS = new Set(['OFFER', 'ANSWER', 'CANDIDATE', 'LEAVE']);   // passed on from src to dst; HEARTBEAT is life only
const peers = new Map(), waiting = new Map();   // id -> { id, token, ws }; an absent id -> { msgs, size, from, timer }
const peerOut = (ws, type, payload) => ws.text(JSON.stringify(payload ? { type, payload } : { type }));
// an id as the log shows it: a slot of rooms on this network (shared.js, slotId) carries the network's hash, never logged
const pid = id => String(id).replace(/^(\w+-near-.+-)[0-9a-f]{6}(-\d+)$/, '$1******$2');

function peerJoin(ws, q) {
  const id = q.get('id') || '', token = q.get('token') || '', key = q.get('key') || '';
  const shut = (type, msg, code, why) => { if (why) log(`peer refused ${pid(id.slice(0, 64)) || '(no id)'} (${why})`); peerOut(ws, type, { msg }); ws.close(code, why || msg); };
  if (!id || !token || !key) return shut('ERROR', 'No id, token, or key supplied to websocket server', 4000, 'no id, token or key');
  if (!TOKEN && key !== PEER_KEY) return shut('INVALID-KEY', 'Invalid key provided', 4003, 'another key');   // (with a password: checked as the socket opened)
  if (id.length > 64 || !PEER_ID.test(id) || token.length > 64) return shut('ERROR', 'Invalid id or token', 4000, 'a bad id or token');
  let p = peers.get(id);
  if (p && p.token !== token) return shut('ID-TAKEN', 'ID is taken', 4001, 'id taken');
  const back = !!p;
  if (p) {   // the same device again (it reconnects while its old socket hangs on): the new socket wins
    const old = p.ws;
    old.onmessage = old.onclose = () => {};
    old.close(4008, 'replaced');
    p.ws = ws;
  } else {
    if (peers.size >= PEER_MAX) return shut('ERROR', 'Server has reached its concurrent user limit', 4013, 'full');
    peers.set(id, p = { id, token, ws, rate: { n: 0, t0: 0 }, dropped: 0 });
  }
  ws.onmessage = text => peerMessage(p, text);
  ws.onclose = () => peerLeave(p);
  peerOut(ws, 'OPEN');
  log(`peer ${back ? 'back' : 'join'} ${pid(id)} (${peers.size} connected)`);
  const w = waiting.get(id);   // what came for it meanwhile, in order
  if (w) { clearTimeout(w.timer); waiting.delete(id); for (const m of w.msgs) ws.text(m); }
}
function peerLeave(p, why = 'leave') {
  if (peers.get(p.id) !== p) return;
  p.ws.onmessage = p.ws.onclose = () => {};
  peers.delete(p.id);   // the id is free at once
  log(`peer ${why} ${pid(p.id)} (${peers.size} connected)`);
}
function peerMessage(p, text) {   // anything else is ignored, as PeerJS's own server does (a reply of ERROR would end the client)
  if (peers.get(p.id) !== p || text.length > PEER_MSG) return;
  let m;
  try { m = JSON.parse(text); } catch { return; }
  if (!m || typeof m !== 'object' || !PEER_PASS.has(m.type) || typeof m.dst !== 'string' || !m.dst || m.dst.length > 64) return;
  if (over(p.rate, PEER_RATE)) { p.dropped++; return; }   // counted, logged once a tick
  const out = JSON.stringify({ type: m.type, src: p.id, dst: m.dst, payload: m.payload });   // src is always the sender's id
  const to = peers.get(m.dst);
  if (to) return to.ws.text(out);
  if (m.type === 'LEAVE') return;   // nobody there to tell
  let w = waiting.get(m.dst);
  if (!w) {
    if (waiting.size >= PEER_QUEUES) return;
    const dst = m.dst;
    waiting.set(dst, w = { msgs: [], size: 0, from: new Set(), timer: setTimeout(() => peerExpire(dst), PEER_WAIT) });
  }
  if (w.size + out.length > PEER_HELD) return;
  w.msgs.push(out); w.size += out.length; w.from.add(p.id);
}
function peerExpire(dst) {   // nobody came for these: each sender hears it once, as from that id
  const w = waiting.get(dst);
  if (!w) return;
  waiting.delete(dst);
  for (const src of w.from) { const p = peers.get(src); if (p) p.ws.text(JSON.stringify({ type: 'EXPIRE', src: dst, dst: src })); }
  log(`peer ${pid(dst)} never came (${w.msgs.length} messages for it from ${[...w.from].map(pid).join(' ')})`);
}

// silent members time out, everybody gets a WebSocket ping, rooms without members expire
setInterval(() => {
  const now = Date.now();
  for (const p of peers.values()) {   // a browser answers pings by itself, so only a device that has gone falls silent
    if (now - p.ws.last > OPT.timeout * 1000) { p.ws.close(4009, 'timeout'); peerLeave(p, 'timeout'); continue; }
    if (now - p.ws.pinged >= OPT.ping * 1000) { p.ws.send(9, EMPTY); p.ws.pinged = now; }
    if (p.dropped) { log(`peer dropped ${p.dropped} messages from ${pid(p.id)} (more than ${PEER_RATE} a second)`); p.dropped = 0; }
  }
  for (const room of rooms.values()) {
    for (const m of room.members.values()) {
      if (now - m.ws.last > OPT.timeout * 1000) { kick(room, m, 'timeout', `silent for ${OPT.timeout} s`, 4009); continue; }
      if (now - m.ws.pinged >= OPT.ping * 1000) { m.ws.send(9, EMPTY); m.ws.pinged = now; }
      if (m.fxDropped) { log(`${room.code} refused ${m.fxDropped} fx from ${m.id} (more than ${FX_RATE} a second)`); m.fxDropped = 0; }
    }
    if (!room.members.size && now - room.empty > OPT.expire * 1000) { rooms.delete(room.code); stored -= room.size; keepTouch(); log(`${room.code} expired`); }
  }
  // the limits per address: forgotten once nothing of an address is open and its buckets are full again; the
  // refusals said in one line each (a crowd of them must not fill the log)
  for (const [k, c] of CLIENTS) if (!c.socks && now - c.at > 120000) CLIENTS.delete(k);
  for (const [k, h] of FAILS) if (now - h.since > 60000) FAILS.delete(k);
  for (const [what, n] of TALLY) log(`${what} (${n})`);
  TALLY.clear();
}, Math.max(50, Math.min(5000, OPT.ping * 1000, OPT.timeout * 250, OPT.expire * 250)));

// ---- HTTP: the API (with CORS, for the app on another origin) and the app's files
function parseUrl(req) { try { return req.url.startsWith('/') ? new URL('http://relay' + req.url) : null; } catch { return null; } }

// ---- rooms on this network: a client's network as a short hash, never its address (neither kept nor logged: the
// relay's log names no address). Behind n reverse proxies (--proxy n) the address is the n-th from the right in
// X-Forwarded-For: each proxy adds the address it was reached from, so that is the one the outermost proxy saw
// (anything before it came from the client and could be made up; with fewer entries, the first); without --proxy the
// header is ignored. A private address stands for its /24 (one network: a relay on the LAN sees the headsets' own addresses),
// IPv6 for its /64, this machine for itself. The hash is the page's own (shared.js, netHash: the same salt): the public
// address the STUN server tells a page without a relay gives the same id, so a room used on a network through a relay
// on the internet is on that network peer to peer too. 24 bits: one id stands for about 256 public addresses.
const NET_SALT = 'networks-near-1';
function netName(a) {
  a = String(a || '').trim().replace(/^\[|\](:\d+)?$/g, '').replace(/%.*$/, '').replace(/^::ffff:(?=\d+\.)/i, '').replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1');
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (v4) {
    const [b0, b1] = [+v4[1], +v4[2]];
    if (b0 === 127) return 'loopback';
    if (b0 === 10 || (b0 === 172 && b1 >= 16 && b1 < 32) || (b0 === 192 && b1 === 168) || (b0 === 169 && b1 === 254)) return `${+v4[1]}.${+v4[2]}.${+v4[3]}.0/24`;
    return v4.slice(1).map(Number).join('.');
  }
  if (!a.includes(':')) return '';
  if (a === '::1') return 'loopback';
  const [h, t] = a.split('::'), hs = h ? h.split(':') : [], ts = t === undefined ? [] : t ? t.split(':') : [];
  const all = t === undefined ? hs : hs.concat(Array(Math.max(0, 8 - hs.length - ts.length)).fill('0'), ts);
  if (all.length !== 8 || !all.every(g => /^[0-9a-f]{1,4}$/i.test(g))) return '';
  return all.slice(0, 4).map(g => parseInt(g, 16).toString(16)).join(':') + '::/64';
}
const netHash = name => (name ? crypto.createHash('sha256').update(NET_SALT + '|' + name).digest('hex').slice(0, 6) : '');
const forwarded = req => { const a = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean); return a.length ? a[Math.max(0, a.length - OPT.proxy)] : ''; };
const addrOf = req => (OPT.proxy && forwarded(req)) || req.socket.remoteAddress;
const netOf = req => netHash(netName(addrOf(req)));

// ---- limits per address (--guesses, --creates, --sockets; --public): the address as for rooms on this network (with
// --proxy the one the outermost proxy saw), IPv6 by its /64 (one household or device can have a whole /64), kept only
// as a keyed hash in memory (the key made afresh at every start), never logged. Every device behind one router shares
// its address (ten headsets and the laptops at an event): the defaults leave them room.
const CLIENTS = new Map(), CLIENT_KEY = crypto.randomBytes(16);
function clientOf(req) {
  const a = String(addrOf(req) || ''), k = crypto.createHmac('sha256', CLIENT_KEY).update(netName(a) || a).digest('base64url').slice(0, 22);
  let c = CLIENTS.get(k);
  if (!c) CLIENTS.set(k, c = { socks: 0, at: Date.now(), g: 2 * LIM.guesses, gt: Date.now(), c: 2 * LIM.creates, ct: Date.now() });
  return c;
}
// a bucket of 2n that fills again at n a minute: n a minute on end, and a burst of 2n (a relay restarted at an event:
// every page there looks its room up again, finds it gone and brings it back under its code)
function fill(c, b, n) { const now = Date.now(); c[b] = Math.min(2 * n, c[b] + ((now - c[b + 't']) * n) / 60000); c[b + 't'] = now; c.at = now; return c[b]; }
const canGuess = c => !LIM.guesses || !c || fill(c, 'g', LIM.guesses) >= 1;
const guessed = c => { if (LIM.guesses && c) c.g = Math.max(0, fill(c, 'g', LIM.guesses) - 1); };
const canCreate = c => !LIM.creates || fill(c, 'c', LIM.creates) >= 1;
const created = c => { if (LIM.creates) c.c = Math.max(0, fill(c, 'c', LIM.creates) - 1); };
const wait = (c, b, n) => Math.max(1, Math.ceil(((1 - c[b]) * 60) / n));   // seconds until one more is allowed (Retry-After)
const GUESS_TEXT = 'too many unknown room codes from your network: wait a minute';
const TALLY = new Map(), tally = what => TALLY.set(what, (TALLY.get(what) || 0) + 1);

// ---- the shared password (--token, COLLAB_TOKEN; the owner, 3 November 2026: "one word ... that i can use and enter on
// each client if i want it to be able to use the relay, no other way to use it"). The scheme is asdf10k-collab-backend's
// (src/server.ts): required on everything but GET /api/health and the app's own files (a page must load to ask for it);
// HTTP takes Authorization: Bearer <t> or ?token=, a socket ?token= (browsers cannot set headers there), the introduction
// server PeerJS's key (its own token is a random one of PeerJS's). Compared in constant time. Failed attempts (a wrong
// password, an unknown room code) are counted per address in a one-minute window (its FailureLimiter): 20, then 429 or
// close 4429 for the rest of the minute. A request with no password at all is refused (401) but not counted: guessing
// needs a password sent, and the app's own pages ask before they know one (every device behind an event's router shares
// one address). None of it without a password: the relay behaves as it always has
const tokenMatches = given => {
  if (!TOKEN) return true;
  if (!given) return false;
  const a = Buffer.from(TOKEN), b = Buffer.from(String(given));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const givenToken = (req, url) => (/^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')) || [])[1] || url.searchParams.get('token');
const TOKEN_TEXT = 'missing or wrong token', FAIL_TEXT = 'too many failed attempts, wait a minute', FAIL_MAX = 20, FAILS = new Map();
// an address as the limits per address take it (with --proxy the one the outermost proxy saw; IPv6 by its /64), kept only
// as a keyed hash
function failId(req) {
  const a = String(addrOf(req) || '').replace(/^::ffff:(?=\d+\.)/i, ''), n = netName(a);
  return crypto.createHmac('sha256', CLIENT_KEY).update(/::\/64$/.test(n) ? n : a).digest('base64url').slice(0, 22);
}
const blocked = id => { const h = FAILS.get(id); return !!h && Date.now() - h.since <= 60000 && h.n >= FAIL_MAX; };
const failed = id => { const h = FAILS.get(id), now = Date.now(); if (!h || now - h.since > 60000) FAILS.set(id, { n: 1, since: now }); else h.n++; };
// an HTTP request's password: true when it may go on, else answered (429 while its address is held back, 401)
function authOk(req, res, given) {
  if (!TOKEN) return true;
  const id = failId(req);
  if (blocked(id)) { tally('requests refused: too many failed attempts from one address'); json(res, 429, { error: FAIL_TEXT }, { 'Retry-After': '60' }); return false; }
  if (tokenMatches(given)) return true;
  // (a wrong password counts; none at all, or PeerJS's default key, does not: pages ask before they know it, and every
  // device behind an event's router shares one address. An unknown room code asked with the password does not either:
  // the password is the gate, and after a relay restart every kept room is unknown for a moment)
  if (given && given !== PEER_KEY) failed(id);
  tally('requests refused: missing or wrong token');
  json(res, 401, { error: TOKEN_TEXT });
  return false;
}
// a URL as a log line may show it: never a password (?token=, PeerJS's key, in its query or its path)
const scrub = u => String(u).replace(/([?&](?:token|key)=)[^&#\s]*/gi, '$1***').replace(/^(\/peerjs\/)[^/?#]+(?=\/)/, '$1***');

// ---- which pages may connect (--origin, --public): the origins listed and the relay's own pages (an Origin whose host
// is the one the request was sent to: Host, or with --proxy X-Forwarded-For's companion X-Forwarded-Host). A browser
// always sends Origin with a socket and with a request from another origin, and a page cannot make it up; a request with
// none comes from the relay's own page (a GET) or from no browser at all (curl, the health check)
const hostOf = h => String(h).trim().toLowerCase().replace(/:(80|443)$/, '');
function originAllowed(o, req) {
  let u;
  try { u = new URL(o); } catch { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;   // ('null': a file, a sandboxed frame)
  if (ORIGINS.has(u.origin)) return true;
  const own = [req.headers.host, ...(OPT.proxy ? String(req.headers['x-forwarded-host'] || '').split(',') : [])];
  return own.some(h => h && hostOf(h) === hostOf(u.host));
}
// socket: an upgrade, which needs an Origin unless --allow-no-origin (only a browser is held to the rule anyway: any
// other client can send what it likes, so the rule keeps other web pages off the relay, not people)
function originOk(req, socket) {
  if (!ORIGIN_RULE) return true;
  const o = req.headers.origin;
  if (o === undefined) return !socket || OPT['allow-no-origin'];
  return originAllowed(o, req);
}
// a room shows on a network while someone in it is on that network (an empty one: while its members were), unless the
// room says otherwise (its key near, { on: false }: Show on this network, off)
const shownOn = (r, net) => !!net && !(r.keys.get('near')?.v?.on === false) &&
  (r.members.size ? [...r.members.values()].some(m => m.net === net) : r.nets.has(net));
// the rooms on the asking device's network: code, the first member's name, how many are in it (never an address;
// --unlisted: no name either)
function nearRooms(net) {
  return [...rooms.values()].filter(r => shownOn(r, net)).sort((a, b) => (b.members.size > 0) - (a.members.size > 0) || b.seq - a.seq).slice(0, 20)
    .map(r => (UNLISTED ? { code: r.code, members: r.members.size, stations: stations(r), version: r.version } :
      { code: r.code, name: ([...r.members.values()].sort((a, b) => a.since - b.since).find(m => m.name) || {}).name || '', members: r.members.size, stations: stations(r), version: r.version }));
}
function reply(res, status, body, type, extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}
const json = (res, status, obj, extra) => reply(res, status, JSON.stringify(obj), 'application/json', extra);
const plain = (res, status, text, extra) => reply(res, status, text + '\n', 'text/plain; charset=utf-8', extra);

function cors(req, res) {   // the API and the introduction server, for pages on another origin (GitHub Pages); true: answered
  if (ORIGIN_RULE) {   // (--origin, --public: those origins alone, the one asking named; another origin is refused outright)
    res.setHeader('Vary', 'Origin');
    const o = req.headers.origin;
    if (o !== undefined && !originAllowed(o, req)) { tally('requests refused: origin not allowed'); json(res, 403, { error: 'origin not allowed' }); return true; }
    if (o !== undefined) res.setHeader('Access-Control-Allow-Origin', o);
  } else res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'OPTIONS') return false;
  res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range, X-Log-Token', 'Access-Control-Max-Age': '600',
    ...(req.headers['access-control-request-private-network'] ? { 'Access-Control-Allow-Private-Network': 'true' } : {}) });
  res.end();
  return true;
}
const tooMany = (res, text, s) => json(res, 429, { error: text }, { 'Retry-After': String(s) });
function api(req, res, url) {
  if (cors(req, res)) return;
  const p = url.pathname, room = /^\/api\/rooms\/([A-Za-z]{3})$/.exec(p), order = /^\/api\/rooms\/([A-Za-z]{3})\/reload$/.exec(p);
  // (open, as asdf10k-collab-backend's: whether it runs, and how many rooms; nothing more)
  if (p === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, protocol: PROTO, rooms: rooms.size });
  if (!authOk(req, res, givenToken(req, url))) return;
  // (versions: a room moves on to a newer version of the app, takeOver; reload: POST /api/rooms/<code>/reload, v136)
  if (p === '/api/ping' && req.method === 'GET') return json(res, 200, { now: Date.now(), proto: PROTO, net: netOf(req), versions: 1, reload: true, ...(KEEP ? { keep: true } : {}), ...(WATCH ? { watch: true } : {}), ...(SCENES_ON ? { scenes: true } : {}), ...(UNLISTED ? { unlisted: true } : {}), ...(TRK ? TRK.ping() : {}) });
  if (p === '/api/near' && req.method === 'GET') { const net = netOf(req); return json(res, 200, { net, rooms: nearRooms(net) }); }
  if (p === '/api/watch' && req.method === 'GET') return watchStream(req, res);
  if (p === '/api/rooms' && req.method === 'GET') {   // (--unlisted: none; a room is joined by its code, a link or on its network)
    return json(res, 200, UNLISTED ? [] : [...rooms.values()].map(r => ({ code: r.code, members: r.members.size, names: [...r.members.values()].map(m => m.name), stations: stations(r), idle: idle(r), version: r.version })));
  }
  if (p === '/api/rooms' && req.method === 'POST') return createRoom(req, res);
  if (order) return req.method === 'POST' ? reloadOrder(req, res, order[1].toUpperCase()) : json(res, 405, { error: 'method not allowed' });
  if (p === '/api/log' && req.method === 'POST') return saveLog(req, res);
  if (p === '/api/scenes' || p.startsWith('/api/scenes/')) return scenesApi(req, res, url);
  if (TRK && (p === '/api/trackers' || p === '/api/trackers/still')) return trackersApi(req, res, url);
  if (room && req.method === 'GET') {   // (a page asks before it joins a room again by itself, or brings one back)
    const who = LIM.guesses ? clientOf(req) : null;
    if (!canGuess(who)) { tally('requests refused: too many unknown room codes from one address'); return tooMany(res, GUESS_TEXT, wait(who, 'g', LIM.guesses)); }
    const r = rooms.get(room[1].toUpperCase());
    if (!r) { guessed(who); return json(res, 404, { error: 'no such room' }); }
    return json(res, 200, { code: r.code, app: r.app, version: r.version, created: r.created, seq: r.seq, idle: idle(r), members: UNLISTED ? r.members.size : people(r), keys: keysOut(r) });
  }
  if (p === '/api/ping' || p === '/api/near' || p === '/api/rooms' || p === '/api/log' || p === '/api/watch' || p === '/api/health' || room) return json(res, 405, { error: 'method not allowed' });
  json(res, 404, { error: 'not found' });
}
// ---- the PC's Vive trackers (--trackers; relay/trackers.mjs, tools/trackers/SPEC.md): their readings raw in SteamVR's
// space, and one tracker's position averaged while it lies still (the pages' Set spot A and Set spot B). Both answers
// are 200 with ok true or ok false and why (the asking went right; the tracker did not)
function trackersApi(req, res, url) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
  if (url.pathname === '/api/trackers') return json(res, 200, { ok: true, trackers: TRK.list() });
  const id = url.searchParams.get('id') || '', ms = url.searchParams.has('ms') ? Number(url.searchParams.get('ms')) : 1000;
  if (!/^[\w.:-]{1,64}$/.test(id)) return json(res, 400, { error: 'id: a tracker\'s serial number is needed' });
  if (!(ms >= 200 && ms <= 5000)) return json(res, 400, { error: 'ms: 200 to 5000' });
  TRK.still(id, Math.round(ms)).then(r => { if (!res.destroyed) json(res, 200, r); }, err => { log('error', 'trackers still', err.message); if (!res.headersSent) json(res, 500, { error: 'internal error' }); });
}
// @trk to every member of a room: one frame for all, never to a socket that is closing or holds a backlog (a slow
// headset: newer poses come anyway, and the socket is not cut for them)
function trackersSend(room, msg) {
  const buf = Ws.frame(1, Buffer.from(JSON.stringify(msg)));
  for (const m of room.members.values()) {
    if (m.ws.closing || m.ws.socket.destroyed || m.ws.socket.writableLength > TRK.BACKLOG) { TRK.count.skipped++; continue; }
    m.ws.write(buf);
  }
}
// the introduction server's HTTP side: PeerJS asks {path}{key}/id for a new id (a page that brings its own id does not)
function peerHttp(req, res, url) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
  const p = url.pathname, k = /^\/peerjs\/([^/]+)\/(?:id|peers)$/.exec(p);
  // with a password PeerJS's key is the password (its own default, peerjs, is refused), in the path or the socket's query
  if (TOKEN) {
    let key = '';
    try { key = k ? decodeURIComponent(k[1]) : givenToken(req, url); } catch { /* a bad escape: no key */ }
    if (!authOk(req, res, key)) return;
  }
  if (p === '/peerjs' || p === PEER_PATH) return json(res, 200, { name: 'Introduction server for peer to peer (PeerJS 1.5 protocol)', ...(TOKEN ? {} : { key: PEER_KEY }), path: '/peerjs' });
  const mine = !!k && (TOKEN || k[1] === PEER_KEY);   // (another key than PeerJS's default, with no password: not found)
  if (mine && p.endsWith('/id')) {
    let id;
    do id = crypto.randomUUID(); while (peers.has(id) || waiting.has(id));
    return reply(res, 200, id, 'text/plain; charset=utf-8');   // (no newline: the page takes the text as it is)
  }
  if (mine && p.endsWith('/peers')) return json(res, 401, { error: 'listing peers is off' });
  json(res, 404, { error: 'not found' });
}
function createRoom(req, res) {
  const parts = [];
  let n = 0;
  req.on('data', c => { if ((n += c.length) <= 16384) parts.push(c); else if (!res.headersSent) { res.setHeader('Connection', 'close'); json(res, 413, { error: 'body too big' }); } });
  req.on('end', () => {
    if (res.headersSent) return;
    let b;
    try { b = n ? JSON.parse(Buffer.concat(parts).toString()) : {}; } catch { return json(res, 400, { error: 'body is not JSON' }); }
    if (!b || typeof b !== 'object') return json(res, 400, { error: 'body is not an object' });
    let code = typeof b.code === 'string' ? b.code.toUpperCase() : '';
    if (b.code !== undefined && !CODE.test(code)) return json(res, 400, { error: 'a code is three letters' });
    // a chosen code is a lookup too (taken says it exists): from the same budget as the others
    const who = LIM.guesses || LIM.creates ? clientOf(req) : null;
    if (code && !canGuess(who)) { tally('requests refused: too many unknown room codes from one address'); return tooMany(res, GUESS_TEXT, wait(who, 'g', LIM.guesses)); }
    // (the room's version too, v136: a page bringing a room back after a restart knows what came back first)
    if (code && rooms.has(code)) { guessed(who); return json(res, 409, { error: 'taken', version: rooms.get(code).version }); }
    if (who && !canCreate(who)) { tally('requests refused: too many new rooms from one address'); return tooMany(res, 'too many new rooms from your network: wait a minute', wait(who, 'c', LIM.creates)); }
    if (rooms.size >= MAX_ROOMS) return json(res, 503, { error: 'too many rooms' });
    if (who) created(who);
    while (!code || rooms.has(code)) code = Array.from({ length: 3 }, () => String.fromCharCode(65 + crypto.randomInt(26))).join('');
    const r = makeRoom(code, str(b.app, 32), str(b.version, 64));
    log(`${code} created (${r.app || 'no app'} ${r.version || 'no version'})`);
    json(res, 201, { code });
  });
}

// Update the room (v136; the owner, 11 November 2026: "update this room on the relay switch that just tells everyone to
// reload, after updates rooms otherwise get lost sometimes"): POST /api/rooms/<code>/reload { n, to, shell, from } sends
// every member, whatever its version, the reload order (the quiet effect q.reload, by '': the relay's own), and the room
// takes the version it names from the first newcomer of it in the next two minutes (takeOver), even while members of the
// old one are still connected. An order is no stored key and moves nothing: anyone in the room may give it (the API's
// password, as every call); one a room every 10 s. n: the order's id (each device obeys an id once); to: the shared
// state's format the devices reload into; shell: the release ({ n, id }) they should come back with; from: who pressed it
const ORDER_ID = /^[\w-]{1,16}$/;
function reloadOrder(req, res, code) {
  const parts = [];
  let n = 0;
  req.on('data', c => { if ((n += c.length) <= 4096) parts.push(c); else if (!res.headersSent) { res.setHeader('Connection', 'close'); json(res, 413, { error: 'body too big' }); } });
  req.on('end', () => {
    if (res.headersSent) return;
    let b;
    try { b = n ? JSON.parse(Buffer.concat(parts).toString()) : {}; } catch { return json(res, 400, { error: 'body is not JSON' }); }
    if (!b || typeof b !== 'object' || Array.isArray(b) || typeof b.n !== 'string' || !ORDER_ID.test(b.n)) return json(res, 400, { error: 'n: the order\'s id is needed' });
    if (b.to !== undefined && (typeof b.to !== 'string' || b.to.length > 64)) return json(res, 400, { error: 'to: a version' });
    const sh = b.shell && typeof b.shell === 'object' && !Array.isArray(b.shell) && Number.isInteger(b.shell.n) && typeof b.shell.id === 'string' && b.shell.id.length <= 32 ? { n: b.shell.n, id: b.shell.id } : null;
    // (a lookup of a code: from the same budget as the others, --guesses)
    const who = LIM.guesses ? clientOf(req) : null;
    if (!canGuess(who)) { tally('requests refused: too many unknown room codes from one address'); return tooMany(res, GUESS_TEXT, wait(who, 'g', LIM.guesses)); }
    const r = rooms.get(code);
    if (!r) { guessed(who); return json(res, 404, { error: 'no such room' }); }
    const t = Date.now();
    if (t - r.reloadAt < 10000) return tooMany(res, 'a reload order went to this room less than 10 s ago', Math.ceil((10000 - (t - r.reloadAt)) / 1000));
    r.reloadAt = t;
    const to = str(b.to, 64), from = typeof b.from === 'string' && ID.test(b.from) ? b.from : '';
    if (to) Object.assign(r, { next: to, nextUntil: t + 120000, nextN: b.n, nextShell: sh });
    for (const x of r.members.values()) x.toldAt = t;   // (when each was told: takeOver refuses an old one only after its turn)
    broadcast(r, { t: 'fx', k: 'q.reload', v: { n: b.n, to, shell: sh, by: '', from, at: t }, by: '' });
    log(`${code} reload to ${to || 'the same version'} (${r.members.size} member${r.members.size === 1 ? '' : 's'})`);
    json(res, 200, { ok: true, members: r.members.size, version: r.version });
  });
}

// --logs: what a headset logs about its room alignment (shared.js sends it every 10 s), one JSON line per entry in
// <dir>/<day>-<room>-<name>-<member>.jsonl, so two headsets' numbers can be compared afterwards
const MAX_LOG_BODY = 1 << 20, MAX_LOG_FILE = 20 << 20, LOGGED = new Map();
// With a token (--log-token, RELAY_LOG_TOKEN; --public needs one) only a request that brings it is kept. One without
// any is answered as if logs were off, so a page that has none stops sending (shared.js, upload); a wrong one is 403.
// Both before the body is read.
const tokenOk = t => { const a = Buffer.from(String(t)), b = Buffer.from(LOG_TOKEN); return a.length === b.length && crypto.timingSafeEqual(a, b); };
function saveLog(req, res) {
  if (!OPT.logs) return json(res, 404, { error: 'logs are off (start the relay with --logs <dir>, or --lan)' });
  if (LOG_TOKEN) {
    const t = req.headers['x-log-token'];
    if (t === undefined) { res.setHeader('Connection', 'close'); return json(res, 404, { error: 'logs are off for pages without the relay\'s log token' }); }
    if (!tokenOk(t)) { res.setHeader('Connection', 'close'); tally('logs refused: a wrong token'); return json(res, 403, { error: 'wrong log token' }); }
  }
  const parts = [];
  let n = 0;
  req.on('data', c => { if ((n += c.length) <= MAX_LOG_BODY) parts.push(c); else if (!res.headersSent) { res.setHeader('Connection', 'close'); json(res, 413, { error: 'body too big' }); } });
  req.on('end', () => {
    if (res.headersSent) return;
    try { keepLog(parts, res); } catch (err) { if (!res.headersSent) json(res, 400, { error: 'bad log: ' + err.message }); }
  });
}
function keepLog(parts, res) {
  let b;
  try { b = JSON.parse(Buffer.concat(parts).toString()); } catch { return json(res, 400, { error: 'body is not JSON' }); }
  if (!b || typeof b !== 'object' || typeof b.room !== 'string' || !CODE.test(b.room) || typeof b.id !== 'string' || !ID.test(b.id) ||
    !Array.isArray(b.entries) || b.entries.length > 2000) return json(res, 400, { error: 'room, id and entries needed' });
  const now = Date.now();
  if (now - (LOGGED.get(b.id) || 0) < 1000) return json(res, 429, { error: 'one a second' });
  LOGGED.set(b.id, now);
  if (LOGGED.size > 1000) LOGGED.delete(LOGGED.keys().next().value);
  const name = String(b.name || '').replace(/[^\w-]/g, '').slice(0, 24) || 'someone';
  const file = path.join(OPT.logs, `${new Date(now).toISOString().slice(0, 10)}-${b.room}-${name}-${b.id.slice(0, 6)}.jsonl`);
  const lines = b.entries.filter(e => e && typeof e === 'object' && !Array.isArray(e)).map(e => JSON.stringify({ at: now, kind: str(b.kind, 16), ...e }) + '\n').join('');
  try {
    fs.mkdirSync(OPT.logs, { recursive: true });
    let size = 0;
    try { size = fs.statSync(file).size; } catch { /* a new file */ }
    if (size + lines.length > MAX_LOG_FILE) return json(res, 507, { error: 'the log file is full' });
    if (!size) log(UNLISTED ? `log started (${b.room}, ${b.id.slice(0, 6)})` : `log ${path.relative(process.cwd(), file)} started (${b.room}, ${name})`);   // (--unlisted: no name, nor the file's, which holds it)
    fs.appendFileSync(file, lines);
  } catch (err) { return json(res, 500, { error: 'cannot write the log: ' + err.message }); }
  json(res, 200, { lines: lines ? lines.split('\n').length - 1 : 0 });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.pdf': 'application/pdf',
  // the studio's scenes (--scenes): models, their data and textures, sounds (relay/scenes.mjs: R2 stores them so too)
  ...SCENE_TYPES };
const SQUEEZE = /^(text\/|application\/(json|manifest\+json|wasm)|image\/svg)/;   // worth sending gzipped
const gzip = promisify(zlib.gzip), GZ = new Map();
const ROOT = OPT.static ? path.resolve(OPT.static) : '';
const REAL = ROOT ? fs.realpathSync(ROOT) : '';
// Only the app's own files are served, not the rest of the repository (the authors' data in ikerdata/,
// tools/, docs/, the relay's certificate): these files at the top, and the files directly inside these
// folders. Everything index.html, sw.js (SHELL, AUDIO) and the stories load is here; add what the app gains.
// (p2p/ is the peer-to-peer test page, at /p2p/: with &peer= it can use this relay's introduction server; room-test/ is
// the room and depth test page for a Quest 3, at /room-test/. Neither is part of the app.)
const APP_FILES = new Set(['index.html', 'sfx.js', 'occlusion.js', 'ships.js', 'shared.js', 'sw.js', 'manifest.webmanifest', 'three.min.js', 'three.LICENSE.txt',
  'peerjs.min.js', 'PEERJS-LICENSE.txt', 'proteins.html', 'spatial.html', 'README.txt', 'version.json', 'whatsnew.json', 'lowpoly.js']);
const APP_DIRS = new Set(['stories', 'audio', 'icons', 'p2p', 'room-test']);
const appFile = segs => (segs.length === 1 && APP_FILES.has(segs[0])) || (segs.length === 2 && APP_DIRS.has(segs[0]));

async function serve(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { return plain(res, 400, 'Bad path'); }
  const segs = p.split('/').filter(Boolean);
  // no way out of the folder and nothing hidden: no '..', no dot files (.git), no backslashes, no NUL
  if (p.includes('\0') || p.includes('\\') || segs.some(s => s.startsWith('.'))) return plain(res, 404, 'Not found');
  // the app under s/<n>/ as well: a room's fresh shared space (Quest Browser keeps one shared space per page
  // address, and two headsets had each kept their own copy of the old one; shared.js, SG)
  if (segs[0] === 's' && /^\d{1,4}$/.test(segs[1] || '')) {
    if (segs.length === 2 && !p.endsWith('/')) return plain(res, 301, 'Moved', { Location: url.pathname + '/' + url.search });
    segs.splice(0, 2);
  }
  if (!segs.length || p.endsWith('/')) segs.push('index.html');   // / is the app, a folder its index.html; no listings
  if (!appFile(segs)) return plain(res, 404, 'Not found');
  const file = path.join(REAL, ...segs);
  let st;
  try {
    st = await fs.promises.stat(file);
    const real = await fs.promises.realpath(file);   // a link must lead to an app file too, not out of the folder
    if (!st.isFile() || !appFile(path.relative(REAL, real).split(path.sep))) throw new Error('not an app file');
  } catch { return plain(res, 404, 'Not found'); }
  // (the release's version file and what is new in it are never kept: live updates compare the first with what a page
  // runs, and developer mode shows the second)
  return sendFile(req, res, file, st, { cache: /^(version|whatsnew)\.json$/.test(segs.join('/')) ? 'no-store' : 'no-cache' });
}
// a file as the app's and the scenes' are sent: an ETag from its size and time (304 when it matches), Cache-Control
// no-cache (asked again each time, so a changed file is never stale), one byte range (the audio element asks for them),
// text gzipped (squeeze: the app's files; a scene's are models, pictures and sounds, already packed)
async function sendFile(req, res, file, st, { cache = 'no-cache', squeeze = true, extra = {}, type = '' } = {}) {
  type = type || TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
  const base = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
  const useRange = range && (range[1] || range[2]) && (!req.headers['if-range'] || req.headers['if-range'] === base);
  const zip = squeeze && !useRange && SQUEEZE.test(type) && st.size > 1024 && st.size < 32 * MAX_MSG && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const etag = zip ? base.slice(0, -1) + '-gz"' : base;
  const head = { 'Content-Type': type, 'Cache-Control': cache, ETag: etag, 'Last-Modified': st.mtime.toUTCString(), 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
    ...(squeeze && SQUEEZE.test(type) ? { Vary: 'Accept-Encoding' } : {}), ...extra };
  if (String(req.headers['if-none-match'] || '').split(',').some(t => t.trim().replace(/^W\//, '') === etag)) { res.writeHead(304, head); return res.end(); }
  const stream = (opts, status, more) => {
    res.writeHead(status, { ...head, ...more });
    if (req.method === 'HEAD') return res.end();
    pipeline(fs.createReadStream(file, opts), res, () => {});   // a download cut short closes the file too
  };
  if (useRange) {   // one range (the audio element asks for them); several ranges get the whole file
    let start = range[1] ? +range[1] : Math.max(0, st.size - +range[2]), end = range[1] && range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
    if (start >= st.size || start > end || (!range[1] && +range[2] === 0)) return reply(res, 416, '', type, { 'Content-Range': `bytes */${st.size}` });
    return stream({ start, end }, 206, { 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
  }
  if (zip) {
    let z = GZ.get(file);
    if (!z || z.etag !== base) GZ.set(file, z = { etag: base, buf: await gzip(await fs.promises.readFile(file)) });
    res.writeHead(200, { ...head, 'Content-Encoding': 'gzip', 'Content-Length': z.buf.length });
    return res.end(req.method === 'HEAD' ? undefined : z.buf);
  }
  stream({}, 200, { 'Content-Length': st.size });
}

// ---- --watch: while developing, the pages the relay serves follow the app's files (index.html's HOST.live). /api/ping
// says watch: true; /api/watch is a stream of Server-Sent Events: hello (the fingerprints of the shell's files and the
// stories, at once: a page that connects again after a restart catches up), then as files change story { key, fp }
// (swapped in place where it is on show), list (the list of stories, read again), shell { file, fp } (the page reloads
// with its place kept) and, with --build, build { key, ok, ms, out } (a built story's build ran: its sources in tools/
// changed; one build at a time, a moment after the last change). The fingerprint is index.html's HOST.fingerprint.
function fingerprint(s) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
}
const WATCH = OPT.watch ? fs.realpathSync(path.resolve(OPT.watch === true ? OPT.static : OPT.watch)) : '';
const SHELL_FILES = ['index.html', 'sfx.js', 'occlusion.js', 'ships.js', 'shared.js', 'sw.js', 'three.min.js', 'peerjs.min.js'];
const STORY_FILE = /^([a-z][a-z0-9-]{0,31})\.js$/;
const W = { fps: new Map(), timers: new Map(), clients: new Set(), builds: new Map(), queue: new Set(), building: '', buildT: 0 };
const MAX_WATCHERS = 200;
const sse = (res, event, data) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* gone */ } };
const tell = (event, data) => { for (const res of W.clients) sse(res, event, data); };
const fpOf = f => { try { return fingerprint(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return ''; } };
function hello() {
  const shell = {}, stories = {};
  for (const f of SHELL_FILES) shell[f] = W.fps.get(path.join(WATCH, f)) || '';
  for (const [f, fp] of W.fps) {
    const m = path.dirname(f) === path.join(WATCH, 'stories') && STORY_FILE.exec(path.basename(f));
    if (m && m[1] !== 'list') stories[m[1]] = fp;
  }
  return { shell, stories, list: W.fps.get(path.join(WATCH, 'stories', 'list.js')) || '', build: OPT.build };
}
function watchStream(req, res) {
  if (!WATCH) return json(res, 404, { error: 'not watching (start the relay with --watch)' });
  if (W.clients.size >= MAX_WATCHERS) return json(res, 503, { error: 'too many pages watching' });
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 2000\n\n');
  sse(res, 'hello', hello());
  W.clients.add(res);
  req.on('close', () => W.clients.delete(res));
}
// a file changed (an editor may write it in parts, or replace it): looked at once it has been quiet for a moment, and
// told only when its text really changed
function changedFile(f, kind) {
  clearTimeout(W.timers.get(f));
  W.timers.set(f, setTimeout(() => {
    W.timers.delete(f);
    const fp = fpOf(f);
    if (!fp || fp === W.fps.get(f)) return;
    W.fps.set(f, fp);
    const name = path.basename(f);
    if (kind === 'shell') { log(`watch: ${name} changed (pages reload)`); tell('shell', { file: name, fp }); return; }
    const key = STORY_FILE.exec(name)[1];
    if (key === 'list') { log('watch: the list of stories changed'); tell('list', { fp }); }
    else { log(`watch: stories/${name} changed`); tell('story', { key, fp }); }
    if (OPT.build) for (const [k, b] of W.builds) if (b.files.has('stories/' + name)) wantBuild(k);
  }, 150));
}
// --build: which sources each built story reads, from its build script: its own folder, the folders it names as
// ../<dir>/ (the tour's kit and sets, the muscle story's motor set...) and the story files it takes in (the pass story
// cuts the globe and the cell out of the airports and cell map stories). Folders whose files a build or a tool writes
// (shots, gen) and the data generators' folders are not sources.
function buildMap() {
  const dir = path.join(WATCH, 'tools');
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const k of names) {
    const f = path.join(dir, k, 'build.mjs');
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const dirs = new Set([k]), files = new Set();
    for (const m of src.matchAll(/['"`]\.\.\/([\w-]+)\//g)) dirs.add(m[1]);
    for (const m of src.matchAll(/['"`]stories\/([\w-]+\.js)['"`]/g)) if (m[1] !== k + '.js') files.add('stories/' + m[1]);
    W.builds.set(k, { dirs, files });
  }
}
const SKIP = /(^|[\\/])(shots|gen|data|node_modules)([\\/]|$)/;
function sourceChanged(rel) {
  const parts = rel.split(/[\\/]/);
  if (parts.length < 2 || !/\.js$/.test(rel) || SKIP.test(parts.slice(1, -1).join('/'))) return;
  const f = path.join(WATCH, 'tools', rel), fp = fpOf(f);
  if (!fp || fp === W.fps.get(f)) return;
  W.fps.set(f, fp);
  for (const [k, b] of W.builds) if (b.dirs.has(parts[0])) wantBuild(k);
}
function wantBuild(k) {
  W.queue.add(k);
  clearTimeout(W.buildT);
  W.buildT = setTimeout(nextBuild, 300);
}
function nextBuild() {
  if (W.building || !W.queue.size) return;
  const k = W.queue.values().next().value;
  W.queue.delete(k);
  W.building = k;
  const t0 = Date.now();
  log(`build: ${k}...`);
  execFile(process.execPath, [path.join(WATCH, 'tools', k, 'build.mjs')], { cwd: WATCH, timeout: 180000, maxBuffer: 4 << 20 }, (err, out, errOut) => {
    W.building = '';
    const ms = Date.now() - t0, text = (String(out || '') + String(errOut || '')).slice(-2000);
    log(`build: ${k} ${err ? 'failed' : 'done'} in ${ms} ms${err ? ': ' + text.trim().split('\n').slice(-1)[0] : ''}`);
    tell('build', { key: k, ok: !err, ms, out: text });
    nextBuild();
  });
}
function startWatch() {
  if (!WATCH) return;
  const stories = path.join(WATCH, 'stories');
  for (const f of SHELL_FILES) { const fp = fpOf(path.join(WATCH, f)); if (fp) W.fps.set(path.join(WATCH, f), fp); }
  for (const n of fs.readdirSync(stories)) if (STORY_FILE.test(n)) W.fps.set(path.join(stories, n), fpOf(path.join(stories, n)));
  // (the folders, not the files: editors often save by writing a new file in the old one's place)
  const lost = err => console.log('--watch stopped watching a folder: ' + err.message);
  fs.watch(WATCH, (ev, name) => { if (name && SHELL_FILES.includes(String(name))) changedFile(path.join(WATCH, String(name)), 'shell'); }).on('error', lost);
  fs.watch(stories, (ev, name) => { if (name && STORY_FILE.test(String(name))) changedFile(path.join(stories, String(name)), 'story'); }).on('error', lost);
  if (OPT.build) {
    buildMap();
    try {
      fs.watch(path.join(WATCH, 'tools'), { recursive: true }, (ev, name) => {
        if (!name) return;
        const rel = String(name);
        clearTimeout(W.timers.get(rel));
        W.timers.set(rel, setTimeout(() => { W.timers.delete(rel); if (/(^|[\\/])build\.mjs$/.test(rel)) buildMap(); else sourceChanged(rel); }, 150));
      }).on('error', lost);
    } catch (err) { console.log('--build cannot watch tools/ here (' + err.message + '): it needs Node 20 or newer on Linux'); }
  }
  setInterval(() => { for (const res of W.clients) { try { res.write(': still here\n\n'); } catch { /* gone */ } } }, 20000).unref();
}
startWatch();

// ---- the studio's scenes (--scenes <dir>; tools/studio/SPEC.md, "Where scenes come from"). Each subfolder is a scene;
// the listing rules are relay/scenes.mjs's, shared with tools/studio/scan.mjs (a plain folder's index.json and files.json
// say the same). GET /api/scenes lists them, GET /api/scenes/<name> gives one's files and layout, GET /scenes/<name>/<path>
// a file, POST /api/scenes/<name>/layout saves its layout.json, GET /api/scenes/watch streams changes. Everything behind
// the password when there is one, as the API is (the files are the owner's own work, not the app's).
const SAID = new Set();   // folders whose names cannot be a scene's: said once each
const sayBad = n => {
  if (SAID.has(n)) return;
  SAID.add(n);
  log(`scenes: left out the folder ${JSON.stringify(n.slice(0, 80))} (${n === 'watch' ? 'watch is the change stream\'s name' :
    'a scene\'s name: up to 64 letters, digits, spaces, _ . or -, not starting with a space, . or -'})`);
};
const scenesOut = all => all.map(summary);
// what R2 answered, as the page is told it (never R2's own body or an address)
const storeSays = err => `the scenes' storage (R2) ${err.status ? 'answered ' + err.status + (err.code ? ' ' + err.code : '') : 'could not be reached'}`;
function scenesApi(req, res, url) {
  const p = url.pathname;
  const failed = err => {
    log('scenes: ' + err.message);
    if (!res.headersSent) json(res, err instanceof R2Error ? 502 : 500, { error: err instanceof R2Error ? storeSays(err) : 'internal error' }); else res.destroy();
  };
  const no = () => json(res, 405, { error: 'method not allowed' });
  if (!SCENES_ON) return json(res, 404, { error: 'no scenes here (start the relay with --scenes <folder>)' });
  // (upload: this caller may upload, which the password above already said; ffmpeg: long sounds made MP3 here; with R2
  // store, direct (uploads may go straight to the bucket: .../put, .../done) and linkTtl (how long a file's link lives, s))
  if (p === '/api/scenes') {
    if (req.method === 'GET') return KEPT.all().then(all => json(res, 200, { scenes: scenesOut(all), save: SAVE, upload: SAVE, ffmpeg: !!FFMPEG, maxUpload: MAX_UPLOAD, ...KEPT.says() }), failed);
    return req.method === 'POST' ? makeScene(req, res).catch(failed) : no();
  }
  if (p === '/api/scenes/watch') return req.method === 'GET' ? scenesWatch(req, res).catch(failed) : no();
  const m = /^\/api\/scenes\/([^/]+)(?:\/(layout|file|sound|put|done|copy))?$/.exec(p);
  let name = '';
  try { name = m ? decodeURIComponent(m[1]) : ''; } catch { /* a bad escape: no such scene */ }
  if (!m) return json(res, 404, { error: 'not found' });
  if (m[2] === 'layout') return req.method === 'POST' ? saveLayout(req, res, name).catch(failed) : no();
  if (m[2] === 'put' || m[2] === 'done') return req.method === 'POST' ? direct(req, res, url, name, m[2]).catch(failed) : no();
  if (m[2] === 'copy') return req.method === 'POST' ? copyFile(req, res, name).catch(failed) : no();
  if (m[2]) return req.method === 'POST' ? upload(req, res, url, name, m[2] === 'sound').catch(failed) : no();
  if (req.method !== 'GET') return no();
  sceneOne(res, name).catch(failed);
}
async function sceneOne(res, name) {
  const s = await KEPT.one(name);
  if (!s) return json(res, 404, { error: 'no such scene' });
  json(res, 200, { name, files: s.files, layout: s.layout, layoutAt: s.layoutAt, save: SAVE, ...KEPT.says(true) });
}

// a scene's file. Its path is decoded once; '..', dot files (.history/), backslashes and NUL are refused, and so is
// anything whose real path (a link followed) leaves the scene's folder: 404, said in the log by its path (never its query,
// where a password may ride), at most 20 lines a minute
const REFUSED = { n: 0, t0: 0 };
function refusedPath(res, p, why) {
  const now = Date.now();
  if (now - REFUSED.t0 > 60000) { REFUSED.t0 = now; REFUSED.n = 0; }
  if (++REFUSED.n <= 20) log(`scenes: refused ${JSON.stringify(String(p).slice(0, 200))} (${why})`);
  else tally('scene files refused: paths out of their folder');
  plain(res, 404, 'Not found');
}
async function sceneFile(req, res, url) {
  if (cors(req, res)) return;   // (a page on another origin: GitHub Pages with &relay=; its preflight needs no password)
  if (!authOk(req, res, givenToken(req, url))) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Method not allowed', { Allow: 'GET, HEAD, OPTIONS' });
  // (the path as sent, not url.pathname: the URL parser resolves '..' and turns '\' into '/', which would hide them)
  const raw = String(req.url).split(/[?#]/)[0];
  let p;
  try { p = decodeURIComponent(raw); } catch { return refusedPath(res, raw, 'a bad escape'); }
  const segs = p.split('/').slice(2);   // ('', 'scenes', then the scene's name and the file's path)
  if (p.includes('\0') || p.includes('\\')) return refusedPath(res, raw, 'a backslash or NUL');
  if (!p.startsWith('/scenes/') || segs.some(x => x === '.' || x === '..')) return refusedPath(res, raw, 'out of its folder');
  if (segs.length < 2 || segs.some(x => !x || x.startsWith('.')) || !validName(segs[0]) || segs.length > MAX_DEPTH + 2) return plain(res, 404, 'Not found');
  return KEPT.send(req, res, segs, raw);
}
// a folder's file, sent from the disk
async function folderSend(req, res, segs, raw) {
  const dir = await sceneDir(SCENES, segs[0]);
  if (!dir) return plain(res, 404, 'Not found');
  const file = path.join(dir, ...segs.slice(1));
  let st, real;
  try { real = await fs.promises.realpath(file); st = await fs.promises.stat(real); } catch { return plain(res, 404, 'Not found'); }
  if (!inside(dir, real)) return refusedPath(res, raw, 'a link out of its folder');
  if (!st.isFile()) return plain(res, 404, 'Not found');
  // (only a model's, picture's, sound's or data's own type, and a recording's JSON: anything else, such as a page or a
  // script kept in originals/, is plain bytes to save, never run on this origin, where the app and its password live; and
  // nothing here runs anyway)
  const rec = isRecording(segs.slice(1).join('/')), k = rec ? 'recording' : kindOf(real);
  const type = rec ? 'application/json' : k === 'other' ? 'application/octet-stream' : TYPES[path.extname(real).toLowerCase()] || 'application/octet-stream';
  return sendFile(req, res, real, st, { squeeze: false, type, extra: { 'Access-Control-Expose-Headers': 'ETag, Content-Range, Accept-Ranges',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox", ...(k === 'other' ? { 'Content-Disposition': 'attachment' } : {}) } });
}

// POST /api/scenes/<name>/layout: layout.json written whole (a temporary file renamed over it, so it is never half
// written or missing), the old one copied into the scene's .history/ first (layout-<time>.json, the newest 20 kept).
// One save at a time per scene.
const HISTORY = 20, SAVING = new Map();
async function saveLayout(req, res, name) {
  const early = (status, error) => answerEarly(req, res, status, { error }, { Connection: 'close' });
  if (!SAVE) return early(403, 'saving is off on this relay (--scenes-readonly): use Download layout.json');
  const dir = await KEPT.where(name);   // (a folder's path, or R2's scene name)
  if (!dir) return early(404, 'no such scene');
  if (+req.headers['content-length'] > MAX_LAYOUT) return early(413, 'a layout is at most 2 MB');
  // (as every small body: past its limit answered and the rest thrown away for a while, then the socket closed)
  const body = await smallBody(req, res, MAX_LAYOUT, 'a layout is at most 2 MB');
  if (body === null) return;
  let v, text;
  try { v = JSON.parse(body); text = isLayout(v) ? layoutText(v) : ''; } catch { /* said below */ }
  if (!text) return json(res, 400, { error: 'not a layout: a JSON object with studio: 1' });
  const job = (SAVING.get(dir) || Promise.resolve()).then(() => KEPT.writeLayout(dir, text));
  const done = job.catch(() => {});
  SAVING.set(dir, done);
  done.then(() => { if (SAVING.get(dir) === done) SAVING.delete(dir); });
  try {
    const r = await job;
    log(`scenes: ${name} saved its layout (${r.bytes} bytes)`);
    sceneTold(name, '', async () => r.sig);
    json(res, 200, { ok: true, at: r.at, bytes: r.bytes });
  } catch (err) {
    log(`scenes: ${name} could not save its layout (${err instanceof R2Error ? err.message : err.code || err.message})`);
    if (err instanceof R2Error) json(res, 502, { error: storeSays(err) }); else json(res, 500, { error: 'cannot write layout.json (' + (err.code || 'error') + ')' });
  }
}
async function writeLayout(dir, text) {
  const file = path.join(dir, LAYOUT), hist = path.join(dir, '.history');
  let old = null;
  try { old = await fs.promises.stat(file); } catch { /* the first save */ }
  if (old && old.isFile()) {
    await fs.promises.mkdir(hist, { recursive: true });
    // (the time in the name with - for :, which Windows does not allow; never two saves in one millisecond)
    let h;
    for (;;) {
      h = path.join(hist, `layout-${new Date().toISOString().replace(/:/g, '-')}.json`);
      try { await fs.promises.copyFile(file, h, fs.constants.COPYFILE_EXCL); break; } catch (err) { if (err.code !== 'EEXIST') throw err; }
      await new Promise(r => setTimeout(r, 2));
    }
    const kept = (await fs.promises.readdir(hist)).filter(n => /^layout-.+\.json$/.test(n)).sort();
    for (const n of kept.slice(0, Math.max(0, kept.length - HISTORY))) await fs.promises.rm(path.join(hist, n), { force: true });
  }
  const tmp = path.join(dir, `.layout-${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`);
  try {
    const fh = await fs.promises.open(tmp, 'wx');
    try { await fh.writeFile(text); await fh.sync(); } finally { await fh.close(); }
    await fs.promises.rename(tmp, file);
  } catch (err) { await fs.promises.rm(tmp, { force: true }); throw err; }
  const st = await fs.promises.stat(file);
  return { at: Math.floor(st.mtimeMs), bytes: st.size, sig: `${st.size}:${Math.floor(st.mtimeMs)}:${st.ino}` };
}

// ---- uploads (the studio's Upload pane; tools/studio/SPEC.md, "The upload page"). POST /api/scenes makes a scene's
// folder; POST /api/scenes/<name>/file?path=<path>[&replace=1] writes one file as it is sent; POST
// /api/scenes/<name>/sound?path=<path>.mp3[&replace=1] has ffmpeg make a sound a mono MP3 first. A file is received into
// a temporary dot file beside where it goes (the listing and the watch leave those out), counted against --max-upload as
// it streams in, and renamed into place whole, so a page never sees half a file; anything refused or cut short leaves
// nothing behind (nor the folders made for it, when they are empty). All behind the password, as every scene endpoint.
const NO_SAVE = 'saving is off on this relay (--scenes-readonly): nothing is written';
const TOO_BIG = `a file is at most ${+(MAX_UPLOAD / (1 << 20)).toFixed(2)} MB here (--max-upload)`;
// the most a file at that path may hold (uploadPath's want): --max-upload, and a model's picture under previews/ or a
// recording under recordings/ less (relay/scenes.mjs, MAX_PREVIEW and MAX_RECORDING: uploadPath gives it as want.max),
// with its own words
const capOf = want => Math.min(MAX_UPLOAD, want && want.max ? want.max : Infinity);
const capWord = want => (want && want.kind === 'recording' ? 'a recording in recordings/' : 'a picture in previews/');
const bigFor = want => (capOf(want) < MAX_UPLOAD ? `${capWord(want)} is at most ${want.kind === 'recording' ? +(capOf(want) / (1 << 20)).toFixed(2) + ' MB' : Math.round(capOf(want) / 1024) + ' KB'}` : TOO_BIG);
const UPLOAD_IDLE = 120000;   // an upload with no byte for this long is given up (server.requestTimeout is off for slow ones)
const DRAIN = 16 << 20;
const FF = { running: 0, procs: new Set() };
const lstatOf = f => fs.promises.lstat(f).catch(() => null);
const tmpName = () => `.upload-${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`;
// an answer given before the body is read (or past its limit): the rest of the body read and thrown away, so the answer
// reaches the page (a socket closed with unread data may lose it on the way), but not for ever
function answerEarly(req, res, status, body, extra) {
  if (!res.headersSent) json(res, status, body, extra);
  if (req.complete || req.destroyed) return;
  let n = 0;
  const stop = () => { clearTimeout(t); req.socket.destroy(); };
  const t = setTimeout(stop, 10000);
  req.on('data', c => { if ((n += c.length) > DRAIN) stop(); });
  req.on('end', () => clearTimeout(t));
  req.on('close', () => clearTimeout(t));
  req.resume();
}
// a small body (JSON) as text, or null when it was too big (answered) or cut short
function smallBody(req, res, max, error = 'body too big') {
  return new Promise(done => {
    const parts = [];
    let n = 0, over = false;
    req.on('data', c => { if (over) return; if ((n += c.length) <= max) parts.push(c); else { over = true; answerEarly(req, res, 413, { error }); done(null); } });
    req.on('end', () => { if (!over) done(Buffer.concat(parts).toString()); });
    req.on('error', () => done(null));
    req.on('close', () => { if (!req.complete) done(null); });
  });
}

// POST /api/scenes { name }: a new scene, an empty folder (the scene name rule; 409 when there is one, or a file, by that name)
async function makeScene(req, res) {
  if (!SAVE) return answerEarly(req, res, 403, { error: NO_SAVE });
  const text = await smallBody(req, res, 16384);
  if (text === null) return;
  let b = null;
  try { b = JSON.parse(text); } catch { /* said below */ }
  const name = b && typeof b === 'object' && !Array.isArray(b) ? b.name : undefined;
  if (typeof name !== 'string') return json(res, 400, { error: 'the body is { "name": "<the scene\'s name>" }' });
  if (!newSceneName(name)) return json(res, 400, { error: name === 'watch' ? 'watch is the change stream\'s name' : 'a scene\'s name: up to 64 letters, digits, spaces, _ . or -, not starting with a space, . or -, not ending in a space or a dot, and not a device name (con, nul...)' });
  let made;
  try { made = await KEPT.make(name); } catch (err) {
    if (err instanceof R2Error) throw err;
    log(`scenes: could not make the scene ${JSON.stringify(name)} (${err.code || err.message})`);
    return json(res, 500, { error: 'cannot make its folder (' + (err.code || 'error') + ')' });
  }
  if (made === 'full') return json(res, 507, { error: `at most ${MAX_SCENES} scenes` });
  if (made === 'exists') return json(res, 409, { error: 'there is a scene (or a file) by that name' });
  log(`scenes: made the scene ${JSON.stringify(name)}`);
  sceneTold();
  json(res, 201, { ok: true, name });
}

// a folder's scene made: an empty folder (the scene folders counted, not walked: a scene's files do not matter here)
async function folderMake(name) {
  const folders = (await fs.promises.readdir(SCENES, { withFileTypes: true }).catch(() => [])).filter(e => validName(e.name) && (e.isDirectory() || e.isSymbolicLink()));
  if (folders.length >= MAX_SCENES) return 'full';
  try { await fs.promises.mkdir(path.join(SCENES, name)); } catch (err) { if (err.code === 'EEXIST') return 'exists'; throw err; }
  return 'made';
}

// POST /api/scenes/<name>/file and .../sound: the body's bytes as the file at ?path= (relay/scenes.mjs, uploadPath, says
// which paths); sound: ffmpeg's mono MP3 of them (with R2, also of a file already in the scene: ?from=<its path>)
async function upload(req, res, url, name, sound) {
  const no = (status, error, extra) => answerEarly(req, res, status, { error }, extra);
  if (!SAVE) return no(403, NO_SAVE);
  if (sound && !FFMPEG) return no(501, 'this relay has no ffmpeg to make sounds MP3 (install ffmpeg, or name it with --ffmpeg <path>)');
  const dir = await KEPT.where(name);
  if (!dir) return no(404, 'no such scene');
  const want = uploadPath(url.searchParams.get('path'));
  if (want.error) return no(400, want.error);
  if (sound && !/\.mp3$/i.test(want.rel)) return no(400, 'a sound made here is an MP3: a path ending in .mp3 (sounds/<name>.mp3)');
  if (url.searchParams.has('from') && !(sound && R2C)) return no(400, 'from= goes with .../sound on a relay whose scenes are kept in R2');
  if (R2C) return r2Upload(req, res, url, name, want, sound);
  const replace = url.searchParams.get('replace') === '1', dest = path.join(dir, ...want.segs), folder = path.dirname(dest);
  const there = await lstatOf(dest);
  if (there && there.isDirectory()) return no(409, 'there is a folder by that name');
  if (there && !replace) return no(409, 'there is a file by that name (replace=1 replaces it)');
  if (+req.headers['content-length'] > capOf(want)) return no(413, bigFor(want));
  // (two sounds at once at most: each conversion takes a core or two for seconds; the body says when to try again too,
  // since a page on another origin cannot read Retry-After unless it is exposed. The slot is taken at once, before
  // anything is awaited, so uploads that come together cannot all pass)
  if (sound && FF.running >= FF_MAX) return answerEarly(req, res, 429, { error: `${FF_MAX} sounds are being made already: try again in a few seconds`, retry: 5 }, { 'Retry-After': '5', 'Access-Control-Expose-Headers': 'Retry-After' });
  if (sound) FF.running++;
  try { await uploadInto(req, res, { name, dir, folder, dest, want, replace, there, sound }); } finally { if (sound) FF.running--; }
}
// where a new file of a scene's folder may go (an upload's, a copy's): [status, error] when it may not, else null. A new
// file in a scene that has as many as a listing shows is refused, rather than taken and never listed; and the deepest
// folder of the path that is there already must be inside the scene: a link in the scene that leads out refuses the path
// before anything is made outside
async function folderRoom(dir, folder, there, what) {
  if (!there && (await sceneFiles(dir)).files.length >= MAX_FILES) return [507, `a scene holds at most ${MAX_FILES} files: this one is full`];
  for (let at = folder; ; at = path.dirname(at)) {
    let real = '';
    try { real = await fs.promises.realpath(at); } catch (err) {
      if (err.code === 'ENOENT' && at !== dir) continue;
      if (err.code === 'ENOTDIR') return [409, 'a file stands where a folder of the path should be'];
      throw err;
    }
    if (!inside(dir, real)) { log(`scenes: refused ${what} (a folder of it leads out of the scene)`); return [400, 'a folder of the path leads out of the scene']; }
    return null;
  }
}
async function uploadInto(req, res, { name, dir, folder, dest, want, replace, there, sound }) {
  const no = (status, error) => answerEarly(req, res, status, { error });
  const stop = await folderRoom(dir, folder, there, `an upload to ${JSON.stringify(name + '/' + want.rel)}`);
  if (stop) return no(...stop);
  // (answered once everything else is done: a page told 413 or 500 finds nothing of its upload left)
  const job = { tmp: '', inDir: '', made: undefined, placed: false };
  let answer = null;
  try { answer = await uploadJob(req, job, { name, dir, folder, dest, want, replace, there, sound }); } finally {
    if (job.tmp) await fs.promises.rm(job.tmp, { force: true }).catch(() => {});
    if (job.inDir) await fs.promises.rm(job.inDir, { recursive: true, force: true }).catch(() => {});
    if (!job.placed && job.made) await unmake(folder, job.made);
  }
  if (answer) answerEarly(req, res, ...answer);
}
// an upload's work: [status, body] to answer, or null when the page has gone
async function uploadJob(req, job, { name, dir, folder, dest, want, replace, there, sound }) {
  try { job.made = await fs.promises.mkdir(folder, { recursive: true }); } catch { return [409, { error: 'a file stands where a folder of the path should be' }]; }
  job.tmp = path.join(folder, tmpName());
  let into = job.tmp;
  if (sound) { job.inDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'relay-sound-')); into = path.join(job.inDir, 'in'); }
  const t0 = Date.now(), got = await receive(req, into, capOf(want));
  if (got.over) return [413, { error: bigFor(want) }];
  if (got.cut) { log(`scenes: ${name}: an upload of ${want.rel} was cut short (${got.n} bytes came)`); return null; }
  if (got.err) {
    log(`scenes: ${name}: could not write ${want.rel} (${got.err.code || got.err.message})`);
    return [got.err.code === 'ENOSPC' ? 507 : 500, { error: 'cannot write the file (' + (got.err.code || 'error') + ')' }];
  }
  let how = '';
  if (sound) {
    const t1 = Date.now(), r = await ffmpeg(into, job.tmp);
    const size = (await lstatOf(job.tmp))?.size || 0, said = ffSaid(r.err, [into, job.tmp, job.inDir, folder, dir]);
    const fail = (status, error, why) => { log(`scenes: ${name}: no MP3 for ${want.rel} (${why}${said ? ': ' + said : ''})`); return [status, { error }]; };
    if (r.late) return fail(500, `making the MP3 took more than ${OPT['ffmpeg-limit']} s`, 'stopped after ' + OPT['ffmpeg-limit'] + ' s');
    if (!r.ran) return fail(500, 'ffmpeg did not run', r.why);
    if (r.code !== 0) return fail(422, 'ffmpeg could not make an MP3 of it (is it a sound?)', r.sig ? 'ffmpeg ended by ' + r.sig : 'ffmpeg exit ' + r.code);
    if (!size) return fail(422, 'ffmpeg made nothing of it (is it a sound?)', 'an empty MP3');
    how = ` as a mono MP3 (${mb(got.n)} given, ffmpeg ${((Date.now() - t1) / 1000).toFixed(1)} s)`;
  }
  if (!(job.placed = await place(job.tmp, dest, replace))) return [409, { error: 'there is a file by that name (replace=1 replaces it)' }];
  job.tmp = '';
  const st = await fs.promises.stat(dest);
  log(`scenes: ${name}: wrote ${want.rel} (${mb(st.size)} in ${((Date.now() - t0) / 1000).toFixed(1)} s)${how}${there ? ', replacing it' : ''}`);
  sceneTold(name, want.rel, () => fs.promises.stat(dest).then(x => `${x.size}:${Math.floor(x.mtimeMs)}:${x.ino}`, () => null));
  return [200, { ok: true, path: want.rel, bytes: st.size, at: Math.floor(st.mtimeMs) }];
}
const mb = n => (n < 1e6 ? (n / 1e3).toFixed(1) + ' kB' : (n / 1e6).toFixed(1) + ' MB');
// the folders made for an upload that did not land, from the deepest up to the first one made, while they are empty
async function unmake(folder, made) {
  for (let at = folder; ; at = path.dirname(at)) {
    try { await fs.promises.rmdir(at); } catch { return; }
    if (at === made || path.dirname(at) === at) return;
  }
}
// POST /api/scenes/<name>/copy { from, path, as?, replace? } (the studio's Add pane, From another scene...): one file of
// another scene copied into this one, so each scene keeps its own files. The source: a file of the scene from that its
// listing shows (not its layout.json or files.json, no dot file, nothing in .history/), at most --max-upload. Where it
// goes: as (else the same path), by an upload's rules (uploadPath: its path and kind), 409 when a file is there unless
// replace, 507 when the scene is full. A folder's copy is written to a temporary dot file beside where it goes and put in
// place whole (place: never half written, never over a file that came meanwhile); R2's is CopyObject (the bucket copies
// it: nothing passes through the relay). Answered as an upload is ({ ok, path, bytes, at }), the watch told at once
async function copyFile(req, res, name) {
  if (!SAVE) return answerEarly(req, res, 403, { error: NO_SAVE });
  const text = await smallBody(req, res, 16384);
  if (text === null) return;
  let b = null;
  try { b = JSON.parse(text); } catch { /* said below */ }
  const str = v => typeof v === 'string';
  if (!b || typeof b !== 'object' || Array.isArray(b) || !str(b.from) || !str(b.path) || (b.as !== undefined && !str(b.as)) || (b.replace !== undefined && typeof b.replace !== 'boolean')) {
    return json(res, 400, { error: 'the body is { "from": "<the scene it is in>", "path": "<its path there>", "as": "<its path here>" (optional), "replace": true (optional) }' });
  }
  const dir = await KEPT.where(name);
  if (!dir) return json(res, 404, { error: 'no such scene' });
  const fromDir = await KEPT.where(b.from);
  if (!fromDir) return json(res, 404, { error: 'no such scene to copy from' });
  if (b.path.length > MAX_PATH || !listable(b.path) || b.path === LAYOUT || b.path === LISTING) return json(res, 400, { error: 'path: a file the scene lists (not its layout.json or files.json, no dot files or .history/, at most 4 folders deep)' });
  const want = uploadPath(b.as === undefined ? b.path : b.as);
  if (want.error) return json(res, 400, { error: want.error });
  if (b.from === name && want.rel === b.path) return json(res, 400, { error: 'that is the file itself' });
  const job = { name, dir, from: b.from, fromDir, src: b.path, want, replace: b.replace === true };
  const [status, body] = R2C ? await r2Copy(job) : await folderCopy(job);
  json(res, status, body);
}
async function folderCopy({ name, dir, from, fromDir, src, want, replace }) {
  const file = path.join(fromDir, ...src.split('/'));
  let real = '', st = null;
  try { real = await fs.promises.realpath(file); st = await fs.promises.stat(real); } catch { /* none */ }
  if (!st || !st.isFile()) return [404, { error: `there is no file ${src} in ${from}` }];
  if (!inside(fromDir, real)) { log(`scenes: refused a copy from ${JSON.stringify(from + '/' + src)} (a link out of its folder)`); return [404, { error: `there is no file ${src} in ${from}` }]; }
  if (st.size > capOf(want)) return [413, { error: bigFor(want) }];
  const dest = path.join(dir, ...want.segs), folder = path.dirname(dest), there = await lstatOf(dest);
  if (there && there.isDirectory()) return [409, { error: 'there is a folder by that name' }];
  if (there && !replace) return [409, { error: 'there is a file by that name (replace: true replaces it)' }];
  const stop = await folderRoom(dir, folder, there, `a copy to ${JSON.stringify(name + '/' + want.rel)}`);
  if (stop) return [stop[0], { error: stop[1] }];
  let made, tmp = '', placed = false;
  try {
    try { made = await fs.promises.mkdir(folder, { recursive: true }); } catch { return [409, { error: 'a file stands where a folder of the path should be' }]; }
    tmp = path.join(folder, tmpName());
    try { await fs.promises.copyFile(real, tmp, fs.constants.COPYFILE_EXCL); } catch (err) {
      log(`scenes: ${name}: could not copy ${from}/${src} (${err.code || err.message})`);
      return [err.code === 'ENOSPC' ? 507 : 500, { error: 'cannot write the file (' + (err.code || 'error') + ')' }];
    }
    if (!(placed = await place(tmp, dest, replace))) return [409, { error: 'there is a file by that name (replace: true replaces it)' }];
    tmp = '';
  } finally {
    if (tmp) await fs.promises.rm(tmp, { force: true }).catch(() => {});
    if (!placed && made) await unmake(folder, made);
  }
  const at = await fs.promises.stat(dest);
  log(`scenes: ${name}: copied ${want.rel} from ${from}/${src} (${mb(at.size)})${there ? ', replacing it' : ''}`);
  sceneTold(name, want.rel, () => fs.promises.stat(dest).then(x => `${x.size}:${Math.floor(x.mtimeMs)}:${x.ino}`, () => null));
  return [200, { ok: true, path: want.rel, bytes: at.size, at: Math.floor(at.mtimeMs) }];
}
// R2: the bucket copies the object (CopyObject, signed with its x-amz-copy-source), after the same checks as an upload's
// (r2InTheWay: what stands where it goes). The bucket is not asked to refuse an object there (conditions on a copy differ
// from store to store): of two copies to one new name at once, the second may replace the first, as a save would
async function r2Copy({ name, from, src, want, replace }) {
  const S = (await r2Listing(from)).rels.get(src);
  if (!S) return [404, { error: `there is no file ${src} in ${from}` }];
  if (S.size > capOf(want)) return [413, { error: bigFor(want) }];
  const L = await r2Listing(name), stop = r2InTheWay(L, want, replace);
  if (stop) return [stop[0], { error: stop[0] === 409 && /replace=1/.test(stop[1]) ? 'there is a file by that name (replace: true replaces it)' : stop[1] }];
  const key = okey(name, want.rel);
  await RX.copy(S.key, key);
  r2Forget();
  const st = await RX.stat(key);
  log(`scenes: ${name}: copied ${want.rel} from ${from}/${src} in the bucket (${mb(st ? st.size : S.size)})${L.rels.has(want.rel) ? ', replacing it' : ''}`);
  if (st) sceneTold(name, want.rel, async () => sigR2(st));
  return [200, { ok: true, path: want.rel, bytes: st ? st.size : S.size, at: st ? st.at : Date.now() }];
}
// the body into a new file (never one that is there): { n } once it is all written and on the disk, { over } past
// --max-upload, { cut } when the page went (or sent nothing for 2 minutes), { err } when the disk would not take it.
// One write at a time (the request paused meanwhile), so a slow disk holds the page back rather than filling memory
function receive(req, file, max = MAX_UPLOAD) {
  return new Promise(done => {
    const open = fs.promises.open(file, 'wx');
    let n = 0, chain = open.then(() => {}), fin = false, idle = 0;
    // (a file that cannot be made, as in a folder gone or not writable, is said by finish: never an unhandled rejection,
    // which would end the relay and every room on it)
    chain.catch(() => {});
    const finish = async r => {
      if (fin) return;
      fin = true; clearTimeout(idle);
      try { await chain; } catch (err) { if (!r.over && !r.cut) r = { err }; }
      const fh = await open.catch(() => null);
      if (fh) {
        try { if (!r.over && !r.cut && !r.err) await fh.sync(); } catch (err) { r = { err }; }
        await fh.close().catch(() => {});
      }
      done({ n, ...r });
    };
    const wake = () => { clearTimeout(idle); idle = setTimeout(() => { finish({ cut: true }); req.socket.destroy(); }, UPLOAD_IDLE); };
    wake();
    req.on('data', c => {
      if (fin) return;
      wake();
      if ((n += c.length) > max) return finish({ over: true });
      req.pause();
      // (a failed write ends it from outside the chain: finish waits for the chain)
      chain = chain.then(() => open).then(fh => fh.write(c)).then(() => { if (!fin) req.resume(); }, err => { queueMicrotask(() => finish({ err })); });
    });
    req.on('end', () => finish({}));
    req.on('error', () => finish({ cut: true }));
    req.on('close', () => { if (!req.complete) finish({ cut: true }); });
  });
}
// a received file put where it goes in one step: renamed over what is there (replace=1), else linked in only while
// nothing is (two uploads of one new name at once: the second is told 409), or on a file system without links (FAT, some
// network shares) looked at, then renamed. False: something was there after all
async function place(tmp, dest, replace) {
  if (replace) { await fs.promises.rename(tmp, dest); return true; }
  try { await fs.promises.link(tmp, dest); } catch (err) {
    if (err.code === 'EEXIST' || (await lstatOf(dest))) return false;
    await fs.promises.rename(tmp, dest);
    return true;
  }
  await fs.promises.rm(tmp, { force: true });
  return true;
}
// ffmpeg: the sound's first audio stream as a mono MP3, 96 kbit/s at 44.1 kHz (SPEC: mono places best; MP3 plays
// everywhere, iPhones too), without the given file's tags or pictures. Never asks anything (-nostdin, stdin closed); stopped
// after --ffmpeg-limit seconds. Its words stay here: the page is told only what went wrong, in ours. Only sound and video
// containers are read, and only from the file given: never a playlist (HLS, concat), which could name other files on
// this computer or addresses on its network for ffmpeg to read into the MP3
const FF_FORMATS = 'mp3,wav,w64,aiff,flac,ogg,mov,aac,matroska,caf,amr,ac3,eac3,dts,wv,ape,au,asf,avi,mpegts,mpeg,flv,tta,mpc,mpc8,voc';
function ffmpeg(input, output) {
  return new Promise(done => {
    const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-protocol_whitelist', 'file', '-format_whitelist', FF_FORMATS,
      '-i', input, '-map', '0:a:0', '-vn', '-sn', '-dn', '-map_metadata', '-1',
      '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', '-f', 'mp3', output];
    let err = '', late = false, p;
    try { p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true }); } catch (e) { return done({ ran: false, why: e.code || e.message }); }
    FF.procs.add(p);
    p.stderr.on('data', d => { if (err.length < 16384) err += d; });
    const t = setTimeout(() => { late = true; p.kill('SIGKILL'); }, OPT['ffmpeg-limit'] * 1000);
    p.on('error', e => { clearTimeout(t); FF.procs.delete(p); done({ ran: false, why: e.code || e.message }); });
    p.on('close', (code, sig) => { clearTimeout(t); FF.procs.delete(p); done({ ran: true, code, sig, late, err }); });
  });
}
// what ffmpeg said, for the log: its last line, short, the temporary files' and the scene's paths taken out and never a
// query (where a password could ride)
function ffSaid(text, paths) {
  let line = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).pop() || '';
  for (const p of paths.filter(Boolean).sort((a, b) => b.length - a.length)) line = line.split(p).join('…');
  return scrub(line).replace(/\?[^\s'"]*/g, '?…').slice(0, 160);
}

// GET /upload: the studio's Upload pane. Sent there without a password (the pane asks for it, as for the API), and never
// with the request's query (a password may ride in it): the relay's own app when it serves one, else the app's public
// address with this relay's address (wss:// when the page reached it over HTTPS: its certificate, or behind --proxy the
// proxy's X-Forwarded-Proto)
function uploadPage(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  const go = to => { res.writeHead(302, { Location: to, 'Cache-Control': 'no-store', 'Content-Length': 0 }); res.end(); };
  if (ROOT) return go('/#studio&upload');
  const host = String(req.headers.host || '').trim().toLowerCase();
  if (!/^(?:[a-z0-9-]+\.)*[a-z0-9-]+(?::\d{1,5})?$|^\[[0-9a-f:.]+\](?::\d{1,5})?$/.test(host)) return plain(res, 400, 'Bad Host');
  const fwd = OPT.proxy ? String(req.headers['x-forwarded-proto'] || '').split(',').map(s => s.trim()).filter(Boolean) : [];
  const proto = fwd.length ? fwd[Math.max(0, fwd.length - OPT.proxy)].toLowerCase() : '';
  const secure = proto ? proto === 'https' || proto === 'wss' : !!OPT.cert;
  go(APP_URL + '#studio&upload&relay=' + encodeURIComponent((secure ? 'wss://' : 'ws://') + host));
}

// GET /api/scenes/watch: Server-Sent Events. hello { scenes } at once; scene { name, path, kind, gone } when a file is
// added, changed or removed, layout { name, at } when a layout.json is (gone: true when removed), scenes { scenes } when a
// scene comes or goes; a comment every 20 s. The folder is looked at every 2 s while anyone listens (not fs.watch, which
// differs by system and misses changes on shared folders), and a change is told once it has settled: the same for about
// 0.5 s (a copy in progress grows meanwhile). Never for .history/, dot or temporary files (the listing leaves them out).
const SW = { clients: new Set(), known: null, first: null, pending: new Map(), timer: 0, busy: false, beat: 0, q: Promise.resolve() };
const POLL_MS = R2C ? R2C.poll * 1000 : 2000;   // (R2: R2_POLL seconds, 5 by default; each look is one listing, a Class A operation)
// the watch's looks and the relay's own writes, one at a time (each compares with what the watch knows, and changes it)
const sceneSerial = fn => (SW.q = SW.q.then(fn).catch(err => log('scenes: watch: ' + err.message)));
// a write of the relay's own, told at once (an upload or a layout is whole when it lands: nothing to wait for) and taken
// into what the watch knows, so the next look does not tell it again: a file (name, rel, getSig: its signature as the
// watch keeps it, or null), a layout (rel ''), or with no name a scene made
function sceneTold(name, rel, getSig) {
  if (!SW.clients.size) return;
  sceneSerial(async () => {
    const old = SW.known;
    if (!old) return;
    if (!name) {
      const cur = await sceneState();
      if (SW.known !== old || cur.names === old.names) return;
      tellScenes('scenes', { scenes: cur.scenes });
      old.names = cur.names; old.scenes = cur.scenes;
      return;
    }
    if (!old.names.split('\0').includes(name)) return;   // (a scene the watch has not seen yet: its next look tells it)
    const sig = await getSig(), k = name + '\0' + rel;
    if (!sig || SW.known !== old) return;
    if (old.sig.get(k) === sig) return;
    old.sig.set(k, sig); SW.pending.delete(k);
    if (!rel) tellScenes('layout', { name, at: +sig.split(':')[1] });
    else tellScenes('scene', { name, path: rel, kind: kindAt(rel), gone: false });
  });
}
async function sceneState() {
  const all = await KEPT.all(true), sig = new Map();
  for (const s of all) {
    // (a file is changed when its size, time or inode (a folder), or its ETag (R2) is)
    for (const f of s.files) sig.set(s.name + '\0' + f.path, `${f.bytes}:${f.at}:${f.ino ?? f.etag}`);
    if (s.layout) sig.set(s.name + '\0', `${s.layout.size}:${Math.floor(s.layout.mtimeMs)}:${s.layout.ino ?? s.layout.etag}`);   // (its layout.json)
  }
  return { sig, scenes: scenesOut(all), names: all.map(s => s.name).join('\0') };
}
const tellScenes = (event, data) => { for (const res of SW.clients) sse(res, event, data); };
async function scenesWatch(req, res) {
  if (SW.clients.size >= MAX_WATCHERS) return json(res, 503, { error: 'too many pages watching' });
  let gone = false;
  res.on('close', () => { gone = true; if (SW.clients.delete(res) && !SW.clients.size) sceneQuiet(); });
  if (!SW.known) SW.known = await (SW.first ||= sceneState().finally(() => { SW.first = null; }));
  if (gone) return;
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 2000\n\n');
  sse(res, 'hello', { scenes: SW.known.scenes });
  SW.clients.add(res);
  if (!SW.timer && !SW.busy) SW.timer = setTimeout(scenePoll, POLL_MS);
  if (!SW.beat) SW.beat = setInterval(() => { for (const r of SW.clients) { try { r.write(': still here\n\n'); } catch { /* gone */ } } }, 20000);
}
function sceneQuiet() {   // nobody listens: nothing looked at, nothing kept
  clearTimeout(SW.timer); clearInterval(SW.beat);
  SW.timer = 0; SW.beat = 0; SW.known = null; SW.pending.clear();
}
async function scenePoll() {
  SW.timer = 0;
  if (!SW.clients.size || !SW.known) return sceneQuiet();
  SW.busy = true;
  await sceneSerial(sceneLook);
  SW.busy = false;
  if (SW.clients.size && SW.known) SW.timer = setTimeout(scenePoll, SW.pending.size ? 500 : POLL_MS);
  else sceneQuiet();
}
async function sceneLook() {
  const cur = await sceneState(), old = SW.known, now = Date.now();
  if (!old) return;
  for (const k of new Set([...old.sig.keys(), ...cur.sig.keys()])) {
    const a = old.sig.get(k), b = cur.sig.get(k);
    if (a === b) { SW.pending.delete(k); continue; }
    // (a folder's file settles first: a copy in progress grows meanwhile. An object in R2 lands whole: told at once)
    if (!R2C) {
      const p = SW.pending.get(k);
      if (!p || p.sig !== b) { SW.pending.set(k, { sig: b, since: now }); continue; }
      if (now - p.since < 450) continue;
    }
    SW.pending.delete(k);   // settled: told, and known from now on
    if (b === undefined) old.sig.delete(k); else old.sig.set(k, b);
    const [name, file] = k.split('\0');
    if (!file) tellScenes('layout', b === undefined ? { name, at: null, gone: true } : { name, at: +b.split(':')[1] });
    else tellScenes('scene', { name, path: file, kind: kindAt(file), gone: b === undefined });
  }
  if (cur.names !== old.names) tellScenes('scenes', { scenes: cur.scenes });
  old.names = cur.names; old.scenes = cur.scenes;
}

// ---- where the scenes are kept (KEPT): a folder (--scenes <dir>) or a Cloudflare R2 bucket (--scenes r2). Every scene
// endpoint above goes through it, so both keep the same rules (relay/scenes.mjs) and give the same answers: all(fresh) the
// scenes, [{ name, files, layout }]; one(name) a scene's answer ({ files, layout parsed, layoutAt }) or null; where(name)
// what writeLayout and the uploads take (a folder's path, R2's scene name), '' for no such scene; send(req, res, segs, raw)
// one of its files; writeLayout(where, text) { at, bytes, sig }; make(name) 'made', 'exists' or 'full'; says(one) what
// the answers add (R2: store, direct, linkTtl)
const folderStore = {
  all: () => allScenes(SCENES, sayBad),
  async one(name) {
    const dir = await sceneDir(SCENES, name);
    if (!dir) return null;
    const s = await sceneFiles(dir);
    return { files: s.files.map(fileOut), layout: s.layout ? await readLayout(dir) : null, layoutAt: layoutAt(s.layout) };
  },
  where: name => sceneDir(SCENES, name),
  send: folderSend, writeLayout, make: folderMake,
  says: () => ({}),
};

// ---- R2 (--scenes r2; relay/README.md, "Scenes in Cloudflare R2"). The bucket (under R2_PREFIX) holds a scene per first
// folder, as the folder of scenes does, by the same rules. The relay lists it in one go (everything under the prefix,
// kept 2 s, and listed again at once after a write of its own), answers a scene's listing with a signed link per file
// (the page fetches each straight from the bucket, from its own origin) and GET /scenes/... with a redirect to one,
// writes layouts and takes uploads into it (through the relay, or straight from the page: .../put and .../done), and its
// watch looks at it every R2_POLL seconds while a page listens. What R2 answers that is not expected becomes a short
// answer of ours (502, storeSays); a signed link is never logged.
const RX = R2C ? new R2(R2C) : null;
const okey = (name, rel = '') => R2C.prefix + name + '/' + rel;
const RC = { all: null, at: 0, gen: 0, job: null, jobGen: -1, warned: false, hist: '' };
const R2_KEEP = 2000, R2_LIMIT = 50000, PUT_TTL = 3600;
const UPR = { running: 0 }, UPR_MAX = 3;   // uploads through the relay at once (R2: each held in a temporary folder)
const sigR2 = o => `${o.size}:${o.at}:${o.etag}`;
async function r2All(fresh) {
  if (!fresh && RC.all && Date.now() - RC.at < R2_KEEP) return RC.all;
  if (RC.job && RC.jobGen === RC.gen) return RC.job;   // (one listing at a time, unless a write came since it began)
  const gen = RC.gen, t = Date.now();
  const job = (async () => {
    const r = await RX.listAll(R2C.prefix, { limit: R2_LIMIT });
    if (r.more && !RC.warned) { RC.warned = true; log(`scenes: the bucket holds more than ${R2_LIMIT} objects${R2C.prefix ? ' under ' + R2C.prefix : ''}: only the first are listed`); }
    const all = scenesOf(r.keys, R2C.prefix, sayBad);
    if (gen === RC.gen) { RC.all = all; RC.at = t; }
    return all;
  })().finally(() => { if (RC.job === job) RC.job = null; });
  RC.job = job; RC.jobGen = gen;
  return job;
}
const r2Forget = () => { RC.gen++; RC.at = 0; };   // (after a write of the relay's own: the next listing is a fresh one)
async function r2Scene(name, fresh) {
  if (!validName(name)) return null;
  let s = (await r2All(fresh)).find(x => x.name === name);
  if (!s && !fresh && Date.now() - RC.at > 500) s = (await r2All(true)).find(x => x.name === name);
  return s || null;
}
const r2Store = {
  all: fresh => r2All(fresh),
  async one(name) {
    const s = await r2Scene(name);
    if (!s) return null;
    let layout = null;
    if (s.layout && s.layout.size <= MAX_LAYOUT) {
      try { const v = JSON.parse(String(await RX.get(okey(name, LAYOUT)))); layout = v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch (err) { if (err instanceof R2Error) throw err; }
    }
    const now = Date.now();
    return { files: s.files.map(f => ({ ...fileOut(f), url: RX.getLink(okey(name, f.path), { at: f.at, now }) })), layout, layoutAt: layoutAt(s.layout) };
  },
  // (a scene is there while any object is under its name: in the listing, or looked for now)
  async where(name) {
    if (!validName(name)) return '';
    if ((await r2All()).some(x => x.name === name)) return name;
    return (await RX.list(okey(name), { max: 1 })).keys.length ? name : '';
  },
  send: r2Send, writeLayout: r2WriteLayout, make: r2Make,
  says: one => (one ? { linkTtl: R2C.ttl } : { store: 'r2', direct: SAVE && DIRECT.sign !== 'off', linkTtl: R2C.ttl }),
};
const KEPT = R2C ? r2Store : folderStore;

// GET /scenes/<name>/<path> with R2: the same checks as a folder's (above), then a redirect to the file's signed link: the
// browser downloads it from the bucket, with R2's own ranges, ETag and 304. Only a file the listing shows (or the scene's
// layout.json, as a folder serves it)
async function r2Send(req, res, segs) {
  const name = segs[0], rel = segs.slice(1).join('/');
  const find = s => (!s ? null : rel === LAYOUT ? (s.layout ? { at: s.layout.mtimeMs } : null) : s.files.find(f => f.path === rel));
  let f = find(await r2Scene(name));
  if (!f && Date.now() - RC.at > 1000) f = find(await r2Scene(name, true));
  if (!f) return plain(res, 404, 'Not found');
  res.writeHead(302, { Location: RX.getLink(okey(name, rel), { at: f.at }), 'Cache-Control': 'no-store', 'Content-Length': 0 });
  res.end();
}
// a layout saved into the bucket: the old one copied into .history/ first (unless the newest copy there is it already: a
// save that failed after copying, tried again, adds none), then layout.json put whole (an object lands whole: never half
// written), and only once that went in the oldest copies past 20 deleted (a save that keeps failing never costs history)
async function r2WriteLayout(name, text) {
  const key = okey(name, LAYOUT), old = await RX.stat(key);
  let kept = [];
  if (old) {
    kept = (await RX.listAll(okey(name, '.history/'))).keys.filter(o => /\/\.history\/layout-[^/]+\.json$/.test(o.key)).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const last = kept[kept.length - 1];
    if (!last || last.etag !== old.etag || last.size !== old.size) {
      let h = okey(name, `.history/layout-${new Date().toISOString().replace(/:/g, '-')}.json`);
      if (h === RC.hist) { await new Promise(r => setTimeout(r, 2)); h = okey(name, `.history/layout-${new Date().toISOString().replace(/:/g, '-')}.json`); }
      RC.hist = h;
      await RX.copy(key, h);
      kept.push({ key: h });
    }
  }
  await RX.put(key, Buffer.from(text), { type: 'application/json' });
  r2Forget();
  if (kept.length > HISTORY) await RX.delMany(kept.slice(0, kept.length - HISTORY).map(o => o.key)).catch(err => log(`scenes: ${name}: the oldest layouts in .history/ stay for now (${err.message})`));
  const st = await RX.stat(key);
  return { at: st ? st.at : Date.now(), bytes: st ? st.size : Buffer.byteLength(text), sig: st ? sigR2(st) : '' };
}
// a scene made: a hidden marker object keeps it in the listing while it is empty (MARKER, a dot file: never listed)
async function r2Make(name) {
  const all = await r2All(true);
  if (all.length >= MAX_SCENES) return 'full';
  if (all.some(x => x.name === name) || (await RX.list(okey(name), { max: 1 })).keys.length || await RX.stat(R2C.prefix + name)) return 'exists';
  const r = await RX.put(okey(name, MARKER), Buffer.alloc(0), { ifNoneMatch: true });
  r2Forget();
  return r.exists ? 'exists' : 'made';
}

// an upload with R2 (POST .../file and .../sound): the scene's objects looked at for what stands in the way (as a folder's
// files would be), the body received into the relay's temporary folder (counted against --max-upload as it comes), a
// sound made MP3 there by ffmpeg (from the body, or with ?from=<path> from a file of the scene fetched from the bucket),
// then put into the bucket whole (If-None-Match: * unless replace=1: of two uploads of one new name the second is told
// 409). Nothing is left behind: the temporary files go, and a body cut short never reaches the bucket
async function r2Listing(name) {   // every object of the scene by its path in it, and how many a listing shows
  const base = okey(name), rels = new Map((await RX.listAll(base, { limit: R2_LIMIT })).keys.map(o => [o.key.slice(base.length), o]));
  return { rels, n: [...rels.keys()].filter(r => listable(r) && r !== LAYOUT && r !== LISTING).length };
}
function r2InTheWay(L, want, replace) {   // [status, error] or null
  if ([...L.rels.keys()].some(r => r.startsWith(want.rel + '/'))) return [409, 'there is a folder by that name'];
  for (let i = 1; i < want.segs.length; i++) if (L.rels.has(want.segs.slice(0, i).join('/'))) return [409, 'a file stands where a folder of the path should be'];
  const there = L.rels.has(want.rel);
  if (there && !replace) return [409, 'there is a file by that name (replace=1 replaces it)'];
  if (!there && L.n >= MAX_FILES) return [507, `a scene holds at most ${MAX_FILES} files: this one is full`];
  return null;
}
async function r2Upload(req, res, url, name, want, sound) {
  const no = (status, error, extra) => answerEarly(req, res, status, { error }, extra);
  const replace = url.searchParams.get('replace') === '1', from = url.searchParams.get('from');
  const L = await r2Listing(name), stop = r2InTheWay(L, want, replace);
  if (stop) return no(...stop);
  let src = null;
  if (from !== null) {
    src = listable(from) && from !== LAYOUT && from !== LISTING ? L.rels.get(from) || null : null;
    if (!src) return no(400, 'from=<the path of a sound already in this scene>: there is no such file');
    if (src.size > capOf(want)) return no(413, bigFor(want));
  } else if (+req.headers['content-length'] > capOf(want)) return no(413, bigFor(want));
  if (sound && FF.running >= FF_MAX) return answerEarly(req, res, 429, { error: `${FF_MAX} sounds are being made already: try again in a few seconds`, retry: 5 }, { 'Retry-After': '5', 'Access-Control-Expose-Headers': 'Retry-After' });
  // (each upload through the relay is held whole in its temporary folder before it goes into the bucket: a few at once,
  // so the container's disk is never filled by them; pages send most files straight into the bucket anyway)
  if (UPR.running >= UPR_MAX) return answerEarly(req, res, 429, { error: `${UPR_MAX} uploads are on their way through the relay already: try again in a few seconds`, retry: 5 }, { 'Retry-After': '5', 'Access-Control-Expose-Headers': 'Retry-After' });
  if (sound) FF.running++;
  UPR.running++;
  let tmp = '', answer = null;
  try {
    tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'relay-r2-'));
    answer = await r2UploadJob(req, { name, want, replace, there: L.rels.has(want.rel), sound, src, tmp });
  } finally {
    UPR.running--;
    if (sound) FF.running--;
    if (tmp) await fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
  if (answer) answerEarly(req, res, ...answer);
}
async function r2UploadJob(req, { name, want, replace, there, sound, src, tmp }) {
  const into = path.join(tmp, 'in'), t0 = Date.now();
  let n = 0;
  if (src) {
    req.resume();   // (a body sent with from= is not wanted)
    const g = await RX.getFile(src.key, into, MAX_UPLOAD);
    if (!g) return [400, { error: 'from=: that file is not in the bucket any more' }];
    if (g.over) return [413, { error: TOO_BIG }];
    n = g.bytes;
  } else {
    const got = await receive(req, into, capOf(want));
    if (got.over) return [413, { error: bigFor(want) }];
    if (got.cut) { log(`scenes: ${name}: an upload of ${want.rel} was cut short (${got.n} bytes came)`); return null; }
    if (got.err) {
      log(`scenes: ${name}: could not take ${want.rel} (${got.err.code || got.err.message})`);
      return [got.err.code === 'ENOSPC' ? 507 : 500, { error: 'cannot hold the file on its way (' + (got.err.code || 'error') + ')' }];
    }
    n = got.n;
  }
  let out = into, how = '';
  if (sound) {
    out = path.join(tmp, 'out.mp3');
    const t1 = Date.now(), r = await ffmpeg(into, out);
    const size = (await lstatOf(out))?.size || 0, said = ffSaid(r.err, [into, out, tmp]);
    const fail = (status, error, why) => { log(`scenes: ${name}: no MP3 for ${want.rel} (${why}${said ? ': ' + said : ''})`); return [status, { error }]; };
    if (r.late) return fail(500, `making the MP3 took more than ${OPT['ffmpeg-limit']} s`, 'stopped after ' + OPT['ffmpeg-limit'] + ' s');
    if (!r.ran) return fail(500, 'ffmpeg did not run', r.why);
    if (r.code !== 0) return fail(422, 'ffmpeg could not make an MP3 of it (is it a sound?)', r.sig ? 'ffmpeg ended by ' + r.sig : 'ffmpeg exit ' + r.code);
    if (!size) return fail(422, 'ffmpeg made nothing of it (is it a sound?)', 'an empty MP3');
    how = ` as a mono MP3 (${mb(n)} ${src ? 'from ' + src.key.slice(okey(name).length) : 'given'}, ffmpeg ${((Date.now() - t1) / 1000).toFixed(1)} s)`;
  }
  const size = (await fs.promises.stat(out)).size, key = okey(name, want.rel);
  const p = await RX.put(key, { path: out, size }, { type: typeOf(want.rel), ifNoneMatch: !replace });
  if (p.exists) return [409, { error: 'there is a file by that name (replace=1 replaces it)' }];
  r2Forget();
  const st = await RX.stat(key);
  log(`scenes: ${name}: wrote ${want.rel} into the bucket (${mb(size)} in ${((Date.now() - t0) / 1000).toFixed(1)} s)${how}${there ? ', replacing it' : ''}`);
  if (st) sceneTold(name, want.rel, async () => sigR2(st));
  return [200, { ok: true, path: want.rel, bytes: size, at: st ? st.at : Date.now() }];
}

// POST /api/scenes/<name>/put?path=&size=[&replace=1] (R2): a signed link for the page to upload that file straight into
// the bucket, after the same checks as an upload through the relay: { url, headers, path, expires } (a PUT with exactly
// those headers and a body of that size: its type, length and, unless replace=1, If-None-Match: * signed; or only its
// type, when the bucket refused the others signed at the start: DIRECT). POST .../done?path=[&size=]: the page says it
// has; the relay looks (there, of the size said, within --max-upload: else 400, or 413), tells the watchers at once and
// answers as an upload does ({ ok, path, bytes, at }). An object past --max-upload is removed only when it came by a link
// this relay gave for it, signed without its length (else it is left: it came another way, such as r2sync)
const PENDING = new Map();   // the links given (key -> { size, at, sign }) for an hour
// what the bucket does with the upload links (tried at the start: r2PutCheck): sign 'all' (type, length, If-None-Match),
// 'type' (the type alone), 'off' (it refused both: pages send their files through the relay); said: the line it logged
const DIRECT = { sign: 'all', said: '', inm: true };
async function direct(req, res, url, name, what) {
  req.resume();   // (no body is wanted)
  const no = (status, error) => json(res, status, { error });
  if (!R2C) return no(501, 'uploads straight into the storage are for scenes kept in R2 (--scenes r2): send the file to .../file here');
  if (!SAVE) return no(403, NO_SAVE);
  if (what === 'put' && DIRECT.sign === 'off') return no(501, 'the bucket refused this relay\'s upload links when it started: send the file to .../file here');
  if (!(await KEPT.where(name))) return no(404, 'no such scene');
  const want = uploadPath(url.searchParams.get('path'));
  if (want.error) return no(400, want.error);
  const key = okey(name, want.rel), sizeQ = url.searchParams.get('size'), size = sizeQ === null ? null : Number(sizeQ);
  if (size !== null && !(Number.isInteger(size) && size >= 0)) return no(400, 'size=<the file\'s size in bytes>');
  if (what === 'put') {
    if (size === null) return no(400, 'size=<the file\'s size in bytes> is needed');
    if (size > capOf(want)) return no(413, bigFor(want));
    const replace = url.searchParams.get('replace') === '1', stop = r2InTheWay(await r2Listing(name), want, replace);
    if (stop) return no(...stop);
    const sign = DIRECT.sign === 'type' ? 'type' : 'all', link = RX.putLink(key, { type: typeOf(want.rel), size, replace, expires: PUT_TTL, sign }), now = Date.now();
    for (const [k, v] of PENDING) if (now - v.at > PUT_TTL * 1000 || PENDING.size > 10000) PENDING.delete(k);
    PENDING.set(key, { size, at: now, sign });
    return json(res, 200, { url: link.url, headers: link.headers, path: want.rel, expires: PUT_TTL });
  }
  const st = await RX.stat(key), pend = PENDING.get(key), said = size !== null ? size : pend?.size;
  if (!st) return no(400, `nothing came to ${want.rel}`);
  if (st.size > capOf(want)) {
    // (by a link of ours: given for this path within the hour, the object put since (R2's clock a little off allowed),
    // its length not signed. A link with its length signed never lands a body past --max-upload: such an object came
    // another way, and is not the relay's to remove)
    if (pend && pend.sign === 'type' && st.at >= pend.at - 120000 && Date.now() - pend.at <= PUT_TTL * 1000) {
      await RX.del(key); r2Forget(); PENDING.delete(key);
      log(`scenes: ${name}: removed ${want.rel} (${mb(st.size)} came straight into the bucket by its link: more than ${capOf(want) < MAX_UPLOAD ? capWord(want) + ' takes' : '--max-upload'})`);
    } else log(`scenes: ${name}: ${want.rel} in the bucket is ${mb(st.size)}, more than ${capOf(want) < MAX_UPLOAD ? capWord(want) + ' takes' : '--max-upload'}: left there (it did not come by a link of this relay's)`);
    return no(413, bigFor(want));
  }
  if (said !== undefined && st.size !== said) return no(400, `${want.rel} holds ${st.size} bytes, not the ${said} said`);
  PENDING.delete(key); r2Forget();
  log(`scenes: ${name}: ${want.rel} came straight into the bucket (${mb(st.size)})`);
  sceneTold(name, want.rel, async () => sigR2(st));
  json(res, 200, { ok: true, path: want.rel, bytes: st.size, at: st.at });
}

// the start with R2: the keys must list the bucket. Settings that cannot work (keys refused, no such bucket, no such
// address) stop it, saying what is wrong; a bucket that does not answer now (a 5xx, too many requests, no answer: R2 or
// the way to it away for a moment) does not: the relay starts (its rooms never need the bucket), the scenes answer 502
// until the bucket answers, and it is asked again in the background (R2UP), then checked as at a start. --r2-check also
// checks the bucket's CORS rule and its upload links, and stops there
const R2UP = { ok: false, t: 0, n: 0 };
const r2Passing = err => !(err instanceof R2Error) || (!err.status ? err.code !== 'ENOTFOUND' : err.status >= 500 || err.status === 408 || err.status === 429);
const r2Refused = err => {
  const b = R2C.bucket, code = err.code ? ' ' + err.code : '';
  if (!err.status) return `--scenes r2: could not reach ${R2C.host} (${err.code || 'no answer'}): check R2_ACCOUNT_ID (and R2_JURISDICTION for a bucket made in a jurisdiction), and that this machine reaches the internet`;
  if (err.status === 404) return `--scenes r2: there is no bucket ${b} there (R2_BUCKET; a bucket made with a jurisdiction such as eu needs R2_JURISDICTION=eu)`;
  if (err.status === 401 || err.status === 403) return `--scenes r2: R2 refused the keys (${err.status}${code}): check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY, and that the API token may read and write the bucket ${b}`;
  return `--scenes r2: the bucket ${b} answered ${err.status}${code}: try again in a moment`;
};
async function r2Ready() {
  try { await RX.list(R2C.prefix, { max: 1 }); R2UP.ok = true; } catch (err) {
    if (OPT['r2-check'] || !r2Passing(err)) { console.log(r2Refused(err)); process.exit(1); }
    console.log(r2Refused(err).replace(/: try again in a moment$/, '') + `\n--scenes r2: the relay starts all the same (its rooms do not need the bucket): the scenes answer 502 until the bucket answers, and it is asked again every 30 s`);
    r2Again();
    return;
  }
  if (!OPT['r2-check']) return;
  console.log(`--r2-check: the keys may list the bucket ${R2C.bucket}${R2C.prefix ? ' (under ' + R2C.prefix + ')' : ''} at ${R2C.host}`);
  const ok = await r2CorsCheck(), ok2 = await r2PutCheck();
  console.log(ok && ok2 ? '--r2-check: all is well' : '--r2-check: see above');
  process.exit(ok && ok2 ? 0 : 1);
}
// the bucket asked again until it answers (after 5 s, then every 30 s; R2_RETRY seconds for the tests), then its CORS
// rule and upload links checked as at a start; settings it refuses then are said and the asking stops
function r2Again() {
  clearTimeout(R2UP.t);
  R2UP.t = setTimeout(async () => {
    try { await RX.list(R2C.prefix, { max: 1 }); } catch (err) {
      if (!r2Passing(err)) { log(r2Refused(err)); return; }
      if (++R2UP.n === 1 || R2UP.n % 10 === 0) log(`scenes: the bucket ${R2C.bucket} still does not answer (${err.status ? err.status + (err.code ? ' ' + err.code : '') : err.code || 'no answer'}): asked again every 30 s`);
      return r2Again();
    }
    R2UP.ok = true;
    log(`scenes: the bucket ${R2C.bucket} answers now`);
    r2Checks().catch(err => log('scenes: ' + err.message));
  }, (R2UP.n ? 30 : 5) * 1000 * (+process.env.R2_RETRY > 0 ? +process.env.R2_RETRY / 30 : 1));
  R2UP.t.unref?.();
}
const r2Checks = async () => { await r2CorsCheck(); await r2PutCheck(); };
// what the bucket says to an upload link as the pages get one, tried on a hidden object at the top of the prefix (removed
// again): a PUT with its type, length and If-None-Match: * signed, then the same again (refused: one is there). Taken:
// the pages' links are so (DIRECT.sign 'all'). Refused (403, 400: a store that will not take those headers signed): a
// link with only its type signed, as Cloudflare's own documents show ('type'; the relay then checks each upload's size
// when told it is there). Both refused: pages send their files through the relay ('off'). A second PUT taken means the
// bucket ignores If-None-Match (said: two uploads of one new name at the same moment could then overwrite each other).
// No answer: left as it was. With --scenes-readonly there are no uploads to check. True when the pages' links work
// (If-None-Match ignored is said, not counted: only two uploads of one name at one moment could meet it)
async function r2PutCheck() {
  if (!SAVE) return true;
  const key = R2C.prefix + '.put-check-' + crypto.randomBytes(5).toString('hex'), body = Buffer.from('studio upload check'), type = 'application/octet-stream';
  const tryLink = async sign => {
    const l = RX.putLink(key, { type, size: body.length, sign, expires: 300 });
    const a = await RX.byLink('PUT', l.url, l.headers, body);
    const b = a.status >= 200 && a.status < 300 ? await RX.byLink('PUT', l.url, l.headers, body) : null;
    return { a, b };
  };
  let r = await tryLink('all'), sign = 'all';
  if (r.a.status === 403 || r.a.status === 400) { sign = 'type'; r = await tryLink('type'); }
  await RX.del(key).catch(() => {});
  const took = r.a.status >= 200 && r.a.status < 300, how = x => (x.status ? x.status + (x.code ? ' ' + x.code : '') : x.code || 'no answer');
  let said;
  if (!r.a.status || r.a.status >= 500) { said = `R2 upload links: not checked (the bucket answered ${how(r.a)}): pages upload straight into it, and through the relay if it refuses them`; }
  else if (!took) { DIRECT.sign = 'off'; said = `R2 upload links: the bucket refused them (${how(r.a)}), even with only their type signed: pages send their files through the relay (each held in a temporary folder on the way)`; }
  else {
    DIRECT.sign = sign; DIRECT.inm = !(r.b && r.b.status >= 200 && r.b.status < 300);
    said = `R2 upload links: ${sign === 'all' ? 'taken with their type, length and If-None-Match signed' : 'taken with only their type signed (the bucket refused their length and If-None-Match signed): the relay checks each upload\'s size when the page says it is there'}` +
      (DIRECT.inm ? `; a second upload to the same new name refused (${how(r.b)})` : '; the bucket did NOT refuse a second upload to the same new name (If-None-Match ignored): two uploads of one new name at the same moment could overwrite each other');
  }
  if (said !== DIRECT.said) { DIRECT.said = said; console.log(said); }
  return took;
}
// the bucket's CORS rule as a browser meets it: preflights (unsigned: any keys may ask) for a page at the app's origin that
// downloads with a range and uploads, and for one sent through the relay's redirect from another origin (Origin: null);
// and the rule itself, where these keys may read it (an Object Read & Write token may not). Said in the log; true when a
// page can download and upload
async function r2CorsCheck() {
  const origin = ORIGINS.size ? [...ORIGINS][0] : APP_ORIGIN, probe = R2C.prefix + '.cors-check';
  const allowed = r => r.status >= 200 && r.status < 300 && ['*', origin].includes(r.headers['access-control-allow-origin']);
  const [g, p, n] = await Promise.all([RX.preflight(probe, origin, 'GET', 'range'), RX.preflight(probe, origin, 'PUT', 'content-type,if-none-match'), RX.preflight(probe, 'null', 'GET', '')]);
  let rules = null;
  try { rules = await RX.cors(); } catch { /* said as unreadable */ }
  const none = Array.isArray(rules) && !rules.length;
  const missing = Array.isArray(rules) && rules.length ? ['ETag', 'Content-Length', 'Content-Range', 'Accept-Ranges'].filter(h => !rules.some(r => r.expose.some(e => e === '*' || e.toLowerCase() === h.toLowerCase()))) : [];
  const yes = x => (x ? 'yes' : 'NO'), ok = allowed(g) && allowed(p) && !none && !missing.length;
  console.log(`R2 CORS (as a page at ${origin} meets it): download with a range ${yes(allowed(g))}, upload ${yes(allowed(p))}; ` +
    `a page sent there by the relay's redirect from another origin (Origin: null) ${allowed(n) ? 'yes' : 'no (only an older studio needs that)'}; ` +
    (rules === null ? 'the rule itself cannot be read with these keys: check in the dashboard that it exposes ETag, Content-Length, Content-Range and Accept-Ranges'
      : none ? 'the bucket has no CORS rule' : missing.length ? `the rule does not expose ${missing.join(', ')}` : 'it exposes ETag, Content-Length, Content-Range and Accept-Ranges'));
  if (!ok) console.log('R2 CORS: paste the rule in relay/README.md ("Scenes in Cloudflare R2") into the bucket\'s Settings, CORS policy');
  return ok;
}

// Node's limit on a whole request (5 minutes) is off where uploads are taken (server.requestTimeout below), for slow ones;
// every other request keeps it here, so a body that never comes cannot hold a socket for ever
const UPLOADING = /^\/api\/scenes\/[^/]+\/(file|sound)$/, REQ_LIMIT = 300000;
function reqLimit(req) {
  if (req.complete) return;
  const t = setTimeout(() => { if (!req.complete) req.socket.destroy(); }, REQ_LIMIT);
  const stop = () => clearTimeout(t);
  req.once('end', stop); req.once('close', stop);
}
function request(req, res) {
  const url = parseUrl(req);
  if (!url) return plain(res, 400, 'Bad request');
  if (SAVE && !UPLOADING.test(url.pathname)) reqLimit(req);
  const fail = err => { log('error', scrub(req.url), err.message); if (!res.headersSent) plain(res, 500, 'Internal error'); else res.destroy(); };
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) { try { return api(req, res, url); } catch (err) { return fail(err); } }
  if (PEER && (url.pathname === '/peerjs' || url.pathname.startsWith(PEER_PATH))) { try { return peerHttp(req, res, url); } catch (err) { return fail(err); } }
  if (SCENES_ON && url.pathname.startsWith('/scenes/')) return sceneFile(req, res, url).catch(fail);
  if (url.pathname === '/upload' || url.pathname === '/upload/') { try { return uploadPage(req, res); } catch (err) { return fail(err); } }
  if (ROOT) return serve(req, res, url).catch(fail);
  if (url.pathname === '/') return plain(res, 200, 'Shared-room relay: the API is under /api/ (see relay/README.md).');
  plain(res, 404, 'Not found');
}

const server = OPT.cert ? https.createServer({ cert: fs.readFileSync(OPT.cert), key: fs.readFileSync(OPT.key) }, request) : http.createServer(request);
server.on('upgrade', upgrade);
// (Node gives a whole request 5 minutes; an upload of 512 MB over a slow Wi-Fi takes longer: each upload has its own limit
// instead, 2 minutes without a byte)
if (SAVE) server.requestTimeout = 0;
if (R2C) await r2Ready();   // (the bucket checked before anyone is let in)
if (TRK) {   // (asked for: a port another program holds stops the start, as a named ffmpeg that does not run)
  let at;
  try { at = await TRK.listen(); } catch (err) {
    console.log(`--trackers: cannot listen on UDP 127.0.0.1:${OPT.trackers} (${err.code || err.message}): is another relay running? (--trackers <port> takes another port; tell the bridge with --port)`);
    process.exit(1);
  }
  TRK.attach(() => rooms.values(), trackersSend);
  console.log(`Trackers: the bridge's readings on UDP 127.0.0.1:${at} (uv run tools/trackers/bridge.py${at === TRK_PORT ? '' : ' --port ' + at}, after SteamVR); rooms whose key trk is on and lined up get them`);
}
server.listen(OPT.port, OPT.host, () => {
  const a = server.address(), host = a.family === 'IPv6' ? `[${a.address}]` : a.address, scheme = OPT.cert ? 'https' : 'http';
  console.log(`relay listening on ${scheme}://${host}:${a.port}${ROOT ? ', serving ' + ROOT : ''} (protocol ${PROTO})`);
  if (PEER) console.log(`Introduction server for peer to peer (PeerJS) at /peerjs, key ${TOKEN ? 'the password' : PEER_KEY} (--no-peer turns it off)`);
  if (ROOT && /^(0\.0\.0\.0|::)$/.test(a.address) && !PUB) {   // (--public: the address is a container's or a server's, no one's to open)
    const lan = lanAddresses(), at = lan.map(ip => `${scheme}://${ip}:${a.port}/`).join(' or ');
    const pick = lan.length > 1 ? '\n(This machine has several addresses: use the one on the Wi-Fi the headsets are on.)' : '';
    if (OPT.cert && lan.length) {   // a headset needs a secure page for WebXR: an https:// address is one
      console.log(`On every headset (same Wi-Fi), open the same address: ${at}${pick}` +
        (OPT.lan ? '\n(The certificate is this machine\'s own: accept the warning once on each headset.)' : ''));
    } else if (!OPT.cert) {         // an http:// address on the network is not secure: no VR or AR there
      if (lan.length) console.log(`Desktops on the same network can open ${at} (the page only: no VR or AR at an http:// address)${pick}`);
      console.log(`For headsets, start the relay with --lan (HTTPS), or per headset run adb reverse tcp:${a.port} tcp:${a.port} and open http://localhost:${a.port}/`);
    }
    console.log(`On this machine: ${scheme}://localhost:${a.port}/`);
  }
  if (OPT.logs) console.log(`Headsets' logs (room alignment) go to ${OPT.logs}`);
  if (OPT.proxy) console.log(OPT.proxy === 1 ? 'Behind a reverse proxy: a client\'s address is the last one in X-Forwarded-For (rooms on this network)' :
    `Behind ${OPT.proxy} reverse proxies: a client's address is the ${OPT.proxy === 2 ? 'second' : OPT.proxy === 3 ? 'third' : OPT.proxy + 'th'} from the right in X-Forwarded-For (rooms on this network)`);
  if (WATCH) console.log(`Watching ${WATCH}: pages swap a changed story in place, and reload for a shell file` + (OPT.build ? '; a built story is built again when its sources change' : ''));
  // the studio's scenes: which, and whether layouts are saved (said after the lines above: the folder is looked at first)
  if (SCENES_ON) KEPT.all().then(all => console.log(`Scenes for the studio (#studio) from ${R2C ? `the R2 bucket ${R2C.bucket}${R2C.prefix ? ', under ' + R2C.prefix : ''}` : SCENES}: ` +
    (all.length ? `${all.length} (${all.map(x => x.name).join(', ').slice(0, 300)})` : R2C ? 'none yet (make one in the studio\'s Upload pane, or push a folder with tools/studio/r2sync.mjs)' : 'none yet (put one subfolder per scene there)') + '; ' +
    (SAVE ? 'the studio saves their layouts there (the old layout.json in each one\'s .history/)' : 'read only (--scenes-readonly): layouts are never written') +
    (R2C ? `; pages fetch the files straight from the bucket by signed links (each lives ${+(R2C.ttl / 3600).toFixed(2)} h)` + (SAVE ? ' and upload big ones straight into it' : '') : '') +
    (TOKEN ? '; they need the password' : '') +
    (SAVE ? `\nUploads (the studio's Upload pane, at /upload): files up to ${+(MAX_UPLOAD / (1 << 20)).toFixed(2)} MB; ` +
      (FFMPEG ? `long sounds made mono MP3 by ffmpeg (${FFMPEG})` : 'no ffmpeg found, so long sounds are kept as they are (install ffmpeg, or --ffmpeg <path>)') : ''))).then(() => (R2C && R2UP.ok ? r2Checks() : null))
    .catch(err => log('scenes: ' + err.message));
  // a public server: what it allows, said once (never the log token)
  if (ORIGIN_RULE) console.log(`Only pages from ${[...ORIGINS].join(', ')} and the relay's own may open a socket or read the API` +
    (OPT['allow-no-origin'] ? ' (and clients that send no Origin, such as scripts)' : ' (a client that sends no Origin gets no socket: --allow-no-origin)'));
  if (UNLISTED) console.log('No list of open rooms and no names in any answer: a room is joined by its code, a link or on its network');
  const per = [LIM.guesses && `${LIM.guesses} lookups of unknown room codes a minute (a burst of ${2 * LIM.guesses})`,
    LIM.creates && `${LIM.creates} new rooms a minute (a burst of ${2 * LIM.creates})`, LIM.sockets && `${LIM.sockets} open sockets`].filter(Boolean);
  if (per.length) console.log(`Per address at most ${per.join(', ')}`);
  if (STORE) console.log(`All rooms together hold at most ${+(STORE / (1 << 20)).toFixed(2)} MB`);
  if (OPT.logs && LOG_TOKEN) console.log('Logs need the relay\'s log token (header X-Log-Token)');
  // (never the password itself)
  if (KEEP) console.log(`Rooms are kept in ${KEEP} (written every 5 s when they changed and as the relay stops): a restart does not empty them`);
  if (TOKEN) console.log(`A password is needed (COLLAB_TOKEN or --token): everything but GET /api/health and the app's files; ${FAIL_MAX} failed attempts a minute from one address, then 429`);
  else if (PUB) console.log('No password (COLLAB_TOKEN): anyone who can reach the relay may use it');
  if ((per.length || PUB) && !OPT.proxy) console.log('No --proxy: behind a reverse proxy (Coolify\'s) every device would seem to be the proxy, one address for all (add --proxy 1)');
});
// a promise that failed with nobody to hear it (a slip in the code): said, never the end of the relay and every room on it
process.on('unhandledRejection', err => log('error', 'unhandled:', scrub(String((err && err.message) || err)).slice(0, 300)));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {   // say goodbye, so clients reconnect at once (a container stop sends SIGTERM)
    keepWrite(true);   // (--keep: the rooms as they are now, each one's members counted as here until now)
    for (const r of rooms.values()) for (const m of r.members.values()) m.ws.close(1001, 'relay stopping');
    for (const p of peers.values()) p.ws.close(1001, 'relay stopping');
    for (const res of [...W.clients, ...SW.clients]) res.end();
    for (const p of FF.procs) p.kill('SIGKILL');   // (a conversion under way: never left running on its own)
    if (TRK) TRK.close();
    server.close();
    setTimeout(() => process.exit(0), 200);
  });
}
