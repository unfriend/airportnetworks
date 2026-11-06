// ========================================================== SHAPES, EMPTIES, LOCKS, THE SCENE'S SETTINGS ==
// The owner, 6 November 2026 (tools/studio/SPEC.md, "Shapes and empties", "Locked in place", "The scene's settings"):
// "Needs invisible occlusion cubes and other primitives to hide things and just in general"; "Needs empty objects for
// example to place sounds in space"; "There should be an option to lock things in space so we cannot accidentally move
// them"; "there should be an option to hide all other icons and circles in studio mode" (a setting saved with each scene,
// for everyone at that studio's circle); and real-world occlusion, on by default for every headset in AR (the shell's,
// HOST.occlusion), which a scene may set to always or never.

// ---------------------------------------------------------------- shapes --
// A shape (kind p): { name, shape, p, q, size, colour, look, locked? }: a cube, a ball, a cylinder or a plane (upright,
// facing +z), a full turn, its size per axis, in its colour (lit, as an object), or hiding what stands behind it: drawn
// into the depth alone, so the scene's own things behind it are not drawn there (in AR the real room shows through it; in
// VR the stage), seen only as a see-through fill and its edges while editing. It moves, turns and sizes as the others do
// (the page's arrows, the grips, both grips; a cube's corners stretch it per axis), and a cube can show or hide it, a
// group hold it and a sound follow it
const SHAPE_NAME = { cube: 'Box', sphere: 'Ball', cylinder: 'Cylinder', plane: 'Plane' };
const SHAPE_WORD = { cube: 'Cube', sphere: 'Sphere', cylinder: 'Cylinder', plane: 'Plane' };
// the colours on its card (lower case, as a record keeps them)
const SHAPE_COLS = [['#c9d1dc', 'Light grey'], ['#ffffff', 'White'], ['#5c6878', 'Dark grey'], ['#1b2230', 'Black'], ['#46d9ff', 'Cyan'], ['#3ee08f', 'Green'], ['#ffb43b', 'Amber'], ['#ff5a4b', 'Red'], ['#c08cff', 'Violet'], ['#8a5a3c', 'Brown']];
function addShape(kind) {
  if (!canAdd('p') || !SHAPE_KINDS.includes(kind)) return '';
  const at = frontAt(), id = newId(), sz = SHAPE_SIZE[kind];
  change(() => putItem(id, 'p', norm('p', { name: nameFor(SHAPE_NAME[kind]), shape: kind, p: [at[0], sz[1] / 2, at[1]], size: sz })));
  select(id);
  sfxAct('place', 'world', null);
  return id;
}
// its box in the scene's frame: as shown now (its holder: carried, gliding), or as its record puts it (rec), each exact
// for its shape (a ball's and a cylinder's extents as turned, a plane with no thickness)
const _sh4 = new THREE.Matrix4(), _shq = new THREE.Quaternion(), _shp = new THREE.Vector3(), _shs = new THREE.Vector3();
function shapeBox(it, out, rec) {
  const r = it.rec;
  if (rec) _sh4.compose(_shp.fromArray(r.p), _shq.fromArray(r.q), _shs.fromArray(r.size));
  else { GL.items.updateWorldMatrix(true, false); it.holder.updateWorldMatrix(true, false); _sh4.copy(GL.items.matrixWorld).invert().multiply(it.holder.matrixWorld); }
  const e = _sh4.elements, k = r.shape, h = [0, 1, 2].map(j => {
    const a = e[j], b = e[4 + j], d = e[8 + j];
    return 0.5 * (k === 'sphere' ? Math.hypot(a, b, d) : k === 'cylinder' ? Math.abs(b) + Math.hypot(a, d) : k === 'plane' ? Math.abs(a) + Math.abs(b) : Math.abs(a) + Math.abs(b) + Math.abs(d));
  });
  out.min.set(e[12] - h[0], e[13] - h[1], e[14] - h[2]); out.max.set(e[12] + h[0], e[13] + h[1], e[14] + h[2]);
  return out;
}
// every frame: its fade (a colour fades; one that hides things switches at one half), and while editing its fill, edges,
// name and (a cube, selected) corners
const _shb = new THREE.Box3(), _shi = new THREE.Quaternion();
function shapeStep(it, editing) {
  const L = it.look, H = it.holder;
  H.visible = it.a > 0.002 || editing;
  L.look({ a: it.a, editing, hot: editing && STU.hover === it.id, selected: editing && STU.sel === it.id, hotCorner: STU.hotCorner && STU.hotCorner.id === it.id ? STU.hotCorner.k : -1 });
  L.deco.visible = editing && H.visible;
  if (!L.deco.visible) return;
  decoAt(H, L.deco);   // (where it is drawn: a motion; e6e_motion.js)
  const sz = H.scale, b = shapeBox(it, _shb);
  L.name.position.set(0, b.max.y - L.deco.position.y + 0.04, 0).applyQuaternion(_shi.copy(L.deco.quaternion).invert());   // (over it, whichever way it is turned)
  L.corners.forEach((c, k) => c.position.set((k & 1 ? 0.5 : -0.5) * sz.x, (k & 2 ? 0.5 : -0.5) * sz.y, (k & 4 ? 0.5 : -0.5) * sz.z));
}

