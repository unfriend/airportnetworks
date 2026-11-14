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
// takes uploads, else kept for this page. gen: the scene's opening it was made for (the caller's, else now): another scene
// opened meanwhile, the same one opened again, or the studio gone, and nothing is kept (a picture of another scene's model
// must never go into this one). 'up', 'mem' or '' (none)
async function pvKeep(path, cv, info, gen = STU.gen) {
  const scene = STU.scene, gone = () => gen !== STU.gen || GL.gone || !STU.scene;
  if (gone()) return '';
  if (info) PV.info.set(path, info);
  const blob = cv ? await pvJpeg(cv) : null;
  if (!blob || gone()) return '';
  const rel = pvPath(path);
  if (canUpload() && pvFits(rel)) {
    try {
      const j = await upSend(fileApi(scene, rel, true), blob);
      if (gone()) return '';
      pvPut(rel, blob, j);
      pvDrop(PV.mem, path);
      return 'up';
    } catch (e) { if (gone()) return ''; if (e.status === 401) throw e; /* kept for this page instead */ }
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
// relay takes uploads (shown at once when it is the one open, and was while it went up: a scene opened again meanwhile, or
// the studio gone, reads it from its listing instead, so no picture is kept past pvClear); a failure only said
async function pvSend(scene, path, blob) {
  const rel = pvPath(path), gen = STU.gen;
  if (!pvFits(rel)) return null;
  const j = await upSend(fileApi(scene, rel, true), blob);
  if (scene === STU.scene && gen === STU.gen && !GL.gone) pvPut(rel, blob, j);
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
    try { info = pvInfo(wrap); cv = await pvShotSoon(wrap); } finally { wrap.remove(E.root); E.root.updateMatrixWorld(true); }   // (as it was: on its own)
    return gen === STU.gen ? pvKeep(p, cv, info, gen) : '';
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
    return gen === STU.gen ? pvKeep(p, cv, info, gen) : '';
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

// ---- the Items pane's tiles (the owner, 7 November 2026: "items need a preview in the items list tab, should show the same
// image and look like the add item part"): an object shows its model's picture, as the Add pane does; what has no file is
// drawn here, on the pictures' dark background, in its colour: a shape its kind (cube, sphere, cylinder, plane; one that
// hides things see-through, its edges dashed), a sound a speaker, a trigger cube a see-through cube's edges, an empty an
// axis cross, a cut-out cutting nothing a dashed box. Drawn once a kind and colour, as a canvas the headset draws and the
// page shows as a data URL (so both look the same)
const TILE = new Map(), TILE_PX = 256;
const tileKey = t => t.k + '|' + t.col + '|' + (t.hide ? 1 : 0) + (t.cols ? '|' + t.cols.join(',') : '');
function tileFor(t) {
  const key = tileKey(t);
  let e = TILE.get(key);
  if (e) return e.cv;
  const S = TILE_PX, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d'), c = new THREE.Color(t.col || '#c9d1dc'), rgb = (k, w) => { const m = c.clone().multiplyScalar(k).lerp(new THREE.Color(1, 1, 1), w || 0); return `rgb(${[m.r, m.g, m.b].map(v => Math.round(Math.min(1, v) * 255)).join(',')})`; };
  const gr = x.createRadialGradient(S / 2, S * 0.42, S * 0.05, S / 2, S / 2, S * 0.75);
  gr.addColorStop(0, '#1d2c44'); gr.addColorStop(1, '#070c16');
  x.fillStyle = gr; x.fillRect(0, 0, S, S);
  x.lineJoin = x.lineCap = 'round';
  // a box seen from a little above (its corners -1..1 on each axis), as the pictures see a model
  const iso = (X, Y, Z, s = 46, cy = 130) => [S / 2 + (X - Z) * 0.866 * s, cy + (X + Z) * 0.5 * s - Y * s];
  const poly = (P, fill, stroke, lw, dash) => { x.beginPath(); P.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.setLineDash(dash || []); x.lineWidth = lw || 3; x.strokeStyle = stroke; x.stroke(); x.setLineDash([]); } };
  const line = (a, b, col, lw, dash) => { x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.setLineDash(dash || []); x.lineWidth = lw; x.strokeStyle = col; x.stroke(); x.setLineDash([]); };
  const C = [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]].map(p => iso(...p));
  const E12 = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]], BACK = [[0, 1], [3, 0], [0, 4]];   // (the three edges at the far bottom corner are behind)
  const edges = (col, lw, dashBack, dashAll) => { for (const [a, b] of E12) { const back = BACK.some(([p, q]) => p === a && q === b); line(C[a], C[b], col, lw, dashAll ? [12, 9] : back && dashBack ? [8, 8] : []); } };
  const faces = a => { x.globalAlpha = a; poly([C[4], C[5], C[6], C[7]], rgb(1, 0.25)); poly([C[1], C[2], C[6], C[5]], rgb(0.62)); poly([C[2], C[3], C[7], C[6]], rgb(0.84)); x.globalAlpha = 1; };
  const see = t.hide ? 0.3 : 1, dash = t.hide ? [12, 9] : null;
  if (t.k === 'cube') { faces(see); if (t.hide) edges(rgb(1, 0.45), 3, false, true); else for (const [a, b] of [[4, 5], [5, 6], [6, 7], [7, 4], [1, 5], [2, 6], [3, 7], [1, 2], [2, 3]]) line(C[a], C[b], rgb(1, 0.45), 2.5); }
  else if (t.k === 'sphere') {
    const g = x.createRadialGradient(104, 104, 6, 128, 132, 84);
    g.addColorStop(0, rgb(1, 0.5)); g.addColorStop(0.45, rgb(1)); g.addColorStop(1, rgb(0.32));
    x.globalAlpha = see; x.beginPath(); x.arc(128, 132, 80, 0, 7); x.fillStyle = g; x.fill(); x.globalAlpha = 1;
    if (t.hide) { x.beginPath(); x.arc(128, 132, 80, 0, 7); x.setLineDash(dash); x.lineWidth = 3; x.strokeStyle = rgb(1, 0.45); x.stroke(); x.setLineDash([]); }
  } else if (t.k === 'cylinder') {
    const rx = 56, ry = 19, y0 = 66, y1 = 196, g = x.createLinearGradient(128 - rx, 0, 128 + rx, 0);
    g.addColorStop(0, rgb(0.5)); g.addColorStop(0.38, rgb(1)); g.addColorStop(1, rgb(0.45));
    x.globalAlpha = see;
    x.beginPath(); x.moveTo(128 - rx, y0); x.lineTo(128 - rx, y1); x.ellipse(128, y1, rx, ry, 0, Math.PI, 0, true); x.lineTo(128 + rx, y0); x.closePath(); x.fillStyle = g; x.fill();
    x.beginPath(); x.ellipse(128, y0, rx, ry, 0, 0, 7); x.fillStyle = rgb(1, 0.28); x.fill(); x.globalAlpha = 1;
    if (t.hide) { x.setLineDash(dash); x.lineWidth = 3; x.strokeStyle = rgb(1, 0.45); x.beginPath(); x.ellipse(128, y0, rx, ry, 0, 0, 7); x.stroke(); x.beginPath(); x.moveTo(128 - rx, y0); x.lineTo(128 - rx, y1); x.ellipse(128, y1, rx, ry, 0, Math.PI, 0, true); x.lineTo(128 + rx, y0); x.stroke(); x.setLineDash([]); }
  } else if (t.k === 'plane') {
    const P = [iso(-1.15, -1.15, 0, 50, 130), iso(1.15, -1.15, 0, 50, 130), iso(1.15, 1.15, 0, 50, 130), iso(-1.15, 1.15, 0, 50, 130)], g = x.createLinearGradient(P[0][0], P[3][1], P[2][0], P[1][1]);
    g.addColorStop(0, rgb(1, 0.2)); g.addColorStop(1, rgb(0.6));
    x.globalAlpha = see; poly(P, g); x.globalAlpha = 1;
    poly(P, null, rgb(1, 0.45), 3, dash);
  } else if (t.k === 'sound') {
    // a speaker: its box, its cone and three waves
    x.globalAlpha = 1; poly([[64, 104], [94, 104], [94, 156], [64, 156]], rgb(0.8)); poly([[94, 104], [136, 68], [136, 192], [94, 156]], rgb(1, 0.15));
    x.lineWidth = 10;
    [34, 58, 82].forEach((r, i) => { x.globalAlpha = 1 - i * 0.25; x.beginPath(); x.arc(140, 130, r, -0.75, 0.75); x.strokeStyle = rgb(1, 0.3); x.stroke(); });
    x.globalAlpha = 1;
  } else if (t.k === 'screen') {
    // a screen: a panel on a stand with a play triangle on it (v143)
    poly([[34, 70], [222, 70], [222, 176], [34, 176]], rgb(0.3), rgb(1, 0.3), 5); poly([[44, 80], [212, 80], [212, 166], [44, 166]], rgb(0.18));
    poly([[110, 98], [110, 148], [154, 123]], rgb(1, 0.25)); poly([[104, 176], [152, 176], [152, 200], [104, 200]], rgb(0.5));
    line([84, 204], [170, 204], rgb(0.6), 8);
  } else if (t.k === 'paint') {
    // a painting: three strokes in its colours (a ribbon, a tube and a few spray dots), as the tile of a drawing in the air
    const cs = (t.cols && t.cols.length ? t.cols : [t.col || '#ff8a6b']), col = i => cs[i % cs.length];
    x.lineCap = 'round'; x.setLineDash([]);
    [[56, 150, 108, 70, 150, 190, 200, 120, 22], [50, 190, 100, 150, 160, 120, 206, 170, 14], [60, 110, 110, 150, 170, 70, 200, 100, 8]].forEach((q, i) => {
      x.beginPath(); x.moveTo(q[0], q[1]); x.bezierCurveTo(q[2], q[3], q[4], q[5], q[6], q[7]); x.lineWidth = q[8]; x.strokeStyle = new THREE.Color(col(i)).multiplyScalar(0.9).getStyle(); x.stroke();
    });
    for (let d = 0; d < 26; d++) { const a = d * 2.4, r = 6 + (d * 37 % 31); x.beginPath(); x.arc(176 + Math.cos(a) * r, 196 + Math.sin(a) * r * 0.6, 3.2, 0, 7); x.fillStyle = new THREE.Color(col(3)).getStyle(); x.fill(); }
  } else if (t.k === 'trigger') { faces(0.16); edges(rgb(1, 0.3), 3.5, true); }
  else if (t.k === 'empty') {
    // an axis cross as the empty is drawn while editing: x red, y green, z blue, its ball in its colour
    const o = iso(0, 0, 0, 82, 136), ax = [[iso(1, 0, 0, 82, 136), '#ff5a4b'], [iso(0, 1, 0, 82, 136), '#3ee08f'], [iso(0, 0, 1, 82, 136), '#4f9dff']];
    for (const [p, col] of ax) { line([2 * o[0] - p[0], 2 * o[1] - p[1]], o, col, 5, [6, 9]); line(o, p, col, 8); }
    x.beginPath(); x.arc(o[0], o[1], 15, 0, 7); x.fillStyle = rgb(1, 0.2); x.fill();
  } else {
    // a cut-out cutting nothing: its dashed box and a pair of scissors
    edges(rgb(1, 0.2), 3, false, true);
    x.font = '700 72px B612, "Segoe UI", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = rgb(1, 0.3); x.fillText('✂', 128, 136);
  }
  TILE.set(key, e = { cv, url: '' });
  return cv;
}
// the same tile for the page: a data URL, made once
function tileUrl(t) { tileFor(t); const e = TILE.get(tileKey(t)); if (!e.url) e.url = e.cv.toDataURL('image/png'); return e.url; }
// for tests and the console: which models have a picture and where it is from, and Make pictures
const pvState = () => ({
  listed: [...PV.files.keys()], shown: [...PV.img].filter(([, e]) => e.state === 'ready').map(([k]) => k), failed: [...PV.img].filter(([, e]) => e.state === 'failed').map(([k]) => k),
  mem: [...PV.mem].map(([k, e]) => [k, e.state]), missing: pvMissing(), make: PV.make && { i: PV.make.i, n: PV.make.n, path: PV.make.path, stop: PV.make.stop }, note: PV.note, info: Object.fromEntries(PV.info),
});
