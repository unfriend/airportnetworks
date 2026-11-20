// The guide's timeline (SCRIPT) and its evaluator (evalGuide): plain maths, no THREE, so a Node test can load it
// (tools/tutorial/test-script.mjs). Everything the guide and its props do is a pure function of a clock: the story's
// (story seconds) or the practice's (seconds of this device's own), so a seek, a late joiner or a pause gives the same
// pose. live (the viewer's head and ray, the panel's places) only turns the head and aims the end's pointing.
// The set's frame: floor y = 0, 1 unit = 1 m, the viewer's start at x = z = 0, ahead along -z, right +x.
// The guide's own frame (gestures): its head's floor point, x its left, y up, z its forward.
const GUIDE = (function () {
  const D = Math.PI / 180;
  const mk = b => [+(2.4 * Math.sin(b * D)).toFixed(3), +(-2.4 * Math.cos(b * D)).toFixed(3)];
  const PLACE = {
    home: [0.35, -2.0], m0: mk(-10), m1: mk(2), m2: mk(14), m3: mk(26), m4: mk(38),
    glide: [1.85, -2.0], copy: [1.25, -2.1], lost: [1.25, -2.0], end: [-0.15, -1.7],
  };
  const MARKS = [PLACE.m0, PLACE.m1, PLACE.m2, PLACE.m3, PLACE.m4];
  // the network: the badge (hub 0 and A, B, C: 1 to 3) and six more (a, b, c: 4 to 6 on A, B, C; d, e, f: 7 to 9 on
  // the hub); unit places round its centre, NET.R metres a unit once grown (the badge 0.7 m across)
  const NET = {
    C: [-0.05, 1.3, -1.25], R: 0.35,
    U: [[0, 0, 0], [0, 0.95, 0.12], [-0.83, -0.47, -0.08], [0.83, -0.47, 0.06],
      [0.32, 1.42, -0.22], [-1.36, -0.62, 0.24], [1.3, -0.78, -0.26], [-0.74, 0.56, -0.45], [0.8, 0.5, 0.42], [0.06, -0.92, -0.48]],
    L: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1], [1, 4], [2, 5], [3, 6], [0, 7], [0, 8], [0, 9]],
    NAME: ['Hub', 'Node', 'Node', 'Node', 'Leaf', 'Leaf', 'Leaf', 'Leaf', 'Leaf', 'Leaf'],
  };
  const PT = [-0.6, 1.5, -1.8];          // the pointing target (chapter 2)
  const EYE = 1.61, SHOULDER = [0.18, 1.4, -0.03];
  // the chapters, in story seconds (the engine's CH is made from these)
  const CH = [
    { key: 'hello', name: 'Hello', a: 0, b: 25 },
    { key: 'point', name: 'Pointing', a: 25, b: 48 },
    { key: 'play', name: 'Playing a story', a: 48, b: 73 },
    { key: 'explore', name: 'Exploring', a: 73, b: 98 },
    { key: 'menu', name: 'The menu', a: 98, b: 124 },
    { key: 'recenter', name: 'Recenter', a: 124, b: 140 },
    { key: 'together', name: 'Together', a: 140, b: 166 },
    { key: 'end', name: 'Your turn', a: 166, b: 187 },
  ];
  // where the main panel's buttons hang on a page (no headset): its home beside a standing viewer, 1.6 m eyes
  const PANEL_PAGE = { stories: [-0.47, 1.98, -0.66], sound: [-0.36, 1.98, -0.58], recenter: [-0.42, 1.98, -0.62], foot: [-0.56, 1.22, -0.86],
    play: [-0.75, 1.22, -0.98], next: [-0.65, 1.22, -0.92], prev: [-0.69, 1.22, -0.95], top: [-0.56, 1.95, -0.86] };
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8];
  return { D, PLACE, MARKS, NET, PT, EYE, SHOULDER, CH, PANEL_PAGE, ALL, T_END: 187, COL: [0.91, 0.93, 0.97], COPY_COL: [1, 0.7, 0.28] };
})();

