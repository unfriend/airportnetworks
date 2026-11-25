// VR goggles: a flight through the cell (HOST.flight, v197; the owner, 24 November 2026: a pair of goggles placed in the
// studio, put on in a headset by bringing them to your face, and an opaque game world over everything: "fly a ship through
// the cell of Back into the cell", scanning real proteins and following their links). The shell's own module, as ships.js
// is, loaded on demand (HOST.flightLoad, index.html) by a page that offers goggles (the studio's kind 'goggles' shape,
// tools/studio/engine/e6z_goggles.js). Stage 1: one player in a headset, sitting or standing still. Stage 2 (a shuttle with
// a screen and a crew shared through the room): its screen came in v203 as the game's status (status(), drawn by the
// studio on a GameScreen material); a crew is not built; the parts are kept apart for it:
//   - the world (WORLD below): built once from the ppicell package's own data file (its src/sets/data.js, read as JSON,
//     never run), laid out from a fixed seed: the same on every device, no Math.random;
//   - the rules (RULES): a game's state stepped by an input ({ turn, climb, thrust, scan, aim }) and a time step, nothing
//     else; the drones move by the game's clock alone;
//   - the input (sense, inputOf): this headset's two controllers (v203: each grip a throttle, both sticks steer, the right
//     trigger scans; a crew's station could give another);
//   - the view (V): a cockpit round the wearer's head and the world drawn round it, in the story's scene.
// Wearing is this device's own: never in state() or collab.state(), no room key, no FORMAT change. Since v203 the game's
// status (status(): its counts and the names of two proteins, never a pose) goes out as the studio's ephemeral effect for
// the shuttle's game screen (tools/studio/engine/e6z_goggles.js).
HOST.flight = (function () {
  'use strict';
  const V3 = THREE.Vector3, Q4 = THREE.Quaternion, M4 = THREE.Matrix4;
  const DEG = Math.PI / 180;
  // ---------------------------------------------------------------------------------------------- the numbers (tune on a Quest)
  // putting them on and taking them off (m): the goggles within on of the head put them on (the page that owns them says
  // so); a hand's grip pressed within on of the head and pulled past off with it held takes them off (a grip held as they
  // went on must be let go first)
  const WEAR = { on: 0.2, off: 0.4 };
  // the safety bubble (m along the floor from where they went on): from fade0 the game fades out to the room, at fade1 it
  // is gone; past pause it waits (its clock stops) until you come back. In AR the headset shows no boundary: the game is
  // for sitting or standing still
  const BUBBLE = { fade0: 0.3, fade1: 0.5, pause: 0.4, lost: 300 };
  // (v198, failing safe: no head pose for lost ms counts as outside the bubble, faded out and paused; a head that is not a
  // number counts as far away; a recentre or any move of the origin takes them off, since the seat is no longer known)
  // the stick (the spaceship's: a dead zone, then the push's share to a power), and the ship. v203 (the owner, 25 November
  // 2026: "The auto drive in the game is weird, so let's use the grip on both hands for throttle control"): no drive of
  // its own; each controller's grip is a throttle, the thrust their sum (each squeezed fully half of top m/s, both the
  // whole; with one controller its grip alone the whole), speeding up at most accel m/s2 and, let go, coasting to a stop
  // at coast m/s2; either stick steers (the two added): turning at most turn deg/s about the vertical, climbing or diving
  // at most climb m/s; the view stays level (no pitch, no roll, no loops: the owner's rule for the spaceships). Pushed
  // right turns right, forward dives, back climbs, as the spaceship
  const STICK = (HOST.ships && HOST.ships.STICK) || { dz: 0.15, expo: 1.5 };
  const FLY = { top: 2.0, accel: 2.5, coast: 1.0, turn: 50, climb: 1.4, tau: 0.3 };
  // the cell (m): the plasma membrane's radius, how far out the ship may go; where it starts (looking at the nucleus)
  const CELL = { R: 40, wall: 37, start: [0, 0, 30] };
  // scanning: the protein nearest the nose's line within cone degrees and reach m; following a link: flying within touch
  // m of the next partner
  const SCAN = { cone: 7, reach: 32, touch: 2.2 };
  // drones (our own design): how many in the cell, how near they bump the ship (m), how far they swing (m), the bump's
  // push back (m/s) and the time before the next can count (s)
  const DRONE = { n: 40, hit: 1.1, amp: 4, back: 1.6, calm: 1.5, near: 42 };
  // drawn: the scanned protein's links at most; proteins fade between near and far m
  const SEE = { links: 120, near: 24, far: 40, size: 0.3 };
  const SEED = 197;
  // the data: the ppicell package's own file (its generated data, derived numbers only; never copied elsewhere)
  const DATA = { key: 'ppicell', file: 'src/sets/data.js' };
  const COL = ['#7fb8ff', '#b48cff', '#ff8ad8', '#4fe0c4', '#ffd166', '#ff7b54', '#ff5d8f', '#9be15d', '#ffe45e', '#5ad1ff', '#c3a6ff', '#dfe6ef', '#ffa24c'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrapA = a => { a %= 2 * Math.PI; return a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a; };
  const nOf = (n, one) => n + ' ' + one + (n === 1 ? '' : 's');
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  let L = null;   // the shell's link (shared.js: notices, the log, camera, phone, changed)
  const link = () => L || (L = HOST.shellLink || null);
  const say = (t, x, ms) => { try { const l = link(); if (l && l.notice) l.notice(t, x, ms || 3500); } catch (e) { /* no notice */ } };
  const log = (ev, o) => { try { const l = link(); if (l && l.log) l.log(ev, o); } catch (e) { /* no log */ } };
  const changed = () => { try { const l = link(); if (l && l.changed) l.changed(); } catch (e) { /* none */ } };

  // ---------------------------------------------------------------------------------------------- the world (seeded)
  // a small seeded generator (mulberry32): the layout is the same on every device
  function rngOf(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // a direction (uniform on the sphere), into o at i
  function dirInto(r, o, i) { const z = 2 * r() - 1, a = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z); o[i] = s * Math.cos(a); o[i + 1] = z; o[i + 2] = s * Math.sin(a); }
  const _d3 = new Float64Array(3);
  // the bodies of the cell, from the seed: the nucleus and nucleolus, the Golgi, mitochondria, lysosomes, endosomes,
  // peroxisomes, vesicles (each a ball or an ellipsoid: c, r [x, y, z], yaw) and the cytoskeleton's fibres (a, b)
  function bodiesOf(r) {
    const B = { nucleus: { c: [0, 0, 0], r: 13 }, nucleolus: { c: [2.5, 2, -1.5], r: 3.5 }, golgi: { c: [10, 5, 21], r: [5, 1.8, 3.5], yaw: 0.6 }, list: [], fibres: [] };
    const put = (place, n, lo, hi, rad) => {
      for (let k = 0; k < n; k++) {
        dirInto(r, _d3, 0);
        const d = lo + (hi - lo) * r();
        B.list.push({ place, c: [_d3[0] * d, _d3[1] * d * 0.8, _d3[2] * d], r: rad.slice(), yaw: r() * Math.PI * 2 });
      }
    };
    put(5, 8, 24, 32, [3.2, 1.3, 1.3]); put(6, 6, 22, 33, [1.6, 1.6, 1.6]); put(7, 6, 25, 35, [1.4, 1.4, 1.4]); put(8, 6, 21, 34, [1.2, 1.2, 1.2]); put(12, 12, 20, 36, [0.9, 0.9, 0.9]);
    for (let k = 0; k < 14; k++) {
      dirInto(r, _d3, 0);
      const a = [_d3[0] * 14, _d3[1] * 14, _d3[2] * 14];
      dirInto(r, _d3, 0);
      const b = [a[0] / 14 * 20 + _d3[0] * 18, a[1] / 14 * 20 + _d3[1] * 18, a[2] / 14 * 20 + _d3[2] * 18], l = Math.hypot(...b);
      if (l > 37.5) for (let j = 0; j < 3; j++) b[j] *= 37.5 / l;
      B.fibres.push({ a, b });
    }
    return B;
  }
  // inside an ellipsoid body (scaled by k): its own frame turned by its yaw
  function inside(b, x, y, z, k) {
    const dx = x - b.c[0], dy = y - b.c[1], dz = z - b.c[2], c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0);
    const u = dx * c - dz * s, w = dx * s + dz * c, R = Array.isArray(b.r) ? b.r : [b.r, b.r, b.r];
    return (u / (R[0] * k)) ** 2 + (dy / (R[1] * k)) ** 2 + (w / (R[2] * k)) ** 2 < 1;
  }
  // a point in an ellipsoid body (uniform in its volume), into o at i
  function inBody(r, b, o, i, shell) {
    dirInto(r, o, i);
    const R = Array.isArray(b.r) ? b.r : [b.r, b.r, b.r], d = shell ? 1 : Math.cbrt(r()), c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0);
    const u = o[i] * R[0] * d, y = o[i + 1] * R[1] * d, w = o[i + 2] * R[2] * d;
    o[i] = b.c[0] + u * c + w * s; o[i + 1] = b.c[1] + y; o[i + 2] = b.c[2] - u * s + w * c;
  }
  // a protein of place k: a spot in its part of the cell (its own seeded generator), into o at i
  function spot(B, k, r, o, i) {
    const shellAt = (lo, hi) => { dirInto(r, o, i); const d = lo + (hi - lo) * r(); o[i] *= d; o[i + 1] *= d; o[i + 2] *= d; };
    const any = place => { const L2 = B.list.filter(b => b.place === place); return L2[Math.floor(r() * L2.length)]; };
    if (k === 1) { for (let t = 0; t < 8; t++) { inBody(r, { c: B.nucleus.c, r: 11.6 }, o, i); if (!inside(B.nucleolus, o[i], o[i + 1], o[i + 2], 1.05)) return; } return; }
    if (k === 2) { inBody(r, B.nucleolus, o, i); return; }
    if (k === 3) { shellAt(14.6, 18); return; }
    if (k === 10) { shellAt(12.2, 13); return; }
    if (k === 9) { shellAt(38.6, 40); return; }
    if (k === 4) {   // the Golgi: four flat stacked cisternae
      const g = B.golgi, j = Math.floor(r() * 4), a = 2 * Math.PI * r(), d = Math.sqrt(r()), c = Math.cos(g.yaw), s = Math.sin(g.yaw);
      const u = Math.cos(a) * d * g.r[0] * (1 - j * 0.12), w = Math.sin(a) * d * g.r[2] * (1 - j * 0.12);
      o[i] = g.c[0] + u * c + w * s; o[i + 1] = g.c[1] + (j - 1.5) * 0.9 + (r() - 0.5) * 0.25; o[i + 2] = g.c[2] - u * s + w * c;
      return;
    }
    if (k === 11) {   // the cytoskeleton: along its fibres
      const f = B.fibres[Math.floor(r() * B.fibres.length)], t = r();
      for (let j = 0; j < 3; j++) o[i + j] = f.a[j] + (f.b[j] - f.a[j]) * t + (r() - 0.5) * 0.5;
      return;
    }
    if (k === 5 || k === 6 || k === 7 || k === 8 || k === 12) { inBody(r, any(k), o, i); return; }
    // the cytosol: between the ER and the membrane, out of the bodies
    for (let t = 0; t < 8; t++) {
      shellAt(19, 37.5); o[i + 1] *= 0.92;
      if (!B.list.some(b => inside(b, o[i], o[i + 1], o[i + 2], 1.15)) && !inside(B.golgi, o[i], o[i + 1], o[i + 2], 1.15)) return;
    }
  }
  const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const u16 = s => { const b = bytes(s); return new Uint16Array(b.buffer, b.byteOffset, b.length / 2); };
  // the world from the data (PPI_DATA's fields: sym, pl, main, links; as the package's pdata.js decodes them): every
  // protein with a place, at its main place (one dot each: a protein in several places is drawn at its main one); its links
  // to other placed proteins; how many links it has in this map; the bodies, the membranes' dots and the drones
  function buildWorld(D) {
    const sym = D.sym.split('|'), pl = u16(D.pl), main = u16(D.main), lb = bytes(D.links), N0 = sym.length, E = lb.length / 5;
    const of = new Int32Array(N0).fill(-1), ids = [], place = [];
    for (let p = 0; p < N0; p++) {
      const m = main[p] || pl[p];
      if (!m) continue;
      let k = 0;
      while (!(m >> k & 1)) k++;
      of[p] = ids.length; ids.push(p); place.push(k);
    }
    const N = ids.length, B = bodiesOf(rngOf(SEED)), pos = new Float32Array(N * 3), tmp = new Float64Array(3);
    for (let i = 0; i < N; i++) { spot(B, place[i], rngOf(SEED * 7919 + ids[i] * 31 + 1), tmp, 0); pos[i * 3] = tmp[0]; pos[i * 3 + 1] = tmp[1]; pos[i * 3 + 2] = tmp[2]; }
    // links: every link counted for its proteins (one with itself once); the placed pairs as an adjacency (both ways)
    const deg = new Uint16Array(N0), cnt = new Uint32Array(N + 1);
    for (let e = 0; e < E; e++) {
      const a = lb[5 * e] | lb[5 * e + 1] << 8, b = lb[5 * e + 2] | lb[5 * e + 3] << 8;
      deg[a]++; if (b !== a) deg[b]++;
      if (a !== b && of[a] >= 0 && of[b] >= 0) { cnt[of[a] + 1]++; cnt[of[b] + 1]++; }
    }
    for (let i = 0; i < N; i++) cnt[i + 1] += cnt[i];
    const nb = new Uint16Array(cnt[N]), fill = cnt.slice(0, N);
    for (let e = 0; e < E; e++) {
      const a = lb[5 * e] | lb[5 * e + 1] << 8, b = lb[5 * e + 2] | lb[5 * e + 3] << 8;
      if (a === b || of[a] < 0 || of[b] < 0) continue;
      nb[fill[of[a]]++] = of[b]; nb[fill[of[b]]++] = of[a];
    }
    // the drones: each swings round its own middle in the cytosol (a seeded middle, its swing and rates)
    const r = rngOf(SEED * 13 + 5), drones = [];
    for (let k = 0; k < DRONE.n; k++) {
      dirInto(r, tmp, 0);
      const d = 16 + 20 * r();
      drones.push({ c: [tmp[0] * d, tmp[1] * d * 0.8, tmp[2] * d], w: [0.12 + 0.2 * r(), 0.1 + 0.15 * r(), 0.12 + 0.2 * r()], ph: [r() * 6.28, r() * 6.28, r() * 6.28] });
    }
    return { N, N0, ids, sym, place: Uint8Array.from(place), pos, deg, off: cnt, nb, B, drones, places: D.places, nLinks: D.nLinks, nGenes: D.nGenes };
  }
  // the membranes and bodies as faint dots (only drawn: never scanned), into a list of [x, y, z, place]
  function dotsOf(W) {
    const r = rngOf(SEED * 3 + 11), out = [], t = new Float64Array(3), B = W.B;
    const shell = (place, n, rad, c) => { for (let k = 0; k < n; k++) { dirInto(r, t, 0); out.push(c[0] + t[0] * rad, c[1] + t[1] * rad, c[2] + t[2] * rad, place); } };
    shell(9, 2600, 40.4, [0, 0, 0]); shell(10, 900, 13.3, B.nucleus.c); shell(2, 80, 3.6, B.nucleolus.c);
    for (const b of B.list) { const n = Math.round(30 + 14 * (Array.isArray(b.r) ? b.r[0] : b.r)); for (let k = 0; k < n; k++) { inBody(r, b, t, 0, true); out.push(t[0], t[1], t[2], b.place); } }
    for (const f of B.fibres) { const l = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1], f.b[2] - f.a[2]), n = Math.round(l / 0.7); for (let k = 0; k <= n; k++) out.push(f.a[0] + (f.b[0] - f.a[0]) * k / n, f.a[1] + (f.b[1] - f.a[1]) * k / n, f.a[2] + (f.b[2] - f.a[2]) * k / n, 11); }
    return out;
  }

  // ---------------------------------------------------------------------------------------------- the rules
  // A game: its clock (s, only while it runs), the ship (p, yaw, speed v, climb vy, its turn now, a bump's push), the
  // protein scanned last (cur), its next partner (next), which have been seen, and the score. Deterministic: the same
  // world, inputs and steps give the same game
  function newGame(W) {
    return { t: 0, p: CELL.start.slice(), yaw: 0, v: 0, vy: 0, turn: 0, kick: 0, calm: 0, cur: -1, next: -1, seen: new Uint8Array(W.N),
      scanned: 0, followed: 0, bumps: 0, ev: [] };
  }
  // a drone's place at the game's time t, into out
  function dronePos(W, k, t, out) {
    const d = W.drones[k];
    out[0] = d.c[0] + DRONE.amp * Math.sin(d.w[0] * t + d.ph[0]); out[1] = d.c[1] + DRONE.amp * 0.5 * Math.sin(d.w[1] * t + d.ph[1]); out[2] = d.c[2] + DRONE.amp * Math.sin(d.w[2] * t + d.ph[2]);
    return out;
  }
  // the partner of protein i to fly to next: the nearest placed partner not seen yet (-1: none)
  function nextOf(W, G, i) {
    let best = -1, bd = Infinity;
    const P = W.pos;
    for (let j = W.off[i]; j < W.off[i + 1]; j++) {
      const n = W.nb[j];
      if (G.seen[n]) continue;
      const d = (P[n * 3] - P[i * 3]) ** 2 + (P[n * 3 + 1] - P[i * 3 + 1]) ** 2 + (P[n * 3 + 2] - P[i * 3 + 2]) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  // the protein nearest the line from p along the unit direction d, within the cone and reach (-1: none)
  // (one with a placed partner first, so a scan leads somewhere; else any)
  function aimAt(W, p, d) {
    const P = W.pos, cmin = Math.cos(SCAN.cone * DEG), r2 = SCAN.reach * SCAN.reach;
    let best = -1, bc = cmin, lone = -1, lc = cmin;
    for (let i = 0; i < W.N; i++) {
      const x = P[i * 3] - p[0], y = P[i * 3 + 1] - p[1], z = P[i * 3 + 2] - p[2], l2 = x * x + y * y + z * z;
      if (l2 > r2 || l2 < 0.04) continue;
      const c = (x * d[0] + y * d[1] + z * d[2]) / Math.sqrt(l2);
      if (W.off[i + 1] > W.off[i]) { if (c > bc) { bc = c; best = i; } } else if (c > lc) { lc = c; lone = i; }
    }
    return best >= 0 ? best : lone;
  }
  function visit(W, G, i) {
    G.cur = i;
    if (!G.seen[i]) { G.seen[i] = 1; G.scanned++; }
    G.next = nextOf(W, G, i);
  }
  const _dp = new Float64Array(3);
  // one step: I = { turn, climb (-1 to 1, shaped), thrust (0 to 1), scan (pressed now), aim (a protein or -1) }; dt in s.
  // What happened goes into G.ev ('scan', 'follow', 'bump', 'end': no partner left)
  function step(W, G, I, dt) {
    G.ev.length = 0;
    if (!(dt > 0)) return G;
    dt = Math.min(dt, 0.1);
    G.t += dt;
    const e = 1 - Math.exp(-dt / FLY.tau);
    G.turn += (I.turn * FLY.turn * DEG - G.turn) * e;
    G.yaw = wrapA(G.yaw - G.turn * dt);   // (pushed right: turns right)
    const want = FLY.top * clamp(I.thrust || 0, 0, 1);
    G.v += clamp(want - G.v, -(want < G.v ? FLY.coast : FLY.accel) * dt, FLY.accel * dt);
    G.vy += (I.climb * FLY.climb - G.vy) * e;
    G.kick *= Math.exp(-dt / 0.5);
    const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw), v = G.v - G.kick;
    G.p[0] += fx * v * dt; G.p[1] += G.vy * dt; G.p[2] += fz * v * dt;
    const l = Math.hypot(G.p[0], G.p[1], G.p[2]);
    if (l > CELL.wall) for (let j = 0; j < 3; j++) G.p[j] *= CELL.wall / l;
    // drones in the way: a bump pushes the ship back
    G.calm = Math.max(0, G.calm - dt);
    if (!G.calm) for (let k = 0; k < W.drones.length; k++) {
      dronePos(W, k, G.t, _dp);
      if ((_dp[0] - G.p[0]) ** 2 + (_dp[1] - G.p[1]) ** 2 + (_dp[2] - G.p[2]) ** 2 < DRONE.hit * DRONE.hit) { G.kick = DRONE.back + G.v; G.calm = DRONE.calm; G.bumps++; G.ev.push('bump'); break; }
    }
    // a link followed: close enough to the next partner
    if (G.next >= 0) {
      const P = W.pos, n = G.next;
      if ((P[n * 3] - G.p[0]) ** 2 + (P[n * 3 + 1] - G.p[1]) ** 2 + (P[n * 3 + 2] - G.p[2]) ** 2 < SCAN.touch * SCAN.touch) {
        G.followed++; visit(W, G, n); G.ev.push('follow'); if (G.next < 0) G.ev.push('end');
      }
    }
    // a scan: the protein in the nose's cone (the input's aim, checked here)
    if (I.scan && I.aim >= 0 && I.aim < W.N && I.aim !== G.cur) {
      const P = W.pos, a = I.aim;
      if ((P[a * 3] - G.p[0]) ** 2 + (P[a * 3 + 1] - G.p[1]) ** 2 + (P[a * 3 + 2] - G.p[2]) ** 2 <= (SCAN.reach + 1) ** 2) { visit(W, G, a); G.ev.push('scan'); if (G.next < 0) G.ev.push('end'); }
    }
    return G;
  }
  // what a protein is, in words for the panel: its name, place, its links in this map and to placed proteins, how many of
  // those in other places
  function about(W, i) {
    if (i < 0) return null;
    let other = 0;
    for (let j = W.off[i]; j < W.off[i + 1]; j++) if (W.place[W.nb[j]] !== W.place[i]) other++;
    return { name: W.sym[W.ids[i]], place: W.places[W.place[i]], links: W.deg[W.ids[i]], placed: W.off[i + 1] - W.off[i], other };
  }

  // ---------------------------------------------------------------------------------------------- the data
  const D = { state: '', p: null, W: null, dots: null, err: '' };
  function dataUrl() {
    const m = HOST.packages && HOST.packages.get ? HOST.packages.get(DATA.key) : null, u = HOST.pkgUrl ? HOST.pkgUrl(DATA.key, DATA.file) : 'packages/' + DATA.key + '/' + DATA.file;
    // (src/ is not in the index's files: the package's own fingerprint, which changes when its main.js is built from it)
    return u.includes('?') || !m || !m.fp ? u : u + '?v=' + m.fp;
  }
  const later = () => new Promise(r => setTimeout(r, 0));
  // the data fetched and the world built (once; a failure is tried again on the next prepare)
  function prepare() {
    if (D.p) return D.p;
    D.state = 'loading';
    log('goggles data', { state: 'loading' });
    D.p = fetch(dataUrl()).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(async txt => {
        const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
        if (a < 0 || b < a) throw new Error('not the data file');
        const J = JSON.parse(txt.slice(a, b + 1));
        await later();
        const W = buildWorld(J);
        await later();
        D.dots = dotsOf(W); D.W = W; D.state = 'ready';
        log('goggles data', { state: 'ready', proteins: W.N, links: W.nb.length / 2 });
        return W;
      })
      .catch(e => { D.state = 'failed'; D.err = String(e && e.message || e); D.p = null; log('goggles data', { state: 'failed', e: D.err }); return null; });
    return D.p;
  }

  // ---------------------------------------------------------------------------------------------- the look
  // Nothing large and see-through but the cover (for the frame rate): opaque lit meshes in view space, their fade a
  // screen-door (fragments dropped by a fixed pattern, so they stay opaque and sorted), small additive glows that leave the
  // layer's alpha alone (ships.js's ADD), the cover an inside-out sphere far away drawn first of the see-through things
  const DITHER = 'float dth() { vec2 q = floor(gl_FragCoord.xy); return fract(52.9829189 * fract(dot(q, vec2(0.06711056, 0.00583715)))); }';
  const LIT_V = `
attribute vec3 aCol; attribute float aGlow;
varying vec3 vC; varying vec3 vN; varying float vE;
void main() {
  vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  vC = aCol; vE = aGlow; vN = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`;
  const LIT_F = `
uniform float uFade; varying vec3 vC; varying vec3 vN; varying float vE;
${DITHER}
void main() {
  if (dth() >= uFade) discard;
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float d = max(dot(n, normalize(vec3(0.35, 0.8, 0.5))), 0.0), rim = pow(1.0 - abs(n.z), 2.0) * 0.3;
  gl_FragColor = vec4(mix(vC * (0.3 + 0.8 * d + rim), vC * 1.5 + 0.1, vE), 1.0);
}`;
  // glows: a soft round dot a point, its size in m (seen nearer, bigger), its colour faded with distance and the fade
  const GLOW_V = `
attribute vec3 aColor; attribute float aSize; uniform float uPx; uniform float uNear; uniform float uFar;
varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(0.05, -mv.z);
  vC = aColor * (1.0 - smoothstep(uNear, uFar, length(mv.xyz)));
  gl_PointSize = clamp(aSize * projectionMatrix[1][1] * uPx / d, 1.0, 64.0);
  gl_Position = projectionMatrix * mv;
}`;
  const GLOW_F = `
uniform float uFade; varying vec3 vC;
void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; float a = max(0.0, 1.0 - r); gl_FragColor = vec4(vC * (a * a + 0.6 * smoothstep(0.12, 0.0, r)) * uFade, 1.0); }`;
  const LINE_V = 'attribute vec3 aColor; varying vec3 vC; void main() { vC = aColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const LINE_F = 'uniform float uFade; varying vec3 vC; void main() { gl_FragColor = vec4(vC * uFade, 1.0); }';
  // a canvas on a plane (the dashboard, the name tags): opaque, faded by the screen-door
  const TEX_V = 'varying vec2 vU; void main() { vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const TEX_F = `uniform sampler2D map; uniform float uFade; varying vec2 vU; ${DITHER}
void main() { if (dth() >= uFade) discard; gl_FragColor = vec4(texture2D(map, vU).rgb, 1.0); }`;
  // the cover: the cell's inside, dark blue-green, lighter below; its alpha the fade (in AR the room shows as it goes)
  const COVER_V = 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const COVER_F = 'uniform float uFade; varying vec3 vP; void main() { vec3 c = mix(vec3(0.02, 0.07, 0.09), vec3(0.01, 0.025, 0.05), smoothstep(-0.6, 0.8, vP.y)); gl_FragColor = vec4(c, uFade); }';
  const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
  const U = { fade: { value: 1 }, px: { value: 600 } };
  function part(geo, m, col, glow) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m); g.computeVertexNormals();
    const n = g.attributes.position.count, c = new THREE.Color(col), cs = new Float32Array(n * 3), gl = new Float32Array(n).fill(glow || 0);
    for (let i = 0; i < n; i++) { cs[i * 3] = c.r; cs[i * 3 + 1] = c.g; cs[i * 3 + 2] = c.b; }
    return { p: g.attributes.position.array, n: g.attributes.normal.array, c: cs, e: gl };
  }
  function merge(parts) {
    const cat = k => { const a = new Float32Array(parts.reduce((s, q) => s + q[k].length, 0)); let o = 0; for (const q of parts) { a.set(q[k], o); o += q[k].length; } return a; };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cat('p'), 3)); g.setAttribute('normal', new THREE.BufferAttribute(cat('n'), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(cat('c'), 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(cat('e'), 1));
    g.computeBoundingSphere();
    return g;
  }
  const mat = (p, q, s) => new M4().compose(new V3(...(p || [0, 0, 0])), q || new Q4(), new V3(...(s || [1, 1, 1])));
  // a beam from a to b (a box th thick)
  function beam(a, b, th, col, glow) {
    const A = new V3(...a), B = new V3(...b), l = A.distanceTo(B);
    const q = new Q4().setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
    return part(new THREE.BoxGeometry(th, l, th), mat(A.clone().add(B).multiplyScalar(0.5).toArray(), q), col, glow);
  }
  // the cockpit round the wearer's head (its origin, facing -z): a console below, a canopy's frame (two front pillars, a
  // top bar, a spine over the head, side rails) with glowing strips; a simple frame that stays still while the cell moves
  function cockpitGeo() {
    const P = [], F = '#3b4a5e', S = '#5fd4ff';
    P.push(part(new THREE.BoxGeometry(0.95, 0.1, 0.36), mat([0, -0.47, -0.62], new Q4().setFromAxisAngle(new V3(1, 0, 0), 0.25)), '#273241', 0));
    P.push(part(new THREE.BoxGeometry(0.95, 0.012, 0.012), mat([0, -0.41, -0.8]), S, 1));
    for (const sx of [1, -1]) {
      P.push(beam([0.48 * sx, -0.44, -0.78], [0.3 * sx, 0.34, -0.88], 0.045, F, 0));
      P.push(beam([0.48 * sx, -0.44, -0.78], [0.58 * sx, -0.42, 0.35], 0.045, F, 0));
      P.push(beam([0.3 * sx, 0.34, -0.88], [0.24 * sx, 0.5, 0.1], 0.03, F, 0));
      P.push(beam([0.455 * sx, -0.4, -0.76], [0.285 * sx, 0.32, -0.855], 0.008, S, 1));
      P.push(part(new THREE.BoxGeometry(0.06, 0.3, 0.9), mat([0.64 * sx, -0.58, -0.2]), '#222b38', 0));
    }
    P.push(beam([-0.3, 0.34, -0.88], [0.3, 0.34, -0.88], 0.045, F, 0));
    P.push(beam([0, 0.36, -0.88], [0, 0.52, 0.1], 0.035, F, 0));
    return merge(P);
  }
  // a drone: a dark angular core, four swept blades round it and a red eye (our own design; about 0.9 m across)
  function droneGeo() {
    const P = [];
    P.push(part(new THREE.IcosahedronGeometry(0.3, 0), mat(null, null, [1, 0.75, 1]), '#2b2238', 0));
    for (let k = 0; k < 4; k++) {
      const q = new Q4().setFromAxisAngle(new V3(0, 1, 0), k * Math.PI / 2 + Math.PI / 4);
      P.push(part(new THREE.BoxGeometry(0.42, 0.04, 0.14), mat(new V3(0.38, 0, 0).applyQuaternion(q).toArray(), q.clone().multiply(new Q4().setFromAxisAngle(new V3(0, 0, 1), 0.25))), '#43305e', 0));
      P.push(part(new THREE.BoxGeometry(0.06, 0.05, 0.05), mat(new V3(0.6, 0, 0).applyQuaternion(q).toArray(), q), '#ff3b3b', 1));
    }
    P.push(part(new THREE.SphereGeometry(0.09, 8, 6), mat([0, 0.02, -0.26]), '#ff3030', 1));
    return merge(P);
  }
  function glowPoints(n, near, far) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial(Object.assign({ vertexShader: GLOW_V, fragmentShader: GLOW_F, transparent: true, depthWrite: false,
      uniforms: { uPx: U.px, uFade: U.fade, uNear: { value: near }, uFar: { value: far } } }, ADD));
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 3;
    return p;
  }
  function canvasPlane(w, h, cw, ch) {
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const tex = new THREE.CanvasTexture(cv);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({ vertexShader: TEX_V, fragmentShader: TEX_F, uniforms: { map: { value: tex }, uFade: U.fade } }));
    m.frustumCulled = false;
    return { mesh: m, cv, tex, sig: '' };
  }
  const MAXM = 64, MAXDR = 24;
  // the view: made once (with HOST.quiet set: nothing of it is a story's)
  const V = { made: false, root: null, world: null, cover: null, cockpit: null, dash: null, tags: [], arrow: null, prot: null, marks: null, links: null, guide: null, drones: null, built: null, linksFor: -2 };
  function make() {
    if (V.made) return;
    const q = HOST.quiet;
    HOST.quiet = true;
    try {
      V.root = new THREE.Group(); V.root.name = 'flight'; V.root.matrixAutoUpdate = false;
      V.world = new THREE.Group(); V.world.matrixAutoUpdate = false;
      V.cover = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.ShaderMaterial({ vertexShader: COVER_V, fragmentShader: COVER_F, uniforms: { uFade: U.fade }, side: THREE.BackSide, transparent: true, depthWrite: false }));
      V.cover.renderOrder = -1e8; V.cover.frustumCulled = false;
      const lit = new THREE.ShaderMaterial({ vertexShader: LIT_V, fragmentShader: LIT_F, uniforms: { uFade: U.fade }, side: THREE.DoubleSide });
      V.cockpit = new THREE.Mesh(cockpitGeo(), lit); V.cockpit.frustumCulled = false;
      V.dash = canvasPlane(0.46, 0.18, 768, 300);
      V.dash.mesh.position.set(0, -0.37, -0.54); V.dash.mesh.rotation.x = -0.55;
      V.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 8, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6dff9e }));
      V.arrow.position.set(0, -0.24, -0.62); V.arrow.visible = false;
      // the reticle: four short glowing ticks 4 m ahead at eye level, fixed to the ship
      const rg = new THREE.BufferGeometry(), RT = [];
      for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) RT.push(x * 0.07, y * 0.07, -4, x * 0.16, y * 0.16, -4);
      rg.setAttribute('position', new THREE.Float32BufferAttribute(RT, 3)); rg.setAttribute('aColor', new THREE.Float32BufferAttribute(RT.map((v, i) => [0.5, 0.9, 1][i % 3]), 3));
      const lineMat = () => new THREE.ShaderMaterial(Object.assign({ vertexShader: LINE_V, fragmentShader: LINE_F, uniforms: { uFade: U.fade }, transparent: true, depthWrite: false }, ADD));
      V.reticle = new THREE.LineSegments(rg, lineMat()); V.reticle.frustumCulled = false; V.reticle.renderOrder = 4;
      V.marks = glowPoints(MAXM, 1e3, 2e3);
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEE.links * 6), 3));
      lg.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(SEE.links * 6), 3));
      lg.setDrawRange(0, 0);
      V.links = new THREE.LineSegments(lg, lineMat()); V.links.frustumCulled = false; V.links.renderOrder = 2;
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
      gg.setAttribute('aColor', new THREE.Float32BufferAttribute([0.15, 0.6, 0.3, 0.45, 1, 0.62], 3));
      V.guide = new THREE.LineSegments(gg, lineMat()); V.guide.frustumCulled = false; V.guide.renderOrder = 2; V.guide.visible = false;
      V.drones = new THREE.InstancedMesh(droneGeo(), lit, MAXDR); V.drones.instanceMatrix.setUsage(THREE.DynamicDrawUsage); V.drones.frustumCulled = false; V.drones.count = 0;
      for (let k = 0; k < 2; k++) { const T = canvasPlane(1, 0.25, 512, 128); T.i = -1; T.mesh.visible = false; T.mesh.renderOrder = 5; V.tags.push(T); }
      V.world.add(V.marks, V.links, V.guide, V.drones, ...V.tags.map(T => T.mesh));
      V.root.add(V.cover, V.cockpit, V.dash.mesh, V.arrow, V.reticle, V.world);
      V.made = true;
    } finally { HOST.quiet = q; }
  }
  // the proteins and the membranes' dots: one Points draw, built once the world is ready
  function buildProteins(W) {
    if (V.prot) return;
    const dots = D.dots, nd = dots.length / 4, n = W.N + nd, P = new Float32Array(n * 3), C = new Float32Array(n * 3), S = new Float32Array(n), c = new THREE.Color();
    P.set(W.pos);
    for (let i = 0; i < W.N; i++) { c.set(COL[W.place[i]]); C[i * 3] = c.r * 0.9; C[i * 3 + 1] = c.g * 0.9; C[i * 3 + 2] = c.b * 0.9; S[i] = SEE.size; }
    for (let k = 0; k < nd; k++) {
      const i = W.N + k;
      P[i * 3] = dots[k * 4]; P[i * 3 + 1] = dots[k * 4 + 1]; P[i * 3 + 2] = dots[k * 4 + 2];
      c.set(COL[dots[k * 4 + 3]]); C[i * 3] = c.r * 0.28; C[i * 3 + 1] = c.g * 0.28; C[i * 3 + 2] = c.b * 0.28; S[i] = 0.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(C, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(S, 1));
    const q = HOST.quiet;
    HOST.quiet = true;
    try {
      const m = new THREE.ShaderMaterial(Object.assign({ vertexShader: GLOW_V, fragmentShader: GLOW_F, transparent: true, depthWrite: false,
        uniforms: { uPx: U.px, uFade: U.fade, uNear: { value: SEE.near }, uFar: { value: SEE.far } } }, ADD));
      V.prot = new THREE.Points(g, m); V.prot.frustumCulled = false; V.prot.renderOrder = 1;
      V.world.add(V.prot);
    } finally { HOST.quiet = q; }
  }

  // ---------------------------------------------------------------------------------------------- wearing
  // S: worn here (on), by which page (owner) and its goggles (id), the anchor where they went on (in the renderer's space:
  // the head's place and its level turn), the fade and pause of the bubble, the game (G) and this frame's input (I)
  const S = { on: false, want: '', owner: '', id: '', page: false, a: new V3(), ayaw: 0, aq: new Q4(), fade: 0, away: 0, paused: false, G: null, I: { turn: 0, climb: 0, thrust: 0, scan: false, aim: -1 },
    trigWas: true, grips: new Map(), t: 0, sess: null, aimed: -1, saidPause: 0, poseAt: 0, ref: null };
  const HEAD = { ok: false, p: new V3(), q: new Q4() };
  const CTRL = { ok: false, p: new V3(), sx: 0, sy: 0, grip: 0, trig: false, left: false, lx: 0, ly: 0, lgrip: 0 };
  const immersive = () => !!HOST.session && (HOST.mode === 'immersive-vr' || HOST.mode === 'immersive-ar');
  function handSrc(h) {
    let list = null;
    try { list = HOST.session ? HOST.session.inputSources : null; } catch (e) { /* gone */ }
    if (!list) return null;
    for (let i = 0; i < list.length; i++) { const x = list[i]; if (x && x.handedness === h && !x.hand && x.gamepad && x.targetRayMode === 'tracked-pointer') return x; }
    return null;
  }
  const rightSrc = () => handSrc('right');
  // why they cannot go on here ('' they can)
  function whyNot() {
    if (!immersive()) return 'Only in a headset (VR or AR).';
    const l = link();
    if (l && l.camera && l.camera()) return 'Not in camera mode.';
    if (l && l.phone && l.phone()) return 'Not on a phone: they need a headset\'s controllers.';
    if (!rightSrc()) return 'They need a controller in your right hand: the right stick steers.';
    return '';
  }
  const SAY_ON = 'Squeeze a grip to fly (both grips: full speed; let go to coast to a stop). Either stick: turn, climb and dive. Right trigger: scan the protein in your sights. To take them off, grip near your face and pull away.';
  // put on (at the next frame, where the head is known): o = { owner, id }; false with a notice when they cannot go on
  function wear(o) {
    o = o || {};
    if (S.on) return true;
    const w = o.page ? '' : whyNot();
    if (w) { log('goggles refused', { why: w }); say('VR goggles', w, 4500); return false; }
    S.owner = String(o.owner || ''); S.id = String(o.id || ''); S.page = !!o.page; S.want = 'on';
    prepare();
    return true;
  }
  function begin() {
    S.on = true; S.want = '';
    S.a.copy(HEAD.p); const e = new THREE.Euler().setFromQuaternion(HEAD.q, 'YXZ');
    S.ayaw = e.y; S.aq.setFromAxisAngle(new V3(0, 1, 0), S.ayaw);
    S.fade = 1; S.away = 0; S.paused = false; S.trigWas = true; S.grips.clear(); S.aimed = -1; S.saidPause = 0; S.poseAt = S.t;
    refWatch(true);
    // a grip held now (the hand that brought them) must be let go before it can take them off
    let list = [];
    try { list = HOST.session ? HOST.session.inputSources : []; } catch (e) { /* gone */ }
    for (let i = 0; i < (list || []).length; i++) { const x = list[i]; if (x && x.gamepad) S.grips.set(x, { arm: false, fresh: true }); }
    if (!S.G && D.W) S.G = newGame(D.W);
    if (HOST.ships && HOST.ships.flying && HOST.ships.flying() && HOST.ships.launch) HOST.ships.launch(false);   // (the spaceship lands)
    log('goggles on', { owner: S.owner, id: S.id, page: S.page });
    play('enter');
    if (!S.page) say('VR goggles', SAY_ON, 7000);
    changed();
  }
  // taken off (the gesture, the menu's row, the session's end, the page that owns them gone): the room back as it was
  function off(why, quiet) {
    if (!S.on && !S.want) return false;
    const was = S.on;
    S.on = false; S.want = ''; S.fade = 0;
    refWatch(false);
    if (V.made) V.root.visible = false;
    if (was) { log('goggles off', { why: why || '' }); if (!quiet) { play('close'); say('VR goggles off', 'The room is back. The goggles are where they were.', 3000); } }
    changed();
    return true;
  }
  // the reference space's reset (a recentre) while they are on: off (listener added with HOST.quiet set, so a story change
  // keeps it; removed as they come off)
  function onReset() { if (S.on && !S.page) recentred('reset'); }
  function refWatch(on) {
    if (S.ref) { try { S.ref.removeEventListener('reset', onReset); } catch (e) { /* gone */ } S.ref = null; }
    if (!on || S.page) return;
    let r = null;
    try { r = HOST.renderer ? HOST.renderer.xr.getReferenceSpace() : null; } catch (e) { r = null; }
    if (!r || typeof r.addEventListener !== 'function') return;
    const q = HOST.quiet;
    HOST.quiet = true;
    try { r.addEventListener('reset', onReset); S.ref = r; } catch (e) { /* none */ } finally { HOST.quiet = q; }
  }
  // the origin moved (the reference space's reset, the shell's originMoved and floorReset in shared.js): the seat is lost
  function recentred(why) {
    if (!S.on || S.page) return false;
    off('recentre', true);
    play('close');
    say('VR goggles off', 'The headset moved its origin (a recentre?), so your seat was lost. Put them on again.', 4000);
    log('goggles recentre', { why: why || '' });
    return true;
  }
  function play(name, at) {
    if (!HOST.sfx || !HOST.sfx.play || !immersive() || S.page) return;
    try { HOST.sfx.play(name, at ? { at } : {}); } catch (e) { /* no sound */ }
  }

  // ---------------------------------------------------------------------------------------------- each frame
  const _v = new V3(), _v2 = new V3(), _q = new Q4(), _q2 = new Q4(), _m = new M4(), _m2 = new M4(), _c = new THREE.Color(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
  const _d3b = [0, 0, -1], _dr = new Float64Array(3);
  const DBG = { in: null, head: new V3(), shift: false, lost: false };
  const shape = a => { a = Number.isFinite(a) ? clamp(a, -1, 1) : 0; const m = Math.abs(a); return m > STICK.dz ? Math.sign(a) * Math.pow((m - STICK.dz) / (1 - STICK.dz), STICK.expo) : 0; };
  function sense(f, ref) {
    HEAD.ok = false; CTRL.ok = false; CTRL.sx = CTRL.sy = CTRL.grip = 0; CTRL.trig = false; CTRL.left = false; CTRL.lx = CTRL.ly = CTRL.lgrip = 0;
    let vp = null;
    try { vp = f.getViewerPose(ref); } catch (e) { /* not this frame */ }
    if (vp && !DBG.lost) { const p = vp.transform.position, o = vp.transform.orientation; HEAD.p.set(p.x, p.y, p.z); HEAD.q.set(o.x, o.y, o.z, o.w); HEAD.ok = true; S.poseAt = S.t; }
    if (DBG.shift) HEAD.p.add(DBG.head);
    const src = rightSrc();
    if (src) {
      const gp = src.gamepad, b = gp.buttons || [], a = gp.axes || [], i = a.length >= 4 ? 2 : 0;
      CTRL.sx = +a[i] || 0; CTRL.sy = +a[i + 1] || 0;
      const gs = S.grips.get(src);
      CTRL.grip = gs && gs.fresh ? 0 : b[1] ? +b[1].value || (b[1].pressed ? 1 : 0) : 0;   // (the grip that carried them to the face is a throttle only once let go)
      CTRL.trig = !!(b[0] && (b[0].pressed || b[0].value > 0.5));
      CTRL.ok = true;
    }
    // (v203) the left controller: its stick steers too, its grip is the other throttle
    const ls = handSrc('left');
    if (ls) {
      const gp = ls.gamepad, b = gp.buttons || [], a = gp.axes || [], i = a.length >= 4 ? 2 : 0;
      CTRL.lx = +a[i] || 0; CTRL.ly = +a[i + 1] || 0;
      const gs = S.grips.get(ls);
      CTRL.lgrip = gs && gs.fresh ? 0 : b[1] ? +b[1].value || (b[1].pressed ? 1 : 0) : 0;
      CTRL.left = true;
    }
    // the take-off gesture: either controller's grip pressed near the face, pulled away with it held
    if (!S.on || !HEAD.ok) return;
    let list = [];
    try { list = HOST.session.inputSources || []; } catch (e) { /* gone */ }
    for (let k = 0; k < list.length; k++) {
      const x = list[k], gp = x && !x.hand && x.gamepad;
      if (!gp) continue;
      const down = !!(gp.buttons && gp.buttons[1] && gp.buttons[1].pressed);
      let st = S.grips.get(x);
      if (!st) S.grips.set(x, st = { arm: false, fresh: false });
      if (!down) { st.arm = false; st.fresh = false; continue; }
      if (st.fresh) continue;
      let pose = null;
      try { pose = f.getPose(x.gripSpace || x.targetRaySpace, ref); } catch (e) { /* not tracked */ }
      if (!pose) continue;
      const p = pose.transform.position, d = Math.hypot(p.x - HEAD.p.x, p.y - HEAD.p.y, p.z - HEAD.p.z);
      if (!st.arm) { if (d <= WEAR.on) st.arm = true; else st.fresh = true; continue; }   // (a grip pressed away from the face is a throttle, not the gesture)
      if (d > WEAR.off) { off('gesture'); return; }
    }
  }
  // this frame's input from the two controllers (or a test's: { x, y, grip, trig, lx, ly, lgrip, one }), and where the nose
  // points: the sticks added (each shaped, the sum clamped), the grips' sum the thrust (with one controller, its grip alone)
  const thrustOf = (r, l, two) => clamp(two ? (clamp(r, 0, 1) + clamp(l, 0, 1)) / 2 : clamp(r, 0, 1) + clamp(l, 0, 1), 0, 1);
  function inputOf() {
    const I = S.I, T = DBG.in;
    if (T) { I.turn = clamp(shape(T.x || 0) + shape(T.lx || 0), -1, 1); I.climb = clamp(shape(T.y || 0) + shape(T.ly || 0), -1, 1); I.thrust = thrustOf(T.grip || 0, T.lgrip || 0, !T.one); I.scan = !!T.trig && !S.trigWas; S.trigWas = !!T.trig; }
    else { I.turn = clamp(shape(CTRL.sx) + shape(CTRL.lx), -1, 1); I.climb = clamp(shape(CTRL.sy) + shape(CTRL.ly), -1, 1); I.thrust = thrustOf(CTRL.grip, CTRL.lgrip, CTRL.ok && CTRL.left); I.scan = CTRL.trig && !S.trigWas; S.trigWas = CTRL.trig; }
    const G = S.G;
    _d3b[0] = -Math.sin(G.yaw); _d3b[1] = 0; _d3b[2] = -Math.cos(G.yaw);
    I.aim = aimAt(D.W, G.p, _d3b);
    return I;
  }
  // the bubble: how far the head is along the floor from where they went on; the fade and the pause from it
  function bubble() {
    if (!HEAD.ok) { if (S.t - S.poseAt < BUBBLE.lost) return; S.away = Infinity; }   // (tracking lost: outside the bubble)
    else S.away = Math.hypot(HEAD.p.x - S.a.x, HEAD.p.z - S.a.z);
    if (!Number.isFinite(S.away)) S.away = Infinity;   // (not a number: far away)
    S.fade = S.away === Infinity ? 0 : 1 - smooth(BUBBLE.fade0, BUBBLE.fade1, S.away);
    const p = S.away > BUBBLE.pause;
    if (p !== S.paused) {
      S.paused = p;
      log('goggles bubble', { paused: p, away: Number.isFinite(S.away) ? Math.round(S.away * 100) / 100 : -1 });
      if (p && S.t - S.saidPause > 8000 && !S.page) { S.saidPause = S.t; say('VR goggles: paused', HEAD.ok ? 'You moved away from your seat. Step back to carry on.' : 'The headset lost track of where you are. It carries on once it knows again.', 3500); }
    }
  }
  // the story's scene (built), where the view hangs
  function storyScene() { const c = HOST.cur && HOST.cur.collab; try { return c && c.scene ? c.scene() : null; } catch (e) { return null; } }
  function detach() { if (S.on || S.want) off('story', true); if (V.root && V.root.parent) V.root.parent.remove(V.root); }
  function run(dt) {
    if (S.want === 'on' && HEAD.ok) begin();
    if (!S.on) { if (V.made && V.root.visible) V.root.visible = false; return; }
    bubble();
    if (D.W && !S.G) S.G = newGame(D.W);
    if (D.W && S.G && !S.paused) {
      step(D.W, S.G, inputOf(), dt);
      for (let k = 0; k < S.G.ev.length; k++) {
        const ev = S.G.ev[k];
        log('goggles ' + ev, { cur: S.G.cur >= 0 ? D.W.sym[D.W.ids[S.G.cur]] : '', score: [S.G.scanned, S.G.followed, S.G.bumps] });
        play(ev === 'scan' ? 'ping' : ev === 'follow' ? 'link' : ev === 'bump' ? 'bump' : 'notice', HEAD.ok ? [HEAD.p.x, HEAD.p.y, HEAD.p.z] : null);
      }
    } else if (D.W && S.G) S.trigWas = DBG.in ? !!DBG.in.trig : CTRL.trig;   // (paused: a press now does not scan when it resumes)
    draw();
  }
  // a frame of a headset session (index.html's hook, before any callback draws it; the poses three.js's)
  function frame(s, t, f) {
    if (!f || typeof f !== 'object' || s !== HOST.session) return;
    if (!S.on && !S.want) { if (V.made && V.root.visible) V.root.visible = false; return; }
    if (S.page) return;
    let ref = null;
    try { ref = HOST.renderer ? HOST.renderer.xr.getReferenceSpace() : null; } catch (e) { ref = null; }
    if (!ref) return;
    const dt = S.t && t > S.t ? Math.min(0.1, (t - S.t) / 1000) : 0;
    S.t = t;
    sense(f, ref);
    run(dt);
  }
  // a page's preview (tests, and a page that owns goggles without a headset): the camera as the head, no controllers
  function pageFrame(cam, dt) {
    if (!S.page || (!S.on && !S.want) || !cam) return;
    cam.updateMatrixWorld();
    cam.matrixWorld.decompose(HEAD.p, HEAD.q, _v);
    // (the page's camera is where they are worn: the anchor follows it, so only a test's shift of the head leaves the seat)
    if (S.on) { S.a.copy(HEAD.p); _e.setFromQuaternion(HEAD.q, 'YXZ'); S.ayaw = _e.y; S.aq.setFromAxisAngle(_v.set(0, 1, 0), S.ayaw); }
    if (DBG.shift) HEAD.p.add(DBG.head);
    S.t += (dt || 0) * 1000;
    HEAD.ok = !DBG.lost || !S.on;   // (a test's lost pose)
    if (HEAD.ok) S.poseAt = S.t;
    run(dt || 0);
  }
  // a name tag over a protein, turned to the head
  // (redrawn only when its protein changes: next, the next partner's tag)
  function tagDraw(T, i, next) {
    if (T.i !== i) {
      T.i = i;
      const c = T.cv.getContext('2d'), W = D.W, col = next ? '#6dff9e' : COL[W.place[i]], line2 = (next ? 'Next · ' : '') + W.places[W.place[i]];
      c.fillStyle = '#081018'; c.fillRect(0, 0, 512, 128);
      c.fillStyle = col; c.fillRect(0, 0, 10, 128);
      c.textBaseline = 'middle'; c.fillStyle = '#eef6ff'; c.font = '700 56px B612, system-ui, sans-serif'; c.fillText(W.sym[W.ids[i]], 28, 46);
      c.fillStyle = '#9fb3c8'; c.font = '600 30px B612, system-ui, sans-serif'; c.fillText(line2, 28, 100);
      T.tex.needsUpdate = true;
    }
  }
  function placeTag(T, i, up) {
    const P = D.W.pos, x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const d = Math.hypot(x - S.G.p[0], y - S.G.p[1], z - S.G.p[2]), s = clamp(d * 0.075, 0.25, 2.4);
    T.mesh.position.set(x, y + 0.35 + s * 0.2 * up, z); T.mesh.scale.setScalar(s);
    // (the world group's turn is the ship's yaw and the anchor's: the tag's own turn is the head's in the world's frame)
    T.mesh.quaternion.copy(_q2).multiply(HEAD.q);
    T.mesh.visible = true;
  }
  // a marker (a glow) at x, y, z in one of the colours made once (MC), its size and brightness; MK.n counts this frame's
  const MC = { aim: new THREE.Color('#ffffff'), cur: new THREE.Color('#ffc861'), next: new THREE.Color('#6dff9e'), eye: new THREE.Color('#ff3030') };
  const MK = { n: 0, P: null, C: null, S: null }, MKEYS = ['position', 'aColor', 'aSize'];
  function mark(x, y, z, col, sz, k) {
    const n = MK.n;
    if (n >= MAXM) return;
    MK.P[n * 3] = x; MK.P[n * 3 + 1] = y; MK.P[n * 3 + 2] = z;
    MK.C[n * 3] = col.r * k; MK.C[n * 3 + 1] = col.g * k; MK.C[n * 3 + 2] = col.b * k; MK.S[n] = sz; MK.n = n + 1;
  }
  function draw() {
    const sc = storyScene();
    if (!sc) return;
    make();
    if (V.root.parent !== sc) sc.add(V.root);
    U.fade.value = S.fade;
    V.root.visible = S.fade > 0.002;
    if (!V.root.visible) return;
    try { const bl = HOST.session && HOST.session.renderState && HOST.session.renderState.baseLayer; U.px.value = (bl && bl.framebufferHeight ? bl.framebufferHeight : HOST.renderer.domElement.height) * 0.5; } catch (e) { /* keep */ }
    V.root.matrix.compose(S.a, S.aq, _v.set(1, 1, 1)); V.root.matrixWorldNeedsUpdate = true;
    const W = D.W, G = S.G;
    if (!W || !G) { V.world.visible = false; V.arrow.visible = false; dashDraw(); return; }
    buildProteins(W);
    V.world.visible = true;
    // the world round the ship: rotY(-yaw) translate(-p), the ship's eye at the anchor
    _m.makeRotationY(-G.yaw); _m2.makeTranslation(-G.p[0], -G.p[1], -G.p[2]); V.world.matrix.multiplyMatrices(_m, _m2); V.world.matrixWorldNeedsUpdate = true;
    // (the inverse of the world's turn in the renderer's space, for things turned to the head)
    _q2.setFromAxisAngle(_v.set(0, 1, 0), G.yaw - S.ayaw);
    // the markers: the protein in the sights, the one scanned, the next partner (pulsing), the drones' eyes
    const pa = V.marks.geometry.attributes, P = W.pos;
    MK.n = 0; MK.P = pa.position.array; MK.C = pa.aColor.array; MK.S = pa.aSize.array;
    const ai = S.I.aim, pulse = 0.75 + 0.25 * Math.sin(S.t / 180);
    if (ai >= 0 && ai !== G.cur) mark(P[ai * 3], P[ai * 3 + 1], P[ai * 3 + 2], MC.aim, 1.0, 0.7);
    if (G.cur >= 0) mark(P[G.cur * 3], P[G.cur * 3 + 1], P[G.cur * 3 + 2], MC.cur, 0.9, 1);
    if (G.next >= 0) mark(P[G.next * 3], P[G.next * 3 + 1], P[G.next * 3 + 2], MC.next, 1.6 * pulse, 1);
    // the drones near the ship: instanced, facing where they swing
    let nd = 0;
    for (let k = 0; k < W.drones.length && nd < MAXDR; k++) {
      dronePos(W, k, G.t, _dr);
      if ((_dr[0] - G.p[0]) ** 2 + (_dr[1] - G.p[1]) ** 2 + (_dr[2] - G.p[2]) ** 2 > DRONE.near * DRONE.near) continue;
      const d = W.drones[k], vx = DRONE.amp * d.w[0] * Math.cos(d.w[0] * G.t + d.ph[0]), vz = DRONE.amp * d.w[2] * Math.cos(d.w[2] * G.t + d.ph[2]);
      _q.setFromAxisAngle(_v.set(0, 1, 0), Math.atan2(-vx, -vz));
      _m.compose(_v2.set(_dr[0], _dr[1], _dr[2]), _q, _v.set(1, 1, 1)); V.drones.setMatrixAt(nd++, _m);
      _v.set(0, 0.02, -0.3).applyQuaternion(_q); mark(_dr[0] + _v.x, _dr[1] + _v.y, _dr[2] + _v.z, MC.eye, 0.45, 1);
    }
    V.drones.count = nd;
    if (nd) { const a = V.drones.instanceMatrix; a.updateRange.offset = 0; a.updateRange.count = nd * 16; a.needsUpdate = true; }
    const nm = MK.n;
    V.marks.geometry.setDrawRange(0, nm);
    if (nm) for (let j = 0; j < MKEYS.length; j++) { const a = pa[MKEYS[j]]; a.updateRange.offset = 0; a.updateRange.count = nm * a.itemSize; a.needsUpdate = true; }
    // the scanned protein's links (made again only when it changes), coloured by where the partner is
    if (V.linksFor !== G.cur) {
      V.linksFor = G.cur;
      const la = V.links.geometry.attributes, LP = la.position.array, LC = la.aColor.array;
      let n = 0;
      if (G.cur >= 0) {
        const i = G.cur;
        for (let j = W.off[i]; j < W.off[i + 1] && n < SEE.links; j++, n++) {
          const b = W.nb[j];
          LP[n * 6] = P[i * 3]; LP[n * 6 + 1] = P[i * 3 + 1]; LP[n * 6 + 2] = P[i * 3 + 2]; LP[n * 6 + 3] = P[b * 3]; LP[n * 6 + 4] = P[b * 3 + 1]; LP[n * 6 + 5] = P[b * 3 + 2];
          _c.set(COL[W.place[b]]).multiplyScalar(0.35); LC[n * 6] = 0.35; LC[n * 6 + 1] = 0.3; LC[n * 6 + 2] = 0.2; LC[n * 6 + 3] = _c.r; LC[n * 6 + 4] = _c.g; LC[n * 6 + 5] = _c.b;
        }
      }
      V.links.geometry.setDrawRange(0, n * 2);
      la.position.needsUpdate = la.aColor.needsUpdate = true;
    }
    // the guide: a line from just ahead of the ship to the next partner, and the console's arrow pointing to it
    V.guide.visible = V.arrow.visible = G.next >= 0;
    if (G.next >= 0) {
      const n = G.next, ga = V.guide.geometry.attributes.position, A = ga.array;
      A[0] = G.p[0] - Math.sin(G.yaw) * 1.2; A[1] = G.p[1] - 0.5; A[2] = G.p[2] - Math.cos(G.yaw) * 1.2; A[3] = P[n * 3]; A[4] = P[n * 3 + 1]; A[5] = P[n * 3 + 2];
      ga.needsUpdate = true;
      _v.set(P[n * 3] - G.p[0], P[n * 3 + 1] - G.p[1], P[n * 3 + 2] - G.p[2]).applyAxisAngle(_v2.set(0, 1, 0), -G.yaw);
      if (_v.lengthSq() > 1e-6) V.arrow.quaternion.setFromUnitVectors(_v2.set(0, 0, -1), _v.normalize());
    }
    // the tags: the scanned protein and the next partner
    const T0 = V.tags[0], T1 = V.tags[1];
    T0.mesh.visible = T1.mesh.visible = false;
    if (G.cur >= 0) { tagDraw(T0, G.cur, false); placeTag(T0, G.cur, 0); }
    if (G.next >= 0) { tagDraw(T1, G.next, true); placeTag(T1, G.next, 1); }
    dashDraw();
  }
  // the console's screen: the score, the protein scanned, the next partner (redrawn only when what it says changes)
  // (v198: what it says changes only with these numbers, compared one by one; the words made only then: nothing a frame)
  const DS = { st: '', sc: -1, fo: -1, bu: -1, pa: false, cur: -2, next: -2, dn: -1 };
  function dashDraw() {
    const W = D.W, G = S.G, T = V.dash, ok = !!(W && G);
    const dn = ok && G.next >= 0 ? Math.round(Math.hypot(W.pos[G.next * 3] - G.p[0], W.pos[G.next * 3 + 1] - G.p[1], W.pos[G.next * 3 + 2] - G.p[2])) : -1;
    const st = ok ? 'ok' : D.state;
    if (DS.st === st && (!ok || (DS.sc === G.scanned && DS.fo === G.followed && DS.bu === G.bumps && DS.pa === S.paused && DS.cur === G.cur && DS.next === G.next && DS.dn === dn))) return;
    DS.st = st; DS.dn = dn; DS.pa = S.paused;
    if (ok) { DS.sc = G.scanned; DS.fo = G.followed; DS.bu = G.bumps; DS.cur = G.cur; DS.next = G.next; }
    let lines;
    if (!ok) lines = ['VR goggles', D.state === 'failed' ? 'The cell did not load.' : 'Loading the cell…', D.state === 'failed' ? 'Take the goggles off and on to try again.' : 'Proteins and their places, from Back into the cell.', ''];
    else {
      const a = about(W, G.cur), nx = G.next >= 0 ? about(W, G.next) : null;
      lines = [
        'Scanned ' + G.scanned + '   Links followed ' + G.followed + '   Drones hit ' + G.bumps + (S.paused ? '   PAUSED' : ''),
        a ? a.name + ' · ' + a.place : 'Point the nose at a protein and pull the trigger to scan it.',
        a ? nOf(a.links, 'link') + ' in this map · ' + a.placed + ' to proteins with a place · ' + a.other + ' of them elsewhere in the cell' : 'Grips: throttle (both: full speed). Sticks: turn, climb, dive.',
        nx ? 'Next: ' + nx.name + ' in ' + nx.place + ', ' + dn + ' m. Fly to the green light.' : a ? 'No partner left to visit from here: scan another protein.' : W.N.toLocaleString('en-GB') + ' proteins with a place in this map. Fly into the cell.',
      ];
    }
    T.sig = lines.join('|');
    const c = T.cv.getContext('2d');
    c.fillStyle = '#071019'; c.fillRect(0, 0, 768, 300);
    c.fillStyle = '#5fd4ff'; c.fillRect(0, 0, 768, 6);
    c.textBaseline = 'middle';
    const fit = (s, px, wt, col, y) => { let f = px; c.font = wt + ' ' + f + 'px B612, system-ui, sans-serif'; while (c.measureText(s).width > 736 && f > 16) { f -= 2; c.font = wt + ' ' + f + 'px B612, system-ui, sans-serif'; } c.fillStyle = col; c.fillText(s, 16, y); };
    fit(lines[0], 34, '700', '#ffd27a', 46); fit(lines[1], 42, '700', '#eef4fb', 112); fit(lines[2], 28, '600', '#b8c8da', 174); fit(lines[3], 30, '600', '#8ff0b4', 248);
    T.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------------------------- the shell's side
  // the right controller while they are on belongs to the game (HOST.inputsGuard stops its presses; the spaceship's claim
  // kept beside it, as the guard holds one test); v203: the left controller's grip too (a throttle: it grabs nothing, moves
  // no panel, circle or menu), its trigger left to the menu
  const claims = x => !!(S.on && x && x.handedness === 'right' && !x.hand && x.gamepad);
  const claimsGrip = x => !!(S.on && x && !x.hand && x.gamepad);
  if (HOST.inputsGuard && HOST.inputsGuard.claim) HOST.inputsGuard.claim((x, kind) => claims(x) || (kind === 'squeeze' && claimsGrip(x)) || !!(HOST.ships && HOST.ships.claims && HOST.ships.claims(x)));
  // a session that ends takes them off
  function watch(s) {
    if (s === S.sess) return;
    if (S.on || S.want) { if (!S.page) off('session', true); }
    S.sess = s || null; S.t = 0;
  }
  if (HOST.xr && HOST.xr.watch) { const w0 = HOST.xr.watch; HOST.xr.watch = function (v) { try { watch(v); } catch (e) { /* never in the way */ } return w0.apply(this, arguments); }; }
  watch(HOST.session);

  return {
    WEAR, BUBBLE, FLY, CELL, SCAN, DRONE, SEE, STICK, DATA,
    // the world and the rules, apart from the view (stage 2: another view and the room's sharing build on these)
    world: () => D.W, rules: { newGame, step, aimAt, nextOf, dronePos, about, buildWorld },
    prepare, wear, off, whyNot, claims, detach, recentred,
    on: () => S.on || S.want === 'on', owner: () => S.owner, id: () => S.id, page: () => S.page,
    // drawn over the room now (the owner hides its scene and asks the shell for no real-world occlusion while it is)
    shown: () => S.on && S.fade > 0.002, fade: () => (S.on ? S.fade : 0), paused: () => S.paused,
    frame(s, t, f) { try { frame(s, t, f); } catch (e) { console.warn('VR goggles:', e); } },
    pageFrame(cam, dt) { try { pageFrame(cam, dt); } catch (e) { console.warn('VR goggles:', e); } },
    // (v203) the game as the shuttle's screen shows it to everyone here: its counts, the protein scanned last and its place,
    // the next partner and how far (m); null while off or loading (e6z_goggles.js sends it as an effect)
    status() {
      const W = D.W, G = S.G;
      if (!S.on || !W || !G) return null;
      const a = about(W, G.cur), nx = G.next >= 0 ? about(W, G.next) : null;
      return { paused: S.paused, scanned: G.scanned, followed: G.followed, bumps: G.bumps, cur: a ? a.name : '', place: a ? a.place : '', next: nx ? nx.name : '',
        nextPlace: nx ? nx.place : '', dist: nx ? Math.round(Math.hypot(W.pos[G.next * 3] - G.p[0], W.pos[G.next * 3 + 1] - G.p[1], W.pos[G.next * 3 + 2] - G.p[2])) : -1, v: Math.round(G.v * 10) / 10 };
    },
    line() { return S.on ? 'on' + (S.paused ? ', paused' : '') + (S.G ? ' · scanned ' + S.G.scanned + ', links ' + S.G.followed : ' · loading') + ' · ' + Math.round(S.away * 100) + ' cm from the seat' : 'off'; },
    // for tests: where things stand
    state() {
      const G = S.G;
      return { on: S.on, want: S.want, owner: S.owner, id: S.id, page: S.page, fade: S.fade, away: S.away, paused: S.paused, data: D.state, err: D.err,
        world: D.W ? { N: D.W.N, links: D.W.nb.length / 2, drones: D.W.drones.length, dots: D.dots ? D.dots.length / 4 : 0 } : null,
        game: G ? { t: G.t, p: G.p.slice(), yaw: G.yaw, v: G.v, cur: G.cur, next: G.next, curName: G.cur >= 0 ? D.W.sym[D.W.ids[G.cur]] : '', nextName: G.next >= 0 ? D.W.sym[D.W.ids[G.next]] : '', scanned: G.scanned, followed: G.followed, bumps: G.bumps } : null,
        aim: S.I.aim, grip: CTRL.grip, lgrip: CTRL.lgrip, thrust: S.I.thrust, drawn: V.made ? { root: V.root.visible, inScene: !!(V.root.parent && V.root.parent === storyScene()), prot: V.prot ? V.prot.geometry.attributes.position.count : 0, marks: V.marks.geometry.drawRange.count, links: V.links.geometry.drawRange.count / 2, drones: V.drones.count, guide: V.guide.visible, dash: V.dash.sig } : null };
    },
    debug: {
      // a page's preview: worn with the page's camera as the head (no headset)
      page(on) { if (on) return wear({ owner: (HOST.curKey || 'page'), id: 'page', page: true }); return off('test', true); },
      input(o) { DBG.in = o || null; },
      head(off3) { if (off3) { DBG.head.fromArray(off3); DBG.shift = true; } else { DBG.head.set(0, 0, 0); DBG.shift = false; } },
    // the headset's pose lost (true) or back (false)
    lost(on) { DBG.lost = !!on; },
      place(p, yaw) { if (!S.G) return false; if (p) for (let j = 0; j < 3; j++) S.G.p[j] = p[j]; if (Number.isFinite(yaw)) S.G.yaw = yaw; return true; },
      visit(i) { if (!S.G || !D.W) return false; visit(D.W, S.G, i); return true; },
      find(name) { const W = D.W; if (!W) return -1; const p = W.sym.indexOf(String(name).toUpperCase()); return p < 0 ? -1 : W.ids.indexOf(p); },
      objects: () => V,
    },
  };
})();
