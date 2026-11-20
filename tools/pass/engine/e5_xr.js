//#use WEBXR XR
// where the sea has been moved with the grip (placeLife): lifeTo this headset's own, lifeSt a shared room's station's
// (the same for everyone there: collab.state()'s sea), lifeOff as drawn, easing to the one in use (seaSt)
Object.assign(XR, { lifeOff: new THREE.Vector3(), lifeTo: new THREE.Vector3(), lifeSt: new THREE.Vector3(), lifeAt: false });
// (the scene pose is the globe's and the cell's; the fish are life size round you whatever the view: their holder
// undoes it, placeLife)
//#use _xd _xq2 _xa _xX xrPlace xrPlaceLife xrCap xrRecenterAsk xrRecenter
// the sea back at your own eye height (never the station's sea)
function xrLifeHome() { XR.lifeTo.set(0, 0, 0); if (!seaSt()) XR.lifeOff.set(0, 0, 0); }
//#use xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk xrIdle xrWarm xrCards
//#use xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings LBL_STYLE labelWords
//#use labelPaint labelTex labelRedraw labelSprite labelSign dropSprite hideLabelXR placeLabelXR
// (2.1 cm tall at arm's length, the same size to the eye further off: the school's labels may be metres away)
function xrLabelH(sp) { return 0.021 * Math.max(1, sp.position.distanceTo(XR.camLocal) * XR.R) / XR.R; }
//#use xrTip _prc pickRay xrController xrLetGo buzz rayAngles startDrag dragGlobe xrPress
function xrPressScene(c, h) {
  if (h.kind === 'sea') {
    // among the fish in explore mode the trigger is the shark: held, it leads the shark where you point (Be the
    // shark); else a pull sends one that way (not while the sea is being carried)
    if (APP.mode !== 'explore' || X.scene !== 'fish' || XR.stories || seaHeld()) return;
    if (X.shark) { c.press = { kind: 'sea', steer: true }; steerRay(c); buzz(c, 0.3, 20); }
    else { _sm.copy(GL.sets.fish.group.matrixWorld).invert(); if (sendShark(_xb.copy(c.d).transformDirection(_sm).toArray())) buzz(c, 0.5, 40); }
  } else { c.press = Object.assign(startDrag(c), { kind: 'globe', i: h.i, pk: h.pk }); orbit.held = true; }
}
// the point on a controller's ray as far from it as the school is: where the shark goes
const _xs = new THREE.Vector3();
function steerRay(c) {
  const p = schoolAt(), w = _xs.set(p[0], p[1], p[2]).applyMatrix4(GL.world.matrixWorld), d = clamp(c.o.distanceTo(w), 1, 12);
  GL.sets.fish.steer(inFish(_xs.copy(c.d).multiplyScalar(d).add(c.o)));
}
//#use xrRelease
function xrReleaseScene(c, p) {
  if (p.kind === 'sea') { GL.sets.fish.steer(null); return; }
  if (p.kind === 'globe') orbit.held = false;
  if (!p.moved && p.pk) { buzz(c); xrClickPick(p.pk); }
}
//#use xrGrab
// the sea: the school moves with your hand (one hand at a time; it lets go of the shark you were leading)
function xrGrabScene(c, h) {
  if (h.kind !== 'sea') return false;
  if (seaHeld()) return true;
  if (c.press && c.press.kind === 'sea') { c.press = null; GL.sets.fish.steer(null); }
  c.grab = { target: 'sea', o0: GL.rig.worldToLocal(c.o.clone()), st: seaSt(), off0: (seaSt() ? XR.lifeSt : XR.lifeTo).clone() };
  buzz(c, 0.4, 25);
  return true;
}
//#use _gq carry
function xrCarryScene(c, G) {
  if (G.target !== 'sea') return false;
  carrySea(c, G);
  return true;
}
// the sea (the school life size round you) follows the hand's move since the grip, in the rig's frame, within a few
// metres (placeLife eases it there): this headset's own, or at a shared room's station the station's, for everyone
// there (the rig is the station's spot on every headset there, so the same offset is the same place in the room)
const seaHeld = () => XR.ctrls.some(k => k.grab && k.grab.target === 'sea');
const seaSt = () => !!(HOST.room && HOST.room.placing());
// up or down 2 m, 6 m to the side, to the centimetre: the station's value goes out as it is, so apply(state()) gives it
// back unchanged (the 1 cm of slack keeps a rounded value from being shortened again)
function seaClamp(v) {
  const l = Math.hypot(v.x, v.z), k = l > 6.01 ? 6 / l : 1, r = x => Math.round(x * 100) / 100 + 0;
  return v.set(r(v.x * k), r(clamp(v.y, -2, 2)), r(v.z * k));
}
function carrySea(c, G) {
  if (G.st !== seaSt()) { c.grab = null; return; }   // (reached or left a station meanwhile)
  GL.rig.worldToLocal(_gv.copy(c.o)).sub(G.o0).add(G.off0);
  (G.st ? XR.lifeSt : XR.lifeTo).copy(seaClamp(_gv));
}
//#use xrResize xrPoint xrBallHit
// among the fish, anywhere else is the sea (the dot sits out along the ray)
function xrSceneHit(c) {
  if (GL.lifeOn) return { kind: 'sea', point: _xp.copy(c.d).multiplyScalar(4).add(c.o).clone() };
  return xrBallHit(c);
}
function xrDrag(c) {
  if (c.press && c.press.kind === 'globe') dragGlobe(c, c.press);
  if (c.press && c.press.kind === 'sea') { if (sharking()) steerRay(c); else { c.press = null; GL.sets.fish.steer(null); } }
}
function xrSticks() { return X.scene !== 'fish'; }   // (the fish are life size round you: nothing to spin or zoom)
//#use _xUp xrBegin xrPosed
function xrPointed(frame, ref) { xrFingertip(frame, ref); }
//#use xrUpdate xrExtraAlpha
// Be the shark with a tracked hand: the shark follows your index fingertip (the trigger held on the sea does the same
// for a controller)
function xrFingertip(frame, ref) {
  if (!sharking() || !frame || !ref || !frame.getJointPose || XR.ctrls.some(c => c.press && c.press.kind === 'sea') || seaHeld()) { if (XR.tipSteer) { XR.tipSteer = false; GL.sets.fish.steer(null); } return; }
  let tip = null;
  try {
    for (const src of (XR.session && XR.session.inputSources) || []) {
      const j = src.hand && src.hand.get && src.hand.get('index-finger-tip'), pose = j && frame.getJointPose(j, ref);
      if (pose) { tip = pose.transform.position; if (src.handedness === 'right') break; }
    }
  } catch (e) { tip = null; }
  if (!tip) { if (XR.tipSteer) { XR.tipSteer = false; GL.sets.fish.steer(null); } return; }
  // (the reference space is the rig's parent's frame: the scene's own)
  XR.tipSteer = true;
  GL.sets.fish.steer(inFish(_xs.set(tip.x, tip.y, tip.z)));
}

//#use xrClickPick xrMinD xrZoom xrMsg xrStart xrOnReset xrEnterScene
// a new session: the sea at your own eye height (a station's sea stays: placeLife takes it there)
function xrOnEnter() { XR.lifeOff.set(0, 0, 0); XR.lifeTo.set(0, 0, 0); XR.lifeAt = false; }
//#use xrStars XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded xrOnEnd xrSetup
