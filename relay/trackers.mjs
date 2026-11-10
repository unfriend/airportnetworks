// The PC's Vive trackers for the rooms (relay/server.mjs --trackers; tools/trackers/SPEC.md, "The relay"). The bridge
// (tools/trackers/bridge.py, on the same PC as SteamVR and the relay) sends every tracked device's pose as UDP datagrams
// to 127.0.0.1; this keeps each device's latest reading with the relay's time it came, answers GET /api/trackers and
// /api/trackers/still for the pages' Trackers section, and sends every room that uses the trackers (its key trk: on, and
// m, the two points taken by hand on spot A and spot B) their poses in room coordinates, 60 times a second, as the fx
// '@trk'. Node 18 or newer, no packages. Also imported by relay/test.mjs (frameOf, toRoom, quatToRoom, parseDatagram).
import dgram from 'node:dgram';

export const TRK_PORT = 47800;   // the bridge's default (--trackers with no port)
// the tracker's pose origin over the floor when it lies flat on its base on a spot: 0 m until measured on a real tracker
// (a constant, as the headsets' FLOOR_TIP: the room's floor is the floor under spot A, as the headsets' floor spots set it)
export const TRK_FLOOR = 0;
export const TRK_RATE = 60;            // @trk messages a second to a room, at most
const MAX_DGRAM = 8192;                // one datagram from the bridge (11 trackers are about 1.5 KB)
const MAX_DEVICES = 64;                // readings in one datagram
const STALE = 500;                     // a reading older than this is sent with ok 0 (the shell's 0.5 s)
const GONE = 5000;                     // a device not heard from this long is left out of @trk
const FORGET = 60000;                  // ... and out of GET /api/trackers
const MIN_APART = 0.1;                 // m's two points less than 10 cm apart along the floor: not lined up
const STILL_MM = 5;                    // /api/trackers/still: moved more than this (mm from the mean) meanwhile: refused
const BACKLOG = 256 << 10;             // a member whose socket holds this much unsent gets no @trk until it drains
const SERIAL = /^[\w.:-]{1,64}$/;      // LHR-1A2B3C4D (a tracker or the Index), LHB-... (a base station)
const KINDS = new Set(['trk', 'hmd', 'ctl', 'base']);
const LETTER = { trk: 't', hmd: 'h' };   // @trk's kind: 't' a tracker, 'h' the headset, 'l' and 'r' its controllers
const NAMES = { trk: 'tracker', hmd: 'headset', ctl: 'controller', base: 'base station' };

const fin = (x, lim) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= lim;
const vec = (v, n, lim) => (Array.isArray(v) && v.length === n && v.every(x => fin(x, lim)) ? v : null);
const r3 = x => Math.round(x * 1000) / 1000, r4 = x => Math.round(x * 1e4) / 1e4, r5 = x => Math.round(x * 1e5) / 1e5;

// ---- a datagram from the bridge: { v: 1, t: <bridge ms>, d: [{ s, k, h?, p, q, lv?, av?, ok, b }] }. Readings that are
// not right are left out one by one (counted); a datagram that is not the bridge's at all is ignored whole (counted)
export function parseDatagram(buf) {
  if (!buf || buf.length > MAX_DGRAM) return null;
  let msg;
  try { msg = JSON.parse(buf.toString('utf8')); } catch { return null; }
  if (!msg || typeof msg !== 'object' || msg.v !== 1 || !Array.isArray(msg.d) || msg.d.length > MAX_DEVICES) return null;
  const list = [];
  let bad = 0;
  for (const e of msg.d) {
    const r = reading(e);
    if (r) list.push(r); else bad++;
  }
  return { list, bad };
}
function reading(e) {
  if (!e || typeof e !== 'object' || typeof e.s !== 'string' || !SERIAL.test(e.s) || !KINDS.has(e.k)) return null;
  const p = vec(e.p, 3, 1000), q = vec(e.q, 4, 2);
  if (!p || !q || typeof e.ok !== 'boolean') return null;
  const n = Math.hypot(...q);
  if (!(n > 0.5 && n < 1.5)) return null;   // (not a turn)
  const lv = e.lv === undefined ? [0, 0, 0] : vec(e.lv, 3, 100), av = e.av === undefined ? [0, 0, 0] : vec(e.av, 3, 1000);
  if (!lv || !av) return null;
  const b = e.b === null || e.b === undefined ? null : fin(e.b, 1) && e.b >= 0 ? e.b : null;
  const h = e.k === 'ctl' && (e.h === 'l' || e.h === 'r') ? e.h : '';
  return { id: e.s, k: e.k, h, p, q: q.map(x => x / n), lv, av, ok: e.ok, b };
}

