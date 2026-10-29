// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story: the soil block (chapters 1 to 3 and 8), the globe (the hop to Japan,
// chapter 4), the field (chapters 4 and 5, under the cloud in 6 and 7), the cloud and the network (chapters 6 and 7)
const SET_ORDER = ['soil', 'web', 'field', 'net'];
// sets drawn in another set's frame: the cloud and the network float over the field (the plots a module lights lie
// under it), so the two always turn together
const FRAME = { net: 'field' };
const frameOf = k => FRAME[k] || k;
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 400);
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // lit sets share one sky light and a light from over your shoulder
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
  scene.add(GL.stars);
  // the sets themselves: each built on its own, a step of the load (buildSet, LOAD)
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
  // the hop from Vienna to the field in Japan (the engine's own, in the globe's frame)
  GL.hop = makeHop();
  GL.world.add(GL.hop.group);
}
// The hop (chapter 4 and the Globe scene): an arc above the tour's globe from Vienna to JIRCAS in Japan (Tsukuba: the
// trial's site and year are not given, so the place is JIRCAS's home), drawn out with a travelling glint, the two
// cities glowing. In the web set's frame: the globe has radius 1 and turns by web_spin turns (its live.spin), and its
// longitude L0 faces +z at spin 0 (its ll(), copied here: keep the two in step). Params (DEF, the engine's): hop_a (its
// fade), hop_t (0 nothing; to 1 the arc drawn from Vienna to Japan; the glint then rests on Japan).
// (Keyed in chapter 4 with the globe turning from Vienna to Japan, SPIN in e3_story.js; the Globe scene replays it.)
const HOP = { from: [48.21, 16.37], to: [36.05, 140.12], L0: -12, lift: 0.16, segs: 48 };
function makeHop() {
  const set = K.newSet('hop'), LK = TLOOK(K, set), TAU = Math.PI * 2;
  const tubes = LK.tubes(HOP.segs), halos = LK.halos(4);
  set.group.add(tubes.mesh, halos.mesh);
  const ll = (lat, lon) => { const a = lat * D2R, b = (lon - HOP.L0) * D2R; return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)]; };
  const A = ll(...HOP.from), B = ll(...HOP.to), om = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1));
  // the arc's points at the globe's rest (spin 0): a great circle, lifted in the middle
  const pts = [];
  for (let i = 0; i <= HOP.segs; i++) {
    const s = i / HOP.segs, wa = Math.sin((1 - s) * om) / Math.sin(om), wb = Math.sin(s * om) / Math.sin(om), h = 1.004 + HOP.lift * Math.sin(Math.PI * s);
    pts.push([(A[0] * wa + B[0] * wb) * h, (A[1] * wa + B[1] * wb) * h, (A[2] * wa + B[2] * wb) * h]);
  }
  const P = pts.map(() => [0, 0, 0]), spin = (p, a, o) => { const c = Math.cos(a), s = Math.sin(a); o[0] = p[0] * c + p[2] * s; o[1] = p[1]; o[2] = -p[0] * s + p[2] * c; return o; };
  const COL = [0.27, 0.85, 1], WARM = [1, 0.75, 0.35];
  // where the story's labels point (Vienna, Japan, the glint), as last drawn
  const at = { vienna: [0, 0, 0], japan: [0, 0, 0], glint: [0, 0, 0] };
  return Object.assign(set, {
    at,
    update(S, t) {
      const web = GL.sets.web, a = (S.web_spin || 0) * TAU, f = clamp(S.hop_t || 0, 0, 1);
      for (let i = 0; i < pts.length; i++) spin(pts[i], a, P[i]);
      tubes.begin();
      const n = Math.floor(f * HOP.segs);
      for (let i = 0; i < n; i++) tubes.add(P[i], P[i + 1], 0.006, COL, 0.9);
      tubes.end();
      halos.begin();
      halos.add(P[0], 0.09, WARM, 0.8);
      if (f > 0.98) halos.add(P[HOP.segs], 0.11, WARM, 0.9);
      const g = P[Math.min(HOP.segs, n)];
      if (f > 0.001) halos.add(g, 0.07, COL, 1);
      halos.end();
      at.vienna = P[0]; at.japan = P[HOP.segs]; at.glint = g;
      LK.depth();
      if (web) set.group.visible = set.uA.value > 0.003;
    },
  });
}
// show each set as far as S fades it in, and let the visible ones update (the hidden ones idle); in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
    else if (s.idle) s.idle(dt);   // a hidden set may build in slices
  }
  // the hop turns with the globe's frame
  const ha = (S.hop_a || 0) * (S.web_a || 0);
  GL.hop.group.rotation.y = story ? setYaw('web', t) * D2R : 0;
  GL.hop.setAlpha(ha);
  if (ha > 0.003) GL.hop.update(S, t);
}