// ------------------------------------------------------------------ the script, chapter by chapter (relative seconds)
// Each actor (the guide, the copy) has tracks: mv [t0, t1, place, kind: walk | glide | snap | shift], yaw [t, deg, dur]
// (deg from facing the viewer's start; { abs: deg } a heading in the set's frame: 0 along +z), face [t, w], look
// [t, target], eye [t, h], nod [t, n], sweep [t], tilt [t0, t1, deg], l and r [t0, t1, gesture, args, in, out],
// parts [t, 'dark' | 'light' | 'hide' | 'show', ids], [t, 'flash', part], [t, 'power', p, dur]. Props: ray [t0, t1],
// target [t0, t1], lit [t0, t1], marks t, line [t0, t1], net { leave, grow, links, sprout }, dim [t, a, dur], beads
// [t, 'fist'], signals [t, node], menu [t0, t1, kind, opts], trails [t0, t1], card [t0, t1], floor [t0, t1, a0, a1],
// quiet [t0, t1] (the labels hidden), ntag [t0, t1, node], tags [t0, t1, text], copyOn [t0, t1], name [t0, t1].
const SCRIPT = {
  hello: {
    g: {
      mv: [[0, 0, 'home', 'snap']], yaw: [[0, 0, 0]], face: [[0, 1]], look: [[0, 'you']],
      eye: [[12.8, 1.59], [13.3, 1.61]], sweep: [6.4, 12.4],
      l: [[8.2, 11.02, 'tpose', null, 0.15], [20.4, 21.4, 'palms']],
      r: [[8.2, 11.02, 'tpose', null, 0.15], [12.6, 15.6, 'wave', 3], [20.4, 21.4, 'palms']],
      parts: [[0, 'dark', GUIDE.ALL], [0, 'power', 0.12, 0], [0, 'show', [1, 2]],
        [3.0, 'light', [8]], [3.0, 'flash', 8], [3.6, 'light', [7]], [3.6, 'flash', 7], [4.2, 'light', [5]], [4.2, 'flash', 5],
        [4.7, 'light', [6]], [4.7, 'flash', 6], [5.1, 'light', [1, 2]], [5.1, 'flash', 1], [5.5, 'light', [4]], [5.5, 'flash', 4],
        [6.0, 'light', [3]], [6.0, 'flash', 3], [3.0, 'power', 1, 3.0],
        [8.6, 'flash', 7], [9.2, 'flash', 5], [9.8, 'flash', 6], [10.3, 'flash', 4]],
    },
    floor: [[0, 0.01, 0, 0], [6.0, 7.5, 0, 1]], marks: -1, net: { leave: -1 },
    tags: [[8.2, 10.8, 'Calibrating'], [10.8, 12.8, 'Calibration done']],
  },
  point: {
    g: {
      look: [[5.0, 'target'], [6.2, 'ray'], [11.8, 'target'], [17.2, 'ray'], [23, 'you']],
      tilt: [[13.2, 15.6, 6]],
      r: [[0.9, 17.2, 'point', [[0, [1.0, 2.35, -0.7]], [4.6, [1.0, 2.35, -0.7]], [5.4, GUIDE.PT], [6.0, GUIDE.PT], [8.8, 'panel:top'],
        [11.6, GUIDE.PT], [12.4, [GUIDE.PT[0] + 0.04, GUIDE.PT[1], GUIDE.PT[2]]], [15.6, [GUIDE.PT[0] + 0.04, GUIDE.PT[1], GUIDE.PT[2]]], [15.8, GUIDE.PT]], 0.3, 0.3]],
    },
    ray: [[1.2, 17.2]], target: [[5.0, 23]], lit: [[15.8, 17.2]],
    tags: [[13.2, 16.0, 'Correcting: 4 cm left']],
  },
  play: {
    g: {
      face: [[0.9, 0], [22.0, 1]], yaw: [[1.0, 180, 1.5], [5.2, 0, 1.5]], look: [[0.9, 'fwd'], [5.2, 'you'], [8.8, 'panel:foot'], [12.4, 'you']],
      mv: [[6.8, 8.6, 'm0', 'walk'], [13.2, 14.3, 'm1', 'walk'], [15.6, 16.7, 'm2', 'walk'], [18.0, 19.1, 'm3', 'walk'], [20.4, 21.5, 'm4', 'walk']],
      nod: [[22.6, 1]],
      r: [[8.8, 12.4, 'point', [[0, 'panel:foot'], [1.6, 'panel:play'], [2.8, 'panel:next']]]],
      parts: [[2.6, 'flash', 2], [3.0, 'hide', [2]], [8.6, 'flash', 7], [14.3, 'flash', 7], [16.7, 'flash', 7], [19.1, 'flash', 7], [21.5, 'flash', 7]],
    },
    ray: [[9.0, 12.3]], marks: 3.0, line: [4.9, 5.6],
  },
  explore: {
    g: {
      mv: [[1.0, 3.0, 'home', 'walk']], face: [[0, 1]],
      look: [[4.2, 'net'], [9.8, 'node:7'], [10.8, 'node:5'], [11.8, 'node:8'], [12.8, 'node:0'], [17.2, 'net'], [19.0, 'you'], [20.0, 'node:4'], [21.4, 'you']],
      r: [[3.2, 4.0, 'tapChest'], [13.2, 17.2, 'point', 'node:0', 0.9, 0.3]],
      parts: [[4.2, 'hide', [1]], [14.6, 'flash', 6]],
    },
    ray: [[13.6, 17.2]],
    net: { leave: 4.2, grow: [5.8, 8.8], links: [6.0, 6.5, 7.0, 7.5, 8.0, 8.5], sprout: [9.6, 12.6] },
    beads: [[14.6, 'fist']], signals: [[15.2, 0], [20.0, 4]], ntag: [[15.0, 18.0, 0]],
    tags: [[9.0, 11.6, 'Network deployed']],
  },
  menu: {
    g: {
      look: [[1.8, 'menu'], [12.4, 'you'], [12.8, 'arm'], [15.8, 'you'], [16.2, 'menu'], [18.4, 'fwd'], [24.0, 'you']],
      face: [[18.4, 0], [24.0, 1]],
      yaw: [[20.6, 30, 0.12], [21.4, 60, 0.12], [22.0, 0, 0.6]],
      mv: [[18.6, 19.5, 'glide', 'glide'], [22.4, 23.3, 'home', 'glide']],
      r: [[1.8, 3.0, 'stick'], [3.0, 12.2, 'present'], [12.8, 13.8, 'tapArm'], [14.8, 15.8, 'tapArm'], [16.2, 18.2, 'present']],
      l: [[12.8, 13.8, 'forearm'], [14.8, 15.8, 'forearm']],
      parts: [[13.1, 'flash', 6], [15.1, 'flash', 6], [18.6, 'flash', 8], [19.0, 'flash', 8], [22.4, 'flash', 8], [22.8, 'flash', 8]],
    },
    dim: [[0, 0.4, 2]],
    menu: [[3.0, 12.2, 'settings', { tab: 8.0, rows: [8.6, 9.2, 9.8, 10.6] }], [16.2, 18.2, 'sticks']],
    quiet: [[13.2, 14.8]], trails: [[18.5, 19.7], [22.3, 23.5]],
    tags: [[12.8, 13.6, 'Labels: hidden']],
  },
  recenter: {
    g: {
      face: [[0.9, 0], [9.8, 1]],
      yaw: [[1.0, { abs: 90 }, 0.8], [7.2, 60, 0.15], [7.45, 30, 0.15], [7.7, 0, 0.15]],
      mv: [[1.8, 3.6, 'lost', 'walk'], [7.8, 9.6, 'home', 'walk']],
      look: [[1.0, 'fwd'], [3.8, { yaw: -40, pitch: 5 }], [5.0, { yaw: 40, pitch: 0 }], [6.2, { yaw: -15, pitch: -5 }], [7.0, 'fwd'], [7.8, 'you']],
      eye: [[10.0, 1.6], [10.3, 1.61]],
      l: [[10.0, 10.5, 'hang', null, 0.12]], r: [[10.0, 10.5, 'hang', null, 0.12]],
    },
  },
  together: {
    g: {
      nod: [[19.4, 1], [20.4, 1]], look: [[10.2, 'copy'], [13.0, 'you'], [23.6, 'copyPlace'], [24.6, 'you']],
      parts: [[9.6, 'flash', 5], [9.85, 'flash', 3]],
    },
    c: {
      mv: [[0, 0, 'home', 'snap'], [10.4, 12.4, 'copy', 'walk']], face: [[0, 1]], yaw: [[0, 0, 0]], look: [[0, 'you']],
      nod: [[19.4, 1], [20.4, 1]],
      parts: [[0, 'dark', GUIDE.ALL], [0, 'power', 0, 0], [10.4, 'power', 1, 1.6],
        [10.4, 'light', [8]], [10.6, 'light', [7]], [10.85, 'light', [5]], [11.1, 'light', [6]], [11.35, 'light', [1, 2]], [11.6, 'light', [4]], [11.85, 'light', [3]],
        [21.8, 'dark', [3]], [22.0, 'dark', [4]], [22.2, 'dark', [1, 2]], [22.4, 'dark', [5]], [22.6, 'dark', [6]], [22.8, 'dark', [7]], [23.0, 'dark', [8]],
        [23.0, 'power', 0, 0.8]],
    },
    copyOn: [[10.0, 23.8]], name: [[11.0, 21.8]],
    tags: [[10.6, 13.0, 'Copy created'], [23.0, 25.5, 'Copy removed']],
  },
  end: {
    g: {
      mv: [[1.0, 2.6, 'end', 'walk'], [8.4, 10.0, 'home', 'walk']],
      face: [[2.6, 0], [8.4, 1]], yaw: [[2.6, { abs: -20 }, 0.4], [8.4, 0, 0.8]],
      look: [[2.8, 'panel:stories'], [4.9, 'card'], [6.0, 'panel:stories'], [8.0, 'you']],
      r: [[2.8, 8.0, 'point', 'panel:stories'], [10.2, 11.6, 'wave', 2], [12.8, 13.4, 'hang', null, 0.12]],
      l: [[4.8, 8.0, 'present', null, 0.3], [12.8, 13.4, 'hang', null, 0.12]],
      parts: [[14.4, 'dark', [6]], [15.0, 'dark', [5]], [15.6, 'dark', [1, 2]], [16.2, 'dark', [7]], [16.8, 'dark', [8]], [17.4, 'dark', [4]],
        [18.4, 'dark', [3]], [18.6, 'light', [3]], [18.8, 'dark', [3]], [19.0, 'light', [3]], [19.6, 'dark', [3]], [14.4, 'power', 0.12, 5.2]],
    },
    ray: [[3.0, 8.0]], card: [[4.8, 8.0]],
    tags: [[13.0, 16.8, 'Powering down']],
  },
};

