// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). The gang
// drives on your own floor, life size: the room comes from the headset's room
// setup (plane and mesh detection), or is a virtual room round you. The side
// panel is redrawn on a canvas you point at, and labels become sprites on top
// or signs in the room. Controllers: point and pull the trigger to click, or
// at the floor to spill crumbs; the grip moves the panel; A and X do nothing
// (play and pause are on the panel). Hand tracking: point and pinch.
//#use XR _xd _xq2 _xa _xX
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
// Quest can run its room setup from the page, once a session (one that can see the room: AR; VR asks for no room scan)
const canCapture = () => XRR.kind !== 'real' && !XRR.capture && !!(XR.session && typeof XR.session.initiateRoomCapture === 'function') &&
  (xrFeature('plane-detection') || xrFeature('mesh-detection'));
function roomCapture() {
  if (!canCapture()) return;
  XRR.capture = true;
  try { const p = XR.session.initiateRoomCapture(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not now */ }
}
//#use xrRecenterAsk xrRecenter xrLifeHome xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway
//#use _xrNoWalk xrIdle compileLate xrWarm xrCards xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace
//#use xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw labelSprite labelSign dropSprite hideLabelXR
//#use placeLabelXR xrLabelH~2 xrTip~2 xrController xrLetGo buzz xrPress
// the trigger on the floor spills crumbs there
function xrPressScene(c, h) {
  if (h.kind !== 'floor' || XR.stories) return;
  c.press = { kind: 'floor' };
  if (GL.sets.robots.crumbs(h.x, h.z)) { buzz(c, 0.5, 40); crumbsOut(h.x, h.z); }
}
//#use xrRelease xrReleaseScene~2 xrGrab xrGrabScene~2 _gq carry xrCarryScene xrResize
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; c.grab = null; return; }   // (a controller gone lets go)
  c.o.setFromMatrixPosition(g.matrix);
  c.d.set(0, 0, -1).transformDirection(g.matrix);
  let hit = null, dist = 2.5;
  // panels first: they are drawn on top of everything
  XR.raycaster.set(c.o, c.d);
  const hs = XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false);
  // then the shared room's own things (its panel, the other stations, a calibration), if nearer than a panel
  const sh = HOST.collab.ray(c.i, c.o, c.d, hs.length ? hs[0].distance : Infinity);
  if (sh && sh.panel && XR[sh.panel]) { const P = XR[sh.panel]; hit = { kind: 'panel', P, x: sh.u * P.w, y: (1 - sh.v) * P.h, point: sh.point, menu: true }; dist = sh.dist; }   // (this panel in the shell's menu, its Story tab)
  else if (sh) { hit = sh; dist = sh.dist; }
  else if (xrAway()) hit = null;   // away from its station in a shared room: nothing of the story to point at
  else if (hs.length) {
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
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    if (hit.kind === 'floor') { c.dot.quaternion.setFromAxisAngle(_xX, -Math.PI / 2); c.dot.scale.setScalar(0.008 * Math.max(0.5, c.dot.position.distanceTo(XR.head))); }
    else { c.dot.lookAt(XR.head); c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head))); }
  } else c.dot.visible = false;
}

//#use _xUp xrBegin
// the room (once the head is known: a virtual room is placed round it), then the world on it
function xrPosed(frame, ref, pose) {
  if (pose) xrRoom(frame, ref);
  xrPlace();
}
//#use xrPointed xrUpdate xrExtraAlpha xrMsg xrStart xrEnterScene
// the room is read afresh in each session (the first frame with a head pose places it)
function xrOnEnter() { Object.assign(XRR, { kind: '', sig: '', t: 0, t0: 0, reset: false, capture: false, walls: 0, blocks: 0 }); }
function xrStars() {}   // (the gang's story has no stars)
//#use XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded
// back on the screen: the model living room, with you standing in it
function xrOnEnd() {
  const F = GL.sets.robots;
  if (F.room().kind !== 'model') F.setRoom(F.modelRoom());
  Object.assign(XRR, { kind: '', t0: 0, ns: 0, reset: false, move: null, capture: false, clear: null }); XRR.seen.length = 0;   // a new session finds its room afresh
  F.player(0.65, -0.3, Math.atan2(-Math.cos(-2.2), -Math.sin(-2.2)), true);
}
//#use xrSetup
