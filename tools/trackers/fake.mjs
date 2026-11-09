// A fake bridge: what tools/trackers/bridge.py sends from SteamVR, made up, for the tests and for trying the rooms'
// trackers without the hardware (tools/trackers/SPEC.md). Node 18 or newer, no packages. It speaks the bridge's
// datagrams ({ v: 1, t, d: [{ s, k, h?, p, q, lv, av, ok, b }] } to UDP 127.0.0.1:<port>), every device's pose in
// SteamVR's standing space, which is the room's turned by `turn` about y and moved by `move` (a known transform, so a
// test knows each pose in room coordinates: the truth).
//   node tools/trackers/fake.mjs [--port 47800] [--rate 90] [--turn 30] [--move 1.2,0.01,-0.7] [--apart 2] [--seconds n] [--quiet]
//   import { startFake } from '../tools/trackers/fake.mjs'   (the tests)
// From the command line: two trackers lying on spot A and spot B (`--apart` metres apart along the room's x axis), one
// going round a circle, one bobbing, one on a table, the headset and its two controllers, and two base stations. Line
// the room up by hand on a page (Shared, Trackers): Set spot A with the first, Set spot B with the second.
import dgram from 'node:dgram';
import { pathToFileURL } from 'node:url';

const MAX_DGRAM = 8000;   // (the bridge's limit: one reading a datagram is far under it, more devices are split)
const r3 = x => Math.round(x * 1000) / 1000, r4 = x => Math.round(x * 1e4) / 1e4;
// quaternions as [x, y, z, w]
export const qYaw = a => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
export const qAxis = (ax, a) => { const s = Math.sin(a / 2), l = Math.hypot(...ax); return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(a / 2)]; };
export function qMul(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
export const rotY = (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };
// the angle between two turns, in degrees (either sign of a quaternion is the same turn)
export const qAngle = (a, b) => { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) / Math.hypot(...a) / Math.hypot(...b); return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI; };

// the devices from the command line (and the tests' default): poses in the room as functions of time (s)
export function defaultDevices(apart = 2) {
  const still = (p, q = [0, 0, 0, 1]) => () => ({ p, q });
  return [
    { s: 'LHR-FA4E0A01', k: 'trk', b: 0.9, pose: still([0, 0, 0]) },                         // lying on spot A
    { s: 'LHR-FA4E0B02', k: 'trk', b: 0.85, pose: still([apart, 0, 0]) },                    // lying on spot B
    { s: 'LHR-FA4E0C03', k: 'trk', b: 0.7, pose: t => {                                       // round a circle, 0.25 turns a second
      const a = t * Math.PI / 2;
      return { p: [1 + 0.8 * Math.cos(a), 1, -1.5 - 0.8 * Math.sin(a)], q: qYaw(a) };
    } },
    { s: 'LHR-FA4E0D04', k: 'trk', b: 0.55, pose: t => ({ p: [-0.5, 0.9 + 0.15 * Math.sin(t * 2), -1], q: qAxis([1, 0, 1], 0.3 * Math.sin(t)) }) },
    { s: 'LHR-FA4E0E05', k: 'trk', b: 0.4, pose: still([1.5, 0.75, -0.5], qYaw(Math.PI / 6)) },   // on a table
    { s: 'LHR-FA4EF0D0', k: 'hmd', b: null, pose: t => ({ p: [0.5, 1.65 + 0.02 * Math.sin(t), 0.8], q: qMul(qYaw(0.4 * Math.sin(t / 3)), qAxis([1, 0, 0], -0.15)) }) },
    { s: 'LHR-FA4EC0L1', k: 'ctl', h: 'l', b: 0.8, pose: t => ({ p: [0.3, 1.2 + 0.1 * Math.sin(t * 1.3), 0.55], q: qAxis([1, 0, 0], -0.6) }) },
    { s: 'LHR-FA4EC0R2', k: 'ctl', h: 'r', b: 0.75, pose: t => ({ p: [0.7, 1.25, 0.5 + 0.1 * Math.cos(t)], q: qAxis([1, 0, 0], -0.5) }) },
    { s: 'LHB-FA4EBA01', k: 'base', b: null, pose: still([-1.5, 2.3, 1.5], qMul(qYaw(-Math.PI / 4), qAxis([1, 0, 0], -0.5))) },
    { s: 'LHB-FA4EBA02', k: 'base', b: null, pose: still([3.5, 2.3, -3.5], qMul(qYaw(3 * Math.PI / 4), qAxis([1, 0, 0], -0.5))) },
  ];
}

