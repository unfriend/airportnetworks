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
async function start(args) {
  const p = spawn(process.execPath, [path.join(HERE, 'server.mjs'), '--port', '0', '--host', '127.0.0.1', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
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

// ---- a WebSocket client (Node's own, as a browser would)
const client = (room, id, extra = '') => socket(`ws://127.0.0.1:${port}/api/ws?room=${room}&id=${id}${extra}`);
function socket(url) {
  const ws = new WebSocket(url);
  const c = { ws, q: [], closed: null };
  c.opened = new Promise(r => { ws.onopen = r; ws.onerror = r; });
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
async function raw(pathAndQuery, { version = '13', at = port } = {}) {
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
  s.write(`GET ${pathAndQuery} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: ${version}\r\n\r\n`);
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
    const data = fs.readdirSync(path.join(REPO, 'ikerdata')).find(f => !f.startsWith('.'));
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

  await step('--no-peer: no introduction server', async () => {
    const N = await start(['--no-peer', '--quiet']);
    ok((await req('GET', '/peerjs/peerjs/id', { at: N.port })).status === 404, 'no ids');
    const w = await raw(peerQuery('n1', 'tok'), { at: N.port });
    await sleep(200);
    ok(/^HTTP\/1.1 404/.test(w.head) && !/Introduction server/.test(N.out) && /Introduction server for peer to peer/.test(relay.out), 'no socket either (on by default)');
    N.kill();
  });

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
