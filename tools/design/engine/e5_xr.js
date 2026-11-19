// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). The table stands life size in front of you, the
// side panel is redrawn on a canvas you point at, and labels become sprites on top or signs in the scene.
// Controllers: point at a miniature to light it, pull the trigger (or pinch) to put it on the stage, and grip it to
// pick it up: it follows your hand and turns with it, both hands size it, let go it stays. The grip on the panel moves
// the panel. A and X do nothing (play and pause are on the panel).
//#use XR _xd _xq2 _xa _xX
// The table is life size: the floor under your feet (the frame hangs at your head, so the floor is a standing eye
// height below it: the reference space is 'local', so the floor is not known), the table's middle 1.55 m ahead of
// where you faced when the place was set, its near edge 40 cm in front of you; views do not move it.
const XR_EYE = 1.6, XR_AHEAD = 1.55;
function xrPlace(v) {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  GL.world.quaternion.identity();
  GL.world.scale.setScalar(1);
  GL.world.position.set(0, -XR_EYE, -XR_AHEAD);
  XR.globeBase.set(0, -XR_EYE, -XR_AHEAD);
}
//#use xrRecenterAsk xrRecenter xrLifeHome xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway
//#use _xrNoWalk xrIdle xrWarm xrCards xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace
//#use xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw labelSprite labelSign dropSprite hideLabelXR
//#use placeLabelXR xrLabelH~2 xrTip~2 xrController buzz xrPress
// the trigger (or a pinch) on a miniature puts it on the stage
function xrPressScene(c, h) {
  if (h.kind !== 'mini' || XR.stories) return;
  c.press = { kind: 'mini' };
  pickProp(h.key); buzz(c, 0.4, 30);
}
//#use xrRelease xrReleaseScene~2 xrGrab
// a miniature, picked up where it stands: it keeps its offset from the hand; the table stays where it is (only the
// panel and the miniatures move)
function xrGrabScene(c, h) {
  if (h.kind !== 'mini') return true;
  const m = GL.sets.table.mini(h.key);
  if (!m) return true;
  GL.world.updateMatrixWorld(true);
  c.grab = { target: 'mini', key: h.key, q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(), o0: c.o.clone(),
    p0: m.holder.getWorldPosition(new THREE.Vector3()), reach: 1, r0: m.holder.getWorldQuaternion(new THREE.Quaternion()) };
  GL.sets.table.carryTo(h.key, m.holder.position, m.holder.quaternion, m.s);
  setHover(h.key); buzz(c, 0.4, 25); sfxAct('grab', 'table', miniPos(h.key));   // (sound effects: picked up)
  return true;
}
// let go of a miniature (the grip up, the controller gone, or locked meanwhile): it stays where it is, unless the other
// hand still holds it
function xrLetGo(c) {
  const G = c.grab;
  c.grab = null;
  if (G && G.target === 'mini' && !XR.ctrls.some(k => k !== c && k.grab && k.grab.target === 'mini' && k.grab.key === G.key)) { GL.sets.table.drop(G.key); sfxAct('drop', 'table', miniPos(G.key)); }   // (sound effects: let go)
  else if (G && G.target === 'mini') { const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.key === G.key); if (o) xrRegrip(o); }
}
// a hand that holds a miniature alone again (the other let go) carries on from where it is now
function xrRegrip(c) {
  const G = c.grab, m = GL.sets.table.mini(G.key);
  G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.reach = 1;
  m.holder.getWorldPosition(G.p0); m.holder.getWorldQuaternion(G.r0);
}
//#use _gq carry
function xrCarryScene(c, G, dt) {
  if (G.target !== 'mini') return false;
  carryMini(c, dt);
  return true;
}
//#use xrResize
// a miniature in the hand: where the hand puts it (moving freely it turns with the hand as a real object would; else
// it stays upright, turning only about the vertical as the hand does); both hands on it size it (half to four times
// its own size) and move it with their middle
const _mq = new THREE.Quaternion(), _mi = new THREE.Quaternion(), _mv = new THREE.Vector3(), _me = new THREE.Euler();
function carryMini(c, dt) {
  const G = c.grab, T = GL.sets.table, m = T.mini(G.key), gp = c.src.gamepad;
  const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'mini' && k.grab.key === G.key && k.src && k.g.visible);
  GL.world.updateMatrixWorld(true);
  _mi.copy(GL.sets.table.group.getWorldQuaternion(_mq)).invert();
  if (o) {
    if (c.i < o.i) return;   // (once a frame, by the second hand)
    const d = c.o.distanceTo(o.o);
    _mv.copy(c.o).add(o.o).multiplyScalar(0.5);
    const W = G.two || (G.two = o.grab.two = { d0: Math.max(0.05, d), s0: m.s, m0: _mv.clone(), p0: m.holder.getWorldPosition(new THREE.Vector3()) });
    const p = W.p0.clone().add(_mv).sub(W.m0);
    T.carryTo(G.key, T.group.worldToLocal(p), m.holder.quaternion, W.s0 * d / W.d0);
    return;
  }
  if (G.two) xrRegrip(c);
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);   // the hand's turn since it took hold
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  if (_gv.length() > 4) _gv.setLength(4);
  _gv.applyQuaternion(_gq).add(c.o);
  let q;
  if (XR.free) q = _mq.copy(_gq).multiply(G.r0);
  else { _me.setFromQuaternion(_gq, 'YXZ'); q = _mq.setFromAxisAngle(_xY, _me.y).multiply(G.r0); }
  T.carryTo(G.key, T.group.worldToLocal(_gv), q.premultiply(_mi), m.s);
}
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; xrLetGo(c); return; }   // (a controller gone lets go)
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
  } else if (!XR.stories) {
    // a miniature (lit, its name shown), else the table or the floor (the dot only)
    const ms = XR.raycaster.intersectObjects(GL.sets.table.pickables(), false);
    if (ms.length) { hit = { kind: 'mini', key: ms[0].object.userData.key, point: ms[0].point.clone() }; dist = ms[0].distance; }
    else {
      const ts = XR.raycaster.intersectObjects(GL.sets.table.solid, false);
      if (ts.length) { hit = { kind: 'table', point: ts[0].point.clone() }; dist = ts[0].distance; }
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
    c.dot.lookAt(XR.head);
    c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head)));
  } else c.dot.visible = false;
}

//#use _xUp xrBegin xrPosed
// the miniature a controller points at (or holds) lights up and shows its name
function xrPointed() {
  const ch = XR.ctrls.find(c => c.grab && c.grab.target === 'mini') || XR.ctrls.find(c => c.hover && c.hover.kind === 'mini');
  setHover(ch ? (ch.grab ? ch.grab.key : ch.hover.key) : null);
}
//#use xrUpdate
function xrExtraAlpha(L) { return L.txt ? L.show : 0; }   // (the miniature pointed at and the one on the stage: when there is one)
//#use xrMsg xrStart xrOnReset xrEnterScene xrOnEnter xrStars~2 XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded
function xrOnEnd() { setHover(null); }
//#use xrSetup
