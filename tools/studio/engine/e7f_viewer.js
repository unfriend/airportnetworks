// ============================================================ THE VIEWER ==
// A model looked at closely, over the whole window (v125; the owner, 8 November 2026: "Studio uploader needs better
// preview, also for the reductions, can use the whole viewport, show the model and be able to spin it etc";
// tools/studio/SPEC.md, "The viewer"). Pages only, never in a headset. Opened by an Upload row's Preview, by Look closer on
// a placed model's Fewer triangles card and by an Add card's Look. It is the studio's own renderer and canvas, raised over
// the page while it is open (never a second renderer), drawing a scene of its own instead of the studio's: the studio's
// frame goes on (its items, sounds, the shared room). The model lit as the studio lights it, or as scanned, on an orbit
// camera (drag to spin, the wheel or a pinch to zoom, a right drag or two fingers to pan, a double click to frame it
// again; it turns by itself until touched), framed on its box over a floor grid, its size said. For a model being made
// lighter: All triangles, Lighter or Side by side, the share kept on a slider (the lighter one made again as it is let
// go), both counts, the lighter one's pictures filled as Save fills them (v120); Wireframe and Textures on or off. Close
// or Esc: the studio as it was (the share chosen goes back to the row or the card). Nothing goes into the layout or the
// room
const VW = {
  open: false, src: null, gen: 0, rgen: 0, dom: null, scene: null, cam: null, wrap: null, root: null, own: false, title: '', size: null,
  meshes: [], mats: [], lite: false, mode: 'all', keep: 0.2, k: 1, n0: 0, cur: 0, n1: 0, geos: null, fmap: null, fill: null, notes: [],
  wire: false, tex: true, light: 'lit', busy: '', note: '', noteC: 'muted', az: 35, el: 18, dist: 3, tgt: new THREE.Vector3(), R: 1, spin: true,
  grid: null, wireMat: null, z0: '', focus: null, pts: new Map(), pinch: 0, mid: null, keyFn: null, drew: 0,
};
const VW_SPIN = 12;   // (degrees a second while it turns by itself)
const vwTris = root => { let n = 0; root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return Math.round(n); };
// what Look offers: only a page, never a headset or while one presents
const canView = () => !XR.on && !(GL.renderer && GL.renderer.xr.isPresenting) && !GL.gone;

