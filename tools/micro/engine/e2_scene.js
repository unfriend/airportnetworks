
// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['body', 'tissue', 'slide', 'atlas', 'hier'];
// sets drawn in another set's frame: the slide's tiles and domains lie on the tour's tissue section, so the two always
// turn together (and show together)
const FRAME = { slide: 'tissue' };
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
  // the sets themselves, all hidden until the story fades them in
  GL.sets = {};
  for (const k of SET_ORDER) {
    const s = SETS[k](K);
    GL.sets[k] = s;
    GL.world.add(s.group);
    s.setAlpha(0);
  }
  // one colour per domain in every set: the atlas set's (from the talk's figures), handed to the sets that take it
  const dc = GL.sets.atlas.api && GL.sets.atlas.api().domainColour;
  if (dc) for (const k of SET_ORDER) { const A = GL.sets[k].api && GL.sets[k].api(), f = A && (A.useColours || A.recolour); if (f && k !== 'atlas') f(dc); }
  // the 29 organs of GTEx as points of light in the tour's body (the engine's own, in the body set's frame)
  GL.dots = makeDots();
  GL.sets.body.group.add(GL.dots.group);
}
// The organs' points: MICRO_DATA.organs' home points in the body, under the params dots (0..1, as far as the body shows)
// and dots_pick (an organ's index + 1, 0 none: it grows and glows white, the others dim a little, and the organ's small
// 3D model (ORGAN3D) floats out beside it, turning slowly, once the models are built). They twinkle gently.
const DOT_COL = '#ff9ec4';
function makeDots() {
  const set = K.newSet('dots'), O = MICRO_DATA.organs, n = O.length, g = K.pointsGeo(n);
  const P = g.attributes.position.array, C = g.attributes.aCol.array, Z = g.attributes.aSize.array, A = g.attributes.aA.array;
  O.forEach((o, i) => { P.set(o.pos, 3 * i); C.set(K.rgb(DOT_COL), 3 * i); Z[i] = 0.05; });
  const pts = new THREE.Points(g, K.points(set, { vertex: 'gl_PointSize *= 1.0 + 0.18 * sin(uTime * 2.3 + position.x * 53.0 + position.y * 31.0);' }));
  pts.renderOrder = 4;
  set.group.add(pts);
  let last = -1, pickT = 0;
  const _p = new THREE.Vector3();
  // the model: only the picked organ's (its geometry swapped when the pick changes, as soon as that model is built: it
  // is wanted first), placed and shown by its uniforms
  const oP = [new THREE.Vector4()], oQ = [new THREE.Vector4()], sh = ORGAN3D.shader(1);
  const om = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: oP }, uQ: { value: oQ },
    uTint: { value: new THREE.Color(...K.rgb(DOT_COL)) } }, vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true }));
  set.mats.push(om.material);
  om.frustumCulled = false; om.renderOrder = 5; om.raycast = () => {}; om.visible = false;
  set.group.add(om);
  let omId = null;
  function model(id, t) {
    if (id !== omId) {
      const M = id && ORGAN3D.mesh(id);
      if (id && !M) return false;   // (wanted: built next)
      om.geometry.dispose();
      if (id && t - pickT > 0 && t - pickT < 9) pickT = t;   // (a model that came late grows from now; not after a seek)
      const mg = om.geometry = new THREE.BufferGeometry();
      if (M) {
        mg.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
        mg.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); mg.setAttribute('aSlot', new THREE.BufferAttribute(new Float32Array(M.pos.length / 3), 1));
        mg.setIndex(new THREE.BufferAttribute(M.idx, 1));
      }
      omId = id;
    }
    return !!id;
  }
  return Object.assign(set, {
    update(S, t) {
      const k = Math.round(S.dots_pick || 0);
      if (k !== last) {
        pickT = last < 0 ? t - 9 : t; last = k;
        O.forEach((o, i) => { const on = k === i + 1; Z[i] = on ? 0.11 : 0.05; A[i] = !k || on ? 1 : 0.45; C.set(K.rgb(on ? '#ffffff' : DOT_COL), 3 * i); });
        g.attributes.aSize.needsUpdate = g.attributes.aA.needsUpdate = g.attributes.aCol.needsUpdate = true;
      }
      if (t < pickT) pickT = t - 9;   // (a seek back: shown at once)
      // the picked organ's model grows out in front of the body, beside its point (left of it: its label runs right)
      const o = O[k - 1];
      om.visible = model(o ? ORGAN3D.idOf(o.name) : null, t);
      if (!om.visible) return;
      const gr = smooth(clamp((t - pickT) / 0.9, 0, 1));
      oQ[0].set(gr, 0.25, t * 0.5, 0);
      oP[0].set(o.pos[0] - 0.19 * gr, o.pos[1] + 0.03, o.pos[2] + 0.16 * gr, 0.075 * (0.3 + 0.7 * gr));
    },
    // the organ a ray passes closest to (within about 0.045 of its point, in the body's units), or -1
    pick(rc) {
      pts.updateMatrixWorld();
      let best = -1, bd = 0.045 * pts.matrixWorld.getMaxScaleOnAxis();
      O.forEach((o, i) => { _p.fromArray(o.pos).applyMatrix4(pts.matrixWorld); const d = rc.ray.distanceToPoint(_p); if (d < bd) { bd = d; best = i; } });
      return best;
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
  // the organs' 3D models and their pictures build between frames from the start, one organ after another (the one a
  // pane or the body wants first): a short slice a frame in a headset, a quarter of the frame elsewhere (4 to 40 ms: a
  // slow frame's stutter is there anyway). Each picture goes into the HTML chips waiting for it as it is done, and the
  // headset's panels redraw on GL.orgV (at most twice a second while they come)
  if (!GL.orgDone) {
    ORGAN3D.driven = true;
    GL.orgDone = ORGAN3D.step(GL.renderer.xr.isPresenting ? 3 : clamp((dt || 0) * 250, 4, 40));
    const v = ORGAN3D.version();
    if (v !== GL.orgSeen) { GL.orgSeen = v; fillOrganPics(); }
    const now = performance.now();
    if (GL.orgDone || now - (GL.orgVT || 0) > 500) { GL.orgVT = now; GL.orgV = v; }
  }
  const da = (S.body_a || 0) * (S.dots || 0);
  GL.dots.setAlpha(da);
  if (da > 0.003) GL.dots.update(S, t);
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
// (v[7..9]: the target's shift clear of the side panel, FIT in the story; on a screen without a side panel it goes back)
function applyCamera(v) {
  const u = GL.wide ? 0 : 1;
  viewDir(v, _vd); _vt.set(v[3] - u * (v[7] || 0), v[4] - u * (v[8] || 0), v[5] - u * (v[9] || 0));
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1) * narrowK());
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
