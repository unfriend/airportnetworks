//#use head GL
// the sets, in the order they appear in the story
const SET_ORDER = ['fish', 'globe', 'cell'];
//#use FRAME frameOf
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  // (the globe and the cell are seen through a long lens, as in their own stories; among the fish the lens is wide, as
  // the flock's: GL.lens, from the story's or explore's lens track, blends the two)
  const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 400);
  Object.assign(GL, { renderer, scene, camera, canvas });
  K.renderer = renderer;   // (the globe sizes its land texture by what the GPU allows, as the airports story does)
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
  GL.stars.material.transparent = true;
  scene.add(GL.stars);
  // the sets themselves: each built on its own, a step of the load (buildSet, LOAD). The fish are life size: in a
  // headset their holder undoes the scale and turn xrPlace gives GL.world for the globe and the cell (placeLife), so the
  // school stays round you while the other sets float in front of you; on a screen it changes nothing
  GL.sets = {};
  GL.life = new THREE.Group(); GL.world.add(GL.life);
}
// one set, built as a step of the load (LOAD) and hidden until the story fades it in
function buildSet(k) {
  const s = SETS[k](K);
  GL.sets[k] = s;
  (k === 'fish' ? GL.life : GL.world).add(s.group);
  s.setAlpha(0);
  if (s.setLang) s.setLang(LANG);
}
//#use sceneJoin PRIME primeCheck primeStep
// show each set as far as S fades it in, and let the visible ones update (the hidden ones idle); in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  // (no stars under water: they come out as the sea shrinks away below you)
  const st = 1 - clamp(S.fish_a || 0, 0, 1) * clamp((S.fish_scale === undefined ? 1 : S.fish_scale) * 1.5, 0, 1);
  GL.stars.material.opacity = st; GL.stars.visible = st > 0.01 && (!XR.on || XR.clear);
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
    else { if (s.idle) s.idle(dt); primeCheck(s); }   // a hidden set may build in slices; once built it is sent to the card before it shows (primeStep, v224)
  }
  primeStep(dt);   // (the globe's 18,858 routes and its land, the cell's links: one thing a frame while frames come fast, not all on the frame the globe first shows)
}

// on a small screen held sideways the scene stands back to fit the strip above the panel (resize)
const STRIP_FIT = 0.9;
//#use _vd viewDir narrowK lowK applyCamera _yA keepCamera resize LV updateLight
// the lens: 32 degrees for the globe and the cell (their stories' own), 58 among the fish (the flock's), blended by
// the lens track (1 among the fish)
function setLens(w) {
  const fov = 32 + 26 * clamp(w, 0, 1);
  if (Math.abs(fov - GL.camera.fov) > 0.01) { GL.camera.fov = fov; GL.camera.updateProjectionMatrix(); }
}
// the fish's holder: nothing on a screen; in a headset it undoes GL.world's pose, so the school's frame hangs a standing
// eye height below the rig, life size, wherever xrPlace puts the globe and the cell; moved by as far as the sea has been
// moved with the grip (XR.lifeOff, in the rig's frame): outside a shared room easing to XR.lifeTo, this headset's own
// (people differ in height); at a station easing to XR.lifeSt, the station's (collab.state()'s sea, the same for
// everyone there: the rig is the station's spot on every headset, so the school is in one place in the room), and put
// there at once when the station is reached. The school stays round the frame's origin there (tellFish, fishSync)
const _lm = new THREE.Matrix4(), _lt = new THREE.Matrix4();
function placeLife(xr, dt) {
  const h = GL.life;
  if (!xr) { h.position.set(0, 0, 0); h.quaternion.identity(); h.scale.setScalar(1); }
  else {
    const st = seaSt();
    if (st && !XR.lifeAt) XR.lifeOff.copy(XR.lifeSt);
    XR.lifeAt = st;
    XR.lifeOff.lerp(st ? XR.lifeSt : XR.lifeTo, 1 - Math.exp(-(dt || 0) * 8));
    GL.world.updateMatrix();
    _lm.copy(GL.world.matrix).invert().multiply(_lt.makeTranslation(XR.lifeOff.x, XR.lifeOff.y - 1.6, XR.lifeOff.z));
    _lm.decompose(h.position, h.quaternion, h.scale);
  }
  h.updateMatrix();
}