// o: { port, rate (a second), turn (rad), move ([x, y, z]), devices, clock (s, for the poses; default the wall clock
// since the start), keep (readings kept per device, for the tests' truth) }. Returns { stop, pause(on), set(serial,
// pose fn), off(serial, on), raw(p), rawQ(q), spots, history, sent, send(buffer) }
export function startFake(o = {}) {
  const port = o.port || 47800, rate = o.rate || 90, turn = o.turn ?? Math.PI / 6, move = o.move || [1.2, 0.01, -0.7];
  const devices = (o.devices || defaultDevices(o.apart)).map(d => ({ ...d }));
  const t0 = Date.now(), clock = o.clock || (() => (Date.now() - t0) / 1000), keep = o.keep || 200;
  const sock = dgram.createSocket('udp4');
  sock.on('error', () => {});   // (nothing listening yet: the relay may start later)
  const raw = p => { const r = rotY(turn, p); return [r[0] + move[0], r[1] + move[1], r[2] + move[2]]; };
  const rawQ = q => qMul(qYaw(turn), q);
  const history = new Map(devices.map(d => [d.s, []]));   // serial -> [{ at, p, q, v }] in room coordinates, newest last
  let timer = null, paused = false, sent = 0;
  const F = {
    turn, move, devices, history, raw, rawQ,
    get sent() { return sent; },
    // where a tracker lying on each spot reads in SteamVR's space (what Set spot A and B take): the room's m
    spots: { a: raw([0, 0, 0]), b: raw([o.apart || 2, 0, 0]) },
    pause(on = true) { paused = on; },
    set(s, pose) { const d = devices.find(x => x.s === s); if (d) d.pose = typeof pose === 'function' ? pose : () => pose; },
    off(s, on = true) { const d = devices.find(x => x.s === s); if (d) d.gone = on; },   // switched off: no longer sent
    lost(s, on = true) { const d = devices.find(x => x.s === s); if (d) d.lost = on; },  // out of view: sent with ok false
    send(buf) { sock.send(Buffer.isBuffer(buf) ? buf : Buffer.from(typeof buf === 'string' ? buf : JSON.stringify(buf)), port, '127.0.0.1'); },
    stop() { clearTimeout(timer); timer = null; try { sock.close(); } catch { /* closed */ } },
  };
  const reading = (d, t, at) => {
    const A = d.pose(t), B = d.pose(t + 0.001), p = A.p, q = A.q;
    const v = [(B.p[0] - p[0]) * 1000, (B.p[1] - p[1]) * 1000, (B.p[2] - p[2]) * 1000];
    // the angular velocity from the turn over that millisecond (rad/s about SteamVR's axes)
    const dq = qMul(B.q, [-q[0], -q[1], -q[2], q[3]]), w = dq[3] < 0 ? -1 : 1, ang = 2 * Math.acos(Math.min(1, Math.abs(dq[3]))) * 1000, sn = Math.hypot(dq[0], dq[1], dq[2]);
    const av = sn > 1e-9 ? rotY(turn, [dq[0] / sn * ang * w, dq[1] / sn * ang * w, dq[2] / sn * ang * w]) : [0, 0, 0];
    const H = history.get(d.s);
    H.push({ at, p, q, v });
    if (H.length > keep) H.shift();
    const rp = raw(p), rq = rawQ(q), rv = rotY(turn, v);
    return { s: d.s, k: d.k, ...(d.h ? { h: d.h } : {}), p: rp.map(r4), q: rq.map(r4), lv: rv.map(r3), av: av.map(r3), ok: !d.lost, b: d.b ?? null };
  };
  const tick = () => {
    if (!paused) {
      const t = clock(), at = Date.now(), d = devices.filter(x => !x.gone).map(x => reading(x, t, at));
      // one datagram a reading, split when it would pass the bridge's limit (as bridge.py does)
      let part = [];
      const flush = () => { if (part.length) { F.send({ v: 1, t: at, d: part }); sent++; part = []; } };
      for (const r of d) { part.push(r); if (JSON.stringify({ v: 1, t: at, d: part }).length > MAX_DGRAM) { part.pop(); flush(); part.push(r); } }
      flush();
    }
    next += 1000 / rate;   // (on a timeline of its own: a plain timer of 11.1 ms drifts to about 83 a second)
    const now = Date.now();
    if (next < now - 100) next = now;
    timer = setTimeout(tick, Math.max(0, next - now));
  };
  let next = Date.now();
  tick();
  return F;
}

// ---- the command line
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = process.argv.slice(2), opt = { port: 47800, rate: 90, turn: 30, move: '1.2,0.01,-0.7', apart: 2, seconds: 0, quiet: false };
  for (let i = 0; i < a.length; i++) {
    const n = a[i].replace(/^--/, '');
    if (n === 'help' || !(n in opt)) { console.log('usage: node tools/trackers/fake.mjs [--port 47800] [--rate 90] [--turn <degrees>] [--move x,y,z] [--apart <m>] [--seconds <n>] [--quiet]'); process.exit(n === 'help' ? 0 : 1); }
    if (typeof opt[n] === 'boolean') opt[n] = true; else opt[n] = typeof opt[n] === 'number' ? Number(a[++i]) : a[++i];
  }
  const move = String(opt.move).split(',').map(Number);
  if (move.length !== 3 || !move.every(Number.isFinite) || !(opt.port > 0 && opt.port < 65536) || !(opt.rate > 0) || !(opt.apart >= 0.5)) { console.log('bad options (try --help)'); process.exit(1); }
  const F = startFake({ port: opt.port, rate: opt.rate, turn: opt.turn * Math.PI / 180, move, apart: opt.apart });
  const n = k => F.devices.filter(d => d.k === k).length;
  console.log(`fake bridge: ${F.devices.length} devices (${n('trk')} trackers, the headset, ${n('ctl')} controllers, ${n('base')} base stations) to UDP 127.0.0.1:${opt.port}, ${opt.rate} a second`);
  console.log(`SteamVR's space is the room turned ${opt.turn} degrees and moved by (${move.join(', ')}) m. Spot A has ${F.devices[0].s}, spot B ${F.devices[1].s}, ${opt.apart} m apart: line the room up with those two (Shared, Trackers).`);
  if (!opt.quiet) setInterval(() => console.log(`${F.sent} datagrams sent`), 5000).unref();
  if (opt.seconds > 0) setTimeout(() => { F.stop(); process.exit(0); }, opt.seconds * 1000);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { F.stop(); process.exit(0); });
}
