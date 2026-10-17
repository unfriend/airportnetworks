// The relay for shared rooms (docs/shared-space-plan.md, section 3; protocol in relay/README.md).
// Rooms with 3-letter codes, a key -> { v, seq, by } map per room (every stored write gets the
// room's next seq: last writer wins), ephemeral messages that are never stored, and members.
// Node 18 or newer and no packages: its own minimal WebSocket code (RFC 6455). It can serve the
// app as well (--static), so the page and the relay share one address.
//   node relay/server.mjs [--port 8787] [--host 0.0.0.0] [--cert c.pem --key k.pem] [--static .]
//   node relay/server.mjs --lan    (for headsets on the same Wi-Fi: HTTPS with a certificate of its own, the app served)
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

const PROTO = 1;
const OPT = { port: 8787, host: '0.0.0.0', cert: '', key: '', static: '', timeout: 40, expire: 6 * 3600, ping: 20, quiet: false, lan: false };
const HELP = `usage: node relay/server.mjs [options]
  --port <n>       port (8787; 0 picks a free one)       --host <addr>   address (0.0.0.0)
  --cert <file>    with --key: speak HTTPS and WSS       --static <dir>  also serve the app from <dir>
  --timeout <s>    a silent member is dropped (40)       --expire <s>    a room without members goes (21600)
  --ping <s>       WebSocket ping to every member (20)   --quiet         no log lines
  --lan            for headsets on the same Wi-Fi: HTTPS with a self-signed certificate made once with openssl for
                   this machine's addresses (in relay/.lan/), and the app served from the repository`;
for (let i = 2; i < process.argv.length; i++) {
  const name = process.argv[i].replace(/^--/, '');
  if (name === 'help' || !(name in OPT) || name === process.argv[i]) { console.log(HELP); process.exit(name === 'help' ? 0 : 1); }
  if (typeof OPT[name] === 'boolean') { OPT[name] = true; continue; }
  const v = process.argv[++i];
  OPT[name] = typeof OPT[name] === 'number' ? Number(v) : v;
  if (v === undefined || (typeof OPT[name] === 'number' && !(OPT[name] >= 0))) { console.log(HELP); process.exit(1); }
}
if (!OPT.cert !== !OPT.key) { console.log('--cert and --key go together'); process.exit(1); }

// This machine's addresses on the local network (what a headset on the same Wi-Fi types in)
const lanAddresses = () => Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
// --lan: headsets need a secure page for WebXR, and a secure page may only open wss://. A certificate of our own
// (self-signed, so each headset asks once whether to trust it) for every address of this machine, made again
// when the addresses change; and the app from the repository unless --static says otherwise.
if (OPT.lan) {
  const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.join(here, '.lan');
  if (!OPT.static) OPT.static = path.join(here, '..');
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
  if (!url || url.pathname !== '/api/ws') return deny(404);
  if (req.method !== 'GET' || !/^websocket$/i.test(req.headers.upgrade || '') || !/^[A-Za-z0-9+/]{22}==$/.test(key || '')) return deny(400);
  if (req.headers['sec-websocket-version'] !== '13') return deny(426, 'Sec-WebSocket-Version: 13\r\n');
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const ws = new Ws(socket);
  join(ws, url.searchParams, clientIp(req));
  if (head && head.length) ws.data(head);
}