// ------------------------------------------------------------------ compiling: chapter times made absolute
function compileScript(script, ch) {
  const G = { g: actorTracks(), c: actorTracks(), ray: [], target: [], lit: [], marks: -1e9, line: [-1e9, -1e9], net: { leave: -1e9, grow: [-1e9, -1e9], links: [], sprout: [-1e9, -1e9] },
    dim: [], beads: [], signals: [], menu: [], trails: [], card: [], floor: [], quiet: [], ntag: [], tags: [], copyOn: [], name: [], end: 0 };
  const sh = (a, x) => (typeof x === 'number' ? x + a : x);
  for (const c of ch) {
    const s = script[c.key];
    if (!s) continue;
    const a = c.a;
    for (const who of ['g', 'c']) {
      const T = s[who];
      if (!T) continue;
      for (const k in T) for (const e of T[k]) {
        if (k === 'sweep') { G[who].sweep.push(e + a); continue; }
        const n = e.slice();
        n[0] += a;
        if (['mv', 'l', 'r', 'tilt'].includes(k)) n[1] += a;
        if ((k === 'l' || k === 'r') && Array.isArray(n[3]) && Array.isArray(n[3][0])) n[3] = n[3].map(([t, tg]) => [t + n[0], tg]);
        G[who][k].push(n);
      }
    }
    for (const k of ['ray', 'target', 'lit', 'trails', 'card', 'quiet', 'ntag', 'tags', 'copyOn', 'name']) for (const e of s[k] || []) { const n = e.slice(); n[0] += a; n[1] += a; G[k].push(n); }
    for (const k of ['dim', 'beads', 'signals']) for (const e of s[k] || []) { const n = e.slice(); n[0] += a; G[k].push(n); }
    for (const e of s.menu || []) { const o = Object.assign({}, e[3] || {}); if (o.tab !== undefined) o.tab += a; if (o.rows) o.rows = o.rows.map(x => x + a); G.menu.push([e[0] + a, e[1] + a, e[2], o]); }
    for (const e of s.floor || []) G.floor.push([e[0] + a, e[1] + a, e[2], e[3]]);
    if (s.marks >= 0) G.marks = s.marks + a;
    if (s.line) G.line = [s.line[0] + a, s.line[1] + a];
    if (s.net && s.net.leave >= 0) G.net = { leave: s.net.leave + a, grow: s.net.grow.map(x => x + a), links: s.net.links.map(x => x + a), sprout: s.net.sprout.map(x => x + a) };
    G.end = Math.max(G.end, c.b);
  }
  sortG(G);
  return G;
}
function actorTracks() { return { mv: [], yaw: [], face: [], look: [], eye: [], nod: [], sweep: [], tilt: [], l: [], r: [], parts: [] }; }
function sortG(G) {
  for (const who of ['g', 'c']) for (const k in G[who]) G[who][k].sort((x, y) => (k === 'sweep' ? x - y : x[0] - y[0]));
  for (const k of ['ray', 'target', 'lit', 'dim', 'beads', 'signals', 'menu', 'trails', 'card', 'floor', 'quiet', 'ntag', 'tags', 'copyOn', 'name']) G[k].sort((x, y) => x[0] - y[0]);
}

