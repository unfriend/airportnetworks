// ============================================================= BEHAVIOURS ==
// The owner, 6 November 2026: "Add follow the player/avoid the player/an object etc to objects", then "behaviours should
// be shared for each headset so only react to one headset, example closest or first player who walks close". An object, a
// shape or an empty may have a behaviour in its record (tools/studio/SPEC.md, "Behaviours"), absent for none, with only
// the fields its kind uses:
// - look { who, range }: its front (+z as it is placed: a glTF model's own front) turns to face the person, about the
//   vertical through its middle;
// - follow { who, range, dist, speed, side, face }: comes to the person and stays about dist in front of them (where they
//   look), at its own height, turned to them as look turns it (behind them or at a side, facing the way they look; face
//   'them' or 'along' says which, v128);
// - avoid { who, range, dist, speed, area }: keeps at least dist away from the person, never more than area from where it
//   is placed, and goes home once home is dist + 0.2 m clear of them;
// - item { target, speed, face }: follows another object, shape or empty of the scene at the offset the two are placed at, a
//   little behind (where that one is drawn before its motion: its behaviour and recorded path, not its spin or bob),
//   turning with it as they are placed, or (face 'them', v128) turned to look at it.
// who: the one person it reacts to among those in a headset at its circle (pages never count): 'nearest' (the nearest
// within range; another takes over once nearer by 0.3 m) or 'first' (the first who came within range, kept until they
// are more than range + 0.5 m away). Distances along the floor, from its middle as drawn; speed in metres a second.
//
// Shared: at a station everyone sees it react to the same one person. Who that is is worked out alike on every device
// from the heads the shell knows (HOST.collab.heads(): presence, in room coordinates, which are the scene's at a station
// since v125: the scene stands on the room's frame, its circle only the way in); that person's headset drives it (its
// own head is exact), moving it every frame and sending where it put it about ten times a second (the quiet effect
// 'beh', every item it drives in one message); every other device draws it 120 ms behind those samples (the relay's
// clock), between them. With nobody in range (the
// driver's last sample says so) or no sample for 1 s it goes back to where it is placed by itself, alike everywhere. If
// two headsets start driving one item at once, the claims settle it: for 'first' the earlier arrival, for 'nearest' the
// newer driver (it started because it was nearer), ties by member id. 'item' needs no driver: every device works it out
// from what it draws. Outside a room it reacts to this device's own head (a headset's, the camera in Walk view on a
// page). Like a motion it rests at its placed pose while held here (carried, dragged by the arrows: motionRests) or paused
// here, and starts from there again; selected, it goes on (its ghost shows where it is placed).
//
// Drawn through the pose pipeline (e6e_motion.js): POSE.base gives its placed part (behaveBase), then its recorded path
// and its motion follow. POSE.base is set only while some item of the scene has a behaviour (behaveStep, every frame
// before itemsStep), so a scene without one is drawn exactly as before; while one has, every object, shape and empty is
// drawn by the pipeline (those without a behaviour where they stand). A person's behaviour keeps a move along the floor
// (tx, tz) and a turn about the vertical through its placed middle (d) from its placed pose, so it holds whatever the
// room does to the record (the samples carry these three); an item's keeps a whole pose.
const BEH_KINDS = ['look', 'follow', 'avoid', 'item', 'wall'], BEH_WHO = ['nearest', 'first'], BEH_PEOPLE = ['look', 'follow', 'avoid'];
const BEH_FIELDS = { look: ['who', 'range'], follow: ['who', 'range', 'dist', 'speed', 'side', 'face'], avoid: ['who', 'range', 'dist', 'speed', 'area'], item: ['target', 'speed', 'face'], wall: ['at', 'who', 'range', 'speed', 'gap'] };
// where Follow keeps it (v127; the owner, 9 November 2026: "follow mode should also be able to be behind someone", "should
// be able to just walk behind them and left right sounds good too"): in front of them, turned to them (the default, kept
// as no side at all, as before v127); behind them or at their left or right, facing the way they look (it walks with them)
const BEH_SIDE = ['front', 'behind', 'left', 'right'];
const BEH_SIDE_WORD = { front: 'In front', behind: 'Behind', left: 'Left', right: 'Right' };
const BEH_SIDE_AT = { front: 'Stays in front of them at', behind: 'Stays behind them at', left: 'Stays at their left at', right: 'Stays at their right at' };
// which way Follow and Follow an item face (v128; the owner, 9 November 2026: "when a model is in follow there should be a
// switch to look at the person or item it is following instead of into the same direction as the person"): 'them' (its
// front to the person, or the item, it follows) or 'along' (Follow: the way the person looks; an item: the turn it is
// placed at with that item, turning with it). Absent: as before v128 (Follow in front 'them', behind or at a side
// 'along'; an item 'along'), so older layouts and rooms look the same; once set from the card it is kept, also when the
// side changes
const BEH_FACE = ['them', 'along'];
const behFaceOf = b => b.face || (b.kind === 'follow' && !b.side ? 'them' : 'along');
// each number's default, least and most (to the cm, held there), and the card's steps
const BEH_NUM = {
  range: { d: 3, min: 0.5, max: 20, steps: [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20] },
  dist: { d: 1, min: 0.2, max: 10, steps: [0.2, 0.3, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 7, 10] },
  speed: { d: 0.6, min: 0.05, max: 5, steps: [0.05, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1, 1.5, 2, 3, 4, 5] },
  area: { d: 2, min: 0.2, max: 20, steps: [0.2, 0.5, 1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20] },
  gap: { d: 0.03, min: 0, max: 0.5, steps: [0, 0.01, 0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5] },   // (on a wall, v137: e6o_walls.js)
};
const BEH_DIST = { follow: 1, avoid: 1.5 };   // (a distance's default by kind: in front of them, away from them)
const BEH_WORD = { look: 'Look at', follow: 'Follow', avoid: 'Keep away', item: 'Follow an item', wall: 'On a wall' };
const BEH_DOES = { look: 'looks at people', follow: 'follows people', avoid: 'keeps away', item: 'follows an item', wall: 'on a wall' };
// a behaviour as a record keeps it (null: bad, which makes the record bad). Its kind is required, and an item's target (an
// id); the rest take their defaults when left out; fields its kind does not use are dropped
function normBehaviour(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || !BEH_KINDS.includes(x.kind)) return null;
  const r = { kind: x.kind };
  // on a wall (v137, e6o_walls.js): where (at, 'direction' when left out), and only for a person who, range and speed;
  // its gap from the wall written only when not the default
  if (x.kind === 'wall') {
    const at = x.at === undefined ? 'direction' : x.at;
    if (!WALL_AT.includes(at)) return null;
    r.at = at;
    const num = k => { const N = BEH_NUM[k], v = x[k]; if (v !== undefined && !fin(v)) return null; return clamp(r2(v !== undefined ? v : N.d), N.min, N.max); };
    if (at === 'person') {
      if (x.who !== undefined && !BEH_WHO.includes(x.who)) return null;
      r.who = x.who !== undefined ? x.who : 'nearest'; r.range = num('range'); r.speed = num('speed');
      if (r.range === null || r.speed === null) return null;
    }
    if (x.gap !== undefined) { const g = num('gap'); if (g === null) return null; if (g !== BEH_NUM.gap.d) r.gap = g; }
    return r;
  }
  for (const k of BEH_FIELDS[x.kind]) {
    const v = x[k], has = v !== undefined;
    if (k === 'who') { if (has && !BEH_WHO.includes(v)) return null; r.who = has ? v : 'nearest'; }
    else if (k === 'target') { if (!okId(v)) return null; r.target = v; }
    else if (k === 'side') { if (has && !BEH_SIDE.includes(v)) return null; if (has && v !== 'front') r.side = v; }
    else if (k === 'face') { if (has && !BEH_FACE.includes(v)) return null; if (has) r.face = v; }
    else { const N = BEH_NUM[k]; if (has && !fin(v)) return null; r[k] = clamp(r2(has ? v : k === 'dist' ? BEH_DIST[x.kind] : N.d), N.min, N.max); }
  }
  return r;
}

