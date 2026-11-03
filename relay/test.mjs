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
  const p = spawn(process.execPath, [path.join(HERE, 'server.mjs'), '--port', '0', '--host', '127.0.0.1', ...args], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, RELAY_LOG_TOKEN: '', RELAY_ARGS: '', ...env } });
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
    // unknown room codes count too (a socket's and a lookup's), with the right password
    const Y = ip();
    s = [];
    for (const x of unknownCodes(10)) s.push((await get('/api/rooms/' + x, { ip: Y, headers: bearer() })).status);
    for (const x of unknownCodes(20).slice(10)) { const u = wsAt(T, `/api/ws?room=${x}&id=pw6&token=${PASS}`, { 'X-Forwarded-For': Y }); s.push((await first(u)).code); }
    ok(s.slice(0, 10).every(x => x === 404) && s.slice(10).every(x => x === 'room') && (await get('/api/rooms/' + code, { ip: Y, headers: bearer() })).status === 429,
      'unknown room codes (10 lookups, 10 sockets) count: then 429');
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
