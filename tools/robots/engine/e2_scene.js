
// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['robots'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 200);   // a room: robots at your feet, nothing far away
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // the set lights itself in its shaders; these are for built-in lit materials, should any appear
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 0.85));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.85);
  scene.add(GL.sun); scene.add(GL.sun.target);
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
// once every set is built (a step of the load): what joins them (nothing here)
function sceneJoin() {}
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
// The screen camera, in the set's frame (on a screen the world is not moved or turned). g (0..1) pulls the target
// onto the gang, followed smoothly (the low view keeps the robots in the picture); low down the camera stays inside
// the room (the walls nearest you drop only to skirting height, which would hide the floor from there) and always
// above the floor. "Your eyes" (CAMV.e) blends to the avatar's head, looking lazily at the gang.
const CAMV = { gx: null, gz: null, e: 0, look: null, hold: 0, off: 0, daz: 0 };
const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cm = new THREE.Matrix4(), _cU = new THREE.Vector3(0, 1, 0);
const _ep = new THREE.Vector3(), _eq = new THREE.Quaternion(), _ee = new THREE.Euler(0, 0, 0, 'YXZ');
// a point well inside the floor (and outside furniture): the low camera's place
function inRoom(x, z) {
  const F = GL.sets.robots, r = 0.16;
  for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (!F.floorPoint([x + ox, 1, z + oz], [0, -1, 0])) return false;
  return true;
}
function gangStep(dt) {
  const c = GL.sets.robots.anchors.gang(), k = CAMV.gx === null ? 1 : 1 - Math.exp(-dt * 1.4);
  if (CAMV.gx === null) { CAMV.gx = c[0]; CAMV.gz = c[2]; }
  CAMV.gx += (c[0] - CAMV.gx) * k; CAMV.gz += (c[2] - CAMV.gz) * k;
}
// low down, the camera looks past you rather than into your legs: it comes round (eased) to the nearest side from
// which the avatar is not in the way between it and the gang (or, failing that, is furthest from the camera)
const AZ_TRY = [0, 20, -20, 40, -40, 60, -60, 90, -90, 120, -120, 150, -150, 180];
function youGap(v, g, off) {
  const a = GL.sets.robots.avatar();
  if (!a.shown) return 9;
  const A = (v[0] + off) * D2R, d = Math.min(2.2, v[2]), ex = Math.sin(A), ez = Math.cos(A);
  const tx = v[3] + (CAMV.gx - v[3]) * g, tz = v[5] + (CAMV.gz - v[5]) * g;
  const u = clamp((a.x - tx) * ex + (a.z - tz) * ez, Math.min(0.5, d), d);   // you may stand by the gang, not by the camera
  return Math.hypot(a.x - tx - ex * u, a.z - tz - ez * u);
}
// ... and not through furniture taller than the line of sight there (an armchair filling the picture)
function sightBlocked(v, g, off) {
  const B = GL.sets.robots.room().blocks;
  if (!B.length) return false;
  const A = (v[0] + off) * D2R, E = lowEl(v, g) * D2R, d = lowDist(v, g), ex = Math.sin(A) * Math.cos(E), ez = Math.cos(A) * Math.cos(E), ey = Math.sin(E);
  const tx = v[3] + (CAMV.gx - v[3]) * g, tz = v[5] + (CAMV.gz - v[5]) * g;
  for (let u = 0.3; u < d; u += 0.1) {
    const x = tx + ex * u, z = tz + ez * u, y = 0.1 + ey * u;
    for (const b of B) if (!(b.under > 0.12) && b.h > y && inPoly2(b.poly, x, z)) return true;
  }
  return false;
}
// on a narrow screen the picture is a strip above the panel: low down, the camera stands a little further back and
// higher, so the strip shows the gang and the room round it rather than a patch of rug
const lowEl = (v, g) => v[1] + (GL.wide ? 0 : 5 * g);
const lowDist = (v, g) => v[2] * (1 + ((GL.fit || 1) - 1) * (1 - g)) * (GL.wide ? 1 : 1 + 0.35 * g);   // the fit frames the room; low down there is nothing to frame
function orbitPose(v, g, dt) {
  if (g > 0.3) {
    if (youGap(v, g, CAMV.off) < 0.5 || sightBlocked(v, g, CAMV.off)) {
      let best = 0, bg = -9;
      for (const o of AZ_TRY) {
        const q = youGap(v, g, o), s = sightBlocked(v, g, o);
        if (q >= 0.5 && !s) { best = o; break; }
        if (q - (s ? 1 : 0) > bg) { bg = q - (s ? 1 : 0); best = o; }
      }
      CAMV.off = best;
    }
  } else CAMV.off = 0;
  CAMV.daz += (CAMV.off - CAMV.daz) * (dt ? 1 - Math.exp(-dt * 1.2) : 1);
  const vv = [v[0] + CAMV.daz * g, lowEl(v, g), v[2]];
  _vt.set(v[3] + (CAMV.gx - v[3]) * g, v[4] + (0.1 - v[4]) * g, v[5] + (CAMV.gz - v[5]) * g);
  viewDir(vv, _vd);
  let d = lowDist(v, g);
  for (let k = 0; k < 14; k++) {
    _cp.copy(_vt).addScaledVector(_vd, d);
    if (_cp.y > 0.8 || d < 0.35 || inRoom(_cp.x, _cp.z)) break;
    d *= 0.88;
  }
  _cp.y = Math.max(_cp.y, 0.12);   // never under the floor
  _cm.lookAt(_cp, _vt, _cU); _cq.setFromRotationMatrix(_cm);
}
// the avatar's eyes: a dead zone and eased turns (as the flock's camera), so the view does not chase every robot
function eyesPose(dt) {
  const F = GL.sets.robots, a = F.avatar(), h = a.head, c = F.anchors.gang();
  const dx = c[0] - h[0], dz = c[2] - h[2], hd = Math.hypot(dx, dz) + 1e-6;
  let az = Math.atan2(-dx, -dz) / D2R;
  const el = clamp(Math.atan2(0.15 - h[1], hd) / D2R, -62, 0);
  if (!CAMV.look) CAMV.look = { az: a.yaw / D2R, el: -28, wa: 0, we: 0 };
  const L = CAMV.look;
  az += 360 * Math.round((L.az - az) / 360);
  if (CAMV.hold > 0) { CAMV.hold -= dt; L.wa = L.we = 0; }
  else {
    const hw = Math.atan(Math.tan(GL.camera.fov * D2R / 2) * GL.camera.aspect) / D2R;
    track(L, 'az', 'wa', az, clamp(hw * 0.45, 6, 22), 2.5, 50, dt); track(L, 'el', 'we', el, 8, 2.5, 30, dt);
  }
  _ep.set(h[0], h[1], h[2]);
  _eq.setFromEuler(_ee.set(L.el * D2R, L.az * D2R, 0, 'YXZ'));
}
// v: the orbit [az, el, dist, tx, ty, tz]; g: how far its target is on the gang; eyes: the avatar's eyes wanted
function applyView(v, g, eyes, dt) {
  gangStep(dt);
  CAMV.e += ((eyes ? 1 : 0) - CAMV.e) * (dt ? 1 - Math.exp(-dt * 2.2) : 1);
  if (CAMV.e < 0.002) CAMV.e = 0;
  if (!eyes && CAMV.e === 0) CAMV.look = null;
  const s = smooth(CAMV.e);
  orbitPose(v, g, dt);
  if (s > 0) {
    eyesPose(dt);
    _cp.lerp(_ep, s); _cq.slerp(_eq, s);
  }
  GL.camera.position.copy(_cp); GL.camera.quaternion.copy(_cq);
  GL.sets.robots.avatar(!(eyes && CAMV.e > 0.55));   // your own body is out of the way in your eyes
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
  // on a narrow screen the panel covers the lower part: the room is framed in the strip above it
  const strip = Math.max(0.12, (0.56 * h - 122) / h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1 / strip, 1.2 / (w / h));
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
const lazy = (d, dz) => Math.sign(d) * Math.max(0, Math.abs(d) - dz);
// turn o[x] towards g: the speed it wants grows with the error beyond the dead zone; its speed o[w] eases there
function track(o, x, w, g, dz, gain, top, dt) {
  const want = clamp(lazy(g - o[x], dz) * gain, -top, top);
  o[w] += (want - o[w]) * (1 - Math.exp(-dt * 4));
  o[x] += o[w] * dt;
}

// ------------------------------------------------------------- the gang --
// The gang needs to know where you are: in a headset your head (standing on the floor below it, facing where you
// look); on a screen the avatar walks for you and the camera is only an eye (for the doll's-house walls and the
// robots' glances). Positions go into the set's own frame, which a headset room may move and turn.
const _sv = new THREE.Vector3(), _sm = new THREE.Matrix4(), _sf = new THREE.Vector3();
function tellRobots(xr) {
  const s = GL.sets.robots;
  GL.world.updateMatrixWorld(true);
  _sm.copy(s.group.matrixWorld).invert();
  if (xr || (XR.on && XRR.kind)) {
    const head = _sv.copy(XR.head).applyMatrix4(_sm);
    _sf.set(0, 0, -1).applyQuaternion(XR.headQ).transformDirection(_sm);
    s.player(head.x, head.z, Math.atan2(-_sf.x, -_sf.z), false);
    s.see(head.toArray());
  } else s.see(_sv.copy(GL.camera.position).applyMatrix4(_sm).toArray());
}