// ------------------------------------------------------------------ easing and small maths
const gClamp = (x, a, b) => Math.max(a, Math.min(b, x));
const gSmooth = x => { x = gClamp(x, 0, 1); return x * x * (3 - 2 * x); };
const gOut3 = x => { x = gClamp(x, 0, 1); return 1 - (1 - x) * (1 - x) * (1 - x); };
const gWrap = a => ((a + 180) % 360 + 360) % 360 - 180;   // degrees into -180 .. 180
const gLerp = (a, b, x) => a + (b - a) * x;
const gV = (a, b, x) => [a[0] + (b[0] - a[0]) * x, a[1] + (b[1] - a[1]) * x, a[2] + (b[2] - a[2]) * x];
const gNorm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// distance along a move of length L over T s at time x s: constant speed with ramps of r s at each end
function gTrap(x, T, L, r) {
  if (T <= 0) return L;
  r = Math.min(r, T / 2);
  const v = L / (T - r);
  if (x <= 0) return 0;
  if (x >= T) return L;
  if (x < r) return v * x * x / (2 * r);
  if (x > T - r) return L - v * (T - x) * (T - x) / (2 * r);
  return v * (r / 2 + x - r);
}
const RAMP = { walk: 0.3, glide: 0.1, snap: 0.075, shift: 0.4 };
// a move's cruise speed (m/s, story time) and its length
function moveSpeed(from, m) {
  const p = GUIDE.PLACE[m[2]] || m[2], L = Math.hypot(p[0] - from[0], p[1] - from[1]), T = m[1] - m[0], r = Math.min(RAMP[m[3]] || 0.3, T / 2);
  return { L, T, v: T > 0 ? L / (T - r) : 0 };
}
// where an actor stands (the floor point under its head) at t, and how far it has walked (for the bob)
function gPos(A, t) {
  let p = GUIDE.PLACE.home, walked = 0;
  for (const m of A.mv) {
    const q = GUIDE.PLACE[m[2]] || m[2];
    if (t < m[0]) break;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (m[3] === 'snap' && m[1] <= m[0]) { p = q; continue; }
    const T = Math.max(m[1] - m[0], m[3] === 'snap' ? 0.15 : 0), d = gTrap(t - m[0], T, L, RAMP[m[3]] || 0.3);
    if (m[3] === 'walk') walked += d;
    if (t < m[0] + T) { const k = L > 0 ? d / L : 1; return { p: [gLerp(p[0], q[0], k), gLerp(p[1], q[1], k)], walked, moving: m[3] }; }
    p = q;
  }
  return { p, walked, moving: '' };
}
const gBearing = (p, to) => Math.atan2(to[0] - p[0], to[2] - p[1]) / GUIDE.D;   // the heading (deg) from p (x, z) towards to (x, y, z)
// the robot's turn: a steady rate with 60 ms eases, then a 2 degree overshoot settling in 0.15 s
function gTurn(t, k0, v0, v1, dur) {
  const x = t - k0, d = v1 - v0;
  if (x <= 0) return v0;
  if (x < dur) return v0 + d * (dur > 0 ? gTrap(x, dur, 1, 0.06) : 1);
  const y = x - dur;
  return y < 0.15 && Math.abs(d) > 5 ? v1 + Math.sign(d) * 2 * Math.sin(Math.PI * y / 0.15) * (1 - y / 0.15) : v1;
}
// a target's place in the set's frame (live: the viewer's head and ray, the panel's buttons)
function gTarget(tg, t, live, G) {
  if (Array.isArray(tg)) return tg;
  if (typeof tg !== 'string') return null;
  if (tg === 'you') return live.head;
  if (tg === 'target') return GUIDE.PT;
  if (tg === 'net') return GUIDE.NET.C;
  if (tg === 'ray') return live.ray || GUIDE.PT;
  if (tg === 'copy') return G && G.copyHead ? G.copyHead : [GUIDE.PLACE.copy[0], 1.6, GUIDE.PLACE.copy[1]];
  if (tg === 'copyPlace') return [GUIDE.PLACE.copy[0], 1.3, GUIDE.PLACE.copy[1]];
  if (tg.startsWith('panel:')) { const k = tg.slice(6); return (live.panel && live.panel[k]) || GUIDE.PANEL_PAGE[k] || GUIDE.PANEL_PAGE.top; }
  if (tg.startsWith('node:')) return gNode(+tg.slice(5));
  if (tg.startsWith('mark:')) { const m = GUIDE.MARKS[+tg.slice(5)]; return [m[0], 0, m[1]]; }
  return null;
}
const gNode = i => { const u = GUIDE.NET.U[i] || [0, 0, 0], C = GUIDE.NET.C, R = GUIDE.NET.R; return [C[0] + u[0] * R, C[1] + u[1] * R, C[2] + u[2] * R]; };
// a point in the set's frame into the actor's own (origin its floor point, x its left, z its forward)
function gLocal(P, h, q) {
  const s = Math.sin(h * GUIDE.D), c = Math.cos(h * GUIDE.D), dx = q[0] - P[0], dz = q[2] - P[1];
  return [dx * c - dz * s, q[1], dx * s + dz * c];
}
// a gesture's wrist and aim (the actor's frame); side 0 left, 1 right
function gGesture(g, side, args, t, t0, P, h, live, G) {
  const sg = side ? -1 : 1, sh = [sg * GUIDE.SHOULDER[0], GUIDE.SHOULDER[1], GUIDE.SHOULDER[2]];
  switch (g) {
    case 'tpose': return { w: [sg * 0.725, 1.41, 0], a: [sg, 0, 0] };
    case 'wave': {
      const s = Math.tanh(3 * Math.sin(2 * Math.PI * 1.6 * (t - t0))) / Math.tanh(3);
      return { w: [sg * 0.36 + 0.08 * s, 1.62, 0.12], a: [sg * 0.25 + 0.1 * s, 1, 0.1] };
    }
    case 'palms': return { w: [sg * 0.27, 1.45, 0.3], a: [sg * 0.25, 0.85, 0.45] };
    case 'tapChest': return { w: [sg * 0.04, 1.33, 0.22], a: [0, 0, -1] };
    case 'forearm': return { w: [sg * 0.1, 1.15, 0.38], a: [-sg * 0.3, 0, 1] };
    case 'tapArm': return { w: [-sg * 0.02, 1.22, 0.3], a: [-sg * 0.6, -0.7, 0.25] };
    case 'stick': { const m = (t - t0) / 1.2, press = m > 0.4 && m < 0.65 ? 0.02 : 0; return { w: [sg * 0.15, 1.05 - press, 0.3], a: [0, -0.5, 1] }; }
    case 'present': return { w: [sg * 0.3, 1.25, 0.35], a: [0, Math.sin(20 * GUIDE.D), Math.cos(20 * GUIDE.D)] };
    case 'point': case 'aimOff': {
      let tg = args;
      if (Array.isArray(args) && Array.isArray(args[0])) {
        // keyframes [[t, target] ...]: eased from one to the next
        let i = 0;
        while (i + 1 < args.length && t >= args[i + 1][0]) i++;
        const a = gTarget(args[i][1], t, live, G), b = i + 1 < args.length ? gTarget(args[i + 1][1], t, live, G) : a;
        const span = i + 1 < args.length ? args[i + 1][0] - args[i][0] : 1, x = i + 1 < args.length ? gSmooth((t - args[i][0]) / span) : 0;
        tg = gV(a, b, x);
      } else tg = gTarget(args, t, live, G);
      const q = gLocal(P, h, tg || GUIDE.PT), d = gNorm([q[0] - sh[0], q[1] - sh[1], q[2] - sh[2]]);
      return { w: [sh[0] + 0.5 * d[0], sh[1] + 0.5 * d[1], sh[2] + 0.5 * d[2]], a: d, at: tg };
    }
    default: return { w: [sg * 0.21, 0.87, 0.02], a: [0, -1, 0] };   // hang (where bodies.js puts a hand given none)
  }
}
const HANG = side => ({ w: [(side ? -1 : 1) * 0.21, 0.87, 0.02], a: [0, -1, 0] });
const gMix = (A, B, x) => ({ w: gV(A.w, B.w, x), a: gNorm(gV(A.a, B.a, x)), at: x > 0.5 ? B.at : A.at });
// a hand at t: the latest span begun, eased in from where the hand was as it began, and out to hanging after it
function gHand(spans, i, side, t, P, h, live, G) {
  while (i >= 0 && t < spans[i][0]) i--;
  if (i < 0) return HANG(side);
  const s = spans[i], din = s[4] || 0.18, dout = s[5] || 0.18;
  const from = gHand(spans, i - 1, side, s[0], P, h, live, G);
  if (t <= s[1]) return gMix(from, gGesture(s[2], side, s[3], t, s[0], P, h, live, G), gOut3((t - s[0]) / din));
  const at = gMix(from, gGesture(s[2], side, s[3], s[1], s[0], P, h, live, G), gOut3((s[1] - s[0]) / din));
  return gMix(at, HANG(side), gOut3((t - s[1]) / dout));
}
// the parts at t: hidden and dark masks, power, and the latest flash
function gParts(list, t) {
  let hide = 0, dark = 0, pw = 1, p0 = 1, pt = -1, pd = 0, pv = 1, flash = null;
  const bits = ids => ids.reduce((m, i) => m | (1 << i), 0);
  for (const e of list) {
    if (e[0] > t) break;
    if (e[1] === 'hide') hide |= bits(e[2]);
    else if (e[1] === 'show') hide &= ~bits(e[2]);
    else if (e[1] === 'dark') dark |= bits(e[2]);
    else if (e[1] === 'light') dark &= ~bits(e[2]);
    else if (e[1] === 'flash') { const a = 1 - (t - e[0]) / 0.35; flash = a > 0 ? [e[2], Math.min(0.99, a)] : flash && flash[1] > 0 ? flash : null; }
    else if (e[1] === 'power') { p0 = pt < 0 ? pv : gLerp(p0, pv, gClamp((e[0] - pt) / (pd || 1e-6), 0, 1)); pt = e[0]; pd = e[3]; pv = e[2]; }
  }
  if (pt >= 0) pw = pd > 0 ? gLerp(p0, pv, gClamp((t - pt) / pd, 0, 1)) : pv;
  return { hide, dark, power: pw, flash };
}
// a value track [t, v] eased (smooth) over d s from the value before
function gEase(list, t, d, v) {
  for (const e of list) {
    if (e[0] > t) break;
    v = gLerp(v, e[1], gSmooth((t - e[0]) / d));
  }
  return v;
}

