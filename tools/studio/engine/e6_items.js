
// ================================================================== ITEMS ==
// What is placed in the scene: objects (a model file placed once; one file may be placed many times), trigger cubes,
// sounds, cut-outs (a box that hides the part of one object's model inside it: e6b_cuts.js) and groups (objects, sounds
// and cubes that move together: e6c_groups.js). Each has a record (as in
// layout.json, without its id), checked the same way wherever it comes from (the layout, the room, an edit here), so a
// record taken and given back is the same. Records are never changed in place:
// each change is a new record (the shared room keeps the old one to compare with).
const STU = {
  scene: '', listing: 'none', files: [], fileMap: new Map(), items: new Map(),
  saved: '', savedAt: 0, savedBy: '', layoutAt: 0, bad: 0, note: '', saveNote: '', upNote: '', saving: false, loadAsk: 0, draft: null, mine: 0,
  sel: '', hover: '', pick: null, edit: false, gen: 0, write: false, t0: performance.now(), seen: new Set(), act: 0, libRev: 0, rev: 0, head: null,
  follow: '', bones: '', bonePage: 0,   // (a sound picking an object to follow; its card's list of bones open, and its page)
  cutTo: '', whole: new Set(), cutF: new Set(), ray: null,   // (a cut-out picking the object it cuts; the cut-outs previewed whole here, and cut; the click that selected an object)
  gpick: null,   // (a group picking its members: { id, made, step })
};
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000, r4 = v => Math.round(v * 1e4) / 1e4;
const nz = v => (v === 0 ? 0 : v);   // (no -0)
const fin = v => typeof v === 'number' && isFinite(v);
const okId = s => typeof s === 'string' && /^[a-z0-9]{6}$/.test(s);
const words = (s, n) => String(s).replace(/\s+/g, ' ').trim().slice(0, n);
const vecOf = (a, n, lim) => (Array.isArray(a) && a.length === n && a.every(v => fin(v) && Math.abs(v) <= lim) ? a : null);
// A record's checks. A field given with a wrong type makes the record bad (it is ignored, or dropped from a layout); a
// field left out takes its default; numbers are clamped and rounded (p to the mm, a turn to 4 decimals, a size to 4
// significant figures), and every check gives back what it is given once checked
function norm(kind, x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const has = k => x[k] !== undefined;
  const name = d => (!has('name') ? d : typeof x.name === 'string' && x.name.trim() ? words(x.name, 60) : null);
  if (kind === 'g') {
    // a group: its name and its members by id (this scene's objects, sounds and cubes; ids that are not ids dropped, as a
    // cube's lists drop them; which of them are here, and in which group, is worked out where it is used: groupOf)
    if (!Array.isArray(x.items)) return null;
    const r = { name: name('Group'), items: [...new Set(x.items.filter(okId))].slice(0, GROUP_ITEMS) };
    return Object.values(r).includes(null) ? null : r;
  }
  const p = vecOf(x.p, 3, 1000);
  if (!p) return null;
  const P = p.map(v => nz(r3(v)));
  const one = (k, list, d) => (!has(k) ? d : list.includes(x[k]) ? x[k] : null);
  if (kind === 'o') {
    if (!okFile(x.file)) return null;
    let q = [0, 0, 0, 1];
    if (has('q')) {
      const v = vecOf(x.q, 4, 2), n = v ? Math.hypot(...v) : 0;
      if (!v || n < 1e-6) return null;
      q = (Math.abs(n - 1) > 2e-3 ? v.map(c => c / n) : v).map(c => nz(r4(c)));
    }
    if (has('s') && !(fin(x.s) && x.s > 0)) return null;
    const s = has('s') ? +Math.min(1e4, Math.max(1e-4, x.s)).toPrecision(4) : 1;
    const r = { name: name(stem(x.file)), file: x.file, p: P, q, s, light: one('light', ['lit', 'scan'], 'lit'), clip: !has('clip') ? '' : typeof x.clip === 'string' ? x.clip.slice(0, 120) : null,
      anim: one('anim', ['loop', 'once', 'off'], 'loop'), start: one('start', ['always', 'shown'], 'always') };
    // its faces, kept only when set: both sides, or inside out (absent, or null: as in its file)
    if (x.faces != null) r.faces = ['both', 'inside'].includes(x.faces) ? x.faces : null;
    return Object.values(r).includes(null) ? null : r;
  }
  if (kind === 'c') {
    const sz = has('size') ? vecOf(x.size, 3, 1000) : [1.2, 2, 1.2];
    if (!sz || (has('yaw') && !fin(x.yaw))) return null;
    let yaw = has('yaw') ? x.yaw : 0;
    if (Math.abs(yaw) > 3.1416) yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    const ids = k => (!has(k) ? [] : Array.isArray(x[k]) ? [...new Set(x[k].filter(okId))].slice(0, 400) : null);
    const r = { name: name('Cube'), p: P, yaw: nz(r4(yaw)), size: sz.map(v => r3(Math.min(100, Math.max(0.05, v)))), mode: one('mode', ['while', 'stay'], 'while'), show: ids('show'), hide: ids('hide') };
    return Object.values(r).includes(null) ? null : r;
  }
  if (kind === 's') {
    if (!okFile(x.file) || (has('vol') && !fin(x.vol)) || (has('r') && !fin(x.r)) || (has('loop') && typeof x.loop !== 'boolean')) return null;
    // what it follows, kept only when set: an object (on: its id), a bone of its model (bone: its name, '' or none the
    // whole model), at an offset (o: metres in the target's frame, turned but not scaled; [0, 0, 0] is none); a bone or
    // an offset with no object is dropped, whatever it is (checked only with an object)
    const on = has('on'), o = on && has('o') ? vecOf(x.o, 3, 1000) : null;
    if (on && (!okId(x.on) || (has('bone') && typeof x.bone !== 'string') || (has('o') && !o))) return null;
    const r ={ name: name(stem(x.file)), file: x.file, p: P, vol: has('vol') ? r2(Math.min(2, Math.max(0, x.vol))) : 1, r: has('r') ? r2(Math.min(20, Math.max(0.1, x.r))) : 1.5,
      loop: has('loop') ? x.loop : true, start: one('start', ['always', 'shown'], 'always') };
    if (on) {
      r.on = x.on;
      const bone = has('bone') ? x.bone.slice(0, 120) : '';
      if (bone) r.bone = bone;
      const O = o ? o.map(v => nz(r3(v))) : null;
      if (O && O.some(v => v !== 0)) r.o = O;
    }
    return Object.values(r).includes(null) ? null : r;
  }
  if (kind === 'x') {
    // a cut-out: the object it cuts (on, required), and its middle, turn and size in that object's frame, turned but not
    // scaled (metres): p to the mm, a full turn to 4 decimals, each side 1 cm to 50 m to the mm
    if (!okId(x.on)) return null;
    const q = has('q') ? quatOf(x.q) : [0, 0, 0, 1], sz = has('size') ? vecOf(x.size, 3, 1000) : [0.8, 2, 0.4];
    if (!q || !sz) return null;
    const r = { name: name('Cut-out'), on: x.on, p: P, q, size: sz.map(v => nz(r3(Math.min(50, Math.max(0.01, v))))) };
    return Object.values(r).includes(null) ? null : r;
  }
  return null;
}
// a turn as a record keeps it: four numbers, normalised, to 4 decimals (null: not a turn)
function quatOf(a) {
  const v = vecOf(a, 4, 2), n = v ? Math.hypot(...v) : 0;
  if (!v || n < 1e-6) return null;
  return (Math.abs(n - 1) > 2e-3 ? v.map(c => c / n) : v).map(c => nz(r4(c)));
}
const KIND_NAME = { o: 'object', c: 'trigger cube', s: 'sound', x: 'cut-out', g: 'group' };
// what a group may hold (a cut-out belongs to its object and moves with it), and at most how many ids its record keeps
const GROUP_KINDS = ['o', 's', 'c'], GROUP_ITEMS = 460;