// ------------------------------------------------------------ the state --
// st: each behaving item's state here; heard: the drivers' samples, by item and member; rt: the time others' samples are
// drawn at (the relay's clock 120 ms ago, eased); ends: the items whose driving here stopped (their last sample says
// so); fake: pretend heads (tests: [{ id, p, yaw, ts }] in the scene's frame); log: what each item did, for tests
const BEH = { st: new Map(), heard: new Map(), n: 0, rt: { at: 0, t: 0 }, sent: 0, ends: new Set(), fake: null, base: '', log: null };
const BEH_SEND = 100, BEH_DELAY = 120, BEH_CARRY = 100, BEH_FRESH = 1000, BEH_KEEP = 0.5, BEH_SWAP = 0.3, BEH_HOME = 0.2;
const BEH_TURN = Math.PI, BEH_ARRIVE = 0.35, BEH_EASE = 0.25, BEH_LAG = 0.3;   // (at most half a turn a second; the easings' time constants, s)
const behStation = () => atStation();
const behMe = () => (behStation() && HOST.collab.id) || 'me';
// (ms: the relay's clock at a station, else this page's; a function, so a test can hold the clock still)
function behNow() { return behStation() && HOST.collab.now ? HOST.collab.now() : performance.now(); }
const wrapA = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const flat2 = (x, z) => { const l = Math.hypot(x, z); return l > 1e-6 ? [x / l, z / l] : [0, -1]; };
const _beH = new THREE.Vector3(), _beF = new THREE.Vector3(), _beQ = new THREE.Quaternion(), _beI = new THREE.Quaternion(), _beM = new THREE.Vector3(), _beM2 = new THREE.Vector3();
const _bem = new THREE.Matrix4(), _bem2 = new THREE.Matrix4(), _bem3 = new THREE.Matrix4(), _beT = new THREE.Matrix4(), _beR = new THREE.Matrix4();
const _beP = new THREE.Vector3(), _beQ2 = new THREE.Quaternion(), _beS = new THREE.Vector3(), _beV = new THREE.Vector3(), _beM3 = new THREE.Vector3(), _beM4 = new THREE.Vector3();

