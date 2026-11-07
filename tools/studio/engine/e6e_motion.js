// ================================================================ MOTIONS ==
// The owner, 6 November 2026: "Add little animations like spin and wobble etc for models?", then "animations do 1 and 2"
// (1: simple motions, this file; 2: a recorder of paths, to come; curves later). An object, a shape or an empty may have
// a motion in its record (tools/studio/SPEC.md, "Motions"): { kind, speed, amount, axis, start }, absent for none:
// - spin: turns about the axis through its middle (speed: turns a minute);
// - wobble: tilts by amount degrees away from the axis, the tilt going round it (wobbles a minute);
// - bob: up and down along the axis by amount metres (bobs a minute);
// - pulse: grows and shrinks about its middle by amount, a share of its size (pulses a minute; no axis);
// - orbit: goes round a circle of amount metres about where it stands, across the axis, keeping its own facing (turns a
//   minute);
// - sway: swings about the axis through its middle by amount degrees each way (swings a minute).
// The axes are the scene's: 'y' upright (the default), 'x' side to side, 'z' front to back. A negative speed goes the
// other way. start 'always' runs on the scene's clock (at a station the room's: everyone there sees the same moment of
// it); 'shown' from when it was last shown here (this device's own, as an animation started when shown).
//
// How an item is drawn is one pipeline (drawnPose), so what comes later builds on it:
//   1. its placed pose: its holder's place, turn and scale (its record, a glide from the room, a carry, the arrows); a
//      behaviour may give this part instead (POSE.base, e6g_behave.js: set only while the scene has a behaviour);
//   2. its recorded path (POSE.path, e6f_path.js; a sound may have one too), changing the pose it is given;
//   3. its motion (motionDelta), a change in the scene's frame about its middle.
// The holder keeps the placed pose (what every edit reads and writes, so the record never changes); what is drawn goes
// into its matrix (matrixAutoUpdate off while it moves), so everything under it comes along (the model, the pointer's
// unseen box, its labels, a sound following it or one of its bones); its cut-outs take the same change on their own
// placed poses (poseCut). It keeps moving while it is selected (the owner, 7 November 2026: "when selecting animations on
// the item motion tab they should also show on the item as a preview"; "to make placing easier add a pause motion button but
// i also want to be able to move moving/animated items to select their exact place"): it rests at its placed pose only while
// this device holds it (motionRests: a grip, its group carried, the page's arrows dragged on it or its group, the sticks, a
// sound or a cut-out on it carried, its path being recorded) and while Pause is on here (e6h_ghost.js); a see-through
// ghost shows where it is placed meanwhile, and the page's arrows stand on that ghost.
const MOTION_KINDS = ['spin', 'wobble', 'bob', 'pulse', 'orbit', 'sway'], MOTION_ITEMS = ['o', 'p', 'e'];
// each kind as it starts (speed and amount), its amount's unit, largest value and steps on the card, and its words
const MOTION = {
  spin: { speed: 6, amount: 0, unit: '', max: 0, steps: [0], word: 'Spin', does: 'spins', one: 'turn', many: 'turns' },
  wobble: { speed: 20, amount: 10, unit: 'deg', max: 60, steps: [2, 5, 10, 15, 20, 30, 45, 60], word: 'Wobble', does: 'wobbles', one: 'wobble', many: 'wobbles' },
  bob: { speed: 15, amount: 0.1, unit: 'm', max: 10, steps: [0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2], word: 'Bob', does: 'bobs', one: 'bob', many: 'bobs' },
  pulse: { speed: 30, amount: 0.1, unit: 'share', max: 0.9, steps: [0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5], word: 'Pulse', does: 'pulses', one: 'pulse', many: 'pulses' },
  orbit: { speed: 4, amount: 0.5, unit: 'm', max: 50, steps: [0.1, 0.25, 0.5, 1, 1.5, 2, 3, 5, 10], word: 'Orbit', does: 'orbits', one: 'turn', many: 'turns' },
  sway: { speed: 15, amount: 15, unit: 'deg', max: 90, steps: [5, 10, 15, 20, 30, 45, 60, 90], word: 'Sway', does: 'sways', one: 'swing', many: 'swings' },
};
const MOTION_SPEEDS = [0.5, 1, 2, 3, 4, 6, 8, 10, 15, 20, 30, 45, 60, 90, 120];
// a motion as a record keeps it (null: bad). Its kind is required; the rest take the kind's own when left out. The
// speed's size 0.1 to 600 a minute to 2 decimals, its sign kept; the amount 0 to the kind's largest (degrees to 0.1, metres
// to the mm, a share to 2 decimals; a spin's is 0)
function normMotion(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || !MOTION_KINDS.includes(x.kind)) return null;
  const D = MOTION[x.kind], has = k => x[k] !== undefined;
  if ((has('speed') && !fin(x.speed)) || (has('amount') && !fin(x.amount))) return null;
  const axis = !has('axis') ? 'y' : ['x', 'y', 'z'].includes(x.axis) ? x.axis : null, start = !has('start') ? 'always' : ['always', 'shown'].includes(x.start) ? x.start : null;
  if (!axis || !start) return null;
  const v = has('speed') ? x.speed : D.speed, a = has('amount') ? x.amount : D.amount;
  const rd = D.unit === 'deg' ? n => Math.round(n * 10) / 10 : D.unit === 'm' ? r3 : r2;
  return { kind: x.kind, speed: (v < 0 ? -1 : 1) * clamp(r2(Math.abs(v)), 0.1, 600), amount: nz(clamp(rd(a), 0, D.max)), axis, start };
}

