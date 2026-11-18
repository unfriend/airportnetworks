// ================================================================== WALKS ==
// Clip by distance (v164; the owner, 18 November 2026, of characters that move about: "would also need feet solver for npcs
// that move around?", and of the ways discussed, clip by distance first; foot locking maybe later; tools/studio/SPEC.md,
// "As it moves"). An object's Animation may be anim: 'move' (*As it moves*): the clip its record names is its walk, and
// its time follows the distance it covers along the floor, one cycle of the clip a stride, instead of the clock:
// - on its recorded path (e6f_path.js; no behaviour or tracker giving its place, not held here) the distance is the
//   path's own at the path's moment (it.pS, set by POSE.path: so every device agrees, and its timeline scrubs the walk), from
//   a table of its keys (signed distances along the floor, each segment's speed), made once a path and turn; on a path that
//   loops the stride is fitted so the path is a whole number of strides (no jump as it comes round);
// - otherwise (a behaviour, a motion, a wall, a tracker, carried, its group carried, a glide from the room) from what is
//   drawn here, frame to frame, along the floor (this device's own; a jump of more than 1.5 m in a frame counts nothing);
// - moving against its facing (its +z as drawn) plays it backwards; sideways counts the distance's size;
// - below a smoothed speed of 0.05 m/s it settles to standing over 0.3 s, and starts again the same way (a crossfade both
//   ways): standing is its idle clip (record idle: another clip of its model, looped on the scene's clock or from when shown),
//   else its walk held where its feet are together (worked out once a clip), never its bind pose.
// The stride is measured once a clip (GAIT.info, by clip) from the clip itself on the model, in the model's units, then times
// its scale and strideK (Shorter / Longer on its card): a clip that walks in place, from how fast the foot on the ground
// moves back under its hips over a cycle; a clip whose hips travel (root motion), from that travel over a cycle, which is
// taken out of the clip it plays (a copy whose hips' place keeps only its bob and sway: it must not move twice); no hips or
// feet found, guessed from its height (0.8 of it). Its clip's timeline (e6m_anim.js) does not apply (its moves set its
// phase); the path's does. A cube's clip (e6n_plays.js) wins while it plays, as it does over Loop. Nothing per frame is
// allocated. Foot locking could come on top: each foot's ground phases are known from the same samples (gaitInfo).
const GAIT = { still: 0.05, tau: 0.1, fade: 0.3, jump: 1.5, n: 48, gap: 500, info: new WeakMap(), tables: new WeakMap() };
const STRIDE_KS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.4, 1.5, 1.75, 2];
const _wkA = new THREE.Vector3(), _wkB = new THREE.Vector3(), _wkF = new THREE.Vector3(), _wkM = new THREE.Matrix4(), _wkQ = new THREE.Quaternion(), _wkQ2 = new THREE.Quaternion(), _wkQ3 = new THREE.Quaternion();

// ---------------------------------------------------------------- the record --
// an object's idle and strideK, each kept only when set (norm, e6_items.js): idle the name of another clip of its model (at
// most 120 characters; '' or null none; not a string makes the record bad), strideK a factor on the measured stride (0.5
// to 2, 2 decimals; 1 is none; not a positive number makes it bad). Kept whatever its anim, so Loop and back keeps them
function gaitKeep(x, r) {
  if (x.idle != null) { if (typeof x.idle !== 'string') r.idle = null; else if (x.idle.trim()) r.idle = x.idle.slice(0, 120); }
  if (x.strideK != null) { if (!fin(x.strideK) || x.strideK <= 0) r.strideK = null; else { const k = r2(clamp(x.strideK, 0.5, 2)); if (k !== 1) r.strideK = k; } }
  return r;
}

