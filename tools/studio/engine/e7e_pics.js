// =============================================================== PICTURES ==
// The Add pane's pictures of the scene's models (tools/studio/SPEC.md, "Pictures in the Add pane"; the owner, 6 November
// 2026: "Models in add dialogue should have preview images and show in a grid", "add pane with pictures sounds good,
// leave 3d models for now"). A picture is a 256 x 256 JPEG of a model, lit and seen from a little above, on a dark
// background, kept in the scene as previews/<the model's path>.jpg (eva.glb's: previews/models/eva.glb.jpg; the relay's
// rule, relay/scenes.mjs: only such pictures there, at most 200 KB, listed with a kind of their own, 'preview', so they are
// never taken for textures). It is made whenever the studio writes a GLB, of the GLB as loaded back (Convert to GLB,
// Convert every model, Fewer triangles' and Change texture's Save and the texture buttons, all through convertFile; and
// the Upload pane's rows), and by Make pictures for the models that have none (each loaded as the converter loads it,
// freed after; one the scene has loaded already drawn from that). With a relay that takes uploads it goes into the scene
// as every file does (straight into R2 when it can, else through the relay); without, it is kept for this page only.
// Pictures are fetched as the scene's other files are (the password as a header, or R2's signed link), a few at a time,
// as the page shows them; a headset fetches only those it draws. Nothing of them is in the layout or the room's state.
const PV = { files: new Map(), img: new Map(), mem: new Map(), info: new Map(), rev: 0, q: [], busy: 0, make: null, note: '', noteC: 'muted', jobs: [] };
// files: preview path -> its listing entry; img: preview path -> { at, state, url, img } (fetched); mem: model path -> the
// same, made on this page and not uploaded; info: model path -> { size, n } learnt by making its picture here
const PV_PX = 256, PV_MAX = 190 << 10, PV_DIR = 'previews/';
const pvPath = p => PV_DIR + p + '.jpg';
const isPv = p => typeof p === 'string' && p.startsWith(PV_DIR) && p.endsWith('.jpg') && p.length > PV_DIR.length + 4;
// a picture's path the relay takes (its upload rule: at most 200 characters, 4 folders deep, no name a common file system
// cannot keep): a model whose picture could not go there has one for this page only
const pvFits = rel => rel.length <= 200 && rel.split('/').length <= 5 && rel.split('/').every(s => s && !/^\./.test(s) && !/[\0-\x1f\x7f\\:*?"<>|]/.test(s) && !/[ .]$/.test(s.replace(/\.jpg$/, 'x')));

// ---- the listing: its pictures said apart (setFiles), those whose file changed or went fetched again or forgotten
function pvListing(list) {
  PV.files = new Map(list.map(f => [f.path, f]));
  for (const [rel, e] of [...PV.img]) { const f = PV.files.get(rel); if (!f || f.at !== e.at) pvDrop(PV.img, rel); }
  PV.rev++;
}
function pvDrop(map, k) { const e = map.get(k); if (e && e.url) URL.revokeObjectURL(e.url); map.delete(k); }
// another scene, or the studio going: every picture and every fetch forgotten, Make pictures stopped
function pvClear() {
  for (const m of [PV.img, PV.mem]) for (const k of [...m.keys()]) pvDrop(m, k);
  PV.files = new Map(); PV.info.clear(); PV.q = [];
  if (PV.make) PV.make.stop = true;
  PV.note = ''; PV.rev++;
}

// ---- showing: the picture of a model (its own, made here or listed), or null while there is none (yet). A listed one
// not fetched yet is fetched (load false: only looked at)
function pvFor(p, load = true) {
  const m = PV.mem.get(p);
  if (m) return m.state === 'ready' ? m : null;
  const f = PV.files.get(pvPath(p));
  if (!f) return null;
  const e = PV.img.get(f.path);
  if (e && e.at === f.at) return e.state === 'ready' ? e : null;
  if (load && !SRC.held) pvLoad(f);
  return null;
}
// the first of several that has one (an original a GLB stands for shows the GLB's, else its own)
function pvAny(list, load = true) { for (const p of list) { const r = pvFor(p, load); if (r) return r; } return null; }
// a model has a picture (one listed that could not be read counts as none: Make pictures makes it again)
const pvHas = p => PV.mem.has(p) || (PV.files.has(pvPath(p)) && (PV.img.get(pvPath(p)) || {}).state !== 'failed');
// a listed picture's address: its signed link (R2), else the scene's file (call adds the password as a header)
const pvUrl = f => f.url || sceneUrl(STU.scene) + encPath(f.path) + (f.at ? '?v=' + f.at : '');
function pvLoad(f) {
  const old = PV.img.get(f.path);
  if (old && old.at === f.at) return;
  if (old) pvDrop(PV.img, f.path);
  PV.img.set(f.path, { at: f.at, state: 'queued', url: '', img: null });
  PV.q.push(f);
  pvPump();
}
// (three fetches at a time: a scene of fifty models asks for its pictures without crowding out its models)
function pvPump() {
  while (PV.busy < 3 && PV.q.length) {
    const f = PV.q.shift(), e = PV.img.get(f.path), gen = STU.gen;
    if (!e || e.at !== f.at || e.state !== 'queued') continue;
    PV.busy++; e.state = 'loading';
    call(pvUrl(f), { cache: 'no-cache' }).then(r => r.blob()).then(b => { if (gen === STU.gen && PV.img.get(f.path) === e) pvImage(e, b, () => PV.img.get(f.path) === e); })
      .catch(() => { if (PV.img.get(f.path) === e) { e.state = 'failed'; PV.rev++; dirty(); } })
      .finally(() => { PV.busy--; pvPump(); });
  }
}
// a JPEG's bytes as a picture to draw (an <img> for the page's grid and the headset's canvas alike)
function pvImage(e, blob, still) {
  e.url = URL.createObjectURL(blob);
  const im = new Image();
  im.onload = () => { if (!still()) return; e.state = 'ready'; e.img = im; PV.rev++; dirty(); };
  im.onerror = () => { if (!still()) return; e.state = 'failed'; PV.rev++; dirty(); };
  im.src = e.url;
}

// ---- making: a picture of a model, drawn by the page's renderer into a target of its own (the scene's frame untouched):
// lit as the studio lights a scene (a sky and ground light, a light over your shoulder, a cool rim, the soft room for
// glTF's metal and gloss), its colour pictures drawn as they are (the studio's look: its output is linear), seen from a
// little above and in front, framed on its box, drawn at twice the size and made smaller (smooth edges), over a dark
// background where nothing of it is
function pvShot(root) {
  const R = GL.renderer, S = PV_PX * 2, sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
  sc.add(new THREE.HemisphereLight(0xe8eeff, 0x2a2f3a, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(1.5, 3, 2.2); sc.add(sun);
  const rim = new THREE.DirectionalLight(0x9fc8ff, 0.35); rim.position.set(-2, 1.5, -2.5); sc.add(rim);
  const env = envMap();
  if (env) sc.environment = env;
  const parent = root.parent, saved = [];
  sc.add(root); root.updateMatrixWorld(true);
  root.traverse(n => { for (const m of [].concat(n.material || [])) for (const k of ['map', 'emissiveMap']) { const t = m[k]; if (t && t.isTexture && t.encoding !== THREE.LinearEncoding) { saved.push([t, t.encoding, m]); t.encoding = THREE.LinearEncoding; m.needsUpdate = true; } } });
  // framed: the camera far enough along its view that every corner of the box is inside the picture, with a margin
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const c = box.getCenter(new THREE.Vector3()), d = new THREE.Vector3(0.75, 0.5, 1).normalize(), up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, d).normalize(), u = new THREE.Vector3().crossVectors(d, right), th = Math.tan((cam.fov / 2) * D2R);
  let D = 0, zmax = -Infinity, zmin = Infinity;
  for (let i = 0; i < 8; i++) {
    const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c), z = v.dot(d);
    D = Math.max(D, z + Math.max(Math.abs(v.dot(right)), Math.abs(v.dot(u))) / th);
    zmax = Math.max(zmax, z); zmin = Math.min(zmin, z);
  }
  D = Math.max(1e-3, D * 1.08);
  cam.position.copy(c).addScaledVector(d, D); cam.up.copy(up); cam.lookAt(c);
  cam.near = Math.max(D * 1e-4, (D - zmax) * 0.5); cam.far = (D - zmin) * 2 + 1e-3; cam.updateProjectionMatrix();
  const rt = new THREE.WebGLRenderTarget(S, S), px = new Uint8Array(S * S * 4);
  const was = R.getRenderTarget(), xr = R.xr.enabled, cc = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha();
  try {
    R.xr.enabled = false; R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(sc, cam);
    R.readRenderTargetPixels(rt, 0, 0, S, S, px);
  } finally {
    R.setRenderTarget(was); R.xr.enabled = xr; R.setClearColor(cc, ca);
    sc.remove(root); if (parent) parent.add(root);
    for (const [t, e, m] of saved) { t.encoding = e; m.needsUpdate = true; }
    rt.dispose();
  }
  // the background: a dark, slightly lighter middle; the target's colours lie over it (cleared to nothing, so its colours
  // are already weighed by how much of a pixel the model covers)
  const big = document.createElement('canvas');
  big.width = big.height = S;
  const bx = big.getContext('2d'), gr = bx.createRadialGradient(S / 2, S * 0.42, S * 0.05, S / 2, S / 2, S * 0.75);
  gr.addColorStop(0, '#1d2c44'); gr.addColorStop(1, '#070c16');
  bx.fillStyle = gr; bx.fillRect(0, 0, S, S);
  const im = bx.getImageData(0, 0, S, S), o = im.data;
  for (let y = 0; y < S; y++) {
    const src = (S - 1 - y) * S * 4, dst = y * S * 4;   // (a target is read bottom up)
    for (let x = 0; x < S * 4; x += 4) {
      const a = px[src + x + 3] / 255, k = 1 - a;
      o[dst + x] = Math.min(255, px[src + x] + o[dst + x] * k); o[dst + x + 1] = Math.min(255, px[src + x + 1] + o[dst + x + 1] * k); o[dst + x + 2] = Math.min(255, px[src + x + 2] + o[dst + x + 2] * k);
    }
  }
  bx.putImageData(im, 0, 0);
  const cv = document.createElement('canvas');
  cv.width = cv.height = PV_PX;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  cx.drawImage(big, 0, 0, PV_PX, PV_PX);
  return cv;
}
// in a headset session the picture is drawn at the start of the next frame (inside the session's own frame callback, where
// the renderer's own target may be bound again), else at once; null if no frame comes within 5 s (the session hidden)
function pvShotSoon(root) {
  if (!(XR.on && GL.renderer.xr.isPresenting)) return Promise.resolve(pvShot(root));
  return new Promise(res => {
    let done = false;
    const job = () => { if (done) return; done = true; try { res(pvShot(root)); } catch (e) { res(null); } };
    PV.jobs.push(job);
    later(() => { if (!done) { done = true; PV.jobs = PV.jobs.filter(j => j !== job); res(null); } }, 5000);
  });
}
function pvJobs() { const L = PV.jobs; PV.jobs = []; for (const j of L) j(); }
// a picture as a JPEG of at most PV_MAX (a little under the relay's 200 KB)
const pvJpeg = cv => new Promise(res => { const go = q => cv.toBlob(b => (b && b.size > PV_MAX && q > 0.4 ? go(q - 0.2) : res(b)), 'image/jpeg', q); go(0.86); });
// a model's size (metres, as placed from the file: its guess applied) and triangles, from what is loaded
function pvInfo(root) {
  let n = 0;
  root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  const b = new THREE.Box3().setFromObject(root);
  return { size: b.isEmpty() ? null : b.getSize(new THREE.Vector3()).toArray().map(r3), n: Math.round(n) };
}
// a picture made for a model of the scene (path): into the scene (previews/<path>.jpg, replacing one there) when the relay
// takes uploads, else kept for this page. 'up', 'mem' or '' (none)
async function pvKeep(path, cv, info) {
  if (info) PV.info.set(path, info);
  const blob = cv ? await pvJpeg(cv) : null;
  if (!blob) return '';
  const rel = pvPath(path), scene = STU.scene, gen = STU.gen;
  if (canUpload() && pvFits(rel)) {
    try {
      const j = await upSend(fileApi(scene, rel, true), blob);
      if (gen !== STU.gen) return '';
      pvPut(rel, blob, j);
      pvDrop(PV.mem, path);
      return 'up';
    } catch (e) { if (gen !== STU.gen) return ''; if (e.status === 401) throw e; /* kept for this page instead */ }
  }
  pvDrop(PV.mem, path);
  const m = { at: 0, state: 'loading', url: '', img: null };
  PV.mem.set(path, m);
  pvImage(m, blob, () => PV.mem.get(path) === m);
  PV.rev++;
  return 'mem';
}
// a picture just uploaded, shown at once (its listing entry as the relay answered, until the listing is read again)
function pvPut(rel, blob, j) {
  const at = (j && +j.at) || Date.now(), f = { path: rel, bytes: (j && +j.bytes) || blob.size, at, kind: 'preview' };
  PV.files.set(rel, f);
  pvDrop(PV.img, rel);
  const e = { at, state: 'loading', url: '', img: null };
  PV.img.set(rel, e);
  pvImage(e, blob, () => PV.img.get(rel) === e);
  PV.rev++;
}
// the picture of a GLB just made, for a scene that may not be the one open (the Upload pane's): into that scene when the
// relay takes uploads (shown at once when it is the one open); a failure only said
async function pvSend(scene, path, blob) {
  const rel = pvPath(path);
  if (!pvFits(rel)) return null;
  const j = await upSend(fileApi(scene, rel, true), blob);
  if (scene === STU.scene) pvPut(rel, blob, j);
  return j;
}

// ---- Make pictures (the Add pane, a page with editing on): every model the pane shows without a picture, one after
// another (a model the scene has loaded drawn from that; any other fetched and loaded as the converter loads it, its
// textures at most 1,024 px, and freed after), each uploaded as it is made (or kept for this page); a stop between two
const PV_TEX = 1024;
function pvMissing() {
  if (STU.listing !== 'ok') return [];
  const L = sceneLists(), out = [];
  for (const f of L.models) if (!pvHas(f.path)) out.push(f.path);
  for (const f of L.orig) if (f.kind === 'model' && !L.stands.has(f.path) && !pvHas(f.path)) out.push(f.path);
  return out;
}
async function pvMakeAll() {
  if (PV.make || !editOn() || XR.on || OPT.visit) return;
  const list = pvMissing(), gen = STU.gen;
  if (!list.length) return;
  const M = PV.make = { i: 0, n: list.length, path: '', stop: false, made: 0, up: 0, failed: [] };
  PV.note = ''; dirty(true);
  try {
    for (const p of list) {
      if (M.stop || gen !== STU.gen || GL.gone || !editOn()) break;
      M.i++; M.path = p; dirty(true);
      try { const how = await pvMakeOne(p, gen); if (how) { M.made++; if (how === 'up') M.up++; } }
      catch (e) { M.failed.push(`${baseName(p)}: ${e.status === 401 ? AUTH_NOTE : e.message}`); if (e.status === 401) break; }
      await new Promise(r => later(r, 30));
    }
  } finally {
    PV.make = null;
    if (gen === STU.gen && !GL.gone) {
      const n = M.made, all = M.n;
      PV.note = (M.stop && M.i < all ? `Stopped: ${n} of ${all} pictures made` : `${n} of ${all} picture${all === 1 ? '' : 's'} made`) +
        (n ? (M.up === n ? ', kept in the scene.' : M.up ? `, ${M.up} kept in the scene, the rest for this page only.` : ', for this page only.') : '.') + (M.failed.length ? ' Not made: ' + M.failed.join('; ') : '');
      PV.noteC = M.failed.length ? 'amber' : 'green';
    }
    dirty(true);
  }
}
async function pvMakeOne(p, gen) {
  const E = LIB.get(p);
  if (E && E.state === 'ready' && E.root && E.guess && !E.root.parent) {
    const wrap = new THREE.Group();
    wrap.quaternion.fromArray(E.guess.q); wrap.scale.setScalar(E.guess.s); wrap.add(E.root);
    let cv = null, info = null;
    try { info = pvInfo(wrap); cv = await pvShotSoon(wrap); } finally { wrap.remove(E.root); }
    return gen === STU.gen ? pvKeep(p, cv, info) : '';
  }
  const buf = await getBytes(fileUrl(p));
  if (gen !== STU.gen || GL.gone) return '';
  await new Promise(r => later(r, 30));
  const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '', base = sceneUrl(STU.scene) + encPath(dir);
  const m = await CONV.load({ ext: extOf(p), data: buf, base, name: stem(p), maxTex: PV_TEX, url: u => resolveUrl(u, base, dir, new Set(), null) });
  try {
    if (gen !== STU.gen || GL.gone) return '';
    const size = new THREE.Box3().setFromObject(m.root).getSize(new THREE.Vector3()), g = CONV.guessFor(m.guess, size), wrap = new THREE.Group();
    wrap.quaternion.fromArray(g.q); wrap.scale.setScalar(g.s); wrap.add(m.root);
    const info = pvInfo(wrap), cv = await pvShotSoon(wrap);
    return gen === STU.gen ? pvKeep(p, cv, info) : '';
  } finally { CONV.disposeTree(m.root); }
}
const PV_ACT = {
  pics: () => pvMakeAll(),
  picstop: () => { if (PV.make) PV.make.stop = true; },
};

// ---- the Add pane's cards: a model's picture (its own, or the GLB's that stands for it), its name, its size in metres
// and triangles where they are known (the scene's model loaded here, a GLB's record, a picture made here), else its bytes
function modelWords(f) {
  const E = LIB.get(f.path), r = extOf(f.path) === 'glb' ? glbRec(f.path) : null, i = PV.info.get(f.path);
  let size = null, n = null;
  if (E && E.info && E.guess) { size = placedBox(E, E.guess.q, E.guess.s).getSize(new THREE.Vector3()).toArray(); n = E.info.tris; }
  else if (r && r.size) { size = r.size; n = r.n; }
  else if (i) { size = i.size; n = i.n; }
  const w = [size && Math.max(...size) > 0 ? metres(Math.max(...size)) : '', Number.isFinite(n) ? `${fmt(n)} triangles` : ''].filter(Boolean);
  return w.length ? w.join(' · ') : mb(f.bytes);
}
// for tests and the console: which models have a picture and where it is from, and Make pictures
const pvState = () => ({
  listed: [...PV.files.keys()], shown: [...PV.img].filter(([, e]) => e.state === 'ready').map(([k]) => k), failed: [...PV.img].filter(([, e]) => e.state === 'failed').map(([k]) => k),
  mem: [...PV.mem].map(([k, e]) => [k, e.state]), missing: pvMissing(), make: PV.make && { i: PV.make.i, n: PV.make.n, path: PV.make.path, stop: PV.make.stop }, note: PV.note, info: Object.fromEntries(PV.info),
});
