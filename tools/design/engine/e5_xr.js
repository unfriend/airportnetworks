// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). The table stands life size in front of you, the
// side panel is redrawn on a canvas you point at, and labels become sprites on top or signs in the scene.
// Controllers: point at a miniature to light it, pull the trigger (or pinch) to put it on the stage, and grip it to
// pick it up: it follows your hand and turns with it, both hands size it, let go it stays. The grip on the panel moves
// the panel. A and X do nothing (play and pause are on the panel).
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from',
  rot: new THREE.Quaternion(), free: false, lm: 'face', signL: new THREE.Quaternion(), signH: new THREE.Vector3(),
};
//#use _xd _xq2 _xa _xX~2
// The table is life size: the floor under your feet (the frame hangs at your head, so the floor is a standing eye
// height below it: the reference space is 'local', so the floor is not known), the table's middle 1.55 m ahead of
// where you faced when the place was set, its near edge 40 cm in front of you; views do not move it.
const XR_EYE = 1.6, XR_AHEAD = 1.55;
function xrPlace(v) {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  GL.world.quaternion.identity();
  GL.world.scale.setScalar(1);
  GL.world.position.set(0, -XR_EYE, -XR_AHEAD);
  XR.globeBase.set(0, -XR_EYE, -XR_AHEAD);
}
//#use xrRecenterAsk xrRecenter xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk
//#use xrIdle xrWarm xrCards xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings
//#use LBL_STYLE labelWords labelPaint labelTex labelRedraw labelSprite labelSign dropSprite hideLabelXR
//#use placeLabelXR~2 xrTip
// ----------------------------------------------------------- controllers --
function xrController(i) {
  const g = GL.renderer.xr.getController(i);
  const c = { i, g, src: null, hover: null, press: null, grab: null, wantPress: false, o: new THREE.Vector3(), d: new THREE.Vector3() };
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  c.ray = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
  c.ray.renderOrder = 60;
  g.add(c.ray);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  g.add(tip);
  c.dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  c.dot.renderOrder = 61; c.dot.visible = false;
  GL.scene.add(c.dot);
  g.visible = false;
  g.addEventListener('connected', e => { c.src = e.data; c.ray.visible = e.data.targetRayMode !== 'screen'; });
  g.addEventListener('disconnected', () => { c.src = null; c.press = null; xrLetGo(c); c.hover = null; c.wantPress = false; c.dot.visible = false; });
  // presses are handled on the next frame, once the ray has its fresh pose
  g.addEventListener('selectstart', () => { c.wantPress = true; });
  g.addEventListener('selectend', () => { if (c.wantPress) { c.wantPress = false; xrPress(c); } xrRelease(c); });
  g.addEventListener('squeezestart', () => xrGrab(c, true));
  g.addEventListener('squeezeend', () => xrGrab(c, false));
  GL.scene.add(g);
  XR.ctrls.push(c);
}
//#use buzz
function xrPress(c) {
  const h = c.hover;
  c.press = null;
  if (!h) return;
  if (h.kind === 'shell') { HOST.collab.press(c.i); return; }   // the shared room's panel, previews, calibration
  if (h.kind === 'panel') {
    const r = h.P.at(h.x, h.y);
    if (!r) return;
    c.press = { kind: 'panel', P: h.P, id: r.id, r };
    if (r.drag) { r.drag(h.x, h.y); buzz(c, 0.2, 12); }
  } else if (h.kind === 'mini' && !XR.stories) {   // the trigger (or a pinch) on a miniature puts it on the stage
    c.press = { kind: 'mini' };
    pickProp(h.key); buzz(c, 0.4, 30);
  }
}
//#use xrRelease~2
function xrGrab(c, on) {
  xrLetGo(c);
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || h.menu || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind === 'mini') {   // a miniature, picked up where it stands: it keeps its offset from the hand
    const m = GL.sets.table.mini(h.key);
    if (!m) return;
    GL.world.updateMatrixWorld(true);
    c.grab = { target: 'mini', key: h.key, q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(), o0: c.o.clone(),
      p0: m.holder.getWorldPosition(new THREE.Vector3()), reach: 1, r0: m.holder.getWorldQuaternion(new THREE.Quaternion()) };
    GL.sets.table.carryTo(h.key, m.holder.position, m.holder.quaternion, m.s);
    setHover(h.key); buzz(c, 0.4, 25); sfxAct('grab', 'table', miniPos(h.key));   // (sound effects: picked up)
    return;
  }
  if (h.kind !== 'panel') return;   // the table stays where it is: only the panel and the miniatures move
  const p0 = XR.panelGroup.getWorldPosition(new THREE.Vector3());
  c.grab = { target: 'panel', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1, r0: XR.panelGroup.quaternion.clone() };
  buzz(c, 0.4, 25);
}
// let go of a miniature (the grip up, the controller gone, or locked meanwhile): it stays where it is, unless the other
// hand still holds it
function xrLetGo(c) {
  const G = c.grab;
  c.grab = null;
  if (G && G.target === 'mini' && !XR.ctrls.some(k => k !== c && k.grab && k.grab.target === 'mini' && k.grab.key === G.key)) { GL.sets.table.drop(G.key); sfxAct('drop', 'table', miniPos(G.key)); }   // (sound effects: let go)
  else if (G && G.target === 'mini') { const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.key === G.key); if (o) xrRegrip(o); }
}
// a hand that holds a miniature alone again (the other let go) carries on from where it is now
function xrRegrip(c) {
  const G = c.grab, m = GL.sets.table.mini(G.key);
  G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.reach = 1;
  m.holder.getWorldPosition(G.p0); m.holder.getWorldQuaternion(G.r0);
}
//#use _gq
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it (moving freely,
// it also turns with your hand, about it: what you hold stays in your hand)
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  // both hands on the scene resize it (xrResize, once a frame); when one lets go, the other carries on from there
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { xrLetGo(c); return; }   // locked meanwhile (a shared room's story lock: Lock this story)
  if (G.target === 'mini') { carryMini(c, dt); return; }
  const o = G.target === 'globe' ? XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'globe' && k.src && k.g.visible) : null;
  if (o) { if (c.i > o.i) xrResize(o, c); return; }
  if (G.two) { G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.p0.copy(GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff))); G.reach = 1; G.r0.copy(XR.rot); }
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  const lenMax = 4;
  if (_gv.length() > lenMax) _gv.setLength(lenMax);
  _gv.applyQuaternion(_gq).add(c.o);
  GL.rig.worldToLocal(_gv);
  if (G.target === 'globe') {
    XR.globeOff.copy(_gv).sub(XR.globeBase);
    if (XR.free) XR.rot.copy(xrRigTurn(_gq, _gr)).multiply(G.r0);
  } else {
    XR.panelGroup.position.copy(_gv);
    if (XR.free) { XR.panelGroup.quaternion.copy(xrRigTurn(_gq, _gr)).multiply(G.r0); return; }   // held as it is: it may tilt
    GL.rig.worldToLocal(_gh.copy(XR.head));
    XR.panelGroup.rotation.set(0, Math.atan2(_gh.x - _gv.x, _gh.z - _gv.z), 0); // keep it upright, facing you
  }
}
//#use xrResize
// a miniature in the hand: where the hand puts it (moving freely it turns with the hand as a real object would; else
// it stays upright, turning only about the vertical as the hand does); both hands on it size it (half to four times
// its own size) and move it with their middle
const _mq = new THREE.Quaternion(), _mi = new THREE.Quaternion(), _mv = new THREE.Vector3(), _me = new THREE.Euler();
function carryMini(c, dt) {
  const G = c.grab, T = GL.sets.table, m = T.mini(G.key), gp = c.src.gamepad;
  const o = XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'mini' && k.grab.key === G.key && k.src && k.g.visible);
  GL.world.updateMatrixWorld(true);
  _mi.copy(GL.sets.table.group.getWorldQuaternion(_mq)).invert();
  if (o) {
    if (c.i < o.i) return;   // (once a frame, by the second hand)
    const d = c.o.distanceTo(o.o);
    _mv.copy(c.o).add(o.o).multiplyScalar(0.5);
    const W = G.two || (G.two = o.grab.two = { d0: Math.max(0.05, d), s0: m.s, m0: _mv.clone(), p0: m.holder.getWorldPosition(new THREE.Vector3()) });
    const p = W.p0.clone().add(_mv).sub(W.m0);
    T.carryTo(G.key, T.group.worldToLocal(p), m.holder.quaternion, W.s0 * d / W.d0);
    return;
  }
  if (G.two) xrRegrip(c);
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);   // the hand's turn since it took hold
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  if (_gv.length() > 4) _gv.setLength(4);
  _gv.applyQuaternion(_gq).add(c.o);
  let q;
  if (XR.free) q = _mq.copy(_gq).multiply(G.r0);
  else { _me.setFromQuaternion(_gq, 'YXZ'); q = _mq.setFromAxisAngle(_xY, _me.y).multiply(G.r0); }
  T.carryTo(G.key, T.group.worldToLocal(_gv), q.premultiply(_mi), m.s);
}
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; xrLetGo(c); return; }   // (a controller gone lets go)
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
    // a miniature (lit, its name shown), else the table or the floor (the dot only)
    const ms = XR.raycaster.intersectObjects(GL.sets.table.pickables(), false);
    if (ms.length) { hit = { kind: 'mini', key: ms[0].object.userData.key, point: ms[0].point.clone() }; dist = ms[0].distance; }
    else {
      const ts = XR.raycaster.intersectObjects(XR.solid, false);
      if (ts.length) { hit = { kind: 'table', point: ts[0].point.clone() }; dist = ts[0].distance; }
    }
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    c.dot.lookAt(XR.head);
    c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head)));
  } else c.dot.visible = false;
}

