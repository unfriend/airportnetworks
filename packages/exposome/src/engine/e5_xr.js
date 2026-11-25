//#use WEBXR XR _xd _xq2 _xa _xX xrPlaceLife xrCap xrRecenterAsk xrRecenter xrLifeHome xrLabelMode xrCardMode
// (builder B) The scene's pose: the engine's xrPlace (the view's side facing you, floating in front, closer views
// bigger), blended (XR.inW) to standing inside the substances' cloud: its middle at your eyes (the rig's origin), XR_IN m
// a unit, the cloud's inside view in front of you, as the CDK5 story stands you inside its map. In the story by story
// time alone (ST.stand: chapters cloud and end, standB in e3b_substances.js), so everyone at a station sees the same; in
// explore with the cloud's From inside view (eased). Nothing comes nearer than 0.35 m to your head: the cloud fades its
// points there (sets/cloud.js).
const XR_IN = 1.25, _xqi = new THREE.Quaternion();
Object.assign(XR, { inW: 0, inT: 0 });
function xrPlace(v) {
  if (xrPlaceLife(v)) return;
  const d = Math.max(v[2], 0.05);
  _xq.setFromAxisAngle(_xX, clamp(v[1], -85, 85) * D2R).multiply(_xq2.setFromAxisAngle(_xY, -v[0] * D2R));
  const R0 = XR.baseR * clamp(Math.pow(3.6 / d, 0.85), 0.12, 10) * XR.size;
  XR.hitR = 1.15 * d / 3.6;
  XR.target.set(v[3], v[4], v[5]);
  const dc = 1.2, cx = 0.3, cy = -0.2;
  const gx = cx + XR.globeOff.x, gy = cy + XR.globeOff.y, gz = -dc + XR.globeOff.z;
  XR.globeBase.set(cx, cy, -dc);
  xrFace(_xq2, gx, gy, gz);
  GL.world.quaternion.copy(_xq2).multiply(_xq);
  let R = xrCap(R0, gx, gy, gz);
  _xb.copy(XR.target).applyQuaternion(GL.world.quaternion).multiplyScalar(R);
  GL.world.position.set(gx - _xb.x, gy - _xb.y, gz - _xb.z);
  // standing inside
  const now = performance.now(), dt = XR.inT ? Math.min(0.1, (now - XR.inT) / 1000) : 0, story = APP.mode === 'story';
  XR.inT = now;
  const want = story ? standB(storyT(APP.t)) : X.scene === 'cloud' && viewIs('cloud', 'inside') ? 1 : 0;
  XR.inW = story ? want : XR.inW + (want - XR.inW) * (1 - Math.exp(-dt * 2.5));
  if (XR.inW < 0.002 && !want) XR.inW = 0;
  const w = XR.inW;
  if (w > 0.001 && GL.sets.cloud) {
    const vi = view('cloud', 'inside'), Ri = XR_IN * XR.size;
    if (story) vi[0] += setYaw('cloud', storyT(APP.t));
    _xqi.setFromAxisAngle(_xY, -vi[0] * D2R);
    viewDir(vi, _xb).multiplyScalar(vi[2]).add(_xp.set(vi[3], vi[4], vi[5])).applyQuaternion(_xqi).multiplyScalar(Ri);
    GL.world.quaternion.slerp(_xqi, w);
    GL.world.position.lerp(_xb.negate(), w);
    R = Math.exp(Math.log(R) + (Math.log(Ri) - Math.log(R)) * w);
    XR.hitR = XR.hitR * (1 - w) + 3 * w;
  }
  XR.R = R;
  GL.world.scale.setScalar(R);
}
//#use xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk xrIdle xrWarm xrCards xrAllHere xrCaption _fq yawOf
//#use xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw
//#use labelSprite labelSign dropSprite hideLabelXR placeLabelXR xrLabelH xrTip _prc pickRay xrController xrLetGo buzz
//#use rayAngles startDrag dragGlobe xrPress xrPressScene xrRelease xrReleaseScene xrGrab xrGrabScene _gq carry
//#use xrCarryScene xrResize xrPoint xrBallHit xrSceneHit xrDrag xrSticks _xUp xrBegin xrPosed xrPointed xrUpdate
//#use xrExtraAlpha xrClickPick xrMinD xrZoom xrMsg xrStart xrOnReset xrEnterScene xrOnEnter xrStars XR_AWAY_MS
//#use xrVisibility xrFreshStart xrAdopt xrEnded xrOnEnd xrSetup

