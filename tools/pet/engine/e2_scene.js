//#use head GL
// the sets, in the order they appear in the story
const SET_ORDER = ['scan', 'body', 'organs', 'liver'];
// sets drawn in another set's frame: the organs lie in the PET body, so the two always turn together
const FRAME = { body: 'organs' };
//#use frameOf
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 400);
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // lit sets (the scanner, the tour's body, the organs' shells ...) share one sky light and a light from over your shoulder
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
// one set, built as a step of the load (LOAD) and hidden until the story fades it in; what a set needs built first (the
// scanner's vision row: its 3D organs) is built a slice a step until done (prep; the step runs again while it says no)
function buildSet(k) {
  if (SETS[k].prep && !SETS[k].prep(25)) return true;
  const s = SETS[k](K);
  GL.sets[k] = s;
  GL.world.add(s.group);
  s.setAlpha(0);
}
//#use sceneJoin BUILD buildMs buildTurn PRIME primeCheck primeStep
// show each set as far as S fades it in, and let the visible ones update (the hidden ones idle); in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  const hid = [];
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
    if (s.riseTo) s.riseTo.yaw = story ? ST.riseYaw || 0 : 0;   // (where the scanner's patient stands up: the body set's turn less its own)
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
    else { if (s.idle) hid.push(s); primeCheck(s); }   // a hidden set may build in slices (buildTurn, below), and is sent to the card when done (primeStep)
  }
  buildTurn(hid, dt);
  primeStep(dt);
}

//#use _vd viewDir narrowK applyCamera _yA keepCamera resize LV updateLight