// where this device's own head looks, along the floor in the scene's frame (a test's pretend head: its fourth value, the
// turn about the vertical, 0 facing -z)
function behFace() {
  if (STU.head) { const a = +STU.head[3] || 0; return flat2(-Math.sin(a), -Math.cos(a)); }
  if (XR.on && GL.renderer.xr.isPresenting) { _beF.set(0, 0, -1).applyQuaternion(XR.headQ).applyQuaternion(GL.world.getWorldQuaternion(_beI).invert()); return flat2(_beF.x, _beF.z); }
  return flat2(-Math.sin(WALK.yaw), -Math.cos(WALK.yaw));
}
// the heads it may react to now, in the scene's frame: [{ id, me, p, f: where they look along the floor, ts: when (ms) }].
// This device's own as the studio has it (exact: a headset's, or the camera in Walk view outside a room, or a test's); in
// a room the others' from the shell (and this headset's from there when the studio has none, as in a pretend session)
function behHeads(T) {
  const out = [], p = headPoint(_beH), room = behStation();
  const own = p && (STU.head || (XR.on && GL.renderer.xr.isPresenting) || !room) ? { id: behMe(), me: true, p: p.clone(), f: behFace(), ts: T } : null;
  let H = null;
  try { H = room && HOST.collab.heads ? HOST.collab.heads() : null; } catch (e) { /* an older shell */ }
  if (H && Array.isArray(H.list)) {
    // (room coordinates are the scene's at a station since v125: the scene stands on the room's frame, xrPlace)
    for (const h of H.list) {
      if (h.me && own) continue;
      _beF.set(0, 0, -1).applyQuaternion(_beQ.set(h.head[3], h.head[4], h.head[5], h.head[6]));
      // (ts the relay's time it was there; a shell that gives none, or not a number, gives now: no entry time is NaN)
      out.push({ id: h.id, me: !!h.me, p: new THREE.Vector3(h.head[0], h.head[1], h.head[2]), f: flat2(_beF.x, _beF.z), ts: fin(h.ts) ? h.ts : T });
    }
  }
  if (own) out.push(own);
  if (Array.isArray(BEH.fake)) for (const h of BEH.fake) out.push({ id: h.id, me: false, p: new THREE.Vector3(...h.p), f: flat2(-Math.sin(h.yaw || 0), -Math.cos(h.yaw || 0)), ts: fin(h.ts) ? h.ts : T });
  return out;
}
// its middle at its placed pose (into out), and which way its front (+z) faces there (about the vertical)
function behHome(it, out) { const H = it.holder; return motionMiddle(it, _bem.compose(H.position, H.quaternion, H.scale), out); }
function behYaw0(it) { _beF.set(0, 0, 1).applyQuaternion(it.holder.quaternion); return Math.hypot(_beF.x, _beF.z) > 1e-3 ? Math.atan2(_beF.x, _beF.z) : 0; }

