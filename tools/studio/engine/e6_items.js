
// ================================================================== ITEMS ==
// What is placed in the scene: objects (a model file placed once; one file may be placed many times), trigger cubes
// and sounds. Each has a record (as in layout.json, without its id), checked the same way wherever it comes from (the
// layout, the room, an edit here), so a record taken and given back is the same. Records are never changed in place:
// each change is a new record (the shared room keeps the old one to compare with).
const STU = {
  scene: '', listing: 'none', files: [], fileMap: new Map(), items: new Map(),
  saved: '', savedAt: 0, savedBy: '', layoutAt: 0, bad: 0, note: '', saveNote: '', upNote: '', saving: false, loadAsk: 0, draft: null, mine: 0,
  sel: '', hover: '', pick: null, edit: false, gen: 0, write: false, t0: performance.now(), seen: new Set(), act: 0, libRev: 0, rev: 0, head: null,
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
  const p = vecOf(x.p, 3, 1000);
  if (!p) return null;
  const P = p.map(v => nz(r3(v)));
  const name = d => (!has('name') ? d : typeof x.name === 'string' && x.name.trim() ? words(x.name, 60) : null);
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
    const r = { name: name(stem(x.file)), file: x.file, p: P, vol: has('vol') ? r2(Math.min(2, Math.max(0, x.vol))) : 1, r: has('r') ? r2(Math.min(20, Math.max(0.1, x.r))) : 1.5,
      loop: has('loop') ? x.loop : true, start: one('start', ['always', 'shown'], 'always') };
    return Object.values(r).includes(null) ? null : r;
  }
  return null;
}
const KIND_NAME = { o: 'object', c: 'trigger cube', s: 'sound' };

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
  const it = { id, kind, rec: null, holder: null, a: 0, sa: 0, shown: false, first: true, shownAt: performance.now(), gl: null, carry: false, act: false, since: 0, inside: false, ended: false };
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
  } else {
    it.look = LOOKS.speaker(id);
    it.holder = it.look.group;
    it.look.hit.userData.id = id;
    GL.edit.add(it.look.ring);
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
  else { it.look.drop(); if (it.look.deco) GL.edit.remove(it.look.deco); if (it.look.ring) GL.edit.remove(it.look.ring); }
  if (it.kind === 's') emitStop(it, true);
  if (it.tick) { GL.edit.remove(it.tick); it.tick.userData.drop(); }
  if (it.holder.parent) it.holder.parent.remove(it.holder);
  if (GL.tc && GL.tc.object === it.holder) GL.tc.detach();
  if (STU.sel === id) STU.sel = '';
  if (STU.hover === id) STU.hover = '';
  STU.seen.delete(id);   // (a staying cube put back by Undo waits to be entered again)
  for (const c of XR.ctrls || []) if (c.grab && c.grab.id === id) c.grab = null;
}
function clearItems() { for (const id of [...STU.items.keys()]) removeItem(id); emitAll(true); sndClear(); }
// where a record puts its item: its place, turn and scale (a cube's scale is its size; it stays level)
const _pp = new THREE.Vector3(), _pq = new THREE.Quaternion(), _ps = new THREE.Vector3(), _yUp = new THREE.Vector3(0, 1, 0);
function poseOf(it) {
  const r = it.rec;
  _pp.fromArray(r.p);
  if (it.kind === 'o') { _pq.fromArray(r.q); _ps.setScalar(r.s); }
  else if (it.kind === 'c') { _pq.setFromAxisAngle(_yUp, r.yaw); _ps.fromArray(r.size); }
  else { _pq.identity(); _ps.set(1, 1, 1); }
}
function applyRec(it, was, glide) {
  if (glide && !it.carry) it.gl = { p: it.holder.position.clone(), q: it.holder.quaternion.clone(), s: it.holder.scale.clone(), t0: performance.now() };
  else if (!it.carry) { it.gl = null; poseOf(it); it.holder.position.copy(_pp); it.holder.quaternion.copy(_pq); it.holder.scale.copy(_ps); }
  const r = it.rec;
  if (it.kind === 'o') {
    if (!was || was.file !== r.file) itemFile(it);
    if (!was || was.light !== r.light) applyLight(it);
    if (!was || was.clip !== r.clip || was.anim !== r.anim || was.start !== r.start) it.animKey = '';
  } else if (it.kind === 'c') it.look.name.userData.set(r.name, it.look.col, 0.085);
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
  it.light = mode; it.aSet = -1;
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
    if (it.kind === 'c') continue;
    const s = S.get(it.id) || 0, h = H.get(it.id) || 0, shown = s || h ? s >= h : !LISTS.shown.has(it.id);
    if (shown && (!it.shown || it.first)) { it.shownAt = now; it.ended = false; if (it.kind === 's' && it.rec.start === 'shown') emitStop(it); }
    it.shown = shown; it.first = false;
  }
}
// what is shown for you with your head at p (the tests: [x, y, z] in the scene's frame, or null for nobody)
function shownFor(p) {
  STU.head = p ? p.slice(0, 3) : null;
  triggerStep(performance.now());
  return Object.fromEntries([...STU.items.values()].filter(it => it.kind !== 'c').map(it => [it.id, it.shown]));
}
function resetSeen() { STU.seen.clear(); for (const c of STU.items.values()) if (c.kind === 'c') c.act = false; dirty(true); }

