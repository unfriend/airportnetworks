
// =============================================================== CUT-OUTS ==
// A cut-out is a box that hides the part of one object's model inside it (a door in a wall), without changing the
// model's file (tools/studio/SPEC.md, "Cut-outs"). Its record: the object it cuts (on), and its middle (p), turn (q, a
// full turn) and size in that object's frame, turned but not scaled (metres), so it stays on the same part of the model
// when the object is moved or turned; sized here, the object scales its cut-outs' records with it (scaleFollowers), and
// switched to its GLB they are turned by the turn baked in (switchToGLB). An object's model takes a small addition to
// its materials once it has a cut-out (cutPatch): each fragment's place in the world (after skinning and morphs) is
// tested against the object's cut-outs cutting now (up to 16: CUT_MAX, the lowest ids, so every device cuts the same
// ones), and one inside any of them is not drawn. One program per kind of material (the count a uniform, not a define:
// the model's first cut-out compiles its patched programs once, the next boxes nothing), each object's boxes handed to
// its own materials as it is drawn (cutUpload, from onBeforeRender, once the scene's matrices are this frame's: the scene
// moves in a headset). A trigger cube shows or hides a cut-out as any item: hidden for you, it cuts nothing (the model
// whole), switching as its fade crosses one half (a cut cannot fade; a cut-out new here takes its state at once). While
// editing its box is drawn (LOOKS.cut), and Preview may show it cut or whole whatever the cubes say (this device only);
// else only the hole. Nothing is written to the model's file.
const CUT_MAX = 16, CUT_DEF = [0.8, 2, 0.4];
// the object a cut-out cuts (null: none here, a dangling one: it is kept and cuts nothing), an object's cut-outs
const cutObj = x => { const o = x && x.kind === 'x' ? STU.items.get(x.rec.on) : null; return o && o.kind === 'o' ? o : null; };
const cutsOn = id => [...STU.items.values()].filter(x => x.kind === 'x' && x.rec.on === id);
// an object can take another cut-out (16 at most on one model, 100 in a scene)
const canCut = ob => !!ob && ob.kind === 'o' && !ob.rec.cutsLocked && canAdd('x') && cutsOn(ob.id).length < CUT_MAX;
// an object's cut-outs locked (v124; the owner, 8 November 2026: "add cutout lock mode where the cutouts for an object are
// locked and cannot be moved anymore, cutout boxes should be hidden then but show again if it is unlocked"): the
// object's record says cutsLocked; its cut-outs cut as before, but their boxes are never drawn or pointed at, they do not
// move, size, turn or go (lockNames), no cut-out is added to it or moved onto it, and the object is not deleted until
// they are unlocked. On its card, shared and saved; a copy's are not locked
const cutsHid = x => { const o = cutObj(x); return !!(o && o.rec.cutsLocked); };
// where its record puts a cut-out in the scene's frame: in the object's frame, turned but not scaled, at the object's
// place, turn and size as shown now (followK: between both grips' writes, or while a size from the room glides in);
// dangling, its record in the scene's frame
function cutPose(x, p, q, s) {
  const r = x.rec, ob = cutObj(x);
  p.fromArray(r.p); q.fromArray(r.q); s.fromArray(r.size);
  if (!ob) return;
  const H = ob.holder, k = followK(ob);
  p.multiplyScalar(k).applyQuaternion(H.quaternion).add(H.position);
  q.premultiply(H.quaternion);
  s.multiplyScalar(k);
}
// the record's p, q and size for a box at p, q, s (the scene's frame) on object ob, as it is shown now (null: the
// scene's frame itself)
function cutRecFrom(ob, p, q, s) {
  const P = p.clone(), Q = q.clone(), S = s.clone();
  if (ob) {
    const k = followK(ob), iq = ob.holder.quaternion.clone().invert();
    P.sub(ob.holder.position).applyQuaternion(iq).divideScalar(k); Q.premultiply(iq); S.divideScalar(k);
  }
  return { p: P.toArray(), q: Q.normalize().toArray(), size: S.toArray().map(Math.abs) };
}
// a cut-out's record from where its box is now (carried by the grip or the page's arrows), on its object (or another)
const cutRecOf = (x, ob) => cutRecFrom(ob === undefined ? cutObj(x) : ob, x.holder.position, x.holder.quaternion, x.holder.scale);
// half its box's height (the scene's upright), turned as it is: its label stands over it
const _cr = new THREE.Matrix4();
function cutHalfHeight(x) {
  const e = _cr.makeRotationFromQuaternion(x.holder.quaternion).elements, s = x.holder.scale;
  return (Math.abs(e[1]) * s.x + Math.abs(e[5]) * s.y + Math.abs(e[9]) * s.z) / 2;
}
// its box's 8 corners in the scene's frame (the tests, and the room's check that every device cuts the same place)
function cutCorners(x) {
  x.holder.updateWorldMatrix(true, false);
  const m = _cr.copy(GL.items.matrixWorld).invert().multiply(x.holder.matrixWorld), out = [];
  for (let k = 0; k < 8; k++) out.push(new THREE.Vector3(k & 1 ? 0.5 : -0.5, k & 2 ? 0.5 : -0.5, k & 4 ? 0.5 : -0.5).applyMatrix4(m).toArray());
  return out;
}

