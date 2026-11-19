//#use XR~2 _xd _xq2 _xa _xX
function xrPlace(v) {
  // life size: the scanner (1 unit = 1 m) standing on your floor, its floor 1.6 m below your eyes (the reference space
  // is 'local': the floor is unknown, as for the flock's land), the bore as far ahead as the set's life view, the couch
  // towards you; the thumbstick turns it on its spot
  if (XR.room && APP.mode === 'explore' && X.scene === 'scan') {
    const lv = view('scan', 'life'), d = clamp(lv[2], 1.8, 4);
    XR.R = 1; XR.hitR = 1.4; XR.target.set(lv[3], lv[4], lv[5]);
    GL.world.quaternion.setFromAxisAngle(_xY, -(v[0] - lv[0]) * D2R);
    GL.world.scale.setScalar(1);
    // the life view's target that far ahead of you; the rig is at your eyes
    _xb.set(lv[3], 0, lv[5]).applyQuaternion(GL.world.quaternion);
    GL.world.position.set(-_xb.x, -1.6 - scanFloorY(), -d - _xb.z);
    return;
  }
  const d = Math.max(v[2], 0.05);
  _xq.setFromAxisAngle(_xX, clamp(v[1], -85, 85) * D2R).multiply(_xq2.setFromAxisAngle(_xY, -v[0] * D2R));
  XR.R = XR.baseR * clamp(Math.pow(3.6 / d, 0.85), 0.12, 10) * XR.size;   // (times the size your hands or the room gave it)
  XR.hitR = 1.15 * d / 3.6;
  XR.target.set(v[3], v[4], v[5]);
  // a little right of centre and below eye level, leaving room for the panel on the left
  const dc = 1.2, cx = 0.3, cy = -0.2;
  // plus wherever you have moved it with the grip; the story's focus side keeps facing you (moving freely, it keeps
  // the turn its home place gives it, times the turn you gave it, XR.rot)
  const gx = cx + XR.globeOff.x, gy = cy + XR.globeOff.y, gz = -dc + XR.globeOff.z;
  XR.globeBase.set(cx, cy, -dc);
  xrFace(_xq2, gx, gy, gz);
  GL.world.quaternion.copy(_xq2).multiply(_xq);
  GL.world.scale.setScalar(XR.R);
  // the target lands on the placement point
  _xb.copy(XR.target).applyQuaternion(GL.world.quaternion).multiplyScalar(XR.R);
  GL.world.position.set(gx - _xb.x, gy - _xb.y, gz - _xb.z);
}
//#use xrRecenterAsk xrRecenter xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk
//#use xrIdle xrWarm xrCards xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings
//#use LBL_STYLE labelWords labelPaint labelTex labelRedraw labelSprite labelSign dropSprite hideLabelXR
function placeLabelXR(L, alpha, S) {
  // on top (a sprite), in 3D (a sign) or hidden, as the shell's setting says; the pointer's tip is always a sprite
  const m = L === XR.tip ? 'face' : XR.lm, fixed = m === 'fixed';
  if (alpha <= 0.001 || m === 'hidden') { hideLabelXR(L); return; }
  if (fixed ? L.sprite : L.sign) (fixed ? L.sprite : L.sign).visible = false;
  const sp = fixed ? labelSign(L) : labelSprite(L), o = alpha;
  sp.visible = o > 0.01;
  sp.material.opacity = o;
  labelPos(L, sp.position);
  const hm = (XR.room && APP.mode === 'explore' && X.scene === 'scan' ? 0.036 : 0.021) / XR.R;   // (life size: the labels are further away)
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
  if (fixed) {
    // upright and turned to you, about the vertical only (the rig's frame): a sign in the scene, not a sprite on top
    _fv.copy(sp.position).applyMatrix4(GL.world.matrix);
    sp.quaternion.copy(XR.signL).multiply(_fq.setFromAxisAngle(_xY, Math.atan2(XR.signH.x - _fv.x, XR.signH.z - _fv.z)));
  }
}
// the organ or group a controller points at, labelled where the ray meets it
function xrTip(S) {
  let h = null;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.pk) { h = c.hover; break; }
  const id = h ? (h.pk.organ ? 'o' + h.pk.organ : 'g' + h.pk.group) + X.scene : '';
  if (id !== XR.tipI) {
    XR.tipI = id;
    if (XR.tip) dropSprite(XR.tip);
    XR.tip = h ? { set: X.scene, at: [0, 0, 0], txt: [...pickText(h.pk), 'tip'] } : null;
  }
  if (XR.tip) { GL.sets[XR.tip.set].group.worldToLocal(_xp.copy(h.point)); XR.tip.at = [_xp.x, _xp.y, _xp.z]; placeLabelXR(XR.tip, 1, S); }
}

// ---------------------------------------------------- picking an organ --
// The organ a ray points at (explore mode, the organs on show): { organ }, or null
const _prc = new THREE.Raycaster();
function pickRay(o, d) {
  if (APP.mode !== 'explore' || X.scene !== 'organs') return null;
  _prc.set(o, d);
  return pickWith(_prc);
}

