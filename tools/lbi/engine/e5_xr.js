//#use WEBXR XR
Object.assign(XR, { pf: -1, pt: -1, pick: 'from' });   // a route's two ends in the network, and which one a click fills
//#use _xd _xq2 _xa _xX xrPlace xrPlaceLife xrCap xrRecenterAsk xrRecenter xrLifeHome xrLabelMode xrCardMode xrFreeOn
//#use xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk xrIdle xrWarm xrCards xrAllHere xrCaption _fq yawOf xrQ
//#use xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw
//#use labelSprite labelSign dropSprite hideLabelXR placeLabelXR xrLabelH
function xrTip(S) {
  let i = -1;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.i >= 0) { i = c.hover.i; break; }
  if (i !== XR.tipI) {
    XR.tipI = i;
    if (XR.tip) dropSprite(XR.tip);
    const p = i >= 0 ? INT().core[i] : null;
    XR.tip = p ? { set: 'int', at: () => INT().anchors.protein(p.sym), txt: [p.sym, p.role || p.name, 'tip'] } : null;
  }
  if (XR.tip) placeLabelXR(XR.tip, 1, S);
}

// --------------------------------------------------- picking a protein --
// The curated protein nearest a ray given in the world's own coordinates (explore mode, interactome on show)
const _pinv = new THREE.Matrix4(), _po = new THREE.Vector3(), _pd = new THREE.Vector3();
function pickRay(o, d) {
  if (APP.mode !== 'explore' || X.scene !== 'int' || !INT().pick) return -1;
  _pinv.copy(INT().group.matrix).invert();
  return INT().pick(_po.copy(o).applyMatrix4(_pinv), _pd.copy(d).transformDirection(_pinv));
}

//#use xrController xrLetGo buzz rayAngles startDrag dragGlobe xrPress xrPressScene xrRelease
function xrReleaseScene(c, p) {
  if (p.kind === 'globe') orbit.held = false;
  if (!p.moved && p.i >= 0) { buzz(c); xrClickProtein(p.i); }
}
//#use xrGrab xrGrabScene _gq carry xrCarryScene xrResize xrPoint
// the scene counts as a ball around the view's target; a curated protein counts if the ray passes close
function xrSceneHit(c) {
  const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
  _xc.copy(oL).sub(XR.target);
  const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
  const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
  const i = pickRay(oL, dL);
  if (!(t > 0 || i >= 0)) return null;
  if (i >= 0) { const q = INT().anchors.protein(INT().core[i].sym); _xp.set(q[0], q[1], q[2]).applyMatrix4(INT().group.matrix); }
  else _xp.copy(dL).multiplyScalar(t).add(oL);
  _xp.applyMatrix4(GL.world.matrixWorld);
  return { kind: 'globe', i, point: _xp.clone() };
}
//#use xrDrag xrSticks _xUp xrBegin xrPosed xrPointed xrUpdate xrExtraAlpha
// ---------------------------------------------------------- explore glue --
function xrClickProtein(i) {
  if (APP.mode !== 'explore') return;
  XR.kbd.open = false;
  if (XR.routing) { xrSetPathEnd(i); return; }
  showTab('protein'); selectProtein(i, false);
}
// while routing, clicks in the network fill the highlighted end (From, then To)
function xrSetPathEnd(i) {
  const sym = INT().core[i].sym;
  if (XR.pick === 'to') { XR.pt = i; $('#pt').value = sym; }
  else { XR.pf = i; $('#pf').value = sym; XR.pick = 'to'; }
  if (XR.pf >= 0 && XR.pt >= 0) runRoute(XR.pf, XR.pt);
}
function xrPathPreset(s, t) {
  XR.pf = s; XR.pt = t; XR.pick = 'to';
  $('#pf').value = INT().core[s].sym; $('#pt').value = INT().core[t].sym;
  runRoute(s, t);
}
function xrClearPath() {
  XR.pf = -1; XR.pt = -1; XR.pick = 'from';
  clearRoute(); updateExtraLabels();
}
function xrPickSuggestion(i) {
  XR.kbd.open = false; XR.kbd.q = '';
  if (XR.routing) xrSetPathEnd(i);
  else { $('#q').value = INT().core[i].sym; showTab('protein'); selectProtein(i); }
}
//#use xrMinD xrZoom xrMsg xrStart xrOnReset xrEnterScene
// a route already set on the page carries into the headset
function xrOnEnter() { if (X.pathEnds) { XR.pf = X.pathEnds[0]; XR.pt = X.pathEnds[1]; } }
//#use xrStars XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded xrOnEnd xrSetup