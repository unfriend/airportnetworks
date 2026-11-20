// Shared parts of the built stories' engine file e2_scene.js: see tools/engine/parts.mjs. Edit a part here, then
// rebuild every story that uses it (node tools/engine/all.mjs); node tools/engine/parts.mjs lists who uses what.
//#part head

//#part GL
// ================================================================= SCENE ==
const GL = {};
//#part frameOf
const frameOf = k => FRAME[k] || k;
//#part buildScene
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
//#part buildSet
// one set, built as a step of the load (LOAD) and hidden until the story fades it in; what a set needs built first (the
// PET scanner's vision row: its 3D organs) is built a slice a step until done (prep; the step runs again while it says no)
function buildSet(k) {
  if (SETS[k].prep && !SETS[k].prep(25)) return true;
  const s = SETS[k](K);
  GL.sets[k] = s;
  GL.world.add(s.group);
  s.setAlpha(0);
}
//#part BUILD
// what the sets still building may take of a frame, all of them together (v136; each hidden one took 3 or 4 ms a frame
// before, two at a time in some stories: 5 to 10 ms a frame in a story's first seconds): in a headset about 1 ms, on a
// page an eighth of the frame, 2 to 8 ms (more where frames are slow anyway). The hidden ones take it by turns, one a
// frame (buildTurn; each of the others is only asked whether it still has work: idle(dt, 0) builds nothing, and returns
// false once it has none); a set on show builds on demand in its update, and finish() at once, as before
const BUILD = { i: 0 };
//#part buildMs
const buildMs = dt => (GL.renderer && GL.renderer.xr.isPresenting ? 1 : clamp((dt || 0) * 125, 2, 8));
//#part buildTurn
function buildTurn(jobs, dt) {
  const want = jobs.filter(j => j.buildPend !== false), go = want.length ? want[BUILD.i++ % want.length] : null, ms = buildMs(dt);
  for (const j of jobs) j.buildPend = j.idle(dt, j === go ? ms : 0) !== false;
}
//#part PRIME
// A set that has finished building sends its textures and buffers to the graphics card before it is shown, one thing a
// frame (v137): its first frame on show otherwise uploads some 5 MB of textures and 20 MB of buffers at once. Each mesh
// is drawn once, unseen, into a 1 x 1 target by a camera looking away from everything (frustum culling and the headset's view off for that draw), put back where
// it was; a texture goes through renderer.initTexture. Any failure stops it for good; nothing else depends on it.
const PRIME = { q: [], sc: null, cam: null, off: false };
//#part primeCheck
function primeCheck(s) {
  if (PRIME.off || s.primed || (s.idle && s.buildPend !== false) || !GL.renderer) return;
  s.primed = true;
  const seen = new Set(), tex = t => { if (t && t.isTexture && !seen.has(t) && (t.isDataTexture || (t.image && t.image.width >= 256))) { seen.add(t); PRIME.q.push(t); } };
  s.group.traverse(o => {
    if (!o.material || !o.geometry || !(o.isMesh || o.isPoints || o.isLine)) return;
    const ms = [].concat(o.material);
    for (const m of ms) { tex(m.map); for (const k in m.uniforms || {}) tex(m.uniforms[k].value); }
    if (ms.some(m => m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial)) return;   // (a lit built-in would link a program for this scene's lack of lights)
    const p = o.geometry.attributes.position;
    if (o.isInstancedMesh || (p && p.count > 3000)) PRIME.q.push(o);
  });
}
//#part primeStep
function primeStep(dt) {
  const r = GL.renderer;
  if (PRIME.off || !PRIME.q.length || !r || dt > 0.02) return;   // (only while frames come at 50 a second or better)
  const o = PRIME.q.shift();
  try {
    if (o.isTexture) { r.initTexture(o); return; }
    const par = o.parent;
    if (!par || [].concat(o.material).some(m => !(r.properties.get(m).currentProgram))) return;   // (no program yet: drawing it would link one here)
    const rt = r.primeRT || (r.primeRT = new THREE.WebGLRenderTarget(1, 1)), sc = PRIME.sc || (PRIME.sc = new THREE.Scene());
    let cam = PRIME.cam;
    if (!cam) { cam = PRIME.cam = new THREE.PerspectiveCamera(50, 1, 0.1, 10); cam.position.set(0, 1e5, 0); cam.lookAt(0, 2e5, 0); cam.updateMatrixWorld(); }   // (looking away from everything: all clipped, nothing shaded)
    const vis = o.visible, cull = o.frustumCulled, mw = o.matrixWorld.clone(), was = r.getRenderTarget(), xr = r.xr.enabled, ar = r.autoClear;
    rt.texture.encoding = r.outputEncoding;   // (the same program as the real frame's)
    sc.add(o); o.visible = true; o.frustumCulled = false; r.xr.enabled = false; r.autoClear = false;
    try { r.setRenderTarget(rt); r.render(sc, cam); } finally {
      r.setRenderTarget(was); r.xr.enabled = xr; r.autoClear = ar;
      sc.remove(o); par.add(o); o.visible = vis; o.frustumCulled = cull; o.matrixWorld.copy(mw);
    }
  } catch (e) { PRIME.off = true; PRIME.q.length = 0; console.warn('prime: stopped', e); }
}
//#part _vd
// ---------------------------------------------------------------- camera --
// A view is [az, el, dist, tx, ty, tz]: look at the target (tx, ty, tz) from the
// direction az (around the vertical, degrees) and el (up, degrees), dist away.
const _vd = new THREE.Vector3(), _vt = new THREE.Vector3();
//#part viewDir
function viewDir(v, out) {
  const A = v[0] * D2R, E = clamp(v[1], -85, 85) * D2R;
  return out.set(Math.cos(E) * Math.sin(A), Math.sin(E), Math.cos(E) * Math.cos(A));
}
// on a screen narrower than square (a phone held upright) a wide view stands further back: GL.nf is the view's own
// factor (NARROW in the story; 1 for most views), taken in full at half as wide as tall
GL.nf = 1;
//#part narrowK
const narrowK = () => ((GL.wide && !GL.bare) || !(GL.nf > 1) ? 1 : 1 + (GL.nf - 1) * clamp((1 - (GL.aspect || 1)) / 0.5, 0, 1));
//#part _yA
// sets on show may keep the camera out of their solid parts (as the muscle story's supercomputer does): keepOut takes the camera's
// position in the set's own frame (t: story time, for the set's turn; null in explore mode) and returns it, moved if
// need be; still(p) says explore mode should stop swaying the view (GL.still, read next frame)
const _yA = new THREE.Vector3(0, 1, 0), _kp = new THREE.Vector3();
//#part keepCamera
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
//#part resize
function resize() {
  GL.bare = !!(HOST.focus && HOST.focus());   // focus mode (the shell's): the 3D alone on the page, no panel to clear
  if (GL.renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight, { renderer, camera } = GL;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wide = w >= 900;
  GL.wide = wide; GL.aspect = w / h;
  if (GL.bare) camera.setViewOffset(w, h, 0, 0.05 * h, w, h);   // (its middle a little above the page's: more bar below)
  else if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  // (on a narrow screen held sideways the panel leaves only a strip above it, about 0.56 h - 122 px tall: the scene
  // stands back far enough to fit that strip, in full from 1.2 : 1 on; upright screens keep their own framing)
  // (STRIP_FIT: the story's own share of that, 0.9; 0 in the stories framed before it, which keep their framing there)
  const strip = Math.max(0.12, (0.56 * h - 122) / h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62, STRIP_FIT / strip * clamp((w / h - 0.6) / 0.6, 0, 1));
  // (focus mode: the page between the top bar, 48 px, and the bar and subtitles below, 126 px, about the scene's
  // middle at 0.45 h; at fit 1 a scene reaches about 0.95 of the screen's half height up and down, 1 to the sides)
  if (GL.bare) GL.fit = Math.max(1, 0.95 / Math.max(0.25, Math.min(0.45 * h - 48, 0.55 * h - 126) / (0.5 * h)), h / w);
  camera.updateProjectionMatrix();
}
//#part LV
// the sun comes from over the viewer's left shoulder; point sizes follow the screen (and the world's scale in a headset)
const LV = new THREE.Vector3(), _v2 = new THREE.Vector2();
//#part updateLight
function updateLight(xr) {
  LV.set(-0.5, 0.6, 1.0).normalize().applyQuaternion(xr ? XR.headQ : GL.camera.quaternion);
  GL.sun.position.copy(LV); GL.sun.target.position.set(0, 0, 0);
  if (xr) K.U.uPx.value = XR.viewH * 0.5 * XR.R;
  else K.U.uPx.value = GL.renderer.getDrawingBufferSize(_v2).y * 0.5;
}

//#part sceneJoin
// once every set is built (a step of the load): what joins them (nothing here)
function sceneJoin() {}
//#part FRAME
// (no set is drawn in another's frame here; the engine's shared lines keep the hook)
const FRAME = {};
//#part updateSets~2
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
}

