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
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import os from 'node:os';
import { execFileSync, execFile } from 'node:child_process';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

const PROTO = 1;
const OPT = { port: 8787, host: '0.0.0.0', cert: '', key: '', static: '', timeout: 40, expire: 6 * 3600, ping: 20, quiet: false, lan: false, logs: '', 'no-peer': false, watch: '', build: false, proxy: 0 };
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
  --build          with --watch: run a built story's build (tools/<key>/build.mjs) when its sources change`;
for (let i = 2; i < process.argv.length; i++) {
  const name = process.argv[i].replace(/^--/, '');
  if (name === 'help' || !(name in OPT) || name === process.argv[i]) { console.log(HELP); process.exit(name === 'help' ? 0 : 1); }
  if (name === 'watch') { const v = process.argv[i + 1]; if (v !== undefined && !v.startsWith('--')) { OPT.watch = v; i++; } else OPT.watch = true; continue; }
  if (name === 'proxy') { const v = process.argv[i + 1]; if (v !== undefined && /^\d+$/.test(v)) { OPT.proxy = +v; i++; } else OPT.proxy = 1; continue; }
  if (typeof OPT[name] === 'boolean') { OPT[name] = true; continue; }
  const v = process.argv[++i];
  OPT[name] = typeof OPT[name] === 'number' ? Number(v) : v;
  if (v === undefined || (typeof OPT[name] === 'number' && !(OPT[name] >= 0))) { console.log(HELP); process.exit(1); }
}
if (!OPT.cert !== !OPT.key) { console.log('--cert and --key go together'); process.exit(1); }
const PEER = !OPT['no-peer'];

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

const MAX_MSG = 1 << 20;            // one WebSocket message, reassembled
const MAX_VALUE = 256 << 10;        // one stored value, as JSON
const MAX_FX = 64 << 10;            // one ephemeral message
const MAX_ROOM = 4 << 20;           // everything a room stores: keys and values, as JSON
const MAX_KEYS = 5000;              // keys in a room (each one costs every later welcome a few bytes more)
const MAX_ROOMS = 2000, MAX_BATCH = 500, FX_RATE = 60, SET_RATE = 120;   // rates: messages a second per member
const KEY = /^[\w-]+(?:\.[\w:-]+)*$/, ID = /^[\w-]{1,64}$/, CODE = /^[A-Z]{3}$/;
const STATION = /^st\.([\w-]{1,32})(?:\.|$)/;           // st.<id> and its state keys st.<id>.*
const DELETABLE = /^(st|pose)\./;                       // the only keys that may be written as null
const KINDS = ['ar', 'vr', 'desktop'];
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
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const ws = new Ws(socket);
  if (peer) peerJoin(ws, url.searchParams); else join(ws, url.searchParams, netOf(req));
  if (head && head.length) ws.data(head);
}

// ---- rooms and members
const rooms = new Map();
function makeRoom(code, app, version) {
  // (nets: the networks of the members it has had, the last few: an empty room stays listed on its network)
  const r = { code, app, version, created: Date.now(), seq: 0, keys: new Map(), size: 0, members: new Map(), empty: Date.now(), nets: new Set() };
  rooms.set(code, r);
  return r;
}
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