// the person it reacts to now ('' nobody), from the heads, the one before (B.who: as the driver's samples say, or this
// device's last choice) and its middle M. Who came within range when (B.inAt): set as they come within range, gone once
// they are more than range + 0.5 m away
function behChoose(b, B, hs, M) {
  const d = h => Math.hypot(h.p.x - M.x, h.p.z - M.z), by = new Map(hs.map(h => [h.id, h]));
  for (const h of hs) { const r = d(h); if (r <= b.range) { if (!B.inAt.has(h.id)) B.inAt.set(h.id, h.ts); } else if (r > b.range + BEH_KEEP) B.inAt.delete(h.id); }
  for (const id of [...B.inAt.keys()]) if (!by.has(id)) B.inAt.delete(id);
  const cur = by.get(B.who), keep = !!cur && d(cur) <= b.range + BEH_KEEP, inR = hs.filter(h => d(h) <= b.range);
  if (b.who === 'first') {
    if (keep) return cur.id;
    let w = null;
    for (const h of inR) { const a = B.inAt.get(h.id); if (!w || a < w.a || (a === w.a && h.id < w.id)) w = { id: h.id, a }; }
    return w ? w.id : '';
  }
  let n = null;
  for (const h of inR) { const r = d(h); if (!n || r < n.r - 1e-9 || (Math.abs(r - n.r) <= 1e-9 && h.id < n.id)) n = { id: h.id, r }; }
  if (keep && (!n || n.id === cur.id || n.r > d(cur) - BEH_SWAP)) return cur.id;
  return n ? n.id : '';
}
// whose claim wins: for 'first' the earlier arrival, for 'nearest' the newer driver; ties by member id
const behBeats = (b, x, y) => (x.since !== y.since ? (b.who === 'first' ? x.since < y.since : x.since > y.since) : x.by < y.by);
// the drivers' samples of item id that count now ({ by, since, S } or null): heard in the last second, not ended, the
// winning claim
function behWinner(id, b, pn) {
  const H = BEH.heard.get(id);
  let w = null;
  if (!H) return null;
  for (const [by, S] of H) {
    if (pn - S.got > BEH_FRESH) { H.delete(by); continue; }
    const L = S.s[S.s.length - 1];
    if (L.end) continue;
    if (!w || behBeats(b, { by, since: L.since }, w)) w = { by, since: L.since, S };
  }
  if (!H.size) BEH.heard.delete(id);
  return w;
}
// a driver's samples at time t (ms), between the two around it (past the last, carried on as they went for 100 ms at most)
function behSample(S, t) {
  const s = S.s, n = s.length, L = s[n - 1];
  const mix = (a, c, f) => ({ tx: a.tx + (c.tx - a.tx) * f, tz: a.tz + (c.tz - a.tz) * f, d: wrapA(a.d + wrapA(c.d - a.d) * f) });
  if (t >= L.ts) return n < 2 || L.end ? L : mix(s[n - 2], L, 1 + Math.min(t - L.ts, BEH_CARRY) / Math.max(1, L.ts - s[n - 2].ts));
  let i = n - 1;
  while (i > 0 && s[i - 1].ts > t) i--;
  return i ? mix(s[i - 1], s[i], (t - s[i - 1].ts) / Math.max(1, s[i].ts - s[i - 1].ts)) : s[0];
}
// towards a move (tx, tz) at most speed m/s, slowing as it arrives; towards a turn d at most half a turn a second, easing
function behMove(B, tx, tz, dt, speed) {
  const ex = tx - B.tx, ez = tz - B.tz, e = Math.hypot(ex, ez);
  if (e < 1e-3) { B.tx = tx; B.tz = tz; return; }
  const s = Math.min(speed * dt, e * (1 - Math.exp(-dt / BEH_ARRIVE)));
  B.tx += ex / e * s; B.tz += ez / e * s;
}
function behTurn(B, d, dt) {
  const e = wrapA(d - B.d);
  if (Math.abs(e) < 1e-3) { B.d = wrapA(d); return; }
  B.d = wrapA(B.d + Math.sign(e) * Math.min(BEH_TURN * dt, Math.abs(e) * (1 - Math.exp(-dt / BEH_EASE))));
}
// where it wants to be for the head h, as a move and a turn from its placed pose (M0: its placed middle)
function behWant(it, b, B, h, M0) {
  const yaw0 = behYaw0(it), Mx = M0.x + B.tx, Mz = M0.z + B.tz;
  const face = (x, z) => (Math.hypot(h.p.x - x, h.p.z - z) > 0.05 ? wrapA(Math.atan2(h.p.x - x, h.p.z - z) - yaw0) : B.d);   // (its front to them; right over it: as it is)
  if (b.kind === 'look') return { tx: 0, tz: 0, d: face(M0.x, M0.z) };
  if (b.kind === 'follow') {
    // (in front of them, behind them or at a side; turned to them, or facing the way they look (behFaceOf: by default in
    // front turned to them, elsewhere the way they look). h.f is where they look along the floor, [x, z]; their left is [f.z, -f.x])
    const sd = b.side || 'front', [fx, fz] = h.f, [ox, oz] = sd === 'behind' ? [-fx, -fz] : sd === 'left' ? [fz, -fx] : sd === 'right' ? [-fz, fx] : [fx, fz];
    return { tx: h.p.x + ox * b.dist - M0.x, tz: h.p.z + oz * b.dist - M0.z, d: behFaceOf(b) === 'them' ? face(Mx, Mz) : wrapA(Math.atan2(fx, fz) - yaw0) };
  }
  // avoid: home once home is clear of them; where it is while it is far enough; else pushed to dist from them, within its area
  if (Math.hypot(M0.x - h.p.x, M0.z - h.p.z) >= b.dist + BEH_HOME) return { tx: 0, tz: 0, d: 0 };
  const r = Math.hypot(Mx - h.p.x, Mz - h.p.z);
  if (r >= b.dist) return { tx: B.tx, tz: B.tz, d: 0 };
  let [ux, uz] = r > 1e-3 ? [(Mx - h.p.x) / r, (Mz - h.p.z) / r] : flat2(M0.x - h.p.x, M0.z - h.p.z);
  let tx = h.p.x + ux * b.dist - M0.x, tz = h.p.z + uz * b.dist - M0.z;
  const a = Math.hypot(tx, tz);
  if (a > b.area) {
    tx *= b.area / a; tz *= b.area / a;
    // (cornered at the edge of its area: the point of its area farthest from them)
    if (Math.hypot(M0.x + tx - h.p.x, M0.z + tz - h.p.z) < b.dist) { [ux, uz] = flat2(M0.x - h.p.x, M0.z - h.p.z); tx = ux * b.area; tz = uz * b.area; }
  }
  return { tx, tz, d: 0 };
}
const behReset = B => { B.tx = B.tz = B.d = B.ty = 0; B.p = null; B.src = ''; B.on = false; };
// (driving here stopped: its last sample says so, so the others go home, or to whoever drives it next, at once)
function behStop(id, B) { if (!B.drive) return; B.drive = false; BEH.ends.add(id); }