// --------------------------------------------------------- every frame --
// after the objects have their places: each cut-out where its record puts it on its object (gliding there from where it
// was when the room moved it; carried, where the hand or the arrows put it), whether it cuts now, and handed to its
// object's materials; while editing its box, its name and (selected) its corners
const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cs = new THREE.Vector3(), _cy = new THREE.Vector3(0, 1, 0);
function cutsStep(editing, now) {
  for (const ob of STU.items.values()) if (ob.kind === 'o') ob.cutL = null;
  for (const x of STU.items.values()) if (x.kind === 'x') cutPlace(x, editing, now);
  // (more than 16 on one object, as a room or a layout may bring: the 16 with the lowest ids cut, the same on every
  // device whatever order its items came in; the rest are drawn as cutting nothing)
  for (const ob of STU.items.values()) {
    if (ob.kind !== 'o') continue;
    const l = ob.cutL || [];
    if (l.length > CUT_MAX) { l.sort((a, b) => (a.id < b.id ? -1 : 1)); for (const x of l.splice(CUT_MAX)) { x.cutting = false; x.over = true; } }
    if (ob.cutU) ob.cutU.list = l;
  }
  for (const x of STU.items.values()) if (x.kind === 'x') cutLook(x, editing);
}
// where it stands, and whether it cuts now
function cutPlace(x, editing, now) {
  const ob = cutObj(x);
  if (!x.carry) {
    cutPose(x, _cp, _cq, _cs);
    if (x.gl) {
      const k = smooth((now - x.gl.t0) / 250);
      x.holder.position.lerpVectors(x.gl.p, _cp, k); x.holder.quaternion.copy(x.gl.q).slerp(_cq, k); x.holder.scale.lerpVectors(x.gl.s, _cs, k);
      if (k >= 1) x.gl = null;
    } else { x.holder.position.copy(_cp); x.holder.quaternion.copy(_cq); x.holder.scale.copy(_cs); }
  }
  poseCut(x, ob);   // (its object's motion on it: e6e_motion.js)
  // cutting now: its object here with its model, shown for you (past one half of its fade) or previewed cut here, and
  // not previewed whole here (the previews: while editing, this device only)
  const pv = editing ? (STU.whole.has(x.id) ? 'whole' : STU.cutF.has(x.id) ? 'cut' : '') : '';
  x.over = false;
  x.cutting = !!(ob && ob.model) && pv !== 'whole' && (pv === 'cut' || x.sa > 0.5);
  if (ob && ob.model) { cutPrep(ob); if (x.cutting) (ob.cutL || (ob.cutL = [])).push(x); }
}
// while editing: its box, its corners, its name
function cutLook(x, editing) {
  const ob = cutObj(x), L = x.look, r = x.rec;
  x.holder.visible = L.deco.visible = x.a > 0.01;
  if (!L.deco.visible) return;
  decoAt(x.holder, L.deco);   // (where it is drawn: its object's motion carries it)
  const sz = x.holder.scale;
  L.corners.forEach((c, k) => c.position.set((k & 1 ? 0.5 : -0.5) * sz.x, (k & 2 ? 0.5 : -0.5) * sz.y, (k & 4 ? 0.5 : -0.5) * sz.z));
  // (its name over the box's top, upright in the scene whatever the box's turn)
  L.name.position.set(0, cutHalfHeight(x) + 0.04, 0).applyQuaternion(_cq.copy(L.deco.quaternion).invert());
  L.look({ selected: STU.sel === x.id && editing, hot: STU.hover === x.id, hotCorner: STU.hotCorner && STU.hotCorner.id === x.id ? STU.hotCorner.k : -1, off: !x.cutting });
  for (const m of [L.fill.material, L.line.material, L.ticks.material]) m.opacity *= x.a;
  L.name.userData.set('✂ ' + r.name + cutWords(x, ob), L.col, 0.075);
}
// what its label and the Items pane add: why it cuts nothing, or how it is previewed ('' cutting as it is)
const cutWords = (x, ob) => (!ob ? ' · cuts nothing' : x.over ? ` · cuts nothing (${CUT_MAX} at most)` : STU.whole.has(x.id) ? ' · whole'
  : STU.cutF.has(x.id) ? (x.shown ? ' · cut' : ' · hidden for you, previewed cut') : !x.shown ? ' · hidden for you' : '');