// (net: the member's network, a hash: netOf; never its address, which is neither kept nor logged)
function join(ws, q, net) {
  const code = (q.get('room') || '').toUpperCase(), id = q.get('id') || '';
  const fatal = (c, text, close) => { log(`refused a socket (${text})`); ws.text(JSON.stringify({ t: 'error', code: c, text })); ws.close(close, c); };
  if (!CODE.test(code) || !ID.test(id)) return fatal('bad', 'a room code and a client id are needed', 4000);
  if (q.has('proto') && q.get('proto') !== String(PROTO)) return fatal('proto', `this relay speaks protocol ${PROTO}`, 4005);
  const room = rooms.get(code);
  if (!room) return fatal('room', `no room ${code}`, 4004);
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
  send(m, { t: 'welcome', you: id, room: code, app: room.app, version: room.version, seq: room.seq, keys: keysOut(room), members: people(room), now: Date.now(), proto: PROTO });
  broadcast(room, { t: 'members', members: people(room) });
  log(`${code} join ${id} (${room.members.size} in the room)`);
}
function leave(room, m, why = 'leave') {
  if (room.members.get(m.id) !== m) return;
  m.ws.onmessage = m.ws.onclose = () => {};
  room.members.delete(m.id);
  if (!room.members.size) room.empty = Date.now();
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
    if (version && room.version && version !== room.version) return kick(room, m, 'version', `the room runs version ${room.version}`, 4006);
    if (version && !room.version) room.version = version;   // a room made without a version takes the first one
    Object.assign(m, { name: str(msg.name, 32), color: /^#[0-9a-f]{3,8}$/i.test(msg.color) ? msg.color : '',
      kind: KINDS.includes(msg.kind) ? msg.kind : 'desktop', here: msg.here === true, version });
    broadcast(room, { t: 'members', members: people(room) });
    return log(`${room.code} hello ${m.id} "${m.name}" ${m.kind}${m.here ? ' here' : ''} ${version}`);
  }
  refuse(room, m, null, [], `bad message: unknown t ${JSON.stringify(String(msg.t)).slice(0, 40)}`, 'bad');
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
  if (ok.length) {
    const seq = ++room.seq, out = [];
    const drop = k => { const e = room.keys.get(k); if (e) { room.size -= e.n; room.keys.delete(k); } };
    for (const k of gone) { drop(k); out.push([k, null]); }
    for (const { k, v, n } of ok) {
      if (v === null) drop(k);
      else { room.size += n - (room.keys.get(k)?.n || 0); room.keys.set(k, { v, seq, by: m.id, n }); }
      out.push([k, v]);
    }
    broadcast(room, { t: 'set', batch: out, seq, by: m.id, cid });
    log(`${room.code} set #${seq} by ${m.id}: ${cut(out.map(([k, v]) => (v === null ? k + '=null' : k)))}`);
  }
  if (bad.length) refuse(room, m, cid, bad.map(b => b[0]), bad.map(([k, w]) => `${k}: ${w}`).join('; ').slice(0, 500));
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
  if (key !== PEER_KEY) return shut('INVALID-KEY', 'Invalid key provided', 4003, 'another key');
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
    if (!room.members.size && now - room.empty > OPT.expire * 1000) { rooms.delete(room.code); log(`${room.code} expired`); }
  }
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
const netOf = req => netHash(netName((OPT.proxy && forwarded(req)) || req.socket.remoteAddress));
// a room shows on a network while someone in it is on that network (an empty one: while its members were), unless the
// room says otherwise (its key near, { on: false }: Show on this network, off)
const shownOn = (r, net) => !!net && !(r.keys.get('near')?.v?.on === false) &&
  (r.members.size ? [...r.members.values()].some(m => m.net === net) : r.nets.has(net));
// the rooms on the asking device's network: code, the first member's name, how many are in it (never an address)
function nearRooms(net) {
  return [...rooms.values()].filter(r => shownOn(r, net)).sort((a, b) => (b.members.size > 0) - (a.members.size > 0) || b.seq - a.seq).slice(0, 20)
    .map(r => ({ code: r.code, name: ([...r.members.values()].sort((a, b) => a.since - b.since).find(m => m.name) || {}).name || '', members: r.members.size, stations: stations(r), version: r.version }));
}
function reply(res, status, body, type, extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}
const json = (res, status, obj) => reply(res, status, JSON.stringify(obj), 'application/json');
const plain = (res, status, text, extra) => reply(res, status, text + '\n', 'text/plain; charset=utf-8', extra);

