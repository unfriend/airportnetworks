// ========================================================= RECORDED PATHS ==
// The owner, 6 November 2026: "just animate objects by dragging them? Animation recorder?", then "animations do 1 and 2"
// (1: simple motions, e6e_motion.js; 2: this file, the recorder). An object, a shape, an empty or a sound may have a
// recorded path in its record (tools/studio/SPEC.md, "Recorded paths"): { k, play, start, speed }, absent for none. A
// group has none (its members each keep their own, and move with it), nor do cubes and cut-outs (a cut-out goes with its
// object's path).
// - k: its keys, each [t, dx, dy, dz, qx, qy, qz, qw]: t seconds from 0 (to the ms; the first 0, strictly increasing, the
//   last at most 120), and its pose then relative to its placed pose: (dx, dy, dz) metres in its placed frame, turned but
//   not scaled (to the mm), and (qx, qy, qz, qw) a turn after its placed turn (4 decimals; a sound's is not used). Between
//   two keys the place goes in a straight line and the turn by the shortest way (slerp). 2 to 600 keys an item, 6,000 a
//   scene;
// - play: 'loop' (from its start again), 'once' (to its last key, then held there) or 'bounce' (back and forth);
// - start: 'always' (on the scene's clock: at a station the room's, so everyone there sees the same moment) or 'shown'
//   (from when it was last shown here);
// - speed: 0.25 to 4 (2 decimals), how fast it plays.
// It is drawn by the pose pipeline (e6e_motion.js: POSE.path, after the placed pose and before a motion, which adds on
// top), so moving or turning the item moves or turns its whole path, its record's place stays where it is placed, and
// what follows it (a sound, a cut-out) goes with it. As a motion, it plays on while selected (a ghost where it is placed)
// and rests at its placed pose while held here or paused (motionRests). Start again on its card starts it from its
// beginning on this device (its 'shown' clock; a path that plays once, played once more). A sound that follows something
// moves with that: its own path waits until it follows nothing.
//
// Recording (REC, this device's own, never shared while it runs): in a headset, Record its movement on its card arms it
// (XR.rec, as Hold it is armed); the next grip, on it or anywhere, carries it as usual and records its pose 30 times a
// second until it is let go (the sticks turn it and push it meanwhile, and that is recorded; they do not size it, nor
// does a second hand: a path has no size). On a page, Record on its card starts it and Stop ends it: the arrows (Move,
// Turn) and its card's buttons move it meanwhile, with their real timing (its size steps and the Size arrows are off). Then
// the samples are simplified (a key kept wherever leaving it out would move its middle more than 5 mm or turn it more
// than 1 degree: 4 mm and 0.9 degrees here, the rest left for rounding), and the path is written into its record, its
// place as it was when the recording began: one change, one Undo step (on a page from Record to Stop). It plays at once.
// Refused in words: too short, not moved, more than 600 keys, more than the scene's 6,000, or a scene whose shared state
// would pass 224 KB with it (the relay takes 256 KB a value; layout.json takes 2 MB). At 120 s the recording stops by
// itself and is kept.
//
// The ghost and the loop join (the owner, 7 November 2026: "when animating a 'ghost' of the model should stay in the
// initial place so that one can hit it again for better loops, these loops could then even autosmooth if the start and the
// end are close"): while it is recorded a ghost stands where it began (e6h_ghost.js). Once it has been more than 15 cm or
// 30 degrees from there, coming back within 5 cm (its middle) and 10 degrees lights the ghost, with a soft tick and a short
// gentle pulse in the hand; let go (or Stop) while it is lit and its end is put exactly on its start. A path that plays in
// a loop (a new one's way; Record again keeps the old one's) is then joined (pathJoin): its still moments cut (at its start
// until it has moved more than 1 cm or 1 degree, at its end after it last moved that far), and when its end is within 15 cm
// and 20 degrees of its start its last half second (a quarter of it when shorter than 2 s) is bent so it arrives exactly
// at its start, at the speed it sets off with: no jump and no pause as it loops. Its card says so, and Keep it as recorded
// writes it as it was recorded (one Undo step) while the recording is held here (RECLAST).
const PATH_ITEMS = ['o', 'p', 'e', 's'], PATH_PLAYS = ['loop', 'once', 'bounce'], PATH_SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const PATH_MAX = { keys: 600, secs: 120, scene: 6000, state: 224 << 10 }, PATH_HZ = 30, PATH_TOL = { m: 0.004, deg: 0.9 };
// a path as a record keeps it (null: bad: a record with a bad one is bad, as with any field)
function normPath(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || !Array.isArray(x.k) || x.k.length < 2 || x.k.length > PATH_MAX.keys) return null;
  const has = f => x[f] !== undefined;
  const play = !has('play') ? 'loop' : PATH_PLAYS.includes(x.play) ? x.play : null, start = !has('start') ? 'always' : ['always', 'shown'].includes(x.start) ? x.start : null;
  if (!play || !start || (has('speed') && !fin(x.speed))) return null;
  const k = [];
  for (const e of x.k) {
    if (!Array.isArray(e) || e.length !== 8 || !e.every(fin)) return null;
    const t = nz(r3(e[0])), d = vecOf(e.slice(1, 4), 3, 1000), q = quatOf(e.slice(4));
    if (!d || !q || (k.length ? !(t > k[k.length - 1][0]) : t !== 0)) return null;   // (the first at 0, then strictly later)
    k.push([t].concat(d.map(v => nz(r3(v))), q));
  }
  if (k[k.length - 1][0] > PATH_MAX.secs) return null;
  return { k, play, start, speed: clamp(r2(has('speed') ? x.speed : 1), 0.25, 4) };
}
// its path, when it plays here (a sound's waits while it follows something)
const pathOf = it => (it && it.rec && it.rec.path && PATH_ITEMS.includes(it.kind) && !(it.kind === 's' && it.rec.on) ? it.rec.path : null);
const pathLen = P => P.k[P.k.length - 1][0];
// the keys of every path in the scene but one item's (the scene's 6,000)
const pathKeys = except => [...STU.items.values()].reduce((n, it) => n + (it.id !== except && it.rec && it.rec.path ? it.rec.path.k.length : 0), 0);