// ------------------------------------------------------------- each frame --
// every frame before itemsStep (frame, e10_app.js): the pipeline's base stage on or off, each behaving item's state
// (who it reacts to, driven here, drawn from a driver's samples or going home), and what this device sends
function behaveStep(dt, pn) {
  trkStep(pn);   // (the trackers here this frame, and the puppet's countdowns: e6k_trk.js)
  BEH.n++;
  restScan();   // (what rests this frame: held here, or Pause; e6e_motion.js)
  const items = [...STU.items.values()].filter(it => MOTION_ITEMS.includes(it.kind) && it.rec.behaviour);
  // (the base stage: an item on a tracker, else a behaviour's, while the scene has either: poseBase, e6k_trk.js)
  POSE.base = TRK.any ? poseBase : items.length ? behaveBase : null;
  for (const [id, B] of BEH.st) {
    const it = STU.items.get(id), b = it && it.rec.behaviour;
    if (!b || b.kind !== B.kind || (b.at || '') !== (B.at || '')) { behStop(id, B); BEH.st.delete(id); }
  }
  for (const id of BEH.heard.keys()) if (!STU.items.has(id)) BEH.heard.delete(id);   // (samples of items gone: another scene)
  // (in a room or not: the times are the relay's or this page's, so who came when starts again)
  const base = behStation() ? 'room' : 'here';
  if (BEH.base !== base) { BEH.base = base; BEH.heard.clear(); for (const B of BEH.st.values()) { B.inAt.clear(); B.who = ''; B.drive = false; } }
  const T = behNow();
  if (items.length) {
    const want = T - BEH_DELAY, R = BEH.rt;
    let t = R.t + (pn - R.at);
    if (!R.at || Math.abs(want - t) > 250) t = want; else t += clamp((want - t) * 0.1, -2, 2);
    R.at = pn; R.t = t;
    const hs = items.some(it => it.rec.behaviour.kind !== 'item') ? behHeads(T) : [], me = behMe();
    for (const it of items) behOne(it, hs, me, T, pn, dt);
  }
  behSend(pn, T);
}
function behOne(it, hs, me, T, pn, dt) {
  const b = it.rec.behaviour;
  let B = BEH.st.get(it.id);
  if (!B) BEH.st.set(it.id, (B = { kind: b.kind, at: b.at || '', tx: 0, tz: 0, ty: 0, d: 0, p: null, q: null, s: null, who: '', inAt: new Map(), drive: false, since: 0, src: '', age: 0, on: false, n: 0 }));
  // resting (held here, or paused): at its placed pose, driving no more; not drawn last frame: from there
  if (motionRests(it)) { behStop(it.id, B); behReset(B); B.n = BEH.n; return; }
  if (B.n !== BEH.n - 1) behReset(B);
  B.n = BEH.n;
  if (b.kind === 'item') { behItem(it, b, B, dt); behLog(it, B, T); return; }
  if (b.kind === 'wall') { wallOne(it, b, B, hs, dt); behLog(it, B, T); return; }   // (on this device's own walls, nothing sent: e6o_walls.js)
  const M0 = behHome(it, _beM), Mc = _beM2.set(M0.x + B.tx, M0.y, M0.z + B.tz);
  // a driver's claim heard: who it reacts to, as the driver says (its arrival too); one that beats this device's stops it
  const w = behWinner(it.id, b, pn), mine = { by: me, since: B.drive ? B.since : b.who === 'first' ? (B.inAt.has(me) ? B.inAt.get(me) : T) : T };
  if (w && w.by !== me) {
    if (b.who === 'first' && (!B.inAt.has(w.by) || w.since < B.inAt.get(w.by))) B.inAt.set(w.by, w.since);
    if (!B.drive || behBeats(b, w, mine)) { behStop(it.id, B); B.who = w.by; }
  }
  const who = behChoose(b, B, hs, Mc), h = hs.find(x => x.me);
  B.who = who;
  if (who && who === me && h && !(w && w.by !== me && behBeats(b, w, mine))) {
    // driven here: from this device's own head, exact
    if (!B.drive) { B.drive = true; B.since = mine.since; }
    if (B.src !== 'me') { B.src = 'me'; B.age = 0; }
    const v = behWant(it, b, B, h, M0);
    if (b.kind !== 'look') behMove(B, v.tx, v.tz, dt, b.speed);
    behTurn(B, v.d, dt);
  } else {
    behStop(it.id, B);
    const v = w && w.by !== me ? behSample(w.S, BEH.rt.t) : null;
    if (v) {
      // drawn from the driver's samples, 120 ms behind them; blended in over a moment when they are new here
      const src = 'by:' + w.by;
      if (B.src !== src) { B.src = src; B.age = 0; }
      B.age += dt;
      const k = B.age < 0.4 ? 1 - Math.exp(-dt / 0.08) : 1;
      B.tx += (v.tx - B.tx) * k; B.tz += (v.tz - B.tz) * k; B.d = wrapA(B.d + wrapA(v.d - B.d) * k);
    } else {
      // home: back where it is placed, by itself
      if (B.src !== 'home') { B.src = 'home'; B.age = 0; }
      behMove(B, 0, 0, dt, b.speed || BEH_NUM.speed.d);
      behTurn(B, 0, dt);
    }
  }
  B.on = Math.hypot(B.tx, B.tz) > 1e-4 || Math.abs(B.d) > 1e-4;
  behLog(it, B, T);
}
// an item following another: where its offset from that one, as they are placed, puts it on that one as drawn before its
// motion (drawnPose keeps it.pre), a little behind (at most speed m/s); home when that one is not here. Facing 'them'
// (v128): at that place, turned about the vertical through its middle so its front looks at that one's middle
function behItem(it, b, B, dt) {
  const H = it.holder, S = _bem.compose(H.position, H.quaternion, H.scale), T = STU.items.get(b.target);
  let want = S;
  if (T && T !== it && MOTION_ITEMS.includes(T.kind)) {
    const Tp = _bem2.compose(T.holder.position, T.holder.quaternion, T.holder.scale);
    if (!T.pre) T.pre = Tp.clone();   // (kept by drawnPose from now on)
    const Td = T.holder.matrixAutoUpdate ? Tp : T.pre;
    want = _bem3.copy(Td).multiply(_beT.copy(Tp).invert()).multiply(S);
    if (b.face === 'them') behToward(want, motionMiddle(it, want, _beM3), motionMiddle(T, Td, _beM4), B.p ? B.q : null);
  }
  want.decompose(_beP, _beQ2, _beS);
  if (!B.p) { B.p = H.position.clone(); B.q = H.quaternion.clone(); B.s = H.scale.clone(); B.src = 'item'; }
  const k = 1 - Math.exp(-dt / BEH_LAG), e = B.p.distanceTo(_beP);
  if (e < 1e-4) B.p.copy(_beP); else B.p.lerp(_beP, Math.min(1, Math.min(b.speed * dt, e * k) / e));
  B.q.slerp(_beQ2, k); B.s.lerp(_beS, k);
  if (B.q.angleTo(_beQ2) < 1e-4) B.q.copy(_beQ2);
  if (B.s.distanceTo(_beS) < 1e-6) B.s.copy(_beS);
  B.on = B.p.distanceTo(H.position) > 1e-4 || B.q.angleTo(H.quaternion) > 1e-4 || B.s.distanceTo(H.scale) > 1e-6;
}
// the pose m turned about the vertical through its middle Mi so its front (+z) looks at Mt along the floor; right over it
// (within 5 cm), its front as the turn q has it (where it is drawn now), or as m has it
function behToward(m, Mi, Mt, q) {
  const yawOf = v => (Math.hypot(v.x, v.z) > 1e-3 ? Math.atan2(v.x, v.z) : null);
  const a0 = yawOf(_beV.set(0, 0, 1).transformDirection(m));
  const a = Math.hypot(Mt.x - Mi.x, Mt.z - Mi.z) > 0.05 ? Math.atan2(Mt.x - Mi.x, Mt.z - Mi.z) : q ? yawOf(_beV.set(0, 0, 1).applyQuaternion(q)) : null;
  if (a0 === null || a === null) return;
  m.premultiply(_beT.makeTranslation(-Mi.x, -Mi.y, -Mi.z)).premultiply(_beR.makeRotationY(wrapA(a - a0))).premultiply(_beT.makeTranslation(Mi.x, Mi.y, Mi.z));
}
// the pipeline's base stage (POSE.base): its placed pose turned by d about the vertical through its placed middle and moved
// by (tx, tz) along the floor; an item's whole pose; false at home (its placed pose)
function behaveBase(it, now, clockS, out) {
  const B = BEH.st.get(it.id);
  if (!B || !B.on || !it.rec.behaviour) return false;
  if (B.kind === 'item') { out.compose(B.p, B.q, B.s); return true; }
  const H = it.holder;
  out.compose(H.position, H.quaternion, H.scale);
  const M = motionMiddle(it, out, _beM2);
  _beR.makeRotationY(B.d);
  out.premultiply(_beT.makeTranslation(-M.x, -M.y, -M.z)).premultiply(_beR).premultiply(_beT.makeTranslation(M.x + B.tx, M.y + (B.ty || 0), M.z + B.tz));   // (ty: on a wall, its height)
  return true;
}
// about ten times a second at a station: where this device put each item it drives ([id, tx, tz, d, since], and once
// more with 1 at the end when it stopped driving it), as one quiet effect
function behSend(pn, T) {
  if (!behStation()) { BEH.ends.clear(); return; }
  if (pn - BEH.sent < BEH_SEND) return;
  const b = [], r = v => nz(r3(v));
  for (const [id, B] of BEH.st) if (B.drive) b.push([id, r(B.tx), r(B.tz), r(B.d), B.since]);
  for (const id of BEH.ends) { const B = BEH.st.get(id); b.push([id, B ? r(B.tx) : 0, B ? r(B.tz) : 0, B ? r(B.d) : 0, B ? B.since : 0, 1]); }
  BEH.ends.clear();
  if (!b.length) return;
  BEH.sent = pn;
  try { HOST.collab.effect('beh', { at: Math.round(T), b }, true); } catch (e) { /* not in a room now */ }
}
// a driver's samples from another device (studioEffect): kept by item and by who sent them (the relay's word for it), the
// last 8 of each, only for items here; late ones dropped
function behaveHeard(data, by) {
  if (!data || !Array.isArray(data.b) || !fin(data.at) || typeof by !== 'string' || !by || by === behMe()) return;
  const pn = performance.now();
  for (const e of data.b.slice(0, 400)) {
    if (!Array.isArray(e) || !STU.items.has(e[0]) || ![1, 2, 3, 4].every(k => fin(e[k]) && Math.abs(e[k]) < 1e13)) continue;
    let H = BEH.heard.get(e[0]);
    if (!H) BEH.heard.set(e[0], (H = new Map()));
    let S = H.get(by);
    if (!S) H.set(by, (S = { s: [], got: 0 }));
    const L = S.s[S.s.length - 1];
    if (L && data.at <= L.ts) continue;
    if (L && data.at - L.ts > BEH_FRESH) S.s.length = 0;
    S.s.push({ ts: data.at, tx: e[1], tz: e[2], d: e[3], since: e[4], end: e[5] === 1 });
    if (S.s.length > 8) S.s.shift();
    S.got = pn;
  }
}
// (tests: what each item did, frame by frame, when asked for: [time (ms, the relay's at a station), tx, tz, d, src])
function behLog(it, B, T) {
  if (!BEH.log) return;
  const L = BEH.log.get(it.id) || [];
  L.push([Math.round(T), r3(B.kind === 'item' ? B.p.x : B.tx), r3(B.kind === 'item' ? B.p.z : B.tz), r3(B.kind === 'item' ? 0 : B.d), B.src]);
  if (L.length > 2000) L.splice(0, L.length - 2000);
  BEH.log.set(it.id, L);
}
// for tests and the console (STUDIO.behave): who it reacts to, whether this device drives it, where it is drawn from, its
// move and turn (or pose), whether it is off its placed pose
function behaveInfo(id) {
  const it = STU.items.get(id), B = BEH.st.get(id);
  if (!it || !it.rec.behaviour) return null;
  const H = BEH.heard.get(id);
  return { kind: it.rec.behaviour.kind, who: B ? B.who : '', drive: !!(B && B.drive), src: B ? B.src : '', t: B ? [r3(B.tx), r3(B.tz)] : [0, 0], ty: B ? r3(B.ty || 0) : 0, wall: B && B.wall !== undefined ? B.wall : -1, d: B ? r3(B.d) : 0, on: !!(B && B.on), since: B ? B.since : 0,
    p: B && B.p ? B.p.toArray().map(r3) : null, inAt: B ? Object.fromEntries(B.inAt) : {}, heard: H ? [...H.keys()] : [], base: POSE.base === behaveBase || POSE.base === poseBase, me: behMe() };
}