// ---- the room's frame from m, exactly as a headset's from its floor spots (shared.js: fromMarks with floorUnder's floor
// spots rule, and basis): its origin the floor point under spot A (spot A's point less TRK_FLOOR), its x axis level
// towards spot B, y up, z = x cross y. SteamVR's standing space plays the headset's local-floor: both right-handed, y up,
// -z ahead. relay/test.mjs checks it against shared.js's own code. null: m is not two such points
// An area's crosses (v131: m.k, with that area's floor points in room coordinates as the page wrote them, m.ra and
// m.rb: where the room has its crosses, on the floor): m.a and m.b fitted to them as a headset's calibration on an
// area is (shared.js fitFrame): turned so that ra -> rb lies along a -> b, its origin where that puts the room's when ra
// is at a, the room's floor that far under the tracker's floor point at a as ra is over the room's floor
export function frameOf(m) {
  if (!m || typeof m !== 'object') return null;
  const a = vec(m.a, 3, 1000), b = vec(m.b, 3, 1000);
  if (!a || !b) return null;
  const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz);
  if (!(l >= MIN_APART)) return null;
  const ra = typeof m.k === 'string' && m.k ? vec(m.ra, 3, 10000) : null, rb = ra ? vec(m.rb, 3, 10000) : null;
  if (ra && rb) {
    const ex = rb[0] - ra[0], ez = rb[2] - ra[2], lr = Math.hypot(ex, ez);
    if (!(lr >= MIN_APART)) return null;
    const yaw = Math.atan2(-dz / l, dx / l) - Math.atan2(-ez / lr, ex / lr), c = Math.cos(yaw), s = Math.sin(yaw);
    return { o: [a[0] - (c * ra[0] + s * ra[2]), a[1] - TRK_FLOOR - ra[1], a[2] - (-s * ra[0] + c * ra[2])], c, s, yaw, hs: Math.sin(-yaw / 2), hc: Math.cos(-yaw / 2) };
  }
  const c = dx / l, s = -dz / l, yaw = Math.atan2(s, c);   // x = (cos yaw, 0, -sin yaw): a turn by yaw about y
  return { o: [a[0], a[1] - TRK_FLOOR, a[2]], c, s, yaw, hs: Math.sin(-yaw / 2), hc: Math.cos(-yaw / 2) };
}
// a point in SteamVR's space in room coordinates: the frame's inverse (the turn by -yaw after the origin)
export function toRoom(F, p) {
  const dx = p[0] - F.o[0], dy = p[1] - F.o[1], dz = p[2] - F.o[2];
  return [F.c * dx - F.s * dz, dy, F.s * dx + F.c * dz];
}
export const dirToRoom = (F, v) => [F.c * v[0] - F.s * v[2], v[1], F.s * v[0] + F.c * v[2]];
// a turn in SteamVR's space in room coordinates: the turn by -yaw about y, then the device's own ([x, y, z, w])
export function quatToRoom(F, q) {
  const sy = F.hs, cy = F.hc;
  return [cy * q[0] + sy * q[2], cy * q[1] + sy * q[3], cy * q[2] - sy * q[0], cy * q[3] - sy * q[1]];
}