// ---------------------------------------------------------------- empties --
// An empty (kind e): { name, p, q, locked? }: a point with a turn, seen only while editing (a small axis cross and its
// name), to place sounds at (a sound follows it as it follows an object: on, its id), to move with a group, to be shown
// or hidden by a cube (a sound following it is heard only while it is shown for you)
function addEmpty() {
  if (!canAdd('e')) return '';
  const at = frontAt(), id = newId();
  change(() => putItem(id, 'e', norm('e', { name: nameFor('Empty'), p: [at[0], 1.2, at[1]] })));
  select(id);
  sfxAct('place', 'world', null);
  return id;
}
// the sounds that follow an item
const followersOf = id => [...STU.items.values()].filter(f => f.kind === 's' && f.rec.on === id);

// ----------------------------------------------------------- locked in place --
// Any item's record (an object, a cube, a sound, a cut-out, a shape, an empty) and a group's may say locked: true. A
// locked item does not move, turn, size or go, whichever way is tried: the page's arrows (not attached), the grips, both
// grips, a corner, its card's buttons, the Delete key, Hold it; a group's member is held by its group's lock too, and a
// group by its own and by any member's (it does not move, and says which). Deleting an object is refused while one of its
// cut-outs is locked. Lock and Unlock on its card, one Undo step, shared and saved like the rest of its record. A copy is
// never locked. What the room or Undo writes is never refused (the room's record wins, and Undo takes back what was done)
const tagName = r => (r.locked ? '🔒 ' : '') + r.name;
// what holds it: its own lock, its group's, a group's members', and for deleting an object (or a group's) its cut-outs'
function lockNames(it, del) {
  const L = [];
  if (!it) return L;
  const add = x => { if (x && x.rec.locked && !L.includes(x.rec.name)) L.push(x.rec.name); };
  add(it);
  if (GROUP_KINDS.includes(it.kind)) add(groupOf(it.id));
  const ms = it.kind === 'g' ? members(it) : [it];
  if (it.kind === 'g') ms.forEach(add);
  if (del) for (const m of ms) if (m.kind === 'o') cutsOn(m.id).forEach(add);
  return L;
}
const lockWhy = (it, del) => lockNames(it, del).join(', ');
// the card's actions a lock refuses (Ungroup only the group's own lock: its members keep theirs)
const MOVE_ACTS = ['turn', 'stand', 'floor', 'size', 'grow', 'cgrow', 'csize', 'pgrow', 'psize', 'onto', 'cutOn', 'cutPick', 'hold'];
const lockStops = (it, act) => (act === 'del' ? !!lockWhy(it, true) : act === 'ungroup' ? !!(it.kind === 'g' && it.rec.locked) : MOVE_ACTS.includes(act) && !!lockWhy(it));
// a refusal: said on its card for a moment, and a knock
function lockRefused(it) {
  STU.lockSaid = { id: it.id, at: performance.now() };
  sfxAct('knock', 'world', null, { gain: 0.5 });
  later(() => dirty(true), 4100);
  dirty(true);
}
// the line on its card ('' none): what holds it, in words
function lockLine(it) {
  const mine = !!it.rec.locked, are = n => (n.length > 1 ? 'are' : 'is'), them = n => (n.length > 1 ? 'they are' : 'that is');
  const ms = it.kind === 'g' ? members(it) : [it], cuts = ms.filter(m => m.kind === 'o').flatMap(m => cutsOn(m.id)).filter(x => x.rec.locked).map(x => x.rec.name);
  if (it.kind === 'g') {
    const lm = ms.filter(m => m.rec.locked).map(m => m.rec.name);
    if (mine) return 'Locked in place: the group does not move, turn, size or go until it is unlocked.' + (lm.length ? ` ${lm.join(', ')} ${are(lm)} locked too.` : '');
    if (lm.length) return `${lm.join(', ')} ${are(lm)} locked in place: the group does not move, turn, size or go until ${them(lm)} unlocked.`;
    return cuts.length ? `${cuts.join(', ')} ${are(cuts)} locked in place: the group cannot be deleted until ${them(cuts)} unlocked.` : '';
  }
  if (mine) return 'Locked in place: it does not move, turn, size or go until it is unlocked.';
  const g = GROUP_KINDS.includes(it.kind) ? groupOf(it.id) : null;
  if (g && g.rec.locked) return `Its group ${g.rec.name} is locked in place: it does not move, turn, size or go until the group is unlocked.`;
  return cuts.length ? `${cuts.join(', ')} ${are(cuts)} locked in place: it cannot be deleted until ${them(cuts)} unlocked.` : '';
}
// the lock's row on a card (near its Duplicate and Delete, so a headset's card keeps its place and size in sight): Lock in
// place / Unlock; and at its top, only while something holds it (or a refusal was just made), what holds it
function lockBlocks(it, B, dis) {
  const on = !!it.rec.locked;
  B.push({ label: 'Lock', row: [{ id: 'lock', label: on ? '🔒 Unlock' : 'Lock in place', act: 'i:lock', on, dis }] });
  if (!on) B.push({ page: true, p: 'Locked in place, it cannot be moved, turned, sized or deleted by accident (for everyone, and saved).', c: 'faint' });
}
function lockTop(it) {
  const line = lockLine(it), said = STU.lockSaid && STU.lockSaid.id === it.id && performance.now() - STU.lockSaid.at < 4000;
  return line ? [{ p: (said ? 'Refused: ' : '') + line, c: said ? 'red' : 'amber' }] : [];
}