// ---- opening: the overlay at once (its note says it reads the model), then the model
async function vwOpen(src) {
  if (!canView() || !src) return;
  if (VW.open) vwClose();
  const gen = ++VW.gen;
  Object.assign(VW, { open: true, src, mode: 'all', wire: false, tex: true, light: 'lit', spin: true, busy: 'load', note: 'Reading the model...', noteC: 'muted', lite: false, k: 1, n0: 0, cur: 0, n1: 0,
    geos: null, fmap: null, fill: null, notes: [], title: '', size: null, root: null, meshes: [], mats: [], drew: 0 });
  vwBuild();
  let got = null;
  try {
    got = await vwLoad(src);
    if (gen !== VW.gen || !VW.open || GL.gone) { vwFreeGot(got); return; }
    vwTake(got);
    VW.busy = ''; VW.note = '';
    if (VW.lite) { vwFillStart(gen); vwReduce(); }
  } catch (e) {
    if (gen === VW.gen && VW.open) { VW.busy = ''; VW.note = 'The model could not be read: ' + ((e && e.message) || e); VW.noteC = 'red'; }
    vwFreeGot(got);
  }
  vwUi();
}
// what a source gives: { root, own (the viewer's to free), title, q, s (its turn and scale: how it stands), light, rec (a
// placed object's record: its faces, tint and brightness), lite (a model being made lighter), keep, n0 (the triangles the
// share is of), cur (those of the model shown) }
async function vwLoad(src) {
  if (src.kind === 'up') {
    const r = UP.rows[src.ri];
    if (!r || r.kind !== 'model') throw new Error('that row is not a model');
    let m = null;
    try { m = (await upLoad(r)).m; } finally { r.main.buf = null; }   // (its bytes freed: loaded again when converted)
    const size = new THREE.Box3().setFromObject(m.root).getSize(new THREE.Vector3()), g = CONV.guessFor(m.guess, size), n = vwTris(m.root);
    r.tris = r.tris || n;
    return { root: m.root, own: true, fbx: r.main.ext === 'fbx', title: r.main.name, q: g.q, s: g.s, light: vwNormals(m.root) ? 'lit' : 'scan', lite: true, keep: r.keep === undefined ? FT_DEFAULT : r.keep, n0: n, cur: n };
  }
  if (src.kind === 'ft') {
    const it = STU.items.get(src.id);
    if (!it || it.kind !== 'o' || !it.E || !it.E.root) throw new Error('its model is not here');
    const b = liteSrc(it);
    return { root: vwClone(it.E), own: false, title: it.rec.name, q: it.rec.q, s: it.rec.s, light: it.rec.light, rec: it.rec, lite: true, keep: FT.id === it.id ? FT.keep : FT_DEFAULT, n0: b.n0, cur: b.cur };
  }
  // an Add card: what a press would place (the GLB that stands for an original, else the file); the scene's model when it
  // is loaded here, else fetched and loaded as the converter loads it (its pictures at the studio's limit)
  const p = glbFor().get(src.path) || src.path, E = LIB.get(p);
  if (E && E.state === 'ready' && E.root && E.guess) return { root: vwClone(E), own: false, title: baseName(p), q: E.guess.q, s: E.guess.s, light: E.info && E.info.scan ? 'scan' : 'lit', lite: false };
  const buf = await getBytes(fileUrl(p));
  const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '', base = sceneUrl(STU.scene) + encPath(dir);
  const m = await CONV.load({ ext: extOf(p), data: buf, base, name: stem(p), maxTex: maxTexNow(), url: u => resolveUrl(u, base, dir, new Set(), null) });
  const size = new THREE.Box3().setFromObject(m.root).getSize(new THREE.Vector3()), g = CONV.guessFor(m.guess, size);
  return { root: m.root, own: true, fbx: extOf(p) === 'fbx', title: baseName(p), q: g.q, s: g.s, light: vwNormals(m.root) ? 'lit' : 'scan', lite: false };
}
const vwNormals = root => { let ok = true; root.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.attributes.normal) ok = false; }); return ok; };
// a placed model's copy for the viewer: its own materials (the file's, cloned: what the viewer changes on them changes
// nothing else), its geometries and pictures the file's (never freed here)
function vwClone(E) {
  const o = E.rigged && THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(E.root) : E.root.clone(true);
  o.traverse(n => { if (n.material) n.material = Array.isArray(n.material) ? n.material.map(m => m.clone()) : n.material.clone(); });
  return o;
}
function vwFreeGot(got) {
  if (!got || !got.root) return;
  if (got.own) CONV.disposeTree(got.root);
  else got.root.traverse(n => { for (const m of [].concat(n.material || [])) m.dispose(); });
}
// the model in the viewer's scene, stood as it stands (its turn and scale), its materials recorded (each one's pictures, to
// put back), a copy as scanned of each, framed with a grid under it
function vwTake(got) {
  VW.root = got.root; VW.own = got.own; VW.title = got.title; VW.light = got.light === 'scan' ? 'scan' : 'lit';
  // (a model the viewer read itself is drawn as the studio draws the scene's: its pictures as they are, the renderer's output
  // being linear, and an FBX's material of opacity 0 with no alpha map, 3ds Max's habit, solid; finishModel's, e5_models.js)
  if (got.own) got.root.traverse(n => {
    for (const m of [].concat(n.material || [])) {
      for (const k of TEX_KEYS) if (m[k] && m[k].isTexture && m[k].encoding !== THREE.LinearEncoding) { m[k].encoding = THREE.LinearEncoding; m.needsUpdate = true; }
      if (got.fbx && m.opacity <= 0.01 && !m.alphaMap) { m.opacity = 1; m.transparent = false; m.needsUpdate = true; }
    }
  });
  VW.lite = !!got.lite; VW.keep = got.keep || FT_DEFAULT; VW.n0 = got.n0 || 0; VW.cur = got.cur || vwTris(got.root); VW.n1 = VW.cur;
  VW.wrap.quaternion.fromArray(got.q || [0, 0, 0, 1]); VW.wrap.scale.setScalar(got.s || 1); VW.wrap.add(got.root);
  const seen = new Map(), rec = mat => { if (!seen.has(mat)) { const maps = {}; for (const k of TEX_KEYS) if (mat[k] && mat[k].isTexture) maps[k] = mat[k]; seen.set(mat, { mat, maps }); } };
  got.root.traverse(n => {
    if (!n.isMesh || !n.material) return;
    n.frustumCulled = false;   // (a skinned mesh's box does not follow its pose; a small scene draws it all anyway)
    const lit = n.material, scan = Array.isArray(lit) ? lit.map(scanMat) : scanMat(lit);
    for (const m of [].concat(lit, scan)) {
      rec(m);
      if (got.rec) {   // (a placed object: its faces, tint and brightness, as it is drawn in the scene)
        const f = FACES[got.rec.faces];
        if (f !== undefined && m.side !== f) { m.side = f; m.needsUpdate = true; }
        tintMat(m, got.rec);
      }
    }
    VW.meshes.push({ m: n, g0: n.geometry, lit, scan });
  });
  VW.mats = [...seen.values()];
  VW.root.updateMatrixWorld(true);
  vwFrame(true);
}