// ----------------------------------------------------------- the pipeline --
// later stages: a behaviour that gives the placed part (e6g_behave.js), a recorded path that changes it (e6f_path.js) (each
// (it, now, clockS, m) -> m changed, base returning false when it gives nothing for this item)
const POSE = { base: null, path: null };
const MAXIS = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, MCROSS = { x: [0, 1, 0], y: [0, 0, 1], z: [1, 0, 0] };   // (each axis, and the way across it a wobble tilts and an orbit starts)
const D2R_M = Math.PI / 180;
const _ma = new THREE.Vector3(), _mu = new THREE.Vector3(), _mmid = new THREE.Vector3(), _mx = new THREE.Matrix4(), _mt = new THREE.Matrix4(), _mD = new THREE.Matrix4(), _mP = new THREE.Matrix4(), _mS = new THREE.Vector3();
// an item's middle in the scene's frame, for its pose m: an object's own box's middle (its unseen box: its model's), the
// others' holders stand at theirs
function motionMiddle(it, m, out) {
  if (it.kind === 'o' && it.model) return out.copy(it.proxy.position).applyMatrix4(m);
  return out.setFromMatrixPosition(m);
}
// its motion's moment (s): 'always' the scene's clock, 'shown' since it was last shown here
const motionTime = (it, m, now, clockS) => (m.start === 'shown' ? Math.max(0, (now - (it.shownAt != null ? it.shownAt : now)) / 1000) : clockS);   // (never shown yet: its start)
// its motion at time t as a change in the scene's frame (into out), for its pose m before it
function motionDelta(it, mo, t, m, out) {
  const c = (mo.speed / 60) * t, ph = 2 * Math.PI * (c - Math.floor(c)), s = Math.sin(ph), A = _ma.fromArray(MAXIS[mo.axis]), u = _mu.fromArray(MCROSS[mo.axis]);
  const M = motionMiddle(it, m, _mmid);
  // (a change X about the middle: T(M) X T(-M))
  const about = X => out.makeTranslation(M.x, M.y, M.z).multiply(X).multiply(_mt.makeTranslation(-M.x, -M.y, -M.z));
  if (mo.kind === 'spin') return about(_mx.makeRotationAxis(A, ph));
  if (mo.kind === 'sway') return about(_mx.makeRotationAxis(A, mo.amount * D2R_M * s));
  if (mo.kind === 'wobble') return about(_mx.makeRotationAxis(u.applyAxisAngle(A, ph), mo.amount * D2R_M));
  if (mo.kind === 'pulse') { const k = 1 + mo.amount * s; return about(_mx.makeScale(k, k, k)); }
  if (mo.kind === 'bob') return out.makeTranslation(A.x * mo.amount * s, A.y * mo.amount * s, A.z * mo.amount * s);
  u.applyAxisAngle(A, ph).multiplyScalar(mo.amount);   // orbit: round its place, its facing kept
  return out.makeTranslation(u.x, u.y, u.z);
}
// whether it rests at its placed pose now: Pause on here (e6h_ghost.js), or held here (restScan's list, made once a frame:
// carried by a grip or the sticks, dragged by the page's arrows, its path being recorded, or what is on it or holds it
// carried: a sound or a cut-out on it, its group, a group holding a sound on it, so what is placed on it is measured where
// it is placed)
const REST = { ids: new Set() };
function motionRests(it) { return motionsPaused() || REST.ids.has(it.id); }
function restScan() {
  const S = REST.ids;
  S.clear();
  for (const x of STU.items.values()) {
    if (!x.carry && !recording(x)) continue;
    S.add(x.id);
    if ((x.kind === 's' || x.kind === 'x') && x.rec.on) S.add(x.rec.on);
    if (x.kind === 'g') for (const m of members(x)) { S.add(m.id); if (m.kind === 's' && m.rec.on) S.add(m.rec.on); }
  }
}
// a measure taken where items are placed while they move (fn, then each drawn where it was again): each moving holder put
// at its placed pose meanwhile (its children, an object's bones and unseen box, with it), so a group's pivot and box stay
// put while its members move
function atPlaced(list, fn) {
  const kept = [];
  for (const it of list) {
    const H = it && it.holder;
    if (!H || H.matrixAutoUpdate) continue;
    kept.push([H, H.matrix.clone()]);
    H.matrix.compose(H.position, H.quaternion, H.scale); H.matrixWorldNeedsUpdate = true;
  }
  try { return fn(); } finally { for (const [H, m] of kept) { H.matrix.copy(m); H.matrixWorldNeedsUpdate = true; } }
}
// the pipeline: its drawn pose at now (the scene's clock clockS, s) into out, in the items' frame (the scene's)
function drawnPose(it, now, clockS, out) {
  const H = it.holder, rest = motionRests(it);
  if (rest || !(POSE.base && POSE.base(it, now, clockS, out))) out.compose(H.position, H.quaternion, H.scale);
  if (rest) return out;
  if (POSE.path) POSE.path(it, now, clockS, out);
  if (it.pre) it.pre.copy(out);   // (where it is before its motion: what an item following it follows, e6g_behave.js)
  const mo = it.rec && it.rec.motion;
  if (mo) out.premultiply(motionDelta(it, mo, motionTime(it, mo, now, clockS), out, _mD));
  return out;
}
// how much bigger its motion draws it now (a pulse), for an object's followers' offsets (followAt): 1 at rest
const motionK = it => (it && it.mX ? Math.cbrt(Math.abs(it.mX.determinant())) : 1);
// (drawn by the pipeline: an object, a shape or an empty with a motion, or anything with a recorded path that plays here)
const poseLive = it => !!it.rec && ((MOTION_ITEMS.includes(it.kind) && !!(it.rec.motion || POSE.base)) || !!(POSE.path && pathOf(it)));
// back to its placed pose at once (resting, a grab, a measure taken where it stands), and its cut-outs
function poseRest(it) {
  const rest = H => { if (!H.matrixAutoUpdate) { H.matrixAutoUpdate = true; H.updateMatrix(); H.matrixWorldNeedsUpdate = true; } };
  rest(it.holder);
  if (it.kind === 'o') for (const x of cutsOn(it.id)) rest(x.holder);
  it.mX = null;
}
// every frame (itemsStep, once its placed pose is this frame's): drawn as the pipeline says, or at rest; it.mX the change
// from its placed pose to its drawn one, for its cut-outs
function poseStep(it, now, clockS) {
  if (!poseLive(it) || motionRests(it)) { if (it.mX || !it.holder.matrixAutoUpdate) poseRest(it); return; }
  const H = it.holder;
  drawnPose(it, now, clockS, H.matrix);
  H.matrixAutoUpdate = false; H.matrixWorldNeedsUpdate = true;
  it.mX = (it.mX || new THREE.Matrix4()).compose(H.position, H.quaternion, H.scale).invert().premultiply(H.matrix);
}
// a cut-out takes its object's change on its own placed pose (cutPlace, once that is this frame's)
function poseCut(x, ob) {
  const H = x.holder, X = ob && ob.mX;
  if (!X) { if (!H.matrixAutoUpdate) { H.matrixAutoUpdate = true; H.updateMatrix(); H.matrixWorldNeedsUpdate = true; } return; }
  H.matrix.compose(H.position, H.quaternion, H.scale).premultiply(X);
  H.matrixAutoUpdate = false; H.matrixWorldNeedsUpdate = true;
}
// what follows a holder that is not its own (a shape's or a cut-out's name and corners while editing): where it is drawn
function decoAt(H, deco) {
  if (H.matrixAutoUpdate) { deco.position.copy(H.position); deco.quaternion.copy(H.quaternion); }
  else H.matrix.decompose(deco.position, deco.quaternion, _mS);
}

