// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). The gang
// drives on your own floor, life size: the room comes from the headset's room
// setup (plane and mesh detection), or is a virtual room round you. The side
// panel is redrawn on a canvas you point at, and labels become sprites.
// Controllers: point and pull the trigger to click, or at the floor to spill
// crumbs; the grip moves the panel; A/X plays and pauses the story. Hand
// tracking: point and pinch.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from',
};
const _xd = new THREE.Vector3(), _xp = new THREE.Vector3(), _xq = new THREE.Quaternion();
const _xq2 = new THREE.Quaternion(), _xm = new THREE.Matrix4(), _xinv = new THREE.Matrix4();
const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xz = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------ scene pose --
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
const _xT = new THREE.Matrix4(), _xR = new THREE.Matrix4();
// The gang is life size, on your floor. Your own room (kind 'real') is fixed in the reference space: the world's frame
// is the reference space moved down to the floor, so the world hangs under the rig by the rig's inverse (the rig
// carries the panels and may be anchored or recentred; the real room must not move with it). A virtual room ('box',
// 'model') hangs on the rig like the flock's land: a standing eye height (1.6 m) below where your head was when the
// place was set, facing where you faced, so an anchor keeps it in place too. Views do not move it, and this never
// moves GL.rig itself.
function xrPlace() {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  const eye = 1.6;
  if (XRR.kind === 'real') {
    GL.rig.updateMatrix();
    _xR.copy(GL.rig.matrix).invert().multiply(_xT.makeTranslation(0, XRR.floorY, 0));
    _xR.decompose(GL.world.position, GL.world.quaternion, GL.world.scale);
    XR.globeBase.copy(GL.world.position);
  } else {
    GL.world.quaternion.identity();
    GL.world.scale.setScalar(1);
    GL.world.position.set(0, -eye, 0);
    XR.globeBase.set(0, -eye, 0);
  }
}

