// ================================================================= GHOSTS ==
// The owner, after v121 (7 November 2026): "when animating a 'ghost' of the model should stay in the initial place so that
// one can hit it again for better loops", "when selecting animations on the item motion tab they should also show on the
// item as a preview", and "to make placing easier add a pause motion button but i also want to be able to move
// moving/animated items to select their exact place". So an item that moves (a motion, a recorded path, a behaviour) goes
// on while it is selected (motionRests, e6e_motion.js), and:
// - its ghost: while a selected item (or a selected group's member) is drawn more than 1 cm or 1 degree from where it is
//   placed, a see-through copy stands there (an object's model sharing its geometry with one pale material, a skinned one
//   frozen in its rest pose, a model of more than 100,000 triangles only its outline box; a shape its shape; an empty its
//   cross; a sound its speaker), built once per selection and freed when the selection changes (its materials; never the
//   geometry it shares). It is pointed at as the item (the trigger selects, the grip carries it from where it is placed).
//   While its path is recorded the ghost stands where it began, the whole time, and lights as it comes back to it
//   (e6f_path.js);
// - the page's arrows stand on the ghost (TCP, a stand-in at its placed pose): each change goes into its placed pose as a
//   drag of the item itself does, the item resting there while dragged; let go, it moves on from its new place;
// - Pause (MPAUSE): this device's own switch (never shared, never saved; off again once editing is off; never for a
//   visitor): every item stands at its placed pose (no motion, path or behaviour drawn: a behaviour this device drives is
//   given up, and the others draw it as the room has it), models' animations hold the frame they show, sounds play on.
//   Played again, everything goes on by its clock (an 'always' one where the room's time has it).
const MPAUSE = { on: false };
const motionsPaused = () => MPAUSE.on;
function pauseSet(on) {
  on = !!on && editOn();
  if (on === MPAUSE.on) return;
  MPAUSE.on = on;
  sfxAct(on ? 'knock' : 'rise', 'world', null, { gain: 0.4, dur: 0.4 });
  tcAttach();
  dirty(true);
}
// the Pause row (the Scene pane's, and the card of anything that moves: the same switch), with what the card adds to it
function pauseBlocks(B, scene, extra) {
  const on = MPAUSE.on;
  B.push({ label: scene ? 'Motions (this device)' : 'Motions', row: [{ id: scene ? 'pause' : 'mpause', label: on ? 'Motions: paused' : 'Motions: playing', act: 'pause', on }].concat(extra || []) },
    { p: on ? 'Paused here: everything that moves stands where it is placed (motions, recorded paths, behaviours; animations hold their frame); sounds play on. Press again, or turn off Edit, to play them.'
      : 'Pause stands everything that moves where it is placed, so it is easy to place: this device only' + (XR.on ? '.' : ' (P on the keyboard).'), c: on ? 'amber' : 'faint' });
}