// ---------------------------------------------------------- the card's actions --
Object.assign(ITEM_ACT, {
  lock: it => { setRec(it.id, { locked: it.rec.locked ? undefined : true }); tcAttach(); },   // (locked: the page's arrows go at once)
  // a shape: its kind (its size kept), its colour and its look
  shape: (it, v) => { if (it.kind === 'p' && SHAPE_KINDS.includes(v)) setRec(it.id, { shape: v }); },
  colour: (it, v) => { if (it.kind === 'p' && /^#[0-9a-f]{6}$/.test(v)) setRec(it.id, { colour: v }); },
  look: (it, v) => { if (it.kind === 'p' && (v === 'colour' || v === 'hide')) setRec(it.id, { look: v }); },
  // a shape's size: 10 cm more or less on one side (a cube's foot stays on its height), or every side by a factor (its
  // middle stays)
  pgrow: (it, v) => {
    const [ax, d] = String(v).split(':'), i = +ax;
    if (it.kind !== 'p' || !(i >= 0 && i < 3)) return;
    const size = it.rec.size.slice();
    size[i] = clamp(r3(size[i] + +d), 0.01, 100);
    setRec(it.id, { size });
  },
  psize: (it, k) => { if (it.kind === 'p' && +k > 0) setRec(it.id, { size: it.rec.size.map(v => clamp(v * k, 0.01, 100)) }); },
});

// ------------------------------------------------------- the scene's settings --
// Saved with the scene (layout.json's settings) and, at a station, in the state for everyone at that studio's circle:
// - others: 'shown' | 'hidden': hidden, while this device is at this studio's circle the shell draws no other circle's
//   ring, card or icon (HOST.collab.hideOthers(true); false again away from it, for another scene, on dispose)
// - real: 'device' | 'always' | 'never': whether the real room hides the scene in AR (the shell's real-world occlusion,
//   on by default for every headset): as each headset has it (HOST.occlusion.scene(null)), always ('both') or never
//   ('off'), while this scene shows here (null again otherwise, on dispose)
const SETTINGS0 = { others: 'shown', real: 'device' };
function normSettings(x) {
  if (x === undefined || x === null) return Object.assign({}, SETTINGS0);
  if (typeof x !== 'object' || Array.isArray(x)) return null;
  const one = (k, list) => (x[k] === undefined ? SETTINGS0[k] : list.includes(x[k]) ? x[k] : null);
  const r = { others: one('others', ['shown', 'hidden']), real: one('real', ['device', 'always', 'never']) };
  return Object.values(r).includes(null) ? null : r;
}
function putSettings(S) {
  if (!S || JSON.stringify(S) === JSON.stringify(STU.settings)) return;
  STU.settings = S; STU.rev++;
}
// a row pressed: 'others:hidden', 'real:always'... (one change: Undo takes it back; for everyone at a station)
function setSetting(v) {
  if (!editOn()) return;
  const i = String(v).indexOf(':'), S = i > 0 ? normSettings(Object.assign({}, STU.settings, { [String(v).slice(0, i)]: String(v).slice(i + 1) })) : null;
  if (!S || JSON.stringify(S) === JSON.stringify(STU.settings)) return;
  change(() => putSettings(S), [SET_ID]);
  sfxAct('click', 'world', null);
}
function settingsBlocks(B, st) {
  const S = STU.settings, who = st ? ' (for everyone at this circle)' : '';
  B.push({ label: 'Other circles' + who, row: [['shown', 'Shown'], ['hidden', 'Hidden']].map(([v, n]) => ({ id: 'set:others:' + v, label: n, act: 'setting', v: 'others:' + v, on: S.others === v })) },
    { p: 'Hidden: in a shared room, while you are at this studio\'s circle the other circles\' rings, cards and icons are not shown. Saved with the scene.', c: 'faint' },
    { label: 'Real world hides the scene' + who, row: [['device', 'As each headset has it'], ['always', 'Always'], ['never', 'Never']].map(([v, n]) => ({ id: 'set:real:' + v, label: n, act: 'setting', v: 'real:' + v, on: S.real === v })) },
    { p: 'In AR, whether real things (walls, furniture, people) hide the scene behind them. Saved with the scene.', c: 'faint' });
}
// the shell told what the scene wants, each time that changes (guarded: an older shell has neither hook)
const HOOK = { hide: false, occ: null };
const OCC = { device: null, always: 'both', never: 'off' };
function hookCall(k, v) {
  try {
    if (k === 'hide') { if (HOST.collab && HOST.collab.hideOthers) HOST.collab.hideOthers(v); }
    else if (HOST.occlusion && HOST.occlusion.scene) HOST.occlusion.scene(v);
  } catch (e) { /* an older shell */ }
}
function settingsStep() {
  const here = !!STU.scene && !GL.gone && !xrAway() && !XR.stories && !HOST.picking;
  // (hide: the station's id, so a walk into another studio circle asks again: the shell lets it lapse when the station changes)
  const hide = here && atStation() && STU.settings.others === 'hidden' ? stationId() || true : false, occ = here ? OCC[STU.settings.real] : null;
  if (hide !== HOOK.hide) { HOOK.hide = hide; hookCall('hide', !!hide); }
  if (occ !== HOOK.occ) { HOOK.occ = occ; hookCall('occ', occ); }
}
function hooksOff() { HOOK.hide = false; HOOK.occ = null; hookCall('hide', false); hookCall('occ', null); }

// -------------------------------------------------------------- the lobby --
// Walking into the room's Back to the lobby circle (the shell calls HOST.cur.lobby(), where the headsets charge): this
// device forgets what it has seen, as Reset what I have seen does, and more: the cubes that stay once entered, and
// everything that starts when shown (animations, sounds) or once (a sound that does not loop) starts from its beginning
// the next time it is shown. This device only: nothing is written to the room
function studioLobby() {
  resetSeen();
  STU.t0 = performance.now();
  for (const it of STU.items.values()) {
    it.first = true; it.ended = false; it.heard = false;
    if (it.kind === 's') emitStop(it);
  }
  STU.lobbyAt = Date.now();
  dirty(true);
}