// ------------------------------------------------------------- the card --
// a value one step up or down a list (the next step past it)
function stepOf(S, v, d) {
  const x = d > 0 ? S.find(w => w > v + 1e-9) : [...S].reverse().find(w => w < v - 1e-9);
  return x !== undefined ? x : d > 0 ? S[S.length - 1] : S[0];
}
const motionSpeedWords = m => { const a = Math.abs(m.speed), D = MOTION[m.kind]; return `${a} ${a === 1 ? D.one : D.many} a minute` + (m.speed < 0 ? ', the other way' : ''); };
const motionAmountWords = m => { const D = MOTION[m.kind]; return D.unit === 'deg' ? m.amount + '°' : D.unit === 'm' ? (m.amount < 1 ? Math.round(m.amount * 1000) / 10 + ' cm' : metres(m.amount)) : Math.round(m.amount * 100) + ' %'; };
// the Motion rows (an object's, a shape's and an empty's card, page and headset alike)
function motionBlocks(it, B, dis) {
  const m = it.rec.motion;
  B.push({ label: 'Motion', row: [{ id: 'motion:none', label: 'None', act: 'i:motion', v: 'none', on: !m, dis }].concat(MOTION_KINDS.map(k => ({ id: 'motion:' + k, label: MOTION[k].word, act: 'i:motion', v: k, on: !!m && m.kind === k, dis }))) });
  if (!m) { B.push({ p: 'A little motion drawn over where it stands (its place is not changed): Spin, Wobble, Bob, Pulse, Orbit or Sway.', c: 'faint' }); return; }
  B.push({ label: 'Speed: ' + motionSpeedWords(m), row: [{ id: 'mspeed:-', label: 'Slower', act: 'i:mspeed', v: -1, dis }, { id: 'mspeed:+', label: 'Faster', act: 'i:mspeed', v: 1, dis }]
    .concat(m.kind === 'spin' || m.kind === 'orbit' ? [{ id: 'mrev', label: 'The other way', act: 'i:mrev', dis }] : []) });
  if (m.kind !== 'spin') B.push({ label: (m.kind === 'pulse' ? 'By' : m.kind === 'orbit' ? 'Round a circle of' : 'How far') + ': ' + motionAmountWords(m), row: [{ id: 'mamount:-', label: 'Less', act: 'i:mamount', v: -1, dis }, { id: 'mamount:+', label: 'More', act: 'i:mamount', v: 1, dis }] });
  if (m.kind !== 'pulse') B.push({ label: 'Axis', row: [['y', 'Upright (y)'], ['x', 'Side to side (x)'], ['z', 'Front to back (z)']].map(([v, n]) => ({ id: 'maxis:' + v, label: n, act: 'i:maxis', v, on: m.axis === v, dis })) });
  B.push({ label: 'Starts', row: [{ id: 'mstart:always', label: 'Always', act: 'i:mstart', v: 'always', on: m.start === 'always', dis }, { id: 'mstart:shown', label: 'When shown', act: 'i:mstart', v: 'shown', on: m.start === 'shown', dis }] },
    { p: 'Drawn over where it stands: its place is not changed. Always: in step for everyone at a circle. When shown: from when a cube shows it to you. It keeps moving while selected, a ghost where it is placed; carried, it rests there, so it can be placed (Pause stands everything still).', c: 'faint' });
}
// the card's actions (one Undo step each): a kind (its own speed and amount, the axis and start kept; None takes it
// away), its speed and amount a step up or down, the other way, its axis, when it starts
const motionSet = (it, fn) => { const m = it.rec.motion; if (m && MOTION_ITEMS.includes(it.kind)) setRec(it.id, { motion: Object.assign({}, m, fn(m)) }); };
Object.assign(ITEM_ACT, {
  motion: (it, v) => {
    if (!MOTION_ITEMS.includes(it.kind)) return;
    const m = it.rec.motion, D = MOTION[v];
    if (!D) { setRec(it.id, { motion: undefined }); return; }
    if (m && m.kind === v) return;
    setRec(it.id, { motion: { kind: v, speed: D.speed, amount: D.amount, axis: m ? m.axis : 'y', start: m ? m.start : 'always' } });
  },
  mspeed: (it, d) => motionSet(it, m => ({ speed: (m.speed < 0 ? -1 : 1) * stepOf(MOTION_SPEEDS, Math.abs(m.speed), +d) })),
  mrev: it => motionSet(it, m => ({ speed: -m.speed })),
  mamount: (it, d) => motionSet(it, m => ({ amount: stepOf(MOTION[m.kind].steps, m.amount, +d) })),
  maxis: (it, v) => motionSet(it, () => ({ axis: v })),
  mstart: (it, v) => motionSet(it, () => ({ start: v })),
});