// ---- the lighter one: made from the model as it was read (its own geometries put back first), at the share kept (a
// placed model's share is of the original it was made from, as Fewer triangles' is: k of the model shown)
async function vwReduce() {
  if (!VW.root || !VW.lite) return;
  const gen = ++VW.rgen, keep = VW.keep, k = VW.n0 ? Math.min(1, Math.round(VW.n0 * keep) / Math.max(1, VW.cur)) : keep;
  VW.busy = 'lite'; VW.k = k; vwUi();
  vwApply(false);
  await new Promise(r => later(r, 30));   // (the note shows before the work holds the page)
  if (gen !== VW.rgen || !VW.open) return;
  try {
    if (k >= 0.995) { vwGeosFree(); VW.n1 = VW.cur; VW.notes = []; }
    else {
      const r = await CONV.reduce(VW.root, k);
      if (gen !== VW.rgen || !VW.open) { for (const g of r.geos.values()) g.dispose(); return; }
      vwGeosFree(); VW.geos = r.geos; VW.n1 = r.to; VW.notes = r.notes.slice(1);
    }
  } catch (e) { if (gen === VW.rgen) { VW.note = 'It could not be made lighter here: ' + ((e && e.message) || e); VW.noteC = 'red'; } }
  finally { if (gen === VW.rgen && VW.open) { VW.busy = ''; vwUi(); } }
}
function vwGeosFree() { if (VW.geos) for (const g of VW.geos.values()) g.dispose(); VW.geos = null; }
// its pictures with the gaps between their pieces filled (copies: the file's own stay as they are), worked out once, laid
// on the lighter one as Save would make it
function vwFillStart(gen) {
  const F = VW.fill = { gone: false, n: 0 };
  CONV.fillModel(VW.root, { copy: true }).then(r => {
    if (F.gone || gen !== VW.gen) return;
    const map = new Map();
    for (const f of r.list) for (const t of f.texs) { const c = t.clone(); c.image = f.canvas; c.needsUpdate = true; map.set(t, c); }
    VW.fmap = map; F.n = r.list.length; vwUi();
  }, () => { /* shown without it */ });
}
function vwFillFree() {
  if (VW.fill) VW.fill.gone = true;
  if (VW.fmap) for (const c of VW.fmap.values()) { c.dispose(); c.image = null; }
  VW.fmap = null; VW.fill = null;
}