// ---------------------------------------------------------------- ghosts --
const GHOST = { col: 0xdcecff, lit: 0xd2ffe2, a: 0.25, la: 0.55, tris: 100000, far: 0.01, deg: 1, hold: 600, edges: null };
const GH = new Map();   // (id -> its ghost: { it, g, mat, lmat, hits, key, far })
const ghostKey = it => (it.kind === 'o' ? (it.model ? it.built : -1) : it.kind === 'p' ? it.rec.shape : it.kind);
function ghostBuild(it) {
  if (it.kind === 'o' && !it.model) return null;   // (its grey box while its model loads: no ghost yet)
  const g = new THREE.Group(), H = it.holder;
  const mat = new THREE.MeshBasicMaterial({ color: GHOST.col, transparent: true, opacity: GHOST.a, depthWrite: false });
  const lmat = new THREE.LineBasicMaterial({ color: GHOST.col, transparent: true, opacity: GHOST.la, depthWrite: false, depthTest: false });
  const G = { it, g, mat, lmat, hits: [], key: ghostKey(it), far: -1e9 };
  g.matrixAutoUpdate = false;
  H.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(H.matrixWorld).invert();
  // (each part where it stands on its holder, its drawn turn taken out: the ghost's own pose is the placed one)
  const add = (o, n, ro) => { o.matrixAutoUpdate = false; o.matrix.multiplyMatrices(inv, n.matrixWorld); o.renderOrder = ro; o.frustumCulled = false; g.add(o); return o; };
  const hit = (n, geo) => { const h = add(new THREE.Mesh(geo, HIDDEN), n, 0); h.userData.id = it.id; h.userData.ghost = true; G.hits.push(h); };
  if (it.kind === 'o') {
    if (!(it.E && it.E.info) || it.E.info.tris > GHOST.tris) add(new THREE.LineSegments(GHOST.edges || (GHOST.edges = new THREE.EdgesGeometry(BOX1)), lmat), it.proxy, 8);
    else it.model.o.traverse(n => { if (n.isMesh && n.visible && n.geometry) add(new THREE.Mesh(n.geometry, mat), n, 3); });   // (a skinned mesh as a plain one: its rest pose)
    hit(it.proxy, BOX1);
  } else if (it.kind === 'p') { add(new THREE.Mesh(it.look.mesh.geometry, mat), it.look.mesh, 3); hit(it.look.mesh, it.look.mesh.geometry); }
  else {
    for (const n of H.children) {
      if (n === it.look.hit || n.isSprite || !n.geometry) continue;
      if (n.isLine) add(new THREE.LineSegments(n.geometry, lmat), n, 8);
      else if (n.isMesh) add(new THREE.Mesh(n.geometry, mat), n, 3);
    }
    hit(it.look.hit, it.look.hit.geometry);
  }
  GL.items.add(g);
  return G;
}
function ghostDrop(id) {
  const G = GH.get(id);
  if (!G) return;
  GH.delete(id);
  if (G.g.parent) G.g.parent.remove(G.g);
  G.mat.dispose(); G.lmat.dispose();   // (never the geometry: the model's, the looks', the shared box's)
}
// whether it is drawn away from where it is placed: its middle more than 1 cm, its turn more than 1 degree, or its size
// (a pulse) more than 1 cm at its edge (it.mX: poseStep's change from its placed pose to its drawn one)
const _gx = new THREE.Vector3(), _gx2 = new THREE.Vector3(), _gxq = new THREE.Quaternion(), _gxs = new THREE.Vector3(), _gxm = new THREE.Matrix4();
function ghostFar(it) {
  const X = it.mX;
  if (!X) return false;
  const H = it.holder;
  motionMiddle(it, _gxm.compose(H.position, H.quaternion, H.scale), _gx);
  if (_gx2.copy(_gx).applyMatrix4(X).distanceTo(_gx) > GHOST.far) return true;
  X.decompose(_gx2, _gxq, _gxs);
  if (2 * Math.acos(Math.min(1, Math.abs(_gxq.w))) > GHOST.deg * Math.PI / 180) return true;
  const r = it.kind === 'o' && it.model ? _gx2.copy(it.proxy.scale).multiply(H.scale).length() / 2 : it.kind === 'p' ? H.scale.length() / 2 : 0.1;
  return Math.abs(_gxs.x - 1) * r > GHOST.far;
}
// every frame (itemsStep, after the items have their poses): the ghosts wanted (the selected item, or a selected group's
// members, while they are drawn away from where they are placed, and for 0.6 s after so a spin passing through its place
// does not blink it; and a path being recorded: where it began), each at its pose, lit while a recording is back at it;
// then the page's arrows on the right one
const _ghq = new THREE.Quaternion();
function ghostStep(editing, now) {
  const want = new Map(), sel = editing ? STU.items.get(STU.sel) : null;
  if (REC && STU.items.get(REC.id) === REC.it) want.set(REC.id, 'rec');
  if (sel) for (const m of sel.kind === 'g' ? members(sel) : [sel]) if (['o', 'p', 'e', 's'].includes(m.kind) && !want.has(m.id)) want.set(m.id, 'sel');
  for (const [id, G] of GH) if (!want.has(id) || G.it !== STU.items.get(id)) ghostDrop(id);
  for (const [id, how] of want) {
    const it = STU.items.get(id), rec = how === 'rec';
    let G = GH.get(id);
    const far = !rec && ghostFar(it);
    if (G && far) G.far = now;
    const vis = rec || far || (!!G && now - G.far < GHOST.hold);
    if (!vis && !G) continue;
    if (!G || G.key !== ghostKey(it)) { if (G) ghostDrop(id); G = ghostBuild(it); if (!G) continue; GH.set(id, G); G.far = far ? now : -1e9; }
    G.g.visible = vis;
    if (!vis) continue;
    const H = it.holder;
    if (rec) G.g.matrix.compose(REC.p0, it.kind === 's' ? _ghq.identity() : REC.q0, REC.s0 || H.scale);
    else G.g.matrix.compose(H.position, H.quaternion, H.scale);
    G.g.matrixWorldNeedsUpdate = true;
    const lit = rec && REC.lit;
    G.mat.color.setHex(lit ? GHOST.lit : GHOST.col); G.mat.opacity = lit ? 0.55 : GHOST.a;
    G.lmat.color.setHex(lit ? GHOST.lit : GHOST.col); G.lmat.opacity = lit ? 1 : GHOST.la;
  }
  tcStep();
}
// what the pointer finds of the ghosts shown (each as its item: e7_explore.js's pickables)
const ghostHits = () => { const L = []; for (const G of GH.values()) if (G.g.visible) L.push(...G.hits); return L; };
// for the tests: an item's ghost (shown, lit, its pose, how many parts it draws, whether only its outline box), or null
function ghostOf(id) {
  const G = GH.get(id);
  if (!G) return null;
  const parts = G.g.children.filter(o => !o.userData.ghost);
  return { shown: G.g.visible, lit: G.mat.color.getHex() === GHOST.lit, at: G.g.matrix.toArray(), parts: parts.length, outline: parts.length === 1 && !!parts[0].isLine && G.it.kind === 'o', hits: G.hits.length };
}

// ---------------------------------------------------- the page's arrows on it --
// TCP: what the page's arrows hold while the selected item moves: a stand-in at its placed pose (the holder's place, turn
// and size), so they stand on its ghost; tcRead takes each change from it (e7_explore.js)
const TCP = new THREE.Object3D();
const tcTarget = it => (it.kind !== 'g' && !it.holder.matrixAutoUpdate ? TCP : it.holder);
function tcProxy(it) {
  const H = it.holder;
  if (H.parent && TCP.parent !== H.parent) H.parent.add(TCP);
  TCP.position.copy(H.position); TCP.quaternion.copy(H.quaternion); TCP.scale.copy(H.scale);
  TCP.userData.id = it.id;
}
// every frame (page): the arrows moved onto the ghost as the item starts moving, back onto it as it rests (Pause, a
// recording), and the stand-in kept on its placed pose (the room, its card's buttons); never while a drag holds them
function tcStep() {
  const tc = GL.tc, it = STU.items.get(STU.sel);
  if (!tc || !tc.object || X.tcDrag || !it) return;
  const T = tcTarget(it);
  if (T !== tc.object) tcAttach(); else if (T === TCP) tcProxy(it);
}