// --------------------------------------------------------------- the stride --
// a node's place in its model's frame (the holder's: the slot between never moves), from its matrices as they are now
function gaitAt(n, o, out) {
  out.set(0, 0, 0);
  for (let m = n; m; m = m.parent) { out.applyMatrix4(m.matrix); if (m === o) break; }
  return out;
}
// its hips and its two feet, by name (Mixamo's mixamorigHips and mixamorigLeftFoot, Unreal's pelvis and foot_l, ...; bones
// first, else any node); more than two feet: the two farthest apart
function gaitBones(o) {
  const all = [], bones = [];
  o.traverse(n => { all.push(n); if (n.isBone) bones.push(n); });
  const L = bones.length ? bones : all, nm = n => String(n.name || '').toLowerCase();
  const hips = L.find(n => /hips|pelvis/.test(nm(n))) || null;
  let feet = L.filter(n => /foot|ankle/.test(nm(n)) && !/toe|end|ball|tip|ik/.test(nm(n)));
  if (feet.length > 2) {
    let best = null, far = -1;
    for (let i = 0; i < feet.length; i++) for (let j = i + 1; j < feet.length; j++) { const d = Math.abs(gaitAt(feet[i], o, _wkA).x - gaitAt(feet[j], o, _wkB).x); if (d > far) { far = d; best = [feet[i], feet[j]]; } }
    feet = best;
  }
  return { hips, feet: feet && feet.length === 2 ? feet : null };
}
// the clip with its hips' travel over a cycle taken out (a copy: its hips' place minus the travel so far, so the bob and the
// sway stay), the travel (tx, tz: the model's frame) turned into the hips' parent's frame
function gaitFlat(clip, hips, o, tx, tz) {
  const c = clip.clone(), dur = clip.duration;
  _wkM.identity();
  for (let m = hips.parent; m; m = m.parent) { _wkM.premultiply(m.matrix); if (m === o) break; }
  _wkM.invert();
  const a = _wkA.set(0, 0, 0).applyMatrix4(_wkM), v = _wkB.set(tx, 0, tz).applyMatrix4(_wkM).sub(a);
  for (const t of c.tracks) {
    let p = null;
    try { p = THREE.PropertyBinding.parseTrackName(t.name); } catch (e) { continue; }
    if (p.propertyName !== 'position' || (p.nodeName !== hips.name && p.nodeName !== hips.uuid) || t.getValueSize() !== 3) continue;
    const T = t.times, V = t.values;
    for (let k = 0; k < T.length; k++) { const f = T[k] / dur; V[3 * k] -= v.x * f; V[3 * k + 1] -= v.y * f; V[3 * k + 2] -= v.z * f; }
  }
  return c;
}
// what a clip is as a walk, measured once (on this item's model, every clone of its file alike): { stride (the model's
// units, a cycle), dir (1, or -1 for a clip that walks backwards), stand (its time with its feet together), how ('feet',
// 'root' or 'guess'), root (its hips' travel a cycle, 0 none), h (its height), clip (what plays: the clip, or its copy without
// the travel), still (a copy of that, held at stand while it stands with no idle clip) }
function gaitInfo(it, clip) {
  let W = GAIT.info.get(clip);
  if (W) return W;
  const o = it.model.o, b = it.E.info && it.E.info.box, h = b ? Math.max(1e-3, b[1][1] - b[0][1]) : 1.7;
  o.updateMatrixWorld(true);
  const { hips, feet } = gaitBones(o), dur = clip.duration, N = GAIT.n;
  W = { stride: 0.8 * h, dir: 1, stand: 0, how: 'guess', root: 0, h, clip, still: null };
  if (hips && dur > 0) {
    // (its hips and feet at N + 1 moments of a cycle, the last a hair before its end, on a mixer of its own)
    const mx = new THREE.AnimationMixer(o), a = mx.clipAction(clip), H = [], F = [[], []];
    a.play();
    for (let i = 0; i <= N; i++) {
      a.time = i < N ? i * dur / N : dur * (1 - 1e-4); mx.update(0); o.updateMatrixWorld(true);
      H.push(gaitAt(hips, o, new THREE.Vector3()));
      if (feet) feet.forEach((f, k) => F[k].push(gaitAt(f, o, new THREE.Vector3())));
    }
    mx.stopAllAction(); mx.uncacheRoot(o);
    for (const [n, p, q, s] of it.model.rest) { n.position.copy(p); n.quaternion.copy(q); n.scale.copy(s); }
    o.updateMatrixWorld(true);
    const tx = H[N].x - H[0].x, tz = H[N].z - H[0].z, trav = Math.hypot(tx, tz);
    if (trav > 0.04 * h) {
      // (root motion: the hips go forward by trav a cycle; that is its stride, and it is taken out of what plays)
      Object.assign(W, { stride: trav, root: trav, dir: tz < -0.5 * trav ? -1 : 1, how: 'root', clip: gaitFlat(clip, hips, o, tx, tz) });
    } else if (feet) {
      // (in place: the foot on the ground, the lower one, moves back under the hips as fast as the body would go forward;
      // both down within 1 % of its height, the one moving back faster), summed over a cycle
      let back = 0;
      for (let i = 0; i < N; i++) {
        const bk = k => -((F[k][i + 1].z - H[i + 1].z) - (F[k][i].z - H[i].z)), dy = F[0][i].y - F[1][i].y;
        back += Math.abs(dy) < 0.01 * h ? Math.max(bk(0), bk(1)) : bk(dy < 0 ? 0 : 1);
      }
      if (Math.abs(back) > 0.05 * h) Object.assign(W, { stride: Math.abs(back), dir: back > 0 ? 1 : -1, how: 'feet' });
    }
    // (its feet together: closest along its facing and in height)
    if (feet) {
      let best = Infinity;
      for (let i = 0; i < N; i++) { const s = Math.abs(F[0][i].z - F[1][i].z) + Math.abs(F[0][i].y - F[1][i].y); if (s < best) { best = s; W.stand = i * dur / N; } }
    }
  }
  W.still = W.clip.clone();
  GAIT.info.set(clip, W);
  libChanged();   // (its card's Stride, page and headset)
  return W;
}
// its stride now (m): measured, times its scale and its hand's factor
const gaitStride = (it, W) => W.stride * it.rec.s * (it.rec.strideK || 1);
// the clips it may stand with (its model's others)
const gaitIdles = it => (it.E && it.E.clips ? it.E.clips.map(c => c.name).filter(n => n !== it.rec.clip) : []);

