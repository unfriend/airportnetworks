// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). Each scene
// floats in front of you as an object: the story's camera moves become
// rotations and scaling of the scene, the side panel is redrawn on a canvas you
// point at, and labels become sprites on top or signs in the scene. Controllers: point and pull the trigger
// to click, drag the scene with the trigger or grip, thumbstick spins and zooms,
// A and X do nothing (play and pause are on the panel). Hand tracking: point and pinch.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  rot: new THREE.Quaternion(), free: false, lm: 'face', signL: new THREE.Quaternion(), signH: new THREE.Vector3(),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from',
};
//#use _xd _xq2 _xa _xX xrPlace xrRecenterAsk xrRecenter xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels
//#use xrRoomOnly xrAway _xrNoWalk xrIdle xrWarm xrCards xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose
//#use xrRigTurn xrFace xrSettings LBL_STYLE labelWords labelPaint labelTex labelRedraw labelSprite labelSign
//#use dropSprite hideLabelXR placeLabelXR
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
  } else if (!p.moved && p.i >= 0) { buzz(c); xrClickProtein(p.i); }
}
//#use xrGrab _gq carry xrResize
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
      if (i >= 0) { const q = INT().anchors.protein(INT().core[i].sym); _xp.set(q[0], q[1], q[2]).applyMatrix4(INT().group.matrix); }
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
//#use xrMinD xrZoom xrMsg xrStart
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
  if (X.pathEnds) { XR.pf = X.pathEnds[0]; XR.pt = X.pathEnds[1]; }
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