// -------------------------------------------------------------- the room --
// Your room, from the headset's room setup (WebXR plane and mesh detection; Quest labels each plane and volume):
// the floor (its outline and height), the walls (segments at floor level, with their height) and the furniture the
// robots cannot drive into (footprints and heights; tables and desks are left out, the robots go under them, and so
// is furniture raised off the floor). Read every frame but cheaply: the room is read again when the planes or meshes
// (or their lastChangedTime) change, and once a second besides (poses can move without that, and a first read may
// come before tracking has found them), at most twice a second, or at once after the reference space was reset; the
// set skips a room that has not changed, so the cleaned floor stays. Nothing found (no feature, no room setup, or
// nothing yet): a virtual room round you, the model living room in VR, a bare 4 m x 5 m box in passthrough.
// Everything goes to the set in its own frame (x and z as in the reference space, y up from the floor).
const XRR = { kind: '', t: 0, t0: 0, floorY: 0, reset: false, move: null, capture: false, seen: [], ns: 0, dirty: false, clear: null, walls: 0, blocks: 0 };
const ROOM_SKIP = new Set(['door frame', 'window frame', 'wall art', 'invisible wall face', 'global mesh']);
const ROOM_BLOCK = new Set(['couch', 'storage', 'bed', 'other']);
const ROOM_UNDER = new Set(['table', 'desk']);   // the robots go under these
const BOX_ROOM = { kind: 'box', floor: [[-2, -2.5], [2, -2.5], [2, 2.5], [-2, 2.5]] };   // 4 m x 5 m round you, the long side ahead
const _rm = new THREE.Matrix4(), _rv = new THREE.Vector3(), _rq = new THREE.Quaternion(), _rs = new THREE.Vector3(1, 1, 1);
const semantic = o => { try { return String(o.semanticLabel || '').toLowerCase(); } catch (e) { return ''; } };
// is a feature on? (older browsers do not say: try it, and catch)
function xrFeature(f) {
  const ef = XR.session && XR.session.enabledFeatures;
  if (!ef) return true;
  try { return Array.from(ef).indexOf(f) >= 0; } catch (e) { return true; }
}
function xrDetected(frame, k) {
  try { const s = frame && frame[k]; return s && typeof s.forEach === 'function' ? s : null; } catch (e) { return null; }   // Chromium throws when the feature is off
}
function poseMatrix(frame, space, ref) {
  let pose = null;
  try { pose = space && frame.getPose(space, ref); } catch (e) { pose = null; }
  if (!pose) return null;
  const p = pose.transform.position, q = pose.transform.orientation;
  return _rm.compose(_rv.set(p.x, p.y, p.z), _rq.set(q.x, q.y, q.z, q.w), _rs);
}
function hull2(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const area2 = P => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]); return Math.abs(a) / 2; };
const inPoly2 = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
// the planes and meshes there are, with their lastChangedTime, kept in place (no strings or closures each frame)
function xrSeen(o) {
  const L = XRR.seen, k = XRR.ns, t = o.lastChangedTime || 0;
  if (L[k] !== o || L[k + 1] !== t) { L[k] = o; L[k + 1] = t; XRR.dirty = true; }
  XRR.ns = k + 2;
}
// the reference space was reset (a recentre): the room comes again in new coordinates; the event's transform (where
// the new origin is in the old coordinates) tells the set how to carry the gang along
function xrOnReset(ev) {
  XR.needRecenter = true; XRR.reset = true;
  try { XRR.move = ev && ev.transform ? Array.from(ev.transform.inverse.matrix) : null; } catch (e) { XRR.move = null; }
}
function xrRoom(frame, ref) {
  const now = performance.now();
  if (!XRR.t0) XRR.t0 = now;
  const planes = xrFeature('plane-detection') ? xrDetected(frame, 'detectedPlanes') : null;
  const meshes = xrFeature('mesh-detection') ? xrDetected(frame, 'detectedMeshes') : null;
  XRR.ns = 0;
  if (planes) planes.forEach(xrSeen);
  if (meshes) meshes.forEach(xrSeen);
  if (XRR.seen.length !== XRR.ns) { XRR.seen.length = XRR.ns; XRR.dirty = true; }
  if (XRR.clear !== XR.clear) { XRR.clear = XR.clear; XRR.dirty = true; }
  const again = XRR.ns > 0 && now - XRR.t > 1000;   // planes there: look again once a second
  if (!XRR.dirty && !XRR.reset && !again) return;
  if (XRR.kind && !XRR.reset && now - XRR.t < 500) return;   // at most twice a second
  const wasReset = XRR.reset, F = GL.sets.robots;
  XRR.t = now; XRR.reset = false; XRR.dirty = false;
  // after a recentre your own room's robots, piles and cleaned floor move with the coordinates (or, not knowing
  // how they moved, the robots start again from the dock once the room is read)
  let redock = false;
  if (wasReset && XRR.kind === 'real') { const m = XRR.move; if (m) F.shift(m[0], m[2], m[12], m[14]); else redock = true; }
  XRR.move = null;
  const room = (planes || meshes) && ref ? xrReadRoom(frame, ref, planes, meshes) : null;
  if (room) {
    if (XRR.kind !== 'real' || Math.abs(room.floorY - XRR.floorY) > 0.01) XRR.floorY = room.floorY;   // no millimetre jitter
    XRR.kind = 'real';
    F.setRoom(room);
    if (redock) F.shift(null);
    XRR.walls = room.walls.length; XRR.blocks = room.blocks.length;   // what the headset found (not the walls made from the floor)
  } else if (XRR.kind === 'real' && !wasReset) {
    // the planes went missing for a moment (tracking): keep the room we had, it is still where it was
  } else {
    const kind = XR.clear ? 'model' : 'box';
    if (XRR.kind !== kind && (kind === 'box' || F.room().kind !== 'model')) F.setRoom(kind === 'model' ? F.modelRoom() : BOX_ROOM);
    XRR.kind = kind; XRR.walls = XRR.blocks = 0;
  }
}
// the room in the set's frame, or null when there is not enough of it (no floor, and fewer than two walls)
function xrReadRoom(frame, ref, planes, meshes) {
  const P = [];
  if (planes) planes.forEach(pl => {
    const lab = semantic(pl);
    if (ROOM_SKIP.has(lab)) return;
    let poly = null;
    try { poly = pl.polygon; } catch (e) { poly = null; }
    if (!poly || poly.length < 3) return;
    const M = poseMatrix(frame, pl.planeSpace, ref);
    if (!M) return;
    const pts = Array.from(poly, p => _rv.set(p.x, p.y, p.z).applyMatrix4(M).toArray());
    const n = _rv.set(0, 1, 0).transformDirection(M).toArray();   // the plane's normal is its space's +y
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const hor = pl.orientation === 'horizontal' || (pl.orientation !== 'vertical' && Math.abs(n[1]) > 0.8);
    P.push({ lab, hor, n, pts, y0, y1, xz: pts.map(p => [p[0], p[2]]) });
  });
  const headY = XR.head.y;
  // the floor: the plane labelled so (the largest), else the lowest large plane facing up, over a metre below your head
  let fl = null;
  for (const p of P) if (p.hor && p.lab === 'floor' && (!fl || area2(p.xz) > area2(fl.xz))) fl = p;
  if (!fl) for (const p of P) if (p.hor && !p.lab && p.n[1] > 0.7 && p.y1 < headY - 1 && area2(p.xz) > 1 && (!fl || p.y0 < fl.y0)) fl = p;
  // the walls: labelled so, or unlabelled vertical planes taller than 1.5 m
  const W = P.filter(p => !p.hor && (p.lab === 'wall' || (!p.lab && p.y1 - p.y0 > 1.5)));
  const floorY = fl ? fl.pts.reduce((a, q) => a + q[1], 0) / fl.pts.length : W.length ? Math.min(...W.map(w => w.y0)) : headY - 1.6;
  const walls = [];
  for (const w of W) {
    // the segment between the polygon's two extreme points along the wall, at floor level
    const ux = w.n[2], uz = -w.n[0], ul = Math.hypot(ux, uz);
    if (ul < 1e-3) continue;
    let cx = 0, cz = 0, s0 = Infinity, s1 = -Infinity;
    for (const q of w.xz) { cx += q[0] / w.xz.length; cz += q[1] / w.xz.length; }
    for (const q of w.xz) { const s = ((q[0] - cx) * ux + (q[1] - cz) * uz) / ul; s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
    if (s1 - s0 < 0.2) continue;
    walls.push([cx + ux / ul * s0, cz + uz / ul * s0, cx + ux / ul * s1, cz + uz / ul * s1, Math.max(0.5, w.y1 - floorY)]);
  }
  let floor = fl ? fl.xz : [];
  if (!fl) {
    if (walls.length < 2) return null;
    floor = hull2(walls.flatMap(w => [[w[0], w[1]], [w[2], w[3]]]));
    if (floor.length < 3 || area2(floor) < 1) return null;
  }
  const fa = area2(floor), blocks = [];
  // furniture from detected volumes: their footprint's hull and their top above the floor (none huge, none taller than 2.2 m)
  if (meshes) meshes.forEach(m => {
    const lab = semantic(m);
    if (ROOM_SKIP.has(lab) || ROOM_UNDER.has(lab)) return;
    let v = null;
    try { v = m.vertices; } catch (e) { v = null; }
    if (!v || v.length < 9 || v.length > 6000) return;
    const M = poseMatrix(frame, m.meshSpace, ref);
    if (!M) return;
    const xz = [];
    let top = -Infinity, bot = Infinity;
    for (let i = 0; i + 2 < v.length; i += 3) { _rv.set(v[i], v[i + 1], v[i + 2]).applyMatrix4(M); xz.push([_rv.x, _rv.z]); top = Math.max(top, _rv.y - floorY); bot = Math.min(bot, _rv.y - floorY); }
    const poly = hull2(xz);
    if (poly.length < 3 || top < 0.05 || top > 2.2 || area2(poly) > fa / 3) return;
    blocks.push({ poly, h: top, under: bot > 0.12 ? bot : 0, label: lab || 'other' });   // raised (a wall shelf, a screen): robots pass under
  });
  // furniture from labelled horizontal planes (seats, cupboards, beds), unless a volume has it already
  for (const p of P) {
    if (!p.hor || p === fl || !ROOM_BLOCK.has(p.lab)) continue;
    const top = p.pts.reduce((a, q) => a + q[1], 0) / p.pts.length - floorY;
    if (top < 0.05 || top > 1.3) continue;
    const cx = p.xz.reduce((a, q) => a + q[0], 0) / p.xz.length, cz = p.xz.reduce((a, q) => a + q[1], 0) / p.xz.length;
    if (blocks.some(b => inPoly2(b.poly, cx, cz))) continue;
    blocks.push({ poly: p.xz, h: top, label: p.lab });
  }
  return { kind: 'real', floor, walls, blocks, floorY };
}
// what the panel says about the room
function roomLine() {
  if (XRR.kind === 'real') {
    const w = XRR.walls, b = XRR.blocks;
    return `Your room: floor, ${w ? w + ' wall' + (w === 1 ? '' : 's') : 'no walls found (its edges hold)'}, ${b} piece${b === 1 ? '' : 's'} of furniture`;
  }
  if (!XRR.kind) return '';
  if ((xrFeature('plane-detection') || xrFeature('mesh-detection')) && performance.now() - XRR.t0 < 4000) return 'Finding your room …';
  return 'No room setup found: a virtual room round you';
}
// Quest can run its room setup from the page, once a session
const canCapture = () => XRR.kind !== 'real' && !XRR.capture && !!(XR.session && typeof XR.session.initiateRoomCapture === 'function');
function roomCapture() {
  if (!canCapture()) return;
  XRR.capture = true;
  try { const p = XR.session.initiateRoomCapture(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not now */ }
}
function xrRecenter() {
  XR.globeOff.set(0, 0, 0);
  if (XR.panelGroup) { XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.set(0, XR.panelHome.yaw, 0); }
  // anchored: the scene and the panel go back where they were saved with the place
  const s = HOST.anchor.saved();
  if (s) { XR.globeOff.fromArray(s.off); if (XR.panelGroup) { XR.panelGroup.position.fromArray(s.pp); XR.panelGroup.rotation.set(0, s.pr, 0); } }
  const yaw = new THREE.Euler().setFromQuaternion(XR.headQ, 'YXZ').y;
  GL.rig.position.copy(XR.head);
  GL.rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ---------------------------------------------------------------- labels --
const LBL_STYLE = { '': ['#f2f6fc', null], mag: ['#ffd2f4', '#ff5ad9'], amb: ['#ffe2b0', '#ffb43b'],
  grn: ['#c9ffe3', '#3ee08f'], cyn: ['#d2f6ff', '#46d9ff'], tip: ['#e7eef8', '#46d9ff'] };
function labelSprite(L) {
  if (L.sprite) return L.sprite;
  let bold, rest, cls;
  if (L.txt) [bold, rest, cls] = L.txt;
  else {
    const b = L.el.querySelector('b');
    bold = b ? b.textContent : ''; rest = L.el.textContent.slice(bold.length).trim();
    cls = ['mag', 'amb', 'grn', 'cyn'].find(k => L.el.classList.contains(k)) || '';
  }
  const px = 34, H = 56, pad = 16, gap = bold && rest ? 10 : 0;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  ctx.font = vfont(px, 700); const wb = bold ? ctx.measureText(bold).width : 0;
  ctx.font = vfont(px); const wr = rest ? ctx.measureText(rest).width : 0;
  cv.width = Math.ceil(pad * 2 + wb + gap + wr); cv.height = H;
  const [col, acc] = LBL_STYLE[cls] || LBL_STYLE[''];
  ctx.save(); rr(ctx, 0, 0, cv.width, H, 8); ctx.clip();
  ctx.fillStyle = cls === 'tip' ? 'rgba(10,19,34,0.97)' : 'rgba(3,8,16,0.82)'; ctx.fillRect(0, 0, cv.width, H);
  if (acc) { ctx.fillStyle = acc; ctx.fillRect(0, 0, 5, H); }
  ctx.restore();
  ctx.textBaseline = 'middle'; ctx.fillStyle = col;
  ctx.font = vfont(px, 700); ctx.fillText(bold, pad, H / 2 + 1);
  ctx.font = vfont(px); ctx.fillText(rest, pad + wb + gap, H / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.renderOrder = cls === 'tip' ? 11 : 10;
  sp.userData.aspect = cv.width / H;
  sp.center.set(-0.35 / sp.userData.aspect, 0.5);
  GL.world.add(sp);
  return (L.sprite = sp);
}
function dropSprite(L) {
  const sp = L && L.sprite;
  if (!sp) return;
  if (sp.parent) sp.parent.remove(sp);
  sp.material.map.dispose(); sp.material.dispose();
  L.sprite = null;
}
function placeLabelXR(L, alpha, S) {
  if (alpha <= 0.001) { if (L.sprite) L.sprite.visible = false; return; }
  const sp = labelSprite(L), o = alpha;
  sp.visible = o > 0.01;
  sp.material.opacity = o;
  labelPos(L, sp.position);
  const hm = 0.021 * Math.max(1, sp.position.distanceTo(XR.camLocal));   // the same size to the eye, near or far
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
}
function xrTip() {}

// ----------------------------------------------------------- controllers --
function xrController(i) {
  const g = GL.renderer.xr.getController(i);
  const c = { i, g, src: null, hover: null, press: null, grab: null, wantPress: false, b4: false, o: new THREE.Vector3(), d: new THREE.Vector3() };
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  c.ray = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
  c.ray.renderOrder = 60;
  g.add(c.ray);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  g.add(tip);
  c.dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  c.dot.renderOrder = 61; c.dot.visible = false;
  GL.scene.add(c.dot);
  g.visible = false;
  g.addEventListener('connected', e => { c.src = e.data; c.ray.visible = e.data.targetRayMode !== 'screen'; });
  g.addEventListener('disconnected', () => { c.src = null; c.press = null; c.grab = null; c.hover = null; c.wantPress = false; c.dot.visible = false; });
  // presses are handled on the next frame, once the ray has its fresh pose
  g.addEventListener('selectstart', () => { c.wantPress = true; });
  g.addEventListener('selectend', () => { if (c.wantPress) { c.wantPress = false; xrPress(c); } xrRelease(c); });
  g.addEventListener('squeezestart', () => xrGrab(c, true));
  g.addEventListener('squeezeend', () => xrGrab(c, false));
  GL.scene.add(g);
  XR.ctrls.push(c);
}
function buzz(c, s, ms) {
  try {
    const a = c.src && c.src.gamepad && c.src.gamepad.hapticActuators;
    if (a && a[0] && a[0].pulse) a[0].pulse(s || 0.3, ms || 18);
  } catch (e) { /* no haptics */ }
}
function xrPress(c) {
  const h = c.hover;
  c.press = null;
  if (!h) return;
  if (h.kind === 'panel') {
    const r = h.P.at(h.x, h.y);
    if (!r) return;
    c.press = { kind: 'panel', P: h.P, id: r.id, r };
    if (r.drag) { r.drag(h.x, h.y); buzz(c, 0.2, 12); }
  } else if (h.kind === 'floor' && !XR.stories) {   // the trigger on the floor spills crumbs there
    c.press = { kind: 'floor' };
    if (GL.sets.robots.crumbs(h.x, h.z)) buzz(c, 0.5, 40);
  }
}
function xrRelease(c) {
  const p = c.press;
  c.press = null;
  if (!p) return;
  if (p.kind === 'panel') {
    if (p.r.drag) return;
    const h = c.hover;
    if (h && h.kind === 'panel' && h.P === p.P) {
      const r = h.P.at(h.x, h.y);
      if (r && r.id === p.id && r.fn) { buzz(c); r.fn(); }
    }
  }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || HOST.anchor.locked()) return; // the Stories screen stays put, and so does an anchored place
  if (h.kind !== 'panel') return;   // the room stays where it is: only the panel moves
  const p0 = XR.panelGroup.getWorldPosition(new THREE.Vector3());
  c.grab = { target: 'panel', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1 };
  buzz(c, 0.4, 25);
}
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  const lenMax = 4;
  if (_gv.length() > lenMax) _gv.setLength(lenMax);
  _gv.applyQuaternion(_gq).add(c.o);
  GL.rig.worldToLocal(_gv);
  if (G.target === 'globe') XR.globeOff.copy(_gv).sub(XR.globeBase);
  else {
    XR.panelGroup.position.copy(_gv);
    GL.rig.worldToLocal(_gh.copy(XR.head));
    XR.panelGroup.rotation.set(0, Math.atan2(_gh.x - _gv.x, _gh.z - _gv.z), 0); // keep it upright, facing you
  }
}
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; return; }
  c.o.setFromMatrixPosition(g.matrix);
  c.d.set(0, 0, -1).transformDirection(g.matrix);
  let hit = null, dist = 2.5;
  // panels first: they are drawn on top of everything
  XR.raycaster.set(c.o, c.d);
  const hs = XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false);
  if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories && GL.world.visible) {
    // the floor: where the ray meets it, in the set's frame (the dot lies on the floor there)
    const F = GL.sets.robots;
    _sm.copy(F.group.matrixWorld).invert();
    const fp = F.floorPoint(_xa.copy(c.o).applyMatrix4(_sm).toArray(), _xb.copy(c.d).transformDirection(_sm).toArray());
    if (fp) {
      const w = F.group.localToWorld(_xc.set(fp[0], 0.005, fp[1]));
      hit = { kind: 'floor', x: fp[0], z: fp[1], point: w.clone() };
      dist = w.distanceTo(c.o);
    }
  }
  c.hover = hit;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // A/X: play or pause the story
  const gp = c.src.gamepad;
  if (gp) {
    const b4 = !!(gp.buttons[4] && gp.buttons[4].pressed);
    if (b4 && !c.b4 && APP.mode === 'story') APP.togglePlay();
    c.b4 = b4;
  }
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    if (hit.kind === 'floor') { c.dot.quaternion.setFromAxisAngle(_xX, -Math.PI / 2); c.dot.scale.setScalar(0.008 * Math.max(0.5, c.dot.position.distanceTo(XR.head))); }
    else { c.dot.lookAt(XR.head); c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head))); }
  } else c.dot.visible = false;
}

