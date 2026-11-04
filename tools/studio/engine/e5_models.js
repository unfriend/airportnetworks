
// ================================================================= MODELS ==
// One entry per model file of the scene: fetched and parsed once (GLTF/GLB with three.js's GLTFLoader, FBX with its
// FBXLoader), then cloned for every object that places it (SkeletonUtils for a rigged one), each clone with its own
// materials (so each fades on its own) and its own AnimationMixer. Textures a file names but does not hold are looked
// for in the scene's listing (the exact path, else the base name, case aside: an FBX's C:\Users\... path is ignored);
// one not there leaves the model untextured and its card says so. Textures larger than OPT.maxtex (4,096 px) on a side
// are drawn down before they reach the GPU. A file no object uses any more is dropped and its memory freed.
const LIB = new Map();   // path -> entry
const TEX_KEYS = ['map', 'emissiveMap', 'normalMap', 'bumpMap', 'specularMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'lightMap', 'displacementMap'];
// what a texture not found becomes while the model loads: a tiny white picture (3 x 1, so it is told apart), dropped after
const MISSING = (() => { const c = document.createElement('canvas'); c.width = 3; c.height = 1; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 3, 1); return c.toDataURL(); })();
function lib(path) {
  let E = LIB.get(path);
  if (!E) {
    E = { path, state: 'idle', p: 0, root: null, clips: [], info: null, guess: null, users: new Set(), gen: 0, texPaths: new Set(), missing: new Set(), err: '', drop: 0, ms: null, auth: false };
    LIB.set(path, E);
  }
  if (E.drop) { unlater(E.drop); E.drop = 0; }
  if (E.state === 'idle' && STU.fileMap.has(path)) libLoad(E);
  return E;
}
// an object no longer uses its file: a file nobody uses is dropped a few seconds later (Undo may want it back)
function libRelease(E, id) {
  if (!E) return;
  E.users.delete(id);
  if (!E.users.size && !E.drop) E.drop = later(() => { E.drop = 0; if (!E.users.size) libDrop(E); }, 5000);
}
function libDrop(E) {
  E.gen++;
  if (E.root) disposeTree(E.root, true);
  E.root = null; E.state = 'idle';
  LIB.delete(E.path);
}
function disposeTree(root, textures) {
  const seen = new Set();
  root.traverse(o => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    for (const m of [].concat(o.material || [])) {
      if (seen.has(m)) continue;
      seen.add(m);
      if (textures) for (const k of TEX_KEYS) if (m[k] && m[k].isTexture && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); }
      m.dispose();
    }
  });
}
// a changed file (the relay's watch): a model fetched again (its objects rebuilt in place once it is in), the models
// that used a changed texture too, a sound decoded again
function fileChanged(p) {
  const E = LIB.get(p);
  if (E && E.users.size) { if (STU.fileMap.has(p)) libLoad(E); else { E.gen++; E.state = 'missing'; libChanged(E); } }
  for (const M of LIB.values()) if (M !== E && M.users.size && M.texPaths.has(p) && STU.fileMap.has(M.path)) libLoad(M);
  emitChanged(p);
}
const libChanged = () => { STU.libRev++; dirty(); };
async function libLoad(E) {
  const gen = ++E.gen, f = STU.fileMap.get(E.path), scene = STU.scene, t0 = performance.now();
  E.state = 'loading'; E.p = 0; E.err = ''; E.auth = false;
  libChanged(E);
  try {
    const buf = await getBytes(fileUrl(E.path), n => { if (gen === E.gen) E.p = f && f.bytes ? Math.min(0.99, n / f.bytes) : 0; });   // (the grey box shows it)
    if (gen !== E.gen || scene !== STU.scene || GL.gone) return;
    E.state = 'parsing'; libChanged(E);
    await new Promise(r => later(r, 60));   // (the grey box says "Reading" before parsing stalls the page)
    if (gen !== E.gen || scene !== STU.scene || GL.gone) return;
    const t1 = performance.now(), missing = new Set(), texPaths = new Set();
    const res = await parseModel(E, buf, missing, texPaths);
    if (gen !== E.gen || scene !== STU.scene || GL.gone) { if (res && res.root) disposeTree(res.root, true); return; }
    const old = E.root;
    E.missing = missing; E.texPaths = texPaths;
    E.auth = SRC.held && missing.size > 0;   // (its textures refused with the relay's password: fetched again once it has one)
    finishModel(E, res);
    E.ms = { fetch: Math.round(t1 - t0), parse: Math.round(performance.now() - t1) };
    E.state = 'ready';
    if (old) later(() => disposeTree(old, true), 0);   // (the items rebuild from the new one this frame)
  } catch (e) {
    if (gen !== E.gen) return;
    E.state = 'failed';
    E.err = whyFailed(e);
    E.auth = e && e.status === 401;   // (fetched again once the relay takes this page's password: authAgain)
    if (!GL.gone) console.warn('The studio could not load', E.path, e && e.message);
  }
  libChanged(E);
}
// in words, what a failed file says (the card shows it)
function whyFailed(e) {
  const m = String((e && e.message) || e || '');
  if (/DRACOLoader|draco/i.test(m)) return 'Compressed with Draco, which the studio cannot read: export it without mesh compression.';
  if (/meshopt/i.test(m)) return 'Compressed with meshopt, which the studio cannot read: export it without compression.';
  if (/basisu|KTX2/i.test(m)) return 'Its textures are KTX2/Basis, which the studio cannot read: export PNG or JPEG textures.';
  if (/FBX version not supported/i.test(m)) return 'An FBX older than version 7, which the studio cannot read: export it as FBX 2011 or newer.';
  if (/Unknown format/i.test(m)) return 'Not a model the studio can read (an FBX or a glTF file).';
  if (e && e.status === 404) return 'The file is not in the scene\'s folder any more.';
  if (e && e.status === 401) return AUTH_NOTE;
  return 'It could not be read: ' + m.slice(0, 160);
}
function parseModel(E, buf, missing, texPaths) {
  const ext = extOf(E.path), dir = E.path.includes('/') ? E.path.slice(0, E.path.lastIndexOf('/') + 1) : '', base = sceneUrl(STU.scene) + encPath(dir);
  const manager = new THREE.LoadingManager(), W = { n: 0, done: null };
  // what the model asks for (textures, a .gltf's buffers): it is ready once each has come or failed
  const s0 = manager.itemStart.bind(manager), e0 = manager.itemEnd.bind(manager);
  manager.itemStart = u => { W.n++; s0(u); };
  manager.itemEnd = u => { e0(u); if (--W.n <= 0 && W.done) W.done(); };
  manager.setURLModifier(u => resolveUrl(u, base, dir, missing, texPaths));
  manager.addHandler(/\.tga$/i, new THREE.TGALoader(manager));
  const settle = () => new Promise(res => { if (W.n <= 0) res(); else { W.done = res; later(res, 60000); } });
  if (ext === 'fbx') {
    const guess = fbxGuess(buf);
    const root = new THREE.FBXLoader(manager).parse(buf, base);
    return settle().then(() => ({ root, clips: root.animations || [], guess }));
  }
  return new Promise((res, rej) => { new THREE.GLTFLoader(manager).parse(buf, base, res, rej); })
    .then(g => settle().then(() => ({ root: g.scene || (g.scenes && g.scenes[0]), clips: g.animations || [], guess: { unit: 100, up: 1, sign: 1, gltf: true } })));
}
// what a model file names (a texture, a buffer), as a file of the scene: the path it gives (beside the model, or from the
// scene's top), else any file of the scene with its base name; never anything outside the scene
function resolveUrl(u, base, dir, missing, texPaths) {
  if (/^(blob|data):/i.test(u)) return u;
  if (SRC.held) { missing.add(baseName(u.split(/[?#]/)[0]) || u); return MISSING; }   // (a relay that refused the password: asked nothing more)
  let rel = (u.startsWith(base) ? u.slice(base.length) : u).split(/[?#]/)[0];
  try { rel = decodeURIComponent(rel); } catch (e) { /* as it is */ }
  rel = rel.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
  let f = /^[a-z][a-z0-9+.-]*:/i.test(rel) || rel.startsWith('/') ? null : STU.fileMap.get(dir + rel) || STU.fileMap.get(rel);
  if (!f) { const b = baseName(rel).toLowerCase(); f = b ? STU.files.find(x => x.kind !== 'model' && baseName(x.path).toLowerCase() === b) : null; }
  if (f) { texPaths.add(f.path); return fileUrl(f.path, true); }
  missing.add(baseName(rel) || rel);
  return MISSING;
}
// An FBX's units and up axis, read from its bytes (the loader ignores them): GlobalSettings' UnitScaleFactor (cm per
// unit) and UpAxis, UpAxisSign. Binary: each is a P record of four strings and a number (the name's length before it
// tells "UnitScaleFactor" from "OriginalUnitScaleFactor"); ASCII: a line P: "UnitScaleFactor", "double", ..., 1
function fbxGuess(buf) {
  const out = { unit: 1, up: 1, sign: 1, gltf: false, read: false };
  const u8 = new Uint8Array(buf), n = Math.min(u8.length, 4 << 20);   // (GlobalSettings comes near the start)
  let s = '';
  for (let i = 0; i < n; i += 65536) s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(n, i + 65536)));
  const dv = new DataView(buf);
  if (s.startsWith('Kaydara FBX Binary')) {
    const prop = name => {
      const L = name.length, pat = 'S' + String.fromCharCode(L & 255, (L >> 8) & 255, 0, 0) + name;
      let i = s.indexOf(pat);
      if (i < 0) return null;
      i += pat.length;
      for (let k = 0; k < 3; k++) { if (u8[i] !== 0x53) return null; i += 5 + dv.getUint32(i + 1, true); }
      const t = String.fromCharCode(u8[i]);
      return t === 'D' ? dv.getFloat64(i + 1, true) : t === 'F' ? dv.getFloat32(i + 1, true) : t === 'I' ? dv.getInt32(i + 1, true)
        : t === 'Y' ? dv.getInt16(i + 1, true) : t === 'L' ? Number(dv.getBigInt64(i + 1, true)) : null;
    };
    const u = prop('UnitScaleFactor'), a = prop('UpAxis'), g = prop('UpAxisSign');
    if (Number.isFinite(u) && u > 0) { out.unit = u; out.read = true; }
    if ([0, 1, 2].includes(a)) out.up = a;
    if (g === -1) out.sign = -1;
  } else {
    const num = name => { const m = new RegExp('P:\\s*"' + name + '"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*"[^"]*"\\s*,\\s*([-+0-9.eE]+)').exec(s); return m ? +m[1] : null; };
    const u = num('UnitScaleFactor'), a = num('UpAxis'), g = num('UpAxisSign');
    if (Number.isFinite(u) && u > 0) { out.unit = u; out.read = true; }
    if ([0, 1, 2].includes(a)) out.up = a;
    if (g === -1) out.sign = -1;
  }
  return out;
}
// a model loaded: textures settled (missing ones dropped, big ones drawn down, each shown as it is), what its card says
// (triangles, textures, clips, its size in its own units), and its starting scale and turn
function finishModel(E, res) {
  const root = res.root;
  if (!root) throw new Error('the file has no scene in it');
  root.updateMatrixWorld(true);
  let tris = 0, rigged = false, normals = true, flat = 0, solid = 0;
  const mats = new Set();
  root.traverse(o => {
    if (o.isSkinnedMesh) rigged = true;
    if (o.isMesh && o.geometry) {
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3;
      if (!g.attributes.normal) normals = false;
      o.frustumCulled = !o.isSkinnedMesh;   // (a skinned mesh's box does not follow its pose)
    }
    for (const m of [].concat(o.material || [])) mats.add(m);
  });
  // a mesh without normals (a photogrammetry scan's): lit, its faces shaded flat (from the pixels' own slopes: nothing
  // more to keep), else the light finds no surface and draws it black; a material that cannot (Lambert's) gets normals
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || o.geometry.attributes.normal) return;
    const ms = [].concat(o.material || []);
    if (ms.length && ms.every(m => m.isMeshPhongMaterial || m.isMeshStandardMaterial || m.isMeshToonMaterial || m.isMeshBasicMaterial)) {
      for (const m of ms) if (!m.isMeshBasicMaterial && !m.flatShading) { m.flatShading = true; m.needsUpdate = true; flat++; }
    } else { o.geometry.computeVertexNormals(); flat++; }
  });
  // an FBX whose material says it is fully see-through with nothing to show where (opacity 0 and no alpha map: a habit
  // of 3ds Max's exports, which r128's loader takes at its word, so the model is not drawn at all): drawn solid
  if (extOf(E.path) === 'fbx') for (const m of mats) if (m.opacity <= 0.01 && !m.alphaMap) { m.opacity = 1; m.transparent = false; m.needsUpdate = true; solid++; }
  const texs = new Map();
  for (const m of mats) {
    for (const k of TEX_KEYS) {
      const t = m[k];
      if (!t || !t.isTexture) continue;
      const img = t.image;
      if (!img || !img.width || (img.width === 3 && img.height === 1 && E.missing.size)) { m[k] = null; m.needsUpdate = true; continue; }
      t.encoding = THREE.LinearEncoding;   // (drawn as the picture is: the renderer's output is linear)
      if (!texs.has(t)) texs.set(t, capTexture(t));
    }
    if (m.isMeshStandardMaterial) m.needsUpdate = true;
  }
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const size = box.getSize(new THREE.Vector3()), tl = [...texs.values()];
  E.root = root; E.clips = res.clips || []; E.rigged = rigged;
  E.info = {
    tris: Math.round(tris), textures: tl, clips: E.clips.map(c => [c.name, c.duration]), materials: mats.size, rigged,
    box: [box.min.toArray(), box.max.toArray()], own: size.toArray(), normals, flat, solid,
    // photogrammetry: a mesh without normals, or one textured material over many triangles; its light is in its texture
    scan: !normals || (mats.size === 1 && tl.length >= 1 && !rigged && tris >= 50000),
  };
  E.guess = guessFor(res.guess, size);
}
// a texture larger than the cap on a side, drawn down to it (keeping its shape) before it reaches the GPU
function capTexture(t) {
  const img = t.image, w = img.width, h = img.height, cap = OPT.maxtex;
  const src = typeof img.src === 'string' && !/^(blob|data):/.test(img.src) ? baseName(img.src.split(/[?#]/)[0]) : '';
  const out = { name: t.name || src || 'inside the file', w, h, to: 0 };
  if (Math.max(w, h) <= cap) return out;
  const k = cap / Math.max(w, h), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const x = cv.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, cw, ch);
  if (typeof img.close === 'function') img.close();   // (an ImageBitmap's memory back at once)
  t.image = cv; t.needsUpdate = true;
  out.to = Math.max(cw, ch);
  return out;
}
// The scale and turn a file starts with (stored in the item from then on: a layout never changes when this guess does).
// FBX: its UnitScaleFactor (cm per unit) gives the scale factor / 100, and Z up a quarter turn about x; a scale is taken
// only when it makes the largest side 5 cm to 60 m, else 1 unit = 1 m when that does, else it is sized to 1 m. glTF is
// metres and Y up
const _ax = new THREE.Vector3(1, 0, 0), _az = new THREE.Vector3(0, 0, 1);
function guessFor(g, size) {
  const q = new THREE.Quaternion();
  if (g.up === 2) q.setFromAxisAngle(_ax, -Math.PI / 2 * g.sign);
  else if (g.up === 0) q.setFromAxisAngle(_az, Math.PI / 2 * g.sign);
  const L = Math.max(size.x, size.y, size.z) || 1, u = g.unit / 100, fits = c => L * c >= 0.05 && L * c <= 60;
  // how: 'unit' (the file's own units taken), 'metres' (they would make it too small or too big: 1 unit = 1 m instead)
  // or 'fit' (neither: sized to 1 m); would: its largest side in the file's own units, in metres (the card says why)
  const how = fits(u) ? 'unit' : fits(1) ? 'metres' : 'fit', s = how === 'unit' ? u : how === 'metres' ? 1 : 1 / L;
  return { s: +s.toPrecision(4), q: q.toArray().map(v => Math.round(v * 1e4) / 1e4), unit: g.unit, up: g.up, sign: g.sign, read: g.read, gltf: !!g.gltf, how, would: +(L * u).toPrecision(3) };
}
// the card's words for that guess: what the file says of its units and up axis, and what was made of it, e.g. "the file
// says centimetres; that would make it 1.7 cm, so taken as metres; stood up from Z up"
const UNIT_WORDS = { 0.1: 'millimetres', 1: 'centimetres', 2.54: 'inches', 30.48: 'feet', 91.44: 'yards', 100: 'metres', 100000: 'kilometres' };
const lenWords = v => (v < 0.01 ? +(v * 1000).toPrecision(2) + ' mm' : v < 1 ? +(v * 100).toPrecision(2) + ' cm' : v < 1000 ? +v.toPrecision(3) + ' m' : +(v / 1000).toPrecision(3) + ' km');
function guessWords(g) {
  if (!g) return '';
  const unit = UNIT_WORDS[g.unit] || `${+(+g.unit).toPrecision(3)} cm a unit`, out = [];
  out.push(g.gltf ? 'glTF is in metres' : g.read ? 'the file says ' + unit : 'the file gives no units: FBX\'s own, centimetres');
  if (g.how === 'metres') out.push(`that would make it ${lenWords(g.would)}, so taken as metres`);
  else if (g.how === 'fit') out.push(`that would make it ${lenWords(g.would)}, so sized to 1 m`);
  if (g.up === 2) out.push(g.sign < 0 ? 'turned over from Z down' : 'stood up from Z up');
  else if (g.up === 0) out.push(g.sign < 0 ? 'turned from X down' : 'turned from X up');
  return out.join('; ');
}
// a clone for one object: its own materials (lit as loaded; as scanned built when asked), its rest pose kept (an
// animation turned off goes back to it)
function libClone(E) {
  const o = E.rigged && THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(E.root) : E.root.clone(true);
  const meshes = [], rest = [], env = envMap();
  o.traverse(n => {
    rest.push([n, n.position.clone(), n.quaternion.clone(), n.scale.clone()]);
    if (!n.material) return;
    const one = m => {
      const c = m.clone();
      if (c.isMeshStandardMaterial && !c.envMap && env) { c.envMap = env; c.envMapIntensity = 0.8; }
      c.userData.base = { t: c.transparent, o: c.opacity, d: c.depthWrite };
      return c;
    };
    n.material = Array.isArray(n.material) ? n.material.map(one) : one(n.material);
    n.userData.lit = n.material;
    meshes.push(n);
  });
  return { o, meshes, rest };
}
// as scanned: unlit, its own colours (photogrammetry, whose light is in its texture)
function scanMat(m) {
  const c = new THREE.MeshBasicMaterial({
    map: m.map || null, color: m.map ? 0xffffff : (m.color || new THREE.Color(1, 1, 1)), vertexColors: !!m.vertexColors, side: m.side,
    transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest || 0, skinning: !!m.skinning, morphTargets: !!m.morphTargets,
  });
  c.userData.base = { t: c.transparent, o: c.opacity, d: c.depthWrite };
  return c;
}
// the card's numbers for an object as placed: its size in metres (its box turned and scaled), its triangles
const _bx = new THREE.Box3(), _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3();
function placedBox(E, q, s, out) {
  _bx.min.fromArray(E.info.box[0]); _bx.max.fromArray(E.info.box[1]);
  _bm.compose(new THREE.Vector3(), _bq.fromArray(q), _bs.set(s, s, s));
  return (out || new THREE.Box3()).copy(_bx).applyMatrix4(_bm);
}

// ================================================================= SOUNDS ==
// A sound file of the scene: fetched once (its bytes kept), decoded on the shell's one context (HOST.audio.fx(); never a
// context of its own) and again on a new one; at most 60 MB of decoded sound in a scene (the rest not loaded, said)
const SND = new Map();   // path -> { state: 'loading'|'bytes'|'decoding'|'ready'|'failed'|'over', bytes, buf, size, err, gen }
const SND_MAX = 60 << 20;
let sndTotal = 0;
function snd(path) {
  let F = SND.get(path);
  if (!F) { F = { path, state: 'idle', bytes: null, buf: null, size: 0, err: '', gen: 0, ctx: null }; SND.set(path, F); }
  if (F.state === 'idle' && STU.fileMap.has(path)) sndFetch(F);
  return F;
}
async function sndFetch(F) {
  const gen = ++F.gen, scene = STU.scene;
  F.state = 'loading'; F.err = '';
  try {
    const b = await getBytes(fileUrl(F.path));
    if (gen !== F.gen || scene !== STU.scene || GL.gone) return;
    F.bytes = b; F.state = 'bytes';
  } catch (e) { if (gen === F.gen) { F.state = 'failed'; F.auth = e.status === 401; F.err = e.status === 404 ? 'The file is not in the scene\'s folder any more.' : e.status === 401 ? AUTH_NOTE : 'It could not be fetched: ' + e.message; } }
  dirty();
}
// decoded for this context (once; again on a new context)
function sndDecode(F, ctx) {
  if (!F.bytes || F.state === 'decoding' || F.state === 'over' || (F.state === 'ready' && F.ctx === ctx)) return;
  const gen = F.gen;
  F.state = 'decoding'; F.ctx = ctx;
  let p;
  try { p = ctx.decodeAudioData(F.bytes.slice(0)); } catch (e) { p = Promise.reject(e); }
  Promise.resolve(p).then(buf => {
    if (gen !== F.gen || F.ctx !== ctx || GL.gone) return;
    const size = buf.length * buf.numberOfChannels * 4;
    if (sndTotal + size > SND_MAX) { F.state = 'over'; F.err = 'Not loaded: the scene\'s sounds would take more than 60 MB once decoded.'; dirty(); return; }
    sndTotal += size; F.size = size; F.buf = buf; F.state = 'ready';
    dirty();
  }, e => { if (gen === F.gen) { F.state = 'failed'; F.err = 'It could not be decoded (' + ((e && e.message) || 'not a sound this browser plays') + ').'; dirty(); } });
}
// a new context (or none): every decoded sound goes, to be decoded again on the new one
function sndForget() { for (const F of SND.values()) { F.buf = null; if (F.state === 'ready' || F.state === 'decoding') F.state = F.bytes ? 'bytes' : 'idle'; F.ctx = null; F.size = 0; } sndTotal = 0; }
function emitChanged(p) {
  const F = SND.get(p);
  if (!F) return;
  for (const it of STU.items.values()) if (it.kind === 's' && it.rec.file === p) emitStop(it, true);
  if (F.size) sndTotal -= F.size;
  SND.delete(p);
}
function sndClear() { SND.clear(); sndTotal = 0; }
