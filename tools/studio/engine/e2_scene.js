
// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear (one: the stage; the scene's items hang beside it, GL.items)
const SET_ORDER = ['stage'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // (the renderer is the shell's, shared by every story: its output stays linear, as theirs; a model's textures are
  // drawn as they are, LIB's look)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 1200);
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // lit as a room is: a sky and ground light, a light from over your shoulder, and a cool rim light from behind
  scene.add(GL.hemi = new THREE.HemisphereLight(0xe8eeff, 0x2a2f3a, 0.9));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.9);
  scene.add(GL.sun); scene.add(GL.sun.target);
  GL.rim = new THREE.DirectionalLight(0x9fc8ff, 0.35);
  scene.add(GL.rim); scene.add(GL.rim.target);
  // stars (kept for the engine's sake; the studio has none)
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  GL.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false }));
  scene.add(GL.stars); GL.stars.visible = false;
  // the scene's items (objects, cubes, sounds) and what is drawn for editing, in the scene's frame
  GL.items = new THREE.Group(); GL.world.add(GL.items);
  GL.edit = new THREE.Group(); GL.world.add(GL.edit);
  // (the stage, built on its own as a step of the load: buildSet, LOAD)
  GL.sets = {};
}
// one set, built as a step of the load (LOAD) and hidden until the story fades it in
function buildSet(k) {
  const s = SETS[k](K);
  GL.sets[k] = s;
  GL.world.add(s.group);
  s.setAlpha(0);
}
// once every set is built (a step of the load): what joins them
function sceneJoin() {
  orbit.cur = view('stage', 'default');
}
// a soft, room-like light for glTF's metal and gloss (PBR materials need something to reflect): a small room of
// gradient walls and a few bright panels, prefiltered once, the first time a model wants it
function envMap() {
  if (GL.env !== undefined) return GL.env;
  GL.env = null;
  try {
    const room = new THREE.Scene(), geo = new THREE.BoxGeometry(1, 1, 1), mats = [];
    const wall = new THREE.MeshBasicMaterial({ color: 0x5a6070, side: THREE.BackSide }); mats.push(wall);
    const box = new THREE.Mesh(geo, wall); box.scale.set(12, 6, 12); box.position.y = 2; room.add(box);
    for (const [x, y, z, sx, sy, sz, c] of [[0, 4.9, 0, 6, 0.1, 6, 0xffffff], [-5.9, 2.5, 0, 0.1, 2, 5, 0xc8d8ff], [5.9, 2, 1, 0.1, 1.5, 3, 0xffe2c0], [0, -0.9, 0, 12, 0.1, 12, 0x2a2f3a]]) {
      const m = new THREE.MeshBasicMaterial({ color: c }); mats.push(m);
      const p = new THREE.Mesh(geo, m); p.position.set(x, y, z); p.scale.set(sx, sy, sz); room.add(p);
    }
    const pm = new THREE.PMREMGenerator(GL.renderer);
    GL.env = pm.fromScene(room, 0.04).texture;
    pm.dispose(); geo.dispose(); for (const m of mats) m.dispose();
  } catch (e) { GL.env = null; /* no reflections: still lit */ }
  return GL.env;
}
// show each set as far as S fades it in, and let the visible ones update
function updateSets(S, t, dt) {
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
  }
}

// ---------------------------------------------------------------- camera --
// A view is [az, el, dist, tx, ty, tz]: look at the target (tx, ty, tz) from the
// direction az (around the vertical, degrees) and el (up, degrees), dist away.
const _vd = new THREE.Vector3(), _vt = new THREE.Vector3();
function viewDir(v, out) {
  const A = v[0] * D2R, E = clamp(v[1], -85, 85) * D2R;
  return out.set(Math.cos(E) * Math.sin(A), Math.sin(E), Math.cos(E) * Math.cos(A));
}
function applyCamera(v) {
  viewDir(v, _vd); _vt.set(v[3], v[4], v[5]);
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1));
  GL.camera.position.y = Math.max(GL.camera.position.y, 0.15);   // never under the floor
  GL.camera.up.set(0, 1, 0); GL.camera.lookAt(_vt);
}
function resize() {
  GL.bare = !!(HOST.focus && HOST.focus());   // focus mode (the shell's): the 3D alone on the page, no panel to clear
  if (GL.renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight, { renderer, camera } = GL;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wide = w >= 900;
  GL.wide = wide;
  if (GL.bare) camera.setViewOffset(w, h, 0, 0.05 * h, w, h);   // (its middle a little above the page's: more bar below)
  else if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62);
  // (focus mode: the page between the top bar, 48 px, and the bar and subtitles below, 126 px, about the scene's
  // middle at 0.45 h; at fit 1 a scene reaches about 0.95 of the screen's half height up and down, 1 to the sides)
  if (GL.bare) GL.fit = Math.max(1, 0.95 / Math.max(0.25, Math.min(0.45 * h - 48, 0.55 * h - 126) / (0.5 * h)), h / w);
  camera.updateProjectionMatrix();
}
// the sun comes from over the viewer's left shoulder, the rim light from behind; point sizes follow the screen
const LV = new THREE.Vector3(), _v2 = new THREE.Vector2();
function updateLight(xr) {
  const q = xr ? XR.headQ : GL.camera.quaternion;
  LV.set(-0.5, 0.8, 1.0).normalize().applyQuaternion(q);
  LV.y = Math.max(LV.y, 0.4);   // (always from above: a room's light)
  GL.sun.position.copy(LV); GL.sun.target.position.set(0, 0, 0);
  LV.set(0.3, 0.5, -1.0).normalize().applyQuaternion(q);
  GL.rim.position.copy(LV); GL.rim.target.position.set(0, 0, 0);
  if (xr) K.U.uPx.value = XR.viewH * 0.5 * XR.R;
  else K.U.uPx.value = GL.renderer.getDrawingBufferSize(_v2).y * 0.5;
}