// ------------------------------------------------------------- the card --
// the Behaviour rows (an object's, a shape's and an empty's card, page and headset alike), before its Motion rows
function behaveBlocks(it, B, dis) {
  if (!MOTION_ITEMS.includes(it.kind)) return;
  const b = it.rec.behaviour, picking = STU.follow === it.id;
  B.push({ label: 'Behaviour', row: [{ id: 'beh:none', label: 'None', act: 'i:beh', v: 'none', on: !b && !picking, dis }]
    .concat(BEH_PEOPLE.map(k => ({ id: 'beh:' + k, label: BEH_WORD[k], act: 'i:beh', v: k, on: !!b && b.kind === k, dis })),
      { id: 'beh:item', label: picking ? 'Cancel' : b && b.kind === 'item' ? 'Follow another item...' : 'Follow an item...', act: 'i:bpick', on: picking || (!!b && b.kind === 'item'), dis },
      { id: 'beh:wall', label: BEH_WORD.wall, act: 'i:beh', v: 'wall', on: !!b && b.kind === 'wall', dis }) });
  if (picking) {
    const can = [...STU.items.values()].filter(x => MOTION_ITEMS.includes(x.kind) && x !== it);
    B.push({ p: (XR.on ? 'Point at an object, a shape or an empty and pull the trigger' : 'Click an object, a shape or an empty, or pick it here') + ': it follows that one, keeping the offset they are placed at.', c: 'amber' },
      can.length ? { list: can.map(o => ({ id: 'btarget:' + o.id, label: tagName(o.rec), sub: o.kind === 'o' ? baseName(o.rec.file) : KIND_NAME[o.kind], act: 'i:btarget', v: o.id, on: !!b && b.target === o.id, dis })) }
        : { p: 'Nothing else is placed here to follow.', c: 'faint' });
  }
  if (!b) {
    if (!picking) B.push({ p: 'It can react to the people here: Look at turns it to face them, Follow brings it along, Keep away keeps it at a distance; or it can follow another item, or stand on a wall of the room. Drawn over where it stands: its place is not changed.', c: 'faint' });
    return;
  }
  const num = (k, words, less, more) => ({ label: words + ': ' + (k === 'speed' ? b.speed + ' m/s' : metres(b[k])), row: [{ id: 'b' + k + ':-', label: less, act: 'i:bnum', v: k + ':-1', dis }, { id: 'b' + k + ':+', label: more, act: 'i:bnum', v: k + ':1', dis }] });
  // (Faces, v128: to them or the way they look; to the item or as placed)
  const fc = behFaceOf(b), faces = (them, along) => ({ label: 'Faces', row: [{ id: 'bface:them', label: them, act: 'i:bface', v: 'them', on: fc === 'them', dis }, { id: 'bface:along', label: along, act: 'i:bface', v: 'along', on: fc === 'along', dis }] });
  if (b.kind === 'wall') { wallBlocks(it, b, B, dis, num); return; }   // (on a wall: e6o_walls.js)
  if (b.kind === 'item') {
    const T = STU.items.get(b.target);
    B.push({ kv: [['Follows', T ? T.rec.name : 'an item that is not here (it stays where it is placed)']] }, faces('The item', 'As placed'), num('speed', 'Moves at most', 'Slower', 'Faster'),
      { p: 'It keeps the offset it is placed at from that item and follows where that one goes (its behaviour or recorded path, not its spin or bob), a little behind, ' +
        (fc === 'them' ? 'turned to look at it' : 'turning with it as the two are placed') + '. The same on every device.', c: 'faint' });
    return;
  }
  B.push({ label: 'Reacts to', row: [{ id: 'bwho:nearest', label: 'Nearest', act: 'i:bwho', v: 'nearest', on: b.who === 'nearest', dis }, { id: 'bwho:first', label: 'First to come close', act: 'i:bwho', v: 'first', on: b.who === 'first', dis }] },
    num('range', 'Notices people within', 'Less', 'More'));
  if (b.kind === 'follow') {
    const sd = b.side || 'front';
    B.push({ label: 'Where', row: BEH_SIDE.map(k => ({ id: 'bside:' + k, label: BEH_SIDE_WORD[k], act: 'i:bside', v: k, on: sd === k, dis })) },
      faces('Them', 'Where they look'), { p: fc === 'them' ? 'It turns to look at them.' : 'It faces the way they look, so it walks with them.', c: 'faint' },
      num('dist', BEH_SIDE_AT[sd], 'Closer', 'Further'));
  }
  if (b.kind === 'avoid') B.push(num('dist', 'Keeps away by', 'Less', 'More'), num('area', 'Stays near its place, within', 'Less', 'More'));
  if (b.kind !== 'look') B.push(num('speed', 'Moves at most', 'Slower', 'Faster'));
  B.push({ p: 'One person at a time, the same for everyone at a circle: ' + (b.who === 'first' ? 'the first to come within range, until they walk away' : 'the nearest within range') +
    ' (people in a headset; pages never count). With nobody in range it goes back to where it is placed. Selected, it goes on (a ghost where it is placed); carried, it rests there.', c: 'faint' });
}
// the card's actions (one Undo step each): a kind for people (its own distance, who and the rest kept where both have
// them; None takes it away), Follow an item... (pointing at one, or the card's list: btarget), who, a number a step up or down
const behSet = (it, fn) => { const b = it.rec.behaviour; if (b && MOTION_ITEMS.includes(it.kind)) setRec(it.id, { behaviour: Object.assign({}, b, fn(b)) }); };
Object.assign(ITEM_ACT, {
  beh: (it, v) => {
    if (!MOTION_ITEMS.includes(it.kind)) return;
    if (STU.follow === it.id) STU.follow = '';
    const b = it.rec.behaviour;
    if (v === 'wall') { if (!b || b.kind !== 'wall') setRec(it.id, { behaviour: { kind: 'wall', at: 'direction' } }); return; }   // (on a wall: e6o_walls.js)
    if (!BEH_PEOPLE.includes(v)) { if (b) setRec(it.id, { behaviour: undefined }); return; }
    if (b && b.kind === v) return;
    setRec(it.id, { behaviour: { kind: v, who: b && b.who, range: b && b.range, speed: b && b.speed, area: b && b.area } });
  },
  bpick: it => { if (MOTION_ITEMS.includes(it.kind)) STU.follow = STU.follow === it.id ? '' : it.id; },
  btarget: (it, oid) => {
    const o = STU.items.get(oid), b = it.rec.behaviour;
    if (STU.follow === it.id) STU.follow = '';
    if (!MOTION_ITEMS.includes(it.kind) || !o || o === it || !MOTION_ITEMS.includes(o.kind) || (b && b.kind === 'item' && b.target === oid)) return;
    setRec(it.id, { behaviour: { kind: 'item', target: oid, speed: b && b.speed, face: b && b.kind === 'item' ? b.face : undefined } });   // (another item: its Faces kept)
  },
  bwho: (it, v) => { if (BEH_WHO.includes(v)) behSet(it, b => (b.who ? { who: v } : {})); },
  bside: (it, v) => {   // (Follow's side; in front is no side at all)
    const b = it.rec.behaviour;
    if (!BEH_SIDE.includes(v) || !b || b.kind !== 'follow' || !MOTION_ITEMS.includes(it.kind) || (b.side || 'front') === v) return;
    const n = Object.assign({}, b);
    if (v === 'front') delete n.side; else n.side = v;
    setRec(it.id, { behaviour: n });
  },
  bface: (it, v) => {   // (Faces: written as pressed, so it is kept when the side changes; a new kind drops it)
    const b = it.rec.behaviour;
    if (!BEH_FACE.includes(v) || !b || !BEH_FIELDS[b.kind].includes('face') || !MOTION_ITEMS.includes(it.kind) || b.face === v) return;
    setRec(it.id, { behaviour: Object.assign({}, b, { face: v }) });
  },
  bnum: (it, v) => { const [k, d] = String(v).split(':'); if (BEH_NUM[k]) behSet(it, b => { const cur = k === 'gap' && b.kind === 'wall' && b.gap === undefined ? BEH_NUM.gap.d : b[k]; return cur !== undefined ? { [k]: stepOf(BEH_NUM[k].steps, cur, +d) } : {}; }); },   // (a wall's gap: its default when not written)
  // on a wall: which wall (e6o_walls.js; a person's who, range and speed come with 'person' and go with the others)
  bwall: (it, v) => { const b = it.rec.behaviour; if (WALL_AT.includes(v) && b && b.kind === 'wall' && b.at !== v) setRec(it.id, { behaviour: { kind: 'wall', at: v, gap: b.gap } }); },
});
PANE_ONLY.push('bpick');
// (the scene's pointer while an item picks what it follows: pressItem hands a click or the trigger to ITEM_ACT.follow, a
// sound's act; an object's, a shape's or an empty's goes to btarget)
const _followAct = ITEM_ACT.follow;
ITEM_ACT.follow = (it, oid) => (it.kind === 's' ? _followAct(it, oid) : ITEM_ACT.btarget(it, oid));
