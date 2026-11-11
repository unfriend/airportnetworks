// ================================================================ ON WALLS ==
// Things on the room's walls (v137; the owner, 11 November 2026, of a room built as a studio scene: its elements
// "dynamisch auf detected walls", "losgelöst und auf raum gemappt", and "it may need to be reactive and react to user
// movements, where the user goes, instead of a static variant"; tools/studio/SPEC.md, "Things on walls"). An object's, a
// shape's or an empty's behaviour may be of the kind 'wall':
// - { kind: 'wall', at: 'direction' }: on the first wall a ray meets from the walls' middle along its placed direction
//   from the scene's origin (its placed middle's x and z; at the origin -z);
// - { kind: 'wall', at: 'nearest' }: on the point of the walls nearest its placed middle, along the floor;
// - { kind: 'wall', at: 'person', who, range, speed }: on the point of the walls nearest the person it reacts to (chosen as
//   Follow and Look at choose, alike on every device from the heads: behChoose), moving along there at most speed m/s;
//   with nobody, back to its 'direction' place;
// each with gap (m, 0 to 0.5, 0.03 by default, written only when not the default).
// There its back is against the wall (its middle the gap plus its own depth behind its middle off the wall), its height its
// placed middle's held within the wall's bottom and top where it fits, its front (+z as placed) facing out of the wall into
// the room, its placed tilt kept. It eases there (about 0.4 s) when the walls change, never jumping each frame.
// The walls are this device's own: in an AR session whose frame has detectedPlanes (plane-detection on), every vertical
// plane (its orientation 'vertical', or labelled a wall; not a door) taken into the scene's frame as a segment along
// the floor (its polygon's extent), its bottom and top and its normal turned towards the walls' middle (the middle of
// their box along the floor; when that is on a wall's line, as with one wall, a point in the room: the head as they
// were read, else the scene's origin); read when the planes change and at most twice a second (once a second besides: a
// recentre moves the scene), as the robots read theirs. Nothing is sent and nothing stored but the record: the same
// record maps onto each headset's own room. No walls (VR, a page, no room scan yet): it stays where it is placed. It is
// a base stage of the pose pipeline as the other behaviours are (behaveBase), so a path and a motion draw over it, the
// record never changes, and it rests at its placed pose while held here or paused (its ghost there while editing).
const WALL_AT = ['direction', 'nearest', 'person'];
const WALL_AT_WORD = { direction: 'In its direction', nearest: 'Nearest', person: 'Follows the person' };
const WALL_EASE = 0.15;   // (the easing's time constant, s: there in about 0.4 s)
// list: [{ a: [x, z], b: [x, z], y0, y1, n: [nx, nz] }] in the scene's frame; mid: the walls' middle; ref: the point in
// the room taken for these walls when their middle is on a wall's line (null: none needed); src: 'xr', 'fake' or '';
// seen: the planes and their change times last frame (a change reads them again); t: when they were read last
const WALLS = { list: [], mid: [0, 0], ref: null, src: '', seen: [], ns: 0, dirty: false, t: 0, n: 0, fake: null };
const _wlm = new THREE.Matrix4(), _wli = new THREE.Matrix4(), _wlv = new THREE.Vector3(), _wlq = new THREE.Quaternion(), _wls = new THREE.Vector3(1, 1, 1);
const wallSem = o => { try { return String(o.semanticLabel || '').toLowerCase(); } catch (e) { return ''; } };
// a session feature on? (an older browser does not say: try it, and catch)
function wallFeature(f) {
  const ef = XR.session && XR.session.enabledFeatures;
  if (!ef) return true;
  try { return Array.from(ef).indexOf(f) >= 0; } catch (e) { return true; }
}
// walls given as [{ a, b, y0, y1 }] (or null: none), each a segment and its height, their normals and middle worked out
function wallsSet(list, src) {
  const L = [];
  for (const w of Array.isArray(list) ? list : []) {
    if (!w || !Array.isArray(w.a) || !Array.isArray(w.b) || ![w.a[0], w.a[1], w.b[0], w.b[1], w.y0, w.y1].every(fin)) continue;
    if (Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) < 0.2 || w.y1 <= w.y0) continue;
    L.push({ a: [w.a[0], w.a[1]], b: [w.b[0], w.b[1]], y0: w.y0, y1: w.y1, n: [0, 0] });
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const w of L) for (const p of [w.a, w.b]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  let mx = L.length ? (x0 + x1) / 2 : 0, mz = L.length ? (z0 + z1) / 2 : 0;
  const sig = JSON.stringify(L.map(w => [w.a, w.b, w.y0, w.y1].flat().map(v => Math.round(v * 1000))));
  // (how far (x, z) is off wall w's line, on the side of its normal (nx, nz))
  const side = (w, x, z, nx, nz) => (x - (w.a[0] + w.b[0]) / 2) * nx + (z - (w.a[1] + w.b[1]) / 2) * nz;
  // a point in the room for when the walls' middle is on a wall's line (one wall, or one wall in pieces, early in a
  // room scan, where its normal would keep whichever way the plane's pose gave): the head as these walls were first
  // read (it is in the room), else the scene's origin; kept while the walls stay the same (never walking with the head)
  let ref = null;
  const refAt = () => ref || (ref = sig === WALLS.sig && WALLS.ref ? WALLS.ref : (h => (h ? [h.x, h.z] : [0, 0]))(headPoint(_wlv)));
  if (L.length && L.every(w => { const l = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]); return Math.abs(side(w, mx, mz, -(w.b[1] - w.a[1]) / l, (w.b[0] - w.a[0]) / l)) < 0.1; })) [mx, mz] = refAt();
  for (const w of L) {
    // (its normal along the floor, turned towards the walls' middle, or that point in the room when the middle is on
    // its line; both on it: as the plane's pose gave it)
    const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], l = Math.hypot(dx, dz);
    let nx = -dz / l, nz = dx / l, sd = side(w, mx, mz, nx, nz);
    if (Math.abs(sd) < 0.05) sd = side(w, ...refAt(), nx, nz);
    if (sd < -0.05) { nx = -nx; nz = -nz; }
    w.n = [nx, nz];
  }
  if (sig !== WALLS.sig) WALLS.n++;   // (the walls changed: how many times, for tests)
  WALLS.sig = sig; WALLS.list = L; WALLS.mid = [mx, mz]; WALLS.ref = ref; WALLS.src = L.length ? src : '';
}
// pretend walls (tests): [{ a: [x, z], b: [x, z], y0, y1 }] in the scene's frame; null gives the headset's own back
function wallsFake(list) {
  WALLS.fake = list ? list : null;
  wallsSet(list || [], list ? 'fake' : '');
  return wallsInfo();
}
// each frame of an AR session (xrBegin, with the frame and the renderer's reference space): the vertical planes into
// the scene's frame, when they changed and at most twice a second (once a second besides); none outside AR
function wallsXR(frame, ref) {
  if (WALLS.fake) return;
  if (!XR.on || XR.clear || !frame || !ref || !wallFeature('plane-detection')) { if (WALLS.src === 'xr') wallsSet([], ''); return; }
  let planes = null;
  try { planes = frame.detectedPlanes; } catch (e) { planes = null; }   // (Chromium throws when the feature is off)
  if (!planes || typeof planes.forEach !== 'function') return;
  const S = WALLS.seen;
  WALLS.ns = 0;
  planes.forEach(pl => {
    const k = WALLS.ns, t = pl.lastChangedTime || 0;
    if (S[k] !== pl || S[k + 1] !== t) { S[k] = pl; S[k + 1] = t; WALLS.dirty = true; }
    WALLS.ns = k + 2;
  });
  if (S.length !== WALLS.ns) { S.length = WALLS.ns; WALLS.dirty = true; }
  const now = performance.now();
  if (!(WALLS.dirty || now - WALLS.t > 1000) || now - WALLS.t < 500) return;
  WALLS.dirty = false; WALLS.t = now;
  GL.world.updateMatrixWorld(true);
  _wli.copy(GL.world.matrixWorld).invert();
  const out = [];
  planes.forEach(pl => {
    const lab = wallSem(pl);
    let vert = false, poly = null, pose = null;
    try { vert = pl.orientation === 'vertical' || lab === 'wall'; poly = pl.polygon; pose = frame.getPose(pl.planeSpace, ref); } catch (e) { return; }
    if (!vert || lab === 'door' || !poly || poly.length < 2 || !pose) return;
    const P = pose.transform.position, Q = pose.transform.orientation;
    _wlm.compose(_wlv.set(P.x, P.y, P.z), _wlq.set(Q.x, Q.y, Q.z, Q.w), _wls).premultiply(_wli);
    // (its normal is its space's +y; the segment between its polygon's two extreme points along the wall)
    const n = _wlv.set(0, 1, 0).transformDirection(_wlm), ux = n.z, uz = -n.x, ul = Math.hypot(ux, uz);
    if (ul < 0.5) return;   // (a wall leaning more than 60 degrees: not one)
    const pts = Array.from(poly, p => new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(_wlm));
    let cx = 0, cz = 0, s0 = Infinity, s1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { cx += p.x / pts.length; cz += p.z / pts.length; y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    for (const p of pts) { const s = ((p.x - cx) * ux + (p.z - cz) * uz) / ul; s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
    out.push({ a: [cx + ux / ul * s0, cz + uz / ul * s0], b: [cx + ux / ul * s1, cz + uz / ul * s1], y0, y1 });
  });
  wallsSet(out, 'xr');
}
// the point of segment w nearest (x, z), and how far
function wallNear(w, x, z) {
  const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], u = clamp(((x - w.a[0]) * dx + (z - w.a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
  const px = w.a[0] + dx * u, pz = w.a[1] + dz * u;
  return { w, x: px, z: pz, d: Math.hypot(px - x, pz - z) };
}
// the walls' point nearest (x, z): { w, x, z, d }, or null with no walls
function wallsNearest(x, z) {
  let best = null;
  for (const w of WALLS.list) { const h = wallNear(w, x, z); if (!best || h.d < best.d - 1e-9) best = h; }
  return best;
}
// the first wall a ray from the walls' middle along (dx, dz) meets ({ w, x, z }), else the walls' point nearest where it
// points from there (an open side)
function wallsAlong(dx, dz) {
  const [cx, cz] = WALLS.mid, l = Math.hypot(dx, dz);
  if (l < 1e-6) { dx = 0; dz = -1; } else { dx /= l; dz /= l; }
  let best = null;
  for (const w of WALLS.list) {
    const ex = w.b[0] - w.a[0], ez = w.b[1] - w.a[1], den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const ax = w.a[0] - cx, az = w.a[1] - cz, t = (ax * ez - az * ex) / den, u = (ax * dz - az * dx) / den;
    if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 && (!best || t < best.t)) best = { w, x: cx + dx * t, z: cz + dz * t, t };
  }
  return best || wallsNearest(cx + dx * 50, cz + dz * 50);
}
// how it stands at its placed pose: its middle (into M), its front's turn about the vertical (yaw), how far its back is
// behind its middle along its front (back) and its half height (hh), from its own box (an object's model's, a shape's
// unit box, an empty's point), so turned about the vertical its back meets the wall
const _wbc = new THREE.Vector3(), _wbh = new THREE.Vector3(), _wbm = new THREE.Matrix4(), _wbv = new THREE.Vector3(), _wbf = new THREE.Vector3();
function wallStand(it, M) {
  const H = it.holder, Mp = _wbm.compose(H.position, H.quaternion, H.scale);
  if (it.kind === 'o' && it.model) { _wbc.copy(it.proxy.position); _wbh.copy(it.proxy.scale).multiplyScalar(0.5); }
  else if (it.kind === 'p') { _wbc.set(0, 0, 0); _wbh.set(0.5, 0.5, it.rec.shape === 'plane' ? 0 : 0.5); }
  else { _wbc.set(0, 0, 0); _wbh.set(0, 0, 0); }
  M.copy(_wbc).applyMatrix4(Mp);
  _wbf.set(0, 0, 1).transformDirection(Mp);
  const fl = Math.hypot(_wbf.x, _wbf.z), fx = fl > 1e-3 ? _wbf.x / fl : 0, fz = fl > 1e-3 ? _wbf.z / fl : 1;
  let back = 0, hh = 0;
  for (let k = 0; k < 8; k++) {
    _wbv.set(_wbc.x + (k & 1 ? 1 : -1) * _wbh.x, _wbc.y + (k & 2 ? 1 : -1) * _wbh.y, _wbc.z + (k & 4 ? 1 : -1) * _wbh.z).applyMatrix4(Mp).sub(M);
    back = Math.max(back, -(_wbv.x * fx + _wbv.z * fz)); hh = Math.max(hh, Math.abs(_wbv.y));
  }
  return { yaw: Math.atan2(fx, fz), back, hh };
}
// where it wants to be on the wall hit h ({ w, x, z }): a move (tx, ty, tz) of its middle and a turn d about the vertical
// through it, from its placed pose
function wallWant(b, h, M0, st) {
  const w = h.w, g = b.gap === undefined ? BEH_NUM.gap.d : b.gap, off = g + st.back;
  const lo = w.y0 + st.hh, hi = w.y1 - st.hh, y = hi >= lo ? clamp(M0.y, lo, hi) : lo;   // (too tall for it: standing on its bottom)
  return { tx: h.x + w.n[0] * off - M0.x, ty: y - M0.y, tz: h.z + w.n[1] * off - M0.z, d: wrapA(Math.atan2(w.n[0], w.n[1]) - st.yaw), w: WALLS.list.indexOf(w) };
}
// each frame (behOne): where it is on the walls now, eased there (a person's: along there at most its speed)
const _wM0 = new THREE.Vector3();
function wallOne(it, b, B, hs, dt) {
  const st = wallStand(it, _wM0), M0 = _wM0;
  let v = null, cap = Infinity;
  B.who = '';
  if (WALLS.list.length) {
    if (b.at === 'person') {
      const who = behChoose(b, B, hs, _beM2.set(M0.x + (B.tx || 0), M0.y, M0.z + (B.tz || 0))), hd = who ? hs.find(x => x.id === who) : null;
      B.who = who;
      if (hd) { v = wallWant(b, wallsNearest(hd.p.x, hd.p.z), M0, st); cap = b.speed * dt; }
    }
    if (!v) v = wallWant(b, b.at === 'nearest' ? wallsNearest(M0.x, M0.z) : wallsAlong(M0.x, M0.z), M0, st);
  }
  if (!v) v = { tx: 0, ty: 0, tz: 0, d: 0, w: -1 };
  // (eased: about 0.4 s; along the floor at most its speed while it follows a person)
  const k = dt > 0 ? 1 - Math.exp(-dt / WALL_EASE) : 0, ex = v.tx - B.tx, ez = v.tz - B.tz, e = Math.hypot(ex, ez);
  if (e < 1e-4) { B.tx = v.tx; B.tz = v.tz; } else { const s = Math.min(cap, e * k); B.tx += ex / e * s; B.tz += ez / e * s; }
  B.ty = Math.abs(v.ty - B.ty) < 1e-4 ? v.ty : B.ty + (v.ty - B.ty) * k;
  const ed = wrapA(v.d - B.d);
  B.d = Math.abs(ed) < 1e-4 ? wrapA(v.d) : wrapA(B.d + ed * k);
  B.wall = v.w; B.src = v.w >= 0 ? 'wall' : 'home';
  B.on = Math.hypot(B.tx, B.ty, B.tz) > 1e-4 || Math.abs(B.d) > 1e-4;
}
// for tests and the console (STUDIO.walls): the walls here, their middle and where they come from
function wallsInfo() {
  return { src: WALLS.src, n: WALLS.n, mid: WALLS.mid.map(r3), list: WALLS.list.map(w => ({ a: w.a.map(r3), b: w.b.map(r3), y0: r3(w.y0), y1: r3(w.y1), n: w.n.map(r3) })) };
}
// the card's rows for one on a wall (behaveBlocks, page and headset alike): which wall, its gap, and for a person who it
// reacts to, how far and how fast; a line on the walls this device has now
function wallBlocks(it, b, B, dis, num) {
  const g = b.gap === undefined ? BEH_NUM.gap.d : b.gap, n = WALLS.list.length, st = BEH.st.get(it.id);
  B.push({ label: 'Which wall', row: WALL_AT.map(k => ({ id: 'bwall:' + k, label: WALL_AT_WORD[k], act: 'i:bwall', v: k, on: b.at === k, dis })) },
    { label: 'Gap from the wall: ' + (g ? cmOrM(g) : 'none'), row: [{ id: 'bgap:-', label: 'Less', act: 'i:bnum', v: 'gap:-1', dis }, { id: 'bgap:+', label: 'More', act: 'i:bnum', v: 'gap:1', dis }] });
  if (b.at === 'person') {
    B.push({ label: 'Reacts to', row: [{ id: 'bwho:nearest', label: 'Nearest', act: 'i:bwho', v: 'nearest', on: b.who === 'nearest', dis }, { id: 'bwho:first', label: 'First to come close', act: 'i:bwho', v: 'first', on: b.who === 'first', dis }] },
      num('range', 'Notices people within', 'Less', 'More'), num('speed', 'Moves at most', 'Slower', 'Faster'));
  }
  B.push({ p: n ? `This headset has ${n} wall${n > 1 ? 's' : ''} from its room scan` + (WALLS.src === 'fake' ? ' (pretend walls)' : '') + (st && st.wall >= 0 ? `: it stands on wall ${st.wall + 1}.` : '.')
    : 'No walls here: it stays where it is placed. In AR a headset finds its room\'s walls in its room scan (Space Setup), and it goes onto one there.', c: n ? 'muted' : 'amber' },
    { p: (b.at === 'direction' ? 'On the wall it points at from the middle of the room, in the direction it is placed from the scene\'s middle.' : b.at === 'nearest' ? 'On the wall nearest where it is placed.'
      : 'On the wall nearest the person it reacts to (' + (b.who === 'first' ? 'the first to come within range' : 'the nearest within range') + ', the same for everyone at a circle), sliding along there; with nobody, back on the wall in its direction.') +
      ' Its back against the wall, its front into the room, at its own height where the wall has room. Each headset puts it on its own room\'s walls; on a page, and in VR, it stands where it is placed.', c: 'faint' });
}
