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

//#part MOLS
// ================================================================ MODELS ==
// Protein models built by tools/mol/build.py (tools/mol/SPEC.md): one <name>.mol per model, its residue table and its
// looks (surface and cartoon, three levels of detail each; balls drawn from the table). MOLS.m[name] is the parsed
// file ({ head, res, geo }), or { pend: true } while it loads, or { err } if it could not be had.
const MOLS = { m: {}, px: 600, frame: -1 };
//#part molLoad
// starts fetching models; urlOf gives a file's address (in a package f => pkgUrl('models/' + f)). Calling it again for
// a model asked for before does nothing, so a set's prep may call it every time: molReady(urlOf, names) is true once
// all of them have come (or failed), for SETS.x.prep, which buildSet runs again until it is
function molLoad(urlOf, names) {
  for (const n of names) {
    if (MOLS.m[n]) continue;
    const m = MOLS.m[n] = { pend: true };
    fetch(urlOf(n + '.mol')).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(b => Object.assign(m, molParse(b), { pend: false }))
      .catch(e => { m.pend = false; m.err = String(e); console.warn(`model ${n} not loaded: ${e}`); });
  }
}
const molWait = () => Object.values(MOLS.m).some(m => m.pend);
const molReady = (urlOf, names) => { molLoad(urlOf, names); return !names.some(n => MOLS.m[n].pend); };
//#part molParse
// a .mol file: 'MOL1', the format's version and the header's length (uint32 each), the header (JSON: each array's
// offset into the data after it), the data. Views on the file's own buffer: nothing is copied
function molParse(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x314c4f4d) throw new Error('not a .mol file');
  if (dv.getUint32(4, true) > 1) throw new Error('a newer .mol format: update the app');
  const n = dv.getUint32(8, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, n))), o = 12 + n;
  const at = (T, off, len) => new T(buf, o + off, len), R = head.res, N = R.n;
  const res = { n: N, chain: at(Uint8Array, R.chain, N), num: at(Int32Array, R.num, N), one: at(Uint8Array, R.one, N),
    kind: at(Uint8Array, R.kind, N), ss: at(Uint8Array, R.ss, N), dom: at(Uint8Array, R.dom, N), pos: at(Float32Array, R.pos, 3 * N),
    col: at(Uint8Array, R.col, 4 * N), chains: head.chains, domains: head.domains };
  return { head, res, at, geo: {} };
}
// one look's level of detail as a BufferGeometry (made once, shared): positions int16 (the mesh's own scale and
// position turn them back into angstroms), normals oct-encoded int8, colour and ambient occlusion uint8, residue uint16
function molGeo(m, look, lod) {
  const k = look + lod;
  if (m.geo[k]) return m.geo[k];
  const L = m.head.looks[look][lod], g = new THREE.BufferGeometry(), at = m.at;
  g.setAttribute('position', new THREE.BufferAttribute(at(Int16Array, L.pos, 3 * L.v), 3));
  g.setAttribute('aN', new THREE.BufferAttribute(at(Int8Array, L.nrm, 2 * L.v), 2, true));
  g.setAttribute('aCol', new THREE.BufferAttribute(at(Uint8Array, L.col, 4 * L.v), 4, true));
  g.setAttribute('aRes', new THREE.BufferAttribute(at(Uint16Array, L.res, L.v), 1));
  g.setIndex(new THREE.BufferAttribute(at(L.i32 ? Uint32Array : Uint16Array, L.idx, 3 * L.t), 1));
  g.computeBoundingSphere();
  return (m.geo[k] = g);
}
//#part molMaterial
// The models' one material (every look): sky light times the baked ambient occlusion, a key light from the scene's
// sun (LV, where the story has it), a little specular and a soft rim; a highlighted residue range glows (uHi: first and
// last residue index, uHiC its colour, uHiK its strength). The set's fade (uA) as the kit's: see-through and no depth
// written only while it fades. opts.balls: the instanced balls (a unit sphere, each instance a residue)
function molMaterial(set, opts = {}) {
  const lv = typeof LV !== 'undefined' ? LV : new THREE.Vector3(-0.5, 0.6, 1).normalize();
  const m = new THREE.ShaderMaterial({
    defines: opts.balls ? { MOL_BALLS: 1 } : {},
    uniforms: { uA: set ? set.uA : { value: 1 }, uL: { value: lv }, uTime: K.U.uTime, uHi: { value: new THREE.Vector2(-1, -1) },
      uHiC: { value: new THREE.Color(1, 0.85, 0.35) }, uHiK: { value: 0 } },
    vertexShader: `
attribute vec2 aN; attribute vec4 aCol; attribute float aRes;
uniform vec2 uHi;
varying vec3 vC, vN, vW; varying float vAO, vHi;
vec3 octN(vec2 e) {
  vec3 v = vec3(e, 1.0 - abs(e.x) - abs(e.y));
  if (v.z < 0.0) v.xy = (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);
  return normalize(v);
}
void main() {
#ifdef MOL_BALLS
  vec3 n = position;
#else
  vec3 n = octN(aN);
#endif
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  vec4 w = modelMatrix * p;
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * n);
  vC = aCol.rgb; vAO = aCol.a;
#ifdef USE_INSTANCING_COLOR
  vC *= instanceColor;
#endif
  vHi = step(uHi.x - 0.5, aRes) * step(aRes, uHi.y + 0.5);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `
uniform float uA, uTime, uHiK; uniform vec3 uL, uHiC;
varying vec3 vC, vN, vW; varying float vAO, vHi;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW), h = normalize(uL + v);
  float ao = vAO, nv = max(dot(n, v), 0.0);
  vec3 amb = mix(vec3(0.36, 0.33, 0.38), vec3(0.95, 0.97, 1.0), 0.5 + 0.5 * n.y) * (0.15 + 0.85 * ao) * 0.52;
  float dif = max(dot(n, uL), 0.0) * (0.45 + 0.55 * ao) * 0.62;
  float sp = pow(max(dot(n, h), 0.0), 40.0) * 0.16 * ao, rim = pow(1.0 - nv, 3.0) * 0.16 * ao;
  vec3 col = vC * (amb + dif + rim) + sp;
  float k = vHi * uHiK;
  col = mix(col, uHiC * (0.55 + 0.6 * ao), k * 0.55) + uHiC * k * (0.22 + 0.1 * sin(uTime * 4.0));
  gl_FragColor = vec4(col, uA);
}`,
  });
  const U = m.uniforms;
  Object.defineProperty(m, 'transparent', { configurable: true, get: () => U.uA.value < 0.999, set() {} });
  Object.defineProperty(m, 'depthWrite', { configurable: true, get: () => U.uA.value > 0.97, set() {} });
  if (set) set.mats.push(m);
  return m;
}
//#part molMesh
// A model as a set shows it. opts: look ('surface', 'cartoon' or 'balls'), its size (width: scene units along its own
// x, its longest axis as built; or radius: of its bounding sphere; or scale: scene units per angstrom), lod ('auto',
// the default: by its size on screen, page or headset; or 0, 1, 2), lodPx (the auto choice's radii in pixels, [260, 70]),
// centred (true: its middle at the group's origin; false: where the entry's coordinates put it, for models built with
// orient: false). Returns { group, ok, s (scene units per angstrom), res (the residue table), find(chain, num),
// anchor(chain, num, v), setHighlight(from, to, colour, strength), lod() }; a model that did not load gives an empty group
function molMesh(set, name, opts = {}) {
  const m = MOLS.m[name], look = opts.look || 'surface', group = new THREE.Group();
  const out = { group, ok: false, s: 1, res: null, find: () => -1, anchor: (c, n, v) => v || new THREE.Vector3(), setHighlight() {}, lod: () => 0 };
  if (!m || !m.head || (look !== 'balls' && !m.head.looks[look])) return out;
  const H = m.head, R = m.res, s = opts.scale || (opts.radius ? opts.radius / H.radius : (opts.width || 1) / H.size[0]);
  const mat = molMaterial(set, { balls: look === 'balls' }), inner = new THREE.Group(), C = H.centre;
  inner.scale.setScalar(s);
  if (opts.centred !== false) inner.position.set(-C[0] * s, -C[1] * s, -C[2] * s);
  group.add(inner);
  const levels = [0, 1, 2].map(i => {
    if (look === 'balls') return molBalls(m, mat, i);
    const o = new THREE.Mesh(molGeo(m, look, i), mat);
    o.position.fromArray(H.q.off); o.scale.setScalar(H.q.scale);
    return o;
  });
  let cur = opts.lod === undefined || opts.lod === 'auto' ? -1 : K.clamp(opts.lod | 0, 0, 2);
  if (cur >= 0) inner.add(levels[cur]);
  else {
    const L = new THREE.LOD(), px = opts.lodPx || [260, 70], c = new THREE.Vector3(), e = new THREE.Vector3();
    levels.forEach((o, i) => L.addLevel(o, i));
    cur = 1;
    // (THREE.LOD's own distances know nothing of scale: the level comes from the model's radius on screen, with a
    // margin so it does not flicker between two)
    L.update = cam => {
      molPx();
      c.fromArray(C).applyMatrix4(L.matrixWorld); e.setFromMatrixPosition(cam.matrixWorld);
      const r = H.radius * L.matrixWorld.getMaxScaleOnAxis(), d = Math.max(c.distanceTo(e) - r * 0.5, r * 0.2, 1e-4);
      const p = r / d * cam.projectionMatrix.elements[5] * MOLS.px;
      cur = p > px[0] * (cur === 0 ? 0.88 : 1) ? 0 : p > px[1] * (cur <= 1 ? 0.88 : 1) ? 1 : 2;
      levels.forEach((o, i) => { o.visible = i === cur; });
    };
    inner.add(L);
  }
  // a residue's index in the table (chain null: the first); a number not in the model: the one before it (after: after)
  const _f = (chain, num, after) => {
    const ci = H.chains.indexOf(chain == null ? H.chains[0] : String(chain));
    let best = -1;
    for (let i = 0; i < R.n; i++) if (R.chain[i] === ci) {
      if (R.num[i] === num) return i;
      if (after ? R.num[i] > num && best < 0 : R.num[i] < num) best = i;
    }
    return best;
  };
  // a residue named 'B:60', or 60 (in the first chain)
  const idx = (x, after) => (typeof x === 'string' && x.includes(':') ? _f(x.split(':')[0], parseInt(x.split(':')[1], 10), after) : _f(null, +x, after));
  Object.assign(out, {
    ok: true, s, res: R, mat, levels, find: _f, lod: () => cur,
    // a residue's place (its alpha carbon, or phosphate) in the group's frame, scene units
    anchor(chain, num, v = new THREE.Vector3()) {
      const i = _f(chain, num);
      if (i < 0) return v.set(0, 0, 0);
      return v.set(R.pos[3 * i], R.pos[3 * i + 1], R.pos[3 * i + 2]).multiplyScalar(s).add(inner.position);
    },
    // light up residues from..to ('A:60', 'A:152'; or numbers in the first chain); from null: none
    setHighlight(from, to, colour, strength = 1) {
      const U = mat.uniforms;
      if (from == null) { U.uHiK.value = 0; return; }
      U.uHi.value.set(idx(from, true), idx(to == null ? from : to));
      if (colour) U.uHiC.value.set(colour);
      U.uHiK.value = strength;
    },
  });
  return out;
}
// half the view's height in pixels (a headset's eye, or the page's drawing buffer), once a frame
function molPx() {
  const r = typeof GL !== 'undefined' && GL.renderer;
  if (!r || MOLS.frame === r.info.render.frame) return;
  MOLS.frame = r.info.render.frame;
  MOLS.px = r.xr.isPresenting && typeof XR !== 'undefined' && XR.viewH ? XR.viewH / 2 : r.getDrawingBufferSize(new THREE.Vector2()).y / 2;
}
// the balls: one instanced sphere per residue (alpha carbon or phosphate; nucleotides bigger), detail by level
function molBalls(m, mat, lod) {
  const R = m.res, n = R.n, geo = new THREE.IcosahedronGeometry(1, 2 - lod);
  const o = new THREE.InstancedMesh(geo, mat, n), M = new THREE.Matrix4(), id = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = R.kind[i] === 1 ? 3.0 : R.kind[i] === 2 ? 1.8 : 2.3;
    M.makeScale(r, r, r).setPosition(R.pos[3 * i], R.pos[3 * i + 1], R.pos[3 * i + 2]);
    o.setMatrixAt(i, M); id[i] = i;
  }
  geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(R.col, 4, true));
  geo.setAttribute('aRes', new THREE.InstancedBufferAttribute(id, 1));
  o.frustumCulled = false;
  return o;
}
//#part molInstanced
// many copies of one model in one draw (a crowd): opts look ('surface'), lod (2), count, and its size as for molMesh
// (width, radius or scale). Returns { mesh, s, setAt(i, pos, quat, k) } (k: that copy's size, 1 by default); each copy
// may be tinted with mesh.setColorAt (multiplies the model's own colours)
function molInstanced(set, name, opts = {}) {
  const m = MOLS.m[name], look = opts.look || 'surface', n = opts.count || 1;
  if (!m || !m.head || !m.head.looks[look]) return { mesh: new THREE.Group(), s: 1, setAt() {} };
  const H = m.head, s = opts.scale || (opts.radius ? opts.radius / H.radius : (opts.width || 1) / H.size[0]);
  const mesh = new THREE.InstancedMesh(molGeo(m, look, opts.lod === undefined ? 2 : opts.lod), molMaterial(set), n);
  mesh.frustumCulled = false;   // (three.js r128 culls an instanced mesh by its geometry alone)
  const B = new THREE.Matrix4().makeScale(H.q.scale, H.q.scale, H.q.scale)
    .setPosition(H.q.off[0] - H.centre[0], H.q.off[1] - H.centre[1], H.q.off[2] - H.centre[2]);
  const M = new THREE.Matrix4(), S = new THREE.Vector3();
  return { mesh, s, setAt(i, pos, quat, k = 1) {
    mesh.setMatrixAt(i, M.compose(pos, quat, S.setScalar(s * k)).multiply(B));
    mesh.instanceMatrix.needsUpdate = true;
  } };
}
