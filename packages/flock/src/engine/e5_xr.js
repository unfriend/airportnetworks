//#use WEBXR XR _xd _xq2 _xa _xX
// The flock is life size round you: the land under your feet (the frame hangs at your head, so the land is a
// standing eye height below it: the reference space is 'local', so the floor is not known), the sunset ahead of
// where you faced when the place was set; views do not move it.
function xrPlace(v) {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  const eye = 1.6;
  GL.world.quaternion.identity();
  GL.world.scale.setScalar(1);
  GL.world.position.set(0, -eye, 0);
  XR.globeBase.set(0, -eye, 0);
}
//#use xrRecenterAsk xrRecenter xrLifeHome xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels
//#use xrRoomOnly xrAway _xrNoWalk xrIdle compileLate xrWarm xrCards xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose
//#use xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw labelSprite labelSign
//#use dropSprite hideLabelXR placeLabelXR xrLabelH~2 xrTip~2 xrController xrLetGo buzz xrPress
// the trigger on the sky sends a falcon where you point
function xrPressScene(c, h) {
  if (h.kind !== 'sky' || XR.stories) return;
  c.press = { kind: 'sky' };
  _sm.copy(GL.sets.flock.group.matrixWorld).invert();
  if (sendFalcon(_xb.copy(c.d).transformDirection(_sm).toArray())) buzz(c, 0.5, 40);
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
  } else if (!XR.stories) {
    // anywhere else is the sky (the dot sits far out along the ray)
    hit = { kind: 'sky', point: _xp.copy(c.d).multiplyScalar(6).add(c.o).clone() };
    dist = 6;
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

//#use _xUp xrBegin xrPosed xrPointed xrUpdate xrExtraAlpha xrMsg xrStart xrOnReset xrEnterScene xrOnEnter xrStars~2
//#use XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded xrOnEnd xrSetup