// ---------------------------------------------------------------- camera --
// A view is [az, el, dist, tx, ty, tz]: look at the target (tx, ty, tz) from the
// direction az (around the vertical, degrees) and el (up, degrees), dist away.
const _vd = new THREE.Vector3(), _vt = new THREE.Vector3();
function viewDir(v, out) {
  const A = v[0] * D2R, E = clamp(v[1], -85, 85) * D2R;
  return out.set(Math.cos(E) * Math.sin(A), Math.sin(E), Math.cos(E) * Math.cos(A));
}
// on a screen narrower than square (a phone held upright) a wide view stands further back: GL.nf is the view's own
// factor (NARROW in the story; 1 for most views), taken in full at half as wide as tall
GL.nf = 1;
const narrowK = () => (GL.wide || !(GL.nf > 1) ? 1 : 1 + (GL.nf - 1) * clamp((1 - (GL.aspect || 1)) / 0.5, 0, 1));
// on a screen held sideways without the side panel (the panel below, the scene in a strip above it) a view may come
// closer and aim lower: v[10] and v[11] (LOW in the story), taken in full from 1.2 : 1 on (as GL.fit's strip)
const lowK = () => (GL.wide ? 0 : clamp(((GL.aspect || 1) - 0.6) / 0.6, 0, 1));
// (v[7..9]: the target's shift clear of the side panel, FIT in the story; on a screen without a side panel it goes back)
function applyCamera(v) {
  const u = GL.wide ? 0 : 1, L = lowK(), lk = 1 + ((v[10] || 1) - 1) * L;
  viewDir(v, _vd); _vt.set(v[3] - u * (v[7] || 0), v[4] - u * (v[8] || 0) + L * (v[11] || 0), v[5] - u * (v[9] || 0));
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1) * narrowK() * lk);
  GL.camera.up.set(0, 1, 0); GL.camera.lookAt(_vt);
}
// sets on show may keep the camera out of their solid parts (as the muscle story's supercomputer does): keepOut takes the camera's
// position in the set's own frame (t: story time, for the set's turn; null in explore mode) and returns it, moved if
// need be; still(p) says explore mode should stop swaying the view (GL.still, read next frame)
const _yA = new THREE.Vector3(0, 1, 0), _kp = new THREE.Vector3();
function keepCamera(S, t) {
  GL.still = false;
  for (const k of SET_ORDER) {
    const s = GL.sets[k];
    if (!s.keepOut || (S[k + '_a'] || 0) < 0.05) continue;
    const yaw = t === null ? 0 : setYaw(k, t) * D2R;
    _kp.copy(GL.camera.position).applyAxisAngle(_yA, -yaw);
    const p = [_kp.x, _kp.y, _kp.z], q = s.keepOut(p);
    if (s.still && s.still(q)) GL.still = true;
    if (q !== p) { GL.camera.position.copy(_kp.set(q[0], q[1], q[2]).applyAxisAngle(_yA, yaw)); GL.camera.lookAt(_vt); }
  }
}
function resize() {
  if (GL.renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight, { renderer, camera } = GL;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wide = w >= 900;
  GL.wide = wide; GL.aspect = w / h;
  if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  // (on a narrow screen held sideways the panel leaves only a strip above it, about 0.56 h - 122 px tall: the scene
  // stands back far enough to fit that strip, in full from 1.2 : 1 on; upright screens keep their own framing)
  const strip = Math.max(0.12, (0.56 * h - 122) / h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62, 0.9 / strip * clamp((w / h - 0.6) / 0.6, 0, 1));
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