// ------------------------------------------------------------ the items --
const BOX1 = new THREE.BoxGeometry(1, 1, 1), HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
// an item placed or changed: its record taken (glide: from the room, it glides there unless carried here)
function putItem(id, kind, rec, o) {
  let it = STU.items.get(id);
  if (it && it.kind !== kind) { removeItem(id); it = null; }
  if (!it) {
    if ([...STU.items.values()].filter(x => x.kind === kind).length >= LIMITS[kind]) return null;
    it = makeItem(id, kind);
    STU.items.set(id, it);
  }
  const was = it.rec;
  it.rec = rec;
  STU.rev++;
  applyRec(it, was, !!(o && o.glide) && !!was);
  return it;
}
function makeItem(id, kind) {
  const it = { id, kind, rec: null, holder: null, a: 0, sa: 0, fa: 0, shown: false, heard: false, first: true, shownAt: performance.now(), gl: null, carry: false, act: false, since: 0, inside: false, ended: false };
  if (kind === 'o') {
    it.holder = new THREE.Group();
    it.slot = new THREE.Group(); it.holder.add(it.slot);
    it.grey = LOOKS.grey(); GL.items.add(it.grey.group);
    it.grey.group.userData.id = id;
    it.greyHit = new THREE.Mesh(BOX1, HIDDEN); it.greyHit.scale.setScalar(0.4); it.greyHit.position.y = 0.2; it.greyHit.userData.id = id;
    it.grey.group.add(it.greyHit);
    it.proxy = new THREE.Mesh(BOX1, HIDDEN); it.proxy.userData.id = id; it.proxy.visible = false;
    it.slot.add(it.proxy);
  } else if (kind === 'c') {
    it.look = LOOKS.cube(id);
    it.holder = it.look.body;
    it.look.fill.userData.id = id;
    for (const c of it.look.corners) c.userData.id = id;
    GL.edit.add(it.look.deco);
  } else if (kind === 'x') {
    it.look = LOOKS.cut(id);
    it.holder = it.look.body;
    it.look.hit.userData.id = id;
    for (const c of it.look.corners) c.userData.id = id;
    GL.edit.add(it.look.deco);
  } else if (kind === 'g') {
    // a group: its pivot (the page's arrows hold it; the middle of its members, on the floor) and its box, drawn while
    // it is selected (e6c_groups.js)
    it.look = LOOKS.group(id);
    it.holder = new THREE.Group();
    GL.edit.add(it.look.deco);
  } else {
    it.look = LOOKS.speaker(id);
    it.holder = it.look.group;
    it.look.hit.userData.id = id;
    GL.edit.add(it.look.ring); GL.edit.add(it.look.link);
  }
  it.holder.userData.id = id;
  GL.items.add(it.holder);
  return it;
}
function removeItem(id) {
  const it = STU.items.get(id);
  if (!it) return;
  STU.items.delete(id); STU.rev++;
  if (it.kind === 'o') { dropModel(it); libRelease(it.E, id); it.grey.group.parent && it.grey.group.parent.remove(it.grey.group); it.grey.drop(); }
  else { it.look.drop(); for (const k of ['deco', 'ring', 'link']) if (it.look[k]) GL.edit.remove(it.look[k]); }
  if (it.kind === 's') emitStop(it, true);
  if (it.tick) { GL.edit.remove(it.tick); it.tick.userData.drop(); }
  if (it.holder.parent) it.holder.parent.remove(it.holder);
  if (GL.tc && GL.tc.object === it.holder) GL.tc.detach();
  if (STU.sel === id) STU.sel = '';
  if (STU.hover === id) STU.hover = '';
  if (STU.follow === id) STU.follow = '';
  if (STU.cutTo === id) STU.cutTo = '';
  if (STU.gpick && STU.gpick.id === id) STU.gpick = null;
  if (it.kind === 'g' && it.base) groupRelease(it);   // (a group gone while carried: its members let go)
  STU.whole.delete(id); STU.cutF.delete(id);
  STU.seen.delete(id);   // (a staying cube put back by Undo waits to be entered again)
  // (a hand holding it lets go: its change ends in the next headset frame, once nothing else is held, xrLost; the
  // page's arrows end theirs as the pointer comes up, TransformControls firing dragging-changed even when detached)
  for (const c of XR.ctrls || []) if (c.grab && c.grab.id === id) { c.grab = null; XR.lost = true; }
}
function clearItems() { for (const id of [...STU.items.keys()]) removeItem(id); emitAll(true); sndClear(); }
// where a record puts its item: its place, turn and scale (a cube's scale is its size; it stays level)
const _pp = new THREE.Vector3(), _pq = new THREE.Quaternion(), _ps = new THREE.Vector3(), _yUp = new THREE.Vector3(0, 1, 0);
function poseOf(it) {
  const r = it.rec;
  _pp.fromArray(r.p);
  if (it.kind === 'o') { _pq.fromArray(r.q); _ps.setScalar(r.s); }
  else if (it.kind === 'c') { _pq.setFromAxisAngle(_yUp, r.yaw); _ps.fromArray(r.size); }
  else if (it.kind === 'x') cutPose(it, _pp, _pq, _ps);   // (in the frame of the object it cuts: e6b_cuts.js)
  else { _pq.identity(); _ps.set(1, 1, 1); }
}
function applyRec(it, was, glide) {
  if (it.kind === 'g') return;   // (a group has no place of its own: its members have theirs)
  if (glide && !it.carry) it.gl = { p: it.holder.position.clone(), q: it.holder.quaternion.clone(), s: it.holder.scale.clone(), t0: performance.now() };
  else if (!it.carry) { it.gl = null; poseOf(it); it.holder.position.copy(_pp); it.holder.quaternion.copy(_pq); it.holder.scale.copy(_ps); }
  const r = it.rec;
  if (it.kind === 'o') {
    if (!was || was.file !== r.file) itemFile(it);
    if (!was || was.light !== r.light) applyLight(it);
    else if (was.faces !== r.faces) applyFaces(it);
    if (!was || was.clip !== r.clip || was.anim !== r.anim || was.start !== r.start) it.animKey = '';
  } else if (it.kind === 'c') it.look.name.userData.set(r.name, it.look.col, 0.085);
  else if (it.kind === 'x') it.look.name.userData.set('✂ ' + r.name, it.look.col, 0.075);
  else {
    it.look.name.userData.set(r.name, it.look.col, 0.07);
    if (!was || was.file !== r.file) { emitStop(it, true); itemFile(it); }
    if (!was || was.loop !== r.loop || was.start !== r.start) { emitStop(it); it.ended = false; }
  }
}
// the file an item uses (once the scene's listing is known)
function itemFile(it) {
  if (STU.listing !== 'ok') return;
  if (it.kind === 'o') {
    const E = lib(it.rec.file);
    if (it.E !== E) { dropModel(it); libRelease(it.E, it.id); it.E = E; }
    E.users.add(it.id);
  } else if (it.kind === 's') it.F = snd(it.rec.file);
}
function dropModel(it) {
  if (!it.model) return;
  for (const m of it.model.meshes) {
    for (const k of ['lit', 'scan']) for (const mat of [].concat(m.userData[k] || [])) mat.dispose();
    m.userData.lit = m.userData.scan = null;
    if (m.isSkinnedMesh && m.skeleton) m.skeleton.dispose();   // (a rigged clone's own bones' texture)
  }
  it.slot.remove(it.model.o);
  it.model = null; it.mixer = null; it.action = null; it.built = -1; it.animKey = '';
}
function buildModel(it) {
  const E = it.E;
  dropModel(it);
  const c = libClone(E);
  it.slot.add(c.o);
  it.model = c; it.built = E.gen; it.aSet = -1; it.light = ''; it.animKey = '';
  it.mixer = E.clips.length ? new THREE.AnimationMixer(c.o) : null;
  // what the pointer finds: an unseen box round it (in its own units, so it turns and scales with it)
  const b = E.info.box;
  it.proxy.position.set((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2);
  it.proxy.scale.set(Math.max(1e-4, b[1][0] - b[0][0]), Math.max(1e-4, b[1][1] - b[0][1]), Math.max(1e-4, b[1][2] - b[0][2]));
  applyLight(it);
  if (cutsOn(it.id).length) cutPrep(it);   // (its cut-outs' addition to its materials, compiled with them below)
  warmModel(c.o);
  if (it.fresh) placeFresh(it, it.fresh);
}
// its shaders compiled now (with the scene's lights, as when drawn), so a cube that shows it later does not stall the
// headset the moment it appears (a stand-in scene holds the lights and the model without taking them from their parents)
function warmModel(o) {
  const sc = new THREE.Scene();
  try { sc.children = GL.scene.children.filter(x => x.isLight).concat(o); GL.renderer.compile(sc, GL.camera); } catch (e) { /* compiled when first drawn */ }
  sc.children = [];
}
// a file placed for the first time here: its units and up axis as its starting scale and turn, its lowest point on the
// floor with its middle where it was put, lit or as scanned, its first clip (stored in the record from then on)
function placeFresh(it, at) {
  it.fresh = null;
  const E = it.E;
  if (!E || !E.info) return;
  const g = E.guess, box = placedBox(E, g.q, g.s);
  const rec = norm('o', Object.assign({}, it.rec, {
    s: g.s, q: g.q, light: E.info.scan ? 'scan' : 'lit', clip: E.clips[0] ? E.clips[0].name : '',
    p: [at[0] - (box.min.x + box.max.x) / 2, -box.min.y, at[1] - (box.min.z + box.max.z) / 2],
  }));
  if (rec) putItem(it.id, 'o', rec);
  changed();
}
function applyLight(it) {
  if (!it.model) return;
  const mode = it.rec.light;
  for (const m of it.model.meshes) {
    if (mode === 'scan' && !m.userData.scan) m.userData.scan = Array.isArray(m.userData.lit) ? m.userData.lit.map(scanMat) : scanMat(m.userData.lit);
    m.material = mode === 'scan' ? m.userData.scan : m.userData.lit;
  }
  if (it.model.cut) cutMats(it);   // (as scanned, made just now: cut as the lit ones are)
  applyFaces(it);   // (and drawn on the sides its record says)
  it.light = mode; it.aSet = -1;
}
// its faces (rec.faces): as in its file (each material's own side, as loaded: side0), both sides, or inside out (only the
// back faces drawn, three.js turning their normals, so the light follows): on its own materials (each object's clones,
// libClone; lit and as scanned), so two objects of one file may differ; kept through a rebuild (buildModel, through
// applyLight) and with its cut-outs' addition (a new side compiles its program again, the addition with it)
const FACES = { both: THREE.DoubleSide, inside: THREE.BackSide };
function applyFaces(it) {
  if (!it.model) return;
  const f = FACES[it.rec.faces];
  for (const m of it.model.meshes) for (const k of ['lit', 'scan']) for (const mat of [].concat(m.userData[k] || [])) {
    if (mat.userData.side0 === undefined) mat.userData.side0 = mat.side;
    const want = f !== undefined ? f : mat.userData.side0;
    if (mat.side !== want) { mat.side = want; mat.needsUpdate = true; }
  }
}
// an object's fade: its materials' own opacity times a (see-through and not hiding what is behind while it fades)
function setObjAlpha(it, a) {
  if (Math.abs(a - it.aSet) < 1e-3) return;
  it.aSet = a;
  for (const m of it.model.meshes) for (const mat of [].concat(m.material)) {
    const b = mat.userData.base;
    if (!b) continue;
    if (a >= 0.999) { mat.transparent = b.t; mat.opacity = b.o; mat.depthWrite = b.d; } else { mat.transparent = true; mat.opacity = b.o * a; mat.depthWrite = false; }
  }
}
// its animation: the clip named in its record, looped, once (to its end, then held) or off (its rest pose), on the
// scene's clock (the same moment for everyone at a station) or from when a cube showed it to you
function animStep(it, now, clockS) {
  const r = it.rec, E = it.E;
  if (!it.mixer || !E) return;
  const key = r.clip + '|' + r.anim;
  if (key !== it.animKey) {
    it.animKey = key;
    it.mixer.stopAllAction();
    for (const [n, p, q, s] of it.model.rest) { n.position.copy(p); n.quaternion.copy(q); n.scale.copy(s); }
    const clip = r.anim !== 'off' ? E.clips.find(c => c.name === r.clip) : null;
    it.action = clip ? it.mixer.clipAction(clip) : null;
    if (it.action) it.action.play();
    it.dur = clip ? clip.duration : 0;
  }
  if (!it.action || !(it.dur > 0)) return;
  let t = r.start === 'shown' ? (now - it.shownAt) / 1000 : clockS;
  t = r.anim === 'loop' ? ((t % it.dur) + it.dur) % it.dur : Math.min(Math.max(0, t), it.dur - 1e-4);
  it.action.time = t;
  it.mixer.update(0);
}
// the scene's clock (s): at a shared room's station the room's (the same moment everywhere), else since it opened
function sceneClock(now) {
  try { if (atStation() && HOST.collab.now) return HOST.collab.now() / 1000; } catch (e) { /* not in a room */ }
  return (now - STU.t0) / 1000;
}

// --------------------------------------------------------- trigger cubes --
// Each person's own (never shared): a cube is active for you while your head is inside it (the headset's head; on a
// page the camera in Walk view; nobody in Orbit view); a 'stay' cube, once entered, until the scene opens again or
// Reset what I have seen. For an item: the active cubes that list it in show (S) and in hide (H): shown if S has any and
// H none, hidden if H has any and S none, both: the one that became active last decides; neither: hidden if any cube
// shows it (it waits for its cube), else shown
const _hp = new THREE.Vector3();
function headPoint(out) {
  if (STU.head) return out.fromArray(STU.head);
  if (XR.on && GL.renderer.xr.isPresenting) { GL.world.updateMatrixWorld(true); return GL.world.worldToLocal(out.copy(XR.head)); }
  if (APP.mode === 'explore' && X.view === 'walk') return out.copy(WALK.pos);
  return null;
}
function inCube(r, p) {
  const dx = p.x - r.p[0], dz = p.z - r.p[2], c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  return Math.abs(c * dx - s * dz) <= r.size[0] / 2 && Math.abs(p.y - r.p[1]) <= r.size[1] / 2 && Math.abs(s * dx + c * dz) <= r.size[2] / 2;
}
const LISTS = { rev: -1, shown: new Set() };
function triggerStep(now) {
  const hp = headPoint(_hp), S = new Map(), H = new Map();
  if (LISTS.rev !== STU.rev) { LISTS.rev = STU.rev; LISTS.shown = new Set(); for (const c of STU.items.values()) if (c.kind === 'c') for (const i of c.rec.show) LISTS.shown.add(i); }
  for (const c of STU.items.values()) {
    if (c.kind !== 'c') continue;
    c.inside = !!hp && inCube(c.rec, hp);
    if (c.inside && c.rec.mode === 'stay') STU.seen.add(c.id);
    const act = c.inside || (c.rec.mode === 'stay' && STU.seen.has(c.id));
    if (act && !c.act) c.since = ++STU.act;
    c.act = act;
    if (!act) continue;
    for (const i of c.rec.show) S.set(i, Math.max(S.get(i) || 0, c.since));
    for (const i of c.rec.hide) H.set(i, Math.max(H.get(i) || 0, c.since));
  }
  for (const it of STU.items.values()) {
    if (it.kind === 'c' || it.kind === 'g') continue;
    const s = S.get(it.id) || 0, h = H.get(it.id) || 0, shown = s || h ? s >= h : !LISTS.shown.has(it.id);
    if (it.kind === 'o' && shown && (!it.shown || it.first)) { it.shownAt = now; it.ended = false; }
    if (it.kind === 'x' && it.first) it.sa = shown ? 1 : 0;   // (a cut-out new here cuts, or not, at once: no half fade to wait for)
    it.shown = shown; it.first = false;
  }
  // a sound is heard while it is shown for you and so is the object it follows (if any): one that starts 'shown' starts
  // from its beginning each time that turns on (a voice line as she appears)
  for (const it of STU.items.values()) {
    if (it.kind !== 's') continue;
    const ob = followOf(it), heard = it.shown && (!ob || ob.shown);
    if (heard && !it.heard) { it.shownAt = now; it.ended = false; if (it.rec.start === 'shown') emitStop(it); }
    it.heard = heard;
  }
}
// what is shown for you with your head at p (the tests: [x, y, z] in the scene's frame, or null for nobody)
function shownFor(p) {
  STU.head = p ? p.slice(0, 3) : null;
  triggerStep(performance.now());
  return Object.fromEntries([...STU.items.values()].filter(it => it.kind !== 'c' && it.kind !== 'g').map(it => [it.id, it.shown]));
}
function resetSeen() { STU.seen.clear(); for (const c of STU.items.values()) if (c.kind === 'c') c.act = false; dirty(true); }

// ------------------------------------------------------ sounds that follow --
// A sound may follow an object (rec.on: its id): its whole model (the object's holder, there from the first frame), a
// bone of it, or for a model with no bones a part its animation moves (rec.bone: its name as three.js gives it), at an
// offset (rec.o: metres in the target's frame, turned but not scaled). Every frame, once every object's animation has
// stepped, the sound's holder is put at the target's place plus its turn times the offset (soundStep); not while it is
// carried (the grip, the page's arrows). On this device a bone not found means the whole model, and an object not in the
// scene the sound's own place (rec.p). Names are matched as given, then leniently (lower case, letters and digits only),
// since three.js's loaders tidy them: "mixamorig:Head" is "mixamorigHead" once loaded, "Bip01 Head" "Bip01_Head"
const boneKey = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
// the short list of bones offered first, each where the model has one: matched by the end of its tidied name (Mixamo,
// 3ds Max's Biped, Unreal, Rigify's DEF-, VRM and Unity's humanoid), the first ending in that order of preference. Rigify
// numbers its spine: DEF-spine is the hips, .003 the chest, .004 and .005 the neck, .006 the head (matched only with its
// DEF- prefix: another rig's spine006 is not a head)
const BONE_SLOTS = [['Head', ['head', 'defspine006']], ['Neck', ['neck', 'neck01', 'neck1', 'defspine004', 'defspine005']],
  ['Chest', ['upperchest', 'chest', 'spine2', 'spine03', 'spine003']], ['Hips', ['hips', 'pelvis', 'defspine']],
  ['Left hand', ['lefthand', 'handleft', 'lhand', 'handl']], ['Right hand', ['righthand', 'handright', 'rhand', 'handr']],
  ['Left foot', ['leftfoot', 'footleft', 'lfoot', 'footl']], ['Right foot', ['rightfoot', 'footright', 'rfoot', 'footr']]];
// the bones a model offers, by name as loaded (its file's, the same in every clone), or with none the nodes its clips
// move ({ list, kind: 'bone' | 'part', depth, slots: [[label, name]] })
function bonesOf(E) {
  if (!E || !E.root) return { list: [], kind: 'bone', depth: new Map(), slots: [] };
  if (E.bones && E.bones.root === E.root) return E.bones;
  const list = [], depth = new Map();
  const walk = (n, d) => { if (n.isBone && n.name && !depth.has(n.name)) { depth.set(n.name, d); list.push(n.name); } for (const c of n.children) walk(c, d + 1); };
  walk(E.root, 0);
  let kind = 'bone';
  if (!list.length) {
    kind = 'part';
    for (const c of E.clips || []) for (const t of c.tracks) {
      let nn = '';
      try { nn = THREE.PropertyBinding.parseTrackName(t.name).nodeName; } catch (e) { continue; }
      if (nn && !depth.has(nn) && E.root.getObjectByName(nn)) { depth.set(nn, 0); list.push(nn); }
    }
  }
  const B = { root: E.root, list: list.slice(0, 400), kind, depth };
  // (the nearest the root first, then the shortest name: a head, not a forehead)
  B.slots = BONE_SLOTS.map(([lab, ends]) => {
    for (const e of ends) {
      const m = B.list.filter(nn => boneKey(nn).endsWith(e));
      if (m.length) return [lab, m.sort((a, b) => depth.get(a) - depth.get(b) || boneKey(a).length - boneKey(b).length)[0]];
    }
    return [lab, ''];
  }).filter(x => x[1]);
  return (E.bones = B);
}
// a bone's name in the short list's words where it is one of them (Head), else as it is
function boneLabel(ob, name) {
  const k = boneKey(name), hit = bonesOf(ob.E).slots.find(x => boneKey(x[1]) === k);
  return hit ? hit[0] : name;
}
// the node of an object's own clone (each clone has its own bones) by a bone's name, exactly or leniently; null: not found
function nodeOf(ob, name) {
  const M = ob && ob.model;
  if (!M || !name) return null;
  if (!M.names) {
    M.names = new Map(); M.keys = new Map();
    const put = nd => { if (!nd.name) return; if (!M.names.has(nd.name)) M.names.set(nd.name, nd); const k = boneKey(nd.name); if (k && !M.keys.has(k)) M.keys.set(k, nd); };
    M.o.traverse(nd => { if (nd.isBone) put(nd); });   // (bones first: a mesh of the same name gives way)
    M.o.traverse(nd => { if (!nd.isBone) put(nd); });
  }
  return M.names.get(name) || M.keys.get(boneKey(name)) || null;
}
// the object a sound follows (null: none, or not an object of this scene)
const followOf = it => { const o = it.kind === 's' && it.rec.on ? STU.items.get(it.rec.on) : null; return o && o.kind === 'o' ? o : null; };
// the node it follows now: its bone, else the object's holder (null: it follows nothing here)
function followNode(it) {
  const o = followOf(it);
  return o ? (it.rec.bone && nodeOf(o, it.rec.bone)) || o.holder : null;
}
// the node to measure a following sound's offset against here: as it follows, but none while it names a bone and its
// model is not here yet (where that bone stands is not known, so only p is written: an offset measured against the
// holder would be read against the bone everywhere else). A model here without that bone lacks it everywhere (the same
// file), so the whole model is what everyone follows and is measured against
function measureNode(it) {
  const o = followOf(it);
  return !o || (it.rec.bone && !o.model) ? null : followNode(it);
}
// how much larger an object is shown than its record says: both grips write its size ten times a second, the room's
// size glides in, so between those its followers' offsets are scaled by this (1 at rest)
const followK = o => (o && o.rec.s > 0 && o.holder.scale.x > 0 ? o.holder.scale.x / o.rec.s : 1);
// a node's place and turn in the scene's frame (the items' group's), its scale left out
const _wm = new THREE.Matrix4(), _ws = new THREE.Vector3(), _wp = new THREE.Vector3(), _wq = new THREE.Quaternion();
function nodePose(nd, p, q) {
  nd.updateWorldMatrix(true, false);
  _wm.copy(GL.items.matrixWorld).invert().multiply(nd.matrixWorld).decompose(p, q, _ws);
}
// where a sound on node nd with offset o is (the scene's frame)
function followPoint(nd, o, out) {
  nodePose(nd, _wp, _wq);
  return out.fromArray(o || [0, 0, 0]).applyQuaternion(_wq).add(_wp);
}
// where a following sound on node nd stands now (its offset scaled by followK while its object is being sized)
function followAt(it, nd, out) {
  const k = followK(followOf(it)), o = it.rec.o;
  return followPoint(nd, o && k !== 1 ? o.map(v => v * k) : o, out);
}
// the offset that keeps a sound at p (the scene's frame) on node nd, to the mm (k: its object shown k times its record's
// size, followK, so the record's offset is the one shown divided by k)
function offsetAt(nd, p, k) {
  nodePose(nd, _wp, _wq);
  return _ws.copy(p).sub(_wp).applyQuaternion(_wq.invert()).divideScalar(k || 1).toArray().map(v => nz(r3(v)));
}
// what a sound follows, in words: "Dancer · Head", "Dancer · Whole model" ('' nothing)
function followWords(it) {
  if (!it.rec.on) return '';
  const o = followOf(it);
  return o ? o.rec.name + ' · ' + (it.rec.bone ? boneLabel(o, it.rec.bone) : 'Whole model') : 'an object not in the scene';
}

// ----------------------------------------------------------- every frame --

const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
function itemsStep(dt, now) {
  const editing = editOn(), clockS = sceneClock(now), fade = dt / 0.4;
  triggerStep(now);
  for (const it of STU.items.values()) {
    if (it.kind === 'g') continue;   // (groups once their members have their places: groupsStep)
    // a record from the room: it glides there (0.25 s), unless carried here (a sound that follows a model: soundStep; a
    // cut-out, in the frame of the object it cuts: cutStep)
    if (it.gl && !it.carry && !(it.kind === 's' && it.rec.on) && it.kind !== 'x') {
      const k = smooth((now - it.gl.t0) / 250);
      poseOf(it);
      it.holder.position.lerpVectors(it.gl.p, _pp, k);
      it.holder.quaternion.copy(it.gl.q).slerp(_pq, k);
      it.holder.scale.lerpVectors(it.gl.s, _ps, k);
      if (k >= 1) it.gl = null;
    }
    const tgt = it.kind === 'c' || it.kind === 'x' ? (editing ? 1 : 0) : it.shown ? 1 : editing && it.kind === 'o' ? 0.3 : 0;
    it.a = approach(it.a, tgt, fade);
    it.sa = approach(it.sa, it.shown ? 1 : 0, fade);
    if (it.kind === 'o') {
      const E = it.E;
      if (E && E.state === 'ready' && it.built !== E.gen) buildModel(it);
      if (it.model) {
        setObjAlpha(it, it.a);
        it.holder.visible = it.a > 0.002;
        if (it.holder.visible) animStep(it, now, clockS);
      } else it.holder.visible = false;
      greyStep(it);
    } else if (it.kind === 'c') {
      const L = it.look, r = it.rec;
      it.holder.visible = L.deco.visible = it.a > 0.01;
      if (L.deco.visible) {
        L.deco.position.copy(it.holder.position); L.deco.quaternion.copy(it.holder.quaternion);
        const sz = it.holder.scale;
        L.name.position.set(0, sz.y / 2 + 0.04, 0);
        L.corners.forEach((c, k) => c.position.set((k & 1 ? 0.5 : -0.5) * sz.x, (k & 2 ? 0.5 : -0.5) * sz.y, (k & 4 ? 0.5 : -0.5) * sz.z));
        L.look({ inside: it.inside, selected: STU.sel === it.id && editing, hot: STU.hover === it.id, hotCorner: STU.hotCorner && STU.hotCorner.id === it.id ? STU.hotCorner.k : -1 });
        L.fill.material.opacity *= it.a; L.line.material.opacity *= it.a;
        L.name.userData.set(r.name + (r.mode === 'stay' ? ' · stays' : ''), L.col, 0.085);
      }
    }
  }
  // the cut-outs, once every object has its place this frame (each in its object's frame; what it cuts handed to the
  // object's materials: e6b_cuts.js), then the sounds, once every object's animation has stepped: a sound that follows a
  // model goes where its bone is now
  cutsStep(editing, now);
  for (const it of STU.items.values()) if (it.kind === 's') soundStep(it, editing, now);
  groupsStep(editing);
  editStep(editing);
  emitStep(now);
}
// a sound: where it follows (gliding there from where it was when the room moved it), heard as far as it and what it
// follows are shown for you (its fade times its object's, the 0.4 s fades), and while editing its speaker, its ring at
// its full-volume distance and a faint line to what it follows (its labels, hovered or selected: "Voice → Dancer · Head")
function soundStep(it, editing, now) {
  const r = it.rec, L = it.look, ob = followOf(it), n = r.on ? followNode(it) : null;
  if (r.on && !it.carry) {
    if (n) followAt(it, n, _pp); else _pp.fromArray(r.p);
    if (it.gl) { const k = smooth((now - it.gl.t0) / 250); it.holder.position.lerpVectors(it.gl.p, _pp, k); if (k >= 1) it.gl = null; }
    else it.holder.position.copy(_pp);
  }
  it.fa = it.sa * (ob ? ob.sa : 1);
  it.holder.visible = L.ring.visible = editing;
  L.link.visible = false;
  if (!editing) return;
  L.ring.position.set(it.holder.position.x, 0.004, it.holder.position.z);
  L.ring.scale.setScalar(r.r);
  const hot = STU.hover === it.id, sel = STU.sel === it.id;
  L.look({ hot, selected: sel, on: !!it.src && it.fa > 0.5 });   // (its labels, hovered or selected, say what it follows)
  if (n) {
    nodePose(n, _wp, _wq);
    if (_wp.distanceTo(it.holder.position) > 0.005) { L.link.userData.set(it.holder.position, _wp); L.link.visible = true; }
  }
}
// a model not here yet: its grey box where it will stand, with what is happening to it
function greyStep(it) {
  const g = it.grey, E = it.E, show = !it.model && it.a > 0.01;
  g.group.visible = show;
  if (!show) return;
  g.group.position.copy(it.holder.position);
  const st = STU.listing !== 'ok' ? (STU.listing === 'missing' ? 'not on this device' : 'waiting') : !E || E.state === 'idle' ? (STU.fileMap.has(it.rec.file) ? 'waiting' : 'not in the scene\'s folder')
    : E.state === 'loading' ? `loading ${Math.round(E.p * 100)} %` : E.state === 'parsing' ? 'reading' : E.state === 'failed' ? 'cannot be read' : E.state === 'missing' ? 'not in the scene\'s folder' : '';
  g.name.userData.set(it.rec.name + (st ? ': ' + st : ''), E && E.state === 'failed' ? '#ff5a4b' : '#95a6bd', 0.075);
  g.fill.material.opacity = 0.55 * Math.min(1, it.a);
}
// while editing: the selected object's outline, the lines from a selected cube to what it shows (green) and hides
// (red), and in Pick mode a tick over each item on the list
const _sb = new THREE.Box3(), _sv = new THREE.Vector3(), _sw = new THREE.Vector3(), _sm = new THREE.Matrix4();
function editStep(editing) {
  const sel = editing ? STU.items.get(STU.sel) : null, hov = editing && STU.hover !== STU.sel ? STU.items.get(STU.hover) : null;
  for (const [B, it] of [[GL.selBox, sel], [GL.hoverBox, hov]]) {
    const ok = it && it.kind === 'o' && (it.model ? it.proxy : it.grey.group.visible);
    B.visible = !!ok;
    if (!ok) continue;
    const t = it.model ? it.proxy : it.greyHit;
    t.updateWorldMatrix(true, false);
    B.matrix.copy(t.matrixWorld); B.matrixWorldNeedsUpdate = true;
  }
  // a selected cube's lists
  const L = GL.links, pos = L.geometry.attributes.position, col = L.geometry.attributes.color;
  let n = 0;
  if (sel && sel.kind === 'c') {
    for (const [list, c] of [[sel.rec.show, [0.24, 0.88, 0.56]], [sel.rec.hide, [1, 0.35, 0.29]]]) for (const id of list) {
      const t = STU.items.get(id);
      if (!t || n >= pos.count - 2) continue;
      itemTopInto(t, _sw, true);
      pos.setXYZ(n, sel.holder.position.x, sel.holder.position.y, sel.holder.position.z); col.setXYZ(n++, ...c);
      pos.setXYZ(n, _sw.x, _sw.y, _sw.z); col.setXYZ(n++, ...c);
    }
  }
  L.geometry.setDrawRange(0, n); pos.needsUpdate = col.needsUpdate = true; L.visible = n > 0;
  // ticks over what a cube's list holds while picking for it
  const P = editing && STU.pick ? STU.items.get(STU.pick.id) : null;
  for (const it of STU.items.values()) {
    if (it.kind === 'c' || it.kind === 'g') continue;
    const on = !!P && (P.rec.show.includes(it.id) || P.rec.hide.includes(it.id));
    if (on && !it.tick) { it.tick = LOOKS.tag(30); GL.edit.add(it.tick); }
    if (!it.tick) continue;
    it.tick.visible = on;
    if (!on) continue;
    const sh = P.rec.show.includes(it.id);
    it.tick.userData.set((sh ? '✓ shown by ' : '✕ hidden by ') + P.rec.name, sh ? '#3ee08f' : '#ff5a4b', 0.075);
    itemTopInto(it, it.tick.position, false); it.tick.position.y += 0.1;
  }
}
// what editing draws: the selected and the pointed-at object's outlines (over everything), a cube's lines
function editLooks() {
  const edges = new THREE.EdgesGeometry(BOX1);
  for (const [k, col, o] of [['selBox', 0x46d9ff, 0.95], ['hoverBox', 0x9fe8ff, 0.5]]) {
    const B = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: o, depthTest: false, depthWrite: false }));
    B.matrixAutoUpdate = false; B.visible = false; B.renderOrder = 8; B.frustumCulled = false;
    GL.scene.add(B); GL[k] = B;
  }
  const g = new THREE.BufferGeometry(), n = 1600;
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  GL.links = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  GL.links.frustumCulled = false; GL.links.renderOrder = 8; GL.links.visible = false;
  GL.edit.add(GL.links);
}
// the top of an item (a label's place, a line's end), in the scene's frame; mid: its middle instead
function itemTopInto(it, out, mid) {
  if (it.kind === 'o') {
    const t = it.model ? it.proxy : it.greyHit;
    t.updateWorldMatrix(true, false);
    if (!BOX1.boundingBox) BOX1.computeBoundingBox();
    _sm.copy(GL.world.matrixWorld).invert().multiply(t.matrixWorld);
    _sb.copy(BOX1.boundingBox).applyMatrix4(_sm);
    out.set((_sb.min.x + _sb.max.x) / 2, mid ? (_sb.min.y + _sb.max.y) / 2 : Math.max(_sb.min.y, _sb.max.y), (_sb.min.z + _sb.max.z) / 2);
  } else if (it.kind === 'c') out.set(it.holder.position.x, it.holder.position.y + (mid ? 0 : it.holder.scale.y / 2), it.holder.position.z);
  else if (it.kind === 'x') { out.copy(it.holder.position); if (!mid) out.y += cutHalfHeight(it); }
  else if (it.kind === 'g') { const b = groupBox(it, new THREE.Box3()); if (b.isEmpty()) out.set(0, -100, 0); else out.set((b.min.x + b.max.x) / 2, mid ? (b.min.y + b.max.y) / 2 : b.max.y + 0.04, (b.min.z + b.max.z) / 2); }
  else out.copy(it.holder.position).setY(it.holder.position.y + (mid ? 0 : 0.14));
  return out;
}
// a label's point (the engine's hover and selection labels: anchors in the stage's frame, which is the scene's)
function itemTop(id) {
  const it = STU.items.get(id);
  return it ? itemTopInto(it, new THREE.Vector3(), false).toArray() : [0, -100, 0];
}

