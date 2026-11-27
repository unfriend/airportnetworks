//#use WEBXR XR _xd _xq2 _xa _xX
// The guide stands on your floor, life size: the set's frame hangs under the rig (set from your head when the place was
// set, level), its floor the floor plane's height where the session reports planes (the plane labelled floor, the
// largest; else the lowest large plane facing up over a metre below your head; read once a second until found, kept,
// moved only if it moves more than 5 cm), else a standing eye height (1.6 m) below where your head was. The same in VR
// and AR; views do not move it, and this never moves GL.rig itself.
const XRF = { y: null, t: 0 };
function xrPlace(v) {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  const y = XRF.y === null ? -1.6 : XRF.y - GL.rig.position.y;
  GL.world.quaternion.identity();
  GL.world.scale.setScalar(1);
  GL.world.position.set(0, y, 0);
  XR.globeBase.set(0, y, 0);
}
//#use xrRecenterAsk xrRecenter xrLifeHome xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels
//#use xrRoomOnly xrAway _xrNoWalk xrIdle compileLate xrWarm xrCards xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose
//#use xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw labelSprite labelSign
//#use dropSprite hideLabelXR placeLabelXR xrLabelH~2 xrTip~2 xrController xrLetGo buzz xrPress
// the trigger on a node sends a signal from it (the target only lights while your ray is on it)
function xrPressScene(c, h) {
  if (h.kind !== 'node' || XR.stories) return;
  c.press = { kind: 'node' };
  if (sendSignal(h.id)) buzz(c, 0.5, 40);
}
//#use xrRelease xrReleaseScene~2 xrGrab xrGrabScene~2 _gq carry xrCarryScene xrResize
const _xo = new THREE.Vector3(), _xdd = new THREE.Vector3(), _xgm = new THREE.Matrix4();
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
  } else if (!XR.stories && GL.sets.guide) {
    // the guide's network and target, in the set's frame; else where the ray meets the floor (the guide's visor follows it)
    const s = GL.sets.guide;
    _xgm.copy(s.group.matrixWorld).invert();
    _xo.copy(c.o).applyMatrix4(_xgm); _xdd.copy(c.d).transformDirection(_xgm);
    const sh2 = s.hit(_xo.toArray(), _xdd.toArray());
    if (sh2) { hit = { kind: sh2.kind, id: sh2.id, point: _xp.fromArray(sh2.point).applyMatrix4(s.group.matrixWorld).clone() }; dist = c.o.distanceTo(hit.point); }
    else if (_xdd.y < -0.05) {
      const k = -_xo.y / _xdd.y;
      if (k > 0 && k < 8) { hit = { kind: 'floor', point: _xp.copy(_xdd).multiplyScalar(k).add(_xo).applyMatrix4(s.group.matrixWorld).clone() }; dist = k; }
    }
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu), or onto a node
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : hit && hit.kind === 'node' ? 'n' + hit.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    c.dot.lookAt(XR.head);
    c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head)));
  } else c.dot.visible = false;
}

//#use _xUp xrBegin
// once the head's pose is read: the floor from the session's planes (once a second until found)
function xrPosed(frame, ref, pose) {
  if (!pose || !frame || !ref) return;
  const now = performance.now();
  if (XRF.y !== null && now - XRF.t < 1000) return;
  XRF.t = now;
  let planes = null;
  try { planes = frame.detectedPlanes; } catch (e) { planes = null; }   // (Chromium throws where the feature is off)
  if (!planes || typeof planes.forEach !== 'function') return;
  const headY = XR.head.y;
  let best = null;
  planes.forEach(pl => {
    let pose2 = null, poly = null, lab = '';
    try { pose2 = frame.getPose(pl.planeSpace, ref); poly = pl.polygon; lab = String(pl.semanticLabel || '').toLowerCase(); } catch (e) { return; }
    if (!pose2 || !poly || poly.length < 3 || pl.orientation === 'vertical') return;
    const y = pose2.transform.position.y;
    let a = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.z - q.x * p.z; }
    a = Math.abs(a) / 2;
    const score = lab === 'floor' ? 1e6 + a : y < headY - 1 && a > 1 ? -y : -Infinity;
    if (score > -Infinity && (!best || score > best.s)) best = { s: score, y };
  });
  if (best && (XRF.y === null || Math.abs(best.y - XRF.y) > 0.05)) XRF.y = best.y;
}
//#use xrPointed xrUpdate xrExtraAlpha xrMsg xrStart xrOnReset xrEnterScene
// a session begins: its floor is found afresh
function xrOnEnter() { XRF.y = null; XRF.t = 0; }
// the stars in the headset: only in VR, faint (a tenth); never on the page
function xrStars(on) {
  if (on) { GL.stars.visible = XR.clear; GL.stars.material.size = 2.2; }
  else GL.stars.visible = false;
}
//#use XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded
function xrOnEnd() { XRF.y = null; }
//#use xrSetup
