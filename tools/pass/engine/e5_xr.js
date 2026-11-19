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
  // where the sea has been moved with the grip (placeLife): lifeTo this headset's own, lifeSt a shared room's station's
  // (the same for everyone there: collab.state()'s sea), lifeOff as drawn, easing to the one in use (seaSt)
  lifeOff: new THREE.Vector3(), lifeTo: new THREE.Vector3(), lifeSt: new THREE.Vector3(), lifeAt: false,
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' },
};
//#use _xd _xq2 _xa
// ------------------------------------------------------------ scene pose --
// Turn a story/orbit view [az, el, dist, tx, ty, tz] into a pose for the
// floating scene: the side the camera looks from faces you, "up" stays up, the
// target sits in front of you, and closer views make the scene bigger.
// (the globe and the cell; the fish are life size round you whatever the view: their holder undoes this, placeLife)
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
//#use xrPlace xrRecenterAsk
function xrRecenter() {
  XR.globeOff.set(0, 0, 0); XR.size = 1; XR.rot.identity(); XR.lifeTo.set(0, 0, 0); if (!seaSt()) XR.lifeOff.set(0, 0, 0);   // (never the station's sea)
  if (XR.panelGroup) xrPanelPose(XR.panelHome.p, XR.panelHome.yaw);
  // anchored: the scene and the panel go back where they were saved with the place
  const s = HOST.anchor.saved();
  if (s) { XR.globeOff.fromArray(s.off); XR.size = s.s || 1; xrSceneRot(s.q); if (XR.panelGroup) xrPanelPose(s.pp, s.pr, s.pq); }
  const yaw = new THREE.Euler().setFromQuaternion(XR.headQ, 'YXZ').y;
  GL.rig.position.copy(XR.head);
  GL.rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

//#use xrLabelMode xrCardMode xrFreeOn xrSig xrWalking xrPanels xrRoomOnly xrAway _xrNoWalk xrIdle xrWarm xrCards
//#use xrAllHere xrCaption _fq yawOf xrQ xrSceneRot xrPanelPose xrRigTurn xrFace xrSettings
// ---------------------------------------------------------------- labels --
const LBL_STYLE = { '': ['#f2f6fc', null], mag: ['#ffd2f4', '#ff5ad9'], amb: ['#ffe2b0', '#ffb43b'],
  grn: ['#c9ffe3', '#3ee08f'], cyn: ['#d2f6ff', '#46d9ff'], tl: ['#cbfff3', '#38e6c7'], tip: ['#e7eef8', '#46d9ff'] };   // (tl: the cell map's teal signals)
//#use labelWords labelPaint labelTex labelRedraw labelSprite labelSign dropSprite hideLabelXR
function placeLabelXR(L, alpha, S) {
  // on top (a sprite), in 3D (a sign) or hidden, as the shell's setting says; the pointer's tip is always a sprite
  const m = L === XR.tip ? 'face' : XR.lm, fixed = m === 'fixed';
  if (alpha <= 0.001 || m === 'hidden') { hideLabelXR(L); return; }
  if (fixed ? L.sprite : L.sign) (fixed ? L.sprite : L.sign).visible = false;
  const sp = fixed ? labelSign(L) : labelSprite(L), o = alpha;
  sp.visible = o > 0.01;
  sp.material.opacity = o;
  labelPos(L, sp.position);
  // (2.1 cm tall at arm's length, the same size to the eye further off: the school's labels may be metres away)
  const hm = 0.021 * Math.max(1, sp.position.distanceTo(XR.camLocal) * XR.R) / XR.R;
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
  if (fixed) {
    // upright and turned to you, about the vertical only (the rig's frame): a sign in the scene, not a sprite on top
    _fv.copy(sp.position).applyMatrix4(GL.world.matrix);
    sp.quaternion.copy(XR.signL).multiply(_fq.setFromAxisAngle(_xY, Math.atan2(XR.signH.x - _fv.x, XR.signH.z - _fv.z)));
  }
}
// the airport or the protein a controller points at, labelled where the ray meets it
function xrTip(S) {
  let h = null;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.pk) { h = c.hover; break; }
  const id = h ? JSON.stringify(h.pk) + X.scene : '';
  if (id !== XR.tipI) {
    XR.tipI = id;
    if (XR.tip) dropSprite(XR.tip);
    XR.tip = h ? { set: X.scene, at: [0, 0, 0], txt: [...pickText(h.pk), 'tip'] } : null;
  }
  if (XR.tip) { GL.sets[XR.tip.set].group.worldToLocal(_xp.copy(h.point)); XR.tip.at = [_xp.x, _xp.y, _xp.z]; placeLabelXR(XR.tip, 1, S); }
}