//#part lowK
// on a screen held sideways without the side panel (the panel below, the scene in a strip above it) a view may come
// closer and aim lower: v[10] and v[11] (LOW in the story), taken in full from 1.2 : 1 on (as GL.fit's strip)
const lowK = () => (GL.wide || GL.bare ? 0 : clamp(((GL.aspect || 1) - 0.6) / 0.6, 0, 1));
//#part applyCamera
// (v[7..9]: the target's shift clear of the side panel, FIT in the story; on a screen without a side panel it goes back)
function applyCamera(v) {
  const u = GL.wide && !GL.bare ? 0 : 1, L = lowK(), lk = 1 + ((v[10] || 1) - 1) * L;
  viewDir(v, _vd); _vt.set(v[3] - u * (v[7] || 0), v[4] - u * (v[8] || 0) + L * (v[11] || 0), v[5] - u * (v[9] || 0));
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1) * narrowK() * lk);
  GL.camera.up.set(0, 1, 0); GL.camera.lookAt(_vt);
}
//#part lazy
const lazy = (d, dz) => Math.sign(d) * Math.max(0, Math.abs(d) - dz);
//#part track
// turn o[x] towards g: the speed it wants grows with the error beyond the dead zone; its speed o[w] eases there
function track(o, x, w, g, dz, gain, top, dt) {
  const want = clamp(lazy(g - o[x], dz) * gain, -top, top);
  o[w] += (want - o[w]) * (1 - Math.exp(-dt * 4));
  o[x] += o[w] * dt;
}
//#part updateSets
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

//#part updateSets~3
// show each set as far as S fades it in, and let the visible ones update (the hidden ones idle); in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  const hid = [];
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
    else { if (s.idle) hid.push(s); primeCheck(s); }   // a hidden set may build in slices (buildTurn, below), and is sent to the card when done (primeStep)
  }
  buildTurn(hid, dt);
  primeStep(dt);
}