function cors(req, res) {   // the API and the introduction server, for pages on another origin (GitHub Pages); true: answered
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'OPTIONS') return false;
  res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600',
    ...(req.headers['access-control-request-private-network'] ? { 'Access-Control-Allow-Private-Network': 'true' } : {}) });
  res.end();
  return true;
}
function api(req, res, url) {
  if (cors(req, res)) return;
  const p = url.pathname, room = /^\/api\/rooms\/([A-Za-z]{3})$/.exec(p);
  if (p === '/api/ping' && req.method === 'GET') return json(res, 200, { now: Date.now(), proto: PROTO, net: netOf(req), ...(WATCH ? { watch: true } : {}) });
  if (p === '/api/near' && req.method === 'GET') { const net = netOf(req); return json(res, 200, { net, rooms: nearRooms(net) }); }
  if (p === '/api/watch' && req.method === 'GET') return watchStream(req, res);
  if (p === '/api/rooms' && req.method === 'GET') {
    return json(res, 200, [...rooms.values()].map(r => ({ code: r.code, members: r.members.size, names: [...r.members.values()].map(m => m.name), stations: stations(r), idle: idle(r), version: r.version })));
  }
  if (p === '/api/rooms' && req.method === 'POST') return createRoom(req, res);
  if (p === '/api/log' && req.method === 'POST') return saveLog(req, res);
  if (room && req.method === 'GET') {
    const r = rooms.get(room[1].toUpperCase());
    if (!r) return json(res, 404, { error: 'no such room' });
    return json(res, 200, { code: r.code, app: r.app, version: r.version, created: r.created, seq: r.seq, idle: idle(r), members: people(r), keys: keysOut(r) });
  }
  if (p === '/api/ping' || p === '/api/near' || p === '/api/rooms' || p === '/api/log' || p === '/api/watch' || room) return json(res, 405, { error: 'method not allowed' });
  json(res, 404, { error: 'not found' });
}
// the introduction server's HTTP side: PeerJS asks {path}{key}/id for a new id (a page that brings its own id does not)
function peerHttp(req, res, url) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
  const p = url.pathname;
  if (p === '/peerjs' || p === PEER_PATH) return json(res, 200, { name: 'Introduction server for peer to peer (PeerJS 1.5 protocol)', key: PEER_KEY, path: '/peerjs' });
  if (p === PEER_PATH + PEER_KEY + '/id') {
    let id;
    do id = crypto.randomUUID(); while (peers.has(id) || waiting.has(id));
    return reply(res, 200, id, 'text/plain; charset=utf-8');   // (no newline: the page takes the text as it is)
  }
  if (p === PEER_PATH + PEER_KEY + '/peers') return json(res, 401, { error: 'listing peers is off' });
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
    if (code && rooms.has(code)) return json(res, 409, { error: 'taken' });
    if (rooms.size >= MAX_ROOMS) return json(res, 503, { error: 'too many rooms' });
    while (!code || rooms.has(code)) code = Array.from({ length: 3 }, () => String.fromCharCode(65 + crypto.randomInt(26))).join('');
    const r = makeRoom(code, str(b.app, 32), str(b.version, 64));
    log(`${code} created (${r.app || 'no app'} ${r.version || 'no version'})`);
    json(res, 201, { code });
  });
}

// --logs: what a headset logs about its room alignment (shared.js sends it every 10 s), one JSON line per entry in
// <dir>/<day>-<room>-<name>-<member>.jsonl, so two headsets' numbers can be compared afterwards
const MAX_LOG_BODY = 1 << 20, MAX_LOG_FILE = 20 << 20, LOGGED = new Map();
function saveLog(req, res) {
  if (!OPT.logs) return json(res, 404, { error: 'logs are off (start the relay with --logs <dir>, or --lan)' });
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
    if (!size) log(`log ${path.relative(process.cwd(), file)} started (${b.room}, ${name})`);
    fs.appendFileSync(file, lines);
  } catch (err) { return json(res, 500, { error: 'cannot write the log: ' + err.message }); }
  json(res, 200, { lines: lines ? lines.split('\n').length - 1 : 0 });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.pdf': 'application/pdf' };
