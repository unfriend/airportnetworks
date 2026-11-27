//#use WEBXR XR
XR.room = false;   // the scanner life size (xrRoom)
//#use _xd _xq2 _xa _xX xrPlace
// life size: the scanner on your floor (explore mode, the scanner on show)
function xrLife() { return XR.room && APP.mode === 'explore' && X.scene === 'scan'; }
function xrPlaceLife(v) {
  // life size: the scanner (1 unit = 1 m) standing on your floor, its floor 1.6 m below your eyes (the reference space
  // is 'local': the floor is unknown, as for the flock's land), the bore as far ahead as the set's life view, the couch
  // towards you; the thumbstick turns it on its spot
  if (!xrLife()) return false;
  const lv = view('scan', 'life'), d = clamp(lv[2], 1.8, 4);
  XR.R = 1; XR.hitR = 1.4; XR.target.set(lv[3], lv[4], lv[5]);
  GL.world.quaternion.setFromAxisAngle(_xY, -(v[0] - lv[0]) * D2R);
  GL.world.scale.setScalar(1);
  // the life view's target that far ahead of you; the rig is at your eyes
  _xb.set(lv[3], 0, lv[5]).applyQuaternion(GL.world.quaternion);
  GL.world.position.set(-_xb.x, -1.6 - scanFloorY(), -d - _xb.z);
  return true;
}
//#use xrCap xrRecenterAsk xrRecenter xrLifeHome xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly
//#use xrAway _xrNoWalk xrIdle compileLate xrWarm xrCards xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace
//#use xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw labelSprite labelSign dropSprite hideLabelXR
//#use placeLabelXR
function xrLabelH() { return (xrLife() ? 0.036 : 0.021) / XR.R; }   // (life size: the labels are further away)
//#use xrTip _prc
// the organs a ray points at only while they are on show
function pickRay(o, d) {
  if (APP.mode !== 'explore' || X.scene !== 'organs') return null;
  _prc.set(o, d);
  return pickWith(_prc);
}

//#use xrController xrLetGo buzz rayAngles startDrag dragGlobe xrPress xrPressScene xrRelease xrReleaseScene xrGrab
function xrGrabScene() { return xrLife(); }   // life size: the scanner stands on your floor
//#use _gq carry xrCarryScene xrResize xrPoint xrBallHit xrSceneHit xrDrag xrSticks _xUp xrBegin xrPosed xrPointed
//#use xrUpdate xrExtraAlpha xrClickPick
// Life size: in the headset the scanner stands on your floor in front of you
function xrRoom(on) { XR.room = on; }
// where the scanner's floor is in its own frame (the bore's centre is its origin); in passthrough the scanner's floor
// and its reflection are hidden by its param scan_floor (set in frame()), so the room's own floor shows
const scanFloorY = () => GL.sets.scan.floorY;
// how close the headset may zoom: as close as the scene's own closest view, else 0.9 (closer, the scene would surround your head)
const xrMinD = () => (XR.room && X.scene === 'scan' ? 0.05 : Math.min(0.9, ...Object.values(GL.sets[X.scene].cam || {}).map(v => +v[2] || 9)));
//#use xrZoom xrMsg xrStart xrOnReset xrEnterScene
function xrOnEnter() { XR.room = !!X.life; }
//#use xrStars XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded xrOnEnd xrSetup
