
// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear (one: the table)
const SET_ORDER = ['table'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 200);
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // lit as the app's props are: a sky light, a light from over your shoulder, and a cool rim light from behind
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 0.85));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.85);
  scene.add(GL.sun); scene.add(GL.sun.target);
  GL.rim = new THREE.DirectionalLight(0x6fb6ff, 0.55);
  scene.add(GL.rim); scene.add(GL.rim.target);
  // stars (kept for the engine's sake; the room has none)
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  GL.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false }));
  scene.add(GL.stars); GL.stars.visible = false;
  GL.sets = {};
  for (const k of SET_ORDER) {
    const s = SETS[k](K);
    GL.sets[k] = s;
    GL.world.add(s.group);
    s.setAlpha(0);
  }
  // the plates, by story round the table; a story's colour for its picked miniature's ring
  const T = GL.sets.table;
  T.layout(STORIES);
  T.colours(k => storyOf(k).col);
  if (document.fonts) document.fonts.ready.then(() => { if (!GL.gone) T.drawCards(); }).catch(() => {});
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
  if (GL.renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight, { renderer, camera } = GL;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wide = w >= 900;
  GL.wide = wide;
  if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62);
  camera.updateProjectionMatrix();
}
// the sun comes from over the viewer's left shoulder, the rim light from behind the table; point sizes follow the screen
const LV = new THREE.Vector3(), _v2 = new THREE.Vector2();
function updateLight(xr) {
  const q = xr ? XR.headQ : GL.camera.quaternion;
  LV.set(-0.5, 0.6, 1.0).normalize().applyQuaternion(q);
  GL.sun.position.copy(LV); GL.sun.target.position.set(0, 0, 0);
  LV.set(0.3, 0.5, -1.0).normalize().applyQuaternion(q);
  GL.rim.position.copy(LV); GL.rim.target.position.set(0, 0, 0);
  if (xr) K.U.uPx.value = XR.viewH * 0.5 * XR.R;
  else K.U.uPx.value = GL.renderer.getDrawingBufferSize(_v2).y * 0.5;
}
