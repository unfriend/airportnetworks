//#use WEBXR XR
XR.room = false;   // standing in the gap (xrRoom)
//#use _xd _xq2 _xa _xX xrPlace
// standing in the gap (explore mode, the synapse on show)
function xrLife() { return XR.room && APP.mode === 'explore' && X.scene === 'syn'; }
function xrPlaceLife(v) {
  // standing in the gap: the synapse life size around you (gapScale), the cleft at your chest, turned by the thumbstick
  if (!xrLife()) return false;
  const g = anchorOf('syn', 'gap');
  XR.R = gapScale(); XR.hitR = 1.2 / XR.R; XR.target.set(g[0], g[1], g[2]);
  GL.world.quaternion.setFromAxisAngle(_xY, -v[0] * D2R); XR.cap = 0;   // (no cap: you stand inside it)
  GL.world.scale.setScalar(XR.R);
  _xb.copy(XR.target).applyQuaternion(GL.world.quaternion).multiplyScalar(XR.R);
  GL.world.position.set(-_xb.x, -0.35 - _xb.y, -_xb.z);   // the rig is at your eyes: the cleft 35 cm below them
  return true;
}
//#use xrCap~2 XR_NEAR _xsm xrKey xrDrawn xrSampler _xjob xrPrep xrClear xrRecenterAsk xrRecenter xrLifeHome xrLabelMode
//#use xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk xrIdle xrWarm xrCards xrAllHere
//#use xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint
//#use labelTex labelRedraw labelSprite labelSign dropSprite hideLabelXR placeLabelXR xrLabelH xrTip _prc
// the genes and endotypes a ray points at only while the network or the tree is on show: { gene } or { endo }
function pickRay(o, d) {
  if (APP.mode !== 'explore' || !(X.scene === 'net' || X.scene === 'tree')) return null;
  _prc.set(o, d);
  return pickWith(_prc);
}

//#use xrController xrLetGo buzz rayAngles startDrag dragGlobe xrPress xrPressScene xrRelease xrReleaseScene xrGrab
function xrGrabScene() { return xrLife(); }   // standing in the gap: life size round you
//#use _gq carry xrCarryScene xrResize xrPoint xrBallHit
// a gene pointed at carries its index (hit.i), as a click on it does
function xrSceneHit(c) {
  const h = xrBallHit(c);
  if (h && h.pk && h.pk.gene >= 0) h.i = h.pk.gene;
  return h;
}
//#use xrDrag xrSticks _xUp xrBegin xrPosed xrPointed xrUpdate xrExtraAlpha xrClickPick
function xrPickSuggestion(i) {
  XR.kbd.open = false; XR.kbd.q = '';
  $('#q').value = ED.genes[i].sym; showTab('genes'); selectGene(i);
}
// Stand in the gap: in the headset the synapse is shown around you, the cleft at your chest
function xrRoom(on) { XR.room = on; }
// the gap's scale (metres per unit): with the cleft's middle at your chest, the nerve ending's vesicles about 0.85 m
// above it (over your head) and the receptor-covered crests of the folds 0.25 m below it (at your hips); the folds
// go down from there and the muscle is under your feet (about 4 m to the unit)
function gapScale() {
  if (XR.gapR) return XR.gapR;
  const g = anchorOf('syn', 'gap')[1], up = anchorOf('syn', 'vesicles')[1] - g, down = g - anchorOf('syn', 'receptors')[1];
  const k = [up > 0.01 ? 0.85 / up : 0, down > 0.01 ? 0.25 / down : 0].filter(x => x > 0);
  return (XR.gapR = k.length ? k.reduce((a, x) => a + x, 0) / k.length : 2);
}
// how close the headset may zoom: as close as the scene's own closest view, else 0.9 (closer, the scene would surround your head)
const xrMinD = () => (XR.room && X.scene === 'syn' ? 0.05 : Math.min(0.9, ...Object.values(GL.sets[X.scene].cam || {}).map(v => +v[2] || 9)));
//#use xrZoom xrMsg xrStart xrOnReset xrEnterScene
function xrOnEnter() { XR.room = !!X.gap; }
//#use xrStars XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded xrOnEnd~2 xrSetup