// ----------------------------------------------------------- every frame --

const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
function itemsStep(dt, now) {
  const editing = editOn(), clockS = sceneClock(now), fade = dt / 0.4;
  triggerStep(now);
  for (const it of STU.items.values()) {
    // a record from the room: it glides there (0.25 s), unless carried here
    if (it.gl && !it.carry) {
      const k = smooth((now - it.gl.t0) / 250);
      poseOf(it);
      it.holder.position.lerpVectors(it.gl.p, _pp, k);
      it.holder.quaternion.copy(it.gl.q).slerp(_pq, k);
      it.holder.scale.lerpVectors(it.gl.s, _ps, k);
      if (k >= 1) it.gl = null;
    }
    const tgt = it.kind === 'c' ? (editing ? 1 : 0) : it.shown ? 1 : editing && it.kind === 'o' ? 0.3 : 0;
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
    } else {
      const L = it.look;
      it.holder.visible = L.ring.visible = editing;
      if (editing) {
        L.ring.position.set(it.holder.position.x, 0.004, it.holder.position.z);
        L.ring.scale.setScalar(it.rec.r);
        L.look({ hot: STU.hover === it.id, selected: STU.sel === it.id, on: !!it.src && it.sa > 0.5 });
      }
    }
  }
  editStep(editing);
  emitStep(now);
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
    if (it.kind === 'c') continue;
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
    const want = quiet ? 0 : it.sa * it.rec.vol;
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
  if (!STU.edit) { STU.pick = null; select(''); }
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
  for (const u of list.slice().reverse()) { if (u.before) putItem(u.id, u.kind, u.before); else removeItem(u.id); }
  sfxAct('rise', 'stage', 'centre', { dur: 0.5, gain: 0.5 });
  changed();
}
// what changed here: the panes (soon), the draft (a second later)
function changed() { STU.rev++; draftSoon(); dirty(); }
function setRec(id, patch) {
  const it = STU.items.get(id);
  if (!it) return null;
  const rec = norm(it.kind, Object.assign({}, it.rec, patch));
  return rec ? putItem(id, it.kind, rec) : null;
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
  if (!editOn() || !STU.items.has(id)) return;
  change(() => {
    for (const c of [...STU.items.values()]) if (c.kind === 'c' && (c.rec.show.includes(id) || c.rec.hide.includes(id))) setRec(c.id, { show: c.rec.show.filter(i => i !== id), hide: c.rec.hide.filter(i => i !== id) });
    removeItem(id);
  });
  if (STU.pick && STU.pick.id === id) STU.pick = null;
  sfxAct('snap', 'stage', 'centre');
}
function duplicateItem(id) {
  const it = STU.items.get(id);
  if (!it || !canAdd(it.kind)) return '';
  const nid = newId();
  change(() => putItem(nid, it.kind, norm(it.kind, Object.assign({}, it.rec, { name: nameFor(it.rec.name.replace(/ \d+$/, '')), p: [it.rec.p[0] + 0.5, it.rec.p[1], it.rec.p[2]] }))));
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
  // a quarter turn about the vertical, or about x (standing up a model lying on its back), about its middle
  turn: it => turnAbout(it, _tq.setFromAxisAngle(_yUp, Math.PI / 2)),
  stand: it => turnAbout(it, _tq.setFromAxisAngle(_ax, -Math.PI / 2)),
  floor: it => { const b = objBox(it); if (b) setRec(it.id, { p: [it.rec.p[0], it.rec.p[1] - b.min.y, it.rec.p[2]] }); },
  // sizes about its foot (the middle of its lowest side stays where it is)
  size: (it, k) => {
    const b0 = objBox(it), s = Math.min(1e4, Math.max(1e-4, it.rec.s * k));
    if (!b0) { setRec(it.id, { s }); return; }
    const b1 = objBox(it, null, s), dx = (b0.min.x + b0.max.x - b1.min.x - b1.max.x) / 2, dz = (b0.min.z + b0.max.z - b1.min.z - b1.max.z) / 2;
    setRec(it.id, { s, p: [it.rec.p[0] + dx, it.rec.p[1] + b0.min.y - b1.min.y, it.rec.p[2] + dz] });
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
};
function itemAct(act, v, id) {
  const it = STU.items.get(id || STU.sel);
  if (!it || !editOn() || !ITEM_ACT[act]) return;
  if (act === 'pickFor') { ITEM_ACT.pickFor(it, v); dirty(true); return; }
  change(() => ITEM_ACT[act](it, v));
  sfxAct(act === 'del' ? 'snap' : 'click', 'world', null);
}
function turnAbout(it, q) {
  if (it.kind !== 'o') { if (it.kind === 'c') setRec(it.id, { yaw: it.rec.yaw + Math.PI / 2 }); return; }
  const b = objBox(it), mid = b ? b.getCenter(new THREE.Vector3()) : new THREE.Vector3().fromArray(it.rec.p);
  const nq = _tq2.copy(q).multiply(_pq.fromArray(it.rec.q)).normalize(), p = new THREE.Vector3().fromArray(it.rec.p).sub(mid).applyQuaternion(q).add(mid);
  setRec(it.id, { q: nq.toArray(), p: p.toArray() });
}
// a cube's list (show or hide) with an item in it, or out of it (in one list of a cube at most)
function toggleLink(cubeId, list, id) {
  const c = STU.items.get(cubeId);
  if (!c || c.kind !== 'c' || !STU.items.has(id) || id === cubeId || STU.items.get(id).kind === 'c' || !editOn()) return;
  const other = list === 'show' ? 'hide' : 'show', on = c.rec[list].includes(id);
  change(() => setRec(cubeId, { [list]: on ? c.rec[list].filter(i => i !== id) : c.rec[list].concat(id), [other]: c.rec[other].filter(i => i !== id) }));
  sfxAct(on ? 'snap' : 'link', 'world', null);
}
// select an item (its card), or none
function select(id) {
  id = STU.items.has(id) ? id : '';
  if (id === STU.sel) return;
  STU.sel = id;
  if (STU.pick && STU.pick.id !== id) STU.pick = null;   // (picking belongs to the cube on the card)
  if (id && typeof X !== 'undefined') X.tab = 'item';
  tcAttach();
  dirty(true);
}

// --------------------------------------------------------- shared rooms --
// What everyone at the station sees alike: the scene's name and one top-level field per item (its record), so two
// people changing two items at once both keep theirs. Never the camera, triggers, editing, the selection or sound.
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
  const keep = new Set(), n = { o: 0, c: 0, s: 0 };
  for (const k of Object.keys(v)) {
    const m = /^([ocs])\.([a-z0-9]{6})$/.exec(k);
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