// ---- rooms and members
const rooms = new Map();
function makeRoom(code, app, version) {
  const r = { code, app, version, created: Date.now(), seq: 0, keys: new Map(), size: 0, members: new Map(), empty: Date.now() };
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

function join(ws, q, ip) {
  const code = (q.get('room') || '').toUpperCase(), id = q.get('id') || '';
  const fatal = (c, text, close) => { log(`refused a socket from ${ip} (${text})`); ws.text(JSON.stringify({ t: 'error', code: c, text })); ws.close(close, c); };
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
    m.ws = ws;
  } else {
    m = { id, ws, name: '', color: '', kind: 'desktop', here: false, version: '', since: Date.now(), fx: { n: 0, t0: 0 }, sets: { n: 0, t0: 0 }, fxDropped: 0 };
    room.members.set(id, m);
  }
  room.empty = 0;
  ws.onmessage = text => {   // a value nested too deeply for JSON.stringify must not stop the relay
    try { message(room, m, text); } catch (err) { refuse(room, m, null, [], `bad message: ${err.message}`, 'bad'); }
  };
  ws.onclose = () => leave(room, m);
  send(m, { t: 'welcome', you: id, room: code, app: room.app, version: room.version, seq: room.seq, keys: keysOut(room), members: people(room), now: Date.now(), proto: PROTO });
  broadcast(room, { t: 'members', members: people(room) });
  log(`${code} join ${id} from ${ip} (${room.members.size} in the room)`);
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

// silent members time out, everybody gets a WebSocket ping, rooms without members expire
setInterval(() => {
  const now = Date.now();
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
function clientIp(req) { return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress; }   // for the log only
function reply(res, status, body, type, extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}
const json = (res, status, obj) => reply(res, status, JSON.stringify(obj), 'application/json');
const plain = (res, status, text, extra) => reply(res, status, text + '\n', 'text/plain; charset=utf-8', extra);

function api(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600',
      ...(req.headers['access-control-request-private-network'] ? { 'Access-Control-Allow-Private-Network': 'true' } : {}) });
    return res.end();
  }
  const p = url.pathname, room = /^\/api\/rooms\/([A-Za-z]{3})$/.exec(p);
  if (p === '/api/ping' && req.method === 'GET') return json(res, 200, { now: Date.now(), proto: PROTO });
  if (p === '/api/rooms' && req.method === 'GET') {
    return json(res, 200, [...rooms.values()].map(r => ({ code: r.code, members: r.members.size, names: [...r.members.values()].map(m => m.name), stations: stations(r), idle: idle(r), version: r.version })));
  }
  if (p === '/api/rooms' && req.method === 'POST') return createRoom(req, res);
  if (room && req.method === 'GET') {
    const r = rooms.get(room[1].toUpperCase());
    if (!r) return json(res, 404, { error: 'no such room' });
    return json(res, 200, { code: r.code, app: r.app, version: r.version, created: r.created, seq: r.seq, idle: idle(r), members: people(r), keys: keysOut(r) });
  }
  if (p === '/api/ping' || p === '/api/rooms' || room) return json(res, 405, { error: 'method not allowed' });
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
    log(`${code} created by ${clientIp(req)} (${r.app || 'no app'} ${r.version || 'no version'})`);
    json(res, 201, { code });
  });
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
const APP_FILES = new Set(['index.html', 'shared.js', 'sw.js', 'manifest.webmanifest', 'three.min.js', 'three.LICENSE.txt',
  'proteins.html', 'spatial.html', 'README.txt']);
const APP_DIRS = new Set(['stories', 'audio', 'icons']);
const appFile = segs => (segs.length === 1 && APP_FILES.has(segs[0])) || (segs.length === 2 && APP_DIRS.has(segs[0]));

async function serve(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { return plain(res, 400, 'Bad path'); }
  const segs = p.split('/').filter(Boolean);
  // no way out of the folder and nothing hidden: no '..', no dot files (.git), no backslashes, no NUL
  if (p.includes('\0') || p.includes('\\') || segs.some(s => s.startsWith('.'))) return plain(res, 404, 'Not found');
  if (!segs.length) segs.push('index.html');   // / is the app; no folder listings
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
  const head = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: etag, 'Last-Modified': st.mtime.toUTCString(), 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
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

function request(req, res) {
  const url = parseUrl(req);
  if (!url) return plain(res, 400, 'Bad request');
  const fail = err => { log('error', req.url, err.message); if (!res.headersSent) plain(res, 500, 'Internal error'); else res.destroy(); };
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) { try { return api(req, res, url); } catch (err) { return fail(err); } }
  if (ROOT) return serve(req, res, url).catch(fail);
  if (url.pathname === '/') return plain(res, 200, 'Shared-room relay: the API is under /api/ (see relay/README.md).');
  plain(res, 404, 'Not found');
}

const server = OPT.cert ? https.createServer({ cert: fs.readFileSync(OPT.cert), key: fs.readFileSync(OPT.key) }, request) : http.createServer(request);
server.on('upgrade', upgrade);
server.listen(OPT.port, OPT.host, () => {
  const a = server.address(), host = a.family === 'IPv6' ? `[${a.address}]` : a.address, scheme = OPT.cert ? 'https' : 'http';
  console.log(`relay listening on ${scheme}://${host}:${a.port}${ROOT ? ', serving ' + ROOT : ''} (protocol ${PROTO})`);
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
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {   // say goodbye, so clients reconnect at once (a container stop sends SIGTERM)
    for (const r of rooms.values()) for (const m of r.members.values()) m.ws.close(1001, 'relay stopping');
    server.close();
    setTimeout(() => process.exit(0), 200);
  });
}
