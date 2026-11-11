// Test of the relay: node relay/test.mjs (--trackers: only the Vive trackers' steps; --rooms: only the rooms' versions, the
// reload order and --keep, v136)
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
import { createRequire } from 'node:module';

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

// ---- the PC's Vive trackers (--trackers; relay/trackers.mjs, tools/trackers/SPEC.md): the bridge's datagrams faked by
// tools/trackers/fake.mjs (SteamVR's space turned and moved against the room by a known transform, so each pose's truth in
// room coordinates is known). `node relay/test.mjs --trackers` runs only these (seconds)
async function trackerSteps() {
  const { startFake, qAngle } = await import('../tools/trackers/fake.mjs');
  const { frameOf, toRoom, quatToRoom, TRK_FLOOR } = await import('./trackers.mjs');
  const udpOf = p => +((/Trackers: the bridge's readings on UDP 127\.0\.0\.1:(\d+)/.exec(p.out) || [])[1] || 0);
  const isTrk = m => m.t === 'fx' && m.k === '@trk';
  // a member of a room on relay `at`, keeping each @trk with the time it came
  async function member(at, room, id, extra = '') {
    const ws = new WebSocket(`ws://127.0.0.1:${at}/api/ws?room=${room}&id=${id}${extra}`), c = { ws, got: [], other: [] };
    ws.onmessage = e => { const m = JSON.parse(e.data); if (isTrk(m)) c.got.push({ m, rt: Date.now() }); else c.other.push(m); };
    await new Promise(r => { ws.onopen = r; ws.onerror = r; });
    for (let i = 0; i < 100 && !c.other.some(m => m.t === 'welcome'); i++) await sleep(10);
    c.set = (k, v) => ws.send(JSON.stringify({ t: 'set', batch: [[k, v]], cid: k }));
    c.window = async ms => { c.got.length = 0; await sleep(ms); return c.got.slice(); };
    return c;
  }
  const roomAt = async at => (await req('POST', '/api/rooms', { body: { app: 'networks', version: 'v1' }, at })).json().code;
  const SERIALS = ['LHR-FA4E0A01', 'LHR-FA4E0B02', 'LHR-FA4E0C03', 'LHR-FA4E0D04', 'LHR-FA4E0E05', 'LHR-FA4EF0D0', 'LHR-FA4EC0L1', 'LHR-FA4EC0R2'];
  const BASES = ['LHB-FA4EBA01', 'LHB-FA4EBA02'];

  await step('trackers: nothing without --trackers (no field in /api/ping, /api/trackers 404, no @trk for a room that asks)', async () => {
    const p = (await req('GET', '/api/ping')).json();
    ok(!('trackers' in p) && !('trackersSeen' in p), '/api/ping says nothing of trackers');
    ok((await req('GET', '/api/trackers')).status === 404 && (await req('GET', '/api/trackers/still?id=LHR-FA4E0A01')).status === 404, '/api/trackers and its still: 404');
    const code = await roomAt(port), c = await member(port, code, 'n1');
    c.set('trk', { on: true, m: { a: [0, 0, 0], b: [2, 0, 0] }, names: {}, by: 'n1', at: Date.now() });
    ok((await c.window(500)).length === 0 && !/Trackers:/.test(relay.out), 'no @trk to a room that uses trackers, no start line');
    c.ws.close();
  });

  // a relay with --trackers 0 (a free port, said in its start line) and the fake bridge sending to it: SteamVR's space is
  // the room turned 37 degrees about y and moved by (2.4, 0.012, -1.1) m
  const T = await start(['--trackers', '0', '--ping', '0.2', '--timeout', '5']), udp = udpOf(T);
  const F = startFake({ port: udp, turn: 37 * Math.PI / 180, move: [2.4, 0.012, -1.1] });
  let spotA = null, spotB = null;
  try {
    await step('trackers (--trackers): the bridge\'s datagrams on UDP 127.0.0.1; /api/ping says so; GET /api/trackers lists them raw in SteamVR\'s space', async () => {
      ok(udp > 0 && T.out.indexOf('Trackers:') < T.out.indexOf('listening on'), 'the start line says the UDP port (before the relay listens)');
      let L = [];
      for (let i = 0; i < 100 && L.length < 10; i++) { await sleep(20); L = (await req('GET', '/api/trackers', { at: T.port })).json().trackers; }
      const p = (await req('GET', '/api/ping', { at: T.port })).json();
      ok(p.trackers === true && p.trackersSeen === 5, `/api/ping: trackers true, trackersSeen 5 (${p.trackersSeen})`);
      ok(L.length === 10 && L.map(d => d.k).join() === 'trk,trk,trk,trk,trk,hmd,ctl,ctl,base,base', 'every device listed, trackers first, then the headset, its controllers, base stations: ' + L.map(d => d.k).join());
      const by = Object.fromEntries(L.map(d => [d.id, d]));
      ok(by['LHR-FA4EC0L1']?.h === 'l' && by['LHR-FA4EC0R2']?.h === 'r' && !('h' in by['LHR-FA4E0A01']), 'controllers with their hand, nothing else');
      ok(by['LHR-FA4E0A01'].b === 0.9 && by['LHR-FA4EF0D0'].b === null, 'batteries (0..1, null where there is none)');
      ok(L.every(d => d.ok === true && d.age >= 0 && d.age < 300 && d.p.length === 3 && Math.abs(Math.hypot(...d.q) - 1) < 1e-3), 'ok, ages under 0.3 s, turns of length 1');
      const a = F.raw([0, TRK_FLOOR, 0]), t = F.raw([1.5, 0.75, -0.5]);
      ok(Math.hypot(...by['LHR-FA4E0A01'].p.map((x, i) => x - a[i])) < 1e-4 && Math.hypot(...by['LHR-FA4E0E05'].p.map((x, i) => x - t[i])) < 1e-4, 'raw positions as SteamVR has them (the room turned and moved), within 0.1 mm');
      ok(qAngle(by['LHR-FA4E0E05'].q, F.rawQ([0, Math.sin(Math.PI / 12), 0, Math.cos(Math.PI / 12)])) < 0.02, 'raw turns as SteamVR has them');
    });

    await step('trackers: GET /api/trackers/still: a tracker lying still, its mean; one that moves, one not seen, one nudged 2 cm meanwhile, one losing tracking refused in words; bad asks 400', async () => {
      const still = async (id, ms = 500) => (await req('GET', `/api/trackers/still?id=${encodeURIComponent(id)}&ms=${ms}`, { at: T.port })).json();
      const t0 = Date.now(), A = await still('LHR-FA4E0A01'), dt = Date.now() - t0;
      ok(A.ok === true && dt >= 490 && dt < 1500 && A.n >= 30 && A.n <= 60 && A.spread <= 0.1, `lying on spot A: ok, about 45 readings in 0.5 s (${A.n}, ${dt} ms), spread ${A.spread} mm`);
      ok(Math.hypot(...A.p.map((x, i) => x - F.spots.a[i])) < 1e-4, 'its mean where the tracker on spot A is in SteamVR\'s space (0.1 mm)');
      const B = await still('LHR-FA4E0B02');
      ok(B.ok && Math.hypot(...B.p.map((x, i) => x - F.spots.b[i])) < 1e-4, 'spot B too');
      spotA = A.p; spotB = B.p;
      const C = await still('LHR-FA4E0C03', 300);
      ok(C.ok === false && /moved \d+ mm/.test(C.error) && C.spread > 5, 'one going round a circle: refused, it moved: ' + C.error);
      const N = await still('LHR-NOTHERE1', 300);
      ok(N.ok === false && /not seen/.test(N.error), 'one never seen: refused at once: ' + N.error);
      const E = 'LHR-FA4E0E05', e0 = F.devices.find(d => d.s === E).pose;
      const ask = still(E, 600);
      await sleep(250);
      F.set(E, () => ({ ...e0(0), p: [1.52, 0.75, -0.5] }));
      const Em = await ask;
      F.set(E, e0);
      ok(Em.ok === false && /moved/.test(Em.error) && Em.spread >= 9, `nudged 2 cm meanwhile: refused (${Em.spread} mm)`);
      const askL = still('LHR-FA4E0A01', 500);
      await sleep(150); F.lost('LHR-FA4E0A01', true); await sleep(100); F.lost('LHR-FA4E0A01', false);
      const Lo = await askL;
      ok(Lo.ok === false && /lost tracking/.test(Lo.error), 'losing tracking meanwhile: refused: ' + Lo.error);
      const bad = await Promise.all(['/api/trackers/still', '/api/trackers/still?id=has%20space', '/api/trackers/still?id=LHR-FA4E0A01&ms=50', '/api/trackers/still?id=LHR-FA4E0A01&ms=9000'].map(u => req('GET', u, { at: T.port })));
      ok(bad.every(r => r.status === 400), 'no id, a bad id, ms under 200 or over 5000: 400');
      ok((await req('POST', '/api/trackers', { at: T.port, body: {} })).status === 405 && (await req('OPTIONS', '/api/trackers', { at: T.port, headers: { Origin: 'https://x.example', 'Access-Control-Request-Method': 'GET' } })).status === 204, 'POST 405; a preflight answered');
    });

    await step('trackers: the room\'s frame from m is a headset\'s from its floor spots (shared.js\'s own fromMarks, floorUnder and basis, run here with three.js): points, turns, handedness', async () => {
      // shared.js's code itself, not a copy: a frame from floor spots (FLOOR_TIP as TRK_FLOOR), and the matrix that turns
      // local-floor (here SteamVR's space) into room coordinates as R.mi does (R.lf the identity)
      const src = fs.readFileSync(path.join(REPO, 'shared.js'), 'utf8');
      const grab = re => { const m = re.exec(src); if (!m) throw new Error('shared.js has no ' + re); return m[0]; };
      const code = [grab(/const level = x => \{[^\n]*\};/), grab(/const floorUnder = \(a, b\) => \{[\s\S]*?\n {2}\};/), grab(/const fromMarks = [^\n]*;/), grab(/function basis\(fr, out\) \{[\s\S]*?\n {2}\}/)].join('\n');
      const THREE = createRequire(import.meta.url)(path.join(REPO, 'three.min.js'));
      const S = new Function('THREE', 'FLOOR_TIP', 'const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), onFloor = () => true, val = () => null, SAME = 0.1;\n' + code + '\nreturn { fromMarks, basis };')(THREE, TRK_FLOOR);
      let dp = 0, dq = 0, n = 0;
      const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
      for (let i = 0; i < 300; i++) {
        const a = [rnd(-5, 5), rnd(-0.1, 0.1), rnd(-5, 5)], ang = rnd(-Math.PI, Math.PI), d = rnd(0.5, 6);
        const b = [a[0] + d * Math.cos(ang), a[1] + rnd(-0.04, 0.04), a[2] + d * Math.sin(ang)];
        const Mi = S.basis(S.fromMarks(a, b), new THREE.Matrix4()).invert(), F2 = frameOf({ a, b });
        const R = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(Mi));
        for (let j = 0; j < 5; j++) {
          const p = [rnd(-8, 8), rnd(-1, 3), rnd(-8, 8)], q = new THREE.Quaternion(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
          const want = new THREE.Vector3(...p).applyMatrix4(Mi), got = toRoom(F2, p);
          dp = Math.max(dp, Math.hypot(want.x - got[0], want.y - got[1], want.z - got[2]));
          const wq = R.clone().multiply(q), gq = quatToRoom(F2, [q.x, q.y, q.z, q.w]);
          dq = Math.max(dq, qAngle([wq.x, wq.y, wq.z, wq.w], gq)); n++;
        }
      }
      ok(dp < 1e-9 && dq < 1e-5, `${n} points and turns as shared.js turns a headset's into room coordinates: within ${dp.toExponential(1)} m and ${dq.toExponential(1)} degrees`);
      const F1 = frameOf({ a: [1, 0.3, 1], b: [3, 0.31, 1] }), o = toRoom(F1, [1, 0.3 + TRK_FLOOR, 1]), x = toRoom(F1, [3, 0.31, 1]), z = toRoom(F1, [1, 0.3, 2]);
      ok(Math.hypot(...o) < 1e-12 && Math.abs(x[0] - 2) < 1e-12 && Math.abs(x[2]) < 1e-12 && Math.abs(z[2] - 1) < 1e-12, 'spot A is the origin (its floor), x runs to spot B, z = x cross y (right-handed, as WebXR and SteamVR)');
      ok(frameOf({ a: [0, 0, 0], b: [0.05, 0, 0.05] }) === null && frameOf({ a: [0, 0, 0], b: [0, 1, 0] }) === null && frameOf({ a: [0, 0, 'x'], b: [1, 0, 0] }) === null && frameOf(null) === null && frameOf({ a: [0, 0, 0] }) === null,
        'no frame from points under 10 cm apart along the floor, one above the other, or not points');
    });

    await step('trackers: the room\'s frame from an area\'s crosses (v131: m.k with that area\'s floor points ra and rb) is a headset\'s calibration on that area (shared.js\'s own fitFrame), and the room\'s truth', async () => {
      const src = fs.readFileSync(path.join(REPO, 'shared.js'), 'utf8');
      const grab = re => { const m = re.exec(src); if (!m) throw new Error('shared.js has no ' + re); return m[0]; };
      const code = [grab(/const level = x => \{[^\n]*\};/), grab(/const yawOfX = [^\n]*;/), grab(/const floorUnder = \(a, b\) => \{[\s\S]*?\n {2}\};/), grab(/const fromMarks = [^\n]*;/),
        grab(/function fitFrame\(a, b, S\) \{[\s\S]*?\n {2}\}/), grab(/function basis\(fr, out\) \{[\s\S]*?\n {2}\}/)].join('\n');
      const THREE = createRequire(import.meta.url)(path.join(REPO, 'three.min.js')), TIP = 0.02;   // (shared.js's FLOOR_TIP: a headset's touch over the floor)
      const S = new Function('THREE', 'FLOOR_TIP', 'const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), onFloor = () => true, val = () => null, SAME = 0.1;\n' + code + '\nreturn { fitFrame, basis };')(THREE, TIP);
      let dT = 0, dH = 0, n = 0;
      const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
      for (let i = 0; i < 200; i++) {
        // the room in SteamVR's space (its truth), and an area's two crosses on a floor a step above or below the room's
        const W = new THREE.Matrix4().compose(new THREE.Vector3(rnd(-4, 4), rnd(-0.05, 0.05), rnd(-4, 4)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(-Math.PI, Math.PI)), new THREE.Vector3(1, 1, 1));
        const step = rnd(-0.2, 0.2), ra = [rnd(-15, 15), step, rnd(-15, 15)], ang = rnd(-Math.PI, Math.PI), d = rnd(0.6, 4), rb = [ra[0] + d * Math.cos(ang), step + rnd(-0.03, 0.03), ra[2] + d * Math.sin(ang)];
        const at = (p, up) => new THREE.Vector3(p[0], p[1] + up, p[2]).applyMatrix4(W).toArray();
        const F = frameOf({ a: at(ra, TRK_FLOOR), b: at(rb, TRK_FLOOR), k: 'lab0001', ra, rb });
        const H = S.basis(S.fitFrame(at(ra, TIP), at(rb, TIP), { pair: 'lab0001', ra: [ra[0], ra[1] + TIP, ra[2]], rb: [rb[0], rb[1] + TIP, rb[2]] }), new THREE.Matrix4()).invert(), Wi = W.clone().invert();
        for (let j = 0; j < 5; j++) {
          const p = [rnd(-8, 8), rnd(-1, 3), rnd(-8, 8)], truth = new THREE.Vector3(...p).applyMatrix4(Wi), got = toRoom(F, p), hs = new THREE.Vector3(...p).applyMatrix4(H);
          dT = Math.max(dT, Math.hypot(truth.x - got[0], truth.y - got[1], truth.z - got[2])); dH = Math.max(dH, hs.distanceTo(new THREE.Vector3(...got))); n++;
        }
      }
      ok(dT < 1e-6 && dH < 1e-6, `${n} points: the trackers' frame from an area's crosses within ${dT.toExponential(1)} m of the room's truth, and of a headset's calibration on that area within ${dH.toExponential(1)} m`);
      ok(frameOf({ a: [0, 0, 0], b: [2, 0, 0], k: 'lab0001', ra: [5, 0, 5], rb: [5.05, 0, 5] }) === null && !!frameOf({ a: [0, 0, 0], b: [2, 0, 0], k: 'lab0001', ra: [5, 0, 5] }),
        'an area\'s points under 10 cm apart: no frame; an area with no second point: spots A and B\'s rule');
    });

    await step('trackers: a room lined up by hand (trk with on and m, a room key) gets @trk about 60 times a second, every pose within 1 mm and 0.05 degrees of the truth; only such rooms', async () => {
      const P = await roomAt(T.port), a1 = await member(T.port, P, 'a1'), b1 = await member(T.port, P, 'b1');
      const Q = await roomAt(T.port), q1 = await member(T.port, Q, 'q1');        // no trk
      const N = await roomAt(T.port), n1 = await member(T.port, N, 'n1');        // on, not lined up
      const O = await roomAt(T.port), o1 = await member(T.port, O, 'o1');        // lined up, off
      const Z = await roomAt(T.port), z1 = await member(T.port, Z, 'z1');        // on, its two points one above the other
      a1.set('trk', { on: true, m: { a: spotA, b: spotB }, names: { 'LHR-FA4E0A01': 'Spot A' }, by: 'a1', at: Date.now() });
      n1.set('trk', { on: true, m: null, names: {}, by: 'n1', at: Date.now() });
      o1.set('trk', { on: false, m: { a: spotA, b: spotB }, names: {}, by: 'o1', at: Date.now() });
      z1.set('trk', { on: true, m: { a: spotA, b: [spotA[0], spotA[1] + 1, spotA[2]] }, names: {}, by: 'z1', at: Date.now() });
      await sleep(300);
      [a1, b1, q1, n1, o1, z1].forEach(c => { c.got.length = 0; });
      await sleep(2000);
      const G = a1.got.slice(), Gb = b1.got.length;
      ok(G.length >= 100 && G.length <= 125 && Math.abs(Gb - G.length) <= 6, `about 60 a second to each member (${G.length} and ${Gb} in 2 s)`);
      ok(G.every(({ m }) => m.by === '' && m.v.l === 'hand' && Array.isArray(m.v.t)), 'sent by the relay itself (by \'\'), l \'hand\'');
      const late = G.map(({ m, rt }) => rt - m.v.at).sort((x, y) => x - y);
      ok(late[0] >= -5 && late[Math.floor(late.length / 2)] < 40, `at: the relay's time of the newest reading (median ${late[Math.floor(late.length / 2)]} ms before it came)`);
      const ids = G.at(-1).m.v.t.map(x => x[0]);
      ok(ids.join() === SERIALS.join() && !BASES.some(b => ids.includes(b)), 'every tracker, the headset and its controllers; never a base station');
      ok(G.at(-1).m.v.t.map(x => x[12]).join('') === 'ttttthlr' && G.at(-1).m.v.t.every(x => x.length === 13 && x[11] === 1), 'kinds t, h, l, r; ok 1');
      // each tuple against the pose the fake sent in that datagram, in room coordinates: the datagram is the one sent next
      // to at whose circling tracker (1.3 m/s: 14 mm between readings) is where the message has it
      let dp = 0, dq = 0, dv = 0, matched = 0;
      const dist = (e, p) => Math.hypot(...e.p.map((y, i) => y - p[i]));
      for (const { m } of G) {
        const c = m.v.t.find(x => x[0] === 'LHR-FA4E0C03'), H = F.history.get('LHR-FA4E0C03').filter(h => h.at >= m.v.at - 40 && h.at <= m.v.at + 5);
        if (!c || !H.length) continue;
        const sent = H.reduce((best, e) => (dist(e, c.slice(1, 4)) < dist(best, c.slice(1, 4)) ? e : best)).at;
        for (const x of m.v.t) {
          const h = F.history.get(x[0]).find(e => e.at === sent), p = [x[1], x[2], x[3]];
          if (!h) continue;
          dp = Math.max(dp, dist(h, p) * 1000);
          dq = Math.max(dq, qAngle(h.q, [x[4], x[5], x[6], x[7]]));
          dv = Math.max(dv, Math.hypot(h.v[0] - x[8], h.v[1] - x[9], h.v[2] - x[10]));
          matched++;
        }
      }
      ok(matched >= G.length * 7 && dp <= 1 && dq <= 0.05, `${matched} poses in room coordinates within ${dp.toFixed(2)} mm and ${dq.toFixed(3)} degrees of the truth (1 mm, 0.05)`);
      ok(dv < 0.01, `velocities turned into the room as well (within ${(dv * 1000).toFixed(1)} mm/s)`);
      console.log(`  (measured: ${G.length} @trk in 2 s; ${matched} poses within ${dp.toFixed(2)} mm and ${dq.toFixed(3)} degrees, velocities ${(dv * 1000).toFixed(1)} mm/s; median ${late[Math.floor(late.length / 2)]} ms from a reading to its message)`);
      const last = Object.fromEntries(G.at(-1).m.v.t.map(x => [x[0], x]));
      ok(Math.hypot(...last['LHR-FA4E0A01'].slice(1, 4)) < 1e-3 && Math.hypot(last['LHR-FA4E0B02'][1] - 2, last['LHR-FA4E0B02'][2], last['LHR-FA4E0B02'][3]) < 1e-3,
        'the tracker on spot A at the room\'s origin, on spot B 2 m along x');
      ok(q1.got.length === 0 && o1.got.length === 0, 'nothing to a room without trk, or with trk off');
      a1.ws.send(JSON.stringify({ t: 'fx', k: '@trk', v: { at: 1, l: 'hand', t: [] } }));   // (a member cannot pass one off as the relay's)
      await sleep(200);
      ok(a1.other.some(m => m.t === 'error' && m.code === 'bad') && !b1.got.some(({ m }) => m.v.at === 1), 'a member\'s own @trk refused (not a key a member may use)');
      ok(n1.got.length >= 1 && n1.got.length <= 3 && n1.got.every(({ m }) => m.v.l === '' && m.v.t.length === 0 && m.v.at > 0), `on but not lined up: once a second, l '' and no trackers (${n1.got.length} in 2 s)`);
      ok(z1.got.length >= 1 && z1.got.length <= 3 && z1.got.every(({ m }) => m.v.l === ''), 'two points one above the other: not lined up');
      // m written again (spot B taken again by hand) moves the room; trk turned off stops it at once
      n1.set('trk', { on: true, m: { a: spotA, b: spotB }, names: {}, by: 'n1', at: Date.now() });
      await sleep(400);
      ok(n1.got.at(-1)?.m.v.l === 'hand', 'm written into a room that was on: lined up from then on');
      a1.set('trk', { on: false, m: { a: spotA, b: spotB }, names: {}, by: 'a1', at: Date.now() });
      await sleep(200);
      ok((await a1.window(500)).length === 0, 'trk turned off: none');
      a1.set('trk', { on: true, m: { a: spotA, b: spotB }, names: {}, by: 'a1', at: Date.now() });
      [a1, b1, q1, n1, o1, z1].forEach(c => c.ws.close());
    });

    await step('trackers: the bridge silent: @trk once a second, each tracker ok 0 from 0.5 s; one switched off left out after 5 s; then 60 a second again', async () => {
      const P = await roomAt(T.port), c = await member(T.port, P, 's1');
      c.set('trk', { on: true, m: { a: spotA, b: spotB }, names: {}, by: 's1', at: Date.now() });
      await sleep(300);
      F.pause(true);
      const quiet = await c.window(2300);
      ok(quiet.length >= 2 && quiet.length <= 4, `silent: once a second (${quiet.length} in 2.3 s)`);
      ok(quiet.at(-1).m.v.t.length === 8 && quiet.at(-1).m.v.t.every(x => x[11] === 0), 'every tracker ok 0, its last pose kept');
      F.off('LHR-FA4E0D04'); F.pause(false);
      const back = await c.window(1000);
      ok(back.length >= 50 && back.at(-1).m.v.t.find(x => x[0] === 'LHR-FA4E0D04')?.[11] === 0 && back.at(-1).m.v.t.filter(x => x[11] === 1).length === 7, `going again: about 60 a second (${back.length}), the one switched off ok 0`);
      await sleep(2200);
      const gone = (await c.window(300)).at(-1);
      ok(gone && gone.m.v.t.length === 7 && !gone.m.v.t.some(x => x[0] === 'LHR-FA4E0D04'), 'not heard from for 5 s: left out');
      F.off('LHR-FA4E0D04', false);
      c.ws.close();
    });

    await step('trackers: bad datagrams ignored and counted (not JSON, not the bridge\'s, too big), bad readings left out one by one, the rest taken', async () => {
      const at = T.out.length, ok1 = { s: 'LHR-600D0007', k: 'trk', p: [1, 2, 3], q: [0, 0, 0, 1], ok: true, b: 2 };
      const r = x => ({ s: 'LHR-BAD00000', k: 'trk', p: [0, 0, 0], q: [0, 0, 0, 1], ok: true, b: null, ...x });
      F.send('not json'); F.send('{}'); F.send({ v: 2, d: [] }); F.send({ v: 1, d: 'x' });
      F.send({ v: 1, t: 1, d: [ok1], pad: 'x'.repeat(9000) });
      F.send({ v: 1, t: 1, d: [r({ s: 'LHR BAD SPACE' }), r({ s: 'LHR-BAD00001', k: 'xyz' }), r({ s: 'LHR-BAD00002', p: [0, 0] }), r({ s: 'LHR-BAD00003', q: [0, 0, 0, 0] }),
        r({ s: 'LHR-BAD00004', p: [0, 0, '1'] }), r({ s: 'LHR-BAD00005', p: [0, 0, 1e9] }), r({ s: 'LHR-BAD00006', ok: 'yes' }), ok1] });
      await sleep(1600);
      const said = T.out.slice(at), nd = [...said.matchAll(/(\d+) bad datagrams?/g)].reduce((s, m) => s + +m[1], 0), nr = [...said.matchAll(/(\d+) bad readings?/g)].reduce((s, m) => s + +m[1], 0);
      ok(nd === 5 && nr === 7, `said in the log once a second: 5 bad datagrams and 7 bad readings (${nd}, ${nr})`);
      const L = (await req('GET', '/api/trackers', { at: T.port })).json().trackers;
      ok(L.some(d => d.id === 'LHR-600D0007' && d.b === null) && !L.some(d => /BAD/.test(d.id)) && L.length === 11, 'the good reading next to them taken (a battery out of range: null), none of the bad');
      ok((await req('GET', '/api/ping', { at: T.port })).status === 200 && /LHR-600D0007 \(tracker\) seen/.test(T.out), 'the relay goes on; a new device said once in the log');
    });
  } finally { F.stop(); T.kill(); }

  await step('trackers: with a password, /api/trackers and its still need it (Bearer or ?token=), as the API; never in a log line', async () => {
    const PASS = 'trk' + crypto.randomBytes(5).toString('hex');
    const P = await start(['--trackers', '0', '--ping', '0.2'], { COLLAB_TOKEN: PASS }), F2 = startFake({ port: udpOf(P) });
    try {
      await sleep(300);
      ok((await req('GET', '/api/trackers', { at: P.port })).status === 401 && (await req('GET', '/api/trackers/still?id=LHR-FA4E0A01', { at: P.port })).status === 401, 'without it: 401');
      const L = await req('GET', '/api/trackers', { at: P.port, headers: { Authorization: 'Bearer ' + PASS } }), S = await req('GET', `/api/trackers/still?id=LHR-FA4E0A01&ms=300&token=${PASS}`, { at: P.port });
      ok(L.status === 200 && L.json().trackers.length === 10 && S.status === 200 && S.json().ok === true, 'with it (Bearer, ?token=): the list and a still tracker');
      ok((await req('GET', '/api/ping?token=' + PASS, { at: P.port })).json().trackersSeen === 5 && !P.out.includes(PASS), '/api/ping with it says trackersSeen; the password in no log line');
    } finally { F2.stop(); P.kill(); }
  });

  await step('trackers: --trackers in RELAY_ARGS; a UDP port another relay holds stops the start with a sentence; bridge.py --fake to the relay (when python3 is here)', async () => {
    const E = await start(['--ping', '0.2'], { RELAY_ARGS: '--trackers 0' }), held = udpOf(E);
    ok(held > 0 && (await req('GET', '/api/ping', { at: E.port })).json().trackers === true, 'RELAY_ARGS="--trackers 0"');
    await start(['--trackers', String(held)]).then(p => { p.kill(); }, () => {});
    await sleep(200);   // (its last line may come after its exit)
    const refused = procs.at(-1).out;
    ok(procs.at(-1).exitCode === 1 && new RegExp(`cannot listen on UDP 127\\.0\\.0\\.1:${held}`).test(refused), 'a port another relay holds: a sentence, exit 1: ' + refused.trim().split('\n')[0]);
    let py = '';
    try { py = execFileSync('python3', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { /* none */ }
    if (!py) { console.log('  (no python3 here: bridge.py --fake not tried)'); E.kill(); return; }
    const at = E.out.length;
    execFileSync('python3', ['-I', path.join(REPO, 'tools/trackers/bridge.py'), '--fake', '--port', String(held), '--seconds', '1', '--quiet'], { stdio: 'ignore', timeout: 15000 });
    const L = (await req('GET', '/api/trackers', { at: E.port })).json().trackers;
    ok(L.length === 10 && L.map(d => d.k).join() === 'trk,trk,trk,trk,trk,hmd,ctl,ctl,base,base' && L.filter(d => d.h).map(d => d.h).join() === 'l,r', 'bridge.py --fake: its devices taken, with their kinds and hands');
    await sleep(1100);
    ok(!/bad (datagram|reading)/.test(E.out.slice(at)), 'none of its datagrams or readings ignored');
    E.kill();
  });
}

// ---- rooms across updates (v136): a room moves on to a newer networks-<n> once nobody of its own is connected (or a reload
// order asked for it), never back; POST /api/rooms/<code>/reload; --keep <file>. `node relay/test.mjs --rooms` runs only these
async function roomSteps() {
  const at = (P, room, id) => socket(`ws://127.0.0.1:${P.port}/api/ws?room=${room}&id=${id}`);
  const joinAt = async (P, room, id, hello) => { const c = at(P, room, id); c.welcome = await c.next(is('welcome')); if (hello) c.send({ t: 'hello', ...hello }); return c; };
  const N41 = { app: 'networks', version: 'networks-41' };
  await step('versions (v136): /api/ping says versions and reload; a room takes a newer networks-<n> once nobody of its own is connected, never an older one; other versions need the same; a taken code\'s 409 names its version', async () => {
    const pj = (await req('GET', '/api/ping')).json();
    ok(pj.versions === 1 && pj.reload === true && !('keep' in pj), '/api/ping: versions 1, reload true (no keep without --keep)');
    const Q = await newRoom(N41);
    const a = await joined(Q, 'va', { name: 'Ann', version: 'networks-41' });
    await a.next(is('members'));
    const b = await joined(Q, 'vb', { name: 'Bea', version: 'networks-42' });
    const be = await b.next(is('error'));
    ok(be?.code === 'version' && /version networks-41/.test(be.text) && (await b.closedIn(2000))?.code === 4006, 'a newer newcomer while one of the room\'s version is there: refused (4006), the room\'s version in its words');
    ok((await state(Q)).version === 'networks-41', 'the room still networks-41');
    const silent = await joined(Q, 'vs');   // (connected, no hello yet: of no version)
    a.ws.close(); await a.done; await sleep(50);
    const c = await joined(Q, 'vc', { name: 'Cy', version: 'networks-42' });
    ok(await c.none(is('error'), 400), 'the old one gone (one with no hello yet does not count): the newer one is let in');
    const st = await state(Q);
    ok(st.version === 'networks-42' && st.members.some(m => m.id === 'vc' && m.version === 'networks-42'), 'the room moved on to networks-42');
    ok(relay.out.includes(`${Q} version networks-41 -> networks-42`), 'the log says so: version networks-41 -> networks-42');
    const d = await joined(Q, 'vd', { name: 'Dee', version: 'networks-41' });
    const de = await d.next(is('error'));
    ok(de?.code === 'version' && /version networks-42/.test(de.text) && (await d.closedIn(2000))?.code === 4006 && (await state(Q)).version === 'networks-42', 'an older newcomer: refused, never back (its words name networks-42)');
    const e = await joined(Q, 've', { name: 'Eli', version: 'networks-40' });
    ok((await e.closedIn(2000))?.code === 4006, 'networks-40 too');
    const t = await req('POST', '/api/rooms', { body: { ...N41, code: Q } });
    ok(t.status === 409 && t.json().version === 'networks-42', 'POST /api/rooms with its code: 409, the room\'s version in the body');
    const V = await newRoom({ app: 'networks', version: 'v1' });
    const f = await joined(V, 'vf', { name: 'Fay', version: 'v2' });
    ok((await f.closedIn(2000))?.code === 4006 && (await state(V)).version === 'v1', 'versions that are not networks-<n>: only the same (v1 room, v2 refused, nobody there)');
    const g = await joined(V, 'vg', { name: 'Gil', version: 'networks-42' });
    ok((await g.closedIn(2000))?.code === 4006, 'v1 never takes networks-42');
    for (const x of [c, silent]) x.ws.close();
  });
  await step('the reload order (v136): POST /api/rooms/<code>/reload reaches every member whatever its version (q.reload by the relay), 404, 400, 429 within 10 s; the newcomer it names moves the room on with old members there, who get the order and 4006 3 s later', async () => {
    const Q = await newRoom(N41);
    const a = await joined(Q, 'ra', { name: 'Ann', version: 'networks-41' }), w = await joined(Q, 'rw');   // (w: no hello, no version)
    await a.next(is('members'));
    const unknown = ['ZZZ', 'ZZY', 'ZZX'].find(x => x !== Q);
    ok((await req('POST', `/api/rooms/${unknown}/reload`, { body: { n: 'x1' } })).status === 404, 'no such room: 404');
    ok((await req('POST', `/api/rooms/${Q}/reload`, { body: {} })).status === 400 && (await req('POST', `/api/rooms/${Q}/reload`, { body: { n: 'bad id!' } })).status === 400 &&
      (await req('POST', `/api/rooms/${Q}/reload`, { body: 'not json' })).status === 400, 'no order id, a bad one, not JSON: 400');
    ok((await req('GET', `/api/rooms/${Q}/reload`)).status === 405, 'GET: 405');
    const r = await req('POST', `/api/rooms/${Q}/reload`, { body: { n: 'ord1', to: 'networks-42', shell: { n: 136, id: 'abcdef0123456789' }, from: 'ra' } });
    ok(r.status === 200 && r.json().ok === true && r.json().members === 2, '200 { ok, members: 2 }');
    const fa = await a.next(is('fx', m => m.k === 'q.reload')), fw = await w.next(is('fx', m => m.k === 'q.reload'));
    const good = m => m && m.by === '' && m.v.n === 'ord1' && m.v.to === 'networks-42' && m.v.by === '' && m.v.from === 'ra' && m.v.shell.id === 'abcdef0123456789' && m.v.shell.n === 136 && Math.abs(m.v.at - Date.now()) < 5000;
    ok(good(fa) && good(fw), 'both members (networks-41, and one of no version yet) get q.reload by \'\' with n, to, shell, from and at');
    const again = await req('POST', `/api/rooms/${Q}/reload`, { body: { n: 'ord2' } });
    ok(again.status === 429 && +again.headers['retry-after'] >= 1, 'another within 10 s: 429 with Retry-After');
    ok(relay.out.includes(`${Q} reload to networks-42 (2 members)`), 'the log says so');
    const n = await joined(Q, 'rn', { name: 'Neo', version: 'networks-42' });
    ok(await n.none(is('error'), 400), 'a newcomer of the version the order names: let in, though one of networks-41 is there');
    ok((await state(Q)).version === 'networks-42' && relay.out.includes(`${Q} version networks-41 -> networks-42 (1 on networks-41 told to reload)`), 'the room moved on (the log: 1 on networks-41 told to reload)');
    const fa2 = await a.next(is('fx', m => m.k === 'q.reload'));
    ok(fa2 && fa2.by === '' && fa2.v.n === 'ord1' && fa2.v.to === 'networks-42', 'the old member gets the relay\'s own order again (the same n)');
    ok(await a.none(m => m.t === 'error', 2000), 'not refused at once (3 s to reload)');
    const ae = await a.next(is('error'), 2500);
    ok(ae?.code === 'version' && /networks-42/.test(ae.text) && (await a.closedIn(1500))?.code === 4006, 'then refused, 4006, about 3 s later');
    ok(!w.closed, 'one of no version is left alone');
    for (const x of [n, w]) x.ws.close();
  });
  await step('--keep <file> (v136): rooms written every 5 s when they changed and as the relay stops, read back as it starts with their seq, version and keys; expired and bad ones left out; a bad file kept aside; another relay\'s write taken (a rolling update)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-keep-')), file = path.join(dir, 'data', 'rooms.json');
    const args = ['--keep', file, '--timeout', '5', '--ping', '0.5', '--expire', '60'];
    const K1 = await start(args), rq = (P, m, p, o = {}) => req(m, p, { ...o, at: P.port });
    ok((await rq(K1, 'GET', '/api/ping')).json().keep === true, '/api/ping says keep');
    ok(/--keep: no .*rooms\.json yet/.test(K1.out), 'no file yet: said');
    const code = (await rq(K1, 'POST', '/api/rooms', { body: N41 })).json().code;
    const m = await joinAt(K1, code, 'k1', { name: 'Kim', version: 'networks-41' });
    m.send({ t: 'set', batch: [['st.s1', { story: 'flock', x: 1, z: -2, yaw: 0 }], ['st.s1.x', { birds: 300 }]], cid: 'k-1' });
    await m.next(is('set', x => x.cid === 'k-1'));
    for (let i = 0; i < 60 && !fs.existsSync(file); i++) await sleep(200);
    let o = null;
    try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* not yet */ }
    const row = o && o.rooms.find(r => r.code === code);
    ok(row && row.seq === 1 && row.version === 'networks-41' && row.keys['st.s1.x'].v.birds === 300, 'written within 6 s of the change (its folder made), atomically (no temporary file left)');
    ok(!fs.readdirSync(path.dirname(file)).some(f => f.endsWith('.tmp')), 'no temporary file left');
    m.send({ t: 'set', batch: [['look', { labels: 'face', by: 'k1', at: 1 }]], cid: 'k-2' });
    await m.next(is('set', x => x.cid === 'k-2'));
    await new Promise(r => { K1.once('exit', r); K1.kill('SIGTERM'); });
    o = JSON.parse(fs.readFileSync(file, 'utf8'));
    const r2 = o.rooms.find(r => r.code === code);
    ok(r2 && r2.seq === 2 && r2.keys.look && Math.abs(r2.empty - Date.now()) < 5000, 'written as it stops (SIGTERM): the last write in, the room counted as occupied until then');
    const K2 = await start(args);
    ok(new RegExp(`--keep: 1 room read back from`).test(K2.out), 'read back as it starts (the log)');
    const s2 = (await rq(K2, 'GET', '/api/rooms/' + code)).json();
    ok(s2.seq === 2 && s2.version === 'networks-41' && s2.keys['st.s1'].v.story === 'flock' && s2.keys['st.s1.x'].v.birds === 300 && s2.keys.look.seq === 2, 'the room after a restart: its seq, version and keys');
    const m2 = await joinAt(K2, code, 'k2', { name: 'Kai', version: 'networks-41' });
    ok(m2.welcome && m2.welcome.seq === 2 && m2.welcome.keys['st.s1.x'], 'a member joins it (no revive needed)');
    m2.send({ t: 'set', batch: [['st.s1.x', { birds: 200 }]], cid: 'k-3' });
    ok((await m2.next(is('set', x => x.cid === 'k-3')))?.seq === 3, 'writes go on from its seq (3)');
    m2.ws.close(); await m2.done;
    // (rolling: another relay writes the file while this one runs: taken within a second or two, for 2 minutes; first this
    // one's own write of the change, so it has nothing more to write over it)
    const seqIn = () => { try { return (JSON.parse(fs.readFileSync(file, 'utf8')).rooms.find(r => r.code === code) || {}).seq; } catch { return 0; } };
    for (let i = 0; i < 40 && seqIn() !== 3; i++) await sleep(200);
    await sleep(300);
    const other = JSON.parse(fs.readFileSync(file, 'utf8'));
    other.by = 'another'; other.rooms.push({ code: code === 'QQQ' ? 'QQR' : 'QQQ', app: 'networks', version: 'networks-41', seq: 4, empty: Date.now(), keys: { 'st.z': { v: { story: 'robots', x: 0, z: 0, yaw: 0 }, seq: 4, by: 'x' } } });
    fs.writeFileSync(file + '.x', JSON.stringify(other)); fs.renameSync(file + '.x', file);
    const extra = code === 'QQQ' ? 'QQR' : 'QQQ';
    let got = 0;
    for (let i = 0; i < 30 && got !== 200; i++) { await sleep(200); got = (await rq(K2, 'GET', '/api/rooms/' + extra)).status; }
    ok(got === 200 && (await rq(K2, 'GET', '/api/rooms/' + code)).json().seq === 3, 'another relay\'s write taken (a room this one lacks), the room changed here since kept as it is here');
    await new Promise(r => { K2.once('exit', r); K2.kill('SIGTERM'); });
    // expired, bad keys and a bad file
    const now = Date.now();
    fs.writeFileSync(file, JSON.stringify({ keep: 1, by: 'x', at: now, rooms: [
      { code: 'OLD', app: 'networks', version: 'networks-41', seq: 1, empty: now - 3600 * 1000, keys: { 'st.a': { v: { story: 'flock', x: 0, z: 0, yaw: 0 }, seq: 1, by: 'x' } } },
      { code: 'NEW', app: 'networks', version: 'networks-41', seq: 3, empty: now, keys: { 'st.a': { v: { story: 'flock', x: 0, z: 0, yaw: 0 }, seq: 3, by: 'x' }, 'bad key!': { v: 1, seq: 2 }, 'st.b': { v: { x: 1 }, seq: 2 }, 'gone': { v: null, seq: 1 } } },
      { code: 'bad', keys: {} }, 'nonsense'] }));
    const K3 = await start(args);
    ok((await rq(K3, 'GET', '/api/rooms/OLD')).status === 404, 'a room expired meanwhile (empty longer than --expire): left out');
    const s3 = (await rq(K3, 'GET', '/api/rooms/NEW')).json();
    ok(s3.seq === 3 && Object.keys(s3.keys).join() === 'st.a', 'its keys checked as writes are (a bad key, a station without a story, null: left out)');
    await new Promise(r => { K3.once('exit', r); K3.kill('SIGTERM'); });
    fs.writeFileSync(file, '{ not json');
    const K4 = await start(args);
    ok(/could not be read/.test(K4.out) && fs.existsSync(file + '.bad') && (await rq(K4, 'GET', '/api/health')).json().rooms === 0, 'a file that is not JSON: said, kept aside as .bad, the relay starts with no rooms');
    await new Promise(r => { K4.once('exit', r); K4.kill('SIGTERM'); });
    const K5 = await start(['--timeout', '5']);
    ok(!('keep' in (await rq(K5, 'GET', '/api/ping')).json()) && !/--keep/.test(K5.out), 'without --keep nothing of it');
    K5.kill();
  });
}
if (process.argv.includes('--rooms')) {   // only the rooms' steps (v136)
  try { await roomSteps(); } finally { await Promise.all(procs.filter(p => p.exitCode === null).map(p => new Promise(r => { p.on('exit', r); p.kill(); }))); }
  console.log(`\n${passed} checks passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

if (process.argv.includes('--trackers')) {   // only the trackers' steps
  try { await trackerSteps(); } finally { await Promise.all(procs.filter(p => p.exitCode === null).map(p => new Promise(r => { p.on('exit', r); p.kill(); }))); }
  console.log(`\n${passed} checks passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
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
    // a phone in camera mode (v124) says it is a camera: kind cam, kept as it is
    const Cm = await joined(R, 'c9', { name: 'Camera', kind: 'cam', here: true, version: 'v1' });
    const mc = await A.next(is('members', m => m.members.some(x => x.id === 'c9' && x.name === 'Camera')));
    ok(mc && mc.members.find(x => x.id === 'c9').kind === 'cam', 'a phone in camera mode is kind cam (v124)');
    Cm.ws.close(); await Cm.done;
    await A.next(is('members', m => !m.members.some(x => x.id === 'c9')));
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

  await roomSteps();   // (v136: versions, the reload order, --keep)

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
      '/PEERJS-LICENSE.txt': 'text/plain', '/p2p/': 'text/html', '/p2p/index.html': 'text/html',
      '/room-test/': 'text/html', '/room-test/index.html': 'text/html' };
    for (const [p, t] of Object.entries(types)) { r = await req('HEAD', p); ok(r.status === 200 && r.headers['content-type'].startsWith(t), `${p} is ${t}`); }
    ok((await req('GET', '/sw.js')).headers['cache-control'] === 'no-cache', 'files are revalidated (no-cache)');
    r = await req('GET', '/version.json');
    ok(r.status === 200 && r.headers['content-type'] === 'application/json' && r.headers['cache-control'] === 'no-store', 'the release\'s version file: never kept (no-store)');
    r = await req('GET', '/whatsnew.json');
    ok(r.status === 200 && r.headers['content-type'] === 'application/json' && r.headers['cache-control'] === 'no-store' && r.buf.equals(file('whatsnew.json')), 'what is new in the release (developer mode): never kept (no-store)');
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
    ok((await get('/api/ping', { Origin: 'https://unfriend.github.io' })).status === 403, 'a GitHub Pages address that is not the app\'s (unfriend.github.io: Pages sends it on to the app\'s own name): 403');
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
    ok(P.out.includes(`Only pages from ${APP} and the relay's own`) && /No list of open rooms/.test(P.out) &&
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
    for (const v of ['"--public --proxy 1 --guesses 7"', "'--public --proxy 1 --guesses 7'", '"--public" --proxy 1 \'--guesses\' 7']) {
      const Q = await start(['--quiet'], { RELAY_ARGS: v });
      for (const end = Date.now() + 2000; !/All rooms together/.test(Q.out) && Date.now() < end;) await sleep(20);
      ok(/Per address at most 7 lookups/.test(Q.out) && /Behind a reverse proxy/.test(Q.out) && !/usage:/.test(Q.out), `RELAY_ARGS with quote marks typed in (${v}): taken as without them`);
      Q.kill();
    }
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
    ok(no(await get('/api/rooms/' + code + '/reload', { method: 'POST', body: { n: 'pw1' } })), 'the reload order (v136) without it: 401');
    const ro = await get('/api/rooms/' + code + '/reload', { method: 'POST', body: { n: 'pw1' }, headers: bearer() });
    ok(ro.status === 200 && ro.json().ok === true, 'the reload order with it: 200');
    const pre = await get('/api/ping', { method: 'OPTIONS', headers: { Origin: 'https://x.example', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    ok(pre.status === 204 && /Authorization/.test(pre.headers['access-control-allow-headers']), 'a preflight needs no password and allows the Authorization header');
    s = [];
    for (const f of ['/', '/index.html', '/shared.js', '/stories/list.js', '/s/1/', '/p2p/', '/room-test/']) s.push((await get(f)).status);
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
    const upAsk = [['POST', '/api/scenes', { name: 'pw scene' }], ['POST', '/api/scenes/beta/file?path=pw.glb', 'x'], ['POST', '/api/scenes/beta/sound?path=pw.mp3', 'x'],
      ['POST', '/api/scenes/beta/copy', { from: 'alpha', path: 'model.glb', as: 'pwcopy.glb' }]];
    s = [];
    for (const [m, p, b] of upAsk) { s.push(no(await tget(p, { method: m, body: b }))); s.push(no(await tget(p, { method: m, body: b, headers: bearer(PASS + 'x') }))); }
    ok(s.every(Boolean) && !fs.existsSync(path.join(S, 'pw scene')) && !fs.existsSync(path.join(S, 'beta/pw.glb')) && !fs.existsSync(path.join(S, 'beta/pwcopy.glb')), 'uploads and copies without it or with a wrong one: 401, nothing written');
    const pc = await tget('/api/scenes/beta/copy', { method: 'POST', headers: bearer(), body: { from: 'alpha', path: 'model.glb', as: 'pwcopy.glb' } });
    ok(pc.status === 200 && fs.readFileSync(path.join(S, 'beta/pwcopy.glb')).equals(GLB), 'a copy with it');
    fs.rmSync(path.join(S, 'beta/pwcopy.glb'));
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

  await step('copies: POST /api/scenes/<name>/copy copies a file of another scene (the same path, or as), written whole, told at once; 409 unless replace, an upload\'s paths and kinds, the source a file its scene lists, a link out, --max-upload, --scenes-readonly', async () => {
    const cp = (scene, b, o = {}) => send(o.at || UP.port, `/api/scenes/${scene}/copy`, Buffer.from(typeof b === 'string' ? b : JSON.stringify(b)), { headers: { 'Content-Type': 'application/json' } });
    const nw = rel => path.join(U, 'new one', ...rel.split('/'));
    const w = sse(UP.port, '/api/scenes/watch');
    await w.ready;
    await w.next(ev('hello'), 3000);
    const t0 = Date.now(), r = await cp('new%20one', { from: 'one', path: 'models/b c.glb' }), a = r.json();
    ok(r.status === 200 && a.ok === true && a.path === 'models/b c.glb' && a.bytes === fs.statSync(at('models/b c.glb')).size && fs.readFileSync(nw('models/b c.glb')).equals(fs.readFileSync(at('models/b c.glb'))) &&
      a.at === Math.floor(fs.statSync(nw('models/b c.glb')).mtimeMs), '200 { ok, path, bytes, at }: the same bytes at the same path in the other scene, its folder made');
    const told = await w.next(ev('scene', d => d.name === 'new one' && d.path === 'models/b c.glb'), 3000);
    ok(told && told.at - t0 < 1000 && told.data.kind === 'model' && told.data.gone === false, `the watch told at once (${told ? told.at - t0 : '-'} ms)`);
    const as = await cp('new%20one', { from: 'one', path: 'tex/a.PNG', as: 'pictures/wall.png' });
    ok(as.status === 200 && as.json().path === 'pictures/wall.png' && fs.readFileSync(nw('pictures/wall.png')).equals(fs.readFileSync(at('tex/a.PNG'))), 'as: to another path');
    const again = await cp('new%20one', { from: 'one', path: 'models/b c.glb' }), rp = await cp('new%20one', { from: 'one', path: 'data.bin', as: 'models/b c.glb', replace: true });
    ok(again.status === 409 && /replace: true/.test(again.json().error) && rp.status === 200 && fs.readFileSync(nw('models/b c.glb')).equals(fs.readFileSync(at('data.bin'))), 'there: 409; replace: true replaces it');
    const ob = await cp('new%20one', { from: 'one', path: 'originals/x.obj', as: 'x.obj' }), oo = await cp('new%20one', { from: 'one', path: 'originals/x.obj' });
    ok(ob.status === 400 && /outside originals/.test(ob.json().error) && oo.status === 200 && fs.existsSync(nw('originals/x.obj')) && !fs.existsSync(nw('x.obj')), 'a kind an upload takes only under originals/ (an OBJ): 400 elsewhere, 200 there');
    const before = tree(), bad = [];
    for (const b of [{ from: 'one', path: '../one/data.bin' }, { from: 'one', path: '.history/x.json' }, { from: 'one', path: 'layout.json' }, { from: 'one', path: 'files.json' }, { from: 'one', path: 'a\\b.glb' },
      { from: 'one', path: 'x.glb.tmp' }, { from: 'one', path: 'data.bin', as: '.hidden.bin' }, { from: 'one', path: 'data.bin', as: '../x.bin' }, { from: 'one', path: 'data.bin', as: 'layout.json' },
      { from: 'one', path: 'data.bin', as: 'notes.txt' }, { from: 'one', path: 'data.bin', as: 'a/b/c/d/e/f.bin' }, { from: 'one' }, { path: 'data.bin' }, { from: 5, path: 'data.bin' },
      { from: 'one', path: 'data.bin', as: 7 }, { from: 'one', path: 'data.bin', replace: 'yes' }, { from: 'new one', path: 'models/b c.glb' }, 'not json', '[]', 'null']) bad.push((await cp('new%20one', b)).status);
    ok(bad.every(x => x === 400) && JSON.stringify(tree()) === JSON.stringify(before), 'a source no listing shows, a target an upload may not have, the file onto itself, a bad body: 400, nothing written (' + bad.join(' ') + ')');
    const nf = [await cp('nope', { from: 'one', path: 'data.bin' }), await cp('new%20one', { from: 'nope', path: 'data.bin' }), await cp('new%20one', { from: 'bad!', path: 'data.bin' }), await cp('new%20one', { from: 'one', path: 'none.glb' }), await cp('new%20one', { from: 'one', path: 'models', as: 'm.glb' })];
    ok(nf.every(x => x.status === 404) && JSON.stringify(tree()) === JSON.stringify(before), 'no such scene (either), no such file, a folder: 404 (' + nf.map(x => x.status).join(' ') + ')');
    // a file of the scene that is a link out of its folder: not copied
    fs.writeFileSync(path.join(OUT, 'secret.bin'), 'secret'); fs.symlinkSync(path.join(OUT, 'secret.bin'), at('leak.bin'));
    const lk = await cp('new%20one', { from: 'one', path: 'leak.bin' });
    ok(lk.status === 404 && !fs.existsSync(nw('leak.bin')) && /refused a copy from "one\/leak\.bin" \(a link out of its folder\)/.test(UP.out), 'a link out of its scene: 404, nothing copied, said in the log');
    fs.rmSync(at('leak.bin'));
    fs.writeFileSync(at('huge.bin'), bytes(MB + 1));
    const hg = await cp('new%20one', { from: 'one', path: 'huge.bin' });
    ok(hg.status === 413 && !fs.existsSync(nw('huge.bin')), 'a file over --max-upload: 413');
    fs.rmSync(at('huge.bin'));
    ok(!leftovers().length && (await cp('new%20one', { from: 'one', path: 'data.bin' }, { at: URO.port })).status === 403 && !fs.existsSync(nw('data.bin')), 'no temporary file left; --scenes-readonly: 403, nothing written');
    ok((await req('GET', '/api/scenes/new%20one/copy', { at: UP.port })).status === 405, 'GET: 405');
    ok(/scenes: new one: copied models\/b c\.glb from one\/models\/b c\.glb/.test(UP.out) && /copied models\/b c\.glb from one\/data\.bin \([\d.]+ kB\), replacing it/.test(UP.out), 'said in the log');
    w.close();
  });

  // a model's picture for the studio's Add pane (tools/studio/SPEC.md, "Pictures in the Add pane"): previews/<the model's
  // path>.jpg, at most 200 KB, listed with a kind of its own
  await step('previews: previews/ takes only a model\'s picture (.jpg, at most 200 KB, also as it streams), listed and told with its kind preview, served as a JPEG; copies by the same rule', async () => {
    const J = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), bytes(6000)]), KB200 = 200 << 10;
    const w = sse(UP.port, '/api/scenes/watch');
    await w.ready;
    await w.next(ev('hello'), 3000);
    const r = await upf('previews/models/a.glb.jpg', J), a = r.json();
    ok(r.status === 200 && a.path === 'previews/models/a.glb.jpg' && a.bytes === J.length && fs.readFileSync(at('previews/models/a.glb.jpg')).equals(J), '200: a model\'s picture where it goes, its folder made');
    const told = await w.next(ev('scene', d => d.path === 'previews/models/a.glb.jpg'), 3000);
    ok(told && told.data.kind === 'preview' && told.data.gone === false, 'the watch tells it with its kind, preview');
    w.close();
    const one = (await req('GET', '/api/scenes/one', { at: UP.port })).json(), f = one.files.find(x => x.path === 'previews/models/a.glb.jpg');
    ok(!!f && f.kind === 'preview' && f.bytes === J.length && one.files.filter(x => x.kind === 'preview').length === 1 && one.files.find(x => x.path === 'models/a.glb').kind === 'model',
      'listed with its kind, preview (never image or model); its model as before: ' + JSON.stringify(f));
    const sv = await req('GET', '/scenes/one/previews/models/a.glb.jpg', { at: UP.port });
    ok(sv.status === 200 && sv.headers['content-type'] === 'image/jpeg' && sv.buf.equals(J), 'served as a JPEG');
    // a file put in previews/ by hand that is not such a picture: listed as other (never a texture)
    fs.writeFileSync(at('previews/odd.png'), bytes(20));
    const odd = (await req('GET', '/api/scenes/one', { at: UP.port })).json().files.find(x => x.path === 'previews/odd.png');
    ok(odd && odd.kind === 'other', 'a picture put in previews/ by hand that is not a .jpg: listed as other (' + (odd && odd.kind) + ')');
    fs.rmSync(at('previews/odd.png'));
    const ok2 = [await upf('previews/x.jpg', J), await upf('previews/originals/eva/eva_001.FBX.jpg', J), await upf('previews/a/b/c/d.glb.jpg', J), await upf('tex/Previews/x.jpg', J)];
    ok(ok2.every(x => x.status === 200), 'any depth up to 4 folders, and a Previews/ further down (an ordinary folder): 200 (' + ok2.map(x => x.status).join(' ') + ')');
    const before = tree(), bad = [];
    for (const p of ['previews/a.png', 'previews/a.JPG', 'previews/a.jpeg', 'previews/models/a.glb', 'previews/notes.txt', 'previews/.jpg', 'previews/a/b/c/d/e.glb.jpg', 'previews', 'Previews/x.jpg', 'PREVIEWS/models/a.glb.jpg', 'Previews/big.png']) bad.push((await upf(p, J)).status);
    ok(bad.every(x => x === 400) && JSON.stringify(tree()) === JSON.stringify(before), 'anything but a .jpg under previews/ (a PNG, .JPG, .jpeg, a model, text), too deep, and Previews/ in any other case (the same folder where case is ignored): 400, nothing written (' + bad.join(' ') + ')');
    ok(/previews\/ takes only the studio's pictures/.test((await upf('previews/a.png', J)).json().error) && /previews\/ is written in lower case/.test((await upf('Previews/x.jpg', J)).json().error), 'it says why');
    const ex = await upf('previews/exact.jpg', bytes(KB200)), b1 = await upf('previews/big1.jpg', bytes(KB200 + 1)), b2 = await upf('previews/deep/big2.jpg', bytes(3 * KB200), { chunked: true });
    ok(ex.status === 200 && b1.status === 413 && b2.status === 413 && /a picture in previews\/ is at most 200 KB/.test(b2.json().error) && !fs.existsSync(at('previews/big1.jpg')) && !fs.existsSync(at('previews/deep')) && !leftovers().length,
      `exactly 200 KB: 200; past it 413 by its Content-Length (${b1.status}) and counted as it streams (${b2.status}), in its own words; nothing left behind`);
    ok((await upf('models/big.glb', bytes(KB200 + 1))).status === 200, 'elsewhere --max-upload (1 MB here) as before');
    const cp = (b, scene = 'new%20one') => send(UP.port, `/api/scenes/${scene}/copy`, Buffer.from(JSON.stringify(b)), { headers: { 'Content-Type': 'application/json' } });
    const c1 = await cp({ from: 'one', path: 'previews/models/a.glb.jpg' }), c2 = await cp({ from: 'one', path: 'models/big.glb', as: 'previews/big.glb.jpg' }), c3 = await cp({ from: 'one', path: 'tex/a.PNG', as: 'previews/a.png' });
    ok(c1.status === 200 && fs.readFileSync(path.join(U, 'new one', 'previews', 'models', 'a.glb.jpg')).equals(J) && c2.status === 413 && /at most 200 KB/.test(c2.json().error) && c3.status === 400,
      `copies: a picture copied with it (${c1.status}); one over 200 KB (${c2.status}) or not a .jpg (${c3.status}) refused`);
  });

  // a recorded path kept as a file of its scene (tools/studio/SPEC.md, "Recorded paths", v125): recordings/<name>.json, at
  // most 4 MB, listed with a kind of its own
  await step('recordings: recordings/ takes a recording kept as a file (.json, at most 4 MB and --max-upload), listed and told with its kind recording, served as JSON; a .json anywhere else refused, another kind there by its own rules; copies by the same rule', async () => {
    const J = Buffer.from(JSON.stringify({ studio: 1, recording: 1, item: 'Box', len: 1, n: 2, k: [[0, 0, 0, 0, 0, 0, 0, 1], [1, 1, 0, 0, 0, 0, 0, 1]] }));
    const w = sse(UP.port, '/api/scenes/watch');
    await w.ready;
    await w.next(ev('hello'), 3000);
    const r = await upf('recordings/Box-1.json', J), a = r.json();
    ok(r.status === 200 && a.path === 'recordings/Box-1.json' && a.bytes === J.length && fs.readFileSync(at('recordings/Box-1.json')).equals(J), '200: a recording where it goes, its folder made');
    const told = await w.next(ev('scene', d => d.path === 'recordings/Box-1.json'), 3000);
    ok(told && told.data.kind === 'recording' && told.data.gone === false, 'the watch tells it with its kind, recording');
    w.close();
    const okd = [await upf('recordings/sub/Box 2-1.json', J), await upf('recordings/voice.wav', bytes(64))];
    ok(okd.every(x => x.status === 200), 'a folder deeper, and a sound in recordings/ by its own kind: 200 (' + okd.map(x => x.status).join(' ') + ')');
    const one = (await req('GET', '/api/scenes/one', { at: UP.port })).json(), kindAt = p => (one.files.find(x => x.path === p) || {}).kind;
    ok(kindAt('recordings/Box-1.json') === 'recording' && kindAt('recordings/sub/Box 2-1.json') === 'recording' && kindAt('recordings/voice.wav') === 'audio',
      'listed with its kind, recording (a sound there: audio): ' + [kindAt('recordings/Box-1.json'), kindAt('recordings/sub/Box 2-1.json'), kindAt('recordings/voice.wav')].join(' '));
    const sv = await req('GET', '/scenes/one/recordings/Box-1.json', { at: UP.port }), sj = await req('GET', '/scenes/one/recordings/voice.wav', { at: UP.port });
    ok(sv.status === 200 && sv.headers['content-type'] === 'application/json' && sv.buf.equals(J) && !sv.headers['content-disposition'] && sj.headers['content-type'] === 'audio/wav', 'served as JSON (' + sv.headers['content-type'] + ')');
    const before = tree(), bad = [];
    for (const p of ['recordings/a.JSON', 'recordings/a.txt', 'recordings/.a.json', 'recordings/a/b/c/d/e.json', 'data/a.json', 'a.json', 'recordings/a.json~']) bad.push((await upf(p, J)).status);
    ok(bad.every(x => x === 400) && JSON.stringify(tree()) === JSON.stringify(before), 'a .json anywhere but recordings/ (or .JSON, text, a dot file, too deep, a temporary name): 400, nothing written (' + bad.join(' ') + ')');
    ok(/recordings \(\.json\) in recordings\//.test((await upf('data/a.json', J)).json().error), 'it says where a recording goes');
    const { uploadPath, typeOf, kindAt: ka } = await import('./scenes.mjs'), u = uploadPath('recordings/a.json');
    ok(u.kind === 'recording' && u.max === 4 << 20 && !uploadPath('models/a.glb').max && typeOf('recordings/a.json') === 'application/json' && typeOf('originals/a.json') === 'application/octet-stream' && ka('originals/a.json') === 'other',
      'uploadPath: a recording at most 4 MB; typeOf: JSON; a .json elsewhere other');
    const b1 = await upf('recordings/big.json', bytes(MB + 1)), b2 = await upf('recordings/big2.json', bytes(MB + 10), { chunked: true });
    ok(b1.status === 413 && b2.status === 413 && !fs.existsSync(at('recordings/big.json')) && !leftovers().length, `past the smaller of 4 MB and --max-upload (1 MB here): 413 by its length (${b1.status}) and as it streams (${b2.status}); nothing left behind`);
    const cp = b => send(UP.port, '/api/scenes/new%20one/copy', Buffer.from(JSON.stringify(b)), { headers: { 'Content-Type': 'application/json' } });
    const c1 = await cp({ from: 'one', path: 'recordings/Box-1.json' }), c2 = await cp({ from: 'one', path: 'recordings/Box-1.json', as: 'data/Box-1.json' });
    ok(c1.status === 200 && fs.readFileSync(path.join(U, 'new one', 'recordings', 'Box-1.json')).equals(J) && c2.status === 400, `copies: a recording copied with it (${c1.status}); as a .json elsewhere refused (${c2.status})`);
    for (const p of ['recordings']) { fs.rmSync(at(p), { recursive: true, force: true }); fs.rmSync(path.join(U, 'new one', p), { recursive: true, force: true }); }   // (the steps after know the scenes without them)
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

  // ---- the scenes in Cloudflare R2 (--scenes r2; relay/README.md, "Scenes in Cloudflare R2"): the same steps as the
  // folder's above, against the stand-in S3 (relay/s3fake.mjs: it checks every signature, so a broken signer fails here)
  // on another port, so every signed link is another origin's. First relay/test-r2.mjs: the signer against AWS's examples
  await step('R2: the signer against AWS\'s published Signature Version 4 examples, byte for byte, and the client against the stand-in (relay/test-r2.mjs)', async () => {
    let out = '', code = 0;
    try { out = execFileSync(process.execPath, [path.join(HERE, 'test-r2.mjs')], { encoding: 'utf8', timeout: 60000 }); } catch (err) { code = err.status; out = String(err.stdout); }
    const m = /(\d+) checks passed, (\d+) failed/.exec(out);
    ok(code === 0 && m && +m[1] >= 36 && m[2] === '0', 'relay/test-r2.mjs: ' + (m ? m[0] : out.slice(-300)));
  });
  const { startFake, STUDIO_CORS } = await import('./s3fake.mjs');
  const { typeOf } = await import('./scenes.mjs');
  const R2KEY = 'RELAYTESTKEYID', R2SECRET = 'relay-test-secret-' + crypto.randomBytes(6).toString('hex');
  const S3 = await startFake({ bucket: 'scenes', keys: { [R2KEY]: R2SECRET } });
  const R2ENV = { R2_ENDPOINT: S3.url, R2_ACCESS_KEY_ID: R2KEY, R2_SECRET_ACCESS_KEY: R2SECRET, R2_BUCKET: 'scenes', R2_PREFIX: 'studio', R2_POLL: '1',
    R2_ACCOUNT_ID: '', R2_JURISDICTION: '', R2_LINK_TTL: '' };
  const PFX = 'studio/', obj = rel => S3.objects.get(PFX + rel), seed = (rel, data) => S3.put(PFX + rel, data, { type: typeOf(rel) });
  for (const [rel, data] of [['alpha/model.glb', GLB], ['alpha/Model2.GLTF', '{"asset":{"version":"2.0"}}'], ['alpha/rig.FBX', bytes(300)], ['alpha/tex/wall.PNG', bytes(40)],
    ['alpha/tex/photo.jpeg', bytes(50)], ['alpha/sounds/tone.wav', TONE], ['alpha/sounds/birds.MP3', bytes(70)], ['alpha/data.bin', bytes(16)], ['alpha/notes.txt', 'notes'],
    ['alpha/deep/a/b/c/ok.glb', bytes(10)], ['alpha/deep/a/b/c/d/too-deep.glb', bytes(10)], ['alpha/layout.json', JSON.stringify(ALPHA)], ['alpha/files.json', '{"stale":true}'],
    ['alpha/.hidden', 'x'], ['alpha/.history/layout-old.json', '{}'], ['alpha/x.tmp', 'x'], ['alpha/y~', 'x'], ['alpha/z.part', 'x'], ['alpha/a//b.glb', 'x'], ['beta/a.ogg', bytes(30)],
    ['with space/x.webm', bytes(20)], ['bad!/x.glb', 'x'], ['-dash/x.glb', 'x'], ['watch/x.glb', 'x'], ['.git/x', 'x'], ['readme.txt', 'x']]) seed(rel, data);
  S3.put('elsewhere/x.glb', 'not under the prefix');
  const R2_FILES = ALPHA_FILES.filter(([p]) => p !== 'link.wav');
  const RR = await start(['--scenes', 'r2', '--ffmpeg', ff('ok'), '--max-upload', '1'], R2ENV);
  const rget = (p, o = {}) => req(o.method || 'GET', p, { at: RR.port, headers: o.headers || {}, body: o.body });
  const r2tmp = () => fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('relay-r2-')).length, tmp0 = r2tmp();
  const said = async (re, ms = 5000) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (re.test(RR.out)) return true; return false; };
  const noLeak = out => !out.includes(R2SECRET) && !/X-Amz-(Signature|Credential)/.test(out);

  await step('R2 (--scenes r2): the start lists the bucket and checks its CORS rule; /api/ping, the list and one scene by the same listing rules, each file with its signed link', async () => {
    ok(await said(/Scenes for the studio \(#studio\) from the R2 bucket scenes, under studio\/: 3 \(alpha, beta, with space\); the studio saves their layouts there/) &&
      await said(/R2 CORS \(as a page at https:\/\/stories\.lbi-netmed\.com meets it\): download with a range yes, upload yes; a page sent there by the relay's redirect from another origin \(Origin: null\) yes; it exposes ETag/),
      'the start lines: the bucket, its scenes, and its CORS rule as a page meets it');
    ok(await said(/R2 upload links: taken with their type, length and If-None-Match signed; a second upload to the same new name refused \(412 PreconditionFailed\)/) &&
      !S3.keys().some(k => k.includes('.put-check-')), 'the start tries an upload link as a page gets one (and again: refused), and removes what it put');
    ok((await rget('/api/ping')).json().scenes === true, '/api/ping: scenes: true');
    const l = (await rget('/api/scenes')).json();
    ok(l.scenes.map(s => s.name).join('|') === 'alpha|beta|with space' && l.store === 'r2' && l.direct === true && l.linkTtl === 43200 && l.save === true && l.upload === true,
      'GET /api/scenes: alpha, beta and "with space" (bad!, -dash, watch, .git, a key at the top and one outside the prefix left out); store r2, direct, linkTtl 12 h: ' + JSON.stringify({ ...l, scenes: l.scenes.map(s => s.name) }));
    const a = l.scenes[0], b = l.scenes[1];
    ok(Object.keys(a).sort().join() === 'at,bytes,files,layout,name' && a.files === R2_FILES.length && a.layout === true && b.layout === false && b.files === 1 && b.bytes === 30 &&
      a.bytes === R2_FILES.reduce((n, [p]) => n + obj('alpha/' + p).body.length, 0) && a.at === Math.max(...R2_FILES.map(([p]) => obj('alpha/' + p).at)), 'each { name, files, bytes, at, layout }, as a folder\'s');
    ok((RR.out.match(/left out the folder "bad!"/g) || []).length === 1 && /left out the folder "-dash"/.test(RR.out) && /left out the folder "watch"/.test(RR.out), 'a name that cannot be a scene\'s said once');
    const one = (await rget('/api/scenes/alpha')).json();
    ok(Object.keys(one).join() === 'name,files,layout,layoutAt,save,linkTtl' && JSON.stringify(one.files.map(f => [f.path, f.kind])) === JSON.stringify(R2_FILES),
      'GET /api/scenes/alpha: its files sorted with their kinds (not layout.json, files.json, dot files, .history/, temporary files, an empty part, too deep): ' + one.files.map(f => f.path).join(' '));
    ok(one.files.every(f => Object.keys(f).join() === 'path,bytes,at,kind,url' && f.bytes === obj('alpha/' + f.path).body.length && f.at === obj('alpha/' + f.path).at && f.url.startsWith(S3.url + '/scenes/studio/alpha/') && /X-Amz-Signature=[0-9a-f]{64}$/.test(f.url)) &&
      JSON.stringify(one.layout) === JSON.stringify(ALPHA) && one.layoutAt === obj('alpha/layout.json').at, 'each file { path, bytes, at, kind, url } (a signed link to the stand-in); the layout parsed, layoutAt its time');
    const g = one.files.find(f => f.path === 'model.glb'), t = one.files.find(f => f.path === 'sounds/tone.wav');
    const gr = await fetch(g.url, { headers: { Origin: 'https://x.github.io' } }), rr = await fetch(t.url, { headers: { Range: 'bytes=10-19' } });
    ok(gr.status === 200 && Buffer.from(await gr.arrayBuffer()).equals(GLB) && gr.headers.get('content-type') === 'model/gltf-binary' && gr.headers.get('access-control-allow-origin') === '*' &&
      rr.status === 206 && Buffer.from(await rr.arrayBuffer()).equals(TONE.subarray(10, 20)) && (await fetch(g.url, { headers: { 'If-None-Match': gr.headers.get('etag') } })).status === 304,
      'a link fetched from the stand-in: its bytes and type, CORS, a range (206), its ETag (304)');
    const sp = (await rget('/api/scenes/with%20space')).json();
    ok(sp.files[0].kind === 'audio' && (await fetch(sp.files[0].url)).status === 200 && (await rget('/api/scenes/beta')).json().layout === null, 'a name with a space (its link works), a scene without layout.json');
    const s = [];
    for (const p of ['/api/scenes/nope', '/api/scenes/bad!', '/api/scenes/%2e%2e', '/api/scenes/alpha%2Fsounds', '/api/scenes/%E0%A4%A', '/api/scenes/alpha/x']) s.push((await rget(p)).status);
    ok(s.every(x => x === 404), 'no such scene and the rest: 404 (' + s.join(' ') + ')');
  });

  await step('R2: GET /scenes/<name>/<path> redirects (302, no-store, CORS) to a signed link the stand-in takes; the same refusals; no link in any log line', async () => {
    const r = await rget('/scenes/alpha/model.glb?v=1', { headers: { Origin: 'https://x.github.io' } }), loc = r.headers.location || '';
    ok(r.status === 302 && loc.startsWith(S3.url + '/scenes/studio/alpha/model.glb?X-Amz-Algorithm=') && r.headers['cache-control'] === 'no-store' && r.headers['access-control-allow-origin'] === '*',
      '302 to the file\'s signed link, Cache-Control: no-store, CORS');
    const f = await fetch(loc);
    ok(f.status === 200 && Buffer.from(await f.arrayBuffer()).equals(GLB), 'the link: the file\'s bytes');
    const h = await rget('/scenes/alpha/sounds/tone.wav', { method: 'HEAD' }), lay = await rget('/scenes/alpha/layout.json'), sp = await rget('/scenes/with%20space/x.webm');
    ok(h.status === 302 && lay.status === 302 && JSON.parse(await (await fetch(lay.headers.location)).text()).studio === 1 && sp.status === 302 && (await fetch(sp.headers.location)).status === 200,
      'HEAD, the scene\'s layout.json (as a folder serves it) and a name with a space: 302 to links that work');
    const s = [];
    for (const p of ['/scenes/alpha/../beta/a.ogg', '/scenes/alpha/%2e%2e/beta/a.ogg?token=QSECRETQ', '/scenes/alpha/sounds%5Ctone.wav', '/scenes/alpha/tone%00.wav', '/scenes/alpha/.hidden', '/scenes/alpha/.history/layout-old.json',
      '/scenes/alpha/deep/a/b/c/d/too-deep.glb', '/scenes/alpha/x.tmp', '/scenes/alpha/files.json', '/scenes/bad!/x.glb', '/scenes/nope/x.glb', '/scenes/alpha/', '/scenes/alpha/tex', '/scenes/alpha/nothing.glb']) s.push((await rget(p)).status);
    ok(s.every(x => x === 404), '.., backslashes, NUL, dot files, .history/, too deep, temporary files, files.json, no such scene, a folder, no such file: 404 (' + s.join(' ') + ')');
    ok((await rget('/scenes/alpha/model.glb', { method: 'POST', body: 'x' })).status === 405, 'POST to a file: 405');
    await sleep(100);
    ok(noLeak(RR.out) && /refused "\/scenes\/alpha\/\.\.\/beta\/a\.ogg" \(out of its folder\)/.test(RR.out) && !RR.out.includes('QSECRETQ'), 'refusals said by their path; no signed link, no secret in the log');
  });

  await step('R2: POST /api/scenes/<name>/layout writes layout.json into the bucket, the old one into .history/ (20 kept); bad, too big, unknown refused; --scenes-readonly', async () => {
    const save = (name, body, at = RR.port) => req('POST', `/api/scenes/${encodeURIComponent(name)}/layout`, { at, body, headers: { 'Content-Type': 'application/json' } });
    const L = n => ({ studio: 1, scene: 'beta', saved: new Date().toISOString(), n, objects: [{ id: 'a' + n, name: 'X', file: 'a.ogg', p: [n, 0, 0] }], cubes: [], sounds: [] });
    const hist = () => S3.keys().filter(k => k.startsWith(PFX + 'beta/.history/'));
    const r1 = await save('beta', L(1)), a1 = r1.json(), o1 = obj('beta/layout.json');
    ok(r1.status === 200 && a1.ok === true && a1.bytes === o1.body.length && a1.at === o1.at && o1.type === 'application/json' && !hist().length &&
      /^\{\n  "studio": 1,\n[\s\S]*\n  "objects": \[\n    \{"id":"a1",/.test(o1.body.toString()), 'the first save: { ok, at, bytes }, laid out a field a line, application/json, no history yet');
    const r2 = await save('beta', L(2)), h1 = hist();
    ok(r2.status === 200 && h1.length === 1 && /\/\.history\/layout-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.\d{3}Z\.json$/.test(h1[0]) && JSON.parse(S3.objects.get(h1[0]).body).n === 1, 'the second: the first copied into .history/layout-<time>.json');
    const one = (await rget('/api/scenes/beta')).json();
    ok(one.layout.n === 2 && one.layoutAt === r2.json().at, 'GET gives the saved layout and its time (the listing\'s, as the save said)');
    for (let n = 3; n <= 24; n++) await save('beta', L(n));
    const ns = hist().map(k => JSON.parse(S3.objects.get(k).body).n).sort((x, y) => x - y);
    ok(ns.length === 20 && ns[0] === 4 && ns[19] === 23 && JSON.parse(obj('beta/layout.json').body).n === 24, '24 saves: the newest 20 before the last kept (' + ns[0] + ' to ' + ns[19] + ')');
    const all = await Promise.all([25, 26, 27, 28, 29].map(n => save('beta', L(n))));
    ok(all.every(x => x.status === 200) && JSON.parse(obj('beta/layout.json').body).n >= 25 && hist().length === 20, 'five at once: one at a time');
    const before = obj('beta/layout.json').body.toString(), bad = [];
    for (const b of ['not json', '[1]', '{"studio":2}', '{}', 'null']) bad.push((await save('beta', b)).status);
    let tb;
    try { tb = (await save('beta', JSON.stringify({ studio: 1, pad: 'x'.repeat(2 << 20) }))).status; } catch { tb = 'cut'; }
    ok(bad.every(x => x === 400) && tb === 413 && (await save('nope', L(1))).status === 404 && (await save('bad!', L(1))).status === 404 && obj('beta/layout.json').body.toString() === before,
      'not a layout: 400; over 2 MB: 413; no such scene: 404; nothing changed (' + bad.join(' ') + ' ' + tb + ')');
    const RO = await start(['--scenes', 'r2', '--scenes-readonly', '--quiet'], R2ENV);
    const ro = await save('beta', L(99), RO.port);
    ok(ro.status === 403 && /--scenes-readonly/.test(ro.json().error) && obj('beta/layout.json').body.toString() === before && (await req('GET', '/api/scenes', { at: RO.port })).json().direct === false,
      '--scenes-readonly: 403, nothing written, no direct uploads');
    RO.kill();
  });

  await step('R2: the watch: hello; a change made straight in the bucket told within R2_POLL (no settling: an object lands whole); a saved layout and an upload at once; a new scene; nothing for .history/, dot or temporary files', async () => {
    const w = sse(RR.port, '/api/scenes/watch');
    await w.ready;
    const hello = await w.next(ev('hello'), 3000);
    ok(w.status === 200 && hello?.data.scenes.map(s => s.name).join('|') === 'alpha|beta|with space', 'hello { scenes } at once');
    await sleep(300);
    const t0 = Date.now();
    seed('beta/new.glb', 'x'); seed('beta/a.ogg', bytes(40)); S3.del(PFX + 'alpha/notes.txt'); seed('beta/.x.tmp', 'x'); seed('beta/y.part', 'x'); seed('beta/.history/extra.json', 'x');
    const [e1, e2, e3] = await Promise.all([w.next(ev('scene', d => d.path === 'new.glb')), w.next(ev('scene', d => d.path === 'a.ogg')), w.next(ev('scene', d => d.path === 'notes.txt'))]);
    ok(JSON.stringify(e1?.data) === '{"name":"beta","path":"new.glb","kind":"model","gone":false}' && JSON.stringify(e2?.data) === '{"name":"beta","path":"a.ogg","kind":"audio","gone":false}' &&
      JSON.stringify(e3?.data) === '{"name":"alpha","path":"notes.txt","kind":"other","gone":true}' && e1.at - t0 < 3000, `added, changed and removed in the bucket: scene { name, path, kind, gone } within R2_POLL (1 s here; ${e1 ? e1.at - t0 : '-'} ms)`);
    const t1 = Date.now(), s = await req('POST', '/api/scenes/beta/layout', { at: RR.port, body: { studio: 1, scene: 'beta', objects: [] } }), lay = await w.next(ev('layout'));
    ok(JSON.stringify(lay?.data) === JSON.stringify({ name: 'beta', at: s.json().at }) && lay.at - t1 < 900, `a save: layout { name, at } at once (${lay ? lay.at - t1 : '-'} ms)`);
    seed('gamma/g.mp3', 'x');
    const sc = await w.next(ev('scenes')), g = await w.next(ev('scene', d => d.name === 'gamma'));
    ok(sc?.data.scenes.map(x => x.name).join('|') === 'alpha|beta|gamma|with space' && g?.data.path === 'g.mp3', 'a new scene: scenes { scenes }, and its file');
    S3.del(PFX + 'beta/layout.json');
    const gone = await w.next(ev('layout'));
    ok(gone?.data.name === 'beta' && gone.data.gone === true && gone.data.at === null, 'layout.json removed: layout { name, at: null, gone: true }');
    S3.del(PFX + 'gamma/g.mp3');
    ok((await w.next(ev('scenes')))?.data.scenes.length === 3, 'a scene emptied: scenes { scenes } without it');
    await sleep(1500);
    ok(!w.events.some(e => e.event === 'scene' && /(^|\/)\.|\.part$|\.tmp$/.test(e.data.path)), 'nothing for .history/, dot files or temporary files');
    w.close();
  });

  await step('R2: uploads through the relay: a scene made (a hidden marker keeps it), files put into the bucket (409 unless replace=1, the path rules, the size counted as it streams), told at once; nothing left behind', async () => {
    const make = (b, at = RR.port) => send(at, '/api/scenes', Buffer.from(JSON.stringify(b)), { headers: { 'Content-Type': 'application/json' } });
    const w = sse(RR.port, '/api/scenes/watch');
    await w.ready; await w.next(ev('hello'), 3000);
    const m = await make({ name: 'new one' });
    ok(m.status === 201 && JSON.stringify(m.json()) === '{"ok":true,"name":"new one"}' && !!obj('new one/.scene') && (await rget('/api/scenes/new%20one')).json().files.length === 0, '201, its marker (.scene, never listed) in the bucket');
    ok(!!(await w.next(ev('scenes', d => d.scenes.some(x => x.name === 'new one')), 3000)), 'the watch told');
    seed('afile', 'x');
    ok((await make({ name: 'new one' })).status === 409 && (await make({ name: 'afile' })).status === 409 && (await make({ name: 'bad!' })).status === 400, 'a scene of that name, or an object at the top by it: 409; a bad name: 400');
    const upr = (p, body, o = {}) => send(o.at || RR.port, `/api/scenes/${o.scene || 'new%20one'}/file?path=${encodeURIComponent(p)}${o.replace ? '&replace=1' : ''}`, body, o);
    const A = bytes(5000), B = bytes(3000), t0 = Date.now(), r = await upr('models/a.glb', A), a = r.json();
    ok(r.status === 200 && a.ok === true && a.path === 'models/a.glb' && a.bytes === 5000 && a.at === obj('new one/models/a.glb').at && obj('new one/models/a.glb').body.equals(A) &&
      obj('new one/models/a.glb').type === 'model/gltf-binary', '200 { ok, path, bytes, at }: the bytes into the bucket, with its type');
    const told = await w.next(ev('scene', d => d.path === 'models/a.glb'), 3000);
    ok(told && told.at - t0 < 1000, `the watch told at once (${told ? told.at - t0 : '-'} ms)`);
    ok((await upr('models/a.glb', B)).status === 409 && obj('new one/models/a.glb').body.equals(A) && (await upr('models/a.glb', B, { replace: true })).status === 200 && obj('new one/models/a.glb').body.equals(B), 'there: 409; replace=1: replaced');
    seed('new one/tex/dir.png/x.png', 'x');
    ok((await upr('tex/dir.png', Buffer.from('x'), { replace: true })).status === 409 && (await upr('models/a.glb/x.glb', Buffer.from('x'))).status === 409, 'a folder of that name, or a file where a folder of the path should be: 409');
    const bad = [];
    for (const p of ['', '../x.glb', '.hidden.glb', '.history/x.glb', 'a\\b.glb', 'a//b.glb', 'x.glb.tmp', 'layout.json', 'notes.txt', 'con.glb', 'a/b/c/d/e/f.glb']) bad.push((await upr(p, Buffer.from('x'))).status);
    ok(bad.every(x => x === 400) && (await upr('a.glb', Buffer.from('x'), { scene: 'nope' })).status === 404, 'the path rules: 400; no such scene: 404 (' + bad.join(' ') + ')');
    const keys0 = S3.keys().length, exact = await upr('big/exact.bin', bytes(MB)), b1 = await upr('big2/x.bin', bytes(MB + 1)), b2 = await upr('big3/x.bin', bytes(3 * MB), { chunked: true });
    ok(exact.status === 200 && obj('new one/big/exact.bin').body.length === MB && b1.status === 413 && b2.status === 413 && S3.keys().length === keys0 + 1, `exactly 1 MB: 200; past it 413 by Content-Length (${b1.status}) and as it streams (${b2.status}); nothing of those in the bucket`);
    const s = net.connect(RR.port, '127.0.0.1');
    await new Promise(x => s.once('connect', x));
    s.write('POST /api/scenes/new%20one/file?path=cut%2Fx.glb HTTP/1.1\r\nHost: x\r\nContent-Length: 100000\r\n\r\n');
    s.write(bytes(30000));
    await sleep(300); s.destroy(); await sleep(500);
    ok(!obj('new one/cut/x.glb') && r2tmp() === tmp0 && /an upload of cut\/x\.glb was cut short \(30000 bytes came\)/.test(RR.out), 'cut short: nothing in the bucket, its temporary folder gone, said in the log');
    const [x1, x2] = await Promise.all([upr('race.glb', bytes(200000)), upr('race.glb', bytes(200000))]);
    ok([x1.status, x2.status].sort().join() === '200,409', `two at once to one new name: one 200, one 409 (${x1.status} ${x2.status})`);
    ok(/scenes: new one: wrote models\/a\.glb into the bucket \(5\.0 kB/.test(RR.out) && r2tmp() === tmp0, 'said in the log; no temporary folder left');
    w.close();
  });

  await step('R2: POST .../copy copies a file of another scene inside the bucket (CopyObject, its x-amz-copy-source signed in the header: nothing passes through the relay), told at once; 409 unless replace, an upload\'s paths and kinds, a source not there', async () => {
    const cp = (scene, b) => send(RR.port, `/api/scenes/${scene}/copy`, Buffer.from(JSON.stringify(b)), { headers: { 'Content-Type': 'application/json' } });
    const w = sse(RR.port, '/api/scenes/watch');
    await w.ready; await w.next(ev('hello'), 3000);
    const n0 = S3.requests.length, t0 = Date.now(), r = await cp('new%20one', { from: 'alpha', path: 'tex/wall.PNG' }), a = r.json(), mine = S3.requests.slice(n0);
    const cq = mine.find(q => q.method === 'PUT' && q.headers['x-amz-copy-source']);
    ok(r.status === 200 && a.ok === true && a.path === 'tex/wall.PNG' && !!obj('new one/tex/wall.PNG') && obj('new one/tex/wall.PNG').body.equals(obj('alpha/tex/wall.PNG').body) && a.bytes === 40 &&
      a.at === obj('new one/tex/wall.PNG').at && obj('new one/tex/wall.PNG').type === obj('alpha/tex/wall.PNG').type, '200 { ok, path, bytes, at }: the object copied in the bucket, with its type');
    ok(!!cq && cq.auth === 'header' && /SignedHeaders=[^,]*x-amz-copy-source/.test(cq.headers.authorization) && cq.status === 200 && cq.headers['x-amz-copy-source'] === '/scenes/studio/alpha/tex/wall.PNG' &&
      !mine.some(q => q.method === 'GET' && q.url.startsWith('/scenes/studio/alpha/tex/wall.PNG')), 'by CopyObject, its x-amz-copy-source signed in the header; nothing of it fetched by the relay');
    const told = await w.next(ev('scene', d => d.name === 'new one' && d.path === 'tex/wall.PNG'), 3000);
    ok(told && told.at - t0 < 1000, `the watch told at once (${told ? told.at - t0 : '-'} ms)`);
    const again = await cp('new%20one', { from: 'alpha', path: 'tex/wall.PNG' }), rp = await cp('new%20one', { from: 'alpha', path: 'tex/photo.jpeg', as: 'tex/wall.PNG', replace: true });
    ok(again.status === 409 && rp.status === 200 && obj('new one/tex/wall.PNG').body.equals(obj('alpha/tex/photo.jpeg').body), 'there: 409; replace: true replaces it');
    const nt = await cp('new%20one', { from: 'alpha', path: 'tex/photo.jpeg', as: 'pic.txt' }), no2 = await cp('new%20one', { from: 'alpha', path: 'tex/photo.jpeg', as: 'originals/pic.txt' });
    ok(nt.status === 400 && /outside originals/.test(nt.text) && no2.status === 200 && !!obj('new one/originals/pic.txt') && obj('new one/originals/pic.txt').body.equals(obj('alpha/tex/photo.jpeg').body),
      'a kind an upload takes only under originals/ (by the path it goes to): 400 elsewhere, 200 there (' + nt.status + ' ' + no2.status + ')');
    const keys0 = S3.keys().length, st = [];
    for (const b of [{ from: 'alpha', path: 'layout.json' }, { from: 'alpha', path: '.history/layout-old.json' }, { from: 'alpha', path: 'x.tmp' }, { from: 'alpha', path: 'data.bin', as: '../x.bin' }]) st.push((await cp('new%20one', b)).status);
    for (const [sc, b] of [['nope', { from: 'alpha', path: 'data.bin' }], ['new%20one', { from: 'nope', path: 'data.bin' }], ['new%20one', { from: 'alpha', path: 'none.glb' }]]) st.push((await cp(sc, b)).status);
    ok(st.join() === '400,400,400,400,404,404,404' && S3.keys().length === keys0, 'what no listing shows, a target an upload may not have: 400; no such scene or file: 404; nothing copied (' + st.join() + ')');
    ok(/scenes: new one: copied tex\/wall\.PNG from alpha\/tex\/wall\.PNG in the bucket/.test(RR.out) && noLeak(RR.out), 'said in the log, no signed link or key in it');
    w.close();
  });

  await step('R2: direct uploads: .../put gives a signed PUT (its type, length and If-None-Match signed) the stand-in takes from a page\'s origin; .../done looks and tells the watch at once; the checks; a folder relay answers 501', async () => {
    const api = (what, q, at = RR.port, scene = 'new%20one') => req('POST', `/api/scenes/${scene}/${what}?${q}`, { at });
    const w = sse(RR.port, '/api/scenes/watch');
    await w.ready; await w.next(ev('hello'), 3000);
    const p = await api('put', 'path=models%2Fb.glb&size=4'), pj = p.json();
    ok(p.status === 200 && pj.url.startsWith(S3.url + '/scenes/studio/new%20one/models/b.glb?') && JSON.stringify(pj.headers) === '{"Content-Type":"model/gltf-binary","If-None-Match":"*"}' && pj.path === 'models/b.glb' && pj.expires === 3600,
      'put: { url, headers (its type, If-None-Match: *), path, expires }');
    const pre = await fetch(pj.url, { method: 'OPTIONS', headers: { Origin: 'https://x.github.io', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type,if-none-match' } });
    const up = await fetch(pj.url, { method: 'PUT', headers: { ...pj.headers, Origin: 'https://x.github.io' }, body: Buffer.from('glTF') });
    ok(pre.status === 200 && up.status === 200 && up.headers.get('access-control-allow-origin') === '*' && obj('new one/models/b.glb').body.toString() === 'glTF' && obj('new one/models/b.glb').type === 'model/gltf-binary',
      'the page\'s preflight and its PUT, straight into the bucket');
    const t0 = Date.now(), d = await api('done', 'path=models%2Fb.glb&size=4'), told = await w.next(ev('scene', x => x.path === 'models/b.glb'), 3000);
    ok(d.status === 200 && JSON.stringify(Object.keys(d.json())) === '["ok","path","bytes","at"]' && d.json().bytes === 4 && d.json().at === obj('new one/models/b.glb').at && told && told.at - t0 < 1000,
      `done: { ok, path, bytes, at }; the watch told at once (${told ? told.at - t0 : '-'} ms)`);
    const again = await api('put', 'path=models%2Fb.glb&size=4'), rep = (await api('put', 'path=models%2Fb.glb&size=5&replace=1')).json();
    const up2 = await fetch(rep.url, { method: 'PUT', headers: rep.headers, body: Buffer.from('glTF2') });
    ok(again.status === 409 && !('If-None-Match' in rep.headers) && up2.status === 200 && obj('new one/models/b.glb').body.toString() === 'glTF2', 'there: 409; replace=1: a link without If-None-Match, which replaces it');
    const big = (await api('put', 'path=models%2Fc.glb&size=4')).json();
    const wrongSize = await fetch(big.url, { method: 'PUT', headers: big.headers, body: Buffer.from('glTF and more') }), wrongType = await fetch(big.url, { method: 'PUT', headers: { ...big.headers, 'Content-Type': 'text/html' }, body: Buffer.from('glTF') });
    const nothing = await api('done', 'path=models%2Fc.glb');
    ok(wrongSize.status === 403 && wrongType.status === 403 && !obj('new one/models/c.glb') && nothing.status === 400 && /nothing came/.test(nothing.json().error), 'a body of another size or type: refused by the bucket (403); done then: 400');
    const s = [await api('put', 'path=x.glb&size=' + (MB + 1)), await api('put', 'path=x.glb'), await api('put', 'path=..%2Fx.glb&size=1'), await api('put', 'path=notes.txt&size=1'), await api('put', 'path=x.glb&size=-1'),
      await api('put', 'path=x.glb&size=1', RR.port, 'nope'), await api('done', 'path=x.glb', RR.port, 'nope')];
    ok(s.map(x => x.status).join() === '413,400,400,400,400,404,404', 'over --max-upload: 413; no size, a bad path or kind, a bad size: 400; no such scene: 404 (' + s.map(x => x.status).join() + ')');
    seed('new one/odd.glb', 'abc');
    ok((await api('done', 'path=odd.glb&size=4')).status === 400, 'done with another size than the bucket holds: 400');
    seed('new one/huge.bin', bytes(MB + 10));
    const hg = await api('done', 'path=huge.bin');
    ok(hg.status === 413 && !!obj('new one/huge.bin') && /huge\.bin in the bucket is .*left there \(it did not come by a link of this relay's\)/.test(RR.out),
      'done for an object over --max-upload that no link of the relay\'s brought (put another way, such as r2sync): 413, and it is left there');
    ok((await req('POST', '/api/scenes/one/put?path=x.glb&size=1', { at: UP.port })).status === 501 && (await req('GET', '/api/scenes/new%20one/put?path=x.glb&size=1', { at: RR.port })).status === 405,
      'a relay whose scenes are a folder: 501; GET: 405');
    ok(noLeak(RR.out) && !(await req('POST', '/api/scenes/new%20one/put?path=..%2Fx&size=1', { at: RR.port })).text.includes('X-Amz'), 'no signed link in the log or in an error');
    w.close();
  });

  await step('R2: recordings/ by the same rule: a recording through the relay and straight into the bucket, stored and signed as application/json, listed and told as kind recording', async () => {
    const J = Buffer.from(JSON.stringify({ studio: 1, recording: 1, item: 'Box', len: 1, n: 2, k: [[0, 0, 0, 0, 0, 0, 0, 1], [1, 1, 0, 0, 0, 0, 0, 1]] }));
    const upr = (p, body, o = {}) => send(RR.port, `/api/scenes/new%20one/file?path=${encodeURIComponent(p)}${o.replace ? '&replace=1' : ''}`, body, o);
    const api = (what, q) => req('POST', `/api/scenes/new%20one/${what}?${q}`, { at: RR.port });
    const w = sse(RR.port, '/api/scenes/watch');
    await w.ready; await w.next(ev('hello'), 3000);
    const r = await upr('recordings/Box-1.json', J);
    ok(r.status === 200 && obj('new one/recordings/Box-1.json').body.equals(J) && obj('new one/recordings/Box-1.json').type === 'application/json', 'through the relay: 200, into the bucket as application/json');
    ok(!!(await w.next(ev('scene', d => d.path === 'recordings/Box-1.json' && d.kind === 'recording'), 3000)), 'the watch tells it as kind recording');
    const L = (await rget('/api/scenes/new%20one')).json(), f = L.files.find(x => x.path === 'recordings/Box-1.json');
    ok(!!f && f.kind === 'recording' && typeof f.url === 'string' && f.url.startsWith(S3.url), 'listed as kind recording, with its signed link');
    const g = await fetch(f.url);
    ok(g.status === 200 && Buffer.from(await g.arrayBuffer()).equals(J), 'its link gives the recording');
    const p = await api('put', 'path=recordings%2FBox-2.json&size=' + J.length), pj = p.json();
    ok(p.status === 200 && pj.headers['Content-Type'] === 'application/json' && pj.path === 'recordings/Box-2.json', 'put: a signed link for it, its type application/json');
    const up = await fetch(pj.url, { method: 'PUT', headers: pj.headers, body: J }), d = await api('done', 'path=recordings%2FBox-2.json&size=' + J.length);
    ok(up.status === 200 && d.status === 200 && obj('new one/recordings/Box-2.json').body.equals(J) && !!(await w.next(ev('scene', x => x.path === 'recordings/Box-2.json' && x.kind === 'recording'), 3000)), 'the PUT and done: 200, told as kind recording');
    const s2 = [await api('put', 'path=data%2Fa.json&size=10'), await upr('data/a.json', J)];
    ok(s2.every(x => x.status === 400), `a .json elsewhere: 400 (${s2.map(x => x.status).join(' ')})`);
    ok(noLeak(RR.out), 'no signed link or key in the log');
    for (const k of S3.keys()) if (k.startsWith(PFX + 'new one/recordings/')) S3.del(k);   // (the steps after know the scene without them)
    w.close();
  });

  await step('R2: previews/ by the same rule: a model\'s picture through the relay and straight into the bucket (.../put signs its size; at most 200 KB), listed and told as kind preview; other kinds refused; done and copies by it', async () => {
    const J = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), bytes(5000)]), KB200 = 200 << 10;
    const upr = (p, body, o = {}) => send(RR.port, `/api/scenes/new%20one/file?path=${encodeURIComponent(p)}${o.replace ? '&replace=1' : ''}`, body, o);
    const api = (what, q) => req('POST', `/api/scenes/new%20one/${what}?${q}`, { at: RR.port });
    const w = sse(RR.port, '/api/scenes/watch');
    await w.ready; await w.next(ev('hello'), 3000);
    const r = await upr('previews/models/a.glb.jpg', J);
    ok(r.status === 200 && obj('new one/previews/models/a.glb.jpg').body.equals(J) && obj('new one/previews/models/a.glb.jpg').type === 'image/jpeg', 'through the relay: 200, into the bucket as image/jpeg');
    const told = await w.next(ev('scene', d => d.path === 'previews/models/a.glb.jpg'), 3000);
    ok(told && told.data.kind === 'preview', 'the watch tells it as kind preview');
    const L = (await rget('/api/scenes/new%20one')).json(), f = L.files.find(x => x.path === 'previews/models/a.glb.jpg');
    ok(!!f && f.kind === 'preview' && typeof f.url === 'string' && f.url.startsWith(S3.url), 'listed as kind preview, with its signed link');
    const pg = await fetch(f.url);
    ok(pg.status === 200 && Buffer.from(await pg.arrayBuffer()).equals(J), 'its link gives the picture');
    const bad = [];
    for (const p of ['previews/a.png', 'previews/a.JPG', 'previews/models/a.glb', 'Previews/x.jpg']) bad.push((await upr(p, J)).status);
    const b1 = await upr('previews/big.jpg', bytes(KB200 + 1)), b2 = await upr('previews/big2.jpg', bytes(3 * KB200), { chunked: true });
    ok(bad.every(x => x === 400) && b1.status === 413 && b2.status === 413 && /at most 200 KB/.test(b2.json().error) && !obj('new one/previews/big.jpg') && !obj('new one/previews/big2.jpg') && r2tmp() === tmp0,
      `other kinds: 400 (${bad.join(' ')}); past 200 KB: 413 by Content-Length and as it streams; nothing in the bucket or left behind`);
    // straight into the bucket
    const p = await api('put', 'path=previews%2Fmodels%2Fb.glb.jpg&size=' + J.length), pj = p.json();
    ok(p.status === 200 && pj.headers['Content-Type'] === 'image/jpeg' && pj.path === 'previews/models/b.glb.jpg', 'put: a signed link for it, its type image/jpeg');
    const up = await fetch(pj.url, { method: 'PUT', headers: pj.headers, body: J }), d = await api('done', 'path=previews%2Fmodels%2Fb.glb.jpg&size=' + J.length);
    ok(up.status === 200 && d.status === 200 && obj('new one/previews/models/b.glb.jpg').body.equals(J) && !!(await w.next(ev('scene', x => x.path === 'previews/models/b.glb.jpg' && x.kind === 'preview'), 3000)),
      'the PUT and done: 200, told as kind preview');
    const s = [await api('put', 'path=previews%2Fc.jpg&size=' + (KB200 + 1)), await api('put', 'path=previews%2Fc.png&size=10')];
    ok(s[0].status === 413 && /at most 200 KB/.test(s[0].json().error) && s[1].status === 400, `put: over 200 KB 413, not a .jpg 400 (${s.map(x => x.status).join(' ')})`);
    seed('new one/previews/huge.jpg', bytes(KB200 + 10));
    const hg = await api('done', 'path=previews%2Fhuge.jpg');
    ok(hg.status === 413 && !!obj('new one/previews/huge.jpg') && /previews\/huge\.jpg in the bucket is .*more than a picture in previews\/ takes: left there/.test(RR.out),
      'done for a picture over 200 KB no link of the relay\'s brought: 413, left there');
    const cp = b => send(RR.port, '/api/scenes/new%20one/copy', Buffer.from(JSON.stringify(b)), { headers: { 'Content-Type': 'application/json' } });
    const c1 = await cp({ from: 'new one', path: 'previews/models/a.glb.jpg', as: 'previews/models/c.glb.jpg' }), c2 = await cp({ from: 'new one', path: 'previews/huge.jpg', as: 'previews/h.jpg' });
    ok(c1.status === 200 && obj('new one/previews/models/c.glb.jpg').body.equals(J) && c2.status === 413 && !obj('new one/previews/h.jpg'), `copies in the bucket by the same rule (${c1.status} ${c2.status})`);
    ok(noLeak(RR.out), 'no signed link or key in the log');
    for (const k of S3.keys()) if (k.startsWith(PFX + 'new one/previews/')) S3.del(k);   // (the steps after know the scene without them)
    w.close();
  });

  await step('R2: POST .../sound: ffmpeg (a stand-in) makes the MP3 from the body, or (from=) from a file already in the bucket; it goes into the bucket; failures and the rules; nothing left behind', async () => {
    const W = bytes(40000), r = await send(RR.port, '/api/scenes/new%20one/sound?path=sounds%2Fa.mp3', W);
    ok(r.status === 200 && r.json().bytes === FF_OUT.length && obj('new one/sounds/a.mp3').body.equals(FF_OUT) && obj('new one/sounds/a.mp3').type === 'audio/mpeg' &&
      ffNotes('ok').some(n => n.input === sha(W)), 'from the body: 200, ffmpeg\'s MP3 in the bucket (audio/mpeg)');
    const W2 = bytes(30000);
    seed('new one/originals/long.wav', W2);
    const f = await send(RR.port, '/api/scenes/new%20one/sound?from=originals%2Flong.wav&path=sounds%2Flong.mp3', null);
    ok(f.status === 200 && obj('new one/sounds/long.mp3').body.equals(FF_OUT) && ffNotes('ok').some(n => n.input === sha(W2)) && /wrote sounds\/long\.mp3 into the bucket .* from originals\/long\.wav/.test(RR.out),
      'from=originals/long.wav: ffmpeg given the file fetched from the bucket, the MP3 put there');
    const s = [await send(RR.port, '/api/scenes/new%20one/sound?from=originals%2Fnope.wav&path=sounds%2Fn.mp3', null), await send(RR.port, '/api/scenes/new%20one/sound?from=..%2Fx&path=sounds%2Fn.mp3', null),
      await send(RR.port, '/api/scenes/new%20one/sound?path=sounds%2Fa.mp3', W), await send(RR.port, '/api/scenes/new%20one/file?from=originals%2Flong.wav&path=x.glb', null),
      await send(UP.port, '/api/scenes/one/sound?from=originals%2Fx.wav&path=sounds%2Fn.mp3', null)];
    ok(s.map(x => x.status).join() === '400,400,409,400,400', 'from= a file not there or not a scene\'s: 400; the MP3 there: 409; from= with .../file, or on a folder relay: 400 (' + s.map(x => x.status).join() + ')');
    const F = await start(['--scenes', 'r2', '--ffmpeg', ff('fail'), '--quiet'], R2ENV);
    const ff1 = await send(F.port, '/api/scenes/new%20one/sound?path=sounds%2Ff.mp3', W);
    ok(ff1.status === 422 && !obj('new one/sounds/f.mp3') && r2tmp() === tmp0, 'ffmpeg failing: 422, nothing in the bucket, no temporary folder left');
    F.kill();
  });

  await step('R2 with a password: every endpoint needs it, the signed links do not (they are the permission); no password in a link or in what reached the bucket; the start refuses missing settings (named, never a value), a wrong key or bucket, no answer; --r2-check; --public needs a password', async () => {
    const PASS = 'r2pass' + crypto.randomBytes(5).toString('hex');
    const T = await start(['--scenes', 'r2', '--proxy'], { ...R2ENV, COLLAB_TOKEN: PASS });
    let n = 0;
    const tget = (p, o = {}) => req(o.method || 'GET', p, { at: T.port, headers: { 'X-Forwarded-For': '198.51.100.' + (++n), ...(o.headers || {}) }, body: o.body });
    const asks = [['GET', '/api/scenes'], ['GET', '/api/scenes/alpha'], ['GET', '/scenes/alpha/model.glb'], ['POST', '/api/scenes/beta/layout'], ['POST', '/api/scenes/beta/put?path=x.glb&size=1'],
      ['POST', '/api/scenes/beta/done?path=x.glb'], ['POST', '/api/scenes/beta/file?path=x.glb'], ['GET', '/api/scenes/watch']];
    const st = [];
    for (const [m, p] of asks) st.push((await tget(p, { method: m, body: m === 'POST' ? '{}' : undefined })).status);
    ok(st.every(x => x === 401), 'without it: 401 for each (' + st.join(' ') + ')');
    const one = (await tget('/api/scenes/alpha', { headers: { Authorization: 'Bearer ' + PASS } })).json(), red = await tget('/scenes/alpha/model.glb?token=' + PASS);
    ok(one.files.length === R2_FILES.length - 1 && one.files.every(f => !f.url.includes(PASS)) && (await fetch(one.files[0].url)).status === 200 && red.status === 302 && !red.headers.location.includes(PASS) && (await fetch(red.headers.location)).status === 200,
      'with it: the listing\'s links and the redirect\'s carry no password, and work without one');
    const put = (await tget('/api/scenes/beta/put?path=pw.glb&size=2', { method: 'POST', headers: { Authorization: 'Bearer ' + PASS } })).json();
    ok(!!put.url && !put.url.includes(PASS) && (await fetch(put.url, { method: 'PUT', headers: put.headers, body: 'ab' })).status === 200, 'a put link with it, no password in it');
    ok(S3.requests.every(q => !JSON.stringify(q).includes(PASS)) && !T.out.includes(PASS) && noLeak(T.out), 'the password never reached the bucket, nor any log line; no secret or signed link logged');
    T.kill();
    const env0 = { R2_ENDPOINT: '', R2_ACCOUNT_ID: '', R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '', R2_BUCKET: '', R2_PREFIX: '' };
    const [miss, wrongKey, wrongBucket, away, pub, check, nocheck] = await Promise.all([
      startFails(['--scenes', 'r2'], { ...env0, R2_SECRET_ACCESS_KEY: 'SHOULDNOTSHOW' }),
      startFails(['--scenes', 'r2'], { ...R2ENV, R2_SECRET_ACCESS_KEY: 'not-the-secret-SHOULDNOTSHOW' }),
      startFails(['--scenes', 'r2'], { ...R2ENV, R2_BUCKET: 'other-bucket' }),
      startFails(['--scenes', 'r2'], { ...R2ENV, R2_ENDPOINT: 'https://nowhere.invalid' }),
      startFails(['--scenes', 'r2', '--public'], R2ENV),
      startFails(['--scenes', 'r2', '--r2-check'], R2ENV),
      startFails(['--r2-check'], {})]);
    ok(miss.code === 1 && /--scenes r2: missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_BUCKET in the environment/.test(miss.out) && !miss.out.includes('SHOULDNOTSHOW'), 'missing settings: refused, each named, no value shown: ' + miss.out.trim().slice(0, 160));
    ok(wrongKey.code === 1 && /R2 refused the keys \(403 SignatureDoesNotMatch\)/.test(wrongKey.out) && !wrongKey.out.includes('SHOULDNOTSHOW') && wrongBucket.code === 1 && /there is no bucket other-bucket/.test(wrongBucket.out) &&
      away.code === 1 && /could not reach nowhere\.invalid \(ENOTFOUND\)/.test(away.out) && [wrongKey, wrongBucket, away].every(x => !/listening/.test(x.out)), 'a wrong secret, a bucket that is not there, an address that is no one\'s: refused before listening, saying which');
    ok(pub.code === 1 && /--public with --scenes needs a password/.test(pub.out) && check.code === 0 && /--r2-check: the keys may list the bucket scenes \(under studio\/\)/.test(check.out) && /--r2-check: all is well/.test(check.out) &&
      /R2 upload links: taken with their type, length and If-None-Match signed/.test(check.out) &&
      nocheck.code === 1 && /--r2-check goes with --scenes r2/.test(nocheck.out), '--public without a password refused; --r2-check: all is well (exit 0); --r2-check alone refused');
    const S3B = await startFake({ bucket: 'scenes', keys: { [R2KEY]: R2SECRET }, cors: [] });
    const bad = await startFails(['--scenes', 'r2', '--r2-check'], { ...R2ENV, R2_ENDPOINT: S3B.url });
    ok(bad.code === 1 && /download with a range NO, upload NO/.test(bad.out) && /the bucket has no CORS rule/.test(bad.out) && /paste the rule in relay\/README\.md/.test(bad.out), '--r2-check on a bucket with no CORS rule: says so (exit 1)');
    await S3B.close();
  });
  await step('R2: the start tries an upload link (all signed, only the type, refused, If-None-Match ignored); done removes past --max-upload only what its own link brought; a failed save costs no history; three uploads through the relay at once; a bucket that does not answer at the start', async () => {
    const SQ = await startFake({ bucket: 'scenes', keys: { [R2KEY]: R2SECRET } }), envQ = { ...R2ENV, R2_ENDPOINT: SQ.url, R2_RETRY: '3' };
    const sq = rel => SQ.objects.get(PFX + rel), sqKeys = () => SQ.keys().filter(k => !k.includes('.put-check-'));
    SQ.put(PFX + 'q/a.glb', 'glTF', { type: 'model/gltf-binary' });
    const waitFor = async (P, re, ms = 6000) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (re.test(P.out)) return true; return false; };
    const qapi = (P, what, q) => req('POST', `/api/scenes/q/${what}?${q}`, { at: P.port });
    // the bucket refuses a signed length: links with only their type signed; the size checked at done; one past
    // --max-upload that its own link brought removed
    SQ.quirks = { refuseSigned: ['content-length'] };
    const QT = await start(['--scenes', 'r2', '--max-upload', '1'], envQ);
    ok(await waitFor(QT, /R2 upload links: taken with only their type signed \(the bucket refused their length and If-None-Match signed\).*; a second upload to the same new name refused \(412/) &&
      (await req('GET', '/api/scenes', { at: QT.port })).json().direct === true, 'a store that refuses a signed length: the start says links go with only their type signed (If-None-Match still honoured); direct uploads on');
    const t = (await qapi(QT, 'put', 'path=t.glb&size=4')).json();
    const tp = await fetch(t.url, { method: 'PUT', headers: t.headers, body: 'glTF' }), td = await qapi(QT, 'done', 'path=t.glb&size=4');
    ok(/X-Amz-SignedHeaders=content-type%3Bhost&/.test(t.url) && tp.status === 200 && td.status === 200 && sq('q/t.glb').body.toString() === 'glTF', 'its link (type signed) taken, done: 200');
    const b = (await qapi(QT, 'put', 'path=big.bin&size=10')).json();
    const bp = await fetch(b.url, { method: 'PUT', headers: b.headers, body: bytes(MB + 10) }), bd = await qapi(QT, 'done', 'path=big.bin&size=10');
    ok(bp.status === 200 && bd.status === 413 && !sq('q/big.bin') && /removed big\.bin \(.* came straight into the bucket by its link: more than --max-upload\)/.test(QT.out),
      'a body past --max-upload through its own link (its length not signed): done 413, and it is removed');
    const w = (await qapi(QT, 'put', 'path=w.glb&size=4')).json(), wp = await fetch(w.url, { method: 'PUT', headers: w.headers, body: 'glTF+' }), wd = await qapi(QT, 'done', 'path=w.glb&size=4');
    ok(wp.status === 200 && wd.status === 400 && /holds 5 bytes, not the 4 said/.test(wd.json().error), 'another size than said (not signed, so taken by the bucket): done 400');
    // a save that fails after the old layout went into .history/ costs nothing more each time it is tried again
    SQ.put(PFX + 'q/layout.json', JSON.stringify({ studio: 1, scene: 'q', objects: [] }), { type: 'application/json' });
    const hq = () => SQ.keys().filter(k => k.startsWith(PFX + 'q/.history/')).length, saveQ = n => req('POST', '/api/scenes/q/layout', { at: QT.port, body: { studio: 1, scene: 'q', n, objects: [] } });
    SQ.quirks.fail = (m, key) => (m === 'PUT' && key === PFX + 'q/layout.json' ? 500 : 0);
    const f1 = await saveQ(1), h1 = hq(), f2 = await saveQ(2), f3 = await saveQ(3);
    ok(f1.status === 502 && /storage \(R2\) answered 500/.test(f1.json().error) && h1 === 1 && f2.status === 502 && f3.status === 502 && hq() === 1 && !('n' in JSON.parse(sq('q/layout.json').body)),
      `layout.json refused by the bucket: 502, the old one kept in .history/ once, not again on each try (${h1}, ${hq()})`);
    SQ.quirks.fail = null;
    const s4 = await saveQ(4), h4 = hq(), n4 = JSON.parse(sq('q/layout.json').body).n, s5 = await saveQ(5);
    ok(s4.status === 200 && h4 === 1 && n4 === 4 && s5.status === 200 && hq() === 2, 'then it goes in (the copy already there: none more); the next save copies as ever');
    // three uploads through the relay at once, a fourth told to wait (429, Retry-After); the first three cut, then one goes
    const held = [];
    for (let i = 0; i < 3; i++) {
      const so = net.connect(QT.port, '127.0.0.1');
      await new Promise(x => so.once('connect', x));
      so.write(`POST /api/scenes/q/file?path=hold${i}.bin HTTP/1.1\r\nHost: x\r\nContent-Length: 500000\r\n\r\n`); so.write(bytes(1000));
      held.push(so);
    }
    await sleep(700);
    const busy = await send(QT.port, '/api/scenes/q/file?path=four.bin', bytes(100));
    ok(busy.status === 429 && busy.headers['retry-after'] === '5' && /3 uploads are on their way through the relay already/.test(busy.json().error) && !sq('q/four.bin'), 'a fourth upload through the relay at once: 429 with Retry-After');
    for (const so of held) so.destroy();
    await sleep(600);
    ok((await send(QT.port, '/api/scenes/q/file?path=four.bin', bytes(100))).status === 200 && !!sq('q/four.bin'), 'once those went: taken');
    QT.kill();
    // done for an object it never gave a link for, past --max-upload: left there
    SQ.quirks = {};
    // both refused: no upload links (direct false, .../put 501); If-None-Match ignored: said
    SQ.quirks = { refuseSigned: ['content-type'] };
    const QO = await start(['--scenes', 'r2', '--quiet'], envQ);
    ok(await waitFor(QO, /R2 upload links: the bucket refused them \(403 SignatureDoesNotMatch\), even with only their type signed: pages send their files through the relay/) &&
      (await req('GET', '/api/scenes', { at: QO.port })).json().direct === false && (await qapi(QO, 'put', 'path=x.glb&size=1')).status === 501, 'a store that refuses both: direct false, .../put 501, pages send files through the relay');
    QO.kill();
    SQ.quirks = { ignoreIfNoneMatch: true };
    const QI = await start(['--scenes', 'r2', '--quiet'], envQ);
    ok(await waitFor(QI, /the bucket did NOT refuse a second upload to the same new name \(If-None-Match ignored\)/) && (await req('GET', '/api/scenes', { at: QI.port })).json().direct === true, 'If-None-Match ignored: said; direct uploads on');
    QI.kill();
    // a bucket that does not answer at the start (a 5xx; nothing at its address): the relay starts all the same, its
    // rooms work, the scenes answer 502, and it is asked again until it answers
    SQ.quirks = { fail: () => 503 };
    const Q5 = await start(['--scenes', 'r2'], envQ);
    const room5 = await req('POST', '/api/rooms', { at: Q5.port, body: { app: 'networks', version: 'v1' } }), sc5 = await req('GET', '/api/scenes', { at: Q5.port });
    ok(/the bucket scenes answered 503 InternalError\n--scenes r2: the relay starts all the same/.test(Q5.out) && room5.status === 201 && sc5.status === 502 && /storage \(R2\) answered 503/.test(sc5.json().error),
      'a 5xx at the start: listening anyway, a room made, the scenes 502');
    SQ.quirks = {};
    ok(await waitFor(Q5, /scenes: the bucket scenes answers now/, 8000) && (await req('GET', '/api/scenes', { at: Q5.port })).json().scenes.some(x => x.name === 'q') && await waitFor(Q5, /R2 upload links: taken/),
      'once it answers: said, the scenes listed, its CORS rule and upload links checked');
    Q5.kill();
    const fp = await new Promise(r => { const sv = net.createServer().listen(0, '127.0.0.1', () => { const p = sv.address().port; sv.close(() => r(p)); }); });
    const QN = await start(['--scenes', 'r2'], { ...envQ, R2_ENDPOINT: 'http://127.0.0.1:' + fp });
    ok(/could not reach 127\.0\.0\.1:\d+ \(ECONNREFUSED\).*\n--scenes r2: the relay starts all the same/.test(QN.out) && (await req('GET', '/api/scenes', { at: QN.port })).status === 502, 'nothing at its address: listening anyway, the scenes 502');
    const SN = await startFake({ port: fp, bucket: 'scenes', keys: { [R2KEY]: R2SECRET } });
    SN.put(PFX + 'n/a.glb', 'glTF');
    ok(await waitFor(QN, /scenes: the bucket scenes answers now/, 8000) && (await req('GET', '/api/scenes', { at: QN.port })).json().scenes.map(x => x.name).join() === 'n', 'a store there later: found by itself, its scenes listed');
    QN.kill();
    await SN.close(); await SQ.close();
    ok(noLeak(QT.out + QO.out + QI.out + Q5.out + QN.out), 'no secret or signed link in their logs');
  });
  await step('R2: tools/studio/r2sync.mjs: list; pull onto a folder (scan.mjs then lists it as the relay does), again nothing; push what changed (--dry first), --delete, --history; settings refused', async () => {
    // (run as a process of its own, never synchronously: the stand-in answers from this one)
    const sync = (args, env = R2ENV) => new Promise(resolve => {
      const p = spawn(process.execPath, [path.join(REPO, 'tools/studio/r2sync.mjs'), ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
      let out = '';
      p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
      const t = setTimeout(() => p.kill(), 60000);
      p.on('exit', code => { clearTimeout(t); resolve({ code, out }); });
    });
    const L = fs.mkdtempSync(path.join(os.tmpdir(), 'r2sync-')), Lp = (...p) => path.join(L, ...p);
    try {
      const l = await sync(['list']);
      ok(l.code === 0 && /scenes? in the bucket scenes \(under studio\/\)/.test(l.out) && /  alpha: \d+ files, .*layout\.json/.test(l.out) && /  new one: /.test(l.out), 'list: the bucket\'s scenes with their files');
      const p1 = await sync(['pull', '--all', L]);
      const one = (await rget('/api/scenes/alpha')).json();
      const pulledSame = one.files.every(f => fs.existsSync(Lp('alpha', ...f.path.split('/'))) && fs.readFileSync(Lp('alpha', ...f.path.split('/'))).equals(obj('alpha/' + f.path).body));
      ok(p1.code === 0 && pulledSame && fs.existsSync(Lp('alpha', 'layout.json')) && !fs.existsSync(Lp('alpha', '.history')) && !fs.existsSync(Lp('alpha', '.hidden')) && !fs.existsSync(Lp('alpha', 'x.tmp')) &&
        !fs.existsSync(Lp('alpha', 'deep', 'a', 'b', 'c', 'd')) && fs.existsSync(Lp('with space', 'x.webm')) && !fs.existsSync(Lp('bad!')) && /fetched/.test(p1.out),
        'pull --all: every listed file and layout.json, byte for byte; not .history/, dot or temporary files, too deep, or names that are not a scene\'s');
      execFileSync(process.execPath, [path.join(REPO, 'tools/studio/scan.mjs'), L], { encoding: 'utf8' });
      const fj = JSON.parse(fs.readFileSync(Lp('alpha', 'files.json'), 'utf8')), api = { name: one.name, files: one.files.map(({ url, ...f }) => f), layoutAt: one.layoutAt };
      ok(JSON.stringify({ name: fj.name, files: fj.files, layoutAt: fj.layoutAt }) === JSON.stringify(api), 'scan.mjs on the pulled folder lists alpha exactly as the relay does from the bucket (paths, sizes, kinds and times)');
      const p2 = await sync(['pull', 'alpha', L]);
      ok(p2.code === 0 && /^dry run|0 fetched/m.test(p2.out) && !/^get /m.test(p2.out), 'pull again: nothing fetched, everything the same');
      fs.writeFileSync(Lp('alpha', 'model.glb'), 'changed here'); fs.mkdirSync(Lp('alpha', 'more'), { recursive: true }); fs.writeFileSync(Lp('alpha', 'more', 'new.png'), 'png');
      const keys0 = S3.keys().join();
      const d = await sync(['push', L, 'alpha', '--dry']);
      ok(d.code === 0 && /would put alpha\/model\.glb/.test(d.out) && /would put alpha\/more\/new\.png/.test(d.out) && (d.out.match(/^would put /mg) || []).length === 2 && S3.keys().join() === keys0 && obj('alpha/model.glb').body.equals(GLB),
        'push --dry: says the two that differ, changes nothing');
      const u = await sync(['push', L, 'alpha']);
      ok(u.code === 0 && obj('alpha/model.glb').body.toString() === 'changed here' && obj('alpha/more/new.png').type === 'image/png' && /2 put/.test(u.out) && /2 put/.test(u.out) && !/^put /m.test((await sync(['push', L, 'alpha'])).out),
        'push: the two put (with their types), and again: nothing');
      fs.rmSync(Lp('alpha', 'data.bin'));
      ok((await sync(['push', L, 'alpha'])).code === 0 && !!obj('alpha/data.bin'), 'a file gone here: kept in the bucket without --delete');
      const del = await sync(['push', L, 'alpha', '--delete']);
      ok(del.code === 0 && /delete alpha\/data\.bin/.test(del.out) && !obj('alpha/data.bin') && !!obj('alpha/.history/layout-old.json') && !!obj('alpha/files.json'), 'push --delete: removed there; .history/ and what the listing leaves out untouched');
      const h = await sync(['pull', 'alpha', L, '--history']);
      ok(h.code === 0 && fs.existsSync(Lp('alpha', '.history', 'layout-old.json')), 'pull --history: the layouts in .history/ too');
      // a file newer where it would go is kept (and said) unless --force; a layout.json replaced on either side is first
      // copied into that side's .history/
      const lay = Lp('alpha', 'layout.json'), histB = () => S3.keys().filter(k => k.startsWith(PFX + 'alpha/.history/')).length, histL = () => fs.readdirSync(Lp('alpha', '.history'));
      fs.writeFileSync(lay, JSON.stringify({ studio: 1, scene: 'alpha', objects: [], here: 1 }));   // (saved here since the pull)
      const k1 = await sync(['pull', 'alpha', L]);
      ok(k1.code === 0 && /^kept alpha\/layout\.json here: it is newer there .*--force replaces it$/m.test(k1.out) && /1 kept as it is \(newer where it would go/.test(k1.out) && JSON.parse(fs.readFileSync(lay, 'utf8')).here === 1,
        'pull: a layout saved here since (newer here) kept, and said');
      const hb0 = histB(), k2 = await sync(['push', L, 'alpha']);
      ok(k2.code === 0 && JSON.parse(obj('alpha/layout.json').body).here === 1 && histB() === hb0 + 1 && /kept the bucket's old alpha\/layout\.json in its \.history\//.test(k2.out),
        'push: the newer layout here put, the bucket\'s old one first copied into its .history/');
      S3.put(PFX + 'alpha/layout.json', JSON.stringify({ studio: 1, scene: 'alpha', objects: [], there: 1 }), { type: 'application/json', at: Date.now() + 5000 });   // (saved there since)
      const k3 = await sync(['push', L, 'alpha']);
      ok(k3.code === 0 && /^kept alpha\/layout\.json in the bucket: it is newer there/m.test(k3.out) && JSON.parse(obj('alpha/layout.json').body).there === 1, 'push: a layout saved in the bucket since (newer there) kept, and said');
      const hl0 = histL().length, k4 = await sync(['pull', 'alpha', L]);
      ok(k4.code === 0 && JSON.parse(fs.readFileSync(lay, 'utf8')).there === 1 && histL().length === hl0 + 1 && histL().some(n => n !== 'layout-old.json' && JSON.parse(fs.readFileSync(Lp('alpha', '.history', n), 'utf8')).here === 1),
        'pull: the newer layout there fetched, the one here first copied into .history/ here');
      fs.writeFileSync(lay, JSON.stringify({ studio: 1, scene: 'alpha', objects: [], old: 1 })); fs.utimesSync(lay, new Date(), new Date(Date.now() - 3600e3));
      const k5 = await sync(['push', L, 'alpha']), there5 = JSON.parse(obj('alpha/layout.json').body).there, k6 = await sync(['push', L, 'alpha', '--force']);
      ok(/^kept alpha\/layout\.json in the bucket/m.test(k5.out) && there5 === 1 && k6.code === 0 && JSON.parse(obj('alpha/layout.json').body).old === 1 && /kept the bucket's old alpha\/layout\.json/.test(k6.out),
        'an older layout here: kept back; --force puts it (the bucket\'s first copied into its .history/)');
      const e1 = await sync(['list'], { ...R2ENV, R2_BUCKET: '' }), e2 = await sync(['pull', 'nope', L]), e3 = await sync(['push']);
      ok(e1.code === 1 && /missing R2_BUCKET/.test(e1.out) && e2.code === 1 && /no scene "nope"/.test(e2.out) && e3.code === 1 && /usage/.test(e3.out) && !(e1.out + e2.out).includes(R2SECRET),
        'missing settings, no such scene, no folder: refused, saying why (no secret shown)');
    } finally { fs.rmSync(L, { recursive: true, force: true }); }
  });
  RR.kill();
  await S3.close();
  ok(noLeak(RR.out), 'R2: no secret or signed link in the R2 relay\'s log');

  NOFF.kill(); URO.kill();
  fs.rmSync(SC, { recursive: true, force: true });

  await trackerSteps();

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
