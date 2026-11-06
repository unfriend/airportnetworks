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
// what follows it (a sound, a cut-out) goes with it. It rests at its placed pose while carried here or, editing, selected
// (as a motion does), except just after it is recorded (STU.recPlay: it plays though selected, until something else is
// selected or it is carried; Play it here on its card does the same). A sound that follows something moves with that:
// its own path waits until it follows nothing.
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
const pathClock = (it, P, now, clockS) => (P.start === 'shown' ? Math.max(0, (now - (it.shownAt != null ? it.shownAt : now)) / 1000) : clockS);
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
// REC: the recording under way here, or null: { it, id, by: 'xr' | 'page', c (the hand, xr), t0, last (ms), p0, q0 (its
// placed place and turn as it began), mid (its middle in its turned frame, metres: where the 5 mm are measured), S (the
// samples: [t, x, y, z, qx, qy, qz, qw] in the scene's frame), said }. RECLAST: the last one ended (the tests read its
// samples). REC_NOTE: what the last one came to, on that item's card
let REC = null, RECLAST = null;
const REC_NOTE = { id: '', text: '', c: '' };
// the recorder's clock (ms; the tests set their own)
let recClock = () => performance.now();
const recSay = (id, text, c) => { REC_NOTE.id = id; REC_NOTE.text = text || ''; REC_NOTE.c = c || ''; dirty(true); };
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
  REC = { it, id: it.id, by, c: c || null, t0: recClock(), last: -1e9, p0: new THREE.Vector3().fromArray(it.rec.p), q0: it.kind === 's' ? new THREE.Quaternion() : new THREE.Quaternion().fromArray(it.rec.q), mid: recMid(it), S: [], said: 0 };
  STU.recPlay = '';
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
  const now = recClock();
  if (now - R.t0 >= PATH_MAX.secs * 1000) {
    R.capped = true;
    if (R.by === 'xr' && R.c && R.c.grab && R.c.grab.id === R.id) xrLetGo(R.c); else recEnd(true);   // (a headset's: as if let go)
    return;
  }
  if (now - R.said > 250) { R.said = now; dirty(); }   // (its time on the card)
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
    STU.recPlay = it.id;
    recSay(it.id, `Recorded ${secs(pathLen(res.path))} in ${res.path.k.length} keys (from ${R.S.length} samples)` + (R.capped ? ', stopped at 120 s: the longest a path may be.' : '.') + ' It plays now; carry it or select something else and it rests at its place.', R.capped ? 'amber' : 'green');
    sfxAct('rise', 'world', it.holder.getWorldPosition(new THREE.Vector3()).toArray(), { dur: 0.5, gain: 0.5 });
  } else recSay(it.id, res.why, 'amber');
  if (R.by === 'page') endChange();
  tcAttach();
  dirty(true);
}
const secs = s => (s < 10 ? (Math.round(s * 10) / 10).toFixed(1) : String(Math.round(s))) + ' s';
// the samples as a path: relative to where it began (d = q0^-1 (p - p0), q = q0^-1 q), simplified, rounded, its play,
// start and speed those of the path it had (a new one: loop, always, 1); or why not
function recPath(it, R) {
  const S = R.S, hand = R.by === 'xr';
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
  const old = it.rec.path, path = normPath({ k, play: old ? old.play : 'loop', start: old ? old.start : 'always', speed: old ? old.speed : 1 });
  if (!path) return { why: 'The recording could not be kept (longer than 120 s?).' };
  // (a room's station holds the whole state as one value, at most 256 KB at the relay: kept well under it)
  const st = collabState();
  st[it.kind + '.' + it.id] = Object.assign({}, it.rec, { path });
  const n = JSON.stringify(st).length;
  if (n > PATH_MAX.state) return { why: `With this movement the scene would be ${Math.ceil(n / 1024)} KB to share in a room, more than its ${PATH_MAX.state >> 10} KB: delete a recording, or record a shorter movement.` };
  return { path };
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
const recSig = () => [XR.rec, STU.recPlay, REC ? REC.id + ':' + Math.floor((recClock() - REC.t0) / 250) : '', REC_NOTE.id, REC_NOTE.text].join(',');

// ------------------------------------------------------------- the card --
// the Recorded path rows (an object's, a shape's, an empty's and a sound's card, page and headset): Record (a page:
// Record and Stop; a headset: Record its movement, armed until the next grip), then how it plays, Play it here and Delete
// recording; one Undo step each (Record to its end is one)
function pathBlocks(it, B, dis, mv) {
  if (!PATH_ITEMS.includes(it.kind)) return;
  const P = it.rec.path, rec = recording(it), armed = XR.rec === it.id, fol = it.kind === 's' && !!it.rec.on, busy = !!REC && !rec;
  const head = 'Recorded path' + (P ? `: ${secs(pathLen(P))}, ${P.k.length} keys` : '');
  if (rec) {
    const t = Math.max(0, (recClock() - REC.t0) / 1000);
    if (REC.by === 'xr') B.push({ label: head, p: `● Recording ${secs(t)}: let go to keep it (at most 120 s).`, c: 'red' });
    else B.push({ label: head, p: `● Recording ${secs(t)}: move it with the arrows (Move, Turn) or its card's buttons (Turn 90°, On the floor...); Stop keeps the movement (at most 120 s).`, c: 'red' },
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
      { row: [{ id: 'recplay', label: STU.recPlay === it.id ? 'Playing here (rest it)' : 'Play it here', act: 'i:recPlay', on: STU.recPlay === it.id, dis: dis || rec || fol }, { id: 'recdel', label: 'Delete recording', act: 'i:recDel', dis: dis || rec, col: 'red' }] },
      { p: 'Played from where it stands: moving or turning it moves its whole path. Selected (editing) or carried, it rests at its place; Play it here shows it playing while selected. Once with Always plays once from when the scene opened (at a circle, the room\'s clock has long passed it): pair Once with When shown.', c: 'faint' });
  }
  if (REC_NOTE.id === it.id && REC_NOTE.text) B.push({ p: REC_NOTE.text, c: REC_NOTE.c });
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
  recPlay: it => { STU.recPlay = STU.recPlay === it.id || !pathOf(it) ? '' : it.id; tcAttach(); },
  pplay: (it, v) => { if (PATH_PLAYS.includes(v)) pathSet(it, () => ({ play: v })); },
  pstart: (it, v) => { if (v === 'always' || v === 'shown') pathSet(it, () => ({ start: v })); },
  pspeed: (it, d) => pathSet(it, P => ({ speed: stepOf(PATH_SPEEDS, P.speed, +d) })),
  recDel: it => { if (it.rec.path && !recording(it)) { setRec(it.id, { path: undefined }); if (STU.recPlay === it.id) STU.recPlay = ''; recSay(it.id, '', ''); tcAttach(); } },
});