// ---------------------------------------------------------------- playing --
// the path's own moment (s) at its item's time T (s): its speed, then looped, held at its end, or back and forth
function pathTime(P, T) {
  const D = pathLen(P), u = Math.max(0, T * P.speed);
  if (!(D > 0)) return 0;
  if (P.play === 'once') return Math.min(u, D);
  if (P.play === 'loop') return u % D;
  const v = u % (2 * D);
  return v <= D ? v : 2 * D - v;
}
const _pkb = new THREE.Vector3(), _pkq = new THREE.Quaternion();
// its pose on the path at its moment s: the place (into d) and the turn (into q), between the two keys round s
function pathAt(P, s, d, q) {
  const K = P.k, n = K.length;
  s = clamp(s, 0, K[n - 1][0]);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (K[m][0] <= s) lo = m; else hi = m; }
  const a = K[lo], b = K[hi], f = b[0] > a[0] ? clamp((s - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  d.set(a[1], a[2], a[3]).lerp(_pkb.set(b[1], b[2], b[3]), f);
  return q.set(a[4], a[5], a[6], a[7]).slerp(_pkq.set(b[4], b[5], b[6], b[7]), f).normalize();   // (keys kept to 4 decimals are a hair off unit length)
}
// its time (s): 'always' the scene's clock, 'shown' since it was last shown here (a sound: heard)
// (one that plays once and was started again here, Start again: since then)
const pathClock = (it, P, now, clockS) => (P.start === 'shown' ? Math.max(0, (now - (it.shownAt != null ? it.shownAt : now)) / 1000) : P.play === 'once' && it.again != null ? Math.max(0, (now - it.again) / 1000) : clockS);
const _pp3 = new THREE.Vector3(), _pq3 = new THREE.Quaternion(), _ps3 = new THREE.Vector3(), _pd3 = new THREE.Vector3(), _pk3 = new THREE.Quaternion();
// the pipeline's second stage (drawnPose in e6e_motion.js): its pose m (its placed one) moved along its path: the place by
// its turn times d, the turn by q after it (a sound only moves)
POSE.path = (it, now, clockS, m) => {
  const P = pathOf(it);
  if (!P) return;
  pathAt(P, pathTime(P, pathClock(it, P, now, clockS)), _pd3, _pk3);
  m.decompose(_pp3, _pq3, _ps3);
  _pp3.add(_pd3.applyQuaternion(_pq3));
  if (it.kind !== 's') _pq3.multiply(_pk3);
  m.compose(_pp3, _pq3, _ps3);
};
// a path turned by r (an object switched to its GLB, which holds its model turned by r: its holder turns by r^-1, so its
// keys are turned so that it moves as before: d' = r d, q' = r q r^-1)
function pathTurned(P, rq) {
  const r = new THREE.Quaternion().fromArray(rq).normalize(), ri = r.clone().invert(), v = new THREE.Vector3(), q = new THREE.Quaternion();
  return normPath(Object.assign({}, P, { k: P.k.map(e => [e[0]].concat(v.set(e[1], e[2], e[3]).applyQuaternion(r).toArray(), q.set(e[4], e[5], e[6], e[7]).premultiply(r).multiply(ri).toArray())) })) || P;
}

// ------------------------------------------------------------- recording --
// REC: the recording under way here, or null: { it, id, by: 'xr' | 'page', c (the hand, xr), t0, last (ms), p0, q0, s0 (its
// placed place, turn and size as it began: its ghost), mid (its middle in its turned frame, metres: where the 5 mm are
// measured), S (the samples: [t, x, y, z, qx, qy, qz, qw] in the scene's frame), said, away (it has been far from its
// start), lit (back at its ghost) }. RECLAST: the last one ended (its raw samples: the tests read them, and Keep it as
// recorded). REC_NOTE: what the last one came to, on that item's card (join: what the loop join did, and whether it can
// be kept as recorded)
let REC = null, RECLAST = null;
const REC_NOTE = { id: '', text: '', c: '', join: null };
// the recorder's clock (ms; the tests set their own)
let recClock = () => performance.now();
const recSay = (id, text, c, join) => { REC_NOTE.id = id; REC_NOTE.text = text || ''; REC_NOTE.c = c || ''; REC_NOTE.join = join || null; dirty(true); };
// why it cannot be recorded now ('' it can)
function recWhy(it) {
  if (!it || !editOn()) return 'Turn on Edit to record.';
  if (!PATH_ITEMS.includes(it.kind)) return it.kind === 'g' ? 'A group has no recorded path: record its members one by one (each plays its own, and moves with the group).' : 'Only objects, shapes, empties and sounds have a recorded path.';
  if (REC) return 'Another recording is under way here.';
  if (it.kind === 's' && it.rec.on) return 'A sound that follows something moves with it: Stop following to record its own path.';
  if (pathKeys(it.id) >= PATH_MAX.scene) return `The scene's recorded paths hold ${fmt(PATH_MAX.scene)} keys already, the most a scene holds: delete a recording first.`;
  return '';
}
// its middle, in its turned frame (an object's model's box's middle, scaled; the others stand at theirs)
const recMid = it => (it.kind === 'o' && it.model ? it.proxy.position.clone().multiply(it.holder.scale) : new THREE.Vector3());
// a recording begins: from its placed pose (it rests there), the first sample at 0
function recBegin(it, by, c) {
  const why = recWhy(it);
  if (why) { recSay(it.id, why, 'amber'); return false; }
  poseRest(it);
  REC = { it, id: it.id, by, c: c || null, t0: recClock(), last: -1e9, p0: new THREE.Vector3().fromArray(it.rec.p), q0: it.kind === 's' ? new THREE.Quaternion() : new THREE.Quaternion().fromArray(it.rec.q), s0: it.holder.scale.clone(), mid: recMid(it), S: [], said: 0, away: false, lit: false };
  recSample(true);
  recSay(it.id, '', '');
  sfxAct('pulse', 'world', null, { gain: 0.5 });
  return true;
}
// its pose now (its holder's place and turn: carried, or moved by the arrows and its card), 30 times a second; forced, now
// (a sample within 2 ms of the last takes its place, so the times stay apart once rounded to the ms)
function recSample(force) {
  const R = REC, it = R && R.it;
  if (!it) return;
  const now = recClock();
  if (!force && now - R.last < 1000 / PATH_HZ - 0.5) return;
  R.last = now;
  const t = clamp((now - R.t0) / 1000, 0, PATH_MAX.secs), H = it.holder, q = it.kind === 's' ? _pq3.identity() : H.quaternion, prev = R.S[R.S.length - 1];
  const s = [t, H.position.x, H.position.y, H.position.z, q.x, q.y, q.z, q.w];
  if (prev && t - prev[0] < 0.002) { s[0] = prev[0]; R.S[R.S.length - 1] = s; } else R.S.push(s);
}
// every frame (itemsStep; and a headset's carry, right after it moves what it carries): a sample when one is due, the
// card's clock, and the end: the item gone (here or from the room), editing over (a page's), or 120 s
function recStep() {
  const R = REC;
  if (!R) return;
  if (STU.items.get(R.id) !== R.it) { recEnd(false); return; }
  if (R.by === 'page' && !editOn()) { recEnd(false); return; }
  recSample(false);
  recGhost(R);
  const now = recClock();
  if (now - R.t0 >= PATH_MAX.secs * 1000) {
    R.capped = true;
    if (R.by === 'xr' && R.c && R.c.grab && R.c.grab.id === R.id) xrLetGo(R.c); else recEnd(true);   // (a headset's: as if let go)
    return;
  }
  if (now - R.said > 250) { R.said = now; dirty(); }   // (its time on the card)
}
// the ghost at its start (e6h_ghost.js): lit once it has been away (more than 15 cm or 30 degrees) and is back within 5 cm
// of it (its middle) and 10 degrees; as it lights, a soft tick at the ghost and a short gentle pulse in the hand
const JOIN = { still: [0.01, 1], near: [0.15, 20], hit: [0.05, 10], away: [0.15, 30], blend: 0.5, v0: 0.1 };
const beyond = (ap, lim) => ap[0] > lim[0] || ap[1] > lim[1];
function recGhost(R) {
  const H = R.it.holder, ap = poseApart(H.position, R.it.kind === 's' ? R.q0 : H.quaternion, R.p0, R.q0, R.mid);
  if (!R.away && beyond(ap, JOIN.away)) R.away = true;
  const lit = R.away && !beyond(ap, JOIN.hit);
  if (lit && !R.lit) {
    sfxAct('hover', 'world', GL.items.localToWorld(R.mid.clone().applyQuaternion(R.q0).add(R.p0)).toArray(), { force: true });
    if (R.c) buzz(R.c, 0.1, 25);
  }
  if (lit !== R.lit) { R.lit = lit; dirty(); }
}
// how far apart two poses are: their middles (m: mid in each one's turned frame) and their turns (degrees)
const _jq = new THREE.Quaternion(), _jv = new THREE.Vector3(), _jw = new THREE.Vector3();
function poseApart(p, q, p2, q2, mid) {
  const a = _jv.copy(mid).applyQuaternion(q).add(p), b = _jw.copy(mid).applyQuaternion(q2).add(p2);
  return [a.distanceTo(b), q.angleTo(q2) * 180 / Math.PI];
}
const _jsq = new THREE.Quaternion(), _jsq2 = new THREE.Quaternion(), _jsp = new THREE.Vector3(), _jsp2 = new THREE.Vector3();
const sampleApart = (a, b, mid) => poseApart(_jsp.set(a[1], a[2], a[3]), _jsq.set(a[4], a[5], a[6], a[7]), _jsp2.set(b[1], b[2], b[3]), _jsq2.set(b[4], b[5], b[6], b[7]), mid);
// the samples' place at time t (between the two round it), and its turn into q
function sampleAt(S, t, p, q) {
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m][0] <= t) lo = m; else hi = m; }
  const a = S[lo], b = S[hi], f = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  p.set(a[1], a[2], a[3]).lerp(_jv.set(b[1], b[2], b[3]), f);
  if (q) q.set(a[4], a[5], a[6], a[7]).slerp(_jq.set(b[4], b[5], b[6], b[7]), f);
  return p;
}
// the samples as kept (R.S stays as recorded): a loop's still moments cut and its end bent onto its start; once or back and
// forth as recorded, its end put on its start when it was let go at the ghost. info: what was done ({ cut: seconds of
// stillness cut, d, a: how far its end was from its start (m, degrees), joined, snap, changed }), none when nothing was
function pathJoin(R, play) {
  const S0 = R.S, n = S0.length, mid = R.mid, first = S0[0], last = S0[n - 1];
  if (n < 3) return { S: S0 };
  if (play !== 'loop') {
    if (!R.lit) return { S: S0 };
    const ap = sampleApart(last, first, mid), S = S0.slice();
    S[n - 1] = [last[0]].concat(first.slice(1));
    return { S, info: { cut: 0, d: ap[0], a: ap[1], snap: true, changed: true } };
  }
  let j = 1;
  while (j < n && !beyond(sampleApart(S0[j], first, mid), JOIN.still)) j++;
  if (j >= n) return { S: S0 };   // (never that far from where it began: as recorded; too little to keep, as it says)
  const i0 = j - 1;
  let k = n - 2;
  while (k > i0 && !beyond(sampleApart(S0[k], last, mid), JOIN.still)) k--;
  const e = Math.min(n - 1, k + 1), t0 = S0[i0][0], S = S0.slice(i0, e + 1).map(x => [x[0] - t0].concat(x.slice(1)));
  S[0][0] = 0;
  const m = S.length, D = S[m - 1][0];
  if (m < 3 || D < 0.1) return { S: S0 };
  const cut = t0 + (last[0] - S0[e][0]), ap = sampleApart(S[m - 1], S[0], mid), info = { cut, d: ap[0], a: ap[1], joined: false, changed: cut > 5e-4 };
  if (beyond(ap, JOIN.near)) return { S, info };
  // (its place along a cubic Hermite from its place and speed as the bend begins to its start's place and the speed of its
  // first 0.1 s; its turn by a correction towards its start's, eased in and out)
  const B = D < 2 ? D / 4 : JOIN.blend, tb = D - B, h = Math.min(1 / 30, B / 2), ta = Math.max(0, tb - h), tz = Math.min(D, tb + h), V = () => new THREE.Vector3();
  const pA = sampleAt(S, tb, V()), vA = sampleAt(S, tz, V()).sub(sampleAt(S, ta, V())).divideScalar(Math.max(1e-6, tz - ta));
  const t1 = Math.min(JOIN.v0, D), P0 = V().set(S[0][1], S[0][2], S[0][3]), v0 = sampleAt(S, t1, V()).sub(P0).divideScalar(t1);
  const q0 = new THREE.Quaternion(S[0][4], S[0][5], S[0][6], S[0][7]), C = q0.clone().multiply(new THREE.Quaternion(S[m - 1][4], S[m - 1][5], S[m - 1][6], S[m - 1][7]).invert());
  const I = new THREE.Quaternion(), w = new THREE.Quaternion(), q = new THREE.Quaternion(), p = V();
  for (let i = 1; i < m - 1; i++) {
    const t = S[i][0];
    if (t <= tb) continue;
    const u = (t - tb) / B, u2 = u * u, u3 = u2 * u;
    p.copy(pA).multiplyScalar(2 * u3 - 3 * u2 + 1).addScaledVector(vA, B * (u3 - 2 * u2 + u)).addScaledVector(P0, -2 * u3 + 3 * u2).addScaledVector(v0, B * (u3 - u2));
    w.copy(I).slerp(C, u2 * (3 - 2 * u));
    q.set(S[i][4], S[i][5], S[i][6], S[i][7]).premultiply(w).normalize();
    S[i] = [t, p.x, p.y, p.z, q.x, q.y, q.z, q.w];
  }
  S[m - 1] = [D].concat(S[0].slice(1));   // (its end exactly its start's pose)
  info.joined = info.changed = true;
  return { S, info };
}
// the end: kept (simplified and written into its record) or not; either way it stands where it stood as it began. A
// headset's ends as the hand lets go (xrLetGo, whose change it is in); a page's ends its own change
function recEnd(save) {
  const R = REC;
  if (!R) return;
  const it = STU.items.get(R.id) === R.it ? R.it : null;
  if (it && save) recSample(true);
  REC = null; RECLAST = R;
  if (!it) { recSay(R.id, '', ''); if (R.by === 'page' && SNAP) endChange(); return; }
  it.carry = false;   // (so its record puts it back at once: applyRec)
  const back = it.kind === 's' ? { p: R.p0.toArray() } : { p: R.p0.toArray(), q: R.q0.toArray() };
  let res = save && editOn() ? recPath(it, R) : { why: 'Recording cancelled: nothing changed.' };
  if (!setRec(it.id, Object.assign(back, res.path ? { path: res.path } : {})) && res.path) res = { why: 'The recording could not be kept.' };
  if (res.path) {
    recSay(it.id, `Recorded ${secs(pathLen(res.path))} in ${res.path.k.length} keys (from ${R.S.length} samples)` + (R.capped ? ', stopped at 120 s: the longest a path may be.' : '.') + ' It plays now; its ghost shows where it is placed.', R.capped ? 'amber' : 'green', joinNote(res.join, res.path));
    sfxAct('rise', 'world', it.holder.getWorldPosition(new THREE.Vector3()).toArray(), { dur: 0.5, gain: 0.5 });
  } else recSay(it.id, res.why, 'amber');
  if (R.by === 'page') endChange();
  tcAttach();
  dirty(true);
}
const secs = s => (s < 10 ? (Math.round(s * 10) / 10).toFixed(1) : String(Math.round(s))) + ' s';
// what the card says of the join (pathJoin's info), or null when it did nothing worth saying
function joinNote(J, P) {
  if (!J) return null;
  const d = cmOrM(J.d), a = Math.round(J.a), still = J.cut >= 0.05 ? `${secs(J.cut)} of stillness cut` : '';
  if (J.snap) return { text: `Its end met its start (${d}, ${a}° apart): put exactly on it.`, c: 'green', keep: true };
  if (J.joined) return { text: `Loop closed: its end met its start (${d}, ${a}° apart${still ? '; ' + still : ''}).`, c: 'green', keep: true };
  if (P.play !== 'loop') return null;
  return { text: `Its end is ${d}${J.a > JOIN.near[1] ? ` and ${a}°` : ''} from its start, so it jumps back each loop: record again and end at the ghost to close it.` + (still ? ` (${still[0].toUpperCase() + still.slice(1)}.)` : ''), c: 'amber', keep: J.changed };
}
// the samples as a path: relative to where it began (d = q0^-1 (p - p0), q = q0^-1 q), simplified, rounded, its play,
// start and speed those of the path it had (a new one: loop, always, 1); or why not. Joined (pathJoin) unless raw (Keep it
// as recorded): res.join says what was done
function recPath(it, R, raw) {
  const old = it.rec.path, J = raw ? { S: R.S } : pathJoin(R, old ? old.play : 'loop'), S = J.S, hand = R.by === 'xr';
  if (S.length < 2 || S[S.length - 1][0] < 0.1) return { why: hand ? 'Too short to keep: hold the grip a moment longer.' : 'Too short to keep: record a moment longer.' };
  const qi = R.q0.clone().invert(), rel = S.map(s => ({ t: s[0], d: new THREE.Vector3(s[1], s[2], s[3]).sub(R.p0).applyQuaternion(qi), q: qi.clone().multiply(new THREE.Quaternion(s[4], s[5], s[6], s[7])).normalize() }));
  for (let i = 1; i < rel.length; i++) if (rel[i].q.dot(rel[i - 1].q) < 0) rel[i].q.set(-rel[i].q.x, -rel[i].q.y, -rel[i].q.z, -rel[i].q.w);   // (one hemisphere)
  const keep = pathSimplify(rel, R.mid), k = [];
  for (const i of keep) {
    const e = [nz(r3(rel[i].t))].concat(rel[i].d.toArray().map(v => nz(r3(v))), quatOf(rel[i].q.toArray()));
    if (k.length && !(e[0] > k[k.length - 1][0])) k[k.length - 1] = [k[k.length - 1][0]].concat(e.slice(1)); else k.push(e);   // (strictly later once rounded)
  }
  const tol = new THREE.Quaternion();
  if (k.every(e => Math.hypot(e[1], e[2], e[3]) < 0.005 && tol.set(e[4], e[5], e[6], e[7]).normalize().angleTo(_pkq.identity()) < Math.PI / 180)) return { why: 'It did not move: nothing recorded.' };
  if (k.length < 2) return { why: 'Too short to keep.' };
  if (k.length > PATH_MAX.keys) return { why: `This movement needs ${fmt(k.length)} keys: a path holds ${PATH_MAX.keys} at most. Record a shorter or a calmer movement.` };
  const total = pathKeys(it.id) + k.length;
  if (total > PATH_MAX.scene) return { why: `With this movement the scene's recorded paths would hold ${fmt(total)} keys: ${fmt(PATH_MAX.scene)} at most. Delete a recording, or record a shorter movement.` };
  const path = normPath({ k, play: old ? old.play : 'loop', start: old ? old.start : 'always', speed: old ? old.speed : 1 });
  if (!path) return { why: 'The recording could not be kept (longer than 120 s?).' };
  // (a room's station holds the whole state as one value, at most 256 KB at the relay: kept well under it)
  const st = collabState();
  st[it.kind + '.' + it.id] = Object.assign({}, it.rec, { path });
  const n = JSON.stringify(st).length;
  if (n > PATH_MAX.state) return { why: `With this movement the scene would be ${Math.ceil(n / 1024)} KB to share in a room, more than its ${PATH_MAX.state >> 10} KB: delete a recording, or record a shorter movement.` };
  return { path, join: J.info || null };
}
// the keys to keep (indices, first and last always): split where the straight line and slerp between two kept keys
// stray most, while any sample strays from them by more than 4 mm at its middle (mid, its turned frame) or 0.9 degrees
function pathSimplify(rel, mid) {
  const n = rel.length, keep = new Uint8Array(n), todo = [[0, n - 1]], pm = new THREE.Vector3(), qm = new THREE.Quaternion(), wa = new THREE.Vector3(), wb = new THREE.Vector3();
  const tm = PATH_TOL.m, ta = PATH_TOL.deg * Math.PI / 180;
  keep[0] = keep[n - 1] = 1;
  while (todo.length) {
    const [a, b] = todo.pop(), A = rel[a], B = rel[b];
    if (b - a < 2) continue;
    let worst = 1, wi = -1;
    for (let i = a + 1; i < b; i++) {
      const f = (rel[i].t - A.t) / (B.t - A.t), r = rel[i];
      pm.copy(A.d).lerp(B.d, f); qm.copy(A.q).slerp(B.q, f);
      const e = Math.max(wa.copy(mid).applyQuaternion(qm).add(pm).distanceTo(wb.copy(mid).applyQuaternion(r.q).add(r.d)) / tm, qm.angleTo(r.q) / ta);
      if (e > worst) { worst = e; wi = i; }
    }
    if (wi >= 0) { keep[wi] = 1; todo.push([a, wi], [wi, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}
// why copies of these records cannot be made, for their recorded paths ('' they can): the scene's 6,000 keys, and a shared
// state kept under 224 KB (duplicateItem, groupDupWhy); records without a path are never refused here
function pathCopyWhy(recs) {
  const n = recs.reduce((s, r) => s + (r && r.path ? r.path.k.length : 0), 0);
  if (!n) return '';
  if (pathKeys('') + n > PATH_MAX.scene) return `No room for the copy's recorded path: a scene's paths hold ${fmt(PATH_MAX.scene)} keys at most. Delete a recording first.`;
  const more = recs.reduce((s, r) => s + JSON.stringify(r).length + 20, 0);
  if (JSON.stringify(collabState()).length + more > PATH_MAX.state) return `No room for the copy: with its recorded path the scene would be too big to share in a room (more than ${PATH_MAX.state >> 10} KB). Delete a recording first.`;
  return '';
}
// what a recording stops: a page's while it runs, its size (a path has no size: its size steps, the Size arrows)
const REC_NO_SIZE = ['size', 'psize', 'pgrow', 'grow'];
const recording = it => !!(REC && it && REC.id === it.id);
const recStops = (it, act) => recording(it) && REC_NO_SIZE.includes(act);
// the card's signature part (the panes are drawn again when it changes)
const recSig = () => [XR.rec, MPAUSE.on, REC ? REC.id + ':' + Math.floor((recClock() - REC.t0) / 250) + (REC.lit ? 'l' : '') : '', REC_NOTE.id, REC_NOTE.text, REC_NOTE.join && REC_NOTE.join.text, !!RECLAST].join(',');

// ------------------------------------------------------------- the card --
// the Recorded path rows (an object's, a shape's, an empty's and a sound's card, page and headset): Record (a page:
// Record and Stop; a headset: Record its movement, armed until the next grip), then how it plays and Delete recording, what
// the last recording's join did (Keep it as recorded), and, for anything that moves, Pause and Start again (moveBlocks); one
// Undo step each (Record to its end is one)
function pathBlocks(it, B, dis, mv) {
  if (!PATH_ITEMS.includes(it.kind)) return;
  const P = it.rec.path, rec = recording(it), armed = XR.rec === it.id, fol = it.kind === 's' && !!it.rec.on, busy = !!REC && !rec;
  const head = 'Recorded path' + (P ? `: ${secs(pathLen(P))}, ${P.k.length} keys` : '');
  if (rec) {
    const t = Math.max(0, (recClock() - REC.t0) / 1000);
    const lit = REC.lit ? ' At its ghost: let go here and its end goes exactly on its start.' : ' To loop smoothly, end at its ghost (it lights).';
    if (REC.by === 'xr') B.push({ label: head, p: `● Recording ${secs(t)}: let go to keep it (at most 120 s).` + lit, c: 'red' });
    else B.push({ label: head, p: `● Recording ${secs(t)}: move it with the arrows (Move, Turn) or its card's buttons (Turn 90°, On the floor...); Stop keeps the movement (at most 120 s).` + lit.replace('let go', 'Stop'), c: 'red' },
      { row: [{ id: 'recstop', label: 'Stop', act: 'i:recStop', primary: true }, { id: 'reccancel', label: 'Cancel', act: 'i:recCancel' }] });
  } else {
    const no = mv || fol || busy;
    B.push({ page: true, label: head, row: [{ id: 'rec', label: P ? 'Record again' : 'Record', act: 'i:rec', dis: no }] },
      { xr: true, label: head, row: [{ id: 'recxr', label: armed ? 'Now press a grip (again: cancel)' : P ? 'Record again' : 'Record its movement', act: 'i:recArm', on: armed, dis: no }] });
    if (fol) B.push({ p: P ? `It follows ${followWords(it)}: its own recorded path waits until it follows nothing.` : 'A sound that follows something moves with it: Stop following to record its own path.', c: P ? 'amber' : 'faint' });
    else if (!P) {
      B.push({ page: true, p: 'Record, then move it with the arrows (Move, Turn) or its card\'s buttons: Stop keeps the movement, and it plays it back from where it stands.', c: 'faint' },
        { xr: true, p: armed ? 'The next grip of either hand carries it from where it stands and records its movement until you let go (the sticks turn it and push it; they do not size it).' : 'Record its movement: then a grip carries it as usual, and its movement is recorded until you let go; it plays it back from where it stands.', c: armed ? 'amber' : 'faint' });
    } else if (armed) B.push({ xr: true, p: 'The next grip of either hand carries it from where it stands and records a new movement until you let go.', c: 'amber' });
  }
  if (P) {
    B.push({ label: 'Plays', row: [['loop', 'Loop'], ['once', 'Once'], ['bounce', 'Back and forth']].map(([v, n]) => ({ id: 'pplay:' + v, label: n, act: 'i:pplay', v, on: P.play === v, dis })) },
      { label: 'Starts', row: [['always', 'Always'], ['shown', 'When shown']].map(([v, n]) => ({ id: 'pstart:' + v, label: n, act: 'i:pstart', v, on: P.start === v, dis })) },
      { label: 'Speed: ×' + P.speed, row: [{ id: 'pspeed:-', label: 'Slower', act: 'i:pspeed', v: -1, dis: dis || P.speed <= 0.25 }, { id: 'pspeed:+', label: 'Faster', act: 'i:pspeed', v: 1, dis: dis || P.speed >= 4 }] },
      { row: [{ id: 'recdel', label: 'Delete recording', act: 'i:recDel', dis: dis || rec, col: 'red' }] },
      { p: 'Played from where it stands: moving or turning it moves its whole path. It plays on while selected (a ghost where it is placed); carried, it rests there. Once with Always plays once from when the scene opened (at a circle, the room\'s clock has long passed it): pair Once with When shown.', c: 'faint' });
  }
  if (REC_NOTE.id === it.id && REC_NOTE.text) B.push({ p: REC_NOTE.text, c: REC_NOTE.c });
  // (what the loop join did, while the recording is held here)
  const J = REC_NOTE.id === it.id && REC_NOTE.join && RECLAST && RECLAST.id === it.id ? REC_NOTE.join : null;
  if (J) B.push({ p: J.text, c: J.c }, ...(J.keep && P ? [{ row: [{ id: 'reckeep', label: 'Keep it as recorded', act: 'i:reckeep', dis }] }] : []));
  moveBlocks(it, B);
}
// what anything that moves has on its card (a motion, a recorded path, a behaviour, a model's animation): Pause (this
// device's, as on the Scene pane: e6h_ghost.js), and Start again where it starts when shown or a path plays once (this
// device's: from its beginning, as when a cube shows it)
function moveBlocks(it, B) {
  const P = pathOf(it), mo = it.rec.motion, clip = it.kind === 'o' && it.rec.anim !== 'off' && !!(it.E && it.E.clips && it.E.clips.some(c => c.name === it.rec.clip));
  if (!(mo || P || it.rec.behaviour || clip) || !editOn()) return;
  const again = (P && (P.start === 'shown' || P.play === 'once')) || (mo && mo.start === 'shown');
  pauseBlocks(B, false, again ? [{ id: 'restart', label: 'Start again', act: 'i:restart' }] : []);
}
// the card's actions: recording (this device's: no change recorded until its end), and how it plays (one Undo step each)
const pathSet = (it, fn) => { const P = it.rec.path; if (P) setRec(it.id, { path: normPath(Object.assign({}, P, fn(P))) || P }); };
Object.assign(ITEM_ACT, {
  // a page: Record (Stop when one runs here); a headset: armed for the next grip (again: not), Hold it disarmed
  rec: it => {
    if (recording(it)) { recEnd(true); return; }
    if (XR.on) return;
    beginChange([it.id]);   // (Record to Stop is one change)
    if (!recBegin(it, 'page')) { endChange(); return; }
    tcAttach();
  },
  recStop: it => { if (recording(it)) recEnd(true); },
  recCancel: it => { if (recording(it)) recEnd(false); },
  recArm: it => {
    if (XR.rec === it.id || !XR.on) { XR.rec = ''; return; }
    const why = recWhy(it);
    if (why) { recSay(it.id, why, 'amber'); return; }
    XR.rec = it.id; XR.hold = ''; recSay(it.id, '', '');
  },
  // (this device's: its 'shown' clock from now, a path that plays once played once more; a sound starts again too)
  restart: it => {
    const now = performance.now();
    it.shownAt = now; it.ended = false;
    if (pathOf(it) && pathOf(it).play === 'once') it.again = now;
    if (it.kind === 's') emitStop(it);
  },
  // Keep it as recorded: the last recording written as it was recorded, without its join (one Undo step)
  reckeep: it => {
    const R = RECLAST;
    if (!R || R.id !== it.id || !it.rec.path || recording(it)) return;
    const res = recPath(it, R, true);
    if (res.path && setRec(it.id, { path: res.path })) recSay(it.id, `Kept as recorded: ${secs(pathLen(res.path))} in ${res.path.k.length} keys.`, 'muted');
    else recSay(it.id, res.why || 'The recording could not be kept.', 'amber');
  },
  pplay: (it, v) => { if (PATH_PLAYS.includes(v)) pathSet(it, () => ({ play: v })); },
  pstart: (it, v) => { if (v === 'always' || v === 'shown') pathSet(it, () => ({ start: v })); },
  pspeed: (it, d) => pathSet(it, P => ({ speed: stepOf(PATH_SPEEDS, P.speed, +d) })),
  recDel: it => { if (it.rec.path && !recording(it)) { setRec(it.id, { path: undefined }); recSay(it.id, '', ''); tcAttach(); } },
});
