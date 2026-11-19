//#use WEBXR XR
XR.room = false;   // standing inside the tower (xrRoom)
//#use _xd _xq2 _xa _xX xrPlace
// standing inside the tower (explore mode, the tower on show)
function xrLife() { return XR.room && APP.mode === 'explore' && X.scene === 'tower'; }
function xrPlaceLife(v) {
  // standing inside the tower: life size, its middle where you stand, turned by the thumbstick
  if (!xrLife()) return false;
  XR.R = 1; XR.hitR = 1.3; XR.target.set(0, 0, 0);
  GL.world.quaternion.setFromAxisAngle(_xY, -v[0] * D2R); XR.cap = 0;   // (no cap: you stand inside it)
  GL.world.scale.setScalar(1);
  GL.world.position.set(0, -0.2, 0);
  return true;
}
//#use xrCap~2 XR_NEAR _xsm xrKey xrDrawn xrSampler _xjob xrPrep xrClear xrRecenterAsk xrRecenter xrLifeHome xrLabelMode
//#use xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk xrIdle xrWarm xrCards xrAllHere
//#use xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint
//#use labelTex labelRedraw labelSprite labelSign dropSprite hideLabelXR placeLabelXR xrLabelH
function xrTip(S) {
  let i = -1;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.i >= 0) { i = c.hover.i; break; }
  if (i !== XR.tipI) {
    XR.tipI = i;
    if (XR.tip) dropSprite(XR.tip);
    const g = i >= 0 ? ND.genes[i] : null;
    XR.tip = g ? { set: 'tower', at: () => TW().anchors.gene(i), txt: [g.sym, groupsOf(i).map(k => ND.groups[k].short).slice(0, 2).join(', '), 'tip'] } : null;
  }
  if (XR.tip) placeLabelXR(XR.tip, 1, S);
}

// ------------------------------------------------------ picking a gene --
// The gene nearest a ray given in the world's own coordinates (explore mode, tower on show)
const _pinv = new THREE.Matrix4(), _po = new THREE.Vector3(), _pd = new THREE.Vector3();
function pickRay(o, d) {
  if (APP.mode !== 'explore' || X.scene !== 'tower' || !TW().pick) return -1;
  _pinv.copy(TW().group.matrix).invert();
  return TW().pick(_po.copy(o).applyMatrix4(_pinv), _pd.copy(d).transformDirection(_pinv));
}

//#use xrController xrLetGo buzz rayAngles startDrag dragGlobe xrPress xrPressScene xrRelease
function xrReleaseScene(c, p) {
  if (p.kind === 'globe') orbit.held = false;
  if (!p.moved && p.i >= 0) { buzz(c); xrClickGene(p.i); }
}
//#use xrGrab
function xrGrabScene() { return xrLife(); }   // standing inside the tower: life size round you
//#use _gq carry xrCarryScene xrResize xrPoint
// the scene counts as a ball around the view's target; a gene counts if the ray passes close
function xrSceneHit(c) {
  const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
  _xc.copy(oL).sub(XR.target);
  const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
  const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
  const i = pickRay(oL, dL);
  if (!(t > 0 || i >= 0)) return null;
  if (i >= 0) { const q = TW().anchors.gene(i); _xp.set(q[0], q[1], q[2]).applyMatrix4(TW().group.matrix); }
  else _xp.copy(dL).multiplyScalar(t).add(oL);
  _xp.applyMatrix4(GL.world.matrixWorld);
  return { kind: 'globe', i, point: _xp.clone() };
}
//#use xrDrag xrSticks _xUp xrBegin xrPosed xrPointed xrUpdate xrExtraAlpha
// ---------------------------------------------------------- explore glue --
function xrClickGene(i) {
  if (APP.mode !== 'explore') return;
  XR.kbd.open = false;
  $('#q').value = ND.genes[i].sym; showTab('genes'); selectGene(i, false);
}
function xrPickSuggestion(i) {
  XR.kbd.open = false; XR.kbd.q = '';
  $('#q').value = ND.genes[i].sym; showTab('genes'); selectGene(i);
}
// Stand inside: in the headset the tower is shown at about life size around you, centred where you stand
function xrRoom(on) { XR.room = on; }
// how close the headset may zoom: as close as the scene's own closest view, else 0.9 (closer, the scene would surround your head)
const xrMinD = () => (XR.room ? 0.05 : Math.min(0.9, ...Object.values(GL.sets[X.scene].cam || {}).map(v => +v[2] || 9)));
//#use xrZoom xrMsg xrStart xrOnReset xrEnterScene
function xrOnEnter() { XR.room = !!X.room; }
//#use xrStars XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded xrOnEnd~2 xrSetup