// --------------------------------------------------------------- emitters --
// A sound placed at a point: played through the shell's one context (HOST.audio.fx()), each through an HRTF panner
// (inverse distance, full volume within r, rolloff 1, at most 50 m) and its own gain (vol) to the context's output. In
// a headset the listener is your head (the shell's HOST.sfx.listen puts it there too); on a page this camera. Silent
// while the context is not there (before a tap, hidden, the <audio> engine chosen) or this device's Sound button is off
// (they fade out, and are rebuilt on a new context); not the Sound effects or Narration switches: these are the scene's
// own sounds. 'always' loops start at the same moment for everyone at a station (the room's time modulo their length).
// A sound longer than 20 s is streamed (snd: it.F.stream): an <audio> element per emitter (crossOrigin anonymous, the
// relay's password as ?token=) through createMediaElementSource on the same context into its gain and panner; paused,
// not torn down, while the context is away or the device muted, and set to the right moment again when it comes back;
// on a new context (the shell's renew) a new element (an element can feed one context only)
const EM = { ctx: null, lis: false };
const _ep = new THREE.Vector3(), _eq = new THREE.Quaternion(), _ef = new THREE.Vector3(), _eu = new THREE.Vector3();
function emitStep(now) {
  const A = HOST.audio, ctx = A && A.fx ? A.fx() : null;
  if (ctx !== EM.ctx) {
    emitAll();
    // (a new context: streamed sounds made on another one go now, heard or not; none: they wait, paused, for it to return)
    if (ctx) for (const it of STU.items.values()) if (it.st && it.st.ctx !== ctx) streamDrop(it);
    sndForget(); EM.ctx = ctx;
  }
  if (!ctx) return;
  const quiet = !!(A && A.muted) || APP.mode !== 'explore' || sfxHidden() || !STU.scene;
  let any = false;
  for (const it of STU.items.values()) {
    if (it.kind !== 's') continue;
    const F = it.F;
    if (F && (F.state === 'bytes' || (F.state === 'ready' && F.ctx !== ctx))) sndDecode(F, ctx);
    const want = quiet ? 0 : it.fa * it.rec.vol;   // (its own fade times that of the object it follows)
    if (!it.src && want > 0.0005 && !it.ended && F && F.state === 'ready' && F.ctx === ctx) emitStart(it, ctx, F.buf, now);
    else if (!it.src && want > 0.0005 && !it.ended && F && F.state === 'stream' && !(now - (it.stFail || -1e9) < 2000)) streamStart(it, ctx, F, now);
    if (!it.src) continue;
    any = true;
    if (it.gt !== want) { try { it.gain.gain.setTargetAtTime(want, ctx.currentTime, 0.1); } catch (e) { /* closed */ } it.gt = want; }
    it.holder.getWorldPosition(_ep);
    setPos(it.pan, _ep);
    if (it.pan.refDistance !== it.rec.r) it.pan.refDistance = it.rec.r;
    if (want <= 0.0005) { if (!it.zeroAt) it.zeroAt = now; if (now - it.zeroAt > 700) emitStop(it); } else it.zeroAt = 0;
  }
  // the listener: your head in a headset, the camera on a page
  if (any) {
    if (XR.on && GL.renderer.xr.isPresenting) { _ep.copy(XR.head); _eq.copy(XR.headQ); } else { GL.camera.getWorldPosition(_ep); GL.camera.getWorldQuaternion(_eq); }
    listen(ctx, _ep, _eq);
    EM.lis = true;
  }
}
function setPos(n, p) {
  try { if (n.positionX) { n.positionX.value = p.x; n.positionY.value = p.y; n.positionZ.value = p.z; } else n.setPosition(p.x, p.y, p.z); } catch (e) { /* an old engine */ }
}
function listen(ctx, p, q) {
  const L = ctx.listener;
  if (!L) return;
  _ef.set(0, 0, -1).applyQuaternion(q); _eu.set(0, 1, 0).applyQuaternion(q);
  try {
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = _ef.x; L.forwardY.value = _ef.y; L.forwardZ.value = _ef.z; L.upX.value = _eu.x; L.upY.value = _eu.y; L.upZ.value = _eu.z;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(_ef.x, _ef.y, _ef.z, _eu.x, _eu.y, _eu.z); }
  } catch (e) { /* an old engine */ }
}
// where a sound starts: a loop of 'always' in a room at the room's time, else from when the scene opened (or, 'shown',
// from when a cube showed it), modulo its length; a sound that does not loop and is over: -1
function emitOffset(it, dur, now) {
  const r = it.rec;
  let t = r.start === 'shown' ? (now - it.shownAt) / 1000 : r.loop ? sceneClock(now) : (now - STU.t0) / 1000;
  if (r.loop) return ((t % dur) + dur) % dur;
  t = Math.max(0, t);
  return t < dur - 0.05 ? t : -1;
}
function emitStart(it, ctx, buf, now) {
  const off = emitOffset(it, buf.duration || 1, now);
  if (off < 0) { it.ended = true; return; }
  try {
    const src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createPanner();
    src.buffer = buf; src.loop = !!it.rec.loop;
    g.gain.value = 0;
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = it.rec.r; p.rolloffFactor = 1; p.maxDistance = 50;
    it.holder.getWorldPosition(_ep); setPos(p, _ep);
    src.connect(g); g.connect(p); p.connect(ctx.destination);
    src.onended = () => { if (it.src !== src) return; emitStop(it); if (!it.rec.loop) it.ended = true; };
    src.start(ctx.currentTime + 0.02, off);
    Object.assign(it, { src, gain: g, pan: p, gt: -1, zeroAt: 0 });
  } catch (e) { it.ended = true; }
}
// stopped: a decoded sound's source goes; a streamed one is paused (drop: its element and nodes go too)
function emitStop(it, drop) {
  const s = it.src;
  if (it.st) {
    if (s) { it.src = null; try { it.st.gain.gain.setValueAtTime(0, it.st.ctx.currentTime); } catch (e) { /* closed */ } try { it.st.el.pause(); } catch (e) { /* gone */ } }
    if (drop) streamDrop(it);
    return;
  }
  if (!s) return;
  it.src = null;
  try { s.onended = null; s.stop(); } catch (e) { /* not started */ }
  for (const n of [s, it.gain, it.pan]) try { n.disconnect(); } catch (e) { /* gone */ }
  it.gain = it.pan = null;
}
// a streamed sound: its element (made once per context) set to the moment it should be at, and played
function streamStart(it, ctx, F, now) {
  let S = it.st;
  if (S && S.ctx !== ctx) { streamDrop(it); S = null; }
  const off = emitOffset(it, F.dur || 1, now);
  if (off < 0) { it.ended = true; return; }
  if (!S) {
    try {
      const el = new Audio();
      el.crossOrigin = 'anonymous'; el.preload = 'auto';
      const node = ctx.createMediaElementSource(el), g = ctx.createGain(), p = ctx.createPanner();
      g.gain.value = 0;
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = it.rec.r; p.rolloffFactor = 1; p.maxDistance = 50;
      node.connect(g); g.connect(p); p.connect(ctx.destination);
      el.addEventListener('ended', () => { if (it.st && it.st.el === el && it.src === el) { emitStop(it); if (!it.rec.loop) it.ended = true; } });
      el.src = fileUrl(F.path, true);
      S = it.st = { el, node, gain: g, pan: p, ctx, file: F.path };
    } catch (e) { it.ended = true; return; }
  }
  const el = S.el;
  el.loop = !!it.rec.loop;
  // (before its metadata an element ignores a new time: set once it has it)
  const seek = () => { try { el.currentTime = off; } catch (e) { /* not seekable yet */ } };
  if (el.readyState >= 1) seek(); else el.addEventListener('loadedmetadata', seek, { once: true });
  const pr = el.play();
  if (pr && pr.catch) pr.catch(() => { if (it.src === el) { emitStop(it); it.stFail = performance.now(); } });   // (not allowed yet: again in 2 s)
  Object.assign(it, { src: el, gain: S.gain, pan: S.pan, gt: -1, zeroAt: 0 });
}
function streamDrop(it) {
  const S = it.st;
  if (!S) return;
  it.st = null;
  if (it.src === S.el) { it.src = null; it.gain = it.pan = null; }
  try { S.el.pause(); S.el.removeAttribute('src'); S.el.load(); } catch (e) { /* gone */ }
  for (const n of [S.node, S.gain, S.pan]) try { n.disconnect(); } catch (e) { /* gone */ }
}
function emitAll(drop) { for (const it of STU.items.values()) if (it.kind === 's') emitStop(it, drop); }