const SQUEEZE = /^(text\/|application\/(json|manifest\+json|wasm)|image\/svg)/;   // worth sending gzipped
const gzip = promisify(zlib.gzip), GZ = new Map();
const ROOT = OPT.static ? path.resolve(OPT.static) : '';
const REAL = ROOT ? fs.realpathSync(ROOT) : '';
// Only the app's own files are served, not the rest of the repository (the authors' data in ikerdata/,
// tools/, docs/, the relay's certificate): these files at the top, and the files directly inside these
// folders. Everything index.html, sw.js (SHELL, AUDIO) and the stories load is here; add what the app gains.
// (p2p/ is the peer-to-peer test page, at /p2p/: with &peer= it can use this relay's introduction server.)
const APP_FILES = new Set(['index.html', 'sfx.js', 'shared.js', 'sw.js', 'manifest.webmanifest', 'three.min.js', 'three.LICENSE.txt',
  'peerjs.min.js', 'PEERJS-LICENSE.txt', 'proteins.html', 'spatial.html', 'README.txt', 'version.json', 'lowpoly.js']);
const APP_DIRS = new Set(['stories', 'audio', 'icons', 'p2p']);
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
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
  const base = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
  const useRange = range && (range[1] || range[2]) && (!req.headers['if-range'] || req.headers['if-range'] === base);
  const zip = !useRange && SQUEEZE.test(type) && st.size > 1024 && st.size < 32 * MAX_MSG && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const etag = zip ? base.slice(0, -1) + '-gz"' : base;
  // (the release's version file is never kept: live updates compare it with what a page runs)
  const head = { 'Content-Type': type, 'Cache-Control': segs.join('/') === 'version.json' ? 'no-store' : 'no-cache', ETag: etag, 'Last-Modified': st.mtime.toUTCString(), 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
    ...(SQUEEZE.test(type) ? { Vary: 'Accept-Encoding' } : {}) };
  if (String(req.headers['if-none-match'] || '').split(',').some(t => t.trim().replace(/^W\//, '') === etag)) { res.writeHead(304, head); return res.end(); }
  const stream = (opts, status, extra) => {
    res.writeHead(status, { ...head, ...extra });
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
const SHELL_FILES = ['index.html', 'sfx.js', 'shared.js', 'sw.js', 'three.min.js', 'peerjs.min.js'];
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

function request(req, res) {
  const url = parseUrl(req);
  if (!url) return plain(res, 400, 'Bad request');
  const fail = err => { log('error', req.url, err.message); if (!res.headersSent) plain(res, 500, 'Internal error'); else res.destroy(); };
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) { try { return api(req, res, url); } catch (err) { return fail(err); } }
  if (PEER && (url.pathname === '/peerjs' || url.pathname.startsWith(PEER_PATH))) { try { return peerHttp(req, res, url); } catch (err) { return fail(err); } }
  if (ROOT) return serve(req, res, url).catch(fail);
  if (url.pathname === '/') return plain(res, 200, 'Shared-room relay: the API is under /api/ (see relay/README.md).');
  plain(res, 404, 'Not found');
}

const server = OPT.cert ? https.createServer({ cert: fs.readFileSync(OPT.cert), key: fs.readFileSync(OPT.key) }, request) : http.createServer(request);
server.on('upgrade', upgrade);
server.listen(OPT.port, OPT.host, () => {
  const a = server.address(), host = a.family === 'IPv6' ? `[${a.address}]` : a.address, scheme = OPT.cert ? 'https' : 'http';
  console.log(`relay listening on ${scheme}://${host}:${a.port}${ROOT ? ', serving ' + ROOT : ''} (protocol ${PROTO})`);
  if (PEER) console.log(`Introduction server for peer to peer (PeerJS) at /peerjs, key ${PEER_KEY} (--no-peer turns it off)`);
  if (ROOT && /^(0\.0\.0\.0|::)$/.test(a.address)) {
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
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {   // say goodbye, so clients reconnect at once (a container stop sends SIGTERM)
    for (const r of rooms.values()) for (const m of r.members.values()) m.ws.close(1001, 'relay stopping');
    for (const p of peers.values()) p.ws.close(1001, 'relay stopping');
    for (const res of W.clients) res.end();
    server.close();
    setTimeout(() => process.exit(0), 200);
  });
}