// --------------------------------------------- picking a city or a protein --
// The airport or the protein a ray points at in explore mode (see pickWith), or null
const _prc = new THREE.Raycaster();
//#use pickRay xrController buzz rayAngles startDrag dragGlobe
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
  } else if (h.kind === 'sea') {
    // among the fish in explore mode the trigger is the shark: held, it leads the shark where you point (Be the
    // shark); else a pull sends one that way (not while the sea is being carried)
    if (APP.mode !== 'explore' || X.scene !== 'fish' || XR.stories || seaHeld()) return;
    if (X.shark) { c.press = { kind: 'sea', steer: true }; steerRay(c); buzz(c, 0.3, 20); }
    else { _sm.copy(GL.sets.fish.group.matrixWorld).invert(); if (sendShark(_xb.copy(c.d).transformDirection(_sm).toArray())) buzz(c, 0.5, 40); }
  } else { c.press = Object.assign(startDrag(c), { kind: 'globe', i: h.i, pk: h.pk }); orbit.held = true; }
}
// the point on a controller's ray as far from it as the school is: where the shark goes
const _xs = new THREE.Vector3();
function steerRay(c) {
  const p = schoolAt(), w = _xs.set(p[0], p[1], p[2]).applyMatrix4(GL.world.matrixWorld), d = clamp(c.o.distanceTo(w), 1, 12);
  GL.sets.fish.steer(inFish(_xs.copy(c.d).multiplyScalar(d).add(c.o)));
}
function xrRelease(c) {
  const p = c.press;
  c.press = null;
  if (!p) return;
  if (p.kind === 'globe') orbit.held = false;
  if (p.kind === 'sea') { GL.sets.fish.steer(null); return; }
  if (p.kind === 'panel') {
    if (p.r.drag) return;
    const h = c.hover;
    if (h && h.kind === 'panel' && h.P === p.P) {
      const r = h.P.at(h.x, h.y);
      // (a soft click at the button, unless the press made a sound of its own: the shell's rule for page buttons)
      if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }
    }
  } else if (!p.moved && p.pk) { buzz(c); xrClickPick(p.pk); }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || h.menu || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  // the sea: the school moves with your hand (one hand at a time; it lets go of the shark you were leading)
  if (h.kind === 'sea') {
    if (seaHeld()) return;
    if (c.press && c.press.kind === 'sea') { c.press = null; GL.sets.fish.steer(null); }
    c.grab = { target: 'sea', o0: GL.rig.worldToLocal(c.o.clone()), st: seaSt(), off0: (seaSt() ? XR.lifeSt : XR.lifeTo).clone() };
    buzz(c, 0.4, 25);
    return;
  }
  // the scene is held by its placement point (where the view's target sits), so a still hand moves nothing
  const p0 = h.kind === 'panel' ? XR.panelGroup.getWorldPosition(new THREE.Vector3()) : GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff));
  c.grab = { target: h.kind === 'panel' ? 'panel' : 'globe', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1, r0: (h.kind === 'panel' ? XR.panelGroup.quaternion : XR.rot).clone() };
  buzz(c, 0.4, 25);
}
//#use _gq
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it (moving freely,
// it also turns with your hand, about it: what you hold stays in your hand)
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  // both hands on the scene resize it (xrResize, once a frame); when one lets go, the other carries on from there
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { c.grab = null; return; }   // locked meanwhile (a shared room's story lock: Lock this story)
  if (G.target === 'sea') { carrySea(c, G); return; }
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
// the sea (the school life size round you) follows the hand's move since the grip, in the rig's frame, within a few
// metres (placeLife eases it there): this headset's own, or at a shared room's station the station's, for everyone
// there (the rig is the station's spot on every headset there, so the same offset is the same place in the room)
const seaHeld = () => XR.ctrls.some(k => k.grab && k.grab.target === 'sea');
const seaSt = () => !!(HOST.room && HOST.room.placing());
// up or down 2 m, 6 m to the side, to the centimetre: the station's value goes out as it is, so apply(state()) gives it
// back unchanged (the 1 cm of slack keeps a rounded value from being shortened again)
function seaClamp(v) {
  const l = Math.hypot(v.x, v.z), k = l > 6.01 ? 6 / l : 1, r = x => Math.round(x * 100) / 100 + 0;
  return v.set(r(v.x * k), r(clamp(v.y, -2, 2)), r(v.z * k));
}
function carrySea(c, G) {
  if (G.st !== seaSt()) { c.grab = null; return; }   // (reached or left a station meanwhile)
  GL.rig.worldToLocal(_gv.copy(c.o)).sub(G.o0).add(G.off0);
  (G.st ? XR.lifeSt : XR.lifeTo).copy(seaClamp(_gv));
}
//#use xrResize
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
  } else if (!XR.stories && GL.lifeOn) {
    // among the fish, anywhere else is the sea (the dot sits out along the ray)
    hit = { kind: 'sea', point: _xp.copy(c.d).multiplyScalar(4).add(c.o).clone() };
    dist = 4;
  } else if (!XR.stories) {
    // the scene counts as a ball around the view's target; an airport or a protein counts if the ray passes close
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const pk = pickRay(c.o, c.d);
    if (t > 0 || pk) {
      // a pick with a point of its own is marked there; else the ball's surface
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
  if (c.press && c.press.kind === 'sea') { if (sharking()) steerRay(c); else { c.press = null; GL.sets.fish.steer(null); } }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // thumbstick: spin and zoom the globe (not while the sticks move you: the shell's, xrWalking; nor the right stick while
  // a spaceship flies: that controller is the ship's, HOST.ships)
  const gp = c.src.gamepad;
  if (gp) {
    const ax = gp.axes.length >= 4 ? gp.axes[2] : 0, ay = gp.axes.length >= 4 ? gp.axes[3] : 0;
    if (APP.mode === 'explore' && !c.press && !c.grab && !xrWalking() && !(HOST.ships && HOST.ships.claims(c.src)) && X.scene !== 'fish') {
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
  xrFingertip(frame, ref);
  for (const P of XR.panels) {
    let hv = null;
    for (const c of XR.ctrls) {
      if (c.hover && c.hover.kind === 'panel' && c.hover.P === P) { const r = P.at(c.hover.x, c.hover.y); if (r) hv = r.id; }
    }
    P.hover = hv;
  }
}
//#use xrUpdate
// Be the shark with a tracked hand: the shark follows your index fingertip (the trigger held on the sea does the same
// for a controller)
function xrFingertip(frame, ref) {
  if (!sharking() || !frame || !ref || !frame.getJointPose || XR.ctrls.some(c => c.press && c.press.kind === 'sea') || seaHeld()) { if (XR.tipSteer) { XR.tipSteer = false; GL.sets.fish.steer(null); } return; }
  let tip = null;
  try {
    for (const src of (XR.session && XR.session.inputSources) || []) {
      const j = src.hand && src.hand.get && src.hand.get('index-finger-tip'), pose = j && frame.getJointPose(j, ref);
      if (pose) { tip = pose.transform.position; if (src.handedness === 'right') break; }
    }
  } catch (e) { tip = null; }
  if (!tip) { if (XR.tipSteer) { XR.tipSteer = false; GL.sets.fish.steer(null); } return; }
  // (the reference space is the rig's parent's frame: the scene's own)
  XR.tipSteer = true;
  GL.sets.fish.steer(inFish(_xs.set(tip.x, tip.y, tip.z)));
}

//#use xrClickPick xrMinD xrZoom xrMsg xrStart
function xrEnterScene() {
  XR.stories = false;
  XR.on = true; XR.needRecenter = true; XR.fov = false; XR.tipI = -1;
  XR.free = xrFreeOn(); XR.lm = xrLabelMode(); XR.cm = xrCardMode();   // (as the shell has them: nothing to turn off or on at the first frame)
  XR.lifeOff.set(0, 0, 0); XR.lifeTo.set(0, 0, 0); XR.lifeAt = false;   // (a station's sea stays: placeLife takes it there)
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  GL.stars.visible = XR.clear;
  GL.stars.material.size = 2.2;
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
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
//#use XR_AWAY_MS xrVisibility
function xrFreshStart() {
  XR.kbd.open = false; XR.kbd.q = '';
  for (const c of XR.ctrls) { c.press = null; c.grab = null; c.wantPress = false; }
  XR.lifeTo.set(0, 0, 0); if (!seaSt()) XR.lifeOff.set(0, 0, 0);   // (the sea at a new wearer's own eye height; a station's stays)
  // in a shared room the story and its place stay (at its station the room's clock and state go on applying; away from
  // one a new wearer walks up to a station: no Stories screen in a room)
  if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }
  APP.enterStory(0); APP.playing = false; audioSync();
  XR.stories = true; XR.inStory = false; // a new wearer lands in the Stories screen
  XR.needRecenter = true; // uses the new wearer's head position and direction on the next frame
  lastNow = 0;
}
//#use xrAdopt xrEnded xrSetup