// ------------------------------------------------------------------ edits --
// Editing is this device's own (studioEdit), never in the state; refused while the station's story is locked (Lock
// this story) and never offered with &visit. Every change is recorded for Undo (this device's last 30): an undo writes
// the item's record as it was, removes what was added or puts back what was deleted
const UNDO = [];
function editLocked() {
  try {
    const st = HOST.collab && HOST.collab.live && HOST.collab.live();
    if (!st || st.story !== XR_HERE) return false;
    if (HOST.collab.stationLock && HOST.collab.stationLock(st.id)) return true;
    return !!(XR.on && HOST.room && HOST.room.placing && HOST.room.placing() && HOST.anchor.locked('globe'));
  } catch (e) { return false; }
}
const editOn = () => STU.edit && !OPT.visit && !!STU.scene && !editLocked();
function setEdit(on) {
  if (OPT.visit) return;
  STU.edit = !!on;
  store.set('studioEdit', STU.edit ? '1' : null);
  if (!STU.edit) { STU.pick = null; STU.follow = ''; STU.cutTo = ''; if (STU.gpick) gpickEnd(); STU.whole.clear(); STU.cutF.clear(); select(''); }   // (Preview is editing's only)
  sfxAct(STU.edit ? 'pick' : 'click', 'stage', 'centre');
  dirty(true);
}
let SNAP = null;
const snapNow = ids => new Map((ids ? ids.map(id => [id, STU.items.get(id)]) : [...STU.items]).map(([id, it]) => [id, it ? [it.kind, JSON.stringify(it.rec)] : null]));
// a change begins (a drag: only its items) and ends: what changed goes on the Undo list as one step
// (a change begun while another is open, the other hand carrying something else: its items join the open one)
function beginChange(ids) {
  if (!SNAP) { SNAP = { ids: ids || null, before: snapNow(ids) }; return; }
  if (!SNAP.ids) return;
  const more = (ids || [...STU.items.keys()]).filter(id => !SNAP.before.has(id));
  for (const [id, b] of snapNow(more)) SNAP.before.set(id, b);
  if (ids) SNAP.ids.push(...more); else SNAP.ids = null;
}
function endChange() {
  if (!SNAP) return;
  const { ids, before } = SNAP;
  SNAP = null;
  const list = [];
  for (const [id, b] of before) {
    const it = STU.items.get(id);
    if (!b) { if (it) list.push({ id, kind: it.kind, before: null }); continue; }
    if (!it || it.kind !== b[0] || JSON.stringify(it.rec) !== b[1]) list.push({ id, kind: b[0], before: JSON.parse(b[1]) });
  }
  if (!ids) for (const [id, it] of STU.items) if (!before.has(id)) list.push({ id, kind: it.kind, before: null });
  if (list.length) { UNDO.push(list); if (UNDO.length > 30) UNDO.shift(); }
  changed();
}
function change(fn, ids) { const outer = !!SNAP; if (!outer) beginChange(ids); try { fn(); } finally { if (!outer) endChange(); } }
function undo() {
  if (SNAP) return;
  const list = UNDO.pop();
  if (!list) return;
  undoList(list);
  sfxAct('rise', 'stage', 'centre', { dur: 0.5, gain: 0.5 });
}
// a step taken back: each item's record as it was, what was added removed, what was deleted put back (a group picking its
// members picks on, unless this took it away: removeItem); a group it left with fewer than 2 members picks again, or goes
// (groupUndone, e6c_groups.js)
function undoList(list) {
  for (const u of list.slice().reverse()) { if (u.before) putItem(u.id, u.kind, u.before); else removeItem(u.id); }
  for (const it of STU.items.values()) { if (it.cutNote) it.cutNote = ''; if (it.note) it.note = ''; }   // (a cut-out, or a group's member, held at a limit by a sizing: undone)
  groupUndone(list);
  changed();
}
// what changed here: the panes (soon), the draft (a second later)
function changed() { STU.rev++; draftSoon(); dirty(); }
function setRec(id, patch) {
  const it = STU.items.get(id);
  if (!it) return null;
  const rec = norm(it.kind, Object.assign({}, it.rec, patch));   // (a field patched to undefined goes)
  return rec ? putItem(id, it.kind, rec) : null;
}
// an object's record changed by an edit here (its size steps, both grips, the page's arrows): the sounds that follow it
// keep their place on it as it is sized, their offsets scaled by its size's ratio since the change began, and so do its
// cut-outs (their middles and sizes; their records as they were then join the change: one Undo step); never for a record
// from the room, which carries theirs
function setObj(id, patch) {
  const it = STU.items.get(id), s0 = it ? it.rec.s : 0, r = setRec(id, patch);
  if (r && it.kind === 'o' && it.rec.s !== s0) scaleFollowers(it);
  return r;
}
// (each value kept within what a record takes, so the record is never refused: a cut-out's side 1 cm to 50 m, a place
// or an offset within 1 km; one held at a limit is said on the object's card, cutNote, since sizing back cannot undo it)
function scaleFollowers(ob) {
  const fs = [...STU.items.values()].filter(x => (x.kind === 's' || x.kind === 'x') && x.rec.on === ob.id);
  ob.cutNote = '';
  if (!fs.length || !SNAP) return;
  beginChange(fs.map(x => x.id));
  const was = id => { const b = SNAP.before.get(id); return b && b[1] ? JSON.parse(b[1]) : null; }, b0 = was(ob.id);
  if (!b0 || !(b0.s > 0)) return;
  const k = ob.rec.s / b0.s, held = [], lim = (v, a, b, f) => { const c = clamp(v, a, b); if (c !== v && !held.includes(f.rec.name)) held.push(f.rec.name); return c; };
  for (const f of fs) {
    const fb = was(f.id);
    if (!fb || fb.on !== ob.id) continue;
    if (f.kind === 'x') setRec(f.id, { p: fb.p.map(v => lim(v * k, -1000, 1000, f)), size: fb.size.map(v => lim(v * k, 0.01, 50, f)) });
    else if (fb.o) setRec(f.id, { o: fb.o.map(v => lim(v * k, -1000, 1000, f)) });
  }
  if (held.length) ob.cutNote = `Sized this far, ${held.join(', ')} ${held.length > 1 ? 'are' : 'is'} held at the limit (a cut-out's side 1 cm to 50 m, within 1 km of the model): sizing back does not undo that; Undo does.`;
}
// a sound's place written from where it is now (p) and, following something there, its offset against it as it is now
// (its bone's model not here yet: p alone, measureNode)
function soundAt(it, pos) {
  const nd = it.rec.on ? measureNode(it) : null;
  return nd ? { p: pos.toArray(), o: offsetAt(nd, pos, followK(followOf(it))) } : { p: pos.toArray() };
}
const newId = () => { let id; do { id = Array.from({ length: 6 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]).join(''); } while (STU.items.has(id)); return id; };
function nameFor(base) {
  base = words(base, 54) || 'Item';
  const names = new Set([...STU.items.values()].map(it => it.rec.name));
  if (!names.has(base)) return base;
  for (let n = 2; ; n++) if (!names.has(base + ' ' + n)) return base + ' ' + n;
}
const countOf = k => [...STU.items.values()].filter(it => it.kind === k).length;
const canAdd = k => editOn() && STU.listing === 'ok' && countOf(k) < LIMITS[k];
// 1.5 m in front of you on the floor, in the scene's frame: your head in a headset, the camera in Walk view, the
// middle of the view in Orbit view
const _fh = new THREE.Vector3(), _fd = new THREE.Vector3();
function frontAt(d) {
  d = d === undefined ? 1.5 : d;
  if (XR.on && GL.renderer.xr.isPresenting) {
    GL.world.updateMatrixWorld(true);
    GL.world.worldToLocal(_fh.copy(XR.head));
    _fd.set(0, 0, -1).applyQuaternion(XR.headQ).applyQuaternion(GL.world.getWorldQuaternion(_eq).invert());
  } else if (APP.mode === 'explore' && X.view === 'walk') { _fh.copy(WALK.pos); _fd.set(-Math.sin(WALK.yaw), 0, -Math.cos(WALK.yaw)); }
  else { const v = orbit.cur; return [v[3], v[5]]; }
  _fd.y = 0;
  if (_fd.lengthSq() < 1e-6) _fd.set(0, 0, -1);
  _fd.normalize();
  return [_fh.x + _fd.x * d, _fh.z + _fd.z * d];
}
function addModel(path) {
  if (!canAdd('o') || !STU.fileMap.has(path)) return '';
  const at = frontAt(), id = newId(), E = lib(path);
  change(() => {
    const it = putItem(id, 'o', norm('o', { name: nameFor(stem(path)), file: path, p: [at[0], 0, at[1]] }));
    if (!it) return;
    if (E.state === 'ready' && E.info) placeFresh(it, at); else it.fresh = at;
  });
  select(id);
  sfxAct('place', 'world', null);
  return id;
}
function addSound(path) {
  if (!canAdd('s') || !STU.fileMap.has(path)) return '';
  const at = frontAt(), id = newId();
  change(() => putItem(id, 's', norm('s', { name: nameFor(stem(path)), file: path, p: [at[0], 1.2, at[1]] })));
  select(id);
  sfxAct('place', 'world', null);
  return id;
}
function addCube() {
  if (!canAdd('c')) return '';
  const at = frontAt(), id = newId();
  change(() => putItem(id, 'c', norm('c', { name: nameFor('Cube'), p: [at[0], 1, at[1]], size: [1.2, 2, 1.2] })));
  select(id);
  sfxAct('place', 'world', null);
  return id;
}
function deleteItem(id) {
  const it = STU.items.get(id);
  if (!editOn() || !it) return;
  // (a group: every member with it, in the same step)
  const list = it.kind === 'g' ? members(it).map(m => m.id).concat(id) : [id];
  let gone = new Set();
  change(() => { gone = deleteItems(list); });
  if (STU.pick && gone.has(STU.pick.id)) STU.pick = null;
  sfxAct('snap', 'stage', 'centre');
}
// items deleted together (within a change): an object's cut-outs go with it; the cubes that list them let them go; the
// sounds that follow a deleted object and stay stand where they are, following nothing; the groups that hold them let them
// go, and one left with fewer than 2 members goes too (not the one picking its members now). Undo brings all back
function deleteItems(list) {
  const gone = new Set();
  for (const id of list) { gone.add(id); for (const x of cutsOn(id)) gone.add(x.id); }
  const out = l => l.filter(i => !gone.has(i));
  for (const c of [...STU.items.values()]) if (c.kind === 'c' && !gone.has(c.id) && (c.rec.show.some(i => gone.has(i)) || c.rec.hide.some(i => gone.has(i)))) setRec(c.id, { show: out(c.rec.show), hide: out(c.rec.hide) });
  for (const f of [...STU.items.values()]) if (f.kind === 's' && !gone.has(f.id) && gone.has(f.rec.on)) setRec(f.id, { on: undefined, bone: undefined, o: undefined, p: f.holder.position.toArray() });
  const gs = [...STU.items.values()].filter(g => g.kind === 'g' && !gone.has(g.id) && g.rec.items.some(i => gone.has(i)));
  for (const g of gs) setRec(g.id, { items: out(g.rec.items) });
  for (const g of gone) removeItem(g);
  groupTidy(gs);
  return gone;
}
function duplicateItem(id) {
  const it = STU.items.get(id);
  if (!it || !canAdd(it.kind)) return '';
  if (it.kind === 'x') return duplicateCut(it);   // (beside it, on the same object: e6b_cuts.js)
  if (it.kind === 'g') return duplicateGroup(it);   // (every member, as a new group beside it: e6c_groups.js)
  const nid = newId(), o = it.rec.o || [0, 0, 0];
  // (a sound that follows something: its copy follows it too, nudged as the copy is, in its offset; an object's copy
  // takes none of its sounds, but its cut-outs, each onto the copy where it is on the object)
  change(() => {
    putItem(nid, it.kind, norm(it.kind, Object.assign({}, it.rec, { name: nameFor(it.rec.name.replace(/ \d+$/, '')), p: [it.rec.p[0] + 0.5, it.rec.p[1], it.rec.p[2]] },
      it.kind === 's' && it.rec.on ? { o: [o[0] + 0.5, o[1], o[2]] } : {})));
    // (each cut-out's copy in the cube lists its original is in: a door a cube opens opens in the copy too, cubeCopy)
    if (it.kind === 'o') for (const x of cutsOn(id)) { const xid = newId(); if (countOf('x') < LIMITS.x && putItem(xid, 'x', norm('x', Object.assign({}, x.rec, { on: nid, name: nameFor(x.rec.name.replace(/ \d+$/, '')) })))) cubeCopy(x.id, xid); }
  });
  select(nid);
  sfxAct('place', 'world', null);
  return nid;
}
// an object's box as placed now (its turn and scale), in the scene's frame
function objBox(it, q, s) {
  if (!it.E || !it.E.info) return null;
  const b = placedBox(it.E, q || it.rec.q, s === undefined ? it.rec.s : s);
  return b.translate(_sv.fromArray(it.rec.p));
}
// the item pane's actions (page and headset alike)
const _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion();
const ITEM_ACT = {
  light: (it, v) => setRec(it.id, { light: v }),
  anim: (it, v) => setRec(it.id, { anim: v }),
  start: (it, v) => setRec(it.id, { start: v }),
  clip: it => { const cl = it.E && it.E.clips ? it.E.clips.map(c => c.name) : []; if (!cl.length) return; const i = cl.indexOf(it.rec.clip); setRec(it.id, { clip: cl[(i + 1) % cl.length] }); },
  // a quarter turn about the vertical, or about x (standing up a model lying on its back), about its middle (a group:
  // about its pivot, the vertical only)
  turn: it => turnAbout(it, _tq.setFromAxisAngle(_yUp, Math.PI / 2)),
  stand: it => turnAbout(it, _tq.setFromAxisAngle(_ax, -Math.PI / 2)),
  floor: it => { if (it.kind === 'g') { groupFloor(it); return; } const b = objBox(it); if (b) setRec(it.id, { p: [it.rec.p[0], it.rec.p[1] - b.min.y, it.rec.p[2]] }); },
  // its faces: as in its file, both sides or inside out (an object's own: applyFaces)
  faces: (it, v) => { if (it.kind === 'o') setRec(it.id, { faces: v === 'both' || v === 'inside' ? v : undefined }); },
  // sizes about its foot (the middle of its lowest side stays where it is); the sounds that follow it keep their place on it
  // (a group: every member, about its pivot)
  size: (it, k) => {
    if (it.kind === 'g') { if (+k > 0) groupMove(groupBase(it), new THREE.Vector3(), 0, +k, true); return; }
    const b0 = objBox(it), s = Math.min(1e4, Math.max(1e-4, it.rec.s * k));
    if (!b0) { setObj(it.id, { s }); return; }
    const b1 = objBox(it, null, s), dx = (b0.min.x + b0.max.x - b1.min.x - b1.max.x) / 2, dz = (b0.min.z + b0.max.z - b1.min.z - b1.max.z) / 2;
    setObj(it.id, { s, p: [it.rec.p[0] + dx, it.rec.p[1] + b0.min.y - b1.min.y, it.rec.p[2] + dz] });
  },
  dup: it => duplicateItem(it.id),
  del: it => deleteItem(it.id),
  // a cube: 10 cm more or less on one side (its foot stays on its height), while inside or once entered, its lists
  grow: (it, v) => {
    const [ax, d] = v.split(':'), i = +ax, size = it.rec.size.slice(), p = it.rec.p.slice();
    size[i] = Math.max(0.1, r3(size[i] + (+d))); if (i === 1) p[1] = r3(p[1] + (size[1] - it.rec.size[1]) / 2);
    setRec(it.id, { size, p });
  },
  mode: (it, v) => setRec(it.id, { mode: v }),
  pickFor: (it, v) => { STU.pick = STU.pick && STU.pick.id === it.id && STU.pick.list === v ? null : { id: it.id, list: v }; },
  // a sound: its volume and its full-volume distance in steps, looping or not
  vol: (it, d) => { const S = [0, 0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2], i = S.findIndex(x => x >= it.rec.vol - 1e-6); setRec(it.id, { vol: S[clamp((i < 0 ? S.length - 1 : i) + (+d), 0, S.length - 1)] }); },
  reach: (it, d) => { const S = [0.25, 0.5, 1, 1.5, 2, 3, 5, 8, 12, 20], i = S.findIndex(x => x >= it.rec.r - 1e-6); setRec(it.id, { r: S[clamp((i < 0 ? S.length - 1 : i) + (+d), 0, S.length - 1)] }); },
  loop: (it, v) => setRec(it.id, { loop: v === 'on' }),
  // a sound: what it follows, from where it is now (an object, then one of its bones; the offset worked out here), onto
  // it (no offset), or nothing (where it is now); picking the object by pointing (followPick), the card's list of bones
  follow: (it, oid) => {
    const o = STU.items.get(oid);
    STU.follow = '';
    // (the object it follows already: nothing changes, its bone kept; Whole model is one of the bone choices)
    if (it.kind === 's' && o && o.kind === 'o' && it.rec.on !== oid) setRec(it.id, { on: oid, bone: undefined, o: offsetAt(o.holder, it.holder.position, followK(o)) });
  },
  bone: (it, name) => {
    const o = followOf(it), nd = name ? nodeOf(o, name) : o && o.holder;
    if (nd) setRec(it.id, { bone: name || undefined, o: offsetAt(nd, it.holder.position, followK(o)) });   // (a bone this model lacks: refused)
  },
  onto: it => { const nd = followNode(it); if (nd) setRec(it.id, { o: undefined, p: followPoint(nd, null, new THREE.Vector3()).toArray() }); },
  unfollow: it => setRec(it.id, { on: undefined, bone: undefined, o: undefined, p: it.holder.position.toArray() }),
  followPick: it => { if (it.kind === 's') STU.follow = STU.follow === it.id ? '' : it.id; },
  bones: it => { STU.bones = STU.bones === it.id ? '' : it.id; STU.bonePage = 0; },
  bonePage: (it, d) => { STU.bonePage = Math.max(0, STU.bonePage + (+d || 0)); },
};
const PANE_ONLY = ['pickFor', 'followPick', 'bones', 'bonePage', 'cutPick', 'preview', 'gpick'];   // (the card's own state, or this device's: no change to record)
function itemAct(act, v, id) {
  const it = STU.items.get(id || STU.sel);
  if (!it || !editOn() || !ITEM_ACT[act]) return;
  if (PANE_ONLY.includes(act)) { ITEM_ACT[act](it, v); dirty(true); return; }
  if (act === 'mkgroup' && STU.gpick) gpickEnd();   // (another group's picking ends first, in a step of its own)
  change(() => ITEM_ACT[act](it, v));
  if (act === 'mkgroup' && STU.gpick && STU.gpick.made && !STU.gpick.step) STU.gpick.step = UNDO[UNDO.length - 1];   // (the step that made it: Done with one member takes it back)
  sfxAct(act === 'del' ? 'snap' : act === 'follow' || act === 'cutOn' || act === 'mkgroup' ? 'link' : 'click', 'world', null);
}
function turnAbout(it, q) {
  if (it.kind === 'x') { cutTurn(it); return; }   // (a quarter turn about its own upright: e6b_cuts.js)
  if (it.kind === 'g') { groupMove(groupBase(it), new THREE.Vector3(), Math.PI / 2, 1, true); return; }   // (about its pivot: e6c_groups.js)
  if (it.kind !== 'o') { if (it.kind === 'c') setRec(it.id, { yaw: it.rec.yaw + Math.PI / 2 }); return; }
  const b = objBox(it), mid = b ? b.getCenter(new THREE.Vector3()) : new THREE.Vector3().fromArray(it.rec.p);
  const nq = _tq2.copy(q).multiply(_pq.fromArray(it.rec.q)).normalize(), p = new THREE.Vector3().fromArray(it.rec.p).sub(mid).applyQuaternion(q).add(mid);
  setRec(it.id, { q: nq.toArray(), p: p.toArray() });
}
// a cube's list (show or hide) with an item in it, or out of it (in one list of a cube at most)
function toggleLink(cubeId, list, id) { toggleLinks(cubeId, list, [id]); }
// several at once (a group's members): out of the list when all of them are in it, else all in it (one change)
function toggleLinks(cubeId, list, ids) {
  const c = STU.items.get(cubeId);
  ids = ids.filter(i => i !== cubeId && STU.items.has(i) && STU.items.get(i).kind !== 'c' && STU.items.get(i).kind !== 'g');
  if (!c || c.kind !== 'c' || !ids.length || !editOn()) return;
  const other = list === 'show' ? 'hide' : 'show', on = ids.every(i => c.rec[list].includes(i)), not = l => l.filter(i => !ids.includes(i));
  change(() => setRec(cubeId, { [list]: on ? not(c.rec[list]) : not(c.rec[list]).concat(ids), [other]: not(c.rec[other]) }));
  sfxAct(on ? 'snap' : 'link', 'world', null);
}
// select an item (its card), or none
function select(id) {
  id = STU.items.has(id) ? id : '';
  if (id === STU.sel) return;
  STU.sel = id;
  if (STU.pick && STU.pick.id !== id) STU.pick = null;   // (picking belongs to the cube on the card)
  if (STU.follow && STU.follow !== id) STU.follow = '';   // (and to the sound)
  if (STU.cutTo && STU.cutTo !== id) STU.cutTo = '';   // (and to the cut-out)
  if (STU.gpick && STU.gpick.id !== id) gpickEnd();   // (and to the group: one left with one member goes)
  if (id && typeof X !== 'undefined') X.tab = 'item';
  tcAttach();
  dirty(true);
}