// ---- each frame (from the studio's frame, in place of drawing its own scene)
const _vws = new THREE.Vector2(), _vwd = new THREE.Vector3(), _vwl = new THREE.Vector3();
// the model as one of the two (lite: the lighter one): its geometries, its materials (lit or as scanned) and their
// pictures (none with Textures off; the filled ones on the lighter one); a program built again only when a picture comes
// or goes, never when one is swapped for another
function vwApply(lite) {
  const L = lite && !!VW.geos && VW.busy !== 'lite';
  for (const e of VW.meshes) {
    const g = L ? VW.geos.get(e.g0) || e.g0 : e.g0;
    if (e.m.geometry !== g) e.m.geometry = g;
    const mt = VW.light === 'scan' ? e.scan : e.lit;
    if (e.m.material !== mt) e.m.material = mt;
  }
  for (const x of VW.mats) for (const k in x.maps) {
    const o = x.maps[k], want = !VW.tex ? null : lite && VW.fmap && VW.fmap.has(o) ? VW.fmap.get(o) : o;
    if (x.mat[k] !== want) { if (!x.mat[k] !== !want) x.mat.needsUpdate = true; x.mat[k] = want; }
  }
}
function vwCam(aspect) {
  const c = VW.cam, A = VW.az * D2R, E = clamp(VW.el, -85, 85) * D2R;
  c.aspect = aspect;
  _vwd.set(Math.cos(E) * Math.sin(A), Math.sin(E), Math.cos(E) * Math.cos(A));
  c.position.copy(VW.tgt).addScaledVector(_vwd, VW.dist);
  c.near = Math.max(VW.R * 1e-3, VW.dist * 0.01); c.far = VW.dist + VW.R * 40;
  c.up.set(0, 1, 0); c.lookAt(VW.tgt); c.updateProjectionMatrix(); c.updateMatrixWorld();
  // (lit as the studio lights its scene: the sun from over your left shoulder, the rim light from behind)
  _vwl.set(-0.5, 0.8, 1.0).normalize().applyQuaternion(c.quaternion); _vwl.y = Math.max(_vwl.y, 0.4);
  VW.sun.position.copy(_vwl);
  _vwl.set(0.3, 0.5, -1.0).normalize().applyQuaternion(c.quaternion);
  VW.rim.position.copy(_vwl);
}
function vwPass(lite, aspect) {
  const R = GL.renderer;
  vwApply(lite);
  vwCam(aspect);
  R.render(VW.scene, VW.cam);
  if (VW.wire && VW.root) {
    // (its triangles' edges over it: drawn without clearing, the background out of the way, which would clear; a hair nearer
    // than its faces, the projection's depth scaled by 1 - 2e-4, so the edges are not lost in its own faces' depth)
    const ac = R.autoClear, bg = VW.scene.background, e = VW.cam.projectionMatrix.elements, e10 = e[10];
    R.autoClear = false; VW.scene.background = null; VW.scene.overrideMaterial = VW.wireMat; VW.grid.visible = false; e[10] = e10 * (1 - 2e-4);
    try { R.render(VW.scene, VW.cam); } finally { R.autoClear = ac; VW.scene.background = bg; VW.scene.overrideMaterial = null; VW.grid.visible = true; e[10] = e10; }
  }
}
// the viewer's frame: it turns by itself until touched; one view, or two side by side (the window's halves, one camera:
// left and right, or on a window taller than it is wide, as a phone's held upright, top and bottom)
const vwTall = () => { const s = GL.renderer.getSize(_vws); return s.y > s.x * 1.1; };
function vwDraw(dt) {
  if (!VW.open || !VW.scene) return;
  if (!canView()) { vwClose(); return; }
  const R = GL.renderer, s = R.getSize(_vws), w = s.x, h = Math.max(1, s.y);
  if (VW.spin && VW.root && dt) VW.az = (VW.az + VW_SPIN * dt) % 360;
  const two = VW.lite && VW.mode === 'both';
  if (two) {
    const tall = vwTall(), hw = Math.round(w / 2), hh = Math.round(h / 2);
    R.setScissorTest(true);
    try {
      // (all its triangles on the left or at the top; a viewport's y counts from the bottom)
      for (const [i, lite] of [[0, false], [1, true]]) {
        const [x, y, ww, vh] = tall ? [0, i ? 0 : h - hh, w, hh] : [i * hw, 0, hw, h];
        R.setViewport(x, y, ww, vh); R.setScissor(x, y, ww, vh); vwPass(lite, ww / vh);
      }
    } finally { R.setScissorTest(false); R.setViewport(0, 0, w, h); }
  } else vwPass(VW.lite && VW.mode === 'lite', w / h);
  VW.drew++;
}

// ---- framing: the camera from a little above and in front, far enough that its box fits the view (a half of the window
// side by side), the grid under it sized to it, its size said
function vwFrame(reset) {
  if (!VW.root) return;
  VW.wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(VW.wrap);
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  VW.size = size.toArray(); VW.R = Math.max(1e-3, size.length() / 2);
  VW.tgt.copy(c);
  const s = GL.renderer.getSize(_vws), two = VW.lite && VW.mode === 'both', tall = vwTall();
  const aspect = (two && !tall ? s.x / 2 : s.x) / Math.max(1, two && tall ? s.y / 2 : s.y), v = VW.cam.fov * D2R, hz = 2 * Math.atan(Math.tan(v / 2) * aspect);
  VW.dist = VW.R / Math.sin(Math.min(v, hz) / 2) * 1.08;
  if (reset) { VW.az = 35; VW.el = 18; }
  // the grid: a nice step (1 cm to 10 m) about a tenth of its widest side along the floor, two of its sides wide, at its foot
  if (VW.grid) { VW.scene.remove(VW.grid); VW.grid.geometry.dispose(); VW.grid.material.dispose(); }
  const span = Math.max(size.x, size.z, size.y * 0.5, 1e-3), steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
  const st = steps.find(x => x >= span / 10) || 10, n = Math.max(4, Math.ceil(span * 2 / st));
  VW.grid = new THREE.GridHelper(n * st, n, 0x4a5d7c, 0x223047);
  VW.grid.position.set(c.x, box.min.y, c.z);
  VW.grid.material.transparent = true; VW.grid.material.opacity = 0.7;
  VW.grid.userData.step = st;
  VW.scene.add(VW.grid);
}

