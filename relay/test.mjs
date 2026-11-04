// Test of the relay: node relay/test.mjs
// Starts relay/server.mjs on a free port (short timeouts, serving the repository), talks to it with
// Node's WebSocket and with raw sockets (for frames a browser never sends), and exits 1 on a failure.
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_VALUE = 256 << 10, MAX_ROOM = 4 << 20;   // as in server.mjs
let passed = 0, failed = 0;
const ok = (cond, what) => { if (cond) passed++; else { failed++; console.log('  FAIL', what); } };
const is = (t, more = () => true) => m => m.t === t && more(m);

// ---- the relay
const procs = [];
async function start(args, env) {
  const p = spawn(process.execPath, [path.join(HERE, 'server.mjs'), '--port', '0', '--host', '127.0.0.1', ...args], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, RELAY_LOG_TOKEN: '', RELAY_ARGS: '', COLLAB_SCENES: '', ...env } });
  procs.push(p);
  p.out = '';
  p.port = await new Promise((res, rej) => {
    p.stdout.on('data', d => { p.out += d; const m = /listening on https?:\/\/[^\s]+:(\d+)/.exec(p.out); if (m) res(+m[1]); });
    p.on('exit', c => rej(new Error('relay exited with ' + c)));
    setTimeout(() => rej(new Error('relay did not start')), 5000);
  });
  return p;
}
const relay = await start(['--static', REPO, '--timeout', '1', '--expire', '1', '--ping', '0.2']);
const port = relay.port;

// ---- HTTP with raw paths (no normalising)
function req(method, p, { body, headers = {}, at = port } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: at, method, path: p, headers }, res => {
      const parts = [];
      res.on('data', c => parts.push(c));
      res.on('end', () => { const buf = Buffer.concat(parts); resolve({ status: res.statusCode, headers: res.headers, buf, text: buf.toString(), json: () => JSON.parse(buf.toString()) }); });
    });
    r.on('error', reject);
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}
const newRoom = async (body = { app: 'networks', version: 'v1' }) => (await req('POST', '/api/rooms', { body })).json().code;
const state = async code => (await req('GET', '/api/rooms/' + code)).json();

// ---- a WebSocket client (Node's own, as a browser would; headers: as a browser sends Origin, or a proxy X-Forwarded-For)
const client = (room, id, extra = '') => socket(`ws://127.0.0.1:${port}/api/ws?room=${room}&id=${id}${extra}`);
function socket(url, headers) {
  const ws = headers ? new WebSocket(url, { headers }) : new WebSocket(url);
  const c = { ws, q: [], closed: null };
  c.opened = new Promise(r => { ws.onopen = r; ws.onerror = e => { c.failed = true; r(e); }; });
  c.done = new Promise(r => { ws.onclose = e => { c.closed = { code: e.code, reason: e.reason }; r(c.closed); }; });
  ws.onmessage = e => c.q.push(JSON.parse(e.data));
  c.send = m => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  c.next = async (pred, ms = 2000) => {   // the first message so far (or within ms) that matches; it is taken
    for (const end = Date.now() + ms; ;) {
      const i = c.q.findIndex(pred);
      if (i >= 0) return c.q.splice(i, 1)[0];
      if (Date.now() > end) return null;
      await sleep(10);
    }
  };
  c.none = async (pred, ms = 300) => { await sleep(ms); return !c.q.some(pred); };
  c.closedIn = ms => Promise.race([c.done, sleep(ms).then(() => null)]);
  return c;
}
async function joined(room, id, hello) {
  const c = client(room, id);
  c.welcome = await c.next(is('welcome'));
  if (hello) c.send({ t: 'hello', ...hello });
  return c;
}

// ---- a peer of the introduction server (PeerJS's protocol at /peerjs), as PeerJS 1.5.5 connects
const peerQuery = (id, token, key = 'peerjs') => `/peerjs/peerjs?key=${key}&id=${encodeURIComponent(id)}&token=${token}&version=1.5.5`;
const peer = (id, token, key) => socket(`ws://127.0.0.1:${port}${peerQuery(id, token, key)}`);
const ty = (type, more = () => true) => m => m.type === type && more(m);
async function peerOpen(id, token) { const c = peer(id, token); c.open = await c.next(ty('OPEN')); return c; }

// ---- a raw client: masked frames by hand, server frames parsed
function frame({ op = 1, fin = true, payload = '', mask = true, rsv = 0, len }) {
  const body = Buffer.from(payload), n = len ?? body.length, key = mask ? crypto.randomBytes(4) : Buffer.alloc(0);
  const b0 = (fin ? 0x80 : 0) | rsv | op, m = mask ? 0x80 : 0;
  const head = n < 126 ? Buffer.from([b0, m | n]) : n < 65536 ? Buffer.from([b0, m | 126, n >> 8, n & 255]) : Buffer.from([b0, m | 127, 0, 0, 0, 0, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
  if (mask) for (let i = 0; i < body.length; i++) body[i] ^= key[i & 3];
  return Buffer.concat([head, key, body]);
}
async function raw(pathAndQuery, { version = '13', at = port, host = 'x', headers = {} } = {}) {
  const s = net.connect(at, '127.0.0.1');
  await new Promise(r => s.once('connect', r));
  const r = { s, buf: Buffer.alloc(0), head: '', frames: [], msgs: [], ended: false };
  s.on('data', d => {
    r.buf = Buffer.concat([r.buf, d]);
    if (!r.head) { const i = r.buf.indexOf('\r\n\r\n'); if (i < 0) return; r.head = r.buf.subarray(0, i).toString(); r.buf = r.buf.subarray(i + 4); }
    while (r.buf.length >= 2) {
      let len = r.buf[1] & 0x7f, at = 2;
      if (len === 126) { if (r.buf.length < 4) return; len = r.buf.readUInt16BE(2); at = 4; }
      else if (len === 127) { if (r.buf.length < 10) return; len = r.buf.readUInt32BE(6); at = 10; }
      if (r.buf.length < at + len) return;
      const f = { op: r.buf[0] & 15, payload: r.buf.subarray(at, at + len) };
      r.frames.push(f);
      if (f.op === 1) r.msgs.push(JSON.parse(f.payload.toString()));
      r.buf = r.buf.subarray(at + len);
    }
  });
  s.on('close', () => { r.ended = true; });
  s.on('error', () => {});
  const more = Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join('');
  s.write(`GET ${pathAndQuery} HTTP/1.1\r\nHost: ${host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: ${version}\r\n${more}\r\n`);
  r.send = f => s.write(frame(f));
  r.wait = async (pred, ms = 2000) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(10)) { const f = r.frames.find(pred); if (f) return f; } return null; };
  r.closeCode = async (ms = 2000) => { const f = await r.wait(f => f.op === 8, ms); return f && f.payload.length >= 2 ? f.payload.readUInt16BE(0) : null; };
  return r;
}

async function step(name, fn) {
  const before = failed;
  try { await fn(); } catch (err) { failed++; console.log('  FAIL', name, '-', err.stack || err); }
  console.log(failed === before ? 'ok  ' : 'FAIL', name);
}

