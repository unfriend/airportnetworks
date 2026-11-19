//#use XR~2 _xd _xq2 _xa _xX
function xrPlace(v, dt) {
  // standing inside the tower: life size, its middle where you stand, turned by the thumbstick
  if (XR.room && APP.mode === 'explore' && X.scene === 'tower') {
    XR.R = 1; XR.hitR = 1.3; XR.target.set(0, 0, 0);
    GL.world.quaternion.setFromAxisAngle(_xY, -v[0] * D2R); XR.cap = 0;   // (no cap: you stand inside it)
    GL.world.scale.setScalar(1);
    GL.world.position.set(0, -0.2, 0);
    return;
  }
  const d = Math.max(v[2], 0.05);
  _xq.setFromAxisAngle(_xX, clamp(v[1], -85, 85) * D2R).multiply(_xq2.setFromAxisAngle(_xY, -v[0] * D2R));
  const R0 = XR.baseR * clamp(Math.pow(3.6 / d, 0.85), 0.12, 10) * XR.size;   // (times the size your hands or the room gave it)
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
  // kept clear of your head (xrClear): the cap comes in quickly and lets go slowly, and the scale bends smoothly into
  // it; it never takes away the size of an overview or the size your hands gave it (lo)
  const lo = Math.min(R0, XR.baseR * XR.size), c = Math.max(lo, xrClear(gx, gy, gz, 2 * R0));
  XR.cap = XR.cap > 0 && dt !== undefined ? XR.cap * Math.pow(c / XR.cap, 1 - Math.exp(-dt / (c < XR.cap ? 0.12 : 0.5))) : c;
  const x = R0 / XR.cap;
  XR.R = Math.max(lo, XR.cap * (x < 0.8 ? x : 0.8 + 0.2 * Math.tanh((x - 0.8) / 0.2)));
  GL.world.scale.setScalar(XR.R);
  // the target lands on the placement point
  _xb.copy(XR.target).applyQuaternion(GL.world.quaternion).multiplyScalar(XR.R);
  GL.world.position.set(gx - _xb.x, gy - _xb.y, gz - _xb.z);
}
//#use XR_NEAR _xsm xrKey xrDrawn xrSampler _xjob xrPrep xrClear xrRecenterAsk xrRecenter xrLabelMode xrCardMode
//#use xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk xrIdle xrWarm xrCards xrAllHere xrCaption _fq
//#use yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint labelTex
//#use labelRedraw labelSprite labelSign dropSprite hideLabelXR placeLabelXR
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

//#use xrController buzz rayAngles startDrag dragGlobe xrPress~2
function xrRelease(c) {
  const p = c.press;
  c.press = null;
  if (!p) return;
  if (p.kind === 'globe') orbit.held = false;
  if (p.kind === 'panel') {
    if (p.r.drag) return;
    const h = c.hover;
    if (h && h.kind === 'panel' && h.P === p.P) {
      const r = h.P.at(h.x, h.y);
      // (a soft click at the button, unless the press made a sound of its own: the shell's rule for page buttons)
      if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }
    }
  } else if (!p.moved && p.i >= 0) { buzz(c); xrClickGene(p.i); }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || h.menu || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind !== 'panel' && XR.room && APP.mode === 'explore' && X.scene === 'tower') return;   // standing inside the tower: life size round you
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
    // the scene counts as a ball around the view's target; a curated protein counts if the ray passes close
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const i = pickRay(oL, dL);
    if (t > 0 || i >= 0) {
      if (i >= 0) { const q = TW().anchors.gene(i); _xp.set(q[0], q[1], q[2]).applyMatrix4(TW().group.matrix); }
      else _xp.copy(dL).multiplyScalar(t).add(oL);
      _xp.applyMatrix4(GL.world.matrixWorld);
      hit = { kind: 'globe', i, point: _xp.clone() };
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

//#use _xUp xrBegin xrUpdate
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
  XR.room = !!X.room;
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
//#use XR_AWAY_MS xrVisibility xrFreshStart xrAdopt~2 xrEnded~2 xrSetup