// ---- the intake, the API's answers and the rooms' messages
// o: { port, log }. Its methods: listen() (a promise of the port it listens on: 0 picks a free one), attach(rooms, send)
// (the 60 a second loop: rooms() the relay's rooms, send(room, msg) to every member), ping(), list(), still(id, ms),
// close()
export function makeTrackers(o = {}) {
  const log = o.log || (() => {});
  const dev = new Map();   // serial -> { id, k, h, p, q, lv, av, ok, b, at, first }
  const waiters = new Set();   // /api/trackers/still: { id, samples, ok, all }
  const out = new WeakMap();   // room -> { sent: the newest reading's time sent there, last: when last sent }
  const count = { datagrams: 0, bad: 0, readings: 0, badReadings: 0, sent: 0, skipped: 0 };
  let sock = null, timer = null, newest = 0, heard = 0, silent = true, said = { bad: 0, badReadings: 0, skipped: 0 }, saidAt = 0;

  function take(buf) {
    const r = parseDatagram(buf), now = Date.now();
    if (!r) { count.bad++; return; }
    count.datagrams++;
    count.badReadings += r.bad;
    for (const x of r.list) {
      const old = dev.get(x.id);
      if (!old || now - old.at > FORGET) log(`trackers: ${x.id} (${NAMES[x.k]}${x.h ? ', ' + (x.h === 'l' ? 'left' : 'right') : ''}) seen`);
      dev.set(x.id, { ...x, at: now });
      count.readings++;
      for (const w of waiters) if (w.id === x.id) { w.all++; if (x.ok) w.samples.push(x.p); }
    }
    if (r.list.length) {
      newest = now;
      if (silent) { silent = false; log(`trackers: the bridge is sending (${summary(now)})`); }
    }
    heard = now;
  }
  function summary(now) {
    const n = { trk: 0, hmd: 0, ctl: 0, base: 0 };
    for (const d of dev.values()) if (now - d.at <= GONE) n[d.k]++;
    return [n.trk + (n.trk === 1 ? ' tracker' : ' trackers'), n.hmd && 'the headset', n.ctl && n.ctl + (n.ctl === 1 ? ' controller' : ' controllers'),
      n.base && n.base + (n.base === 1 ? ' base station' : ' base stations')].filter(Boolean).join(', ');
  }

  // one room's message: its trackers in room coordinates (base stations never), or why not
  function tuples(F, now) {
    const t = [];
    for (const d of dev.values()) {
      if (d.k === 'base' || now - d.at > GONE) continue;
      const kind = d.k === 'ctl' ? d.h : LETTER[d.k];
      if (!kind) continue;   // (a controller SteamVR has given no hand yet)
      const p = toRoom(F, d.p), q = quatToRoom(F, d.q), v = dirToRoom(F, d.lv);
      t.push([d.id, r3(p[0]), r3(p[1]), r3(p[2]), r4(q[0]), r4(q[1]), r4(q[2]), r4(q[3]), r3(v[0]), r3(v[1]), r3(v[2]),
        d.ok && now - d.at <= STALE ? 1 : 0, kind]);
    }
    return t;
  }
  function tick(rooms, send) {
    const now = Date.now();
    if (!silent && now - heard > GONE) { silent = true; log(`trackers: nothing from the bridge for ${GONE / 1000} s (is bridge.py running, and SteamVR?)`); }
    if (now - saidAt >= 1000) {   // bad datagrams and readings, and members skipped, said at most once a second
      saidAt = now;
      const nb = count.bad - said.bad, nr = count.badReadings - said.badReadings, ns = count.skipped - said.skipped;
      if (nb || nr) log(`trackers: ignored ${[nb && nb + (nb === 1 ? ' bad datagram' : ' bad datagrams'), nr && nr + (nr === 1 ? ' bad reading' : ' bad readings')].filter(Boolean).join(' and ')}`);
      if (ns) log(`trackers: ${ns} @trk not sent to members whose sockets were backed up (a slow connection)`);
      said = { bad: count.bad, badReadings: count.badReadings, skipped: count.skipped };
    }
    let F0 = null, key0 = '', t0 = null;   // (rooms lined up alike share one list)
    for (const room of rooms()) {
      if (!room.members.size) continue;
      const v = room.keys.get('trk')?.v;
      if (!v || typeof v !== 'object' || v.on !== true) { out.delete(room); continue; }
      let S = out.get(room);
      if (!S) out.set(room, S = { sent: 0, last: 0 });
      const F = frameOf(v.m);
      if (!F) {   // on, but not lined up: once a second, so pages can say why
        if (now - S.last >= 1000) { send(room, { t: 'fx', k: '@trk', v: { at: newest, l: '', t: [] }, by: '' }); S.last = now; S.sent = 0; count.sent++; }
        continue;
      }
      if (!(newest > S.sent) && now - S.last < 1000) continue;   // nothing new: once a second all the same (ok 0 as they age)
      const key = F.o.join() + ',' + F.c + ',' + F.s;
      if (key !== key0) { F0 = F; key0 = key; t0 = tuples(F0, now); }
      send(room, { t: 'fx', k: '@trk', v: { at: newest, l: 'hand', t: t0 }, by: '' });
      S.sent = newest; S.last = now; count.sent++;
    }
    for (const [id, d] of dev) if (now - d.at > FORGET) dev.delete(id);
  }

  return {
    count, BACKLOG,
    listen() {
      return new Promise((resolve, reject) => {
        sock = dgram.createSocket('udp4');
        sock.once('error', reject);
        sock.on('message', take);
        sock.bind({ port: o.port || 0, address: '127.0.0.1', exclusive: true }, () => {
          sock.removeListener('error', reject);
          sock.on('error', err => log(`trackers: ${err.message}`));
          resolve(sock.address().port);
        });
      });
    },
    // the loop: TRK_RATE a second on a timeline of its own (a timer of 16.7 ms drifts to 58 a second), started once
    attach(rooms, send) {
      if (timer) return;
      const P = 1000 / TRK_RATE;
      let next = Date.now();
      const loop = () => {
        try { tick(rooms, send); } catch (err) { log(`trackers: ${err.message}`); }
        const now = Date.now();
        next += P;
        if (next < now - 100) next = now + P;   // (fell behind, as in a long pause: start again from now)
        timer = setTimeout(loop, Math.max(0, next - now));
        timer.unref();
      };
      loop();
    },
    // /api/ping: trackers seen in the last 5 s (trackers only: not the headset, its controllers or base stations)
    ping() { const now = Date.now(); let n = 0; for (const d of dev.values()) if (d.k === 'trk' && now - d.at <= GONE) n++; return { trackers: true, trackersSeen: n }; },
    // GET /api/trackers: every device seen in the last minute, raw in SteamVR's space (ok false once 0.5 s old)
    list() {
      const now = Date.now(), order = ['trk', 'hmd', 'ctl', 'base'];
      return [...dev.values()].sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k) || (a.h < b.h ? -1 : a.h > b.h ? 1 : 0) || (a.id < b.id ? -1 : 1))
        .map(d => ({ id: d.id, k: d.k, ...(d.h ? { h: d.h } : {}), ok: d.ok && now - d.at <= STALE, b: d.b === null ? null : Math.round(d.b * 100) / 100,
          p: d.p.map(r4), q: d.q.map(r4), age: now - d.at }));
    },
    // GET /api/trackers/still: the tracker's position averaged over ms while it lies still (Set spot A, Set spot B)
    async still(id, ms) {
      const d = dev.get(id);
      if (!d || Date.now() - d.at > GONE) return { ok: false, error: `tracker ${id} is not seen: is it switched on, and in view of the base stations?` };
      const w = { id, samples: [], all: 0 };
      waiters.add(w);
      await new Promise(r => setTimeout(r, ms));
      waiters.delete(w);
      const S = w.samples, n = S.length;
      if (n < 3) return { ok: false, error: w.all ? `tracker ${id} lost tracking meanwhile: keep it in view of the base stations` : `tracker ${id} is not seen: is it switched on, and in view of the base stations?` };
      const p = [0, 1, 2].map(i => S.reduce((s, x) => s + x[i], 0) / n);
      const spread = Math.max(...S.map(x => Math.hypot(x[0] - p[0], x[1] - p[1], x[2] - p[2]))) * 1000;
      if (spread > STILL_MM) return { ok: false, error: `tracker ${id} moved ${Math.round(spread)} mm meanwhile: let it lie still on the spot`, spread: Math.round(spread * 10) / 10 };
      if (n < w.all) return { ok: false, error: `tracker ${id} lost tracking meanwhile: keep it in view of the base stations` };
      return { ok: true, p: p.map(r5), spread: Math.round(spread * 10) / 10, n };
    },
    close() { clearTimeout(timer); timer = null; try { sock && sock.close(); } catch { /* closed */ } },
  };
}