// ---------------------------------------------------------------- frames --
const _xUp = new THREE.Vector3(0, 1, 0);
function xrBegin(frame, dt) {
  const ref = GL.renderer.xr.getReferenceSpace();
  const pose = frame && ref ? frame.getViewerPose(ref) : null;
  if (pose) {
    const p = pose.transform.position, q = pose.transform.orientation;
    XR.head.set(p.x, p.y, p.z); XR.headQ.set(q.x, q.y, q.z, q.w);
    if (XR.needRecenter) { if (!HOST.anchor.held()) xrRecenter(); XR.needRecenter = false; } // an anchored place stays put
    // anchored: the spot in the room carries the frame that holds the panels, the Stories screen and the scene
    // (asked only once the headset has a pose, so a new anchor goes where things really are)
    const A = HOST.anchor.frame(frame, ref);
    if (A) { GL.rig.position.fromArray(A.p); GL.rig.quaternion.setFromAxisAngle(_xUp, A.yaw); }
    // the room (once the head is known: a virtual room is placed round it), then the world on it
    xrRoom(frame, ref);
  }
  xrPlace();
  const bl = XR.session && XR.session.renderState.baseLayer;
  if (bl) {
    if (bl.framebufferHeight) XR.viewH = bl.framebufferHeight;
    if (!XR.fov) {
      XR.fov = true;
      try { if ('fixedFoveation' in bl) bl.fixedFoveation = 0.5; } catch (e) { /* not supported */ }
    }
  }
  GL.rig.updateMatrixWorld(true);
  _xinv.copy(GL.world.matrixWorld).invert();
  for (const c of XR.ctrls) xrPoint(c, dt);
  for (const P of XR.panels) {
    let hv = null;
    for (const c of XR.ctrls) {
      if (c.hover && c.hover.kind === 'panel' && c.hover.P === P) { const r = P.at(c.hover.x, c.hover.y); if (r) hv = r.id; }
    }
    P.hover = hv;
  }
}
function xrUpdate(S) {
  // the Stories screen replaces the story's panels and hides the story
  const land = !!XR.stories;
  if (XR.land) {
    // Sound check takes the place of the story cards while it is open
    for (const P of XR.land) P.mesh.visible = land && (P === XR.land[0] || !XR.soundCheck);
    XR.snd.mesh.visible = land && !!XR.soundCheck;
    XR.main.mesh.visible = XR.foot.mesh.visible = !land;
  }
  GL.world.visible = !land;
  if (land !== XR.landShown) { XR.landShown = land; HOST.setUrl(land); }
  GL.rig.updateMatrixWorld(true);
  XR.camLocal.copy(XR.head);
  GL.world.worldToLocal(XR.camLocal);
  const story = APP.mode === 'story';
  for (const L of ST.labels) {
    if (story) placeLabelXR(L, fadeVal(storyT(APP.t), L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0), S);
    else if (L.sprite) L.sprite.visible = false;
  }
  for (const L of LBL.sets) placeLabelXR(L, setLabelAlpha(L, S), S);
  for (const L of LBL.extra) {
    if (!story) placeLabelXR(L, 1, S);
    else if (L.sprite) L.sprite.visible = false;
  }
  xrTip(S);
  const now = performance.now();
  for (const P of XR.panels) panelTick(P, now);
}

