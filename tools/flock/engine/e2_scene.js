
// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['flock'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 2000);   // standing among the birds: a wide view, out to the sky
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // lit sets (the computer, the complex, buildings ...) share one sky light and a light from over your shoulder
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 0.85));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.85);
  scene.add(GL.sun); scene.add(GL.sun.target);
  // stars
  const sr = K.rng(9), sp = new Float32Array(1800 * 3), sc = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const z = sr() * 2 - 1, t = sr() * Math.PI * 2, r = Math.sqrt(1 - z * z), b = 0.25 + 0.75 * Math.pow(sr(), 3);
    sp.set([150 * r * Math.cos(t), 150 * z, 150 * r * Math.sin(t)], 3 * i); sc.set([b, b, b * 1.05], 3 * i);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  GL.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true }));
  scene.add(GL.stars); GL.stars.visible = false;   // the flock has its own sky
  // the sets themselves, all hidden until the story fades them in
  GL.sets = {};
  for (const k of SET_ORDER) {
    const s = SETS[k](K);
    GL.sets[k] = s;
    GL.world.add(s.group);
    s.setAlpha(0);
  }
}
// show each set as far as S fades it in, and let the visible ones update; in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
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
// the sun comes from over the viewer's left shoulder; point sizes follow the screen (and the world's scale in a headset)
const LV = new THREE.Vector3(), _v2 = new THREE.Vector2();
function updateLight(xr) {
  LV.set(-0.5, 0.6, 1.0).normalize().applyQuaternion(xr ? XR.headQ : GL.camera.quaternion);
  GL.sun.position.copy(LV); GL.sun.target.position.set(0, 0, 0);
  if (xr) K.U.uPx.value = XR.viewH * 0.5 * XR.R;
  else K.U.uPx.value = GL.renderer.getDrawingBufferSize(_v2).y * 0.5;
}

// ----------------------------------------------------------- the flock --
// The flock is all round you. On a screen the camera, standing where you stand, turns to keep it in view; from
// afar it keeps the flock in the middle (blended by distance, so a flight between the two is smooth).
// keep: return the followed view as it is now (when you take over the camera).
const FOL = { az: null, el: -20, tx: 0, ty: 8, tz: -10 };
function followView(v, dt, keep) {
  const c = GL.sets.flock.anchors.flock(), k = keep ? 0 : 1 - Math.exp(-(dt || 0) * 1.3);
  const dx = c[0] - v[3], dy = c[1] - 3 - v[4], dz = c[2] - v[5], h = Math.hypot(dx, dz) + 1e-6;
  // the camera looks along -dir(az, el): it faces the flock at az = atan2(-dx, -dz), el = -atan(dy / h)
  let az = Math.atan2(-dx, -dz) / D2R;
  const el = clamp(-Math.atan2(dy, h) / D2R, -70, 8);
  if (FOL.az === null) { FOL.az = az; FOL.el = el; FOL.tx = c[0]; FOL.ty = c[1] - 3; FOL.tz = c[2]; }
  az += 360 * Math.round((FOL.az - az) / 360);
  FOL.az += (az - FOL.az) * k; FOL.el += (el - FOL.el) * k;
  FOL.tx += (c[0] - FOL.tx) * k; FOL.ty += (c[1] - 3 - FOL.ty) * k; FOL.tz += (c[2] - FOL.tz) * k;
  const w = smooth((v[2] - 0.6) / 2.4);   // 0 close up (turn to the flock), 1 from afar (aim at it)
  return [FOL.az + (v[0] - FOL.az) * w, FOL.el + (v[1] - FOL.el) * w, v[2], v[3] + (FOL.tx - v[3]) * w, v[4] + (FOL.ty - v[4]) * w, v[5] + (FOL.tz - v[5]) * w];
}
// the flock steers clear of you: your head (the camera, on a screen) and your hands, in the flock's own frame
const _sv = new THREE.Vector3(), _sm = new THREE.Matrix4();
function tellFlock(xr) {
  const s = GL.sets.flock;
  GL.world.updateMatrixWorld(true);
  _sm.copy(s.group.matrixWorld).invert();
  const head = _sv.copy(xr ? XR.head : GL.camera.position).applyMatrix4(_sm).toArray();
  const hands = xr ? XR.ctrls.filter(c => c.src && c.g.visible).map(c => _sv.copy(c.o).applyMatrix4(_sm).toArray()) : [];
  s.see(head, hands);
}