// ------------------------------------------------------------ the shader --
// Each material of an object with a cut-out: the fragment's place in the world (from three.js's own `transformed`,
// after skinning and morphs, through modelMatrix) goes to the fragment shader, which drops it when it lies inside any of
// the object's boxes (each box's inverse matrix, its first three rows: 3 vec4 a box, 48 for 16; the count a uniform).
// The same program for every patched material of a kind (customProgramCacheKey), its uniforms the object's own (each
// object's materials are its own clones, libClone: two objects of one file never share a cut)
const CUT_KEY = '|studio-cut-1', CUTMAT = new WeakMap();
const CUT_V = '\n\tvec4 cutP = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n\tcutP = instanceMatrix * cutP;\n#endif\n\tvCutW = ( modelMatrix * cutP ).xyz;\n';
const CUT_F = '\n\tfor ( int ci = 0; ci < ' + CUT_MAX + '; ci ++ ) {\n\t\tif ( ci >= cutN ) break;\n\t\tvec4 cw = vec4( vCutW, 1.0 );\n' +
  '\t\tif ( max( max( abs( dot( cutM[ ci * 3 ], cw ) ), abs( dot( cutM[ ci * 3 + 1 ], cw ) ) ), abs( dot( cutM[ ci * 3 + 2 ], cw ) ) ) < 0.5 ) discard;\n\t}\n';
function cutPatch(m, U) {
  if (!m || CUTMAT.has(m)) return;
  CUTMAT.set(m, U);
  const before = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = function (sh, renderer) {
    before.call(this, sh, renderer);
    // (a shader without three.js's place of the vertex is left as it is: nothing of it is cut)
    if (!sh.vertexShader.includes('#include <project_vertex>')) return;
    sh.uniforms.cutM = U.cutM; sh.uniforms.cutN = U.cutN;
    sh.vertexShader = 'varying vec3 vCutW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + CUT_V);
    const f = 'varying vec3 vCutW;\nuniform vec4 cutM[ ' + CUT_MAX * 3 + ' ];\nuniform int cutN;\n' + sh.fragmentShader;
    sh.fragmentShader = f.includes('#include <clipping_planes_fragment>') ? f.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + CUT_F)
      : f.replace(/void\s+main\s*\(\s*\)\s*\{/, s => s + CUT_F);
  };
  m.customProgramCacheKey = () => key + CUT_KEY;
  m.needsUpdate = true;
}
// an object's model made ready to be cut (once per model, from its first cut-out on: a model with none keeps its
// materials as loaded): its materials, lit and as scanned, patched, and each of its meshes hands over the boxes as drawn
function cutPrep(ob) {
  const M = ob.model;
  if (!M || M.cut) return;
  M.cut = true;
  if (!ob.cutU) ob.cutU = { cutM: { value: new Float32Array(CUT_MAX * 12) }, cutN: { value: 0 }, f: -1, list: [] };
  cutMats(ob);
  for (const n of M.meshes) n.onBeforeRender = () => cutUpload(ob);
}
// its materials patched (as scanned ones are made only when first asked for: applyLight patches those then)
function cutMats(ob) {
  const M = ob.model, U = ob.cutU;
  if (M && U) for (const n of M.meshes) for (const k of ['lit', 'scan']) for (const m of [].concat(n.userData[k] || [])) cutPatch(m, U);
}
// the object's boxes cutting now, as the first of its meshes is drawn this frame (each box's matrix inverted: a
// fragment inside it lands within half a unit of its middle on every axis)
const _cm = new THREE.Matrix4();
function cutUpload(ob) {
  const U = ob.cutU, f = GL.renderer.info.render.frame;
  if (!U || U.f === f) return;
  U.f = f;
  const a = U.cutM.value;
  let n = 0;
  for (const x of U.list) {
    if (n >= CUT_MAX) break;
    const e = _cm.copy(x.holder.matrixWorld).invert().elements, o = n * 12;
    for (let r = 0; r < 3; r++) { a[o + r * 4] = e[r]; a[o + r * 4 + 1] = e[4 + r]; a[o + r * 4 + 2] = e[8 + r]; a[o + r * 4 + 3] = e[12 + r]; }
    n++;
  }
  U.cutN.value = n;
}

