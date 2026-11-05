
// ================================================================= MODELS ==
// One entry per model file of the scene: fetched and parsed once (GLTF/GLB with three.js's GLTFLoader, FBX with its
// FBXLoader), then cloned for every object that places it (SkeletonUtils for a rigged one), each clone with its own
// materials (so each fades on its own) and its own AnimationMixer. Textures a file names but does not hold are looked
// for in the scene's pictures by the ladder (engine/images.js: the path it gives, its file name in any case, the same name
// as another kind of picture, a name of the same words; an FBX's C:\Users\... path is ignored), TIFF, PSD and DDS read
// in the page; one not there leaves the model untextured and its card says so and offers pictures (Textures, below). Textures larger than OPT.maxtex (4,096 px) on a side
// are drawn down before they reach the GPU. A file no object uses any more is dropped and its memory freed.
const LIB = new Map();   // path -> entry
// the converter (engine/convert.js): its loaders read every format here, its guess sets a model's starting scale and
// turn, and its toGLB converts (the exporter is defined only then: exporterLoad, from the vendored GLTFExporter)
const CONV = makeConverter(THREE, { exporter: () => exporterLoad() });
const MODEL_EXT = CONV.MODEL_EXT;
const TEX_KEYS = ['map', 'emissiveMap', 'normalMap', 'bumpMap', 'specularMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'lightMap', 'displacementMap'];
function lib(path) {
  let E = LIB.get(path);
  if (!E) {
    E = { path, state: 'idle', p: 0, root: null, clips: [], info: null, guess: null, users: new Set(), gen: 0, texPaths: new Set(), missing: new Set(), found: new Map(), why: {}, decoded: [], mats: [], err: '', drop: 0, ms: null, auth: false };
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
  if (E.drop) { unlater(E.drop); E.drop = 0; }
  if (E.root) disposeTree(E.root, true);
  E.root = null; E.state = 'idle';
  if (LIB.get(E.path) === E) LIB.delete(E.path);
}
// another scene: every model goes (a file of the same name there is another file; a load still under way here would
// otherwise leave its entry 'loading' for good)
function libClear() { for (const E of [...LIB.values()]) libDrop(E); }
function disposeTree(root, textures) {
  const seen = new Set();
  root.traverse(o => {
    if (o.isSkinnedMesh && o.skeleton && !seen.has(o.skeleton)) { seen.add(o.skeleton); o.skeleton.dispose(); }   // (its bones' texture)
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
    const t1 = performance.now(), missing = new Set(), texPaths = new Set(), found = new Map();
    const res = await parseModel(E, buf, missing, texPaths, found);
    if (gen !== E.gen || scene !== STU.scene || GL.gone) { if (res && res.root) disposeTree(res.root, true); return; }
    const old = E.root;
    E.missing = missing; E.texPaths = texPaths; E.found = found; E.why = res.why || {}; E.decoded = res.decoded || [];
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
  if (/Unknown format/i.test(m)) return 'Not a model the studio can read (GLB, glTF, FBX, OBJ, PLY or STL).';
  if (e && e.status === 404) return 'The file is not in the scene\'s folder any more.';
  if (e && e.status === 401) return AUTH_NOTE;
  return 'It could not be read: ' + m.slice(0, 160);
}
function parseModel(E, buf, missing, texPaths, found) {
  const dir = E.path.includes('/') ? E.path.slice(0, E.path.lastIndexOf('/') + 1) : '', base = sceneUrl(STU.scene) + encPath(dir);
  return CONV.load({ ext: extOf(E.path), data: buf, base, name: stem(E.path), maxTex: OPT.maxtex, url: u => resolveUrl(u, base, dir, texPaths, found) })
    .then(res => { for (const m of res.missing) missing.add(m); return res; });
}
// the scene's pictures (every picture kind the ladder knows, refused ones too: one named exactly is said to be refused)
let picMemo = [null, []];
const scenePictures = () => (picMemo[0] === STU.files ? picMemo[1] : (picMemo = [STU.files, STU.files.filter(f => CONV.IM.isPicture(f.path)).map(f => f.path)])[1]);
// what a model file names (a texture, a buffer), as a file of the scene: a picture by the ladder (CONV.texFind: its path,
// its name in any case, the same name as another kind of picture, a name of the same words; found: name -> { path, how }),
// anything else by the path it gives (beside the model, or from the scene's top), else any file with its base name; never
// anything outside the scene (null: not found, which the converter's loader counts as missing and stands in for)
function resolveUrl(u, base, dir, texPaths, found) {
  if (/^(blob|data):/i.test(u)) return u;
  if (SRC.held) return null;   // (a relay that refused the password: asked nothing more)
  let rel = (u.startsWith(base) ? u.slice(base.length) : u).split(/[?#]/)[0];
  try { rel = decodeURIComponent(rel); } catch (e) { /* as it is */ }
  rel = CONV.IM.psdBack(rel.replace(/\\/g, '/').replace(/^(\.\/)+/, ''));
  if (CONV.IM.isPicture(rel)) {
    const r = CONV.texFind(rel, scenePictures(), { dir });
    if (!r) return null;
    texPaths.add(r.path);
    if (found) found.set(baseName(rel), r);
    return fileUrl(r.path, true);
  }
  let f = /^[a-z][a-z0-9+.-]*:/i.test(rel) || rel.startsWith('/') ? null : STU.fileMap.get(dir + rel) || STU.fileMap.get(rel);
  if (!f) { const b = baseName(rel).toLowerCase(); f = b ? STU.files.find(x => x.kind !== 'model' && baseName(x.path).toLowerCase() === b) : null; }
  if (f) { texPaths.add(f.path); return fileUrl(f.path, true); }
  return null;
}
// An FBX's units and up axis, read from its bytes (the loader ignores them): the converter's (engine/convert.js)
const fbxGuess = buf => CONV.fbxGuess(buf);
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
  // (one picture may be several textures' own, a glTF's base colour and occlusion: drawn down once, and closed only once
  // every texture has its drawn-down copy)
  const texs = new Map(), pics = new Map();
  for (const m of mats) {
    for (const k of TEX_KEYS) {
      const t = m[k];
      if (!t || !t.isTexture) continue;
      const img = t.image;
      if (!img || !img.width || (img.width === 3 && img.height === 1 && E.missing.size)) { m[k] = null; m.needsUpdate = true; continue; }
      t.encoding = THREE.LinearEncoding;   // (drawn as the picture is: the renderer's output is linear)
      if (!texs.has(t)) texs.set(t, capTexture(t, pics));
    }
    if (m.isMeshStandardMaterial) m.needsUpdate = true;
  }
  for (const [img, p] of pics) if (p.cv && typeof img.close === 'function') img.close();   // (an ImageBitmap's memory back at once)
  // (an occlusion picture is read through a second set of texture coordinates: the first, when there is no second)
  root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.uv && !o.geometry.attributes.uv2 && [].concat(o.material || []).some(m => m.aoMap)) o.geometry.setAttribute('uv2', o.geometry.attributes.uv); });
  // the materials as Add a texture names them (CONV.matsOf: name or number, texture coordinates, the slots they fill)
  E.mats = CONV.matsOf(root).map(e => ({ key: e.key, name: e.name, uv: e.uv, slots: e.slots, meshes: [...new Set(e.meshes.map(n => n.name).filter(Boolean))].slice(0, 20) }));
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const size = box.getSize(new THREE.Vector3()), tl = [...texs.values()];
  E.root = root; E.clips = res.clips || []; E.rigged = rigged;
  // a GLB the converter wrote: what it was made from, and the scale and turn baked into it (asset.extras.studio)
  E.record = res.asset ? CONV.glbRecord({ asset: res.asset }) : null;
  if (E.record) GLBREC.set(E.path, { at: (STU.fileMap.get(E.path) || {}).at || 0, rec: E.record });
  E.info = {
    tris: Math.round(tris), textures: tl, clips: E.clips.map(c => [c.name, c.duration]), materials: mats.size, rigged,
    box: [box.min.toArray(), box.max.toArray()], own: size.toArray(), normals, flat, solid,
    // photogrammetry: a mesh without normals, or one textured material over many triangles; its light is in its texture
    scan: !normals || !!(E.record && E.record.scan) || (mats.size === 1 && tl.length >= 1 && !rigged && tris >= 50000),
  };
  E.guess = guessFor(res.guess, size);
}
// a texture larger than the cap on a side, drawn down to it (keeping its shape) before it reaches the GPU
// (pics: the pictures drawn down so far, each once, its canvas for the other textures that show it)
function capTexture(t, pics) {
  const img = t.image, w = img.width, h = img.height, cap = OPT.maxtex, was = pics.get(img);
  if (was) { if (was.cv) { t.image = was.cv; t.needsUpdate = true; } return was.out; }
  const src = typeof img.src === 'string' && !/^(blob|data):/.test(img.src) ? baseName(img.src.split(/[?#]/)[0]) : '';
  const out = { name: t.name || src || 'inside the file', w, h, to: 0 };
  pics.set(img, { cv: null, out });
  if (Math.max(w, h) <= cap) return out;
  const k = cap / Math.max(w, h), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const x = cv.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, cw, ch);
  pics.get(img).cv = cv;
  t.image = cv; t.needsUpdate = true;
  out.to = Math.max(cw, ch);
  return out;
}
// The scale and turn a file starts with (stored in the item from then on: a layout never changes when this guess does):
// the converter's guess (engine/convert.js), the same one a GLB has baked in. FBX: its UnitScaleFactor (cm per unit) and
// Z up; glTF metres and Y up; OBJ, PLY and STL no units (metres, centimetres or millimetres, whichever makes it 5 cm to
// 60 m); a scale that makes it smaller than 5 cm or larger than 60 m refused (1 unit = 1 m, else sized to 1 m)
const _ax = new THREE.Vector3(1, 0, 0), _az = new THREE.Vector3(0, 0, 1);
const guessFor = (g, size) => CONV.guessFor(g, size);
// the card's words for that guess: what the file says of its units and up axis, and what was made of it, e.g. "the file
// says centimetres; that would make it 1.7 cm, so taken as metres; stood up from Z up"
const UNIT_WORDS = { 0.1: 'millimetres', 1: 'centimetres', 2.54: 'inches', 30.48: 'feet', 91.44: 'yards', 100: 'metres', 100000: 'kilometres' };
const lenWords = v => (v < 0.01 ? +(v * 1000).toPrecision(2) + ' mm' : v < 1 ? +(v * 100).toPrecision(2) + ' cm' : v < 1000 ? +v.toPrecision(3) + ' m' : +(v / 1000).toPrecision(3) + ' km');
function guessWords(g) {
  if (!g) return '';
  const unit = UNIT_WORDS[g.unit] || `${+(+g.unit).toPrecision(3)} cm a unit`, out = [];
  if (g.free) out.push('the file gives no units: ' + { metres: 'taken as metres', cm: 'taken as centimetres', mm: 'taken as millimetres', fit: 'sized to 1 m' }[g.how]);
  else {
    out.push(g.gltf ? 'glTF is in metres' : g.read ? 'the file says ' + unit : 'the file gives no units: FBX\'s own, centimetres');
    if (g.how === 'metres') out.push(`that would make it ${lenWords(g.would)}, so taken as metres`);
    else if (g.how === 'fit') out.push(`that would make it ${lenWords(g.would)}, so sized to 1 m`);
  }
  if (g.up === 2) out.push(g.sign < 0 ? 'turned over from Z down' : 'stood up from Z up');
  else if (g.up === 0) out.push(g.sign < 0 ? 'turned from X down' : 'turned from X up');
  else if (g.sign < 0) out.push('turned over from Y down');
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
      c.userData.side0 = c.side;   // (its side as in the file: an object's Faces, applyFaces, may change it)
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
  const side = m.userData.side0 !== undefined ? m.userData.side0 : m.side;   // (as in the file, whatever its Faces made the lit one)
  const c = new THREE.MeshBasicMaterial({
    map: m.map || null, color: m.map ? 0xffffff : (m.color || new THREE.Color(1, 1, 1)), vertexColors: !!m.vertexColors, side,
    transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest || 0, skinning: !!m.skinning, morphTargets: !!m.morphTargets,
  });
  c.userData.base = { t: c.transparent, o: c.opacity, d: c.depthWrite };
  c.userData.side0 = side;
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
// A sound file of the scene. Its length is read first from an <audio> element's metadata (nothing decoded): one longer
// than 20 s is streamed (an <audio> element per emitter through the shell's context, e6_items.js: the owner's 4-minute
// stereo MP3 would take about 98 MB decoded); a shorter one is fetched once (its bytes kept) and decoded on the shell's
// one context (HOST.audio.fx(); never a context of its own), again on a new one, so it loops without a gap. At most 60 MB
// of decoded sound in a scene (the rest not loaded, said); streamed ones do not count
const SND = new Map();   // path -> { state: 'probing'|'loading'|'bytes'|'decoding'|'ready'|'stream'|'failed'|'over', bytes, buf, size, dur, err, gen }
const SND_MAX = 60 << 20, STREAM_S = 20;
let sndTotal = 0;
function snd(path) {
  let F = SND.get(path);
  if (!F) { F = { path, state: 'idle', bytes: null, buf: null, size: 0, dur: 0, stream: false, err: '', gen: 0, ctx: null }; SND.set(path, F); }
  if (F.state === 'idle' && STU.fileMap.has(path)) sndProbe(F);
  return F;
}
// how long it is, from an <audio> element's metadata (the relay's password as ?token=, the only way an element can carry
// it); an element that cannot tell (a format it does not play, a refusal) leaves it to the fetch and the decoder
function sndProbe(F) {
  const gen = ++F.gen, scene = STU.scene;
  F.state = 'probing'; F.err = '';
  if (SRC.held || typeof Audio === 'undefined') { sndFetch(F); return; }
  const el = new Audio();
  let done = false;
  const end = dur => {
    if (done) return;
    done = true; unlater(t);
    el.removeAttribute('src'); try { el.load(); } catch (e) { /* gone */ }
    if (gen !== F.gen || scene !== STU.scene || GL.gone) return;
    if (dur > STREAM_S && isFinite(dur)) { F.state = 'stream'; F.stream = true; F.dur = dur; dirty(); } else sndFetch(F);
  };
  const t = later(() => end(0), 10000);
  el.preload = 'metadata'; el.crossOrigin = 'anonymous';
  el.addEventListener('loadedmetadata', () => end(el.duration));
  el.addEventListener('error', () => end(0));
  el.src = fileUrl(F.path, true);
}
async function sndFetch(F) {
  const gen = ++F.gen, scene = STU.scene;
  F.state = 'loading'; F.err = ''; F.stream = false;
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
    if (gen !== F.gen || F.ctx !== ctx || GL.gone || SND.get(F.path) !== F) return;   // (another scene, or the file changed)
    const size = buf.length * buf.numberOfChannels * 4;
    if (sndTotal + size > SND_MAX) { F.state = 'over'; F.err = 'Not loaded: the scene\'s sounds would take more than 60 MB once decoded.'; dirty(); return; }
    sndTotal += size; F.size = size; F.buf = buf; F.dur = buf.duration; F.state = 'ready';
    dirty();
  }, e => { if (gen === F.gen) { F.state = 'failed'; F.err = 'It could not be decoded (' + ((e && e.message) || 'not a sound this browser plays') + ').'; dirty(); } });
}
// a new context (or none): every decoded sound goes, to be decoded again on the new one
function sndForget() { for (const F of SND.values()) { if (F.stream) continue; F.buf = null; if (F.state === 'ready' || F.state === 'decoding') F.state = F.bytes ? 'bytes' : 'idle'; F.ctx = null; F.size = 0; } sndTotal = 0; }
function emitChanged(p) {
  const F = SND.get(p);
  if (!F) return;
  for (const it of STU.items.values()) if (it.kind === 's' && it.rec.file === p) emitStop(it, true);
  if (F.size) sndTotal -= F.size;
  SND.delete(p);
}
function sndClear() { SND.clear(); sndTotal = 0; }