// --------------------------------------------------------------- session --
function xrMsg(text) {
  const el = $('#xrmsg');
  el.textContent = text; el.style.display = 'block';
  clearTimeout(xrMsg.t);
  xrMsg.t = setTimeout(() => { el.style.display = 'none'; }, 6000);
}
async function xrStart(mode) {
  if (XR.session || !navigator.xr) return;
  let session;
  try {
    session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'hand-tracking', 'anchors', 'plane-detection', 'mesh-detection'] });
  } catch (err) {
    HOST.landingVR = false;
    xrMsg(`Could not start ${mode === 'immersive-ar' ? 'AR' : 'VR'}: ${err && err.message ? err.message : err}`);
    return;
  }
  XR.session = session; XR.mode = mode;
  HOST.session = session; HOST.mode = mode;
  session.addEventListener('visibilitychange', xrVisibility);
  xrEnterScene();
  try {
    GL.renderer.xr.setReferenceSpaceType('local');
    await GL.renderer.xr.setSession(session);
    const ref = GL.renderer.xr.getReferenceSpace();
    if (ref && ref.addEventListener) ref.addEventListener('reset', xrOnReset);
  } catch (err) {
    console.error(err);
    xrMsg('Could not start the headset view: ' + (err && err.message ? err.message : err));
    try { await session.end(); } catch (e) { /* already ended */ }
    if (XR.on) xrEnded();
  }
}
function xrEnterScene() {
  XR.stories = false;
  XR.on = true; XR.needRecenter = true; XR.fov = false; XR.tipI = -1;
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  // the room is read afresh in each session (the first frame with a head pose places it)
  Object.assign(XRR, { kind: '', sig: '', t: 0, t0: 0, reset: false, capture: false, walls: 0, blocks: 0 });
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.o = -1;
  // every headset session starts the story from the top; entered from the start screen, it shows the Stories menu first
  const fromStart = HOST.picking || HOST.landingVR;
  HOST.landingVR = false;
  HOST.closePicker();
  if (fromStart) { APP.enterStory(0); APP.playing = false; XR.stories = true; XR.inStory = false; audioSync(); }
  else { XR.inStory = true; if (APP.mode === 'story') APP.playing = true; } // already in a story: carry on where you were
  $('#tip').style.opacity = 0;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.el.style.opacity = 0;
  if (document.fonts && !XR.fontOK) {
    Promise.all([document.fonts.load(vfont(30, 700)), document.fonts.load(vfont(30))]).then(() => {
      XR.fontOK = 1;
      [...ST.labels, ...LBL.sets, ...LBL.extra].forEach(dropSprite);
    }).catch(() => {});
  }
}
// Headset taken off (or put to sleep) for more than a few seconds: treat the next
// wearer as a new visitor. Restart the story and place everything in front of them
// (when anchored, everything stays at its spot in the room).
const XR_AWAY_MS = 3000;
function xrVisibility() {
  const v = XR.session && XR.session.visibilityState;
  if (v === 'hidden') { if (!XR.hiddenAt) XR.hiddenAt = performance.now(); }
  else if (v === 'visible' && XR.hiddenAt) {
    const away = performance.now() - XR.hiddenAt;
    XR.hiddenAt = 0;
    if (away > XR_AWAY_MS) xrFreshStart();
  }
  audioSync();
}
function xrFreshStart() {
  XR.kbd.open = false; XR.kbd.q = '';
  for (const c of XR.ctrls) { c.press = null; c.grab = null; c.wantPress = false; }
  APP.enterStory(0); APP.playing = false; audioSync();
  XR.stories = true; XR.inStory = false; XR.soundCheck = false; // a new wearer lands in the Stories screen
  XR.needRecenter = true; // uses the new wearer's head position and direction on the next frame
  lastNow = 0;
}
// a story picked inside the headset takes over the running session
function xrAdopt() {
  XR.session = HOST.session; XR.mode = HOST.mode;
  XR.session.addEventListener('visibilitychange', xrVisibility);
  XR.ctrls.forEach((c, i) => { const s = HOST.inputs[i]; if (s) { c.src = s; c.ray.visible = s.targetRayMode !== 'screen'; } });
  xrEnterScene();
  // keep the cell and the panel where they were in the story before
  const p = HOST.xrPose;
  if (p) {
    XR.needRecenter = false;
    GL.rig.position.copy(p.rp); GL.rig.quaternion.copy(p.rq);
    XR.globeOff.copy(p.off);
    XR.panelGroup.position.copy(p.pp); XR.panelGroup.rotation.set(0, p.pr, 0);
  }
  const ref = GL.renderer.xr.getReferenceSpace();
  if (ref && ref.addEventListener) ref.addEventListener('reset', xrOnReset);
}
function xrEnded() {
  if (!XR.on) return;
  XR.on = false; XR.session = null; XR.mode = null; XR.hiddenAt = 0;
  HOST.session = null;
  document.body.classList.remove('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1);
  for (const P of XR.panels) P.mesh.visible = false;
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; c.grab = null; c.hover = null; c.src = null; }
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) { if (L.sprite) L.sprite.visible = false; L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  GL.world.visible = true;
  // back on the screen: the model living room, with you standing in it
  const F = GL.sets.robots;
  if (F.room().kind !== 'model') F.setRoom(F.modelRoom());
  Object.assign(XRR, { kind: '', t0: 0, ns: 0, reset: false, move: null, capture: false, clear: null }); XRR.seen.length = 0;   // a new session finds its room afresh
  F.player(0.65, -0.3, Math.atan2(-Math.cos(-2.2), -Math.sin(-2.2)), true);
  for (const P of XR.land || []) P.mesh.visible = false;
  if (XR.snd) XR.snd.mesh.visible = false;
  XR.soundCheck = false;
  // left the headset from the Stories screen: back to the Stories screen on the page
  if (XR.stories) { XR.stories = false; HOST.openPicker(); }
  applyTheme();
  resize();
}
function xrSetup() {
  XR.raycaster = new THREE.Raycaster();
  // panel 0.62 m wide, about 40 degrees to the left and facing you
  const mw = 0.62, px = -0.56, py = 0.04, pz = -0.86, yaw = Math.atan2(-px, -pz);
  XR.main = makePanel(1024, 1200, mw, drawMain, sigMain);
  XR.foot = makePanel(1024, 176, mw, drawFoot, sigFoot);
  XR.panelGroup = new THREE.Group();
  XR.panelHome = { p: new THREE.Vector3(px, py, pz), yaw };
  XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.y = yaw;
  GL.rig.add(XR.panelGroup);
  XR.foot.mesh.position.set(0, -(mw * 1200 / 1024) / 2 - 0.012 - (mw * 176 / 1024) / 2, 0);
  for (const P of [XR.main, XR.foot]) { XR.panelGroup.add(P.mesh); XR.panels.push(P); }
  XR.panelMeshes = XR.panels.map(P => P.mesh);
  xrLandingSetup();
  for (let i = 0; i < 2; i++) xrController(i);
  GL.renderer.xr.addEventListener('sessionend', xrEnded);
  $('#btnVR').addEventListener('click', () => xrStart('immersive-vr'));
  $('#btnAR').addEventListener('click', () => xrStart('immersive-ar'));
  if (!navigator.xr) {
    if (/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent)) xrMsg('Open this page over https:// to view it in VR.');
    return;
  }
  navigator.xr.isSessionSupported('immersive-vr').then(vr => {
    if (vr) $('#btnVR').hidden = false;
    // headsets support both; phones only AR, which this layout is not made for
    return navigator.xr.isSessionSupported('immersive-ar').then(ar => { if (ar && vr) $('#btnAR').hidden = false; });
  }).catch(() => {});
}