// ---- the overlay: its controls over the canvas, which is raised over the page while it is open
function vwBuild() {
  if (!VW.scene) {
    const sc = VW.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x0a111d);
    sc.add(new THREE.HemisphereLight(0xe8eeff, 0x2a2f3a, 0.9));
    VW.sun = new THREE.DirectionalLight(0xffffff, 0.9); sc.add(VW.sun); sc.add(VW.sun.target);
    VW.rim = new THREE.DirectionalLight(0x9fc8ff, 0.35); sc.add(VW.rim); sc.add(VW.rim.target);
    VW.cam = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    VW.wrap = new THREE.Group(); sc.add(VW.wrap);
    VW.wireMat = new THREE.MeshBasicMaterial({ color: 0x050b16, wireframe: true, transparent: true, opacity: 0.7, depthWrite: false, skinning: true });   // (dark lines: they show over a model's own colours)
  }
  VW.scene.environment = envMap();   // (the soft room for glTF's metal and gloss, as the scene has)
  const el = VW.dom = document.createElement('div');
  el.id = 'stuViewer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Look at the model');
  el.innerHTML = `<style>
    #stuViewer { position: fixed; inset: 0; z-index: 14; color: #e7eef8; font: 14px/1.35 B612, "Segoe UI", Arial, sans-serif; }
    #stuViewer .vw-hit { position: absolute; inset: 0; touch-action: none; cursor: grab; }
    #stuViewer .vw-hit:active { cursor: grabbing; }
    #stuViewer .vw-top, #stuViewer .vw-bot { position: absolute; left: 0; right: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px max(14px, env(safe-area-inset-right, 0px)) 10px max(14px, env(safe-area-inset-left, 0px)); background: rgba(6, 11, 20, 0.82); }
    #stuViewer .vw-top { top: 0; padding-top: max(10px, env(safe-area-inset-top, 0px)); }
    #stuViewer .vw-bot { bottom: 0; flex-direction: column; align-items: stretch; padding-bottom: max(10px, env(safe-area-inset-bottom, 0px)); }
    #stuViewer .vw-t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    #stuViewer .vw-t b { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #stuViewer .vw-t small { color: #a9b8cc; }
    #stuViewer .vw-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
    #stuViewer .vw-row[hidden] { display: none; }
    #stuViewer .btn { border: 1px solid rgba(149, 166, 189, 0.4); background: rgba(22, 32, 48, 0.9); color: #e7eef8; border-radius: 6px; padding: 7px 13px; font: inherit; font-size: 14px; cursor: pointer; }
    #stuViewer .btn:hover { border-color: #a9b8cc; }
    #stuViewer .btn.primary { background: #46d9ff; border-color: transparent; color: #04101c; font-weight: 700; }
    #stuViewer .btn[aria-pressed="true"] { border-color: #46d9ff; color: #46d9ff; }
    #stuViewer .btn[disabled] { opacity: 0.45; cursor: default; }
    #stuViewer .vw-range { display: flex; align-items: center; gap: 8px; color: #a9b8cc; flex: 1 1 220px; min-width: 180px; }
    #stuViewer .vw-range input { flex: 1; min-width: 80px; accent-color: #46d9ff; }
    #stuViewer .vw-range b { color: #e7eef8; min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; }
    #stuViewer .vw-counts { color: #a9b8cc; font-variant-numeric: tabular-nums; }
    #stuViewer .vw-help { color: #8293ab; font-size: 12.5px; }
    #stuViewer .vw-note { margin: 0; font-size: 13px; color: #a9b8cc; }
    #stuViewer .vw-note.red { color: #ff7a6e; } #stuViewer .vw-note:empty { display: none; }
    #stuViewer .vw-mid { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 10px 16px; border-radius: 8px; background: rgba(6, 11, 20, 0.8); pointer-events: none; }
    #stuViewer .vw-mid:empty { display: none; }
    #stuViewer .vw-side { position: absolute; top: 0; padding: 6px 10px; border-radius: 6px; background: rgba(6, 11, 20, 0.75); font-size: 13px; pointer-events: none; font-variant-numeric: tabular-nums; }
    #stuViewer .vw-side[hidden] { display: none; }
    #stuViewer .vw-split { position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; margin-left: -1px; background: rgba(149, 166, 189, 0.45); pointer-events: none; }
    #stuViewer .vw-split.tall { top: 50%; bottom: auto; left: 0; right: 0; width: auto; height: 2px; margin: -1px 0 0; }
    #stuViewer .vw-split[hidden] { display: none; }
  </style>
  <div class="vw-hit" data-vw-hit></div>
  <div class="vw-split" hidden></div>
  <span class="vw-side" data-side="l" hidden></span><span class="vw-side" data-side="r" hidden></span>
  <div class="vw-mid" aria-live="polite"></div>
  <div class="vw-top"><div class="vw-t"><b class="vw-name"></b><small class="vw-size"></small></div>
    <button class="btn" type="button" data-vw="frame">Frame it</button><button class="btn primary" type="button" data-vw="close">Close</button></div>
  <div class="vw-bot">
    <div class="vw-row" data-lite hidden>
      <div class="vw-row" role="group" aria-label="Which to show">
        <button class="btn" type="button" data-vw="mode" data-v="all">All triangles</button><button class="btn" type="button" data-vw="mode" data-v="lite">Lighter</button><button class="btn" type="button" data-vw="mode" data-v="both">Side by side</button>
      </div>
      <label class="vw-range">Share kept <input type="range" min="2" max="100" step="1" data-vw-keep aria-label="Share of its triangles kept"><b data-vw-pct></b></label>
      <span class="vw-counts"></span>
    </div>
    <div class="vw-row">
      <button class="btn" type="button" data-vw="wire">Wireframe: off</button><button class="btn" type="button" data-vw="tex">Textures: on</button>
      <button class="btn" type="button" data-vw="light" data-v="lit">Lit</button><button class="btn" type="button" data-vw="light" data-v="scan">As scanned</button>
      <span class="vw-help">Drag to spin · wheel or pinch to zoom · right-drag or two fingers to pan · double-click to frame it · Esc to close</span>
    </div>
    <p class="vw-note"></p>
  </div>`;
  document.body.appendChild(el);
  VW.z0 = GL.canvas.style.zIndex; GL.canvas.style.zIndex = '13';   // (the canvas over the page's panels, the overlay over it)
  VW.focus = document.activeElement;
  vwBind(el);
  vwUi();
  const c = el.querySelector('[data-vw="close"]');
  if (c) c.focus();
}
function vwBind(el) {
  el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-vw]');
    if (!b || b.disabled) return;
    const a = b.dataset.vw, v = b.dataset.v;
    if (a === 'close') { vwClose(); return; }
    if (a === 'frame') { VW.spin = false; vwFrame(true); }
    else if (a === 'mode' && ['all', 'lite', 'both'].includes(v)) { const was = VW.mode; VW.mode = v; if ((was === 'both') !== (v === 'both')) vwFrame(false); }
    else if (a === 'wire') VW.wire = !VW.wire;
    else if (a === 'tex') VW.tex = !VW.tex;
    else if (a === 'light' && (v === 'lit' || v === 'scan')) VW.light = v;
    vwUi();
  });
  const range = el.querySelector('[data-vw-keep]');
  range.addEventListener('input', () => { vwUi(+range.value / 100); });
  range.addEventListener('change', () => { vwKeep(+range.value / 100); });
  const hit = el.querySelector('[data-vw-hit]'), P = VW.pts;
  const two = () => { const [a, b] = [...P.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  hit.addEventListener('pointerdown', ev => {
    VW.spin = false;
    try { hit.setPointerCapture(ev.pointerId); } catch (e) { /* gone */ }
    P.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, b: ev.button, pan: ev.button === 2 || ev.shiftKey });
    if (P.size === 2) { const t = two(); VW.pinch = t.d; VW.mid = [t.x, t.y]; }
  });
  hit.addEventListener('pointermove', ev => {
    const p = P.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    p.x = ev.clientX; p.y = ev.clientY;
    if (P.size >= 2) {
      const t = two();
      if (VW.pinch > 0 && t.d > 0) vwZoom(VW.pinch / t.d);
      if (VW.mid) vwPan(t.x - VW.mid[0], t.y - VW.mid[1]);
      VW.pinch = t.d; VW.mid = [t.x, t.y];
      return;
    }
    if (p.pan) vwPan(dx, dy);
    else { VW.az = (VW.az - dx * 0.4) % 360; VW.el = clamp(VW.el + dy * 0.3, -85, 85); }
  });
  const up = ev => { P.delete(ev.pointerId); if (P.size < 2) { VW.pinch = 0; VW.mid = null; } };
  hit.addEventListener('pointerup', up); hit.addEventListener('pointercancel', up);
  hit.addEventListener('wheel', ev => { ev.preventDefault(); VW.spin = false; vwZoom(Math.exp(ev.deltaY * 0.0012)); }, { passive: false });
  hit.addEventListener('dblclick', ev => { ev.preventDefault(); VW.spin = false; vwFrame(false); });
  el.addEventListener('contextmenu', ev => { if (ev.target === hit) ev.preventDefault(); });
  // the keyboard is the viewer's while it is open (the studio's keys, Delete or Ctrl+Z, never reach the scene behind it)
  VW.keyFn = ev => {
    if (!VW.open) return;
    if (ev.key === 'Escape') { ev.preventDefault(); vwClose(); }
    else if (!(ev.target && ev.target.closest && ev.target.closest('#stuViewer'))) { ev.preventDefault(); }
    ev.stopPropagation();
  };
  window.addEventListener('keydown', VW.keyFn, true);
  VW.sizeFn = () => { if (VW.open) vwUi(); };   // (a window resized: its labels placed again, the top bar may wrap)
  window.addEventListener('resize', VW.sizeFn);
}
const vwZoom = f => { VW.dist = clamp(VW.dist * f, VW.R * 0.05, VW.R * 60); };
function vwPan(dx, dy) {
  const h = Math.max(1, GL.renderer.getSize(_vws).y), k = 2 * VW.dist * Math.tan(VW.cam.fov * D2R / 2) / h;
  const right = new THREE.Vector3().setFromMatrixColumn(VW.cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(VW.cam.matrixWorld, 1);
  VW.tgt.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
}
// a share let go on the slider: the lighter one made again
function vwKeep(v) {
  v = Math.min(1, Math.max(CONV.KEEP_MIN, Math.round(v * 100) / 100));
  if (v === VW.keep && !VW.busy) { vwUi(); return; }
  VW.keep = v;
  if (VW.mode === 'all') VW.mode = 'both';   // (a share chosen: shown beside all its triangles)
  vwReduce();
}
// the overlay's words and buttons (drag: the slider's share while it moves, said before it is let go)
function vwUi(drag) {
  const el = VW.dom;
  if (!el) return;
  const q = s => el.querySelector(s), set = (s, t) => { const n = q(s); if (n && n.textContent !== t) n.textContent = t; };
  set('.vw-name', VW.title || 'Reading the model...');
  set('.vw-size', VW.size ? `${metres(VW.size[0])} × ${metres(VW.size[1])} × ${metres(VW.size[2])} (x, height, z)` + (VW.grid ? ` · grid squares ${metres(VW.grid.userData.step)}` : '') + ` · ${fmt(VW.cur)} triangles` : '');
  set('.vw-mid', VW.busy === 'load' ? VW.note : VW.busy === 'lite' ? 'Making it lighter...' : '');
  const n = q('.vw-note');
  if (n) { const t = VW.busy === 'load' ? '' : [VW.note].concat(VW.lite && VW.fmap && VW.fmap.size ? ['The lighter one\'s pictures are shown with the gaps between their pieces filled, as Save fills them.'] : [], VW.lite ? VW.notes.map(x => x.charAt(0).toUpperCase() + x.slice(1) + '.') : []).filter(Boolean).join(' '); if (n.textContent !== t) n.textContent = t; n.className = 'vw-note' + (VW.noteC === 'red' && VW.note ? ' red' : ''); }
  const lite = q('[data-lite]');
  if (lite) lite.hidden = !VW.lite;
  const k = drag !== undefined ? drag : VW.keep, about = VW.n0 ? Math.round(VW.n0 * k) : Math.round(VW.cur * k);
  const r = q('[data-vw-keep]');
  if (r && drag === undefined && +r.value !== Math.round(VW.keep * 100)) r.value = Math.round(VW.keep * 100);
  if (r) r.disabled = !VW.root || VW.busy === 'load';
  set('[data-vw-pct]', Math.round(k * 100) + ' %');
  const drawn = VW.busy === 'lite' || !VW.root ? '...' : fmt(VW.n1);
  set('.vw-counts', drag !== undefined && Math.abs(drag - VW.keep) > 1e-6 ? `About ${fmt(about)} kept: let go to see it` : `All: ${fmt(VW.cur)} · Lighter: ${drawn}`);
  for (const b of el.querySelectorAll('[data-vw="mode"]')) b.setAttribute('aria-pressed', String(b.dataset.v === VW.mode));
  for (const b of el.querySelectorAll('[data-vw="light"]')) b.setAttribute('aria-pressed', String(b.dataset.v === VW.light));
  const w = q('[data-vw="wire"]'), t = q('[data-vw="tex"]');
  if (w) { w.textContent = 'Wireframe: ' + (VW.wire ? 'on' : 'off'); w.setAttribute('aria-pressed', String(VW.wire)); }
  if (t) { t.textContent = 'Textures: ' + (VW.tex ? 'on' : 'off'); t.setAttribute('aria-pressed', String(VW.tex)); }
  const two = VW.lite && VW.mode === 'both';
  const sl = q('[data-side="l"]'), sr = q('[data-side="r"]'), sp = q('.vw-split'), top = (q('.vw-top') || { offsetHeight: 0 }).offsetHeight + 8, tall = vwTall();
  if (sp) { sp.hidden = !two; sp.classList.toggle('tall', tall); }
  if (sl) { sl.hidden = !two; sl.textContent = `All triangles: ${fmt(VW.cur)}`; sl.style.left = '12px'; sl.style.top = top + 'px'; }
  if (sr) { sr.hidden = !two; sr.textContent = `Lighter, ${Math.round(VW.keep * 100)} %: ${drawn}`; sr.style.left = tall ? '12px' : 'calc(50% + 12px)'; sr.style.top = tall ? 'calc(50% + 8px)' : top + 'px'; }
}

// ---- closing: everything the viewer made freed, the canvas back under the page, the share back to its row or card
function vwClose() {
  if (!VW.open) return;
  const src = VW.src, keep = VW.keep, lite = VW.lite && !!VW.root;
  VW.open = false; VW.gen++; VW.rgen++;
  if (VW.keyFn) window.removeEventListener('keydown', VW.keyFn, true);
  if (VW.sizeFn) window.removeEventListener('resize', VW.sizeFn);
  VW.keyFn = VW.sizeFn = null; VW.pts.clear();
  vwFillFree(); vwGeosFree();
  if (VW.root) {
    VW.tex = true; vwApply(false);   // (its own geometries and pictures back on it, so what it owns is all freed below)
    for (const e of VW.meshes) for (const m of [].concat(e.scan)) m.dispose();
    VW.wrap.remove(VW.root);
    vwFreeGot({ root: VW.root, own: VW.own });
  }
  VW.root = null; VW.meshes = []; VW.mats = [];
  if (VW.grid) { VW.scene.remove(VW.grid); VW.grid.geometry.dispose(); VW.grid.material.dispose(); VW.grid = null; }
  if (VW.dom && VW.dom.parentNode) VW.dom.parentNode.removeChild(VW.dom);
  VW.dom = null;
  if (GL.canvas) GL.canvas.style.zIndex = VW.z0;
  if (VW.focus && VW.focus.focus && document.contains(VW.focus)) { try { VW.focus.focus(); } catch (e) { /* gone */ } }
  VW.focus = null;
  // (the share chosen here goes back to where it was opened from: the Upload row's, or Fewer triangles' on the card)
  if (lite && src && src.kind === 'up') {
    const r = UP.rows[src.ri], seen = VW.busy !== 'lite' && VW.n1 && VW.cur;
    if (r && r.kind === 'model' && r.state === 'plan' && !UP.busy) {
      r.keep = keep;
      r.pv = seen ? { keep, words: keep < 0.995 && VW.n1 < VW.cur ? `Seen in the viewer: ${fmt(VW.cur)} triangles became ${fmt(VW.n1)}.` : `Seen in the viewer: ${fmt(VW.cur)} triangles, all kept.` } : null;
      upChanged();
    }
  } else if (lite && src && src.kind === 'ft' && FT.id === src.id && FT.keep !== keep) ftSet(keep, true);
  VW.busy = '';
  dirty(true);
}
// for tests and the console
const vwState = () => ({ open: VW.open, kind: VW.src ? VW.src.kind : '', title: VW.title, busy: VW.busy, note: VW.note, lite: VW.lite, mode: VW.mode, keep: VW.keep, k: VW.k, n0: VW.n0, cur: VW.cur, n1: VW.n1,
  wire: VW.wire, tex: VW.tex, light: VW.light, spin: VW.spin, az: VW.az, el: VW.el, dist: VW.dist, R: VW.R, size: VW.size && VW.size.map(r3), fill: VW.fmap ? VW.fmap.size : 0, drew: VW.drew, tgt: VW.tgt.toArray(), grid: VW.grid ? VW.grid.userData.step : 0 });