// ---------------------------------------------------------------- edits --
// a new cut-out on an object (its card's Cut out a part, the Add pane's Cut-out box): 0.8 x 2 x 0.4 m (each side at most
// a fifth of the model's largest), standing upright, its middle where the pointer or the ray last met the model's
// surface (the model's own triangles, looked for once, now), else the model's middle, facing you; selected
function addCut(oid) {
  const ob = STU.items.get(oid);
  if (!canCut(ob)) return '';
  const at = cutAt(ob), id = newId();
  change(() => putItem(id, 'x', norm('x', Object.assign({ name: nameFor('Cut-out'), on: oid }, cutRecFrom(ob, at.p, at.q, new THREE.Vector3(...at.size))))));
  select(id);
  sfxAct('snap', 'world', null);
  return id;
}
// where a new cut-out goes on an object (the scene's frame)
function cutAt(ob) {
  const box = objBox(ob), L = box ? Math.max(...box.getSize(new THREE.Vector3()).toArray()) : 1;
  const size = CUT_DEF.map(v => r3(Math.min(v, Math.max(0.05, L / 5))));
  let p = null, from = null;
  const R = STU.ray;
  if (R && R.id === ob.id && ob.model && performance.now() - R.at < 300000) {
    // (the ray as it met the model, in the model's own frame, taken onto where it is placed: a model that moves is met
    // where it was drawn as the click came, and its cut-out goes on that part of it; e6e_motion.js)
    poseRest(ob);
    GL.world.updateMatrixWorld(true);
    const M = ob.holder.matrixWorld, o = new THREE.Vector3().fromArray(R.lo).applyMatrix4(M), d = new THREE.Vector3().fromArray(R.ld).transformDirection(M);
    const hs = modelHits(ob.model.o, new THREE.Raycaster(o, d, 0, 500)).filter(h => h.object.isMesh && h.object.visible);
    if (hs.length) { p = GL.items.worldToLocal(hs[0].point.clone()); from = GL.items.worldToLocal(o.clone()); }
  }
  if (!p) { p = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3().fromArray(ob.rec.p); from = viewerAt(); }
  const dx = from.x - p.x, dz = from.z - p.z;
  return { p, q: new THREE.Quaternion().setFromAxisAngle(_cy, Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : 0), size };
}
// a model's triangles a ray meets, nearest first, as the model is drawn now: three.js r128 tests a skinned mesh's triangles
// where its bones put them (its materials say skinning), but first against its rest pose's bounding sphere and box, which
// a posed part may have left (a raised hand): those two set aside for a skinned mesh's test
const BIG_S = new THREE.Sphere(new THREE.Vector3(), Infinity);
function modelHits(o, rc) {
  const out = [];
  o.traverse(n => {
    if (!n.isMesh) return;
    const g = n.geometry, sk = !!n.isSkinnedMesh, bs = g.boundingSphere, bb = g.boundingBox;
    if (sk) { g.boundingSphere = BIG_S; g.boundingBox = null; }
    try { rc.intersectObject(n, false, out); } finally { if (sk) { g.boundingSphere = bs; g.boundingBox = bb; } }
  });
  return out.sort((a, b) => a.distance - b.distance);
}
// where you are, in the scene's frame: your head in a headset, the camera on a page
function viewerAt() {
  GL.world.updateMatrixWorld(true);
  if (XR.on && GL.renderer.xr.isPresenting) return GL.items.worldToLocal(XR.head.clone());
  return GL.items.worldToLocal(GL.camera.getWorldPosition(new THREE.Vector3()));
}
// the last ray (the pointer's, a controller's) that met an object, in the scene's frame and in the object's own (its holder's,
// as it was drawn then: its motion's moment; or as it is placed, when the ray met its ghost): a new cut-out goes where it met
// the model (rayPick keeps it)
function cutRay(id, ray) {
  GL.world.updateMatrixWorld(true);
  const m = GL.items.matrixWorld.clone().invert(), ob = STU.items.get(id), H = ob && ob.holder;
  const L = !H ? m : ray.ghost ? new THREE.Matrix4().compose(H.position, H.quaternion, H.scale).premultiply(GL.items.matrixWorld).invert() : H.matrixWorld.clone().invert();
  STU.ray = { id, o: ray.origin.clone().applyMatrix4(m).toArray(), d: ray.direction.clone().transformDirection(m).toArray(), lo: ray.origin.clone().applyMatrix4(L).toArray(), ld: ray.direction.clone().transformDirection(L).toArray(), at: performance.now() };
}
// a copy beside it on the same object (along its own width), selected; in every cube list the original is in (a door a
// cube opens, copied, opens with it: cubeCopy)
function duplicateCut(x) {
  const ob = cutObj(x);
  if (ob && cutsOn(ob.id).length >= CUT_MAX) return '';
  const nid = newId(), d = new THREE.Vector3(x.rec.size[0] * 1.25, 0, 0).applyQuaternion(new THREE.Quaternion().fromArray(x.rec.q));
  change(() => { if (putItem(nid, 'x', norm('x', Object.assign({}, x.rec, { name: nameFor(x.rec.name.replace(/ \d+$/, '')), p: x.rec.p.map((v, i) => v + d.getComponent(i)), locked: undefined })))) cubeCopy(x.id, nid); });
  select(nid);
  sfxAct('place', 'world', null);
  return nid;
}
// a copy of a cut-out put in every cube's list (show or hide) its original is in (within the change that makes it)
function cubeCopy(from, to) {
  for (const c of [...STU.items.values()]) {
    if (c.kind !== 'c') continue;
    const sh = c.rec.show.includes(from), hi = c.rec.hide.includes(from);
    if (sh || hi) setRec(c.id, { show: sh ? c.rec.show.concat(to) : c.rec.show, hide: hi ? c.rec.hide.concat(to) : c.rec.hide });
  }
}
// a quarter turn about its own upright (its width and depth trade places)
function cutTurn(x) { setRec(x.id, { q: new THREE.Quaternion().fromArray(x.rec.q).multiply(new THREE.Quaternion().setFromAxisAngle(_cy, Math.PI / 2)).toArray() }); }
// onto another object, staying where it is in the scene (refused when that object has 16 already)
function cutOnto(x, oid) {
  const ob = STU.items.get(oid);
  STU.cutTo = '';
  if (x.kind !== 'x' || !ob || ob.kind !== 'o' || x.rec.on === oid || cutsOn(oid).length >= CUT_MAX || ob.rec.cutsLocked) return;
  setRec(x.id, Object.assign({ on: oid }, cutRecOf(x, ob)));
}
// the card's actions (page and headset alike)
Object.assign(ITEM_ACT, {
  cut: it => { if (it.kind === 'o') addCut(it.id); else if (it.kind === 'x' && cutObj(it)) addCut(it.rec.on); },
  // one side 5 cm more or less, or every side by a factor; its middle stays
  cgrow: (x, v) => { const [ax, d] = String(v).split(':'), i = +ax, size = x.rec.size.slice(); if (!(i >= 0 && i < 3)) return; size[i] = clamp(r3(size[i] + +d), 0.01, 50); setRec(x.id, { size }); },
  csize: (x, k) => { if (+k > 0) setRec(x.id, { size: x.rec.size.map(v => clamp(v * k, 0.01, 50)) }); },
  // this device's preview while editing (never shared): as seen (as the cubes say for you), cut (whatever they say: a door
  // a cube opens, sized with its hole in sight) or whole (as if it had no cut-out)
  preview: (x, v) => {
    if (x.kind !== 'x') return;
    STU.whole.delete(x.id); STU.cutF.delete(x.id);
    if (v === 'whole') STU.whole.add(x.id); else if (v === 'cut') STU.cutF.add(x.id);
  },
  cutPick: x => { if (x.kind === 'x') STU.cutTo = STU.cutTo === x.id ? '' : x.id; },
  // an object's cut-outs locked or not (one Undo step); locking one whose cut-out is selected selects the object
  cutslock: ob => {
    if (ob.kind !== 'o') return;
    const on = !ob.rec.cutsLocked;
    setRec(ob.id, { cutsLocked: on ? true : undefined });
    const s = STU.items.get(STU.sel);
    if (on && s && s.kind === 'x' && s.rec.on === ob.id) select(ob.id);
    if (STU.cutTo && on) STU.cutTo = '';
    sfxAct(on ? 'knock' : 'rise', 'world', null, { gain: 0.4, dur: 0.4 });
  },
  cutOn: (x, oid) => cutOnto(x, oid),
});