try {
  let R, A, B;
  await step('HTTP API: ping, CORS, rooms', async () => {
    const p = await req('GET', '/api/ping');
    ok(p.status === 200 && Math.abs(p.json().now - Date.now()) < 5000 && p.json().proto === 1, 'ping answers now and proto');
    ok(p.headers['access-control-allow-origin'] === '*', 'CORS on the API');
    const pre = await req('OPTIONS', '/api/rooms', { headers: { Origin: 'https://example.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Private-Network': 'true' } });
    ok(pre.status === 204 && /POST/.test(pre.headers['access-control-allow-methods']) && pre.headers['access-control-allow-private-network'] === 'true', 'preflight');
    R = await newRoom();
    ok(/^[A-Z]{3}$/.test(R), 'a 3-letter code');
    ok((await req('POST', '/api/rooms', { body: { code: R } })).status === 409, 'a taken code is refused');
    const free = ['QZX', 'QZY'].find(c => c !== R);
    const mine = await req('POST', '/api/rooms', { body: { app: 'networks', version: 'v1', code: free.toLowerCase() } });
    ok(mine.status === 201 && mine.json().code === free, 'a chosen free code (after a relay restart)');
    ok((await req('POST', '/api/rooms', { body: 'not json' })).status === 400, 'a body that is not JSON');
    ok((await req('POST', '/api/rooms', { body: { code: 'AB1' } })).status === 400, 'a bad code');
    ok((await req('POST', '/api/rooms', { body: 'x'.repeat(20000) })).status === 413, 'a body too big');
    const list = (await req('GET', '/api/rooms')).json();
    const row = list.find(r => r.code === R);
    ok(row && row.members === 0 && row.stations === 0 && typeof row.idle === 'number' && row.version === 'v1', 'the room list');
    ok((await req('GET', '/api/rooms/' + (R === 'ZZZ' ? 'ZZY' : 'ZZZ'))).status === 404, 'an unknown room is 404');
    ok((await req('GET', '/api/nothing')).status === 404 && (await req('DELETE', '/api/rooms')).status === 405, '404 and 405');
  });

  await step('sockets that cannot join', async () => {
    const u = client('ZZQ', 'x1');
    ok((await u.next(is('error')))?.code === 'room' && (await u.closedIn(2000))?.code === 4004, 'unknown room: error room, close 4004');
    const b = client(R, '');
    ok((await b.next(is('error')))?.code === 'bad' && (await b.closedIn(2000))?.code === 4000, 'no id: error bad, close 4000');
    const p = client(R, 'p1', '&proto=2');
    ok((await p.next(is('error')))?.code === 'proto' && (await p.closedIn(2000))?.code === 4005, 'wrong protocol: close 4005');
    const w = await raw('/api/elsewhere?room=' + R + '&id=w');
    await sleep(200);
    ok(/^HTTP\/1.1 404/.test(w.head), 'a socket on another path is 404');
    const v = await raw(`/api/ws?room=${R}&id=v`, { version: '8' });
    await sleep(200);
    ok(/^HTTP\/1.1 426/.test(v.head), 'another WebSocket version is 426');
  });

  await step('join, welcome, hello, members', async () => {
    A = await joined(R, 'a1');
    const w = A.welcome;
    ok(w && w.you === 'a1' && w.room === R && w.seq === 0 && JSON.stringify(w.keys) === '{}' && w.members.length === 1 && typeof w.now === 'number' && w.proto === 1 && w.version === 'v1', 'welcome');
    A.q.length = 0;
    A.send({ t: 'hello', name: 'Ann', color: '#ff8800', kind: 'ar', here: true, version: 'v1' });
    const m = await A.next(is('members', m => m.members[0]?.name === 'Ann'));
    ok(m && m.members[0].kind === 'ar' && m.members[0].here === true && m.members[0].color === '#ff8800', 'hello reaches members');
    B = await joined(R, 'b1', { name: 'Bob', kind: 'robot', here: false, version: 'v1' });
    ok(B.welcome.members.length === 2 && B.welcome.members.some(x => x.name === 'Ann'), 'a joiner sees who is there');
    const mb = await A.next(is('members', m => m.members.some(x => x.name === 'Bob')));
    ok(mb && mb.members.find(x => x.id === 'b1').kind === 'desktop', 'others hear of the joiner; an unknown kind is desktop');
    ok((await state(R)).members.length === 2, 'two members in the stored room');
  });

  await step('writes: seq, acknowledgement, order, last writer wins', async () => {
    const batch = [['st.s1', { story: 'flock', x: 0, z: -2, yaw: 0 }], ['st.s1.play', { mode: 'story', t: 0, playing: true, at: 1 }]];
    A.send({ t: 'set', batch, cid: 'a-1' });
    const ack = await A.next(is('set', m => m.cid === 'a-1')), got = await B.next(is('set', m => m.cid === 'a-1'));
    ok(ack && ack.seq === 1 && ack.by === 'a1' && JSON.stringify(ack.batch) === JSON.stringify(batch), 'the writer gets its batch back with seq 1');
    ok(got && got.seq === 1 && got.by === 'a1', 'the other member gets the same');
    A.send({ t: 'set', batch: [['st.s1.play', { mode: 'story', t: 5, playing: true, at: 2 }]], cid: 'a-2' });
    B.send({ t: 'set', batch: [['st.s1.play', { mode: 'story', t: 7, playing: false, at: 3 }]], cid: 'b-1' });
    const seen = async c => [await c.next(is('set')), await c.next(is('set'))];
    const [sa, sb] = [await seen(A), await seen(B)];
    ok(sa.every(Boolean) && sa.map(m => m.cid).join() === sb.map(m => m.cid).join() && sa[0].seq === 2 && sa[1].seq === 3, 'both see the same order');
    const st = await state(R), last = sa[1];
    ok(st.keys['st.s1.play'].seq === 3 && st.keys['st.s1.play'].by === last.by && JSON.stringify(st.keys['st.s1.play'].v) === JSON.stringify(last.batch[0][1]), 'the later write wins');
    for (let i = 0; i < 20; i++) A.send({ t: 'set', batch: [['st.s1.play', { mode: 'story', t: i, playing: true, at: 4 }]], cid: 'r' + i });
    const seqs = [];
    for (let i = 0; i < 20; i++) seqs.push((await B.next(is('set')))?.seq);
    ok(seqs.every((s, i) => s === 4 + i), 'twenty writes arrive in order, seq by seq');
    A.q.length = 0;
  });

  await step('null refused outside the deletable families', async () => {
    A.send({ t: 'set', batch: [['roomFrameShared', { uuid: 'u1', o: [0, 0, 0], x: [1, 0, 0], by: 'a1', at: 1, src: 'marks' }]], cid: 'a-rf' });
    ok(await A.next(is('set', m => m.cid === 'a-rf')), 'roomFrameShared stored');
    B.q.length = 0;
    A.send({ t: 'set', batch: [['roomFrameShared', null]], cid: 'a-null' });
    const e = await A.next(is('error', m => m.cid === 'a-null'));
    ok(e && e.code === 'refused' && e.keys.join() === 'roomFrameShared', 'the writer hears why, with its cid');
    ok(await B.none(is('set')), 'nobody else hears of it');
    ok((await state(R)).keys.roomFrameShared, 'the value stays');
    A.send({ t: 'set', batch: [['foo', null], ['pose.p1', { x: 1 }]], cid: 'a-mix' });
    const s = await A.next(is('set', m => m.cid === 'a-mix')), e2 = await A.next(is('error', m => m.cid === 'a-mix'));
    ok(s && s.batch.length === 1 && s.batch[0][0] === 'pose.p1' && e2 && e2.keys.join() === 'foo', 'a mixed batch stores what it can and names the rest');
    A.send({ t: 'set', batch: [['pose.p1', null]], cid: 'a-del' });
    const d = await B.next(is('set', m => m.cid === 'a-del'));
    ok(d && d.batch[0][1] === null && !('pose.p1' in (await state(R)).keys), 'null deletes a pose');
  });

  await step('the station epoch rule', async () => {
    const write = async (c, batch, cid) => { c.send({ t: 'set', batch, cid }); return Promise.race([c.next(is('set', m => m.cid === cid)), c.next(is('error', m => m.cid === cid))]); };
    await write(A, [['st.s1.x', { tab: 'a' }]], 'x1');
    let s = await write(A, [['st.s1', { story: 'flock', x: 1, z: -2, yaw: 0 }]], 'mv');
    let k = (await state(R)).keys;
    ok(s.batch.length === 1 && k['st.s1.play'] && k['st.s1.x'], 'moving a station keeps its state');
    B.q.length = 0;
    s = await write(B, [['st.s1', { story: 'robots', x: 1, z: -2, yaw: 0 }]], 'ep');
    const seenA = await A.next(is('set', m => m.cid === 'ep'));
    const nulls = seenA.batch.filter(p => p[1] === null).map(p => p[0]).sort().join();
    k = (await state(R)).keys;
    ok(nulls === 'st.s1.play,st.s1.x' && seenA.batch.at(-1)[0] === 'st.s1' && !k['st.s1.play'] && !k['st.s1.x'] && k['st.s1'].v.story === 'robots', 'another story drops the state keys in the same seq');
    s = await write(A, [['st.s1', { story: 'airports', x: 1, z: -2, yaw: 0 }], ['st.s1.play', { mode: 'explore', t: 0, playing: false, at: 9 }]], 'ep2');
    k = (await state(R)).keys;
    ok(k['st.s1.play']?.v.mode === 'explore' && k['st.s1.play'].seq === s.seq, 'state written with the change survives it');
    s = await write(A, [['st.s1.x', { story: 'robots', tab: 'b' }]], 'stale');
    ok(s.t === 'error' && /stale/.test(s.text), 'a late write for the old story is refused');
    s = await write(A, [['st.zz.play', { t: 0 }]], 'nost');
    ok(s.t === 'error' && /no such station/.test(s.text), 'state for a missing station is refused');
    s = await write(A, [['st.s2', { x: 0 }]], 'nostory');
    ok(s.t === 'error' && /story/.test(s.text), 'a station needs a story');
    s = await write(A, [['st.' + 'x'.repeat(40), { story: 'flock' }]], 'longid');
    ok(s.t === 'error', 'a station id is at most 32 characters');
    s = await write(A, [['st.s1', null]], 'rm');
    k = (await state(R)).keys;
    ok(s.t === 'set' && s.batch.some(p => p[0] === 'st.s1.play' && p[1] === null) && !Object.keys(k).some(x => x.startsWith('st.s1')), 'removing a station removes its state');
    await write(A, [['st.s1', { story: 'flock', x: 0, z: -2, yaw: 0 }], ['st.s1.play', { mode: 'story', t: 3, playing: true, at: 10 }]], 'again');
    B.q.length = 0;
  });

  await step('fx: passed on, not stored, not echoed, rate capped', async () => {
    A.send({ t: 'fx', k: 'p.a1', v: { st: 's1', head: [0, 1.6, 0, 0, 0, 0, 1] } });
    const f = await B.next(is('fx'));
    ok(f && f.k === 'p.a1' && f.by === 'a1' && f.v.head[1] === 1.6, 'the others get it');
    ok(await A.none(is('fx')), 'the sender does not');
    ok(!('p.a1' in (await state(R)).keys), 'not stored');
    B.q.length = 0;
    for (let i = 0; i < 150; i++) A.send({ t: 'fx', k: 'p.a1', v: i });
    await sleep(600);
    const n = B.q.filter(is('fx')).length;
    ok(n >= 50 && n <= 120, `at most 60 a second get through (${n} of 150 in a burst)`);
    await sleep(400);
    ok(/refused \d+ fx from a1/.test(relay.out), 'dropped fx are logged');
    B.q.length = 0;
  });

  await step('ping and pong', async () => {
    A.send({ t: 'ping', c: 123.5 });
    const p = await A.next(is('pong'));
    ok(p && p.c === 123.5 && Math.abs(p.now - Date.now()) < 5000, 'pong carries c and now');
  });

  let C;
  await step('a late joiner gets everything', async () => {
    C = await joined(R, 'c1', { name: 'Cy', kind: 'vr', version: 'v1' });
    const st = await state(R), w = C.welcome;
    ok(w.seq === st.seq && JSON.stringify(w.keys) === JSON.stringify(st.keys), 'welcome has every key, with seq and by');
    ok(Object.values(w.keys).every(e => 'v' in e && e.seq > 0 && typeof e.by === 'string') && w.keys['st.s1.play'], 'entries are { v, seq, by }');
    ok(!Object.keys(w.keys).some(k => k.startsWith('p.')), 'no fx in the room state');
  });

  await step('malformed messages are refused, the socket stays', async () => {
    const bad = async (m, code = 'bad') => { C.send(m); const e = await C.next(is('error')); return e && e.code === code; };
    ok(await bad('not json'), 'not JSON');
    ok(await bad('[1,2]'), 'not an object');
    ok(await bad({ t: 'nope' }), 'unknown t');
    ok(await bad({ t: 'set', batch: 'x' }), 'a batch that is not a list');
    ok(await bad({ t: 'set', batch: [] }), 'an empty batch');
    ok(await bad({ t: 'set', batch: [['bad key!', 1]], cid: 'k' }, 'refused'), 'a bad key');
    ok(await bad({ t: 'set', batch: [['x']] }, 'refused'), 'not a pair');
    ok(await bad({ t: 'set', batch: [['big', 'x'.repeat(300000)]] }, 'refused'), 'a value too big');
    ok(await bad({ t: 'fx', k: 'p.c1' }), 'fx without v');
    ok(await bad({ t: 'fx', k: 'p.c1', v: 'x'.repeat(70000) }), 'fx too big');
    const deep = '['.repeat(200000) + ']'.repeat(200000);
    ok(await bad(`{"t":"set","batch":[["deep",${deep}]]}`), 'a value nested too deeply');
    ok(await bad(`{"t":"fx","k":"deep","v":${deep}}`), 'an fx nested too deeply');
    C.send({ t: 'ping', c: 1 });
    ok(await C.next(is('pong')), 'still answered afterwards');
  });

  await step('a message over 1 MB closes the socket (1009)', async () => {
    C.send(JSON.stringify({ t: 'fx', k: 'big', v: 'x'.repeat(1.1e6) }));
    ok((await C.closedIn(3000))?.code === 1009, 'closed with 1009');
    ok(await A.next(is('members', m => !m.members.some(x => x.id === 'c1'))), 'and the member leaves');
    ok(await B.none(is('fx', m => m.k === 'big'), 100), 'nothing passed on');
  });

  await step('frames by hand: masking, fragmentation, control frames, close', async () => {
    const q = `/api/ws?room=${R}&id=`;
    let r = await raw(q + 'r1');
    r.send({ payload: '{"t":"ping","c":1}', mask: false });
    ok((await r.closeCode()) === 1002, 'an unmasked frame: 1002');
    r = await raw(q + 'r2');
    r.send({ op: 2, payload: 'abc' });
    ok((await r.closeCode()) === 1003, 'a binary frame: 1003');
    r = await raw(q + 'r3');
    r.s.write(frame({ payload: Buffer.from([0x7b, 0xff, 0xfe, 0x7d]) }));
    ok((await r.closeCode()) === 1007, 'invalid UTF-8: 1007');
    r = await raw(q + 'r4');
    r.send({ op: 0, payload: 'x' });
    ok((await r.closeCode()) === 1002, 'a continuation without a start: 1002');
    r = await raw(q + 'r5');
    r.send({ rsv: 0x40, payload: '{}' });
    ok((await r.closeCode()) === 1002, 'reserved bits: 1002');
    r = await raw(q + 'r6');
    r.send({ op: 9, payload: 'x'.repeat(126) });
    ok((await r.closeCode()) === 1002, 'a control frame over 125 bytes: 1002');
    r = await raw(q + 'r7');
    r.s.write(frame({ len: 2 << 20 }).subarray(0, 14));   // only the header of a 2 MB frame
    ok((await r.closeCode()) === 1009, 'a frame announced over 1 MB: 1009 at once');
    r = await raw(q + 'r8');
    r.send({ fin: false, payload: '{"t":"pi' });
    r.send({ op: 9, payload: 'hi' });
    r.send({ op: 0, fin: false, payload: 'ng",' });
    r.send({ op: 0, payload: '"c":7}' });
    const pong = await r.wait(f => f.op === 10);
    ok(pong && pong.payload.toString() === 'hi', 'a ping inside a fragmented message gets its pong');
    for (const end = Date.now() + 2000; !r.msgs.some(is('pong')) && Date.now() < end;) await sleep(10);
    ok(r.msgs.find(is('pong'))?.c === 7, 'the fragments make one message');
    ok(await r.wait(f => f.op === 9, 1000), 'the relay pings');
    const c = Buffer.alloc(2); c.writeUInt16BE(1000);
    r.send({ op: 8, payload: c });
    ok((await r.closeCode()) === 1000, 'a close is answered with its code');
    for (const end = Date.now() + 2000; !r.ended && Date.now() < end;) await sleep(10);
    ok(r.ended, 'and the connection ends');
  });

  await step('a silent member times out; answering pings keeps one in', async () => {
    A.q.length = 0;
    const s = await raw(`/api/ws?room=${R}&id=quiet`);
    s.send({ payload: JSON.stringify({ t: 'hello', name: 'Quiet', version: 'v1' }) });
    ok(await A.next(is('members', m => m.members.some(x => x.id === 'quiet'))), 'joined');
    const gone = await A.next(is('members', m => !m.members.some(x => x.id === 'quiet')), 4000);
    ok(gone, 'dropped after the timeout (1 s here)');
    ok(s.msgs.some(is('error', m => m.code === 'timeout')) && (await s.closeCode()) === 4009, 'told why, closed with 4009');
    const st = await state(R);
    ok(st.members.some(x => x.id === 'a1') && st.members.some(x => x.id === 'b1'), 'members whose sockets answer pings stay, idle or not');
  });

  await step('version and protocol mismatch, a second socket for one id', async () => {
    const d = await joined(R, 'd1', { name: 'Dee', version: 'v2' });
    ok((await d.next(is('error')))?.code === 'version' && (await d.closedIn(2000))?.code === 4006, 'another app version: 4006');
    const p = await joined(R, 'p2', { name: 'Pat', version: 'v1', proto: 9 });
    ok((await p.next(is('error')))?.code === 'proto' && (await p.closedIn(2000))?.code === 4005, 'another protocol in hello: 4005');
    const e1 = await joined(R, 'e', { name: 'Eve', version: 'v1' });
    const e2 = await joined(R, 'e', { name: 'Eve', version: 'v1' });
    ok((await e1.next(is('error')))?.code === 'replaced' && (await e1.closedIn(2000))?.code === 4008, 'the old socket is replaced');
    await sleep(200);
    ok((await state(R)).members.filter(x => x.id === 'e').length === 1, 'one member for the id');
    e2.send({ t: 'ping', c: 2 });
    ok(await e2.next(is('pong')), 'the new socket works');
    e2.ws.close();
  });

  await step('a room holds at most 5000 keys and 4 MB, keys counted', async () => {
    const write = async (c, batch, cid) => { c.send({ t: 'set', batch, cid }); return Promise.race([c.next(is('set', m => m.cid === cid), 5000), c.next(is('error', m => m.cid === cid), 5000)]); };
    const K = await newRoom(), h = await joined(K, 'h1', { name: 'Hal', version: 'v1' });
    let s;
    for (let b = 0; b < 10; b++) s = await write(h, Array.from({ length: 500 }, (_, i) => ['pose.' + (b * 500 + i), 1]), 'fill' + b);
    ok(s?.t === 'set' && Object.keys((await state(K)).keys).length === 5000, '5000 keys stored');
    s = await write(h, [['pose.more', 1]], 'more');
    ok(s?.t === 'error' && /5000 keys/.test(s.text), 'one more is refused');
    ok((await write(h, [['pose.0', 2]], 'same'))?.t === 'set', 'a key already there can still change');
    ok((await write(h, [['pose.1', null], ['pose.more', 1]], 'swap'))?.t === 'set', 'one goes, one comes: fine');
    h.ws.close();
    const S = await newRoom(), g = await joined(S, 'g2', { name: 'Gil', version: 'v1' });
    const big = n => 'x'.repeat(n - 2);   // a string whose JSON is n bytes
    for (let i = 0; i < 15; i++) s = await write(g, [['f' + String(i).padStart(2, '0'), big(MAX_VALUE)]], 'big' + i);
    ok(s?.t === 'set', '15 values of 256 KB');
    const left = MAX_ROOM - 15 * (3 + MAX_VALUE);   // what is left with the keys counted
    s = await write(g, [['f15', big(left - 3 + 4)]], 'over');
    ok(s?.t === 'error' && /full/.test(s.text), 'a value that fits only if keys were free is refused');
    s = await write(g, [['f15', big(left - 3)]], 'exact');
    ok(s?.t === 'set', 'one that fits with its key is stored');
    g.ws.close();
  });

  await step('rooms expire after their last member left', async () => {
    const X = await newRoom(), Y = await newRoom();
    const f = await joined(X, 'f1', { name: 'Fay', version: 'v1' });
    f.ws.close();
    await f.done;
    ok((await req('GET', '/api/rooms/' + X)).status === 200, 'still there at once');
    await sleep(2600);
    ok((await req('GET', '/api/rooms/' + X)).status === 404 && (await req('GET', '/api/rooms/' + Y)).status === 404, 'gone after the expiry (1 s here), joined or not');
    const g = client(X, 'g1');
    ok((await g.next(is('error')))?.code === 'room', 'joining it now: unknown room');
    ok((await req('GET', '/api/rooms/' + R)).status === 200, 'a room with members stays');
  });

  await step('serving the app', async () => {
    const file = p => fs.readFileSync(path.join(REPO, p));
    let r = await req('GET', '/');
    ok(r.status === 200 && /^text\/html/.test(r.headers['content-type']) && r.buf.equals(file('index.html')), '/ is index.html');
    r = await req('GET', '/stories/flock.js');
    ok(r.status === 200 && r.headers['content-type'] === 'text/javascript; charset=utf-8' && r.buf.equals(file('stories/flock.js')), 'a story file');
    r = await req('GET', '/stories/flock.js', { headers: { 'Accept-Encoding': 'gzip, br' } });
    ok(r.headers['content-encoding'] === 'gzip' && zlib.gunzipSync(r.buf).equals(file('stories/flock.js')) && /Accept-Encoding/.test(r.headers.vary), 'gzipped when asked');
    const types = { '/shared.js': 'text/javascript', '/sw.js': 'text/javascript', '/manifest.webmanifest': 'application/manifest+json', '/icons/icon-192.png': 'image/png', '/three.min.js': 'text/javascript',
      '/three.LICENSE.txt': 'text/plain', '/README.txt': 'text/plain', '/proteins.html': 'text/html', '/peerjs.min.js': 'text/javascript',
      '/PEERJS-LICENSE.txt': 'text/plain', '/p2p/': 'text/html', '/p2p/index.html': 'text/html' };
    for (const [p, t] of Object.entries(types)) { r = await req('HEAD', p); ok(r.status === 200 && r.headers['content-type'].startsWith(t), `${p} is ${t}`); }
    ok((await req('GET', '/sw.js')).headers['cache-control'] === 'no-cache', 'files are revalidated (no-cache)');
    r = await req('GET', '/version.json');
    ok(r.status === 200 && r.headers['content-type'] === 'application/json' && r.headers['cache-control'] === 'no-store', 'the release\'s version file: never kept (no-store)');
    const mp3 = file('audio/narration.mp3'), size = mp3.length;
    r = await req('HEAD', '/audio/narration.mp3');
    ok(r.headers['content-type'] === 'audio/mpeg' && r.headers['accept-ranges'] === 'bytes' && +r.headers['content-length'] === size, 'the narration: audio/mpeg, ranges');
    r = await req('GET', '/audio/narration.mp3', { headers: { Range: 'bytes=0-99' } });
    ok(r.status === 206 && r.headers['content-range'] === `bytes 0-99/${size}` && r.buf.equals(mp3.subarray(0, 100)), 'a byte range');
    r = await req('GET', '/audio/narration.mp3', { headers: { Range: 'bytes=-10' } });
    ok(r.status === 206 && r.buf.equals(mp3.subarray(size - 10)), 'a suffix range');
    r = await req('GET', '/audio/narration.mp3', { headers: { Range: `bytes=${size - 5}-` } });
    ok(r.status === 206 && r.buf.length === 5, 'an open range');
    r = await req('GET', '/audio/narration.mp3', { headers: { Range: `bytes=${size}-` } });
    ok(r.status === 416 && r.headers['content-range'] === `bytes */${size}`, 'an unsatisfiable range: 416');
    const etag = (await req('HEAD', '/index.html')).headers.etag;
    ok((await req('GET', '/index.html', { headers: { 'If-None-Match': etag } })).status === 304, 'a matching ETag: 304');
    ok((await req('GET', '/nope.html')).status === 404 && (await req('POST', '/index.html')).status === 405, '404 and 405');
    const evil = ['/../../../../etc/passwd', '/%2e%2e/%2e%2e/%2e%2e/etc/passwd', '/stories/..%2f..%2f..%2f..%2fetc%2fpasswd', '/stories/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '/..%5c..%5c..%5cetc%5cpasswd', '/.git/HEAD', '/%2egit/HEAD', '/index.html%00.png', '/%E0%A4%A'];
    for (const p of evil) { r = await req('GET', p); ok(r.status >= 400 && !/root:|ref: /.test(r.text), `refused: ${p} (${r.status})`); }
    // a fresh shared space: the app under s/<n>/ too (a new page address, so Quest Browser gives it a new space)
    r = await req('GET', '/s/2/');
    ok(r.status === 200 && r.buf.equals(file('index.html')), '/s/2/ is index.html');
    r = await req('GET', '/s/2/stories/flock.js');
    ok(r.status === 200 && r.buf.equals(file('stories/flock.js')), '/s/2/stories/flock.js is the story file');
    r = await req('GET', '/s/17?x=1');
    ok(r.status === 301 && r.headers.location === '/s/17/?x=1', '/s/17 moves to /s/17/ (relative addresses need the slash)');
    for (const p of ['/s/x/index.html', '/s/12345/', '/s/2/tools/smoke.mjs', '/s/2/../../.git/HEAD', '/s/2/s/3/index.html']) { r = await req('GET', p); ok(r.status >= 400 && !/ref: /.test(r.text), `refused: ${p} (${r.status})`); }
  });

  await step('only the app\'s files are served, not the rest of the repository', async () => {
    // everything the service worker caches (SHELL, and the narrations that exist) is served
    const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8'), want = [];
    for (const name of ['SHELL', 'AUDIO']) want.push(...[...new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(sw)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]));
    ok(want.length > 15, `sw.js lists the app's files (${want.length})`);
    const missing = [];
    for (const f of want) if (!f || fs.existsSync(path.join(REPO, f))) { const r = await req('HEAD', '/' + f); if (r.status !== 200) missing.push(`/${f} (${r.status})`); }
    ok(!missing.length, 'every file sw.js caches is served' + (missing.length ? ': not ' + missing.join(' ') : ''));
    const data = 'iker_nodes.tsv';   // (the authors' files: never served, also from a copy kept in the folder)
    const not = ['/ikerdata/' + encodeURIComponent(data), '/tools/smoke.mjs', '/tools/lbi/build.mjs', '/docs/shared-space-plan.md', '/relay/server.mjs', '/relay/README.md',
      '/AGENTS.md', '/README.md', '/stories/', '/audio', '/ikerdata/', '/stories/x/../../tools/smoke.mjs', '/INDEX.HTML'];
    for (const p of not) { const r = await req('GET', p); ok(r.status === 404, `not served: ${p} (${r.status})`); }
  });

  await step('a download cut short closes its file', async () => {
    const fds = () => fs.readdirSync(`/proc/${relay.pid}/fd`).filter(f => { try { return fs.readlinkSync(`/proc/${relay.pid}/fd/${f}`).endsWith('narration.mp3'); } catch { return false; } }).length;
    try { fds(); } catch { console.log('  (no /proc here: skipped)'); return; }
    const cut = headers => new Promise(resolve => {   // read the first bytes, then hang up
      const r = http.get({ host: '127.0.0.1', port, path: '/audio/narration.mp3', headers }, res => res.once('data', () => { r.destroy(); resolve(); }));
      r.on('error', resolve);
    });
    for (let i = 0; i < 20; i++) await cut(i % 2 ? { Range: 'bytes=1000-' } : {});
    let n = 0;
    for (const end = Date.now() + 2000; (n = fds()) && Date.now() < end;) await sleep(50);
    ok(n === 0, `no file left open after 20 aborted downloads (${n} open)`);
    const r = await req('GET', '/audio/narration.mp3', { headers: { Range: 'bytes=0-9' } });
    ok(r.status === 206 && r.buf.length === 10, 'and the file is still served');
  });

  await step('a link out of the served folder is not followed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-test-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>t</title>');
    fs.mkdirSync(path.join(dir, 'stories'));
    fs.writeFileSync(path.join(dir, 'stories', 'a.js'), '// a');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'secret inside');
    const outside = path.join(os.tmpdir(), `relay-secret-${process.pid}.txt`);
    fs.writeFileSync(outside, 'secret');
    fs.symlinkSync(outside, path.join(dir, 'stories', 'out.js'));
    fs.symlinkSync(path.join(dir, 'notes.txt'), path.join(dir, 'stories', 'in.js'));
    fs.symlinkSync(path.join(dir, 'stories', 'a.js'), path.join(dir, 'stories', 'b.js'));
    const other = await start(['--static', dir, '--quiet']);
    ok((await req('GET', '/', { at: other.port })).status === 200 && (await req('GET', '/stories/a.js', { at: other.port })).status === 200, 'its index and a story');
    let r = await req('GET', '/stories/out.js', { at: other.port });
    ok(r.status === 404 && !/secret/.test(r.text), 'a link out of the folder is 404');
    r = await req('GET', '/stories/in.js', { at: other.port });
    ok(r.status === 404 && !/secret/.test(r.text), 'a link to a file that is not the app\'s is 404');
    ok((await req('GET', '/notes.txt', { at: other.port })).status === 404, 'a file that is not the app\'s is 404');
    ok((await req('GET', '/stories/b.js', { at: other.port })).status === 200, 'a link to an app file is served');
    other.kill();
    fs.rmSync(dir, { recursive: true }); fs.rmSync(outside);
  });

  const lanIps = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal);
  await step('over http, the start lines send headsets to --lan or adb reverse', async () => {
    const H = await start(['--static', REPO, '--host', '0.0.0.0', '--quiet']);
    for (const end = Date.now() + 2000; !/On this machine/.test(H.out) && Date.now() < end;) await sleep(20);
    ok(!/On every headset/.test(H.out) && new RegExp(`--lan .*adb reverse tcp:${H.port} tcp:${H.port} and open http://localhost:${H.port}/`).test(H.out), 'no http:// address for headsets; --lan or adb reverse instead');
    if (lanIps.length) ok(/Desktops on the same network can open http:/.test(H.out), 'the network address for desktops');
    H.kill();
  });

  await step('--lan: HTTPS with a certificate of its own for this machine, the app served', async () => {
    try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); } catch { console.log('  (no openssl here: skipped)'); return; }
    const L = await start(['--lan', '--host', '0.0.0.0']);
    const get = p => new Promise((res, rej) => https.get({ host: '127.0.0.1', port: L.port, path: p, rejectUnauthorized: false }, r => {
      const san = r.socket.getPeerCertificate().subjectaltname || '';
      r.resume(); r.on('end', () => res({ status: r.statusCode, san }));
    }).on('error', rej));
    const a = await get('/api/ping'), b = await get('/index.html');
    ok(a.status === 200 && b.status === 200, 'the API and the app over HTTPS');
    ok(/IP Address:127\.0\.0\.1/.test(a.san) && /DNS:localhost/.test(a.san), 'the certificate names this machine');
    ok(/listening on https:/.test(L.out), 'it says https');
    for (const end = Date.now() + 2000; !/On this machine/.test(L.out) && Date.now() < end;) await sleep(20);
    if (lanIps.length) ok(/On every headset .*: https:\/\//.test(L.out) && !/adb reverse/.test(L.out), 'the https:// address for headsets');
    ok((await get('/tools/smoke.mjs')).status === 404 && (await get('/ikerdata/')).status === 404, 'and only the app');
    L.kill();
  });

  await step('--logs: what a headset sends is kept, a JSON line per entry, per room and member', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-logs-'));
    const L = await start(['--logs', dir, '--quiet']);
    const send = body => req('POST', '/api/log', { body, at: L.port });
    const r1 = await send({ room: 'ABC', id: 'm1abcdef', name: 'Ada L.', kind: 'ar', entries: [{ t: 1, ev: 'frame', src: 'marks' }, { t: 2, ev: 'sample' }, 'not an entry'] });
    const files = fs.readdirSync(dir);
    const lines = files.length ? fs.readFileSync(path.join(dir, files[0]), 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
    ok(r1.status === 200 && files.length === 1 && /^\d{4}-\d\d-\d\d-ABC-AdaL-m1abcd\.jsonl$/.test(files[0]) && lines.length === 2 && lines[0].ev === 'frame' &&
      lines[0].kind === 'ar' && Number.isFinite(lines[0].at), 'two lines in a file named after the day, room, name and member');
    ok((await send({ room: 'ABC', id: 'm1abcdef', entries: [{ t: 3 }] })).status === 429, 'one a second per member');
    ok((await send({ room: 'abc!', id: 'm2', entries: [] })).status === 400 && (await send('not json')).status === 400, 'a bad room, or not JSON, is refused');
    ok((await send({ room: 'ABC', id: 123456, entries: [] })).status === 400 && (await send({ room: 'ABC', id: null, entries: [] })).status === 400 &&
      (await req('GET', '/api/ping', { at: L.port })).status === 200, 'an id that is not a string is refused, and the relay lives on');
    ok((await req('GET', '/api/log', { at: L.port })).status === 405, 'only POST');
    ok((await req('POST', '/api/log', { body: { room: 'ABC', id: 'm3', entries: [] } })).status === 404, 'without --logs (or --lan) logs are off');
    L.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ---- the introduction server for peer to peer (PeerJS 1.5.5's server protocol at /peerjs)
  await step('introduction server: ids over HTTP, CORS, bad requests refused', async () => {
    const a = await req('GET', '/peerjs/peerjs/id?ts=17301234560.42&version=1.5.5'), b = await req('GET', '/peerjs/peerjs/id?ts=2&version=1.5.5');
    ok(a.status === 200 && /^[0-9a-f-]{36}$/.test(a.text) && a.text !== b.text, 'a new id as text (no newline), another each time');
    ok(a.headers['access-control-allow-origin'] === '*' && /^text\/plain/.test(a.headers['content-type']), 'CORS as the API');
    const pre = await req('OPTIONS', '/peerjs/peerjs/id', { headers: { Origin: 'https://example.github.io', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Private-Network': 'true' } });
    ok(pre.status === 204 && pre.headers['access-control-allow-private-network'] === 'true', 'preflight (also for private networks)');
    ok((await req('GET', '/peerjs')).json().key === 'peerjs' && (await req('GET', '/peerjs/')).status === 200, 'its root says what it is');
    ok((await req('GET', '/peerjs/other/id')).status === 404 && (await req('POST', '/peerjs/peerjs/id')).status === 405 &&
      (await req('GET', '/peerjs/peerjs/peers')).status === 401, 'another key 404, POST 405, no listing of peers (401)');
    const n = peer('x1', '');
    ok((await n.next(ty('ERROR')))?.payload?.msg && (await n.closedIn(2000))?.code === 4000, 'no token: ERROR, closed (4000)');
    const k = peer('x2', 'tok', 'other');
    ok((await k.next(ty('INVALID-KEY'))) && (await k.closedIn(2000))?.code === 4003, 'another key: INVALID-KEY, closed (4003)');
    const i = peer('no good!', 'tok');
    ok((await i.next(ty('ERROR'))) && (await i.closedIn(2000))?.code === 4000, 'an id PeerJS would not make: ERROR, closed');
    const w = await raw('/peerjs/peerjs/elsewhere?key=peerjs&id=x3&token=tok');
    await sleep(200);
    ok(/^HTTP\/1.1 404/.test(w.head), 'a socket on another path is 404');
  });

  await step('introduction server: OPEN, ID-TAKEN, a reconnect, messages passed on with src, kept for a while, EXPIRE', async () => {
    const P = await peerOpen('pa', 'tokpa7'), Q = await peerOpen('pb', 'tokpb7');
    ok(P.open && Q.open, 'OPEN for a new id');
    const t0 = Date.now(), cand = n => ({ candidate: { candidate: `candidate:${n} 1 udp 2122260223 192.168.1.20 5${n}000 typ host`, sdpMid: '0', sdpMLineIndex: 0 }, type: 'data', connectionId: 'dc_g' });
    P.send({ type: 'OFFER', dst: 'ghost', payload: { sdp: { type: 'offer', sdp: 'v=0' }, type: 'data', connectionId: 'dc_g' } });
    P.send({ type: 'CANDIDATE', dst: 'ghost', payload: cand(1) });
    P.send({ type: 'CANDIDATE', dst: 'ghost', payload: cand(2) });
    P.send({ type: 'LEAVE', dst: 'nobody' });
    const T = peer('pa', 'tokzz7');
    const taken = await T.next(ty('ID-TAKEN'));
    ok(taken && taken.payload?.msg && (await T.closedIn(2000))?.code === 4001, 'the same id with another token: ID-TAKEN, closed (4001)');
    const offer = { sdp: { type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1' }, type: 'data', connectionId: 'dc_1', label: 'dc_1', serialization: 'json', reliable: true, metadata: { name: 'Ann' } };
    P.send({ type: 'OFFER', src: 'forged', dst: 'pb', payload: offer });
    const o = await Q.next(ty('OFFER'));
    ok(o && o.src === 'pa' && o.dst === 'pb' && JSON.stringify(o.payload) === JSON.stringify(offer), 'an OFFER reaches its dst, src filled in (never the sender\'s own)');
    Q.send({ type: 'ANSWER', dst: 'pa', payload: { sdp: { type: 'answer', sdp: 'v=0' }, type: 'data', connectionId: 'dc_1' } });
    ok((await P.next(ty('ANSWER')))?.src === 'pb', 'an ANSWER back');
    P.send({ type: 'CANDIDATE', dst: 'pb', payload: cand(3) });
    ok((await Q.next(ty('CANDIDATE')))?.payload?.candidate?.candidate === cand(3).candidate.candidate, 'a CANDIDATE');
    P.send({ type: 'LEAVE', dst: 'pb' });
    ok((await Q.next(ty('LEAVE')))?.src === 'pa', 'a LEAVE');
    P.send({ type: 'HEARTBEAT' }); P.send('not json'); P.send({ type: 'NOPE', dst: 'pb' }); P.send({ type: 'OFFER', payload: offer });
    ok(await Q.none(() => true) && await P.none(() => true, 50) && !P.closed, 'a heartbeat, a message that is not JSON, an unknown type or no dst: nothing passed on, no answer, the socket stays');
    P.send({ type: 'CANDIDATE', dst: 'pb', payload: cand(4) });
    ok(await Q.next(ty('CANDIDATE')), 'and it still passes messages on');
    // messages for an id that comes a moment later wait for it, in order, after its OPEN
    P.send({ type: 'OFFER', dst: 'pc', payload: { ...offer, connectionId: 'dc_c' } });
    P.send({ type: 'CANDIDATE', dst: 'pc', payload: cand(5) });
    await sleep(300);
    const C = peer('pc', 'tokpc7');
    for (const end = Date.now() + 2000; C.q.length < 3 && Date.now() < end;) await sleep(10);
    ok(C.q.map(m => m.type).join() === 'OPEN,OFFER,CANDIDATE' && C.q[1].src === 'pa' && C.q[1].payload.connectionId === 'dc_c',
      'messages for an id not yet connected wait for it: after its OPEN, in order');
    // the same id and token again (a reconnect while the old socket hangs on): OPEN, and the new socket wins
    const P2 = await peerOpen('pa', 'tokpa7');
    ok(P2.open && (await P.closedIn(2000))?.code === 4008, 'the same id and token again: OPEN, the old socket closed (4008)');
    Q.send({ type: 'CANDIDATE', dst: 'pa', payload: cand(6) });
    ok(await P2.next(ty('CANDIDATE', m => m.src === 'pb')), 'messages go to the new socket');
    // nobody came for ghost: its sender hears EXPIRE once (on its socket now), after about 5 s; a LEAVE is never kept
    const ex = await P2.next(ty('EXPIRE', m => m.src === 'ghost'), 8000), took = Date.now() - t0;
    ok(ex && ex.dst === 'pa' && took > 4000 && took < 7500, `EXPIRE from the absent id, after ${(took / 1000).toFixed(1)} s`);
    await sleep(400);
    ok(!P2.q.some(ty('EXPIRE')) && !Q.q.some(ty('EXPIRE')), 'once for its three messages, none for a LEAVE or for an id that came');
    // an id is free once its socket closes
    Q.ws.close(); await Q.done; await sleep(100);
    const Q2 = await peerOpen('pb', 'tokother7');
    ok(Q2.open, 'a closed socket frees its id: OPEN for another token');
    for (const c of [P2, Q2, C]) c.ws.close();
    ok(/peer join pa \(\d+ connected\)/.test(relay.out) && /peer back pa/.test(relay.out) && /peer refused pa \(id taken\)/.test(relay.out) &&
      /peer leave pb/.test(relay.out) && /peer ghost never came/.test(relay.out), 'the log: joins, a reconnect, a refusal, leaves, an id that never came');
    ok(!/tokp|tokzz|tokother|192\.168\.1\.20|v=0/.test(relay.out), 'ids only: no tokens or messages in the log');
  });

  await step('introduction server: heartbeats keep a peer in; a silent one is dropped and its id freed', async () => {
    const h = await raw(peerQuery('beats', 'tokhb')), s = await raw(peerQuery('silent', 'toks'));   // (raw sockets never answer pings)
    const beat = setInterval(() => h.send({ payload: '{"type":"HEARTBEAT"}' }), 250);
    const code = await s.closeCode(4000);
    clearInterval(beat);
    ok(s.msgs.some(ty('OPEN')) && code === 4009, 'a silent peer is closed (4009) after the timeout (1 s here)');
    ok(h.msgs.some(ty('OPEN')) && !h.frames.some(f => f.op === 8) && !h.ended, 'one that sends HEARTBEAT stays');
    const again = await peerOpen('silent', 'tokother');
    ok(again.open && /peer timeout silent/.test(relay.out), 'the silent one\'s id is free again');
    again.ws.close(); h.s.destroy();
  });

  await step('--watch: ping says so, /api/watch streams hello, story, list and shell; --build builds a story', async () => {
    ok(!(await req('GET', '/api/ping')).json().watch && (await req('GET', '/api/watch')).status === 404, 'not watching: no watch in ping, /api/watch 404');
    const fingerprint = s => {   // (index.html's HOST.fingerprint)
      let a = 0xdeadbeef, b = 0x41c6ce57;
      for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
      a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
      b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
      return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
    };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-watch-')), put = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
    put('index.html', '<!doctype html><title>t</title>'); put('shared.js', '// s'); put('sw.js', '// w'); put('stories/a.js', '// a'); put('stories/list.js', 'self.STORY_LIST = [];');
    // a built story: tools/a/build.mjs writes stories/a.js from its source; tools/b's build fails
    put('tools/a/build.mjs', "import fs from 'fs'; import path from 'path'; const here = path.dirname(new URL(import.meta.url).pathname);\n" +
      "fs.writeFileSync(path.join(here, '../../stories/a.js'), '// built from ' + fs.readFileSync(path.join(here, 'sets/src.js'), 'utf8'));\n");
    put('tools/a/sets/src.js', 'one'); put('tools/b/build.mjs', "throw new Error('broken on purpose');\n"); put('tools/b/x.js', '1');
    const no = spawn(process.execPath, [path.join(HERE, 'server.mjs'), '--port', '0', '--watch'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let noOut = ''; no.stdout.on('data', d => { noOut += d; });
    ok(await new Promise(r => no.on('exit', c => r(c === 1))) && /--watch needs/.test(noOut), '--watch with nothing to watch: says so and stops');
    const W = await start(['--static', dir, '--watch', '--build', '--quiet']);
    ok((await req('GET', '/api/ping', { at: W.port })).json().watch === true, 'ping: watch true');
    ok((await req('POST', '/api/watch', { at: W.port })).status === 405, 'POST /api/watch: 405');
    const ev = [];
    let head = null;
    const sreq = http.get({ host: '127.0.0.1', port: W.port, path: '/api/watch' }, res => {
      head = res;
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', d => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const e = /^event: (\w+)$/m.exec(block), dl = /^data: (.*)$/m.exec(block);
          if (e && dl) ev.push({ type: e[1], data: JSON.parse(dl[1]) });
        }
      });
    });
    const next = async (type, pred = () => true, ms = 3000) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(20)) { const k = ev.findIndex(x => x.type === type && pred(x.data)); if (k >= 0) return ev.splice(k, 1)[0].data; } return null; };
    const h = await next('hello');
    ok(head && /^text\/event-stream/.test(head.headers['content-type']) && head.headers['cache-control'] === 'no-store', 'an event stream, never kept');
    ok(h && h.shell['index.html'] === fingerprint('<!doctype html><title>t</title>') && h.stories.a === fingerprint('// a') && !('list' in h.stories) && h.list === fingerprint('self.STORY_LIST = [];'),
      'hello: the fingerprints of the shell files, the stories and the list (index.html\'s fingerprint)');
    put('stories/a.js', '// a, changed');
    let e = await next('story');
    ok(e && e.key === 'a' && e.fp === fingerprint('// a, changed'), 'a story file changed: story { key, fp }');
    put('stories/a.js', '// a, changed'); await sleep(500);
    ok(!ev.some(x => x.type === 'story'), 'written again unchanged: nothing');
    put('stories/list.js', 'self.STORY_LIST = [{ key: "a" }];');
    ok(!!await next('list'), 'the list changed: list');
    put('index.html', '<!doctype html><title>t2</title>');
    e = await next('shell');
    ok(e && e.file === 'index.html' && e.fp === fingerprint('<!doctype html><title>t2</title>'), 'a shell file changed: shell { file, fp }');
    put('tools/a/sets/src.js', 'two');
    e = await next('build', d => d.key === 'a', 8000);
    ok(e && e.ok === true && e.ms >= 0, 'a built story\'s source changed: its build ran (build { key, ok, ms })');
    e = await next('story', d => d.key === 'a', 3000);
    ok(e && e.fp === fingerprint('// built from two'), '... and the story it wrote went out');
    put('tools/a/shots/x.js', 'not a source'); await sleep(800);
    ok(!ev.some(x => x.type === 'build'), 'a file in shots/: no build');
    put('tools/b/x.js', '2');
    e = await next('build', d => d.key === 'b', 8000);
    ok(e && e.ok === false && /broken on purpose/.test(e.out), 'a build that fails: build { ok: false, out }');
    sreq.destroy(); W.kill();
    fs.rmSync(dir, { recursive: true });
  });

  await step('--no-peer: no introduction server', async () => {
    const N = await start(['--no-peer', '--quiet']);
    ok((await req('GET', '/peerjs/peerjs/id', { at: N.port })).status === 404, 'no ids');
    const w = await raw(peerQuery('n1', 'tok'), { at: N.port });
    await sleep(200);
    ok(/^HTTP\/1.1 404/.test(w.head) && !/Introduction server/.test(N.out) && /Introduction server for peer to peer/.test(relay.out), 'no socket either (on by default)');
    N.kill();
  });

  await step('rooms on this network: /api/near by the asker\'s network, --proxy, no address in any answer or log', async () => {
    // the page's hash of a network (shared.js, netHash): the first 24 bits of SHA-256 of the salt and the network's name
    const h = name => crypto.createHash('sha256').update('networks-near-1|' + name).digest('hex').slice(0, 6);
    const HOME = '198.51.100.7', AWAY = '203.0.113.50', ADDRS = [HOME, AWAY, '192.168.1.23', '192.168.1.99', '192.168.2.5', '2001:db8:1:2::5', '10.9.8.7'];
    const P = await start(['--proxy', '--expire', '2']);
    const via = (xff, p, o = {}) => req(o.method || 'GET', p, Object.assign({ at: P.port, headers: xff ? { 'X-Forwarded-For': xff } : {} }, o));
    const near = async xff => (await via(xff, '/api/near')).json();
    const sock = (room, id, xff) => {
      const c = { q: [], ws: new WebSocket(`ws://127.0.0.1:${P.port}/api/ws?room=${room}&id=${id}`, { headers: { 'X-Forwarded-For': xff } }) };
      c.ws.onmessage = e => c.q.push(JSON.parse(e.data));
      c.done = new Promise(r => { c.ws.onclose = r; });
      c.next = async (pred, ms = 2000) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(10)) { const i = c.q.findIndex(pred); if (i >= 0) return c.q.splice(i, 1)[0]; } return null; };
      c.send = m => c.ws.send(JSON.stringify(m));
      return c;
    };
    const ping = (await via(HOME, '/api/ping')).json();
    ok(ping.net === h(HOME), 'ping says the network: the page\'s hash of the address the proxy put last in X-Forwarded-For');
    ok((await via('10.0.0.1, ' + HOME, '/api/ping')).json().net === h(HOME), 'only the last address counts (the ones before it came from the client)');
    ok((await via('192.168.1.23', '/api/ping')).json().net === (await via('192.168.1.99', '/api/ping')).json().net &&
      (await via('192.168.1.23', '/api/ping')).json().net === h('192.168.1.0/24') && (await via('192.168.2.5', '/api/ping')).json().net !== h('192.168.1.0/24'), 'a private address stands for its /24');
    ok((await via('2001:db8:1:2::5', '/api/ping')).json().net === (await via('2001:db8:1:2:aaaa::9', '/api/ping')).json().net, 'an IPv6 address for its /64');
    const code = (await via(HOME, '/api/rooms', { method: 'POST', body: { app: 'networks', version: 'v1' } })).json().code;
    const a = sock(code, 'na1', HOME);
    await a.next(is('welcome'));
    a.send({ t: 'hello', name: 'Ann', version: 'v1' });
    await a.next(is('members', m => m.members.some(x => x.name === 'Ann')));
    a.send({ t: 'set', batch: [['st.s1', { story: 'flock', x: 0, z: 0, yaw: 0 }]], cid: 1 });
    await a.next(is('set'));
    const nh = await near(HOME), na = await near(AWAY);
    ok(nh.net === h(HOME) && na.net === h(AWAY), 'near says the asker\'s network');
    const row = nh.rooms.find(r => r.code === code);
    ok(row && row.name === 'Ann' && row.members === 1 && row.stations === 1 && row.version === 'v1' && Object.keys(row).sort().join() === 'code,members,name,stations,version',
      'a room with someone on the asker\'s network is listed: code, the first member\'s name, people, stations');
    ok(!na.rooms.some(r => r.code === code), 'not on another network');
    // Show on this network: off (key near), and on again
    a.send({ t: 'set', batch: [['near', { on: false, by: 'na1', at: 1 }]], cid: 2 });
    await a.next(is('set'));
    ok(!(await near(HOME)).rooms.some(r => r.code === code), 'a room that says Show on this network: off is not listed');
    a.send({ t: 'set', batch: [['near', { on: true, by: 'na1', at: 2 }]], cid: 3 });
    await a.next(is('set'));
    ok((await near(HOME)).rooms.some(r => r.code === code), 'listed again once on');
    // someone from another network joins: listed on both; when everyone has left, the room stays listed on their networks
    const b = sock(code, 'nb1', AWAY);
    await b.next(is('welcome'));
    ok((await near(AWAY)).rooms.some(r => r.code === code && r.members === 2), 'someone from another network joins: listed there too');
    a.ws.close(); b.ws.close(); await a.done; await b.done; await sleep(100);
    const empty = (await near(HOME)).rooms.find(r => r.code === code);
    ok(empty && empty.members === 0 && empty.name === '' && !(await near('192.0.2.1')).rooms.some(r => r.code === code), 'an empty room stays listed on its members\' networks (only)');
    // without --proxy the header is ignored: every client of the test relay is this machine
    const R2 = await newRoom(), c = await joined(R2, 'nc1', { name: 'Cy', version: 'v1' });
    const plain = (await req('GET', '/api/near', { headers: { 'X-Forwarded-For': AWAY } })).json();
    ok(plain.net === h('loopback') && plain.rooms.some(r => r.code === R2), 'without --proxy, X-Forwarded-For is ignored (the socket\'s own address counts)');
    c.ws.close();
    // a slot of rooms on this network (shared.js, slotId) carries the network's hash: the log hides it
    const sl = peer('lbinet-near-networks-25-' + h(HOME) + '-0', 'tok');
    await sl.next(ty('OPEN')); sl.ws.close();
    await sleep(200);
    // no address in any answer, and none in the log (besides where the relay itself listens); no network's id in the log
    const answers = [JSON.stringify(nh), JSON.stringify(na), JSON.stringify(ping), (await via(HOME, '/api/rooms')).text, (await via(HOME, '/api/rooms/' + code)).text, JSON.stringify(plain)].join('\n');
    ok(!ADDRS.some(x => answers.includes(x)) && !/127\.0\.0\.1/.test(answers), 'no address in any answer');
    const logs = (P.out + relay.out).split('\n').filter(l => !/listening on|On this machine|Desktops on the same network|On every headset/.test(l)).join('\n');
    ok(!ADDRS.some(x => logs.includes(x)) && !/127\.0\.0\.1|::ffff|\bfrom \d/.test(logs), 'no address in the log');
    ok(!logs.includes(h(HOME)) && !logs.includes(h(AWAY)) && /peer join lbinet-near-networks-25-\*{6}-0/.test(relay.out), 'no network\'s id in the log (a slot\'s id shows without it)');
    ok(/Behind a reverse proxy/.test(P.out) && !/Behind a reverse proxy/.test(relay.out), '--proxy says so as the relay starts');
    P.kill();
  });

  await step('--proxy <n>: behind n proxies, the n-th address from the right of X-Forwarded-For (--proxy alone: 1)', async () => {
    const h = name => crypto.createHash('sha256').update('networks-near-1|' + name).digest('hex').slice(0, 6);
    const HOME = '198.51.100.7', CDN = '172.70.1.9', MADE = '203.0.113.50';   // (a device, a CDN's server, an address a client made up)
    const P2 = await start(['--proxy', '2']), P1 = await start(['--proxy', '1', '--quiet']);
    const net = async (P, xff) => (await req('GET', '/api/ping', { at: P.port, headers: xff ? { 'X-Forwarded-For': xff } : {} })).json().net;
    ok(await net(P2, HOME + ', ' + CDN) === h(HOME), '--proxy 2: the second from the right, the address the CDN added (the last is the CDN\'s own)');
    ok(await net(P2, MADE + ', ' + HOME + ', ' + CDN) === h(HOME), '--proxy 2: anything further left came from the client and is ignored');
    ok(await net(P2, HOME) === h(HOME), '--proxy 2: with fewer addresses than proxies, the first');
    ok(await net(P2, '') === h('loopback'), '--proxy 2: no header, the socket\'s own address');
    ok(await net(P1, HOME + ', ' + CDN) === h(CDN) && await net(P1, MADE + ', ' + HOME) === h(HOME), '--proxy 1: the last, as --proxy alone (the step before)');
    ok(/Behind 2 reverse proxies: a client's address is the second from the right in X-Forwarded-For/.test(P2.out), 'the start line says how many');
    P2.kill(); P1.kill();
  });

  // ---- a public server (--public, and each rule on its own); none of it is on unless asked
  const APP = 'https://stories.lbi-netmed.com', EVIL = 'https://evil.example';
  const unknownCodes = n => { const out = []; for (let i = 0; out.length < n; i++) { const c = 'Q' + String.fromCharCode(65 + Math.floor(i / 26) % 26) + String.fromCharCode(65 + i % 26); out.push(c); } return out; };
  const exits = args => new Promise(r => {   // a relay that refuses to start: its exit code and what it said
    const p = spawn(process.execPath, [path.join(HERE, 'server.mjs'), '--port', '0', '--host', '127.0.0.1', ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RELAY_LOG_TOKEN: '', RELAY_ARGS: '' } });
    let out = ''; p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    const t = setTimeout(() => p.kill(), 3000);
    p.on('exit', c => { clearTimeout(t); r({ code: c, out }); });
  });
  // a socket as a browser opens one (its Origin) through a proxy (X-Forwarded-For); first: welcome, an error or a close
  const wsAt = (P, q, headers) => socket(`ws://127.0.0.1:${P.port}${q}`, headers);
  const first = async c => {   // (a message comes before its socket's close: the queue is looked at first)
    for (const end = Date.now() + 3000; Date.now() < end; await sleep(10)) {
      const i = c.q.findIndex(m => m.t === 'welcome' || m.t === 'error' || !!m.type);
      if (i >= 0) return c.q.splice(i, 1)[0];
      if (c.closed || c.failed) return { closed: c.closed, failed: c.failed };
    }
    return {};
  };

  await step('without --public: every origin, sockets with no Origin, no limits per address, the room list with names (as before)', async () => {
    const p = await req('GET', '/api/ping', { headers: { Origin: EVIL } });
    ok(p.status === 200 && p.headers['access-control-allow-origin'] === '*' && !('unlisted' in p.json()) && !/Origin/.test(p.headers.vary || ''), 'any origin: CORS *, no Vary, no unlisted');
    const c = socket(`ws://127.0.0.1:${port}/api/ws?room=${R}&id=ev1`, { Origin: EVIL });
    ok((await c.next(is('welcome')))?.room === R, 'a socket from any origin is welcome');
    c.ws.close();
    const r = await raw(`/api/ws?room=${R}&id=no1`);
    await sleep(200);
    ok(/^HTTP\/1.1 101/.test(r.head) && r.msgs.some(is('welcome')), 'a socket with no Origin too');
    r.s.destroy();
    const codes = unknownCodes(100).filter(x => x !== R);
    const st = await Promise.all(codes.map(x => req('GET', '/api/rooms/' + x)));
    ok(st.every(x => x.status === 404), `${codes.length} lookups of unknown codes in a row: all 404, none refused`);
    const taken = await Promise.all(Array.from({ length: 25 }, () => req('POST', '/api/rooms', { body: { code: R } })));
    ok(taken.every(x => x.status === 409), '25 chosen codes that are taken: 409 each');
    const joins = [];
    for (const x of codes.slice(0, 30)) joins.push(client(x, 'gu1'));
    const errs = await Promise.all(joins.map(j => j.next(is('error'))));
    ok(errs.every(e => e?.code === 'room'), '30 sockets for unknown rooms: each told no such room');
    const list = (await req('GET', '/api/rooms')).json();
    ok(list.find(x => x.code === R)?.names.includes('Ann'), 'the open rooms listed with their people\'s names');
    ok(/hello a1 "Ann" ar here v1/.test(relay.out), 'the log names who said hello');
  });

  let PUBR;
  await step('--public: only the app\'s pages and the relay\'s own may connect (sockets, the API, CORS, the introduction server)', async () => {
    const P = PUBR = await start(['--public', '--proxy', '--static', REPO, '--ping', '0.2']);
    const get = (p, headers = {}, o = {}) => req(o.method || 'GET', p, { at: P.port, headers, ...o });
    let r = await get('/api/ping');
    ok(r.status === 200 && r.json().proto === 1 && r.json().unlisted === true && !r.headers['access-control-allow-origin'] && /Origin/.test(r.headers.vary || ''),
      'ping with no Origin (the health check, the relay\'s own page): answered, unlisted: true, Vary: Origin, no CORS needed');
    r = await get('/api/ping', { Origin: APP });
    ok(r.status === 200 && r.headers['access-control-allow-origin'] === APP && /Origin/.test(r.headers.vary), `the app's origin (${APP}): CORS for it alone (echoed)`);
    for (const o of [EVIL, 'null', 'https://stories.lbi-netmed.com.evil.example', 'http://stories.lbi-netmed.com']) {
      r = await get('/api/ping', { Origin: o });
      ok(r.status === 403 && !r.headers['access-control-allow-origin'], `another origin is refused: ${o} (403, no CORS)`);
    }
    r = await get('/api/ping', { Origin: `http://127.0.0.1:${P.port}` });
    ok(r.status === 200 && r.headers['access-control-allow-origin'] === `http://127.0.0.1:${P.port}`, 'the relay\'s own origin (its Host)');
    ok((await get('/api/ping', { Origin: 'https://rooms.example.org', Host: 'rooms.example.org' })).status === 200 &&
      (await get('/api/ping', { Origin: 'https://rooms.example.org', 'X-Forwarded-Host': 'rooms.example.org' })).status === 200 &&
      (await get('/api/ping', { Origin: 'https://rooms.example.org' })).status === 403, 'the relay\'s own name behind its proxy (Host, or X-Forwarded-Host with --proxy); not another\'s');
    r = await get('/api/rooms', { Origin: APP, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }, { method: 'OPTIONS' });
    ok(r.status === 204 && r.headers['access-control-allow-origin'] === APP && /X-Log-Token/.test(r.headers['access-control-allow-headers']), 'a preflight from the app: 204 for it');
    ok((await get('/api/rooms', { Origin: EVIL, 'Access-Control-Request-Method': 'POST' }, { method: 'OPTIONS' })).status === 403, 'a preflight from elsewhere: 403');
    ok((await get('/api/rooms', { Origin: EVIL }, { method: 'POST', body: { app: 'networks', version: 'v1' } })).status === 403, 'a room from another origin\'s page: 403');
    ok((await get('/api/rooms', { Origin: APP }, { method: 'POST', body: { app: 'networks', version: 'v1' } })).status === 201, 'from the app\'s: made');
    const f = await fetch(`http://127.0.0.1:${P.port}/api/ping`);
    ok(f.ok && (await f.json()).proto === 1, 'Node\'s fetch (no Origin) gets ping');
    const hc = /CMD (node -e .*)$/m.exec(fs.readFileSync(path.join(HERE, 'Dockerfile'), 'utf8'));
    let hcOk = false;
    try { execFileSync('sh', ['-c', hc[1].replace(/^node /, JSON.stringify(process.execPath) + ' ').replace('8787', String(P.port))], { stdio: 'ignore', timeout: 5000 }); hcOk = true; } catch { /* failed */ }
    ok(hc && hcOk, 'the Dockerfile\'s health check passes on a public relay');
    r = await get('/', { Origin: EVIL });
    ok(r.status === 200 && r.buf.equals(fs.readFileSync(path.join(REPO, 'index.html'))) && (await get('/stories/flock.js')).status === 200, 'the relay\'s own pages are served to anyone');
    // sockets
    const code = (await get('/api/rooms', { Origin: APP }, { method: 'POST', body: { app: 'networks', version: 'v1' } })).json().code;
    const a = wsAt(P, `/api/ws?room=${code}&id=o1`, { Origin: APP });
    ok((await first(a)).t === 'welcome', 'a socket from the app\'s page: welcome');
    const own = wsAt(P, `/api/ws?room=${code}&id=o2`, { Origin: `http://127.0.0.1:${P.port}` });
    ok((await first(own)).t === 'welcome', 'from the relay\'s own page: welcome');
    const e = wsAt(P, `/api/ws?room=${code}&id=o3`, { Origin: EVIL });
    const ef = await first(e);
    ok(!ef.t && (ef.failed || ef.closed?.code === 1006), 'from another origin: no socket');
    let w = await raw(`/api/ws?room=${code}&id=o4`, { at: P.port, headers: { Origin: EVIL } });
    await sleep(200);
    ok(/^HTTP\/1.1 403/.test(w.head), '... refused before the upgrade (403)');
    w = await raw(`/api/ws?room=${code}&id=o5`, { at: P.port });
    await sleep(200);
    ok(/^HTTP\/1.1 403/.test(w.head), 'a socket with no Origin (not a browser): 403');
    w = await raw(`/api/ws?room=${code}&id=o6`, { at: P.port, host: 'rooms.example.org', headers: { Origin: 'https://rooms.example.org' } });
    await sleep(200);
    ok(/^HTTP\/1.1 101/.test(w.head) && w.msgs.some(is('welcome')), 'from the relay\'s own name (Host): welcome');
    w.s.destroy();
    // the introduction server
    r = await get('/peerjs/peerjs/id', { Origin: APP });
    ok(r.status === 200 && /^[0-9a-f-]{36}$/.test(r.text) && r.headers['access-control-allow-origin'] === APP, 'an id for the app\'s page (CORS for it)');
    ok((await get('/peerjs/peerjs/id', { Origin: EVIL })).status === 403 && (await get('/peerjs/peerjs/id')).status === 200, 'not for another origin; with no Origin (the same origin) yes');
    const pa = wsAt(P, peerQuery('pubpeer1', 'tok1'), { Origin: APP });
    ok((await first(pa)).type === 'OPEN', 'a peer from the app\'s page: OPEN');
    w = await raw(peerQuery('pubpeer2', 'tok2'), { at: P.port, headers: { Origin: EVIL } });
    const w2 = await raw(peerQuery('pubpeer3', 'tok3'), { at: P.port });
    await sleep(200);
    ok(/^HTTP\/1.1 403/.test(w.head) && /^HTTP\/1.1 403/.test(w2.head), 'a peer from another origin, or with no Origin: 403');
    for (const c of [a, own, pa]) c.ws.close();
    await sleep(400);
    ok(/sockets refused: origin not allowed \(\d+\)/.test(P.out) && /requests refused: origin not allowed \(\d+\)/.test(P.out), 'refusals counted in the log, a line a tick');
    ok(new RegExp(`Only pages from ${APP} and the relay's own`).test(P.out) && /No list of open rooms/.test(P.out) &&
      /Per address at most 30 lookups of unknown room codes a minute \(a burst of 60\), 10 new rooms a minute \(a burst of 20\), 64 open sockets/.test(P.out) &&
      /All rooms together hold at most 64 MB/.test(P.out) && !/No --proxy/.test(P.out), 'the start lines say what --public allows');
    const H = await start(['--public', '--static', REPO, '--host', '0.0.0.0', '--quiet']);
    for (const end = Date.now() + 2000; !/All rooms together/.test(H.out) && Date.now() < end;) await sleep(20);
    ok(/All rooms together/.test(H.out) && !/Desktops on the same network|For headsets|On this machine/.test(H.out) && /No --proxy: behind a reverse proxy/.test(H.out),
      'on every address: no addresses to open on a LAN (a container\'s are no one\'s), and a word that --proxy is missing');
    H.kill();
    const E = await start(['--quiet'], { RELAY_ARGS: ' --public  --proxy 1 --guesses 7 ' });
    for (const end = Date.now() + 2000; !/All rooms together/.test(E.out) && Date.now() < end;) await sleep(20);
    ok(/Per address at most 7 lookups/.test(E.out) && /Behind a reverse proxy/.test(E.out) && (await req('GET', '/api/ping', { at: E.port })).json().unlisted === true,
      'RELAY_ARGS (the environment, as Coolify sets it) adds options after the command\'s own');
    E.kill();
    // --allow-no-origin, and --origin on its own
    const N = await start(['--public', '--allow-no-origin', '--quiet']);
    w = await raw('/api/ws?room=ABC&id=n1', { at: N.port });
    const we = await raw('/api/ws?room=ABC&id=n2', { at: N.port, headers: { Origin: EVIL } });
    await sleep(200);
    ok(/^HTTP\/1.1 101/.test(w.head) && w.msgs.some(is('error', m => m.code === 'room')) && /^HTTP\/1.1 403/.test(we.head), '--allow-no-origin: a socket with no Origin gets in; another origin still not');
    N.kill();
    const O = await start(['--origin', 'https://a.example,https://B.example/', '--origin', 'https://c.example:8443']);
    const oget = (p, o) => req('GET', p, { at: O.port, headers: o ? { Origin: o } : {} });
    const echoed = [];
    for (const o of ['https://a.example', 'https://b.example', 'https://c.example:8443']) echoed.push((await oget('/api/ping', o)).headers['access-control-allow-origin'] === o);
    ok(echoed.every(Boolean), '--origin (a list, repeated, any case, a slash at the end): each origin allowed');
    ok((await oget('/api/ping', APP)).status === 403 && (await oget('/api/ping', 'https://c.example')).status === 403, 'others refused (the app\'s too: not listed, not --public)');
    const ocode = (await req('POST', '/api/rooms', { at: O.port, body: { app: 'networks', version: 'v1' } })).json().code;
    const oc = wsAt(O, `/api/ws?room=${ocode}&id=ol1`, { Origin: 'https://a.example' });
    await first(oc);
    oc.send({ t: 'hello', name: 'Ola', version: 'v1' });
    await oc.next(is('members', m => m.members.some(x => x.name === 'Ola')));
    const ol = (await oget('/api/rooms')).json();
    ok(!(await oget('/api/ping')).json().unlisted && ol.find(x => x.code === ocode)?.names.includes('Ola'), '--origin alone: the room list and names as before');
    ok((await Promise.all(unknownCodes(70).map(x => oget('/api/rooms/' + x)))).every(x => x.status === 404), '--origin alone: no limit on lookups');
    ok(!/Per address|No list of open rooms/.test(O.out) && /Only pages from https:\/\/a\.example, https:\/\/b\.example, https:\/\/c\.example:8443/.test(O.out), 'its start line');
    oc.ws.close(); O.kill();
    for (const bad of ['notaurl', 'https://x.example/path', 'ftp://x.example', 'https://x.example/?q=1']) {
      const x = await exits(['--origin', bad]);
      ok(x.code === 1 && /--origin takes origins/.test(x.out), `--origin ${bad}: refused at the start`);
    }
  });

  await step('--public: no open-room list and no member\'s name in any answer or log line', async () => {
    const P = PUBR, HOME = '198.51.100.7';
    const get = (p, headers = {}) => req('GET', p, { at: P.port, headers: { Origin: APP, ...headers } });
    const code = (await req('POST', '/api/rooms', { at: P.port, headers: { Origin: APP, 'X-Forwarded-For': HOME }, body: { app: 'networks', version: 'v1' } })).json().code;
    const a = wsAt(P, `/api/ws?room=${code}&id=nm1`, { Origin: APP, 'X-Forwarded-For': HOME });
    await first(a);
    a.send({ t: 'hello', name: 'Annelie', color: '#ff8800', kind: 'ar', version: 'v1' });
    await a.next(is('members', m => m.members.some(x => x.name === 'Annelie')));
    a.send({ t: 'set', batch: [['st.s1', { story: 'flock', x: 0, z: 0, yaw: 0 }]], cid: 1 });
    await a.next(is('set'));
    const b = wsAt(P, `/api/ws?room=${code}&id=nm2`, { Origin: APP });
    const bw = await first(b);
    ok(bw.t === 'welcome' && bw.members.some(x => x.name === 'Annelie'), 'the room\'s own members still see each other\'s names (its people list)');
    const list = await get('/api/rooms');
    ok(list.status === 200 && Array.isArray(list.json()) && list.json().length === 0, 'GET /api/rooms: an empty list (the page shows none, without an error)');
    const one = await get('/api/rooms/' + code);
    const j = one.json();
    ok(one.status === 200 && j.members === 2 && j.version === 'v1' && j.keys['st.s1']?.v.story === 'flock' && !/Annelie|#ff8800/.test(one.text),
      'GET /api/rooms/<code>: the version and keys a page needs, people as a count, no names');
    const near = await get('/api/near', { 'X-Forwarded-For': HOME });
    const row = near.json().rooms.find(x => x.code === code);
    ok(row && Object.keys(row).sort().join() === 'code,members,stations,version' && row.members === 2 && row.stations === 1 && !/Annelie/.test(near.text),
      '/api/near: code, people, stations and version, no name');
    a.ws.close(); b.ws.close();
    await sleep(300);
    ok(!/Annelie/.test(P.out) && /hello nm1 ar v1/.test(P.out), 'the log names nobody (hello: the member\'s id)');
  });

  await step('--public: lookups of unknown codes capped per address (with --proxy, IPv6 by its /64), a known code then refused too', async () => {
    const G = await start(['--public', '--proxy', '--guesses', '5', '--creates', '50', '--ping', '0.2']);
    const get = (p, xff, o = {}) => req(o.method || 'GET', p, { at: G.port, headers: { Origin: APP, 'X-Forwarded-For': xff }, ...o });
    const K = (await get('/api/rooms', '192.0.2.1', { method: 'POST', body: { app: 'networks', version: 'v1' } })).json().code;
    const codes = unknownCodes(40).filter(x => x !== K);
    let s = [];
    for (const x of codes.slice(0, 10)) s.push((await get('/api/rooms/' + x, '198.51.100.1')).status);
    ok(s.every(x => x === 404), '10 unknown codes (a burst of twice --guesses 5): 404 each');
    let r = await get('/api/rooms/' + codes[10], '198.51.100.1');
    ok(r.status === 429 && +r.headers['retry-after'] >= 1 && +r.headers['retry-after'] <= 12 && /wait a minute/.test(r.json().error), 'the 11th: 429, Retry-After');
    ok((await get('/api/rooms/' + K, '198.51.100.1')).status === 429, 'then a known code too (or the answers would say which exist)');
    ok((await get('/api/rooms', '198.51.100.1', { method: 'POST', body: { code: K } })).status === 429 &&
      (await get('/api/rooms', '198.51.100.1', { method: 'POST', body: { code: codes[12] } })).status === 429, 'and a chosen code to make a room: 429 (taken or free)');
    let c = wsAt(G, `/api/ws?room=${K}&id=gx1`, { Origin: APP, 'X-Forwarded-For': '198.51.100.1' });
    let m = await first(c);
    ok(m.t === 'error' && m.code === 'limit' && (await c.closedIn(2000))?.code === 4429, 'and a socket for the known room: error limit, closed 4429');
    ok((await get('/api/rooms/' + K, '198.51.100.2')).status === 200 && (await get('/api/rooms/' + codes[11], '198.51.100.2')).status === 404, 'another address is not held up');
    ok((await get('/api/rooms/' + K, '198.51.100.1, 198.51.100.2')).status === 200, '--proxy: the address the proxy put last counts (a made-up one before it does not)');
    // sockets for unknown rooms are lookups too
    s = [];
    for (const x of codes.slice(0, 10)) { const u = wsAt(G, `/api/ws?room=${x}&id=gy1`, { Origin: APP, 'X-Forwarded-For': '198.51.100.3' }); s.push((await first(u)).code); }
    ok(s.every(x => x === 'room'), '10 sockets for unknown rooms: no room each');
    c = wsAt(G, `/api/ws?room=${codes[10]}&id=gy1`, { Origin: APP, 'X-Forwarded-For': '198.51.100.3' });
    ok((await first(c)).code === 'limit', 'the 11th: limit');
    // a chosen code that is taken (409) counts too
    s = [];
    for (let i = 0; i < 5; i++) s.push((await get('/api/rooms', '198.51.100.4', { method: 'POST', body: { code: K } })).status);
    for (const x of codes.slice(0, 5)) s.push((await get('/api/rooms/' + x, '198.51.100.4')).status);
    ok(s.join() === '409,409,409,409,409,404,404,404,404,404' && (await get('/api/rooms/' + codes[5], '198.51.100.4')).status === 429, 'taken (409) and unknown (404) from one budget');
    // a member coming back is let in past the limit; a new id is not
    const mem = wsAt(G, `/api/ws?room=${K}&id=mem1`, { Origin: APP, 'X-Forwarded-For': '198.51.100.5' });
    ok((await first(mem)).t === 'welcome', 'a member joins');
    for (const x of codes.slice(0, 10)) await get('/api/rooms/' + x, '198.51.100.5');
    const back = wsAt(G, `/api/ws?room=${K}&id=mem1`, { Origin: APP, 'X-Forwarded-For': '198.51.100.5' });
    const fresh = wsAt(G, `/api/ws?room=${K}&id=mem2`, { Origin: APP, 'X-Forwarded-For': '198.51.100.5' });
    ok((await first(back)).t === 'welcome' && (await first(fresh)).code === 'limit', 'past the limit: the member again (its id in the room) welcome; a new id not');
    // IPv6: one budget per /64
    for (const x of codes.slice(0, 10)) await get('/api/rooms/' + x, '2001:db8:1:2::5');
    ok((await get('/api/rooms/' + codes[10], '2001:db8:1:2::9')).status === 429 && (await get('/api/rooms/' + codes[10], '2001:db8:1:3::5')).status === 404,
      'IPv6: an address in the same /64 shares the budget, one in another /64 does not');
    back.ws.close(); mem.ws.close();
    await sleep(400);
    ok(/requests refused: too many unknown room codes from one address \(\d+\)/.test(G.out) && /sockets refused: too many unknown room codes from one address \(\d+\)/.test(G.out),
      'the refusals counted in the log');
    ok(!/198\.51\.100|2001:db8/.test(G.out), 'no address in the log');
    G.kill();
    // without --proxy the header is ignored: every client of this test is one address (this machine)
    const N = await start(['--public', '--guesses', '2', '--quiet']);
    const nget = (x, xff) => req('GET', '/api/rooms/' + x, { at: N.port, headers: { 'X-Forwarded-For': xff } });
    s = [];
    for (const x of codes.slice(0, 4)) s.push((await nget(x, '198.51.100.' + (10 + s.length))).status);
    ok(s.every(x => x === 404) && (await nget(codes[4], '198.51.100.99')).status === 429, 'without --proxy, X-Forwarded-For is ignored: one budget for the socket\'s address');
    N.kill();
  });

  await step('--public: open sockets and new rooms capped per address', async () => {
    const S = await start(['--public', '--proxy', '--sockets', '4', '--creates', '3', '--quiet']);
    const post = (xff, body = { app: 'networks', version: 'v1' }) => req('POST', '/api/rooms', { at: S.port, headers: { Origin: APP, 'X-Forwarded-For': xff }, body });
    const made = [];
    for (let i = 0; i < 6; i++) made.push((await post('198.51.100.21')).status);
    const over = await post('198.51.100.21');
    ok(made.every(x => x === 201) && over.status === 429 && +over.headers['retry-after'] >= 1 && /new rooms/.test(over.json().error), '--creates 3: 6 new rooms (a burst of twice that), then 429');
    ok((await post('198.51.100.21', { code: 'ZQZ' })).status === 429, 'a chosen code too');
    const K = (await post('198.51.100.22')).json().code;
    ok(/^[A-Z]{3}$/.test(K || ''), 'another address makes one');
    const sock = (id, xff) => wsAt(S, `/api/ws?room=${K}&id=${id}`, { Origin: APP, 'X-Forwarded-For': xff });
    const mine = [];
    for (let i = 0; i < 4; i++) { mine.push(sock('sk' + i, '198.51.100.23')); }
    const firsts = await Promise.all(mine.map(first));
    ok(firsts.every(x => x.t === 'welcome'), '--sockets 4: four sockets from one address');
    const fifth = sock('sk4', '198.51.100.23');
    const f5 = await first(fifth);
    ok(f5.t === 'error' && f5.code === 'busy' && (await fifth.closedIn(2000))?.code === 4429, 'the fifth: error busy, closed 4429');
    const p5 = wsAt(S, peerQuery('skpeer', 'tok'), { Origin: APP, 'X-Forwarded-For': '198.51.100.23' });
    const pf = await first(p5);
    ok(pf.type === 'ERROR' && /too many connections/.test(pf.payload?.msg) && (await p5.closedIn(2000))?.code === 4429, 'an introduction server socket counts too (ERROR, 4429)');
    ok((await first(sock('sk5', '198.51.100.24'))).t === 'welcome', 'another address is not held up');
    mine[0].ws.close(); await mine[0].done; await sleep(200);
    ok((await first(sock('sk6', '198.51.100.23'))).t === 'welcome', 'one closed: room for another');
    S.kill();
  });

  await step('--public: logs only with the relay\'s token (X-Log-Token), never written in the log', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-publog-'));
    let x = await exits(['--public', '--logs', dir]);
    ok(x.code === 1 && /--public with --logs needs a token/.test(x.out), '--public --logs without a token: refused at the start');
    x = await exits(['--public', '--logs', dir, '--log-token', 'short']);
    ok(x.code === 1 && /at least 16 characters/.test(x.out), 'a token under 16 characters: refused');
    const TOKEN = crypto.randomBytes(12).toString('hex');   // (made here: no token is ever kept in the repository)
    const L = await start(['--public', '--logs', dir], { RELAY_LOG_TOKEN: TOKEN });
    const send = (headers, body = { room: 'ABC', id: 'lg' + crypto.randomBytes(3).toString('hex'), name: 'Ada', kind: 'ar', entries: [{ t: 1 }] }) => req('POST', '/api/log', { at: L.port, headers, body });
    let r = await send({});
    ok(r.status === 404 && /without the relay's log token/.test(r.json().error), 'no token (as a page sends it): 404, so the page stops sending');
    ok((await send({ 'X-Log-Token': 'x'.repeat(24) })).status === 403 && (await send({ 'X-Log-Token': TOKEN + 'x' })).status === 403, 'a wrong token: 403');
    r = await send({ 'X-Log-Token': TOKEN, Origin: APP });
    ok(r.status === 200 && r.json().lines === 1 && r.headers['access-control-allow-origin'] === APP && fs.readdirSync(dir).length === 1, 'the token from the environment (RELAY_LOG_TOKEN): kept');
    ok((await send({ 'X-Log-Token': TOKEN, Origin: EVIL })).status === 403, 'from another origin, even with the token: 403');
    ok(!L.out.includes(TOKEN) && /Logs need the relay's log token/.test(L.out), 'the start line says a token is needed, never the token');
    ok(/log started \(ABC, lg[0-9a-f]{4}\)/.test(L.out) && !/Ada/.test(L.out), 'a log file started: said without the name');
    L.kill();
    const T2 = crypto.randomBytes(12).toString('hex');
    const L2 = await start(['--public', '--logs', dir, '--log-token', T2, '--quiet']);
    ok((await req('POST', '/api/log', { at: L2.port, headers: { 'X-Log-Token': T2 }, body: { room: 'ABD', id: 'lg2', entries: [{ t: 1 }] } })).status === 200, '--log-token on the command line works too');
    L2.kill();
    ok((await req('POST', '/api/log', { at: PUBR.port, headers: { 'X-Log-Token': TOKEN }, body: { room: 'ABC', id: 'lg3', entries: [] } })).status === 404, '--public without --logs: logs are off');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ---- a shared password (COLLAB_TOKEN or --token; asdf10k-collab-backend's scheme): off unless given
  await step('a password: off by default (nothing changes), /api/health open on every relay', async () => {
    const h = await req('GET', '/api/health');
    ok(h.status === 200 && Object.keys(h.json()).sort().join() === 'ok,protocol,rooms' && h.json().ok === true && h.json().protocol === 1 && Number.isInteger(h.json().rooms),
      'GET /api/health: { ok, protocol, rooms } and nothing more');
    ok((await req('GET', '/api/ping')).status === 200 && (await req('GET', '/peerjs/peerjs/id')).status === 200 && !/password/i.test(relay.out),
      'without a password: ping and the introduction server open, the start lines say nothing of one');
    const c = client(R, 'nopass');
    ok((await c.next(is('welcome')))?.you === 'nopass', 'a socket without ?token= is welcome');
    c.ws.close();
  });

  await step('a password (COLLAB_TOKEN): everything but /api/health and the app\'s files needs it; 401, 4401; 20 failures, then 429, 4429', async () => {
    const PASS = 'networks' + crypto.randomBytes(5).toString('hex');   // (made here: no password is ever kept in the repository)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-pass-'));
    const T = await start(['--static', REPO, '--watch', '--logs', dir, '--proxy', '--ping', '0.2'], { COLLAB_TOKEN: PASS });
    let ipN = 0;
    const ip = () => '203.0.113.' + (++ipN);   // (a fresh address for each part: failures are counted per address)
    const get = (p, o = {}) => req(o.method || 'GET', p, { at: T.port, headers: { 'X-Forwarded-For': o.ip || ip(), ...(o.headers || {}) }, body: o.body });
    const bearer = (t = PASS) => ({ Authorization: 'Bearer ' + t });
    const no = r => r.status === 401 && r.text === '{"error":"missing or wrong token"}';
    await sleep(300);   // (the start lines after the first)
    ok(/A password is needed/.test(T.out) && !T.out.includes(PASS), 'the start line says a password is needed, never the password');
    const h = await get('/api/health');
    ok(h.status === 200 && Object.keys(h.json()).sort().join() === 'ok,protocol,rooms', '/api/health open, saying nothing more');
    const code = (await get('/api/rooms', { method: 'POST', headers: bearer(), body: { app: 'networks', version: 'v1' } })).json().code;
    ok(/^[A-Z]{3}$/.test(code || ''), 'POST /api/rooms with Authorization: Bearer: a room');
    const asks = [['GET', '/api/ping'], ['GET', '/api/near'], ['GET', '/api/rooms'], ['GET', '/api/rooms/' + code], ['POST', '/api/rooms', { app: 'networks' }],
      ['POST', '/api/log', { room: code, id: 'pw1', entries: [{ t: 1 }] }], ['GET', '/api/watch'], ['GET', '/api/nothing'], ['GET', '/peerjs'], ['GET', '/peerjs/peerjs/id']];
    let s = [];
    for (const [m, p, b] of asks) s.push(no(await get(p, { method: m, body: b })));
    ok(s.every(Boolean), 'without it: 401 {"error":"missing or wrong token"} for ping, near, rooms, a room, a new room, log, watch, an unknown path, /peerjs and its ids');
    s = [];
    for (const [m, p, b] of asks.slice(0, 6)) s.push(no(await get(p, { method: m, body: b, headers: bearer(PASS + 'x') })) && no(await get(p + '?token=' + PASS.slice(1), { method: m, body: b })));
    ok(s.every(Boolean), 'a wrong one (Bearer or ?token=, one letter more or less): 401');
    ok(no(await get('/api/ping', { headers: { Authorization: 'Basic ' + PASS } })) && no(await get('/api/ping', { headers: bearer(PASS.toUpperCase()) })), 'not as Basic, and case counts');
    const p1 = await get('/api/ping', { headers: bearer() }), p2 = await get('/api/ping?token=' + PASS);
    ok(p1.status === 200 && p1.json().proto === 1 && p2.status === 200, 'Authorization: Bearer and ?token= both work');
    ok((await get('/api/rooms/' + code, { headers: bearer() })).json().code === code && (await get('/api/near?token=' + PASS)).status === 200, 'a room and near with it');
    const pre = await get('/api/ping', { method: 'OPTIONS', headers: { Origin: 'https://x.example', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    ok(pre.status === 204 && /Authorization/.test(pre.headers['access-control-allow-headers']), 'a preflight needs no password and allows the Authorization header');
    s = [];
    for (const f of ['/', '/index.html', '/shared.js', '/stories/list.js', '/s/1/', '/p2p/']) s.push((await get(f)).status);
    ok(s.every(x => x === 200), 'the app\'s files stay open: ' + s.join(' '));
    // the room's socket: refused before anything of the room is sent
    for (const [q, what] of [['', 'without ?token='], ['&token=' + PASS + 'x', 'with a wrong one']]) {
      const c = wsAt(T, `/api/ws?room=${code}&id=pw2${q}`, { 'X-Forwarded-For': ip() });
      const m = await first(c), cl = await c.closedIn(2000);
      ok(m.t === 'error' && m.code === 'token' && m.text === 'missing or wrong token' && cl?.code === 4401 && !c.q.length, `a socket ${what}: error token, closed 4401, nothing else`);
    }
    const a = wsAt(T, `/api/ws?room=${code}&id=pw3&token=${encodeURIComponent(PASS)}`, { 'X-Forwarded-For': ip() });
    const aw = await first(a);
    ok(aw.t === 'welcome' && aw.you === 'pw3', 'with ?token=: welcome');
    a.send({ t: 'hello', name: 'Pat', kind: 'ar', version: 'v1' });
    await a.next(is('members'));
    // the introduction server: PeerJS's key is the password; its default key refused
    const pp = wsAt(T, peerQuery('pwpeer', 'tok1'), { 'X-Forwarded-For': ip() });
    const pm = await first(pp);
    ok(pm.type === 'INVALID-KEY' && (await pp.closedIn(2000))?.code === 4401, '/peerjs with PeerJS\'s default key: INVALID-KEY, closed 4401');
    const pk = wsAt(T, peerQuery('pwpeer', 'tok1', encodeURIComponent(PASS)), { 'X-Forwarded-For': ip() });
    ok((await first(pk)).type === 'OPEN', 'with the password as its key: OPEN');
    const idr = await get('/peerjs/' + PASS + '/id');
    ok(idr.status === 200 && /^[0-9a-f-]{36}$/.test(idr.text) && (await get('/peerjs', { headers: bearer() })).json().key === undefined, 'an id over HTTP with the key in its path; the info never names a key');
    pk.ws.close();
    // the dev watch stream
    const watch = await new Promise(r => {
      const q = http.get({ host: '127.0.0.1', port: T.port, path: '/api/watch?token=' + PASS, headers: { 'X-Forwarded-For': ip() } }, res => {
        let text = '';
        res.on('data', d => { text += d; if (/event: hello/.test(text)) { r({ status: res.statusCode, type: res.headers['content-type'], text }); q.destroy(); } });
      });
      q.on('error', () => {});
      setTimeout(() => { r({}); q.destroy(); }, 3000);
    });
    ok(watch.status === 200 && /event-stream/.test(watch.type), '/api/watch with ?token=: the stream');
    // logs: written with the password, and nowhere in a file
    const hc = /CMD (node -e .*)$/m.exec(fs.readFileSync(path.join(HERE, 'Dockerfile'), 'utf8'));
    let hcOk = false;
    try { execFileSync('sh', ['-c', hc[1].replace(/^node /, JSON.stringify(process.execPath) + ' ').replace('8787', String(T.port))], { stdio: 'ignore', timeout: 5000 }); hcOk = true; } catch { /* failed */ }
    ok(hc && /api\/health/.test(hc[1]) && hcOk, 'the Dockerfile\'s health check (/api/health) passes on a relay with a password');
    const lg = await get('/api/log', { method: 'POST', headers: bearer(), body: { room: code, id: 'pw4', name: 'Pat', kind: 'ar', entries: [{ ev: 'x' }] } });
    ok(lg.status === 200, 'POST /api/log with it: kept');
    // failures: 20 a minute from one address, then 429 / 4429 for anything from it, the password too
    const X = ip();
    s = [];
    for (let i = 0; i < 20; i++) s.push((await get('/api/ping', { ip: X, headers: bearer('wrong' + i) })).status);
    const held = await get('/api/ping', { ip: X, headers: bearer() });
    ok(s.every(x => x === 401) && held.status === 429 && /wait a minute/.test(held.json().error) && +held.headers['retry-after'] > 0, '20 wrong ones from one address: 401 each, then 429 even with the right one');
    const Z = ip();
    s = [];
    for (let i = 0; i < 25; i++) s.push((await get('/api/ping', { ip: Z })).status);
    ok(s.every(x => x === 401) && (await get('/api/ping', { ip: Z, headers: bearer() })).status === 200, 'none at all is not counted (pages ask before they know it): 25 times 401, then the right one works');
    const hs = wsAt(T, `/api/ws?room=${code}&id=pw5&token=${PASS}`, { 'X-Forwarded-For': X });
    const hm = await first(hs);
    ok(hm.t === 'error' && hm.code === 'limit' && (await hs.closedIn(2000))?.code === 4429, 'and its socket: error limit, closed 4429');
    const hp = wsAt(T, peerQuery('pwpeer2', 'tok2', PASS), { 'X-Forwarded-For': X });
    ok((await first(hp)).type === 'ERROR' && (await hp.closedIn(2000))?.code === 4429, 'and the introduction server: ERROR, 4429');
    ok((await get('/api/ping', { headers: bearer() })).status === 200 && (await get('/api/health', { ip: X })).status === 200 && (await get('/index.html', { ip: X })).status === 200,
      'another address is not held back; /api/health and the app\'s files stay open for this one');
    // unknown room codes asked with the right password do not count (after a relay restart every kept room is unknown, and
    // the devices behind an event's router share one address): 15 lookups and 15 sockets, then a known room still answers
    const Y = ip();
    s = [];
    for (const x of unknownCodes(15)) s.push((await get('/api/rooms/' + x, { ip: Y, headers: bearer() })).status);
    for (const x of unknownCodes(30).slice(15)) { const u = wsAt(T, `/api/ws?room=${x}&id=pw6&token=${PASS}`, { 'X-Forwarded-For': Y }); s.push((await first(u)).code); }
    ok(s.slice(0, 15).every(x => x === 404) && s.slice(15).every(x => x === 'room') && (await get('/api/rooms/' + code, { ip: Y, headers: bearer() })).status === 200,
      'unknown room codes asked with the password (15 lookups, 15 sockets) are not counted: a known room still answers');
    // PeerJS's default key (a page with no password yet sends it) is refused but not counted, as none at all
    const K = ip();
    s = [];
    for (let i = 0; i < 25; i++) { const u = wsAt(T, peerQuery('pwdef' + i, 'tokd' + i, 'peerjs'), { 'X-Forwarded-For': K }); s.push((await u.closedIn(2000))?.code); }
    ok(s.every(x => x === 4401) && (await get('/api/ping', { ip: K, headers: bearer() })).status === 200, "PeerJS's default key is not counted: 25 times 4401, then the right password works");
    a.ws.close();
    await sleep(400);
    const files = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    ok(files.length > 0 && !files.includes(PASS) && !T.out.includes(PASS), 'the password is in no log line and no log file');
    ok(/requests refused: missing or wrong token \(\d+\)/.test(T.out) && /sockets refused: missing or wrong token \(\d+\)/.test(T.out) && /too many failed attempts from one address/.test(T.out),
      'the refusals counted in the log');
    T.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await step('a password with --token (and in RELAY_ARGS); COLLAB_PORT and COLLAB_HOST', async () => {
    const PASS = 'flag' + crypto.randomBytes(4).toString('hex');
    const F = await start(['--token', PASS, '--quiet']);
    ok((await req('GET', '/api/ping', { at: F.port })).status === 401 && (await req('GET', '/api/ping', { at: F.port, headers: { Authorization: 'Bearer ' + PASS } })).status === 200, '--token <t>');
    F.kill();
    const G = await start(['--quiet'], { RELAY_ARGS: '--token ' + PASS });
    ok((await req('GET', '/api/ping', { at: G.port })).status === 401 && (await req('GET', '/api/ping?token=' + PASS, { at: G.port })).status === 200, 'RELAY_ARGS="--token <t>"');
    G.kill();
    // a free port, then a relay told it by the environment alone
    const free = await new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
    const E = spawn(process.execPath, [path.join(HERE, 'server.mjs')], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, RELAY_ARGS: '', COLLAB_PORT: String(free), COLLAB_HOST: '127.0.0.1', COLLAB_TOKEN: '' } });
    procs.push(E);
    let out = '';
    const line = await new Promise(r => { E.stdout.on('data', d => { out += d; if (/listening on/.test(out)) r(out); }); setTimeout(() => r(out), 4000); });
    ok(line.includes(`http://127.0.0.1:${free}`) && (await req('GET', '/api/health', { at: free })).status === 200, 'COLLAB_PORT and COLLAB_HOST');
    E.kill();
  });

  await step('--store: every room together holds at most so many MB', async () => {
    const T = await start(['--store', '1', '--quiet']);
    const mk = async () => (await req('POST', '/api/rooms', { at: T.port, body: { app: 'networks', version: 'v1' } })).json().code;
    const [r1, r2] = [await mk(), await mk()];
    const a = wsAt(T, `/api/ws?room=${r1}&id=sa`), b = wsAt(T, `/api/ws?room=${r2}&id=sb`);
    await first(a); await first(b);
    const write = async (c, batch, cid) => { c.send({ t: 'set', batch, cid }); return Promise.race([c.next(is('set', m => m.cid === cid)), c.next(is('error', m => m.cid === cid))]); };
    const big = 'x'.repeat(MAX_VALUE - 2);
    let s;
    for (let i = 0; i < 3; i++) s = await write(a, [['pose.' + i, big]], 'w' + i);
    ok(s?.t === 'set', 'three values of 256 KB in one room');
    s = await write(b, [['pose.x', big]], 'wb');
    ok(s?.t === 'error' && /the relay is full/.test(s.text), 'a fourth in another room: the relay is full (1 MB)');
    s = await write(a, [['pose.0', null]], 'del');
    ok(s?.t === 'set' && (await write(b, [['pose.x', big]], 'wb2'))?.t === 'set', 'one deleted: room for it');
    ok((await write(a, [['pose.1', 'small']], 'shrink'))?.t === 'set', 'a value made smaller is never refused');
    a.ws.close(); b.ws.close(); T.kill();
  });

  // ---- the studio's scenes (--scenes; tools/studio/SPEC.md, "Where scenes come from")
  // a folder of scenes in the OS's temporary folder: every kind of file, the files a listing leaves out, links in and out
  const SC = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-scenes-')), S = path.join(SC, 'scenes'), OUT = path.join(SC, 'outside');
  const put = (rel, data) => { const f = path.join(S, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); return f; };
  const bytes = n => crypto.randomBytes(n);
  const TONE = bytes(2000), GLB = Buffer.concat([Buffer.from('glTF'), bytes(96)]);
  const ALPHA = { studio: 1, scene: 'alpha', objects: [{ id: 'k3f9qa', name: 'Box', file: 'model.glb', p: [0, 0, 0], q: [0, 0, 0, 1], s: 1 }], cubes: [], sounds: [] };
  put('alpha/model.glb', GLB); put('alpha/Model2.GLTF', '{"asset":{"version":"2.0"}}'); put('alpha/rig.FBX', bytes(300));
  put('alpha/tex/wall.PNG', bytes(40)); put('alpha/tex/photo.jpeg', bytes(50)); put('alpha/sounds/tone.wav', TONE); put('alpha/sounds/birds.MP3', bytes(70));
  put('alpha/data.bin', bytes(16)); put('alpha/notes.txt', 'notes'); put('alpha/deep/a/b/c/ok.glb', bytes(10)); put('alpha/deep/a/b/c/d/too-deep.glb', bytes(10));
  put('alpha/layout.json', JSON.stringify(ALPHA)); put('alpha/files.json', '{"stale":true}'); put('alpha/.hidden', 'x'); put('alpha/.history/layout-old.json', '{}');
  put('alpha/x.tmp', 'x'); put('alpha/y~', 'x'); put('alpha/z.part', 'x');
  put('beta/a.ogg', bytes(30)); put('with space/x.webm', bytes(20)); put('bad!/x.glb', 'x'); put('-dash/x.glb', 'x'); put('watch/x.glb', 'x'); put('.git/x', 'x'); put('readme.txt', 'x');
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'secret.glb'), 'secret'); fs.writeFileSync(path.join(OUT, 'secret.txt'), 'secret');
  fs.symlinkSync(path.join(S, 'alpha/sounds/tone.wav'), path.join(S, 'alpha/link.wav'));   // a link inside: followed
  fs.symlinkSync(path.join(OUT, 'secret.glb'), path.join(S, 'alpha/escape.glb'));        // links out: never
  fs.symlinkSync(OUT, path.join(S, 'alpha/escdir'));
  const ALPHA_FILES = [['Model2.GLTF', 'model'], ['data.bin', 'data'], ['deep/a/b/c/ok.glb', 'model'], ['link.wav', 'audio'], ['model.glb', 'model'], ['notes.txt', 'other'],
    ['rig.FBX', 'model'], ['sounds/birds.MP3', 'audio'], ['sounds/tone.wav', 'audio'], ['tex/photo.jpeg', 'image'], ['tex/wall.PNG', 'image']];
  const SCN = await start(['--scenes', S]);
  const sget = (p, o = {}) => req(o.method || 'GET', p, { at: SCN.port, headers: o.headers || {}, body: o.body });
  const mtime = rel => Math.floor(fs.statSync(path.join(S, rel)).mtimeMs);
  // a Server-Sent Events stream, its events kept in order
  function sse(at, p, headers = {}) {
    const c = { events: [], status: 0 };
    c.ready = new Promise(resolve => {
      c.req = http.get({ host: '127.0.0.1', port: at, path: p, headers }, res => {
        c.status = res.statusCode; c.headers = res.headers;
        let buf = '';
        res.on('data', d => {
          buf += d;
          for (let i; (i = buf.indexOf('\n\n')) >= 0;) {
            const block = buf.slice(0, i), ev = /^event: (.*)$/m.exec(block), data = /^data: (.*)$/m.exec(block);
            buf = buf.slice(i + 2);
            if (ev && data) c.events.push({ event: ev[1], data: JSON.parse(data[1]), at: Date.now() });
          }
        });
        resolve(c);
      });
      c.req.on('error', () => resolve(c));
    });
    c.next = async (pred, ms = 6000) => {
      for (const end = Date.now() + ms; ;) {
        const i = c.events.findIndex(pred);
        if (i >= 0) return c.events.splice(i, 1)[0];
        if (Date.now() > end) return null;
        await sleep(25);
      }
    };
    c.close = () => c.req.destroy();
    return c;
  }
  const ev = (event, more = () => true) => e => e.event === event && more(e.data);

  await step('scenes (--scenes): /api/ping says so, the list and one scene by the listing rules; none on a relay without it', async () => {
    ok((await sget('/api/ping')).json().scenes === true && (await req('GET', '/api/ping')).json().scenes === undefined, '/api/ping: scenes: true only with --scenes');
    const none = await req('GET', '/api/scenes');
    ok(none.status === 404 && /--scenes/.test(none.json().error) && (await req('GET', '/scenes/alpha/model.glb')).status === 404, 'a relay without --scenes: no /api/scenes, no /scenes/');
    const l = await sget('/api/scenes');
    const list = l.json();
    ok(l.status === 200 && list.save === true && list.scenes.map(s => s.name).join('|') === 'alpha|beta|with space', 'GET /api/scenes: alpha, beta and "with space" (bad!, -dash, watch, .git and a file at the top left out): ' + list.scenes.map(s => s.name).join('|'));
    const a = list.scenes[0], b = list.scenes[1];
    ok(Object.keys(a).sort().join() === 'at,bytes,files,layout,name' && a.files === ALPHA_FILES.length && a.layout === true && b.layout === false && b.files === 1 && b.bytes === 30,
      'each { name, files, bytes, at, layout }');
    const sizes = ALPHA_FILES.map(([p]) => fs.statSync(path.join(S, 'alpha', p)).size);
    ok(a.bytes === sizes.reduce((x, y) => x + y, 0) && a.at === Math.max(...ALPHA_FILES.map(([p]) => mtime('alpha/' + p))), 'bytes the files\' size, at the newest file\'s time');
    ok((SCN.out.match(/left out the folder "bad!"/g) || []).length === 1 && /left out the folder "-dash"/.test(SCN.out) && /left out the folder "watch" \(watch is the change stream/.test(SCN.out),
      'a folder whose name cannot be a scene\'s is said in the log, once (listed twice now)');
    const o = await sget('/api/scenes/alpha'), one = o.json();
    ok(o.status === 200 && Object.keys(one).sort().join() === 'files,layout,layoutAt,name,save' && one.name === 'alpha' && one.save === true, 'GET /api/scenes/alpha: { name, files, layout, layoutAt, save }');
    ok(JSON.stringify(one.files.map(f => [f.path, f.kind])) === JSON.stringify(ALPHA_FILES), 'its files sorted by path with their kinds (not layout.json, files.json, dot files, .history/, temporary files, too deep or links out): ' + one.files.map(f => f.path).join(' '));
    ok(one.files.every(f => Object.keys(f).sort().join() === 'at,bytes,kind,path' && f.bytes === fs.statSync(path.join(S, 'alpha', f.path)).size && f.at === mtime('alpha/' + f.path)), 'each file { path, bytes, at, kind }');
    ok(JSON.stringify(one.layout) === JSON.stringify(ALPHA) && one.layoutAt === mtime('alpha/layout.json'), 'its layout parsed, layoutAt its time');
    const bt = (await sget('/api/scenes/beta')).json();
    ok(bt.layout === null && bt.layoutAt === null && bt.files.length === 1 && bt.files[0].kind === 'audio', 'a scene without layout.json: layout and layoutAt null');
    ok((await sget('/api/scenes/with%20space')).json().files?.[0]?.kind === 'audio', 'a name with a space, escaped');
    const s = [];
    for (const p of ['/api/scenes/nope', '/api/scenes/bad!', '/api/scenes/%2e%2e', '/api/scenes/alpha%2Fsounds', '/api/scenes/%E0%A4%A', '/api/scenes/alpha/x']) s.push((await sget(p)).status);
    ok(s.every(x => x === 404), 'no such scene, a name that cannot be one, .., an escaped slash, a bad escape, a path past it: 404 (' + s.join(' ') + ')');
    ok((await sget('/api/scenes', { method: 'PUT', body: {} })).status === 405 && (await sget('/api/scenes/alpha', { method: 'DELETE' })).status === 405 && (await sget('/api/scenes/alpha/layout')).status === 405,
      'other methods: 405');
  });

  await step('scenes: tools/studio/scan.mjs writes index.json and files.json as the API answers them, and nothing when run again', async () => {
    const scan = (...a) => { try { return { code: 0, out: execFileSync(process.execPath, [path.join(REPO, 'tools/studio/scan.mjs'), ...a], { encoding: 'utf8' }) }; } catch (err) { return { code: err.status, out: String(err.stdout) }; } };
    const r1 = scan(S);
    ok(r1.code === 0 && /wrote .*index\.json \(3 scenes\)/.test(r1.out) && /wrote .*alpha[\\/]files\.json \(11 files and layout\.json\)/.test(r1.out) && /left out the folder "bad!"/.test(r1.out), 'scan.mjs: what it wrote');
    // (a plain folder takes no uploads: index.json is the list without upload, ffmpeg and maxUpload, which a page reads as none)
    // (it may say upload: false, ffmpeg: false, maxUpload: 0 outright)
    const { upload: _u, ffmpeg: _f, maxUpload: _m, ...api } = (await sget('/api/scenes')).json(), { upload: iu, ffmpeg: iff, maxUpload: im, ...idx } = JSON.parse(fs.readFileSync(path.join(S, 'index.json'), 'utf8'));
    ok(JSON.stringify(idx) === JSON.stringify({ ...api, save: false }) && !iu && !iff && !im, 'index.json is GET /api/scenes with save: false (and no uploads)');
    for (const n of ['alpha', 'beta', 'with space']) {
      const one = (await sget('/api/scenes/' + encodeURIComponent(n))).json(), fj = JSON.parse(fs.readFileSync(path.join(S, n, 'files.json'), 'utf8'));
      delete one.layout;
      ok(JSON.stringify(fj) === JSON.stringify({ ...one, save: false }), `${n}/files.json is GET /api/scenes/${n} without layout, save: false`);
    }
    ok(JSON.stringify((await sget('/api/scenes')).json()) === JSON.stringify({ ...api, upload: _u, ffmpeg: _f, maxUpload: _m }), 'index.json and files.json are not listed themselves');
    const r2 = scan(S), r3 = scan(S, '--check');
    ok(r2.code === 0 && !/wrote/.test(r2.out) && (r2.out.match(/unchanged/g) || []).length === 4 && r3.code === 0 && !/NOT CURRENT/.test(r3.out), 'run again: unchanged; --check: current');
    const extra = put('beta/new.png', 'x');
    const r4 = scan(S, '--check');
    ok(r4.code === 1 && /NOT CURRENT .*beta[\\/]files\.json/.test(r4.out), '--check: a new file makes it not current (exit 1)');
    fs.rmSync(extra);
    ok(scan(S, '--check').code === 0 && scan(path.join(SC, 'nope')).code === 1, 'gone again: current; no such folder: exit 1');
  });

  await step('scenes: files with their types, ETag and 304, no-cache, byte ranges, CORS; .., dot files, backslashes, NUL and links out refused', async () => {
    const g = await sget('/scenes/alpha/model.glb');
    ok(g.status === 200 && g.buf.equals(GLB) && g.headers['content-type'] === 'model/gltf-binary' && g.headers['cache-control'] === 'no-cache' && g.headers['accept-ranges'] === 'bytes' &&
      /^"[0-9a-z]+-[0-9a-z]+"$/.test(g.headers.etag) && g.headers['access-control-allow-origin'] === '*' && !g.headers['content-encoding'], 'a model: its bytes, model/gltf-binary, no-cache, an ETag, CORS');
    ok((await sget('/scenes/alpha/model.glb', { headers: { 'If-None-Match': g.headers.etag } })).status === 304, 'If-None-Match with its ETag: 304');
    const types = [['alpha/Model2.GLTF', 'model/gltf+json'], ['alpha/rig.FBX', 'application/octet-stream'], ['alpha/tex/wall.PNG', 'image/png'], ['alpha/tex/photo.jpeg', 'image/jpeg'],
      ['alpha/sounds/tone.wav', 'audio/wav'], ['alpha/sounds/birds.MP3', 'audio/mpeg'], ['alpha/data.bin', 'application/octet-stream'], ['with%20space/x.webm', 'audio/webm'], ['beta/a.ogg', 'audio/ogg']];
    const got = [];
    for (const [p] of types) got.push((await sget('/scenes/' + p)).headers['content-type']);
    ok(got.every((t, i) => t === types[i][1]), 'types by extension, any case: ' + got.join(' '));
    // a page, a script or a picture that can run script, kept in a scene (originals/ takes anything): plain bytes to save,
    // never run on the relay's origin; every scene file sandboxed
    const odd = ['page.html', 'x.svg', 'x.js'].map(n => path.join(S, 'alpha', n));
    for (const f of odd) fs.writeFileSync(f, '<script>parent.QSECRETQ = 1</script>');
    const inert = [];
    for (const f of odd) inert.push((await sget('/scenes/alpha/' + path.basename(f))).headers);
    for (const f of odd) fs.rmSync(f);
    ok(inert.every(h => h['content-type'] === 'application/octet-stream' && h['content-disposition'] === 'attachment' && /sandbox/.test(h['content-security-policy'] || '') && h['x-content-type-options'] === 'nosniff') &&
      /sandbox/.test(g.headers['content-security-policy'] || '') && !g.headers['content-disposition'], 'a page, an SVG or a script in a scene: octet-stream, attachment, sandboxed; a model sandboxed too, not an attachment');
    const r = await sget('/scenes/alpha/sounds/tone.wav', { headers: { Range: 'bytes=10-19' } }), suf = await sget('/scenes/alpha/sounds/tone.wav', { headers: { Range: 'bytes=-100' } });
    ok(r.status === 206 && r.headers['content-range'] === 'bytes 10-19/2000' && r.buf.equals(TONE.subarray(10, 20)) && suf.status === 206 && suf.buf.equals(TONE.subarray(1900)),
      'byte ranges: 206 with Content-Range, a suffix range');
    ok((await sget('/scenes/alpha/sounds/tone.wav', { headers: { Range: 'bytes=5000-' } })).status === 416 && (await sget('/scenes/alpha/model.glb', { method: 'HEAD' })).buf.length === 0, 'a range past the end: 416; HEAD: no body');
    const pre = await sget('/scenes/alpha/model.glb', { method: 'OPTIONS', headers: { Origin: 'https://x.github.io', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization, range' } });
    ok(pre.status === 204 && /Authorization/.test(pre.headers['access-control-allow-headers']) && /Range/.test(pre.headers['access-control-allow-headers']), 'a preflight allows Authorization and Range');
    ok((await sget('/scenes/alpha/link.wav')).buf.equals(TONE) && (await sget('/scenes/alpha/deep/a/b/c/ok.glb')).status === 200, 'a link inside the scene and a file 4 folders deep: served');
    const s = [];
    for (const p of ['/scenes/alpha/../beta/a.ogg', '/scenes/alpha/%2e%2e/beta/a.ogg?token=QSECRETQ', '/scenes/alpha/%2e%2e%2f%2e%2e%2foutside%2fsecret.txt', '/scenes/alpha/..%2F..%2F..%2Frelay%2Fserver.mjs',
      '/scenes/alpha/sounds%5Ctone.wav', '/scenes/alpha/sounds\\tone.wav', '/scenes/alpha/tone%00.wav', '/scenes/alpha/escape.glb', '/scenes/alpha/escdir/secret.txt',
      '/scenes/alpha/.hidden', '/scenes/alpha/.history/layout-old.json', '/scenes/alpha/deep/a/b/c/d/too-deep.glb', '/scenes/bad!/x.glb', '/scenes/nope/x.glb', '/scenes/alpha/', '/scenes/alpha', '/scenes/alpha/tex',
      '/scenes/%252e%252e/x', '/scenes/alpha/%E0%A4%A']) s.push((await sget(p)).status);
    ok(s.every(x => x === 404), '.. (as is or escaped), backslashes, NUL, links out, dot files, .history/, too deep, no such scene, a folder: 404 (' + s.join(' ') + ')');
    ok((await sget('/scenes/alpha/model.glb', { method: 'POST', body: 'x' })).status === 405, 'POST to a file: 405');
    await sleep(100);
    ok(/scenes: refused "\/scenes\/alpha\/\.\.\/beta\/a\.ogg" \(out of its folder\)/.test(SCN.out) && /scenes: refused "\/scenes\/alpha\/escape\.glb" \(a link out of its folder\)/.test(SCN.out) &&
      /refused "\/scenes\/alpha\/%2e%2e\/beta\/a\.ogg" \(out of its folder\)/.test(SCN.out) && /\(a backslash or NUL\)/.test(SCN.out) && !SCN.out.includes('QSECRETQ'),
      'refusals said in the log by their path, never its query');
  });

  await step('scenes: POST /api/scenes/<name>/layout writes layout.json whole, the old one into .history/ (20 kept); bad, too big, unknown refused', async () => {
    const save = (name, body, headers = {}) => sget(`/api/scenes/${encodeURIComponent(name)}/layout`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } });
    const L = n => ({ studio: 1, scene: 'beta', saved: new Date().toISOString(), n, objects: [{ id: 'a' + n, name: 'X', file: 'a.ogg', p: [n, 0, 0] }], cubes: [], sounds: [] });
    const f = path.join(S, 'beta', 'layout.json'), hist = path.join(S, 'beta', '.history');
    const r1 = await save('beta', L(1)), a1 = r1.json();
    ok(r1.status === 200 && a1.ok === true && a1.bytes === fs.statSync(f).size && a1.at === Math.floor(fs.statSync(f).mtimeMs) && !fs.existsSync(hist), 'the first save: { ok, at, bytes }, no history yet');
    ok(JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8'))) === JSON.stringify(L(1)).replace(/"saved":"[^"]*"/, `"saved":${JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8')).saved)}`) &&
      /^\{\n  "studio": 1,\n[\s\S]*\n  "objects": \[\n    \{"id":"a1",/.test(fs.readFileSync(f, 'utf8')), 'layout.json as sent, laid out a field a line and an item a line');
    const r2 = await save('beta', L(2));
    const h1 = fs.readdirSync(hist);
    ok(r2.status === 200 && h1.length === 1 && /^layout-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.\d{3}Z\.json$/.test(h1[0]) && JSON.parse(fs.readFileSync(path.join(hist, h1[0]), 'utf8')).n === 1, 'the second: the first in .history/layout-<time>.json');
    const one = (await sget('/api/scenes/beta')).json();
    ok(one.layout.n === 2 && one.layoutAt === r2.json().at, 'GET gives the saved layout and its time');
    for (let n = 3; n <= 24; n++) await save('beta', L(n));
    const ns = fs.readdirSync(hist).map(x => JSON.parse(fs.readFileSync(path.join(hist, x), 'utf8')).n).sort((x, y) => x - y);
    ok(ns.length === 20 && ns[0] === 4 && ns[19] === 23 && JSON.parse(fs.readFileSync(f, 'utf8')).n === 24, '24 saves: layout.json the last, the newest 20 before it kept (' + ns[0] + ' to ' + ns[19] + ')');
    const all = await Promise.all([25, 26, 27, 28, 29].map(n => save('beta', L(n))));
    const last = JSON.parse(fs.readFileSync(f, 'utf8')).n;
    ok(all.every(x => x.status === 200) && last >= 25 && fs.readdirSync(hist).length === 20 && !fs.readdirSync(path.join(S, 'beta')).some(x => /\.tmp$/.test(x)), 'five at once: one at a time, no temporary file left');
    const before = fs.readFileSync(f, 'utf8');
    const bad = [];
    for (const b of ['not json', '[1]', '{"studio":2}', '{}', 'null', '"x"']) bad.push((await save('beta', b)).status);
    ok(bad.every(x => x === 400) && (await save('beta', '{"studio":1')).json().error.includes('studio: 1'), 'not a layout (not JSON, not an object, studio not 1): 400 (' + bad.join(' ') + ')');
    const big = JSON.stringify({ studio: 1, pad: 'x'.repeat(2 << 20) });
    let tb;
    try { tb = (await save('beta', big)).status; } catch { tb = 'cut'; }
    ok(tb === 413, 'more than 2 MB: 413 (' + tb + ')');
    ok((await save('nope', L(1))).status === 404 && (await save('bad!', L(1))).status === 404 && (await save('with space', { studio: 1 })).status === 200, 'no such scene: 404; a name with a space: saved');
    ok(fs.readFileSync(f, 'utf8') === before, 'refused saves change nothing');
    const pre = await sget('/api/scenes/beta/layout', { method: 'OPTIONS', headers: { Origin: 'https://x.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } });
    ok(pre.status === 204 && /POST/.test(pre.headers['access-control-allow-methods']) && /Authorization/.test(pre.headers['access-control-allow-headers']) && /Content-Type/.test(pre.headers['access-control-allow-headers']),
      'the preflight allows POST, Authorization and Content-Type');
    const RO = await start(['--scenes', S, '--scenes-readonly', '--quiet']);
    const ro = await req('POST', '/api/scenes/beta/layout', { at: RO.port, body: L(99) });
    ok(ro.status === 403 && /--scenes-readonly/.test(ro.json().error) && fs.readFileSync(f, 'utf8') === before, '--scenes-readonly: 403 { error }, nothing written');
    ok((await req('GET', '/api/scenes', { at: RO.port })).json().save === false && (await req('GET', '/api/scenes/beta', { at: RO.port })).json().save === false && (await sget('/api/scenes')).json().save === true,
      '--scenes-readonly: save false in the list and the scene');
    RO.kill();
  });

  await step('scenes: the watch (/api/scenes/watch): hello, a file added, changed and removed once settled, a saved layout, a new scene; nothing for .history/ or temporary files', async () => {
    const w = sse(SCN.port, '/api/scenes/watch');
    await w.ready;
    const hello = await w.next(ev('hello'), 3000);
    ok(w.status === 200 && /event-stream/.test(w.headers['content-type']) && hello?.data.scenes.map(s => s.name).join('|') === 'alpha|beta|with space', 'hello { scenes } at once');
    put('beta/new.glb', 'x'); fs.appendFileSync(path.join(S, 'beta/a.ogg'), 'more'); fs.rmSync(path.join(S, 'alpha/notes.txt'));
    put('beta/.x.tmp', 'x'); put('beta/y.part', 'x'); put('beta/.history/extra.json', 'x');
    const t0 = Date.now();
    const [e1, e2, e3] = await Promise.all([w.next(ev('scene', d => d.path === 'new.glb')), w.next(ev('scene', d => d.path === 'a.ogg')), w.next(ev('scene', d => d.path === 'notes.txt'))]);
    ok(JSON.stringify(e1?.data) === '{"name":"beta","path":"new.glb","kind":"model","gone":false}' && JSON.stringify(e2?.data) === '{"name":"beta","path":"a.ogg","kind":"audio","gone":false}' &&
      JSON.stringify(e3?.data) === '{"name":"alpha","path":"notes.txt","kind":"other","gone":true}', 'scene { name, path, kind, gone } for a file added, changed and removed');
    ok(e1 && e1.at - t0 >= 400 && e1.at - t0 < 5000, `told a moment after it settled (${e1 ? e1.at - t0 : '-'} ms)`);
    const s = await sget('/api/scenes/beta/layout', { method: 'POST', body: { studio: 1, scene: 'beta', objects: [] } });
    const lay = await w.next(ev('layout'));
    ok(JSON.stringify(lay?.data) === JSON.stringify({ name: 'beta', at: s.json().at }), 'a save: layout { name, at }');
    fs.mkdirSync(path.join(S, 'gamma')); put('gamma/g.mp3', 'x');
    const sc = await w.next(ev('scenes')), g = await w.next(ev('scene', d => d.name === 'gamma'));
    ok(sc?.data.scenes.map(x => x.name).join('|') === 'alpha|beta|gamma|with space' && g?.data.path === 'g.mp3' && g.data.kind === 'audio', 'a new scene: scenes { scenes }, and its file');
    // a file still being written (a copy in progress): told once, after its last part
    const grow = path.join(S, 'beta/grow.bin');
    for (let i = 0; i < 10; i++) { fs.appendFileSync(grow, bytes(1000)); await sleep(150); }
    const done = Date.now(), gr = await w.next(ev('scene', d => d.path === 'grow.bin'));
    await sleep(2600);
    ok(gr && gr.at >= done && !w.events.some(e => e.data.path === 'grow.bin'), 'a file written in parts over 1.5 s: told once, after its last part');
    ok(!w.events.some(e => e.event === 'scene' && /(^|\/)\.|\.part$|\.tmp$/.test(e.data.path)), 'nothing for .history/, dot files or temporary files: ' + w.events.map(e => e.event + ' ' + (e.data.path || '')).join(', '));
    fs.rmSync(path.join(S, 'beta/layout.json'));
    const gone = await w.next(ev('layout'));
    ok(gone?.data.name === 'beta' && gone.data.gone === true && gone.data.at === null, 'layout.json removed: layout { name, at: null, gone: true }');
    const w2 = sse(SCN.port, '/api/scenes/watch');
    await w2.ready;
    ok((await w2.next(ev('hello'), 3000))?.data.scenes.length === 4, 'a second page: hello with the scenes as they are now');
    fs.rmSync(path.join(S, 'gamma'), { recursive: true });
    const [x1, x2] = await Promise.all([w.next(ev('scenes')), w2.next(ev('scenes'))]);
    ok(x1?.data.scenes.length === 3 && x2?.data.scenes.length === 3, 'both told when a scene goes');
    w.close(); w2.close();
    ok((await req('POST', '/api/scenes/watch', { at: SCN.port })).status === 405, 'POST to the watch: 405');
  });
  SCN.kill();

  await step('scenes with a password: every scene endpoint and file needs it (Bearer or ?token=), wrong ones counted, never in a log line; --public needs one', async () => {
    const PASS = 'scenes' + crypto.randomBytes(5).toString('hex');
    const T = await start(['--scenes', S, '--proxy'], { COLLAB_TOKEN: PASS });
    let n = 0;
    const ip = () => '198.51.100.' + (++n);
    const tget = (p, o = {}) => req(o.method || 'GET', p, { at: T.port, headers: { 'X-Forwarded-For': o.ip || ip(), ...(o.headers || {}) }, body: o.body });
    const bearer = (t = PASS) => ({ Authorization: 'Bearer ' + t });
    const no = r => r.status === 401 && r.text === '{"error":"missing or wrong token"}';
    const asks = [['GET', '/api/scenes'], ['GET', '/api/scenes/alpha'], ['GET', '/api/scenes/nope'], ['POST', '/api/scenes/beta/layout', { studio: 1 }], ['GET', '/api/scenes/watch'],
      ['GET', '/scenes/alpha/model.glb'], ['HEAD', '/scenes/alpha/model.glb'], ['GET', '/scenes/alpha/../beta/a.ogg'], ['GET', '/scenes/nope/x']];
    let s = [];
    for (const [m, p, b] of asks) s.push(no(await tget(p, { method: m, body: b })) || (m === 'HEAD' && (await tget(p, { method: m })).status === 401));
    ok(s.every(Boolean), 'without it: 401 for the list, a scene, no scene, a save, the watch, a file (GET and HEAD), a path out, no such file');
    s = [];
    for (const [m, p, b] of asks.slice(0, 4).concat([asks[5]])) s.push(no(await tget(p, { method: m, body: b, headers: bearer(PASS + 'x') })));
    ok(s.every(Boolean), 'a wrong one: 401');
    const f1 = await tget('/scenes/alpha/model.glb?token=' + PASS), f2 = await tget('/scenes/alpha/model.glb', { headers: bearer() });
    ok(f1.status === 200 && f1.buf.equals(GLB) && f2.status === 200 && (await tget('/scenes/alpha/sounds/tone.wav?token=' + PASS, { headers: { Range: 'bytes=0-9' } })).status === 206,
      'a file with ?token= (as the loaders fetch them) or Authorization: Bearer; a range too');
    ok((await tget('/api/scenes', { headers: bearer() })).json().scenes.length === 3 && (await tget('/api/scenes/alpha?token=' + PASS)).json().name === 'alpha' &&
      (await tget('/api/scenes/beta/layout', { method: 'POST', headers: bearer(), body: { studio: 1, scene: 'beta' } })).json().ok === true, 'the list, a scene and a save with it');
    const pre = await tget('/scenes/alpha/model.glb', { method: 'OPTIONS', headers: { Origin: 'https://x.github.io', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    ok(pre.status === 204, 'a preflight needs no password');
    const w = sse(T.port, '/api/scenes/watch?token=' + PASS, { 'X-Forwarded-For': ip() });
    await w.ready;
    ok(w.status === 200 && !!(await w.next(ev('hello'), 3000)), 'the watch with ?token=');
    w.close();
    const X = ip();
    s = [];
    for (let i = 0; i < 20; i++) s.push((await tget('/scenes/alpha/model.glb?token=wrong' + i, { ip: X })).status);
    const held = await tget('/scenes/alpha/model.glb?token=' + PASS, { ip: X });
    ok(s.every(x => x === 401) && held.status === 429 && (await tget('/api/scenes', { ip: X, headers: bearer() })).status === 429, '20 wrong ones for files from one address: 401 each, then 429 for files and the API');
    ok((await tget('/scenes/alpha/model.glb?token=' + PASS)).status === 200, 'another address is not held back');
    // uploads (a scene made, a file, a sound) with it, as every scene endpoint; /upload sends people on without it
    const upAsk = [['POST', '/api/scenes', { name: 'pw scene' }], ['POST', '/api/scenes/beta/file?path=pw.glb', 'x'], ['POST', '/api/scenes/beta/sound?path=pw.mp3', 'x']];
    s = [];
    for (const [m, p, b] of upAsk) { s.push(no(await tget(p, { method: m, body: b }))); s.push(no(await tget(p, { method: m, body: b, headers: bearer(PASS + 'x') }))); }
    ok(s.every(Boolean) && !fs.existsSync(path.join(S, 'pw scene')) && !fs.existsSync(path.join(S, 'beta/pw.glb')), 'uploads without it or with a wrong one: 401, nothing written');
    const mk = await tget('/api/scenes', { method: 'POST', headers: bearer(), body: { name: 'pw scene' } }), fl = await tget('/api/scenes/pw%20scene/file?path=a.glb&token=' + PASS, { method: 'POST', body: 'glb' });
    ok(mk.status === 201 && fl.status === 200 && fs.readFileSync(path.join(S, 'pw scene', 'a.glb'), 'utf8') === 'glb', 'with it (Bearer, ?token=): a scene made, a file written');
    const up = await tget('/upload?token=' + PASS);
    ok(up.status === 302 && !up.headers.location.includes(PASS) && /#studio&upload&relay=/.test(up.headers.location), '/upload: sent on without the password, which is not passed on');
    fs.rmSync(path.join(S, 'pw scene'), { recursive: true });
    await tget('/scenes/alpha/%2e%2e/beta/a.ogg?token=' + PASS);
    await sleep(300);
    ok(!T.out.includes(PASS) && /they need the password/.test(T.out) && /refused "\/scenes\/alpha\/%2e%2e\/beta\/a\.ogg"/.test(T.out), 'the password in no log line (a refused path said without its query); the start line says they need it');
    T.kill();
    const P = await start(['--scenes', S, '--public', '--quiet'], { COLLAB_TOKEN: PASS });
    ok((await req('GET', '/api/scenes', { at: P.port, headers: bearer() })).status === 200, '--public with --scenes and a password: runs');
    P.kill();
  });

  await step('scenes: the options (COLLAB_SCENES, RELAY_ARGS) and the ones refused at the start', async () => {
    const E = await start(['--quiet'], { COLLAB_SCENES: S });
    ok((await req('GET', '/api/scenes', { at: E.port })).json().scenes?.length === 3, 'COLLAB_SCENES=<dir>');
    // a scene folder that is itself a link (the owner's choice) is followed; its own links still may not leave it
    const far = path.join(SC, 'elsewhere', 'scene');
    fs.mkdirSync(far, { recursive: true }); fs.writeFileSync(path.join(far, 'x.glb'), 'far'); fs.writeFileSync(path.join(SC, 'elsewhere', 'up.txt'), 'up');
    fs.symlinkSync(path.join(SC, 'elsewhere', 'up.txt'), path.join(far, 'up.txt'));
    fs.symlinkSync(far, path.join(S, 'linked'));
    const lk = (await req('GET', '/api/scenes/linked', { at: E.port })).json();
    ok(lk.files?.map(f => f.path).join() === 'x.glb' && (await req('GET', '/scenes/linked/x.glb', { at: E.port })).text === 'far' && (await req('GET', '/scenes/linked/up.txt', { at: E.port })).status === 404,
      'a linked scene folder: listed and served; a link in it out of it is not');
    fs.rmSync(path.join(S, 'linked'));
    E.kill();
    const R2 = await start(['--quiet'], { RELAY_ARGS: '--scenes ' + S + ' --scenes-readonly' });
    ok((await req('GET', '/api/scenes', { at: R2.port })).json().save === false, 'RELAY_ARGS="--scenes <dir> --scenes-readonly"');
    R2.kill();
    const refused = (args, env = {}) => new Promise(resolve => {
      const p = spawn(process.execPath, [path.join(HERE, 'server.mjs'), '--port', '0', '--host', '127.0.0.1', ...args], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, RELAY_ARGS: '', COLLAB_TOKEN: '', ...env } });
      procs.push(p);
      let out = '';
      p.stdout.on('data', d => { out += d; });
      p.on('exit', code => resolve({ code, out }));
      setTimeout(() => { p.kill(); resolve({ code: 'still running', out }); }, 5000);
    });
    const pub = await refused(['--scenes', S, '--public']);
    ok(pub.code === 1 && /--public with --scenes needs a password/.test(pub.out) && !/listening/.test(pub.out), '--public with --scenes and no password: refuses to start, saying why');
    const miss = await refused(['--scenes', path.join(SC, 'nope')]), ro = await refused(['--scenes-readonly']);
    ok(miss.code === 1 && /--scenes: there is no folder/.test(miss.out) && ro.code === 1 && /--scenes-readonly goes with --scenes/.test(ro.out), 'a folder that is not there, --scenes-readonly alone: refused');
  });

  // ---- uploads (tools/studio/SPEC.md, "The upload page"): a scene made, files and sounds sent, /upload. A folder of scenes
  // of its own, and stand-in ffmpegs: one script whose name says what it does (ok writes a known MP3 to its last argument;
  // fail says something with a path and a query and exits 1; empty writes nothing; hang never ends; broken cannot say its
  // version), each noting its arguments, its pid and what its input held
  const U = path.join(SC, 'up'), FFD = path.join(SC, 'ff'), NOPATH = path.join(SC, 'nopath');
  for (const d of [path.join(U, 'one'), FFD, NOPATH]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(U, 'afile'), 'a file at the top, not a scene');
  const FF_OUT = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(61, 7)]);
  const STAND = `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const a = process.argv.slice(2), me = path.basename(process.argv[1]), dir = path.dirname(process.argv[1]);
if (a.includes('-version')) { if (me === 'broken') process.exit(1); console.log('ffmpeg version 0-stand-in'); process.exit(0); }
const input = a[a.indexOf('-i') + 1], out = a[a.length - 1];
fs.writeFileSync(path.join(dir, me + '-' + process.pid + '.json'), JSON.stringify({ args: a, pid: process.pid, input: crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex') }));
if (me === 'ok') { fs.writeFileSync(out, Buffer.from('${FF_OUT.toString('base64')}', 'base64')); process.exit(0); }
if (me === 'fail') { process.stderr.write('[in#0] Error opening input ' + input + '?token=QSECRETQ: Invalid data found when processing input\\n'); process.exit(1); }
if (me === 'empty') process.exit(0);
if (me === 'hang') setInterval(() => {}, 1000);
`;
  const ff = me => path.join(FFD, me);
  for (const me of ['ok', 'fail', 'empty', 'hang', 'broken']) { fs.writeFileSync(ff(me), STAND); fs.chmodSync(ff(me), 0o755); }
  const ffNotes = me => fs.readdirSync(FFD).filter(n => n.startsWith(me + '-') && n.endsWith('.json')).map(n => JSON.parse(fs.readFileSync(path.join(FFD, n), 'utf8')));
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  // the raw bytes of a request, in pieces (Content-Length unless chunked); the answer, or 'cut' when the socket went first
  function send(at, p, body, { headers = {}, chunked = false, method = 'POST' } = {}) {
    return new Promise(resolve => {
      const h = { ...headers };
      if (!chunked && body) h['Content-Length'] = body.length;
      const r = http.request({ host: '127.0.0.1', port: at, method, path: p, headers: h }, res => {
        const parts = [];
        res.on('data', c => parts.push(c));
        res.on('end', () => { const buf = Buffer.concat(parts); resolve({ status: res.statusCode, headers: res.headers, buf, text: buf.toString(), json: () => JSON.parse(buf.toString()) }); });
      });
      r.on('error', err => resolve({ status: 'cut', err, json: () => ({}) }));
      if (body) for (let i = 0; i < body.length; i += 65536) r.write(body.subarray(i, i + 65536));
      r.end();
    });
  }
  // everything in the uploads' folder, and whether a temporary file of an upload is left anywhere
  const tree = (d = U) => fs.readdirSync(d, { recursive: true }).map(String).sort();
  const leftovers = () => tree().filter(n => /(^|[\\/])\.upload-/.test(n));
  const startFails = (args, env = {}) => new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(HERE, 'server.mjs'), '--port', '0', '--host', '127.0.0.1', ...args], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, RELAY_ARGS: '', COLLAB_TOKEN: '', COLLAB_SCENES: '', ...env } });
    procs.push(p);
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.on('exit', code => resolve({ code, out }));
    setTimeout(() => { p.kill(); resolve({ code: 'still running', out }); }, 5000);
  });
  const UP = await start(['--scenes', U, '--ffmpeg', ff('ok'), '--max-upload', '1']);
  const NOFF = await start(['--scenes', U, '--quiet'], { PATH: NOPATH });   // (no ffmpeg on its PATH)
  const URO = await start(['--scenes', U, '--scenes-readonly', '--quiet', '--ffmpeg', ff('ok')]);
  const MB = 1 << 20, upf = (p, body, o = {}) => send(o.at || UP.port, `/api/scenes/${o.scene || 'one'}/file?path=${encodeURIComponent(p)}${o.replace ? '&replace=1' : ''}`, body, o);
  const snd = (p, body, o = {}) => send(o.at || UP.port, `/api/scenes/${o.scene || 'one'}/sound?path=${encodeURIComponent(p)}${o.replace ? '&replace=1' : ''}`, body, o);
  const at = rel => path.join(U, 'one', ...rel.split('/'));

  await step('uploads: GET /api/scenes says upload, ffmpeg and maxUpload; POST /api/scenes makes a scene (the name rule, 409, --scenes-readonly), told at once', async () => {
    const l = (await req('GET', '/api/scenes', { at: UP.port })).json();
    ok(l.save === true && l.upload === true && l.ffmpeg === true && l.maxUpload === MB, 'upload: true, ffmpeg: true (the stand-in, --ffmpeg) and maxUpload: 1 MB (--max-upload 1)');
    const n = (await req('GET', '/api/scenes', { at: NOFF.port })).json(), ro = (await req('GET', '/api/scenes', { at: URO.port })).json();
    ok(n.upload === true && n.ffmpeg === false && n.maxUpload === 512 * MB && ro.upload === false && ro.ffmpeg === false && ro.save === false,
      'no ffmpeg on the PATH: ffmpeg false, maxUpload 512 MB by default; --scenes-readonly: upload and ffmpeg false');
    ok(/Uploads \(the studio's Upload pane, at \/upload\): files up to 1 MB; long sounds made mono MP3 by ffmpeg/.test(UP.out) && /no ffmpeg found/.test(NOFF.out + await (async () => { const v = await start(['--scenes', U], { PATH: NOPATH }); v.kill(); return v.out; })()),
      'the start line says uploads, their limit and whether ffmpeg was found');
    const w = sse(UP.port, '/api/scenes/watch');
    await w.ready;
    await w.next(ev('hello'), 3000);
    const make = (b, o = {}) => send(o.at || UP.port, '/api/scenes', Buffer.from(typeof b === 'string' ? b : JSON.stringify(b)), { headers: { 'Content-Type': 'application/json' } });
    const t0 = Date.now(), m = await make({ name: 'new one' });
    ok(m.status === 201 && JSON.stringify(m.json()) === '{"ok":true,"name":"new one"}' && fs.statSync(path.join(U, 'new one')).isDirectory(), '201 { ok: true, name }, its folder made');
    ok((await req('GET', '/api/scenes', { at: UP.port })).json().scenes.map(x => x.name).join('|') === 'new one|one', 'listed');
    const told = await w.next(ev('scenes'), 3000);
    ok(told && told.at - t0 < 1500 && told.data.scenes.some(x => x.name === 'new one'), `the watch told at once (${told ? told.at - t0 : '-'} ms)`);
    await sleep(2600);
    ok(!w.events.some(e => e.event === 'scenes'), 'and not again when it looks next');
    w.close();
    const again = await make({ name: 'new one' }), top = await make({ name: 'afile' });
    ok(again.status === 409 && top.status === 409 && /scene \(or a file\)/.test(again.json().error), 'a scene of that name, or a file: 409');
    const before = tree(), bad = [];
    for (const b of [{ name: 'bad!' }, { name: '.x' }, { name: ' x' }, { name: '-x' }, { name: 'watch' }, { name: '' }, { name: 'x'.repeat(65) }, { name: 'a/b' }, { name: '..' }, { name: 'x.' }, { name: 'x ' }, { name: 'con' }, { name: 'Nul.x' }, { name: 5 }, {}, [], 'not json', 'null', '"x"']) bad.push((await make(b)).status);
    ok(bad.every(x => x === 400) && JSON.stringify(tree()) === JSON.stringify(before), 'names that cannot be a scene\'s, no name, not JSON: 400, nothing made (' + bad.join(' ') + ')');
    const big = await make({ name: 'x', pad: 'y'.repeat(20000) });
    ok(big.status === 413 && !fs.existsSync(path.join(U, 'x')), 'a body over 16 KB: 413');
    const r = await make({ name: 'never' }, { at: URO.port });
    ok(r.status === 403 && /--scenes-readonly/.test(r.json().error) && !fs.existsSync(path.join(U, 'never')), '--scenes-readonly: 403, nothing made');
    ok((await send(UP.port, '/api/scenes', null, { method: 'DELETE' })).status === 405, 'other methods: 405');
    ok(/scenes: made the scene "new one"/.test(UP.out), 'said in the log');
  });

  await step('uploads: POST /api/scenes/<name>/file: written whole where it goes (folders made), 409 unless replace=1, the paths and kinds taken, the size counted as it streams, nothing left behind', async () => {
    const A = bytes(5000), B = bytes(3000);
    const w = sse(UP.port, '/api/scenes/watch');
    await w.ready;
    await w.next(ev('hello'), 3000);
    const t0 = Date.now(), r = await upf('models/a.glb', A), a = r.json();
    ok(r.status === 200 && a.ok === true && a.path === 'models/a.glb' && a.bytes === 5000 && a.at === Math.floor(fs.statSync(at('models/a.glb')).mtimeMs) && fs.readFileSync(at('models/a.glb')).equals(A),
      '200 { ok, path, bytes, at }: the bytes as sent, its folder made');
    const told = await w.next(ev('scene', d => d.path === 'models/a.glb'), 3000);
    ok(told && told.at - t0 < 1000 && JSON.stringify(told.data) === '{"name":"one","path":"models/a.glb","kind":"model","gone":false}', `the watch told at once (${told ? told.at - t0 : '-'} ms)`);
    const one = (await req('GET', '/api/scenes/one', { at: UP.port })).json();
    ok(one.files.some(f => f.path === 'models/a.glb' && f.kind === 'model' && f.bytes === 5000) && (await req('GET', '/scenes/one/models/a.glb', { at: UP.port })).buf.equals(A), 'listed, and served');
    const again = await upf('models/a.glb', B);
    ok(again.status === 409 && /replace=1/.test(again.json().error) && fs.readFileSync(at('models/a.glb')).equals(A), 'there already: 409, unchanged');
    const rep = await upf('models/a.glb', B, { replace: true });
    ok(rep.status === 200 && rep.json().bytes === 3000 && fs.readFileSync(at('models/a.glb')).equals(B), 'replace=1: replaced');
    const changed = await w.next(ev('scene', d => d.path === 'models/a.glb'), 3000);
    ok(!!changed, 'the watch told the replacement too');
    await sleep(2600);
    ok(!w.events.some(e => e.event === 'scene' && e.data.path === 'models/a.glb'), 'and neither again when it looks next');
    w.close();
    const fine = ['originals/eva/eva_001.FBX', 'originals/eva/202009181145140.png', 'originals/a/b/c/notes.txt', 'originals/x.obj', 'originals/x.mtl', 'originals/files.json', 'sounds/a.wav', 'tex/a.PNG',
      'data.bin', 'models/b c.glb', 'a/b/c/d/deep.glb', 'models/é ü.glb'];
    const got = [];
    for (const p of fine) got.push((await upf(p, Buffer.from(p))).status);
    ok(got.every(x => x === 200) && fine.every(p => fs.readFileSync(at(p), 'utf8') === p), 'models, sounds, images and data anywhere, any file under originals/, 4 folders deep, spaces and accents: 200 (' + got.join(' ') + ')');
    const before = tree(), bad = [];
    const refused = ['', '../x.glb', 'a/../x.glb', './x.glb', '.hidden.glb', '.history/x.glb', 'a\\b.glb', 'a//b.glb', '/a.glb', 'a/', 'x.glb.tmp', 'x.glb~', 'x.part', 'layout.json', 'LAYOUT.JSON',
      'files.json', 'index.json', 'notes.txt', 'models/x.txt', 'models', 'originals', 'a:b.glb', 'a?b.glb', 'x.glb ', 'x.glb.', 'con.glb', 'a\u0001.glb', 'a\u0000.glb', 'a/b/c/d/e/f.glb',
      'originals/a/b/c/d/x.txt', 'x'.repeat(197) + '.glb'];
    for (const p of refused) bad.push((await upf(p, Buffer.from('x'))).status);
    bad.push((await send(UP.port, '/api/scenes/one/file', Buffer.from('x'))).status);
    ok(bad.every(x => x === 400) && JSON.stringify(tree()) === JSON.stringify(before), 'dot parts, .history/, backslashes, empty parts, temporary names, the scene\'s own files, other kinds outside originals/, Windows\' characters and names, too deep, too long, no path: 400, nothing written (' + bad.join(' ') + ')');
    ok(/start with a dot/.test((await upf('.history/x.glb', Buffer.from('x'))).json().error) && /outside originals\//.test((await upf('notes.txt', Buffer.from('x'))).json().error), 'each says why');
    // a folder in the scene that is a link out of it: refused before anything is made outside
    fs.symlinkSync(OUT, at('out'));
    const o1 = await upf('out/x.glb', Buffer.from('x')), o2 = await upf('out/new/x.glb', Buffer.from('x'));
    ok(o1.status === 400 && o2.status === 400 && /leads out of the scene/.test(o1.json().error) && !fs.existsSync(path.join(OUT, 'x.glb')) && !fs.existsSync(path.join(OUT, 'new')), 'through a link out of the scene: 400, nothing made outside');
    fs.rmSync(at('out'));
    fs.mkdirSync(at('tex/dir.png'));
    ok((await upf('tex/dir.png', Buffer.from('x'), { replace: true })).status === 409 && fs.statSync(at('tex/dir.png')).isDirectory(), 'a folder of that name: 409, even with replace=1');
    ok((await upf('models/a.glb/x.glb', Buffer.from('x'))).status === 409 && (await upf('models/a.glb/y/x.glb', Buffer.from('x'))).status === 409 && fs.statSync(at('models/a.glb')).isFile(),
      'a file where a folder of the path should be: 409');
    const nf = [await upf('a.glb', Buffer.from('x'), { scene: 'nope' }), await upf('a.glb', Buffer.from('x'), { scene: 'bad!' }), await upf('a.glb', Buffer.from('x'), { scene: 'watch' }), await upf('a.glb', Buffer.from('x'), { scene: '%2e%2e' })];
    ok(nf.every(x => x.status === 404), 'no such scene: 404 (' + nf.map(x => x.status).join(' ') + ')');
    ok((await req('GET', '/api/scenes/one/file?path=a.glb', { at: UP.port })).status === 405 && (await req('PUT', '/api/scenes/one/sound?path=a.mp3', { at: UP.port })).status === 405, 'other methods: 405');
    // the size: up to --max-upload exactly; past it 413, by Content-Length at once or counted as it streams in, the body read
    // to its end (so the answer arrives), nothing left behind, nor the folders made for it
    const exact = await upf('big/exact.bin', bytes(MB));
    ok(exact.status === 200 && fs.statSync(at('big/exact.bin')).size === MB, 'exactly 1 MB: 200');
    const b1 = await upf('big2/x.bin', bytes(MB + 1)), b2 = await upf('big3/x/y.bin', bytes(3 * MB), { chunked: true });
    ok(b1.status === 413 && b2.status === 413 && /at most 1 MB/.test(b2.json().error) && !fs.existsSync(at('big2')) && !fs.existsSync(at('big3')) && !leftovers().length,
      `past 1 MB: 413 by its Content-Length (${b1.status}) and counted while it streams (${b2.status}); no temporary file, no folder made for it`);
    const b3 = await upf('big/x.bin', bytes(3 * MB), { chunked: true });
    ok(b3.status === 413 && fs.statSync(at('big')).isDirectory() && !fs.existsSync(at('big/x.bin')) && !leftovers().length, 'a folder that was there stays');
    // a page that goes in the middle: nothing left
    const s = net.connect(UP.port, '127.0.0.1');
    await new Promise(r => s.once('connect', r));
    s.write(`POST /api/scenes/one/file?path=cut%2Fx.glb HTTP/1.1\r\nHost: x\r\nContent-Length: 100000\r\n\r\n`);
    s.write(bytes(30000));
    await sleep(300);
    const mid = leftovers().length;
    s.destroy();
    await sleep(400);
    ok(mid === 1 && !leftovers().length && !fs.existsSync(at('cut')), `cut short: its temporary file (${mid} while it came) and folder gone`);
    ok(/scenes: one: an upload of cut\/x\.glb was cut short \(30000 bytes came\)/.test(UP.out), 'said in the log');
    const [x1, x2] = await Promise.all([upf('race.glb', bytes(200000)), upf('race.glb', bytes(200000))]);
    ok([x1.status, x2.status].sort().join() === '200,409' && fs.statSync(at('race.glb')).size === 200000 && !leftovers().length, `two at once to one new name: one 200, one 409 (${x1.status} ${x2.status})`);
    ok(/scenes: one: wrote models\/a\.glb \(5\.0 kB/.test(UP.out) && /wrote models\/a\.glb \(3\.0 kB in [\d.]+ s\), replacing it/.test(UP.out), 'said in the log');
    // another origin (GitHub Pages with &relay=): its preflight, and the answer's CORS
    const pre = await req('OPTIONS', '/api/scenes/one/file?path=x.glb', { at: UP.port, headers: { Origin: 'https://x.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } });
    const pre2 = await req('OPTIONS', '/api/scenes', { at: UP.port, headers: { Origin: 'https://x.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    const cr = await upf('cors.glb', Buffer.from('x'), { headers: { Origin: 'https://x.github.io', Authorization: 'Bearer none', 'Content-Type': 'application/octet-stream' } });
    ok(pre.status === 204 && /POST/.test(pre.headers['access-control-allow-methods']) && /Authorization/.test(pre.headers['access-control-allow-headers']) && /Content-Type/.test(pre.headers['access-control-allow-headers']) &&
      pre2.status === 204 && cr.status === 200 && cr.headers['access-control-allow-origin'] === '*', 'a preflight from another origin allows POST, Authorization and Content-Type; the answer carries CORS');
    const ro = await upf('ro.glb', Buffer.from('x'), { at: URO.port });
    ok(ro.status === 403 && /--scenes-readonly/.test(ro.json().error) && !fs.existsSync(at('ro.glb')), '--scenes-readonly: 403, nothing written');
  });

  await step('uploads: POST /api/scenes/<name>/sound: ffmpeg (a stand-in) makes a mono MP3 at 96 kbit/s and 44.1 kHz; its failures, its limit, two at once, none at all', async () => {
    const W = bytes(40000), r = await snd('sounds/a.mp3', W), a = r.json();
    const note = ffNotes('ok').pop() || { args: [] }, args = note.args, input = args[args.indexOf('-i') + 1], out = args[args.length - 1];
    ok(r.status === 200 && a.ok === true && a.path === 'sounds/a.mp3' && a.bytes === FF_OUT.length && fs.readFileSync(at('sounds/a.mp3')).equals(FF_OUT), '200 { ok, path, bytes, at }: what ffmpeg wrote, in place');
    const has = (...x) => x.every(v => args.includes(v));
    ok(has('-nostdin', '-i') && args.join(' ').includes('-ac 1') && args.join(' ').includes('-ar 44100') && args.join(' ').includes('-b:a 96k') && args.join(' ').includes('-c:a libmp3lame'),
      'run with -nostdin, mono, 44.1 kHz, 96 kbit/s: ' + args.filter(x => !x.includes('/')).join(' '));
    ok(note.input === sha(W) && !fs.existsSync(input) && !fs.existsSync(path.dirname(input)) && path.dirname(out) === at('sounds') && /^\.upload-.*\.tmp$/.test(path.basename(out)) && !leftovers().length,
      'its input the bytes sent, in a temporary file of its own (gone after); its output a temporary dot file beside where it goes, renamed into place');
    ok((await snd('sounds/a.wav', W)).status === 400 && (await snd('notes.mp3.txt', W)).status === 400 && (await snd('../a.mp3', W)).status === 400, 'a path that is not an MP3\'s, or not a scene\'s: 400');
    ok((await snd('sounds/a.mp3', W)).status === 409 && (await snd('sounds/a.mp3', W, { replace: true })).status === 200, 'there already: 409; replace=1: 200');
    const big = await snd('sounds/big.mp3', bytes(MB + 1));
    ok(big.status === 413 && !fs.existsSync(at('sounds/big.mp3')) && !leftovers().length, 'past --max-upload: 413');
    ok(/scenes: one: wrote sounds\/a\.mp3 \(64 B|scenes: one: wrote sounds\/a\.mp3 \(0\.1 kB in [\d.]+ s\) as a mono MP3 \(40\.0 kB given, ffmpeg [\d.]+ s\)/.test(UP.out), 'said in the log');
    // ffmpeg fails: 422, its words never sent, logged shortly without the temporary paths or a query
    const F = await start(['--scenes', U, '--ffmpeg', ff('fail')]);
    const f = await snd('sounds/f.mp3', W, { at: F.port });
    await sleep(100);
    ok(f.status === 422 && /could not make an MP3/.test(f.json().error) && !/Invalid data|QSECRETQ|token/.test(f.text) && !fs.existsSync(at('sounds/f.mp3')) && !leftovers().length, 'ffmpeg exits 1: 422 in our words, nothing written');
    ok(/no MP3 for sounds\/f\.mp3 \(ffmpeg exit 1: \[in#0\] Error opening input …\?… Invalid data found/.test(F.out) && !F.out.includes('QSECRETQ') && !/relay-sound-/.test(F.out), 'logged shortly: its last line, no temporary path, no query');
    F.kill();
    const E = await start(['--scenes', U, '--ffmpeg', ff('empty'), '--quiet']);
    const e = await snd('sounds/e.mp3', W, { at: E.port });
    ok(e.status === 422 && /made nothing/.test(e.json().error) && !fs.existsSync(at('sounds/e.mp3')) && !leftovers().length, 'an empty MP3: 422');
    E.kill();
    // one that never ends: stopped after --ffmpeg-limit (1 s here); at most two at once, a third 429 with Retry-After
    const H = await start(['--scenes', U, '--ffmpeg', ff('hang'), '--ffmpeg-limit', '1', '--quiet']);
    const t0 = Date.now(), two = [snd('sounds/h1.mp3', W, { at: H.port }), snd('sounds/h2.mp3', W, { at: H.port })];
    await sleep(300);
    const third = await snd('sounds/h3.mp3', W, { at: H.port, headers: { Origin: 'https://x.github.io' } });
    ok(third.status === 429 && third.headers['retry-after'] === '5' && third.json().retry === 5 && /Retry-After/.test(third.headers['access-control-expose-headers'] || ''), 'a third at once: 429, Retry-After (exposed to another origin) and retry in the body');
    const [h1, h2] = await Promise.all(two), took = Date.now() - t0;
    const pids = ffNotes('hang').map(n => n.pid), alive = pids.filter(p => { try { process.kill(p, 0); return true; } catch { return false; } });
    ok(h1.status === 500 && h2.status === 500 && /more than 1 s/.test(h1.json().error) && took >= 1000 && took < 4000, `past the limit: 500 (${took} ms)`);
    ok(pids.length === 2 && !alive.length && !leftovers().length && !fs.existsSync(at('sounds/h1.mp3')), 'both ffmpegs stopped, nothing left behind');
    ok((await snd('sounds/h4.mp3', W, { at: H.port })).status === 500, 'room again once they are done');
    H.kill();
    // none: 501 (no ffmpeg on the PATH, --no-ffmpeg); files still taken; --scenes-readonly 403
    const N2 = await start(['--scenes', U, '--no-ffmpeg', '--quiet']);
    const n1 = await snd('sounds/n.mp3', W, { at: NOFF.port }), n2 = await snd('sounds/n.mp3', W, { at: N2.port });
    ok(n1.status === 501 && /no ffmpeg/.test(n1.json().error) && n2.status === 501 && (await req('GET', '/api/scenes', { at: N2.port })).json().ffmpeg === false, 'no ffmpeg (none on the PATH, --no-ffmpeg): 501');
    ok((await upf('sounds/n.wav', W, { at: NOFF.port })).status === 200, 'files are still taken there');
    N2.kill();
    ok((await snd('sounds/r.mp3', W, { at: URO.port })).status === 403, '--scenes-readonly: 403');
    // the options refused at the start
    const fails = await Promise.all([startFails(['--scenes', U, '--ffmpeg', ff('broken')]), startFails(['--scenes', U, '--ffmpeg', path.join(FFD, 'nope')]), startFails(['--ffmpeg', ff('ok')]),
      startFails(['--scenes', U, '--ffmpeg', ff('ok'), '--no-ffmpeg']), startFails(['--scenes', U, '--max-upload', '0']), startFails(['--scenes', U, '--ffmpeg-limit', '0']), startFails(['--app', 'ftp://x.example/'])]);
    ok(fails.every(x => x.code === 1 && !/listening/.test(x.out)) && /does not run as ffmpeg/.test(fails[0].out) && /does not run as ffmpeg/.test(fails[1].out) && /--ffmpeg goes with --scenes/.test(fails[2].out) &&
      /one or the other/.test(fails[3].out) && /--max-upload takes/.test(fails[4].out) && /--ffmpeg-limit takes/.test(fails[5].out) && /--app takes/.test(fails[6].out),
      'refused at the start, saying why: a named ffmpeg that does not run, --ffmpeg without --scenes or with --no-ffmpeg, --max-upload 0, --ffmpeg-limit 0, --app not http(s)');
  });

  await step('uploads: a real ffmpeg makes a generated stereo 48 kHz WAV a mono MP3 at 96 kbit/s and 44.1 kHz', async () => {
    let real = false;
    try { real = /ffmpeg version/.test(execFileSync('ffmpeg', ['-hide_banner', '-version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { /* none here */ }
    if (!real) return console.log('  (no ffmpeg on this machine: skipped)');
    const RF = await start(['--scenes', U, '--quiet']);
    ok((await req('GET', '/api/scenes', { at: RF.port })).json().ffmpeg === true, 'found on the PATH');
    const n = 72000, data = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) { data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / 48000) * 12000), i * 4); data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 660 * i / 48000) * 12000), i * 4 + 2); }
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
    h.writeUInt32LE(48000, 24); h.writeUInt32LE(48000 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    const r = await snd('sounds/real.mp3', Buffer.concat([h, data]), { at: RF.port });
    const mp3 = fs.existsSync(at('sounds/real.mp3')) ? fs.readFileSync(at('sounds/real.mp3')) : Buffer.alloc(0);
    // its MPEG frames, read by hand (after an ID3v2 tag): version 1, layer III, bit rate, sample rate, channel mode
    let i = mp3.subarray(0, 3).toString() === 'ID3' ? 10 + (((mp3[6] & 127) << 21) | ((mp3[7] & 127) << 14) | ((mp3[8] & 127) << 7) | (mp3[9] & 127)) : 0;
    const BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], SR = [44100, 48000, 32000], frames = [];
    while (i + 4 <= mp3.length && mp3[i] === 0xff && (mp3[i + 1] & 0xe0) === 0xe0) {
      const ver = (mp3[i + 1] >> 3) & 3, layer = (mp3[i + 1] >> 1) & 3, br = BR[mp3[i + 2] >> 4], sr = SR[(mp3[i + 2] >> 2) & 3];
      if (ver !== 3 || layer !== 1 || !br || !sr) break;
      frames.push({ br, sr, mono: mp3[i + 3] >> 6 === 3 });
      i += Math.floor((144000 * br) / sr) + ((mp3[i + 2] >> 1) & 1);
    }
    ok(r.status === 200 && r.json().bytes === mp3.length && frames.length >= 55 && frames.every(f => f.br === 96 && f.sr === 44100 && f.mono),
      `200, an MP3 of ${frames.length} frames (1.5 s), each MPEG-1 layer III, 96 kbit/s, 44.1 kHz, mono (${mp3.length} bytes)`);
    RF.kill();
  });

  await step('uploads: GET /upload redirects to the studio\'s Upload pane (the relay\'s own app, else --app with this relay\'s wss:// address); no password asked, the query never passed on', async () => {
    const loc = async (at, p = '/upload', headers = {}) => { const r = await req('GET', p, { at, headers }); return r.status === 302 ? r.headers.location : 'status ' + r.status; };
    ok(await loc(port) === '/#studio&upload' && await loc(port, '/upload/') === '/#studio&upload' && await loc(port, '/upload?token=QSECRETQ') === '/#studio&upload', 'serving the app (--static): /#studio&upload (also /upload/; a query dropped)');
    const enc = s => encodeURIComponent(s);
    ok(await loc(UP.port) === `https://stories.lbi-netmed.com/#studio&upload&relay=${enc('ws://127.0.0.1:' + UP.port)}`, 'not serving it: the app\'s public address, with ws://<Host>');
    ok(await loc(UP.port, '/upload', { Host: 'relay.example.org', 'X-Forwarded-Proto': 'https' }) === `https://stories.lbi-netmed.com/#studio&upload&relay=${enc('ws://relay.example.org')}`, 'without --proxy X-Forwarded-Proto is ignored');
    const P = await start(['--scenes', U, '--quiet', '--proxy', '--app', 'https://x.github.io/app'], { COLLAB_TOKEN: 'uploadpass' + crypto.randomBytes(4).toString('hex') });
    ok(await loc(P.port, '/upload?token=QSECRETQ', { Host: 'Relay.Example.org', 'X-Forwarded-Proto': 'https' }) === `https://x.github.io/app/#studio&upload&relay=${enc('wss://relay.example.org')}`,
      '--app (a folder: /), behind --proxy its X-Forwarded-Proto https: wss://; with a password, none asked; the query dropped');
    ok(await loc(P.port, '/upload', { Host: 'relay.example.org:8787', 'X-Forwarded-Proto': 'http' }) === `https://x.github.io/app/#studio&upload&relay=${enc('ws://relay.example.org:8787')}`, 'X-Forwarded-Proto http: ws://');
    P.kill();
    const P2 = await start(['--scenes', U, '--quiet', '--proxy', '2', '--origin', 'https://a.example', '--app', 'https://b.example/index.html']);
    ok(await loc(P2.port, '/upload', { Host: 'r.example', 'X-Forwarded-Proto': 'https, http' }) === `https://b.example/index.html#studio&upload&relay=${enc('wss://r.example')}`, '--proxy 2: the second from the right; --app a page kept as it is');
    P2.kill();
    const P3 = await start(['--quiet', '--origin', 'https://a.example']);
    ok((await loc(P3.port)).startsWith('https://a.example/#studio&upload&relay='), 'no --app: the --origin\'s address');
    P3.kill();
    const bad = [await loc(UP.port, '/upload', { Host: 'evil.example/x' }), await loc(UP.port, '/upload', { Host: 'a b' })];
    ok(bad.every(x => x === 'status 400') && (await req('POST', '/upload', { at: UP.port })).status === 405, 'a Host that is not one: 400; POST: 405');
  });

  NOFF.kill(); URO.kill();
  fs.rmSync(SC, { recursive: true, force: true });

  await step('the log has a line per write and per refusal', async () => {
    ok(new RegExp(`${R} set #1 by a1: st\\.s1 st\\.s1\\.play`).test(relay.out), 'a write');
    ok(new RegExp(`${R} refused a1 \\(roomFrameShared: null outside the deletable families\\)`).test(relay.out), 'a refusal');
    ok(/set #\d+ by b1: st\.s1\.play=null st\.s1\.x=null st\.s1/.test(relay.out), 'the epoch deletions');
  });
  A.ws.close(); B.ws.close();
} finally {
  await Promise.all(procs.filter(p => p.exitCode === null).map(p => new Promise(r => { p.on('exit', r); p.kill(); })));
}
console.log(`\n${passed} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
