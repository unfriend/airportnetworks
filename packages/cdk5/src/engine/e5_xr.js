//#use WEBXR XR
// standing inside the map: its weight (0..1) and the view it faces; the scene on show (xrPlace)
Object.assign(XR, { inW: 0, inV: [0, 0, 1, 0, 0, 0], scene: 0 });
//#use _xd _xq2 _xa
// ------------------------------------------------------------ scene pose --
// Turn a story/orbit view [az, el, dist, tx, ty, tz] into a pose for the
// floating scene: the side the camera looks from faces you, "up" stays up, the
// target sits in front of you. The story keeps the map at its default size (1 unit is XR_UNIT m: the sphere about
// 1.2 m across, its middle about XR_DC m away), and explore's views make it bigger as they come closer; either way it is
// kept clear of your eyes (XR_CLEAR: the layouts' reach from their middle, XR_BOUND, against where your head is). In
// the first chapter, and with Stand inside in explore, it blends (XR.inW) to standing inside the map instead: its
// middle at your eyes, XR_IN m a unit (the sphere about 2.5 m round you), turned so the inside view's side (CDK5's)
// is in front of you.
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
const XR_UNIT = 0.5, XR_DC = 1.3, XR_IN = 1.25, XR_CLEAR = 0.35;
const _xqi = new THREE.Quaternion(), _xpn = new THREE.Vector3(), _xvd = new THREE.Vector3();
// how far the map reaches from its middle now (the six layouts' bounds, eased with the scene on show)
function xrBound() {
  if (!XR_BOUND.length) return 1.25;
  const s = clamp(XR.scene || 0, 0, XR_BOUND.length - 1), k = Math.floor(s), f = s - k;   // (XR.scene: the frame's net_scene)
  return XR_BOUND[k] + ((XR_BOUND[Math.min(k + 1, XR_BOUND.length - 1)] || 0) - XR_BOUND[k]) * f;
}
// the largest scale (m a unit) that keeps every part of the map at least XR_CLEAR m from your eyes, the view's target
// D m in front of them along the view (its direction vd, local): your head at t + vd D / R in the map's own units
function xrCap(t, vd, D, B) {
  const f = R => { _xpn.copy(vd).multiplyScalar(D / R).add(t); return _xpn.length() - B - XR_CLEAR / R; };
  let lo = 0.02, hi = 20;
  if (f(hi) >= 0) return hi;
  for (let i = 0; i < 26; i++) { const m = Math.sqrt(lo * hi); if (f(m) >= 0) lo = m; else hi = m; }
  return lo;
}
function xrPlace(v) {
  const d = Math.max(v[2], 0.05), w = XR.inW;
  _xq.setFromAxisAngle(_xX, clamp(v[1], -85, 85) * D2R).multiply(_xq2.setFromAxisAngle(_xY, -v[0] * D2R));
  // (explore's zoom: as close as its default view, the default size; closer views bigger)
  const d0 = (GL.sets.net.cam.default || [0, 0, 4.4])[2];
  let R = XR_UNIT * XR.size * (APP.mode === 'story' ? 1 : clamp(Math.pow(d0 / d, 0.6), 0.3, 6));
  XR.target.set(v[3], v[4], v[5]);
  // a little right of centre and below eye level, leaving room for the panel on the left
  const dc = XR_DC, cx = 0.3, cy = -0.2, B = xrBound();
  // kept clear of your eyes (from where the story puts it: a scene moved nearer with the grip comes nearer), and that
  // clearance grows with the size your hands gave it
  viewDir(v, _xvd);
  R = Math.min(R, xrCap(XR.target, _xvd, Math.hypot(cx, cy, dc), B) * XR.size);
  XR.hitR = B;
  // plus wherever you have moved it with the grip; the story's focus side keeps facing you (moving freely, it keeps
  // the turn its home place gives it, times the turn you gave it, XR.rot)
  const gx = cx + XR.globeOff.x, gy = cy + XR.globeOff.y, gz = -dc + XR.globeOff.z;
  XR.globeBase.set(cx, cy, -dc);
  xrFace(_xq2, gx, gy, gz);
  GL.world.quaternion.copy(_xq2).multiply(_xq);
  // the target lands on the placement point
  _xb.copy(XR.target).applyQuaternion(GL.world.quaternion).multiplyScalar(R);
  GL.world.position.set(gx - _xb.x, gy - _xb.y, gz - _xb.z);
  if (w > 0.001) {
    // standing inside: upright, the side the inside view looks at in front, where its camera stands (the map's middle)
    // at your eyes (the rig's origin: where your head was as it was placed)
    const vi = XR.inV, Ri = XR_IN * XR.size;
    _xqi.setFromAxisAngle(_xY, -vi[0] * D2R);
    viewDir(vi, _xb).multiplyScalar(vi[2]).add(_xpn.set(vi[3], vi[4], vi[5])).applyQuaternion(_xqi).multiplyScalar(Ri);
    GL.world.quaternion.slerp(_xqi, w);
    GL.world.position.lerp(_xb.negate(), w);
    R = Math.exp(Math.log(R) + (Math.log(Ri) - Math.log(R)) * w);
    XR.hitR = B * (1 - w) + 3 * w;
    if (w > 0.5) viewDir(vi, XR.target).multiplyScalar(vi[2]).add(_xpn.set(vi[3], vi[4], vi[5]));   // (the ray's ball round your head)
  }
  XR.R = R;
  GL.world.scale.setScalar(R);
}
//#use xrPlaceLife
//#use xrRecenterAsk xrRecenter xrLifeHome xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk xrIdle compileLate xrWarm xrCards xrAllHere
//#use xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw labelSprite labelSign
//#use dropSprite hideLabelXR placeLabelXR xrLabelH
// the protein a controller points at, labelled where the ray meets it
function xrTip(S) {
  let h = null;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.pk) { h = c.hover; break; }
  const id = h ? JSON.stringify(h.pk) + X.scene : '';
  if (id !== XR.tipI) {
    XR.tipI = id;
    if (XR.tip) dropSprite(XR.tip);
    XR.tip = h ? { set: 'net', at: [0, 0, 0], txt: [...pickText(h.pk), 'tip'] } : null;
  }
  if (XR.tip) { GL.sets[XR.tip.set].group.worldToLocal(_xp.copy(h.point)); XR.tip.at = [_xp.x, _xp.y, _xp.z]; placeLabelXR(XR.tip, 1, S); }
}
//#use _prc pickMemo pickRay xrController xrLetGo buzz rayAngles startDrag dragGlobe xrPress xrPressScene xrRelease xrReleaseScene xrGrab xrGrabScene _gq carry
//#use xrCarryScene xrResize xrPoint
// the scene counts as a ball around the view's target; a protein counts if the ray passes close (pickRay): a pick with a
// point of its own is marked there, else the ball's surface
function xrBallHit(c) {
  const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
  _xc.copy(oL).sub(XR.target);
  const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
  const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
  const pk = pickRay(c.o, c.d);
  if (!(t > 0 || pk)) return null;
  const q = pk ? pickPos(pk) : null;
  if (q) _xp.set(q[0], q[1], q[2]).applyMatrix4(GL.sets.net.group.matrixWorld);   // (the core is drawn in the net's frame)
  else _xp.copy(dL).multiplyScalar(t > 0 ? t : Math.max(0, _xc.copy(XR.target).sub(oL).dot(dL))).add(oL).applyMatrix4(GL.world.matrixWorld);
  return { kind: 'globe', i: -1, pk, point: _xp.clone() };
}
//#use xrSceneHit xrDrag xrSticks _xUp xrBegin xrPosed xrPointed xrUpdate xrExtraAlpha xrClickPick
// how close the headset may zoom: as close as the map's closest view other than standing inside it (xrPlace keeps it
// clear of your eyes whatever the zoom; standing inside, the zoom does nothing)
const xrMinD = () => Math.min(0.9, ...Object.entries(GL.sets.net.cam || {}).filter(([k]) => k !== 'inside').map(([, v]) => +v[2] || 9));
//#use xrZoom xrMsg xrStart xrOnReset xrEnterScene xrOnEnter xrStars XR_AWAY_MS xrVisibility xrFreshStart xrAdopt xrEnded xrOnEnd xrSetup
