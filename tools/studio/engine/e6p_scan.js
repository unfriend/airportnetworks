
// ------------------------------------------------------------ the room scan --
// The headset's room scan saved as a model of the scene (v141; the owner, 13 November 2026: "Possible to use the quest for
// scanning? That would also be perfect for setting up a new room with a scan directly inside the headset"). What a web
// page on a Quest gets is the Space Setup scan: WebXR's mesh-detection (one coarse mesh of the room, labelled) and
// plane-detection (walls, floor, ceiling, tables as flat outlines), shape only, no colour. Every story's AR session asks
// for both already. In AR, editing, the Add pane offers Scan the room (Quest's own room setup, initiateRoomCapture, once a
// session) and Save the room as a model: in the next frame the mesh (or the planes) are taken into the scene's frame
// (GL.world's inverse, as wallsXR does), merged by label (one mesh each: wall, floor, table...), each label its own plain
// colour, made a GLB by the converter (CONV.toGLB: welded, made lighter if asked, checked, its picture made), uploaded
// into models/ and placed where it was taken (p 0, no turn, size 1), so it stands on the real room: at a station on the
// room's spots for every headset there; outside a room for this session's floor point only. Shown only in VR by default
// (in AR the real room is there; its card's Shows in changes it). Nothing new is shared: an ordinary file and object.
const SCAN_COL = { wall: '#c9ced6', floor: '#7d838c', ceiling: '#e3e6ea', table: '#b39a7a', couch: '#8c9bb3', bed: '#a9a1c9', door: '#a07e5c',
  window: '#9fc4d9', screen: '#555b66', storage: '#b5a58c', lamp: '#d8cf9c', plant: '#8fb08a', art: '#c4a3a3', room: '#bfc5cd', other: '#aab2bd' };
const SCAN_WORD = { wall: 'wall', floor: 'floor', ceiling: 'ceiling', table: 'table', couch: 'couch', bed: 'bed', door: 'door', window: 'window',
  screen: 'screen', storage: 'cupboard', lamp: 'lamp', plant: 'plant', art: 'picture', room: 'room mesh', other: 'other part' };
