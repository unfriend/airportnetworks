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
// every frame: its fade (a colour fades, not editing; one that hides things switches at one half), and while editing its
// edges (all that shows of one that hides things, or of one a cube hides from you: it.hid, itemsStep), its tag (its name,
// its triangles, "· hides things", "· hidden"; its words built only when its record or what hides it changes) and (a
// cube, selected) corners
const _shb = new THREE.Box3(), _shi = new THREE.Quaternion();
function shapeStep(it, editing) {
  const L = it.look, H = it.holder, r = it.rec;
  H.visible = it.a > 0.002 || editing;
  L.look({ a: it.a, hid: it.hid, editing, hot: editing && STU.hover === it.id, selected: editing && STU.sel === it.id, hotCorner: STU.hotCorner && STU.hotCorner.id === it.id ? STU.hotCorner.k : -1 });
  L.deco.visible = editing && H.visible;
  if (!L.deco.visible) return;
  const h = it.shown ? '' : hidWord(it);   // (" · hidden", or " · AR only" / " · VR only": v137)
  if (it.tagR !== r || it.tagH !== h) { it.tagR = r; it.tagH = h; L.name.userData.set(tagName(r) + triWords(L.tris()) + (r.look === 'hide' ? ' · hides things' : '') + h, L.col, 0.075); }
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
  if (del) for (const m of ms) if (m.kind === 'o') { cutsOn(m.id).forEach(add); if (m.rec.cutsLocked && cutsOn(m.id).length && !L.includes(m.rec.name + ' (its cut-outs)')) L.push(m.rec.name + ' (its cut-outs)'); }
  if (it.kind === 'x') { const ob = cutObj(it); if (ob && ob.rec.cutsLocked && !L.includes(ob.rec.name + ' (its cut-outs)')) L.push(ob.rec.name + ' (its cut-outs)'); }
  return L;
}
const lockWhy = (it, del) => lockNames(it, del).join(', ');
// the card's actions a lock refuses (Ungroup only the group's own lock: its members keep theirs)
// (recording a path carries it: refused too; how a path plays is not refused, as a motion is not: its place stays)
const MOVE_ACTS = ['turn', 'stand', 'floor', 'size', 'grow', 'cgrow', 'csize', 'pgrow', 'psize', 'onto', 'cutOn', 'cutPick', 'hold', 'rec', 'recArm'];
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
  if (it.kind === 'x' && cutsHid(it)) return `${cutObj(it).rec.name}'s cut-outs are locked: it does not move, size or go until they are unlocked on ${cutObj(it).rec.name}'s card.`;
  if (it.kind === 'o' && it.rec.cutsLocked && cutsOn(it.id).length && !cuts.length) return 'Its cut-outs are locked: it cannot be deleted until they are unlocked.';
  const g = GROUP_KINDS.includes(it.kind) ? groupOf(it.id) : null;
  if (g && g.rec.locked) return `Its group ${g.rec.name} is locked in place: it does not move, turn, size or go until the group is unlocked.`;
  return cuts.length ? `${cuts.join(', ')} ${are(cuts)} locked in place: it cannot be deleted until ${them(cuts)} unlocked.` : '';
}
// the lock's row on a card: Lock in place / Unlock, at the card's top right under its heading (v128; the owner, 9 November
// 2026: "move the locked toggle all the way to the top"; until then by its Duplicate and Delete), with what holds it just
// above it (lockTop, only while something holds it or a refusal was just made); the blocks, for the card to put there
function lockBlocks(it, dis) {
  const on = !!it.rec.locked;
  return [{ label: 'Lock', row: [{ id: 'lock', label: on ? '🔒 Unlock' : 'Lock in place', act: 'i:lock', on, dis }] }]
    .concat(on ? [] : [{ page: true, p: 'Locked in place, it cannot be moved, turned, sized or deleted by accident (for everyone, and saved).', c: 'faint' }]);
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

// -------------------------------------------------- the scene moved to its circle --
// Since v125 a scene at a station stands on the room's frame (the floor at y = 0, the origin and axes the room's: on a
// room calibrated on its floor spots spot A, x towards spot B; xrPlace in e8_xr.js): its circle is only the way in, and
// moving or turning the circle moves nothing of it. A layout made before v125 was placed round its circle (the scene's
// origin at the circle's spot, facing its way). Move the scene to this circle (the Scene pane while editing at a studio
// station in a room, page and headset alike) puts it back there: every item's placed pose taken through this circle's
// spot (x' = spot + its turn x): the objects', shapes' and empties' places and turns, the cubes' places and yaws, the
// sounds' places (one following something keeps its offset on it; its own place is where it stands when what it follows
// is not there) and a sound's own recorded path (its keys are in the scene's axes: turned with it). Nothing in an
// item's own frame changes (cut-outs, offsets, the others' paths, motions, behaviours). One change (one Undo step),
// every record written, for everyone at the circle and saved as any change. Refused while the scene is locked (Lock
// this story: not offered then, editing being off) or while an item is locked in place (it says which)
const CIRC = { note: '', c: '', at: 0, sc: '' };
const CIRC_KINDS = ['o', 'p', 'e', 'c', 's'];
// what the last press came to, on the Scene pane for 12 s (for that scene only)
function circleSay(note, c) {
  Object.assign(CIRC, { note, c, at: performance.now(), sc: STU.scene });
  later(() => { if (CIRC.note && performance.now() - CIRC.at >= 11900) { CIRC.note = ''; dirty(true); } }, 12000);
}
// this circle's spot as the room has it ({ x, z, yaw }), or null: not at a studio station
function circleSpot() {
  try {
    const st = HOST.collab && HOST.collab.live && HOST.collab.live();
    return st && st.story === XR_HERE && fin(st.x) && fin(st.z) ? { x: st.x, z: st.z, yaw: fin(st.yaw) ? st.yaw : 0 } : null;
  } catch (e) { return null; }
}
// (a sound's own recorded path kept as a file, its keys in the scene's axes: turned into a new file first, sceneToCircleFiles;
// one that cannot be refuses the move, nothing changed)
function sceneToCircle() {
  CIRC.note = ''; CIRC.c = '';
  const S = circleCan();
  if (!S) return false;
  const files = Math.abs(S.yaw) > 1e-6 ? [...STU.items.values()].filter(it => it.kind === 's' && it.rec.path && it.rec.path.src) : [];
  if (files.length) { circleSay('Moving: the recorded paths kept as files are turned first...', 'muted'); sceneToCircleFiles(S, files); return true; }
  return circleMove(S, null);
}
// the spot, or null (said why)
function circleCan() {
  const S = atStation() && editOn() ? circleSpot() : null;
  if (!S) return null;
  const its = [...STU.items.values()].filter(it => CIRC_KINDS.includes(it.kind));
  if (!its.length) { circleSay('Nothing is placed here yet.', 'muted'); return null; }
  const held = [];
  for (const it of its) for (const n of lockNames(it)) if (!held.includes(n)) held.push(n);
  if (held.length) {
    circleSay(`Refused: ${held.join(', ')} ${held.length > 1 ? 'are' : 'is'} locked in place: the scene does not move until ${held.length > 1 ? 'they are' : 'that is'} unlocked.`, 'red');
    sfxAct('knock', 'world', null, { gain: 0.5 });
    return null;
  }
  return S;
}
async function sceneToCircleFiles(S, files) {
  const gen = STU.gen, r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), S.yaw).toArray(), pm = new Map();
  for (const it of files) {
    try { pm.set(it.id, { src: it.rec.path.src, path: await pathFileTurned(it, it.rec.path, r) }); } catch (e) {
      if (gen === STU.gen) circleSay(`Refused (nothing moved): ${it.rec.name}'s ${e.message.replace(/^its /, '')}.`, 'red');
      return false;
    }
  }
  if (gen !== STU.gen) return false;
  // (as it was asked: the same circle, and each sound's path the one turned)
  const S2 = circleCan();
  if (!S2) return false;
  if (Math.abs(S2.x - S.x) > 1e-6 || Math.abs(S2.z - S.z) > 1e-6 || Math.abs(S2.yaw - S.yaw) > 1e-6 || [...STU.items.values()].some(it => it.kind === 's' && it.rec.path && it.rec.path.src && !(pm.has(it.id) && pm.get(it.id).src === it.rec.path.src))) {
    circleSay('Refused (nothing moved): the circle or a recorded path changed meanwhile. Press it again.', 'amber');
    return false;
  }
  return circleMove(S, pm);
}
function circleMove(S, pm) {
  const its = [...STU.items.values()].filter(it => CIRC_KINDS.includes(it.kind));
  const c = Math.cos(S.yaw), sn = Math.sin(S.yaw), r = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), S.yaw);
  const at = p => [clamp(S.x + c * p[0] + sn * p[2], -1000, 1000), p[1], clamp(S.z - sn * p[0] + c * p[2], -1000, 1000)];
  const turned = q => r.clone().multiply(new THREE.Quaternion().fromArray(q)).normalize().toArray();
  change(() => {
    for (const it of its) {
      const R = it.rec;
      if (it.kind === 'c') setRec(it.id, { p: at(R.p), yaw: R.yaw + S.yaw });
      else if (it.kind === 's') setRec(it.id, Object.assign({ p: at(R.p) }, R.path ? { path: pm && pm.has(it.id) ? pm.get(it.id).path : pathTurned(R.path, r.toArray()) } : {}));
      else setRec(it.id, { p: at(R.p), q: turned(R.q) });
    }
  }, its.map(it => it.id));
  circleSay(`Moved: ${its.length} item${its.length === 1 ? '' : 's'} now stand${its.length === 1 ? 's' : ''} round this circle (Undo takes it back).` + (pm && pm.size ? ` ${pm.size === 1 ? 'A sound\'s recorded path kept as a file was' : pm.size + ' sounds\' recorded paths kept as files were'} turned into a new file.` : ''), 'muted');
  sfxAct('place', 'world', null);
  return true;
}
function circleBlocks(B, st) {
  if (!st || !circleSpot()) return;
  B.push({ label: 'The scene and its circle', row: [{ id: 'circle', label: 'Move the scene to this circle', act: 'circle', dis: !editOn() || !STU.items.size }] },
    { p: 'Since v125 the scene stands on the room\'s spots and its circle is only the way in: moving the circle moves nothing of it. A scene placed before then stood round its circle: this moves every item there again, for everyone (one Undo step).', c: 'faint' });
  if (CIRC.note && CIRC.sc === STU.scene) B.push({ p: CIRC.note, c: CIRC.c || 'muted' });
}

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