//#use xrController buzz rayAngles startDrag dragGlobe xrPress xrRelease
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || h.menu || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind !== 'panel' && XR.room && APP.mode === 'explore' && X.scene === 'scan') return;   // life size: the scanner stands on your floor
  // the scene is held by its placement point (where the view's target sits), so a still hand moves nothing
  const p0 = h.kind === 'panel' ? XR.panelGroup.getWorldPosition(new THREE.Vector3()) : GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff));
  c.grab = { target: h.kind === 'panel' ? 'panel' : 'globe', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1, r0: (h.kind === 'panel' ? XR.panelGroup.quaternion : XR.rot).clone() };
  buzz(c, 0.4, 25);
}
//#use _gq carry xrResize
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
    // the scene counts as a ball around the view's target; an organ or a group counts if the ray passes close
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const pk = pickRay(c.o, c.d);
    if (t > 0 || pk) {
      // an organ or a group is marked where it is; else the ball's surface
      const q = pk ? pickPos(pk) : null;
      if (q) _xp.set(q[0], q[1], q[2]).applyMatrix4(GL.sets[X.scene].group.matrixWorld);
      else _xp.copy(dL).multiplyScalar(t > 0 ? t : Math.max(0, _xc.copy(XR.target).sub(oL).dot(dL))).add(oL).applyMatrix4(GL.world.matrixWorld);
      hit = { kind: 'globe', i: -1, pk, point: _xp.clone() };
      dist = c.o.distanceTo(_xp);
    }
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.press && c.press.kind === 'globe') dragGlobe(c, c.press);
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // thumbstick: spin and zoom the globe (not while the sticks move you: the shell's, xrWalking; nor the right stick while
  // a spaceship flies: that controller is the ship's, HOST.ships)
  const gp = c.src.gamepad;
  if (gp) {
    const ax = gp.axes.length >= 4 ? gp.axes[2] : 0, ay = gp.axes.length >= 4 ? gp.axes[3] : 0;
    if (APP.mode === 'explore' && !c.press && !c.grab && !xrWalking() && !(HOST.ships && HOST.ships.claims(c.src))) {
      if (Math.abs(ay) > 0.2) { orbit.to = null; orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ay * dt * 1.5), xrMinD(), 40); }
      if (Math.abs(ax) > 0.2) { orbit.to = null; orbit.cur[0] -= ax * dt * 60; }
    }
  }
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    c.dot.lookAt(XR.head);
    c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head)));
  } else c.dot.visible = false;
}

//#use _xUp xrBegin xrUpdate xrClickPick
// Life size: in the headset the scanner stands on your floor in front of you
function xrRoom(on) { XR.room = on; }
// where the scanner's floor is in its own frame (the bore's centre is its origin); in passthrough the scanner's floor
// and its reflection are hidden by its param scan_floor (set in frame()), so the room's own floor shows
const scanFloorY = () => GL.sets.scan.floorY;
// how close the headset may zoom: as close as the scene's own closest view, else 0.9 (closer, the scene would surround your head)
const xrMinD = () => (XR.room && X.scene === 'scan' ? 0.05 : Math.min(0.9, ...Object.values(GL.sets[X.scene].cam || {}).map(v => +v[2] || 9)));
//#use xrZoom xrMsg xrStart
function xrEnterScene() {
  XR.stories = false;
  XR.on = true; XR.needRecenter = true; XR.fov = false; XR.tipI = -1;
  XR.free = xrFreeOn(); XR.lm = xrLabelMode(); XR.cm = xrCardMode();   // (as the shell has them: nothing to turn off or on at the first frame)
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  GL.stars.visible = XR.clear;
  GL.stars.material.size = 2.2;
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
  XR.room = !!X.life;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.o = -1;
  // every headset session starts the story from the top; entered from the start screen, it shows the Stories menu first
  // (not in a shared room: there a story is reached by walking into its station's circle)
  XR.inRoom = xrRoomOnly();
  const fromStart = (HOST.picking || HOST.landingVR) && !XR.inRoom;
  HOST.landingVR = false;
  HOST.closePicker();
  if (fromStart) { APP.enterStory(0); APP.playing = false; XR.stories = true; XR.inStory = false; audioSync(); }
  else { XR.inStory = true; if (APP.mode === 'story') APP.playing = true; } // already in a story: carry on where you were
  $('#tip').style.opacity = 0;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.el.style.opacity = 0;
  if (document.fonts && !XR.fontOK) {
    Promise.all([document.fonts.load(vfont(30, 700)), document.fonts.load(vfont(30))]).then(() => {
      XR.fontOK = 1;
      [...ST.labels, ...LBL.sets, ...LBL.extra].forEach(dropSprite);
    }).catch(() => {});
  }
}
//#use XR_AWAY_MS xrVisibility xrFreshStart xrAdopt~2 xrEnded xrSetup