const SCAN_MAX = 1500000;   // (triangles at most: Space Setup's mesh is far smaller; more is refused in words)
// ar: in an AR session now; seen: the scan's counts last read ({ meshes, planes, tris, labels, sig }); t: when; want: a
// save asked for ({ src, keep }), baked in the next frame; src: 'mesh' (the room mesh, else the planes) or 'planes';
// keep: the share of triangles kept; asked: the session Scan the room was pressed in; busy, note, noteC; last: the last
// save's { path, tris, labels, from } (tests)
const SCAN = { ar: false, seen: null, t: 0, want: null, src: 'mesh', keep: 1, asked: null, busy: false, note: '', noteC: 'muted', last: null };
const _scm = new THREE.Matrix4(), _sci = new THREE.Matrix4(), _scv = new THREE.Vector3();
// a part's label as a key of SCAN_COL ('door frame' a door, 'global mesh' the room mesh)
function scanKey(o) {
  const s = wallSem(o).replace(/[\s_-]+/g, ' ').trim();
  if (!s) return 'other';
  if (s === 'global mesh' || s === 'mesh') return 'room';
  if (/door/.test(s)) return 'door';
  if (/window/.test(s)) return 'window';
  if (/art|picture|poster/.test(s)) return 'art';
  if (/storage|shelf|cabinet|cupboard/.test(s)) return 'storage';
  if (/sofa|couch|chair|seat/.test(s)) return 'couch';
  if (/desk|table/.test(s)) return 'table';
  if (/screen|monitor|tv/.test(s)) return 'screen';
  return SCAN_COL[s] ? s : 'other';
}
const scanSet = (frame, k) => { try { const s = frame[k]; return s && typeof s.forEach === 'function' ? s : null; } catch (e) { return null; } };
// the scan's counts (no geometry made): how many meshes and planes, triangles, by label
function scanCount(frame) {
  const meshes = scanSet(frame, 'detectedMeshes'), planes = scanSet(frame, 'detectedPlanes'), labels = {};
  let nm = 0, np = 0, tm = 0, tp = 0;
  if (meshes) meshes.forEach(o => { nm++; const ix = o.indices, v = o.vertices; tm += ix ? Math.floor(ix.length / 3) : v ? Math.floor(v.length / 9) : 0; const k = scanKey(o); labels[k] = (labels[k] || 0) + 1; });
  if (planes) planes.forEach(o => { np++; const n = o.polygon ? o.polygon.length : 0; if (n >= 3) tp += n - 2; const k = scanKey(o); labels[k] = (labels[k] || 0) + 1; });
  const seen = { meshes: nm, planes: np, tm, tp, labels }, sig = JSON.stringify(seen);
  if (!SCAN.seen || SCAN.seen.sig !== sig) { SCAN.seen = Object.assign(seen, { sig }); dirty(true); }
}
// each frame of an AR session (xrBegin, beside wallsXR): the counts once a second, and a save asked for baked in this frame
function scanXR(frame, ref) {
  if (!XR.on || XR.clear || !frame || !ref) { if (SCAN.ar || SCAN.want) { scanEnd(); dirty(true); } return; }
  if (!SCAN.ar) { SCAN.ar = true; dirty(true); }
  const now = performance.now();
  if (now - SCAN.t > 1000 || SCAN.want) { SCAN.t = now; scanCount(frame); }
  if (!SCAN.want) return;
  const w = SCAN.want;
  SCAN.want = null;
  let root = null;
  try { root = scanBake(frame, ref, w.src); } catch (e) { SCAN.busy = false; SCAN.note = `The room scan could not be read: ${e.message}`; SCAN.noteC = 'red'; dirty(true); return; }
  if (!root) { SCAN.busy = false; dirty(true); return; }
  scanSave(root, w);
}
// the scan in this frame, as a group of meshes in the scene's frame, one a label: the room mesh (src 'mesh'; its planes
// only when it has none) or the planes, each polygon fanned into triangles as occlusion.js's buildPart does. Null (and
// the note says why) when there is nothing, or too much
function scanBake(frame, ref, src) {
  const meshes = scanSet(frame, 'detectedMeshes'), planes = scanSet(frame, 'detectedPlanes');
  SCAN.bake = null;
  GL.world.updateMatrixWorld(true);
  _sci.copy(GL.world.matrixWorld).invert();
  const parts = new Map();   // (label: { pos: [], idx: [] })
  let tris = 0, used = '';
  const put = (k, local, n, idx, pose) => {
    const P = parts.get(k) || { pos: [], idx: [] }, base = P.pos.length / 3, T = pose.transform.matrix;
    _scm.fromArray(T).premultiply(_sci);
    for (let i = 0; i < n; i++) { local(i, _scv); _scv.applyMatrix4(_scm); P.pos.push(_scv.x, _scv.y, _scv.z); }
    for (let i = 0; i < idx.length; i++) P.idx.push(base + idx[i]);
    tris += idx.length / 3;
    parts.set(k, P);
  };
  const pose = (o, space) => { try { return frame.getPose(o[space], ref); } catch (e) { return null; } };
  const fromMeshes = () => {
    meshes.forEach(o => {
      const v = o.vertices, ix = o.indices, p = pose(o, 'meshSpace');
      if (!p || !v || v.length < 9) return;
      const n = Math.floor(v.length / 3), idx = ix && ix.length >= 3 ? Array.from(ix).slice(0, ix.length - (ix.length % 3)) : Array.from({ length: n - (n % 3) }, (q, i) => i);
      if (tris + idx.length / 3 > SCAN_MAX) { tris = Infinity; return; }
      put(scanKey(o), (i, out) => out.set(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]), n, idx, p);
    });
  };
  const fromPlanes = () => {
    planes.forEach(o => {
      const pts = o.polygon ? Array.from(o.polygon) : [], p = pose(o, 'planeSpace');
      if (!p || pts.length < 3) return;
      const idx = [];
      for (let k = 1; k + 1 < pts.length; k++) idx.push(0, k, k + 1);   // (the polygon is convex)
      put(scanKey(o), (i, out) => out.set(pts[i].x, pts[i].y, pts[i].z), pts.length, idx, p);
    });
  };
  if (src !== 'planes' && meshes && meshes.size !== 0) { fromMeshes(); used = 'mesh'; }
  if (!parts.size && tris !== Infinity && planes) { fromPlanes(); used = 'planes'; }
  if (tris === Infinity || tris > SCAN_MAX) { SCAN.note = `The room scan has more than ${fmt(SCAN_MAX)} triangles: too many to save here.`; SCAN.noteC = 'red'; return null; }
  if (!parts.size) {
    SCAN.note = src === 'planes' || !meshes || !meshes.size ? 'No room scan here yet: press Scan the room (Quest\'s own room setup), then Save again.' : 'The room scan has no part placed in this frame: look round and try again.';
    SCAN.noteC = 'amber';
    return null;
  }
  const root = new THREE.Group();
  root.name = 'room scan';
  for (const k of Object.keys(SCAN_COL).filter(q => parts.has(q))) {
    const P = parts.get(k), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.pos), 3));
    geo.setIndex(P.idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: k, color: SCAN_COL[k], roughness: 0.9, metalness: 0, side: THREE.DoubleSide }));
    m.name = k;
    root.add(m);
  }
  SCAN.bake = { used, tris, labels: [...parts.keys()] };
  return root;
}
// the baked scan made a GLB, uploaded into models/ (with its picture) and placed where it was taken; without a relay that
// takes uploads, downloaded
async function scanSave(root, w) {
  const gen = STU.gen, scene = STU.scene, bake = SCAN.bake || {};
  const d = new Date(), pad = n => String(n).padStart(2, '0'), name = `room-scan-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const say = (t, c) => { SCAN.note = t; SCAN.noteC = c || 'muted'; dirty(true); };
  SCAN.busy = true;
  say('Saving the room scan: making the model...');
  try {
    const m = { root, clips: [], guess: { unit: 100, up: 1, sign: 1, read: true, gltf: true, format: 'room scan' }, ext: 'glb', missing: [] };
    const r = await CONV.toGLB(m, { name, maxTex: maxTexNow(), keep: w.keep > 0 && w.keep < 1 ? w.keep : 0, picture: pvShotSoon, step: l => say(`Saving the room scan: ${l.toLowerCase()}...`) });
    CONV.disposeTree(m.root);
    STUDIO.lastGLB = { name: name + '.glb', glb: r.glb, record: r.record, ok: r.ok, why: r.why, notes: r.notes, before: r.before, after: r.after, picture: !!r.picture };
    if (gen !== STU.gen || GL.gone) return;
    if (!r.ok) { say(`The room scan was not saved: ${r.why}.`, 'red'); return; }
    const n = r.record && r.record.n, info = r.record && r.record.size ? { size: r.record.size, n } : null, size = mb(r.glb.byteLength);
    SCAN.last = { path: '', tris: n || 0, labels: bake.labels || [], from: bake.used || '', bytes: r.glb.byteLength };
    if (canUpload()) {
      let out = freeName('models/' + name + '.glb', p => STU.fileMap.has(p));
      say(`Saving the room scan: uploading ${out} (${size})...`);
      const j = await upSend(fileApi(scene, out, false), new Blob([r.glb], { type: 'model/gltf-binary' }), p => say(`Saving the room scan: uploading ${out} (${Math.round(p * 100)} %)...`));
      out = (j && j.path) || out;
      if (gen !== STU.gen) return;
      await refreshFiles(new Set([out]));
      SCAN.last.path = out;
      if (r.picture) { try { await pvKeep(out, r.picture, info, gen); } catch (e) { /* Make pictures makes it again */ } }
      const id = editOn() ? addScan(out) : '';
      say(`The room scan is ${out} (${size}, ${fmt(n || 0)} triangles)` + (id ? ': placed where the real room is, shown only in VR (its card\'s Shows in changes that).' : ': place it from Add (it stands right at 0, 0, 0 with no turn).'), 'green');
    } else {
      saveFile(r.glb, name + '.glb', 'model/gltf-binary');
      say(`The room scan was downloaded as ${name}.glb (${size}, ${fmt(n || 0)} triangles): ` + (SRC.kind === 'relay' ? 'this relay does not take uploads; ' : '') + 'put it in the scene\'s models/ folder and place it at 0, 0, 0 with no turn.', 'green');
    }
    sfxAct('ping', 'stage', 'centre', { gain: 0.6 });
  } catch (e) {
    if (gen === STU.gen) say(`The room scan was not saved: ${e.status === 401 ? AUTH_NOTE : e.message}`, 'red');
  } finally { SCAN.busy = false; dirty(true); }
}
// Scan the room: Quest's own room setup (Space Setup), from the page, once a session
const scanCanStart = () => !!(SCAN.ar && XR.session && typeof XR.session.initiateRoomCapture === 'function' && SCAN.asked !== XR.session);
function scanStart() {
  if (!scanCanStart()) return;
  SCAN.asked = XR.session;
  SCAN.note = 'Quest\'s room setup is open: scan the room as it asks, then come back and press Save the room as a model.'; SCAN.noteC = 'muted';
  try {
    const p = XR.session.initiateRoomCapture();
    if (p && p.catch) p.catch(e => { SCAN.note = `Quest's room setup did not start (${(e && e.message) || 'refused'}): run Space Setup in the headset's settings.`; SCAN.noteC = 'amber'; dirty(true); });
  } catch (e) { SCAN.note = `Quest's room setup did not start (${e.message}): run Space Setup in the headset's settings.`; SCAN.noteC = 'amber'; }
  dirty(true);
}
// Save the room as a model: baked in the next frame of the session (scanXR)
function scanAsk() {
  if (!SCAN.ar || SCAN.busy || !editOn() || OPT.visit) return;
  SCAN.busy = true; SCAN.want = { src: SCAN.src, keep: SCAN.keep };
  SCAN.note = 'Saving the room scan: reading it...'; SCAN.noteC = 'muted';
  dirty(true);
}
// the session over: nothing more to read (e8_xr.js)
// (a save asked for and not yet baked is dropped; one already baked goes on, its upload clearing busy as it ends)
function scanEnd() { SCAN.ar = false; if (SCAN.want) { SCAN.want = null; SCAN.busy = false; SCAN.note = ''; } }
// the counts in words: "1 room mesh, 6 planes (4 walls, floor, table) · 12,400 triangles"
function scanWords() {
  const s = SCAN.seen;
  if (!s || (!s.meshes && !s.planes)) return 'none yet';
  const L = Object.keys(SCAN_COL).filter(k => s.labels[k] && k !== 'room').map(k => (s.labels[k] === 1 ? SCAN_WORD[k] : `${s.labels[k]} ${SCAN_WORD[k]}s`));
  return [s.meshes ? `${s.meshes} mesh${s.meshes === 1 ? '' : 'es'}` : '', s.planes ? `${s.planes} plane${s.planes === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ') +
    (L.length ? ` (${L.join(', ')})` : '') + ` · ${fmt(SCAN.src === 'planes' || !s.meshes ? s.tp : s.tm)} triangles`;
}
// the Add pane's block (page and headset)
function scanBlocks(B) {
  if (!SCAN.ar) {
    B.push({ label: 'The room scan', p: XR.on ? 'A headset gives its room scan only in AR (passthrough): enter AR to save it as a model.' : 'In a headset, in AR, the headset\'s own room scan (Space Setup) can be saved here as a model of the scene: walls, floor and furniture, shape only.', c: 'faint' });
    return;
  }
  const s = SCAN.seen, has = !!s && (SCAN.src === 'planes' ? s.planes > 0 : s.meshes + s.planes > 0), st = stationId();
  B.push({ kv: [['This headset\'s room scan', scanWords()]] },
    { label: 'The room scan', row: [{ id: 'scanStart', label: SCAN.asked && SCAN.asked === XR.session ? 'Room setup opened' : 'Scan the room', act: 'scanStart', dis: !scanCanStart() || SCAN.busy }] },
    { label: 'Save it from', row: [{ id: 'scanSrc:mesh', label: 'The room mesh', act: 'scanSrc', v: 'mesh', on: SCAN.src === 'mesh' }, { id: 'scanSrc:planes', label: 'Walls and floor only', act: 'scanSrc', v: 'planes', on: SCAN.src === 'planes' }] },
    { label: 'Triangles kept', row: [[1, 'All'], [0.5, '50 %'], [0.2, '20 %']].map(([k, n]) => ({ id: 'scanKeep:' + k, label: n, act: 'scanKeep', v: k, on: SCAN.keep === k })) },
    { row: [{ id: 'scanSave', label: SCAN.busy ? 'Saving...' : 'Save the room as a model', act: 'scanSave', primary: true, dis: SCAN.busy || !has || !canAdd('o') }] },
    { p: (st ? 'It stands where the real room is, on the room\'s spots: every headset at this circle sees it there, also in later sessions.' : 'Outside a shared room it stands where the room is in this session only: a later session may start from another place.') +
      (canUpload() ? ' It goes into models/ and is placed at once, shown only in VR (in AR the real room is there).' : ' Without a relay that takes uploads it is downloaded.') +
      ' The room mesh is Quest\'s own: coarse and without colour.', c: 'faint' });
  if (SCAN.note) B.push({ p: SCAN.note, c: SCAN.noteC });
}
