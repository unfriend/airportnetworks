//#use WEBXR XR _xd _xq2 _xa _xX xrPlace xrPlaceLife xrCap xrRecenterAsk xrRecenter xrLifeHome xrLabelMode xrCardMode
//#use xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk xrIdle xrWarm xrCards xrAllHere xrCaption _fq yawOf
//#use xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw
//#use labelSprite labelSign dropSprite hideLabelXR placeLabelXR xrLabelH xrTip _prc pickRay xrController xrLetGo buzz
//#use rayAngles startDrag dragGlobe xrPress xrPressScene xrRelease xrReleaseScene xrGrab xrGrabScene _gq carry
//#use xrCarryScene xrResize xrPoint xrBallHit xrDrag xrSticks _xUp xrBegin xrPosed xrPointed xrUpdate
//#use xrExtraAlpha xrClickPick xrMinD xrZoom xrMsg xrStart xrOnReset xrEnterScene xrOnEnter xrStars XR_AWAY_MS
//#use xrVisibility xrFreshStart xrAdopt xrEnded xrOnEnd xrSetup
// what of the scene a controller points at (xrPoint): the ball round the view's target (xrBallHit) and, in the story,
// a ball round the hairball and one round the cell wherever they stand, so the grip and the trigger find both while
// they stand side by side (the owner, 22 November 2026: the ray passed through one of them)
const _shR = new THREE.Ray(), _shM = new THREE.Matrix4(), _shS = new THREE.Sphere(), _shP = new THREE.Vector3();
function xrSceneHit(c) {
  const h = xrBallHit(c);
  if (h || APP.mode !== 'story') return h;
  let best = null, bd = Infinity;
  for (const [k, at] of [['ball', () => GL.sets.ball.anchors.ball()], ['cell', () => [0, 0, 0]]]) {
    const s = GL.sets[k];
    if (!s || s.uA.value < 0.05) continue;
    _shM.copy(s.group.matrixWorld).invert();
    _shR.set(c.o, c.d).applyMatrix4(_shM);
    _shS.center.fromArray(at()); _shS.radius = 1.05;
    if (!_shR.intersectSphere(_shS, _shP)) continue;
    _shP.applyMatrix4(s.group.matrixWorld);
    const d = _shP.distanceTo(c.o);
    if (d < bd) { bd = d; best = { kind: 'globe', i: -1, pk: null, point: _shP.clone() }; }
  }
  return best;
}