// ------------------------------------------------------------------ one actor at t
function evalActor(A, t, live, G) {
  const pos = gPos(A, t), P = pos.p, base = gBearing(P, [0, 0, 0]);
  // its heading: the scripted turns (from facing the viewer's start), then blended towards the viewer's live head
  const rel = gTurnValue(A.yaw, t);
  const face = gEase(A.face, t, 0.4, 1);
  const toYou = gBearing(P, live.head);
  let heading = base + rel;
  heading += gWrap(toYou - heading) * face;
  // eye height and the bob of a walk (8 mm at each half-stride)
  const eye = gEase(A.eye, t, 0.3, GUIDE.EYE) - (pos.moving === 'walk' ? 0.008 * Math.abs(Math.sin(Math.PI * pos.walked / 0.35)) : 0);
  // the look: towards its target (at most 80 degrees off the heading), eased between targets over 0.25 s
  const headP = [P[0], eye, P[1]];
  const lookOf = tg => {
    if (tg === 'fwd' || !tg) return [0, 0];
    if (typeof tg === 'object' && !Array.isArray(tg)) return [tg.yaw || 0, tg.pitch || 0];
    if (tg === 'menu' || tg === 'card' || tg === 'arm') return tg === 'arm' ? [-25, -40] : [-20, -22];
    const q = gTarget(tg, t, live, G);
    if (!q) return [0, 0];
    const dx = q[0] - headP[0], dy = q[1] - headP[1], dz = q[2] - headP[2];
    return [gClamp(gWrap(Math.atan2(dx, dz) / GUIDE.D - heading), -80, 80), gClamp(Math.atan2(dy, Math.hypot(dx, dz)) / GUIDE.D, -60, 50)];
  };
  let ly = 0, lp = 0;
  {
    let i = -1;
    for (let k = 0; k < A.look.length && A.look[k][0] <= t; k++) i = k;
    if (i >= 0) {
      const cur = lookOf(A.look[i][1]), prev = i > 0 ? lookOf(A.look[i - 1][1]) : [0, 0], x = gSmooth((t - A.look[i][0]) / 0.25);
      ly = gLerp(prev[0], cur[0], x); lp = gLerp(prev[1], cur[1], x);
    }
  }
  // nods, the visor's sweep, a puzzled tilt
  let nod = 0, sweep = 0, roll = 0;
  for (const e of A.nod) { const x = t - e[0]; if (x >= 0 && x < e[1] * 0.28) { const y = x % 0.28; nod = -14 * (y < 0.14 ? gSmooth(y / 0.14) : 1 - gSmooth((y - 0.14) / 0.14)); } }
  for (const s of A.sweep) { const x = t - s; if (x >= 0 && x < 0.6) sweep = x < 0.15 ? -15 * gSmooth(x / 0.15) : x < 0.45 ? -15 + 30 * gSmooth((x - 0.15) / 0.3) : 15 - 15 * gSmooth((x - 0.45) / 0.15); }
  for (const e of A.tilt) { const x = t - e[0]; if (x >= 0 && t <= e[1] + 0.3) roll = e[2] * Math.min(gSmooth(x / 0.3), gSmooth((e[1] + 0.3 - t) / 0.3)); }
  const hy = heading + ly + sweep, hp = lp + nod;
  // the head pose: [x, y, z, qx, qy, qz, qw], looking along its -z: a turn (hy + 180) about y, then pitch, then roll
  const q = qMul(qMul(qAxis(0, 1, 0, (hy + 180) * GUIDE.D), qAxis(1, 0, 0, hp * GUIDE.D)), qAxis(0, 0, 1, roll * GUIDE.D));
  const hands = [0, 1].map(s => gHand(s ? A.r : A.l, (s ? A.r : A.l).length - 1, s, t, P, heading, live, G));
  const parts = gParts(A.parts, t);
  return { p: P, heading, eye, head: [P[0], eye, P[1], q[0], q[1], q[2], q[3]], hands, hide: parts.hide, dark: parts.dark, power: parts.power, flash: parts.flash,
    moving: pos.moving, look: [hy, hp] };
}
// a yaw track's relative heading at t (each key turns from where the last left it)
function gTurnValue(list, t) {
  let v = 0, out = 0;
  for (const e of list) {
    if (e[0] > t) break;
    const want = typeof e[1] === 'object' ? e._rel : e[1];
    out = gTurn(t, e[0], v, want, e[2]);
    v = want;
  }
  return out;
}
const qAxis = (x, y, z, a) => { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; };
const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
// absolute headings in yaw tracks resolved once (relative to facing the viewer's start where the turn ends)
function resolveYaw(A) {
  for (const e of A.yaw) if (typeof e[1] === 'object') e._rel = gWrap(e[1].abs - gBearing(gPos(A, e[0] + e[2]).p, [0, 0, 0]));
}

