//#use head GL
// the sets, in the order they appear in the story
const SET_ORDER = ['guide'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 400);   // standing where the viewer stands: a wide view of the room
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // the guide's plates are lit by one sky light and a light from over your shoulder
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 0.85));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.85);
  scene.add(GL.sun); scene.add(GL.sun.target);
  // stars: only in VR, faint (xrStars)
  const sr = K.rng(9), sp = new Float32Array(1800 * 3), sc = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const z = sr() * 2 - 1, t = sr() * Math.PI * 2, r = Math.sqrt(1 - z * z), b = 0.25 + 0.75 * Math.pow(sr(), 3);
    sp.set([150 * r * Math.cos(t), 150 * z, 150 * r * Math.sin(t)], 3 * i); sc.set([b, b, b * 1.05], 3 * i);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  GL.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.1 }));
  scene.add(GL.stars); GL.stars.visible = false;
  // the sets themselves: each built on its own, a step of the load (buildSet, LOAD)
  GL.sets = {};
}
//#use FRAME frameOf buildSet updateSets _vd viewDir
// once the set is built: the guide's body waits for bodies.js (HOST.needBodies, loaded by the shell), at most 8 s;
// without it the plain figure stands in
function sceneJoin() {
  const s = GL.sets.guide;
  if (s.figure() !== 'wait') return false;
  if (!LOAD.bw) LOAD.bw = performance.now();
  if (performance.now() - LOAD.bw > 8000) { s.usePlain('bodies.js took too long'); return false; }
  return true;
}
function applyCamera(v) {
  viewDir(v, _vd); _vt.set(v[3], v[4], v[5]);
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * Math.min(GL.fit || 1, 1.25));   // (life size: never far behind where you stand)
  GL.camera.position.y = Math.max(GL.camera.position.y, 0.3);   // never under the floor
  GL.camera.up.set(0, 1, 0); GL.camera.lookAt(_vt);
}
// a small screen held sideways keeps the framing this story had before the strip above the panel was fitted (resize)
const STRIP_FIT = 0;
//#use resize LV updateLight
// ----------------------------------------------------------- the viewer --
// What the guide sees of you, in its set's frame, every frame (the set's see): your head and where your ray points
// (a page: standing at the origin, the mouse's ray), the main panel's buttons it points at (a page: where the panel
// would hang), a shared room, AR, the narration hold, whether the story is paused, and what you point at
const _sv = new THREE.Vector3(), _sm = new THREE.Matrix4(), _sd = new THREE.Vector3();
const PANEL_IDS = { stories: ['main', 'stories'], sound: ['main', 'sound'], recenter: ['main', 'recenter'], top: ['main', 'mode'], foot: ['foot', 'track'], play: ['foot', 'play'], next: ['foot', 'next'], prev: ['foot', 'prev'] };
function panelPoint(id, out) {
  const [pn, rid] = PANEL_IDS[id], P = XR[pn], r = P && P.regions.find(q => q.id === rid);
  const x = r ? r.x + r.w / 2 : P ? P.w / 2 : 0, y = r ? r.y + r.h / 2 : P ? P.h / 2 : 0, mw = P ? P.mesh.geometry.parameters.width : 0.62, mh = P ? P.mesh.geometry.parameters.height : 0.7;
  if (!P) return null;
  P.mesh.updateWorldMatrix(true, false);
  return out.set((x / P.w - 0.5) * mw, (0.5 - y / P.h) * mh, 0).applyMatrix4(P.mesh.matrixWorld).applyMatrix4(_sm).toArray();
}
const LIVE = { head: [0, 1.6, 0], ray: null, panel: null, room: false, ar: false, hover: -1, paused: false, hold: false };
function tellGuide(xr) {
  const s = GL.sets.guide;
  GL.world.updateMatrixWorld(true);
  _sm.copy(s.group.matrixWorld).invert();
  LIVE.head = xr ? _sv.copy(XR.head).applyMatrix4(_sm).toArray() : [0, 1.6, 0];
  LIVE.ray = null; LIVE.hover = -1;
  if (xr) {
    for (const c of XR.ctrls) if (c.src && c.g.visible && c.hover && (c.hover.kind === 'node' || c.hover.kind === 'target' || c.hover.kind === 'floor')) {
      LIVE.ray = _sv.copy(c.hover.point).applyMatrix4(_sm).toArray();
      if (c.hover.kind === 'node') LIVE.hover = c.hover.id; else if (c.hover.kind === 'target') LIVE.hover = 'target';
    }
    LIVE.panel = {};
    for (const k in PANEL_IDS) LIVE.panel[k] = panelPoint(k, _sd);
  } else {
    LIVE.panel = null;
    if (PH.hit) { LIVE.ray = PH.hit.point; LIVE.hover = PH.hit.kind === 'node' ? PH.hit.id : PH.hit.kind === 'target' ? 'target' : -1; }
  }
  LIVE.room = !!(HOST.room && HOST.room.inRoom && HOST.room.inRoom());
  LIVE.ar = !!(xr && !XR.clear);
  LIVE.paused = APP.mode === 'story' ? !APP.playing && !HOST.picking : !PR.run;
  LIVE.hold = HOLD.on;
  s.see(LIVE);
}