//#use _xUp
function xrBegin(frame, dt) {
  xrSettings();
  const ref = GL.renderer.xr.getReferenceSpace();
  const pose = frame && ref ? frame.getViewerPose(ref) : null;
  if (pose) {
    const p = pose.transform.position, q = pose.transform.orientation;
    XR.head.set(p.x, p.y, p.z); XR.headQ.set(q.x, q.y, q.z, q.w);
    if (XR.needRecenter) { if (!HOST.anchor.held()) xrRecenter(); XR.needRecenter = false; } // an anchored place stays put
    // anchored: the spot in the room carries the frame that holds the panels, the Stories screen and the scene
    // (asked only once the headset has a pose, so a new anchor goes where things really are)
    const A = HOST.anchor.frame(frame, ref);
    if (A) { GL.rig.position.fromArray(A.p); GL.rig.quaternion.setFromAxisAngle(_xUp, A.yaw); }
    // in a shared room no Stories screen: a story is reached by walking into its station's circle, and at its station it
    // is the station's (a shell without HOST.room.away: only there); leaving the room brings it back, as for a new wearer
    const roomOnly = xrRoomOnly();
    if (XR.inRoom && !roomOnly) xrFreshStart();
    XR.inRoom = roomOnly;
    // (at an All stories circle its cards are the Stories screen, opened as the panel's Stories button opens it, and they
    // close once a story is picked there or the headset walks into another circle)
    if (xrCards() && !XR.stories) { XR.stories = true; XR.inStory = false; XR.kbd.open = false; APP.playing = false; }
    if (XR.stories && !xrCards() && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();
  }
  const bl = XR.session && XR.session.renderState.baseLayer;
  if (bl) {
    if (bl.framebufferHeight) XR.viewH = bl.framebufferHeight;
    if (!XR.fov) {
      XR.fov = true;
      try { if ('fixedFoveation' in bl) bl.fixedFoveation = 0.5; } catch (e) { /* not supported */ }
    }
  }
  GL.rig.updateMatrixWorld(true);
  _xinv.copy(GL.world.matrixWorld).invert();
  for (const c of XR.ctrls) xrPoint(c, dt);
  // away from its station in a shared room the story waits, silent (hidden in xrUpdate, not pointable in xrPoint); a
  // pause made here is not the room's (the shell takes no clock or state from a headset that is not at a station)
  if (xrAway() || xrCards()) { APP.playing = false; SLIDE.tail = null; }
  for (const P of XR.panels) {
    let hv = null;
    for (const c of XR.ctrls) {
      if (c.hover && c.hover.kind === 'panel' && c.hover.P === P) { const r = P.at(c.hover.x, c.hover.y); if (r) hv = r.id; }
    }
    P.hover = hv;
  }
  // the miniature a controller points at (or holds) lights up and shows its name
  const ch = XR.ctrls.find(c => c.grab && c.grab.target === 'mini') || XR.ctrls.find(c => c.hover && c.hover.kind === 'mini');
  setHover(ch ? (ch.grab ? ch.grab.key : ch.hover.key) : null);
}
function xrUpdate(S) {
  // the Stories screen replaces the story's panels and hides the story
  const land = !!XR.stories, away = xrAway();   // (away from its station in a shared room: the story hidden, only the shell's things)
  if (XR.land) {
    if (XR.landRev !== HOST.listRev) xrLandingCards();   // a story added while the app runs: its card joins the rows
    for (const P of XR.land) { P.want = land; P.mesh.visible = land && (!P.cap || P.nd > 0); }   // (a card not drawn yet waits: panelTick)
    // cards hidden: no story panel at all, in story and explore mode (the Stories screen, the shell's menu and its
    // clock stay, and its Story tab plays); cards in 3D: the panels stand in the scene, as the labels' signs do (the
    // labels have their own setting). And this story's panels (xrPanels): controls only keeps just the foot bar, hidden
    // neither
    const pm = xrPanels(), pv = !land && !away && XR.cm !== 'hidden';
    XR.main.want = XR.main.mesh.visible = pv && pm === 'shown';   // (want: what xrUpdate shows; a panel it does not show is not drawn, panelTick)
    XR.foot.want = XR.foot.mesh.visible = pv && pm !== 'hidden';
    panelDepth(XR.main, XR.cm === 'fixed'); panelDepth(XR.foot, XR.cm === 'fixed');
  }
  GL.world.visible = !land && !away;
  if (land !== XR.landShown) { XR.landShown = land; HOST.setUrl(land); }
  GL.rig.updateMatrixWorld(true);
  XR.camLocal.copy(XR.head);
  GL.world.worldToLocal(XR.camLocal);
  // labels in 3D: each sign turns to you (placeLabelXR) from the world's frame back to the rig's, where your head is
  XR.signL.copy(GL.world.quaternion).invert();
  GL.rig.worldToLocal(XR.signH.copy(XR.head));
  const story = APP.mode === 'story';
  for (const L of ST.labels) {
    if (story) placeLabelXR(L, fadeVal(storyT(APP.t), L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0), S);
    else hideLabelXR(L);
  }
  for (const L of LBL.sets) placeLabelXR(L, setLabelAlpha(L, S), S);
  for (const L of LBL.extra) {
    if (!story && L.txt) placeLabelXR(L, L.show, S);
    else hideLabelXR(L);
  }
  xrTip(S);
  const now = performance.now();
  XR.landN = 0;   // (the Stories screen's cards drawn for the first time this frame: panelTick)
  for (const P of XR.panels) panelTick(P, now);
}

//#use xrMsg xrStart xrEnterScene~2 XR_AWAY_MS xrVisibility
function xrFreshStart() {
  XR.kbd.open = false; XR.kbd.q = '';
  for (const c of XR.ctrls) { c.press = null; xrLetGo(c); c.wantPress = false; }
  // in a shared room the story and its place stay (at its station the room's clock and state go on applying; away from
  // one a new wearer walks up to a station: no Stories screen in a room)
  if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }
  APP.enterStory(0); APP.playing = false; audioSync();
  XR.stories = true; XR.inStory = false; // a new wearer lands in the Stories screen
  XR.needRecenter = true; // uses the new wearer's head position and direction on the next frame
  lastNow = 0;
}
//#use xrAdopt~2
function xrEnded() {
  if (!XR.on) return;
  const away = xrAway();   // (asked while the session is still the shell's)
  XR.on = false; XR.session = null; XR.mode = null; XR.hiddenAt = 0;
  HOST.session = null;
  document.body.classList.remove('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1);
  for (const P of XR.panels) P.mesh.visible = false;
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; xrLetGo(c); c.hover = null; c.src = null; }
  setHover(null);
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) { hideLabelXR(L); L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  GL.stars.visible = false;   // (the room has no stars)
  GL.world.visible = true;
  for (const P of XR.land || []) P.mesh.visible = false;
  // left the headset from the Stories screen, or away from a station in a shared room (its story hidden and paused
  // there): back to the Stories screen on the page
  if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }
  applyTheme();
  resize();
}
function xrSetup() {
  XR.raycaster = new THREE.Raycaster();
  // panel 0.62 m wide, about 40 degrees to the left and facing you
  const mw = 0.62, px = -0.56, py = 0.04, pz = -0.86, yaw = Math.atan2(-px, -pz);
  XR.main = makePanel(1024, 1200, mw, drawMain, sigMain);
  XR.foot = makePanel(1024, 176, mw, drawFoot, sigFoot);
  XR.panelGroup = new THREE.Group();
  XR.panelHome = { p: new THREE.Vector3(px, py, pz), yaw };
  XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.y = yaw;
  GL.rig.add(XR.panelGroup);
  XR.foot.mesh.position.set(0, -(mw * 1200 / 1024) / 2 - 0.012 - (mw * 176 / 1024) / 2, 0);
  for (const P of [XR.main, XR.foot]) { XR.panelGroup.add(P.mesh); XR.panels.push(P); }
  XR.panelMeshes = XR.panels.map(P => P.mesh);
  XR.solid = GL.sets.table.solid;   // what the pointer's dot lands on when it misses a miniature: the table and the floor
  xrLandingSetup();
  for (let i = 0; i < 2; i++) xrController(i);
  GL.renderer.xr.addEventListener('sessionend', xrEnded);
  $('#btnVR').addEventListener('click', () => xrStart('immersive-vr'));
  $('#btnAR').addEventListener('click', () => xrStart('immersive-ar'));
  if (!navigator.xr) {
    if (/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent)) xrMsg('Open this page over https:// to view it in VR.');
    return;
  }
  navigator.xr.isSessionSupported('immersive-vr').then(vr => {
    if (vr) $('#btnVR').hidden = false;
    // headsets support both; phones only AR, which this layout is not made for
    return navigator.xr.isSessionSupported('immersive-ar').then(ar => { if (ar && vr) $('#btnAR').hidden = false; });
  }).catch(() => {});
}