// ------------------------------------------------------------------ playing --
// (animStep, as its clip is set up: its walk playing, its standing action, its state: the distance d (m), where it was
// last frame, its smoothed velocity, k its walking weight, -1 until its first frame)
function gaitBegin(it) {
  const W = it.gait, r = it.rec, ic = r.idle && r.idle !== r.clip ? it.E.clips.find(c => c.name === r.idle) : null;
  it.wIdleClip = ic || null;
  it.wIdle = it.mixer.clipAction(ic || W.still);
  it.wIdle.play(); it.wIdle.setEffectiveWeight(0);
  const S = it.wk || (it.wk = { d: 0, x: 0, z: 0, t: -1, vx: 0, vz: 0, k: -1, v: 0, on: '' });
  S.t = -1; S.k = -1;
}
// a path's table for its keys K and the item's placed turn: each key's distance along the floor from the first (signed:
// a segment walked backwards takes away) and each segment's speed (m/s, before the path's speed); made again only when
// the keys or the turn change
function gaitTable(it, K) {
  const q = it.rec.q;
  let T = GAIT.tables.get(K);
  if (T && T.q[0] === q[0] && T.q[1] === q[1] && T.q[2] === q[2] && T.q[3] === q[3]) return T;
  const n = K.length, cum = new Float64Array(n), sp = new Float64Array(n), Q = _wkQ.fromArray(q);
  for (let i = 1; i < n; i++) {
    // (its move turned into the scene's frame, and its facing halfway along: its placed turn after the keys' turn)
    const a = K[i - 1], b = K[i], d = _wkA.set(b[1] - a[1], b[2] - a[2], b[3] - a[3]).applyQuaternion(Q), len = Math.hypot(d.x, d.z);
    const f = _wkF.set(0, 0, 1).applyQuaternion(_wkQ2.set(a[4], a[5], a[6], a[7]).slerp(_wkQ3.set(b[4], b[5], b[6], b[7]), 0.5)).applyQuaternion(Q), fl = Math.hypot(f.x, f.z);
    const fwd = fl > 1e-6 ? (d.x * f.x + d.z * f.z) / fl : len;
    cum[i] = cum[i - 1] + (fwd < -0.5 * len ? -len : len);
    sp[i] = b[0] > a[0] ? len / (b[0] - a[0]) : 0;
  }
  T = { q: q.slice(), cum, sp, tot: cum[n - 1] };
  GAIT.tables.set(K, T);
  return T;
}
// whether its path drives its walk this frame: its path drew it (POSE.path set it.pS at this now), and nothing else gives
// its place (no behaviour or tracker, not held here)
function gaitPath(it, now) {
  if (it.pNow !== now || it.rec.behaviour || it.rec.trk || REST.ids.has(it.id)) return null;
  const P = pathOf(it);
  return P && pathK(P) ? P : null;
}
// whether its path goes on now: held from its timeline (its walk shown at that moment, scrubbed with it), a run of a cube
// moving it (none: it waits), on the beat, or its clock (one that plays once stops at its end)
function gaitGo(it, P, s) {
  if (animHold(it, 'path')) return true;
  if (it.tgM & 4) return !!(it.tr && it.tr.path);
  if (P.sync === 'beat' && STU.bt) return true;
  return P.play !== 'once' || s < pathLen(P) - 1e-6;
}
// every frame (animStep, its own clip playing): its distance, whether it moves, its walk's time and its standing one
function gaitStep(it, now, clockS, dt) {
  const r = it.rec, W = it.gait, S = it.wk, P = gaitPath(it, now);
  let stride = Math.max(1e-3, gaitStride(it, W)), v;
  if (P) {
    const K = pathK(P), T = gaitTable(it, K), n = K.length, s = clamp(it.pS || 0, 0, K[n - 1][0]);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (K[m][0] <= s) lo = m; else hi = m; }
    const f = K[hi][0] > K[lo][0] ? clamp((s - K[lo][0]) / (K[hi][0] - K[lo][0]), 0, 1) : 0;
    S.d = T.cum[lo] + (T.cum[hi] - T.cum[lo]) * f;
    v = gaitGo(it, P, s) ? T.sp[hi] * P.speed : 0;
    if (P.play === 'loop') { const m = Math.round(Math.abs(T.tot) / stride); if (m >= 1) stride = Math.abs(T.tot) / m; }
    S.t = -1; S.vx = S.vz = 0; S.on = 'path';
  } else {
    // (from what is drawn: its holder's matrix while the pipeline draws it, else its place and turn)
    const H = it.holder, e = H.matrix.elements, auto = H.matrixAutoUpdate, x = auto ? H.position.x : e[12], z = auto ? H.position.z : e[14];
    const fa = auto ? _wkF.set(0, 0, 1).applyQuaternion(H.quaternion) : _wkF.set(e[8], e[9], e[10]), fl = Math.hypot(fa.x, fa.z);
    if (S.t >= 0 && now - S.t < GAIT.gap) {
      const dx = x - S.x, dz = z - S.z, len = Math.hypot(dx, dz);
      if (len < GAIT.jump) {
        const fwd = fl > 1e-6 ? (dx * fa.x + dz * fa.z) / fl : len;
        S.d += fwd < -0.5 * len ? -len : len;
        if (dt > 0) { const a = 1 - Math.exp(-dt / GAIT.tau); S.vx += (dx / dt - S.vx) * a; S.vz += (dz / dt - S.vz) * a; }
      }
    } else S.vx = S.vz = 0;
    S.x = x; S.z = z; S.t = now; S.on = 'drawn';
    v = Math.hypot(S.vx, S.vz);
  }
  S.v = v;
  const want = v > GAIT.still ? 1 : 0;
  S.k = S.k < 0 ? want : approach(S.k, want, Math.max(0, dt) / GAIT.fade);
  const ph = W.dir * S.d / stride;
  S.stride = stride;
  it.action.time = (ph - Math.floor(ph)) * it.dur;
  const ic = it.wIdleClip;
  if (ic && ic.duration > 0) { const t = r.start === 'shown' ? (now - it.shownAt) / 1000 : clockS, D = ic.duration; it.wIdle.time = ((t % D) + D) % D; }
  else it.wIdle.time = W.stand;
}
// its walk's and its standing's weights, under what a cube plays on it (w): a smooth crossfade between them
function gaitWeights(it, w) {
  const k = clamp(it.wk.k, 0, 1), e = k * k * (3 - 2 * k);
  it.action.setEffectiveWeight((1 - w) * e);
  it.wIdle.setEffectiveWeight((1 - w) * (1 - e));
}