// ------------------------------------------------------------ the school --
// Among the fish, on a screen, the camera stands where you float and turns to keep the school in view as you would
// turn your head (the flock's followView: it lets the school wander a little first, and eases into and out of each
// turn, at up to 50 degrees a second); from afar it keeps the school in the middle, and flying out to a far view or
// back it comes round to the view's own side at up to 60 degrees a second. keep: return the followed view as it is
// now (when you take over the camera).
const FOL = { az: null, el: -20, wa: 0, we: 0, tx: 0, ty: 1.6, tz: -5, vz: null, ve: 0 };
//#use lazy track
// the school's middle, in the world's frame (the set may be shrinking or turned)
const _sc = new THREE.Vector3();
function schoolAt() {
  const s = GL.sets.fish, c = s.anchors.school();
  s.group.updateMatrix();
  return _sc.set(c[0], c[1] - 0.6, c[2]).applyMatrix4(s.group.matrix).applyMatrix4(GL.life.matrix).toArray();
}
function followView(v, dt, keep) {
  dt = keep ? 0 : dt || 0;
  const c = schoolAt(), k = 1 - Math.exp(-dt * 1.2);
  const dx = c[0] - v[3], dy = c[1] - v[4], dz = c[2] - v[5], h = Math.hypot(dx, dz) + 1e-6;
  // the camera looks along -dir(az, el): it faces the school at az = atan2(-dx, -dz), el = -atan(dy / h)
  let az = Math.atan2(-dx, -dz) / D2R;
  const el = clamp(-Math.atan2(dy, h) / D2R, -60, 60);
  if (FOL.az === null) { FOL.az = az; FOL.el = el; FOL.wa = FOL.we = 0; FOL.tx = c[0]; FOL.ty = c[1]; FOL.tz = c[2]; }
  az += 360 * Math.round((FOL.az - az) / 360);
  // the dead zone: about half the way to the edge of the picture (narrow on a phone held upright)
  const hw = Math.atan(Math.tan(GL.camera.fov * D2R / 2) * GL.camera.aspect) / D2R;
  // below the picture's middle the side panel covers a narrow screen: there the school is held a little higher
  track(FOL, 'az', 'wa', az, clamp(hw * 0.45, 6, 22), 2.5, 50, dt); track(FOL, 'el', 'we', el + (GL.wide || GL.bare ? 0 : 5), 6, 2.5, 30, dt);
  FOL.tx += (c[0] - FOL.tx) * k; FOL.ty += (c[1] - FOL.ty) * k; FOL.tz += (c[2] - FOL.tz) * k;
  // FOL.az winds on as the school circles: blend from the turn nearest the view's own, or the camera whirls
  const fa = FOL.az + 360 * Math.round((v[0] - FOL.az) / 360);
  const w = smooth((v[2] - 0.6) / 2.4);   // 0 close up (turn to the school), 1 from afar (aim at it)
  let va = fa + (v[0] - fa) * w;
  const ve = FOL.el + (v[1] - FOL.el) * w;
  if (keep || FOL.vz === null) { FOL.vz = va; FOL.ve = ve; }
  else {
    va += 360 * Math.round((FOL.vz - va) / 360);
    FOL.vz += clamp(va - FOL.vz, -60 * dt, 60 * dt); FOL.ve += clamp(ve - FOL.ve, -40 * dt, 40 * dt);
  }
  const out = v.slice();
  out[0] = FOL.vz; out[1] = FOL.ve; out[3] = v[3] + (FOL.tx - v[3]) * w; out[4] = v[4] + (FOL.ty - v[4]) * w; out[5] = v[5] + (FOL.tz - v[5]) * w;
  return out;
}
// the school keeps clear of you: your head and hands, in its own frame. On a screen you float at the middle of the
// sea (not where the camera is: from afar the school would follow the camera away). spot: at a station in a shared
// room (fishSync), where the school stays round the station's spot instead of round you (its frame's origin, so
// moved with the station's sea, XR.lifeSt, the same on every headset there); elsewhere in a headset with
// the sea moved, it stays round where you would be had you not moved it (so it keeps where you put it)
const _sv = new THREE.Vector3(), _sm = new THREE.Matrix4();
function tellFish(xr, spot) {
  const s = GL.sets.fish;
  GL.world.updateMatrixWorld(true);
  _sm.copy(s.group.matrixWorld).invert();
  const head = xr ? _sv.copy(XR.head).applyMatrix4(_sm).toArray() : [0, 1.6, 0];
  const hands = xr ? XR.ctrls.filter(c => c.src && c.g.visible).map(c => _sv.copy(c.o).applyMatrix4(_sm).toArray()) : [];
  if (xr && !spot && XR.lifeOff.lengthSq() > 1e-6) { _sv.copy(XR.lifeOff).applyQuaternion(GL.rig.quaternion).add(XR.head).applyMatrix4(_sm); spot = [_sv.x, _sv.z]; }
  s.see(head, hands, spot);
}
// a point of the world (THREE.Vector3, world coordinates) in the school's frame
function inFish(p) { GL.world.updateMatrixWorld(true); return p.clone().applyMatrix4(_sm.copy(GL.sets.fish.group.matrixWorld).invert()).toArray(); }