// --------------------------------------------------------- shared rooms --
// What everyone at the station sees alike: the scene's name and one top-level field per item (its record: o.<id>,
// c.<id>, s.<id>, x.<id>, g.<id>), so two people changing two items at once both keep theirs. Never the camera, triggers, editing, the selection or sound.
// Life size in a headset: no view to share.
function collabView() { return null; }
function collabSetView(v, now) { /* nothing to set */ }
function collabState() {
  const s = { scene: STU.scene };
  for (const it of STU.items.values()) s[it.kind + '.' + it.id] = it.rec;
  return s;
}
function collabApply(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return;
  if (typeof v.scene === 'string' && (v.scene === '' || okScene(v.scene)) && v.scene !== STU.scene) openScene(v.scene, 'room');
  const keep = new Set(), n = { o: 0, c: 0, s: 0, x: 0, g: 0 };
  for (const k of Object.keys(v)) {
    const m = /^([ocsxg])\.([a-z0-9]{6})$/.exec(k);
    if (!m || keep.has(m[2])) continue;
    const it = STU.items.get(m[2]), rec = n[m[1]] < LIMITS[m[1]] ? norm(m[1], v[k]) : null;
    if (!rec) { if (it && it.kind === m[1]) keep.add(m[2]); continue; }   // (a bad record: ignored, the item kept as it is)
    keep.add(m[2]); n[m[1]]++;
    if (it && it.kind === m[1] && JSON.stringify(it.rec) === JSON.stringify(rec)) continue;
    putItem(m[2], m[1], rec, { glide: true });
  }
  for (const id of [...STU.items.keys()]) if (!keep.has(id)) removeItem(id);
  dirty();
}
function studioEffect() { /* none */ }