// ------------------------------------------------------------------ the card --
// under its Animation rows, As it moves chosen: what it stands with, its stride (Shorter, Longer, As measured), how
function gaitBlocks(it, B, dis) {
  const r = it.rec;
  if (r.anim !== 'move') return;
  const cl = gaitIdles(it), has = !!r.idle && cl.includes(r.idle), W = it.gait && it.E && it.E.clips.some(c => c.name === r.clip) ? it.gait : null, k = r.strideK || 1;
  B.push({ label: 'Standing', row: [{ id: 'widle', label: (has ? r.idle : cl[0] || 'No other clip') + (cl.length > (has ? 1 : 0) ? ' ▸' : ''), act: 'i:walkIdle', v: 'next', on: has, dis: dis || !cl.length },
    { id: 'widle:still', label: 'Still', act: 'i:walkIdle', v: 'still', on: !has, dis }] });
  if (r.idle && !has) B.push({ p: `Its standing clip, ${r.idle}, is not in this model: it stands still.`, c: 'amber' });
  B.push({ label: W ? `Stride: ${metres(gaitStride(it, W))}` + (k !== 1 ? ` (${Math.round(k * 100)} % of what was measured)` : '') : 'Stride: measured once its model is in',
    row: [{ id: 'wstride:-', label: 'Shorter', act: 'i:stride', v: -1, dis: dis || k <= STRIDE_KS[0] }, { id: 'wstride:+', label: 'Longer', act: 'i:stride', v: 1, dis: dis || k >= STRIDE_KS[STRIDE_KS.length - 1] }]
      .concat(k !== 1 ? [{ id: 'wstride:0', label: 'As measured', act: 'i:stride', v: 'reset', dis }] : []) });
  const how = !W ? '' : W.how === 'root' ? ` Its clip walks forward by itself (its hips go ${metres(W.root * r.s)} a cycle): that is taken out while it plays, so it does not move twice.`
    : W.how === 'feet' ? ' The stride is measured from its clip: how fast the foot on the ground moves back under its hips.' : ' No hips and feet found in it: the stride is guessed from its height.';
  B.push({ p: 'As it moves: its clip follows the distance it covers, one cycle a stride (backwards plays it backwards); when it stops it stands, ' + (has ? `playing ${r.idle}.` : 'its walk held with its feet together.') + how + ' Its clip has no timeline here: its moves set where the clip is.', c: 'faint' });
}
Object.assign(ITEM_ACT, {
  // what it stands with: the next of its model's other clips, or Still (its walk held with its feet together)
  walkIdle: (it, v) => {
    if (it.kind !== 'o') return;
    if (v === 'still') { setRec(it.id, { idle: undefined }); return; }
    const cl = gaitIdles(it);
    if (cl.length) setRec(it.id, { idle: cl[(cl.indexOf(it.rec.idle) + 1) % cl.length] });
  },
  // its stride a step shorter or longer (a factor on what was measured, 50 % to 200 %), or as measured
  stride: (it, v) => {
    if (it.kind !== 'o') return;
    const k = v === 'reset' ? 1 : stepOf(STRIDE_KS, it.rec.strideK || 1, +v > 0 ? 1 : -1);
    setRec(it.id, { strideK: k === 1 ? undefined : k });
  },
});
// for tests (STUDIO.walk(id)): its walk here, null when it has none
function gaitState(id) {
  const it = STU.items.get(id), W = it && it.gait, S = it && it.wk;
  if (!W || !S || !it.action || it.rec.anim !== 'move') return null;
  return { how: W.how, measured: W.stride, stride: gaitStride(it, W), used: S.stride || 0, dir: W.dir, stand: W.stand, root: W.root, h: W.h, d: S.d, v: S.v, k: S.k, on: S.on,
    time: it.action.time, dur: it.dur, idle: it.wIdleClip ? it.wIdleClip.name : '', idleTime: it.wIdle ? it.wIdle.time : 0,
    w: it.action.getEffectiveWeight(), wIdle: it.wIdle ? it.wIdle.getEffectiveWeight() : 0, flat: W.clip !== it.E.clips.find(c => c.name === it.rec.clip) };
}