// ------------------------------------------------------------------ the whole frame at t
const LIVE0 = { head: [0, 1.6, 0], ray: null, panel: null, room: false };
function evalGuide(G, t, live) {
  live = live || LIVE0;
  if (!G.resolved) { resolveYaw(G.g); resolveYaw(G.c); G.resolved = true; }
  const on = list => list.some(e => t >= e[0] && t <= e[1]);
  const fade = (list, din, dout) => list.reduce((a, e) => Math.max(a, Math.min(gSmooth((t - e[0]) / din), gSmooth((e[1] + dout - t) / dout))), 0);
  const copyA = fade(G.copyOn, 0.01, 0.01) > 0 ? evalActor(G.c, t, live, G) : null;
  G.copyHead = copyA ? copyA.head.slice(0, 3) : null;
  const F = { t, g: evalActor(G.g, t, live, G), c: copyA };
  F.ray = fade(G.ray, 0.3, 0.2);
  F.target = fade(G.target, 0.3, 0.3);
  F.lit = on(G.lit);
  F.marks = t - G.marks;   // seconds since the markers left the spine
  F.line = gSmooth((t - G.line[0]) / Math.max(0.01, G.line[1] - G.line[0]));
  const N = G.net;
  F.net = { fly: gClamp((t - N.leave) / 1.6, 0, 1), left: t >= N.leave, grow: gSmooth((t - N.grow[0]) / Math.max(0.01, N.grow[1] - N.grow[0])),
    links: N.links.map(x => gSmooth((t - x) / 0.3)), sprout: gSmooth((t - N.sprout[0]) / Math.max(0.01, N.sprout[1] - N.sprout[0])) };
  F.net.dim = gEaseD(G.dim, t, 1);
  F.beads = beadsAt(G, t, F.net.sprout > 0.5);
  F.menu = null;
  for (const m of G.menu) if (t >= m[0] - 0.01 && t <= m[1] + 0.3) {
    const a = Math.min(gSmooth((t - m[0]) / 0.3), gSmooth((m[1] + 0.3 - t) / 0.3));
    F.menu = { a, kind: m[2], tab: m[3].tab !== undefined && t >= m[3].tab, rows: (m[3].rows || []).map(x => (t >= x ? 1 : 0)), shown: m[3].tab === undefined || t >= m[3].tab };
  }
  F.trails = on(G.trails);
  F.card = fade(G.card, 0.3, 0.3);
  F.floor = 1;
  for (const e of G.floor) if (t >= e[0]) F.floor = gLerp(e[2], e[3], gSmooth((t - e[0]) / Math.max(0.01, e[1] - e[0])));
  F.quiet = on(G.quiet);
  F.ntag = -1;
  for (const e of G.ntag) if (t >= e[0] && t <= e[1]) F.ntag = e[2];
  F.tag = null; F.tagA = 0;
  for (const e of G.tags) if (t >= e[0] && t <= e[1] + 0.2) { F.tag = e[2]; F.tagA = Math.min(gSmooth((t - e[0]) / 0.2), gSmooth((e[1] + 0.2 - t) / 0.2)); }
  F.name = on(G.name);
  F.copyA = fade(G.copyOn, 0.01, 0.01);
  return F;
}
function gEaseD(list, t, v) {
  for (const e of list) { if (e[0] > t) break; v = gLerp(v, e[1], gSmooth((t - e[0]) / Math.max(0.01, e[2]))); }
  return v;
}
// the signals: from a node, hop by hop (breadth first) along the links there are, a bead a link in 0.35 s; and a bead
// from the fist to the hub (0.4 s). Beads [from, to, x (0 to 1)]; from 'fist' is the right fist
function beadsAt(G, t, grown) {
  const out = [], n = grown ? 10 : 4, links = GUIDE.NET.L.filter(l => l[0] < n && l[1] < n);
  for (const b of G.beads) { const x = (t - b[0]) / 0.4; if (x >= 0 && x <= 1) out.push(['fist', 0, x]); }
  for (const s of G.signals) {
    const x0 = t - s[0];
    if (x0 < 0 || x0 > 2.5) continue;
    const lv = gLevels(s[1], links, n);
    for (const [a, b] of links) {
      let u = a, v = b;
      if (lv[b] < lv[a]) { u = b; v = a; }
      if (lv[v] !== lv[u] + 1) continue;
      const x = (x0 - lv[u] * 0.35) / 0.35;
      if (x >= 0 && x <= 1) out.push([u, v, x]);
    }
  }
  return out;
}
function gLevels(src, links, n) {
  const lv = new Array(n).fill(99);
  if (!(src >= 0 && src < n)) return lv;
  lv[src] = 0;
  const q = [src];
  while (q.length) { const u = q.shift(); for (const [a, b] of links) { const v = a === u ? b : b === u ? a : -1; if (v >= 0 && lv[v] > lv[u] + 1) { lv[v] = lv[u] + 1; q.push(v); } } }
  return lv;
}
// how long a signal from a node takes to reach the furthest node (s), for signalOn
const signalSpan = (src, grown) => { const n = grown ? 10 : 4, lv = gLevels(src, GUIDE.NET.L.filter(l => l[0] < n && l[1] < n), n); return Math.max(...lv.filter(x => x < 99)) * 0.35; };
if (typeof module !== 'undefined') module.exports = { GUIDE, SCRIPT, compileScript, evalGuide, evalActor, gPos, moveSpeed, beadsAt, actorTracks, sortG, signalSpan, gLevels };
